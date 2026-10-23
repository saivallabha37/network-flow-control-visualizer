import { WindowState } from '../types/protocol.js';
import {
  SimulationConfig,
  ValidatedSimulationConfig,
  validateSimulationConfig,
} from './simulation-config.js';
import {
  SimulationEvent,
  SimulationEventType,
} from './simulation-events.js';
import {
  computeSimulationStatistics,
  SimulationStatistics,
} from './simulation-stats.js';
import { VirtualChannel } from './virtual-channel.js';
import {
  createProtocolAdapter,
  IProtocolSimulationAdapter,
} from './protocol-adapters.js';

export type SimulationStatus =
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'STOPPED';

export interface SimulationState {
  status: SimulationStatus;
  virtualTimeMs: number;
  stepsExecuted: number;
  remainingPayloads: number;
  deliveredPayloadCount: number;
  inFlightCount: number;
  inFlightPackets: ReadonlyArray<import('./virtual-channel.js').InFlightPacket>;
  senderWindow: WindowState;
  receiverBase: number;
  deliveredPayloads: ReadonlyArray<string>;
}

/**
 * Deterministic Event-Driven Simulation Engine.
 *
 * Coordinates virtual sender and receiver endpoints over a simulated lossy/delayed
 * virtual channel driven by a deterministic virtual clock and pseudo-random seed.
 */
export class SimulationEngine {
  private readonly config: ValidatedSimulationConfig;
  private status: SimulationStatus = 'READY';
  private virtualTimeMs: number = 0;
  private stepsExecuted: number = 0;

  private payloadQueue: string[] = [];
  private channel: VirtualChannel;
  private adapter: IProtocolSimulationAdapter;

  private events: SimulationEvent[] = [];
  private eventCounter: number = 0;

  // Statistic Counters
  private originalFramesSent: number = 0;
  private retransmissions: number = 0;
  private acksSent: number = 0;
  private framesDropped: number = 0;
  private acksDropped: number = 0;
  private framesCorrupted: number = 0;
  private timeouts: number = 0;

  constructor(userConfig: SimulationConfig) {
    this.config = validateSimulationConfig(userConfig);
    this.payloadQueue = [...this.config.payloads];

    this.channel = new VirtualChannel({
      oneWayDelayMs: this.config.oneWayDelayMs,
      frameLossRate: this.config.frameLossRate,
      ackLossRate: this.config.ackLossRate,
      corruptionRate: this.config.corruptionRate,
      seed: this.config.seed,
    });

    this.adapter = createProtocolAdapter(this.config);
  }

  public getStatus(): SimulationStatus {
    return this.status;
  }

  public getVirtualTime(): number {
    return this.virtualTimeMs;
  }

  public getEvents(): ReadonlyArray<SimulationEvent> {
    return [...this.events];
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return this.adapter.getDeliveredPayloads();
  }

  public getState(): SimulationState {
    return {
      status: this.status,
      virtualTimeMs: this.virtualTimeMs,
      stepsExecuted: this.stepsExecuted,
      remainingPayloads: this.payloadQueue.length,
      deliveredPayloadCount: this.adapter.getDeliveredPayloads().length,
      inFlightCount: this.channel.getInFlightCount(),
      inFlightPackets: this.channel.getInFlightPackets(),
      senderWindow: this.adapter.getSenderWindowState(),
      receiverBase: this.adapter.getReceiverBase(),
      deliveredPayloads: this.adapter.getDeliveredPayloads(),
    };
  }

  public getStatistics(): SimulationStatistics {
    return computeSimulationStatistics({
      originalFramesSent: this.originalFramesSent,
      retransmissions: this.retransmissions,
      acksSent: this.acksSent,
      framesDropped: this.framesDropped,
      acksDropped: this.acksDropped,
      framesCorrupted: this.framesCorrupted,
      timeouts: this.timeouts,
      payloadsDelivered: this.adapter.getDeliveredPayloads().length,
      totalPayloads: this.config.payloads.length,
      simulationDurationMs: this.virtualTimeMs,
      stepsExecuted: this.stepsExecuted,
    });
  }

  private emitEvent(type: SimulationEventType, details: Record<string, unknown> = {}): SimulationEvent {
    this.eventCounter += 1;
    const event: SimulationEvent = {
      id: `sim-evt-${this.eventCounter}`,
      virtualTimestamp: this.virtualTimeMs,
      type,
      details: {
        protocol: this.config.protocol,
        description: (details.description as string) || type,
        senderWindow: this.adapter.getSenderWindowState(),
        receiverBase: this.adapter.getReceiverBase(),
        ...details,
      },
    };
    this.events.push(event);
    return event;
  }

  /**
   * Starts the simulation and transmits initial frames up to window capacity.
   */
  public start(): void {
    if (this.status !== 'READY' && this.status !== 'PAUSED') {
      return;
    }

    this.status = 'RUNNING';
    this.emitEvent('SIMULATION_STARTED', {
      description: `Simulation started for ${this.config.protocol} with ${this.config.payloads.length} payloads`,
      seed: this.config.seed,
    });

    this.sendPendingPayloads();
  }

  /**
   * Pauses the simulation. Virtual time will not advance while paused.
   */
  public pause(): void {
    if (this.status === 'RUNNING') {
      this.status = 'PAUSED';
      this.emitEvent('SIMULATION_PAUSED', {
        description: `Simulation paused at virtual time ${this.virtualTimeMs}ms`,
      });
    }
  }

  /**
   * Resumes a paused simulation.
   */
  public resume(): void {
    if (this.status === 'PAUSED') {
      this.status = 'RUNNING';
      this.emitEvent('SIMULATION_RESUMED', {
        description: `Simulation resumed at virtual time ${this.virtualTimeMs}ms`,
      });
    }
  }

  /**
   * Resets the simulation to its initial state.
   */
  public reset(): void {
    this.status = 'READY';
    this.virtualTimeMs = 0;
    this.stepsExecuted = 0;
    this.payloadQueue = [...this.config.payloads];
    this.events = [];
    this.eventCounter = 0;

    this.originalFramesSent = 0;
    this.retransmissions = 0;
    this.acksSent = 0;
    this.framesDropped = 0;
    this.acksDropped = 0;
    this.framesCorrupted = 0;
    this.timeouts = 0;

    this.channel.clear();
    // Reinitialize virtual channel with fresh seed sequence
    this.channel = new VirtualChannel({
      oneWayDelayMs: this.config.oneWayDelayMs,
      frameLossRate: this.config.frameLossRate,
      ackLossRate: this.config.ackLossRate,
      corruptionRate: this.config.corruptionRate,
      seed: this.config.seed,
    });

    this.adapter = createProtocolAdapter(this.config);
  }

  /**
   * Advances the simulation by a deterministic time increment (deltaMs).
   */
  public step(stepSizeMs?: number): {
    status: SimulationStatus;
    virtualTimeMs: number;
    eventsGenerated: number;
  } {
    if (this.status === 'COMPLETED' || this.status === 'FAILED' || this.status === 'STOPPED') {
      return { status: this.status, virtualTimeMs: this.virtualTimeMs, eventsGenerated: 0 };
    }

    if (this.status === 'PAUSED') {
      return { status: this.status, virtualTimeMs: this.virtualTimeMs, eventsGenerated: 0 };
    }

    if (this.status === 'READY') {
      this.start();
    }

    const startEventCount = this.events.length;
    const deltaMs = stepSizeMs ?? this.config.tickStepMs;
    this.stepsExecuted += 1;
    this.virtualTimeMs += deltaMs;

    // Safety checks
    if (this.virtualTimeMs >= this.config.maxVirtualTimeMs || this.stepsExecuted >= this.config.maxSteps) {
      this.status = 'STOPPED';
      this.emitEvent('SIMULATION_STOPPED', {
        description: `Simulation stopped: safety threshold reached (${this.virtualTimeMs}ms, ${this.stepsExecuted} steps)`,
        reason: 'SAFETY_LIMIT_REACHED',
      });
      return { status: this.status, virtualTimeMs: this.virtualTimeMs, eventsGenerated: this.events.length - startEventCount };
    }

    // 1. Advance sender retransmission timers
    const tickResult = this.adapter.tick(deltaMs);

    if (tickResult.timedOut) {
      this.timeouts += 1;
      this.emitEvent('TIMEOUT', {
        description: `Sender timeout detected at ${this.virtualTimeMs}ms`,
        retransmittedCount: tickResult.retransmittedFrames.length,
      });

      for (const frame of tickResult.retransmittedFrames) {
        this.retransmissions += 1;
        this.emitEvent('RETRANSMISSION', {
          seqNum: frame.seqNum,
          description: `Retransmitting frame ${frame.seqNum}`,
        });

        this.channel.transmitData(frame, this.virtualTimeMs);
        this.emitEvent('FRAME_TRANSMITTED', {
          seqNum: frame.seqNum,
          isRetransmission: true,
          description: `Frame ${frame.seqNum} transmitted over channel (retransmission)`,
        });
      }
    }

    if (tickResult.failed || this.adapter.isSenderFailed()) {
      this.status = 'FAILED';
      this.emitEvent('SIMULATION_FAILED', {
        description: 'Simulation failed: sender retry attempts exhausted',
        reason: 'RETRY_EXHAUSTION',
      });
      return { status: this.status, virtualTimeMs: this.virtualTimeMs, eventsGenerated: this.events.length - startEventCount };
    }

    // 2. Deliver packets from virtual channel scheduled for arrival <= virtualTimeMs
    const deliverable = this.channel.getDeliverablePackets(this.virtualTimeMs);

    for (const packet of deliverable) {
      if (packet.isDropped) {
        if (packet.type === 'DATA') {
          this.framesDropped += 1;
          this.emitEvent('FRAME_DROPPED', {
            seqNum: packet.frame.seqNum,
            description: `DATA frame ${packet.frame.seqNum} dropped in virtual channel`,
          });
        } else {
          this.acksDropped += 1;
          this.emitEvent('ACK_DROPPED', {
            ackNum: packet.frame.ackNum,
            description: `ACK frame ${packet.frame.ackNum} dropped in virtual channel`,
          });
        }
      } else {
        // Delivered!
        if (packet.isCorrupted) {
          this.framesCorrupted += 1;
          this.emitEvent('FRAME_CORRUPTED', {
            seqNum: packet.frame.seqNum,
            ackNum: packet.frame.ackNum,
            description: `${packet.type} frame corrupted in transit`,
          });
        }

        if (packet.type === 'DATA') {
          this.emitEvent('FRAME_DELIVERED', {
            seqNum: packet.frame.seqNum,
            description: `DATA frame ${packet.frame.seqNum} delivered to receiver`,
          });

          const rxResult = this.adapter.onFrameReceived(packet.frame);

          if (rxResult.isBuffered) {
            this.emitEvent('FRAME_BUFFERED', {
              seqNum: packet.frame.seqNum,
              description: `Frame ${packet.frame.seqNum} buffered out-of-order by receiver`,
            });
          }

          for (const payload of rxResult.deliveredPayloads) {
            this.emitEvent('PAYLOAD_DELIVERED', {
              payload,
              description: `Payload delivered to application: "${payload}"`,
              totalDelivered: this.adapter.getDeliveredPayloads().length,
            });
          }

          if (rxResult.ackFrame) {
            this.acksSent += 1;
            this.emitEvent('ACK_TRANSMITTED', {
              ackNum: rxResult.ackFrame.ackNum,
              description: `Receiver transmitted ACK ${rxResult.ackFrame.ackNum}`,
            });

            this.channel.transmitAck(rxResult.ackFrame, this.virtualTimeMs);
          }
        } else {
          // ACK packet arriving at sender
          this.emitEvent('ACK_DELIVERED', {
            ackNum: packet.frame.ackNum,
            description: `ACK ${packet.frame.ackNum} delivered to sender`,
          });

          const ackResult = this.adapter.onAckReceived(packet.frame);
          if (ackResult.advanced) {
            this.emitEvent('SENDER_WINDOW_SLID', {
              description: `Sender window advanced after ACK ${packet.frame.ackNum}`,
            });
          }
        }
      }
    }

    // 3. Send pending payloads if window capacity is available
    this.sendPendingPayloads();

    // 4. Check completion condition
    const allDelivered =
      this.adapter.getDeliveredPayloads().length === this.config.payloads.length;
    const noInFlight = this.channel.getInFlightCount() === 0;
    const senderCompleted = this.adapter.isSenderCompleted();

    if (allDelivered && noInFlight && senderCompleted) {
      this.status = 'COMPLETED';
      this.emitEvent('SIMULATION_COMPLETED', {
        description: `Simulation completed successfully! All ${this.config.payloads.length} payloads delivered.`,
        durationMs: this.virtualTimeMs,
        stepsExecuted: this.stepsExecuted,
      });
    }

    return {
      status: this.status,
      virtualTimeMs: this.virtualTimeMs,
      eventsGenerated: this.events.length - startEventCount,
    };
  }

  /**
   * Advances the simulation continuously until it reaches COMPLETED, FAILED, or STOPPED.
   */
  public runToCompletion(maxStepsLimit?: number): SimulationStatistics {
    const limit = maxStepsLimit ?? this.config.maxSteps;
    let iterations = 0;

    if (this.status === 'READY') {
      this.start();
    }

    while (
      (this.status === 'RUNNING' || this.status === 'READY') &&
      iterations < limit
    ) {
      this.step();
      iterations += 1;
    }

    return this.getStatistics();
  }

  private sendPendingPayloads(): void {
    while (this.payloadQueue.length > 0 && this.adapter.canSend() && this.status === 'RUNNING') {
      const payload = this.payloadQueue.shift()!;
      const result = this.adapter.send(payload);

      if (result.success && result.frame) {
        this.originalFramesSent += 1;
        this.emitEvent('FRAME_TRANSMITTED', {
          seqNum: result.frame.seqNum,
          payload,
          isRetransmission: false,
          remainingPayloads: this.payloadQueue.length,
          description: `Transmitted frame ${result.frame.seqNum} (payload: "${payload}")`,
        });

        this.channel.transmitData(result.frame, this.virtualTimeMs);
      } else {
        // Could not send; restore to payload queue
        this.payloadQueue.unshift(payload);
        break;
      }
    }
  }
}

