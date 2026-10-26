import {
  Frame,
  ProtocolStatistics,
  ProtocolType,
  WindowState,
} from '../types/protocol.js';
import {
  StopAndWaitSender,
  StopAndWaitReceiver,
} from '../protocols/stop-and-wait.js';
import {
  GoBackNSender,
  GoBackNReceiver,
} from '../protocols/go-back-n.js';
import {
  SelectiveRepeatSender,
  SelectiveRepeatReceiver,
} from '../protocols/selective-repeat.js';
import {
  DataUdpPacket,
  AckUdpPacket,
  UdpPacket,
  LiveTelemetryEvent,
} from './live-types.js';
import { computeFrameChecksum } from '../utils/frame-codec.js';

export const MAX_OUTBOUND_QUEUE_SIZE = 500;

export interface LiveSessionConfig {
  sessionId: string;
  protocol: ProtocolType;
  windowSize: number;
  seqNumberSpace: number;
  timeoutMs: number;
  maxRetries: number;
  onPacketToSend: (packet: UdpPacket) => void;
  onTelemetry: (event: LiveTelemetryEvent) => void;
  onPayloadDelivered: (
    payload: string,
    payloadType: 'TEXT' | 'FILE_CHUNK',
    transferId?: string
  ) => void;
  onMessageStatusUpdate?: (
    clientMessageId: string,
    status: 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED',
    seqNum?: number
  ) => void;
  onError: (error: string) => void;
  onStatsUpdate?: (stats: ProtocolStatistics) => void;
}

interface QueuedPayload {
  payload: string;
  payloadType: 'TEXT' | 'FILE_CHUNK';
  transferId?: string;
  clientMessageId?: string;
}

interface FrameMeta {
  payloadType: 'TEXT' | 'FILE_CHUNK';
  transferId?: string;
  clientMessageId?: string;
}

export class LiveSession {
  public readonly config: LiveSessionConfig;

  // Protocol state machines
  private sawSender?: StopAndWaitSender;
  private sawReceiver?: StopAndWaitReceiver;

  private gbnSender?: GoBackNSender;
  private gbnReceiver?: GoBackNReceiver;

  private srSender?: SelectiveRepeatSender;
  private srReceiver?: SelectiveRepeatReceiver;

  // Real-time timer
  private timer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private readonly tickIntervalMs = 20;

  // Outbound queue for handling bursts / streaming data
  private outboundQueue: QueuedPayload[] = [];

  // Frame metadata tracking for retransmissions
  private frameMetadata = new Map<number, FrameMeta>();

  // Controlled test fault injection
  private dropNextData: boolean = false;
  private dropNextAck: boolean = false;

  private telemetryCounter: number = 0;

  constructor(config: LiveSessionConfig) {
    this.config = config;
    this.initializeProtocolEngines();
  }

  private initializeProtocolEngines(): void {
    const { protocol, windowSize, seqNumberSpace, timeoutMs, maxRetries, sessionId } = this.config;

    switch (protocol) {
      case 'stop-and-wait':
        this.sawSender = new StopAndWaitSender({ timeoutMs, maxRetries, sessionId });
        this.sawReceiver = new StopAndWaitReceiver({ sessionId });
        break;

      case 'go-back-n':
        this.gbnSender = new GoBackNSender({
          windowSize,
          seqNumberSpace,
          timeoutMs,
          maxRetries,
          sessionId,
        });
        this.gbnReceiver = new GoBackNReceiver({ seqNumberSpace, sessionId });
        break;

      case 'selective-repeat':
        this.srSender = new SelectiveRepeatSender({
          windowSize,
          seqNumberSpace,
          timeoutMs,
          maxRetries,
          sessionId,
        });
        this.srReceiver = new SelectiveRepeatReceiver({
          windowSize,
          seqNumberSpace,
          sessionId,
        });
        break;

      default:
        throw new Error(`Unsupported protocol for LiveSession: ${protocol}`);
    }
  }

  /**
   * Starts the wall-clock timer that steps the sender ARQ state machine.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      this.tick(this.tickIntervalMs);
    }, this.tickIntervalMs);
  }

  /**
   * Stops the live session and cancels active timers.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    for (const [seq, meta] of this.frameMetadata.entries()) {
      if (meta.clientMessageId) {
        this.config.onMessageStatusUpdate?.(meta.clientMessageId, 'FAILED', seq);
      }
    }
    this.outboundQueue = [];
    this.frameMetadata.clear();
  }

  /**
   * Queues a payload to be transmitted under the active flow control protocol.
   */
  public queuePayload(
    payload: string,
    payloadType: 'TEXT' | 'FILE_CHUNK' = 'TEXT',
    transferId?: string,
    clientMessageId?: string
  ): void {
    if (this.outboundQueue.length >= MAX_OUTBOUND_QUEUE_SIZE) {
      if (clientMessageId) {
        this.config.onMessageStatusUpdate?.(clientMessageId, 'FAILED');
      }
      this.config.onError(`Outbound payload queue full (${MAX_OUTBOUND_QUEUE_SIZE}). Throttling sender.`);
      return;
    }

    if (clientMessageId) {
      this.config.onMessageStatusUpdate?.(clientMessageId, 'SENDING');
    }

    this.outboundQueue.push({ payload, payloadType, transferId, clientMessageId });
    this.drainQueue();
  }

  /**
   * Configures fault injection for live educational demonstrations.
   */
  public setFault(fault: { dropNextData?: boolean; dropNextAck?: boolean }): void {
    if (fault.dropNextData !== undefined) {
      this.dropNextData = fault.dropNextData;
    }
    if (fault.dropNextAck !== undefined) {
      this.dropNextAck = fault.dropNextAck;
    }
  }

  /**
   * Checks if the sender window has available capacity.
   */
  public canSend(): boolean {
    if (this.sawSender) {
      return this.sawSender.getStatus() === 'IDLE';
    }
    if (this.gbnSender) {
      return (
        this.gbnSender.getOutstandingCount() < this.gbnSender.getWindowCapacity() &&
        this.gbnSender.getStatus() !== 'FAILED'
      );
    }
    if (this.srSender) {
      return this.srSender.canSend();
    }
    return false;
  }

  /**
   * Drains the queue as long as the protocol window permits.
   */
  private drainQueue(): void {
    while (this.outboundQueue.length > 0 && this.canSend()) {
      const item = this.outboundQueue.shift();
      if (!item) break;
      this.sendItem(item);
    }
  }

  private sendItem(item: QueuedPayload): void {
    let sendResult: { success: boolean; frame?: Frame; error?: string };

    if (this.sawSender) {
      sendResult = this.sawSender.send(item.payload);
    } else if (this.gbnSender) {
      sendResult = this.gbnSender.send(item.payload);
    } else if (this.srSender) {
      sendResult = this.srSender.send(item.payload);
    } else {
      sendResult = { success: false, error: 'No active sender engine' };
    }

    if (!sendResult.success || !sendResult.frame) {
      if (item.clientMessageId) {
        this.config.onMessageStatusUpdate?.(item.clientMessageId, 'FAILED');
      }
      this.config.onError(`Failed to send frame: ${sendResult.error}`);
      return;
    }

    const frame = sendResult.frame;

    // Track metadata for retransmissions
    this.frameMetadata.set(frame.seqNum, {
      payloadType: item.payloadType,
      transferId: item.transferId,
      clientMessageId: item.clientMessageId,
    });

    if (item.clientMessageId) {
      this.config.onMessageStatusUpdate?.(item.clientMessageId, 'SENT', frame.seqNum);
    }

    // Check fault injection
    if (this.dropNextData) {
      this.dropNextData = false;
      this.emitTelemetry({
        type: 'FAULT_DATA_DROPPED',
        direction: 'LOCAL',
        seqNum: frame.seqNum,
        description: `Simulated loss: Dropped outgoing DATA frame seq ${frame.seqNum} (fault injection)`,
      });
      return; // Do not send over UDP
    }

    const udpPacket: DataUdpPacket = {
      type: 'DATA',
      sessionId: this.config.sessionId,
      version: '1.0',
      timestamp: Date.now(),
      frame,
      payloadType: item.payloadType,
      transferId: item.transferId,
    };

    this.config.onPacketToSend(udpPacket);

    this.emitTelemetry({
      type: 'DATA_SENT',
      direction: 'OUTBOUND',
      seqNum: frame.seqNum,
      description: `Transmitted DATA frame [seq ${frame.seqNum}] via UDP (${item.payload.length} bytes)`,
    });
  }

  /**
   * Processes incoming UDP packets directed to this session.
   */
  public handleIncomingUdpPacket(packet: UdpPacket): void {
    if (packet.sessionId !== this.config.sessionId) {
      return;
    }

    switch (packet.type) {
      case 'DATA':
        this.handleIncomingData(packet as DataUdpPacket);
        break;

      case 'ACK':
        this.handleIncomingAck(packet as AckUdpPacket);
        break;

      default:
        break;
    }
  }

  private handleIncomingData(packet: DataUdpPacket): void {
    // 1. Verify CRC-32 integrity
    const computedChecksum = computeFrameChecksum(packet.frame);
    if (computedChecksum !== packet.frame.checksum) {
      this.emitTelemetry({
        type: 'FRAME_CORRUPTED',
        direction: 'LOCAL',
        seqNum: packet.frame.seqNum,
        description: `Checksum mismatch on DATA frame [seq ${packet.frame.seqNum}]: 0x${computedChecksum.toString(16)} != 0x${packet.frame.checksum.toString(16)}. Discarding corrupted packet.`,
      });
      return;
    }

    this.emitTelemetry({
      type: 'DATA_RECEIVED',
      direction: 'INBOUND',
      seqNum: packet.frame.seqNum,
      description: `Received DATA frame [seq ${packet.frame.seqNum}] over UDP`,
    });

    let ackToSend: Frame | undefined;
    const deliveredPayloads: string[] = [];

    if (this.sawReceiver) {
      const res = this.sawReceiver.onFrameReceived(packet.frame);
      ackToSend = res.ackFrame;
      if (res.deliveredPayload !== undefined) {
        deliveredPayloads.push(res.deliveredPayload);
      }
    } else if (this.gbnReceiver) {
      const res = this.gbnReceiver.onFrameReceived(packet.frame);
      ackToSend = res.ackFrame;
      if (res.deliveredPayload !== undefined) {
        deliveredPayloads.push(res.deliveredPayload);
      }
    } else if (this.srReceiver) {
      const res = this.srReceiver.onFrameReceived(packet.frame);
      ackToSend = res.ackFrame;
      if (res.deliveredPayloads && res.deliveredPayloads.length > 0) {
        deliveredPayloads.push(...res.deliveredPayloads);
      }
    }

    // Deliver accepted application payloads
    for (const payload of deliveredPayloads) {
      this.config.onPayloadDelivered(payload, packet.payloadType, packet.transferId);
      this.emitTelemetry({
        type: 'PAYLOAD_DELIVERED',
        direction: 'LOCAL',
        seqNum: packet.frame.seqNum,
        description: `Delivered payload to application (${payload.length} chars)`,
      });
    }

    // Transmit ACK back to peer if required
    if (ackToSend) {
      if (this.dropNextAck) {
        this.dropNextAck = false;
        this.emitTelemetry({
          type: 'FAULT_ACK_DROPPED',
          direction: 'LOCAL',
          ackNum: ackToSend.ackNum,
          description: `Simulated loss: Dropped outgoing ACK ${ackToSend.ackNum} (fault injection)`,
        });
        return;
      }

      const ackPacket: AckUdpPacket = {
        type: 'ACK',
        sessionId: this.config.sessionId,
        version: '1.0',
        timestamp: Date.now(),
        frame: ackToSend,
      };

      this.config.onPacketToSend(ackPacket);

      this.emitTelemetry({
        type: 'ACK_SENT',
        direction: 'OUTBOUND',
        ackNum: ackToSend.ackNum,
        description: `Dispatched ACK frame [ackNum ${ackToSend.ackNum}] over UDP`,
      });
    }
  }

  private handleIncomingAck(packet: AckUdpPacket): void {
    // Verify CRC-32 integrity of incoming ACK
    const computedChecksum = computeFrameChecksum(packet.frame);
    if (computedChecksum !== packet.frame.checksum) {
      this.emitTelemetry({
        type: 'ACK_CORRUPTED',
        direction: 'LOCAL',
        ackNum: packet.frame.ackNum,
        description: `Corrupted ACK frame [ackNum ${packet.frame.ackNum}] received: checksum mismatch. Discarding.`,
      });
      return;
    }

    this.emitTelemetry({
      type: 'ACK_RECEIVED',
      direction: 'INBOUND',
      ackNum: packet.frame.ackNum,
      description: `Received ACK frame [ackNum ${packet.frame.ackNum}] over UDP`,
    });

    if (this.sawSender) {
      this.sawSender.onAckReceived(packet.frame);
      if (this.sawSender.getStatus() === 'IDLE') {
        for (const [seq, meta] of this.frameMetadata.entries()) {
          if (meta.clientMessageId) {
            this.config.onMessageStatusUpdate?.(meta.clientMessageId, 'DELIVERED', seq);
          }
        }
        this.frameMetadata.clear();
      }
    } else if (this.gbnSender) {
      this.gbnSender.onAckReceived(packet.frame);
      this.pruneFrameMetadata();
    } else if (this.srSender) {
      this.srSender.onAckReceived(packet.frame);
      this.pruneFrameMetadata();
    }

    // If window advanced, continue sending queued payloads
    this.drainQueue();
  }

  private pruneFrameMetadata(): void {
    const win = this.getSenderWindowState();
    // Prune sequence numbers that are no longer unacknowledged
    for (const seq of Array.from(this.frameMetadata.keys())) {
      const meta = this.frameMetadata.get(seq);
      let isAcked = false;

      if (this.gbnSender) {
        const base = this.gbnSender.getBase();
        const next = this.gbnSender.getNextSeqNum();
        // In GBN, anything before base is acknowledged
        if (seq !== base && (next >= base ? seq < base : seq < base && seq >= next)) {
          isAcked = true;
        }
      } else if (this.srSender) {
        const slots = this.srSender.getSlots();
        const stillOutstanding = slots.some((s) => s.seqNum === seq && !s.acknowledged);
        if (!stillOutstanding) {
          isAcked = true;
        }
      }

      if (isAcked) {
        if (meta?.clientMessageId) {
          this.config.onMessageStatusUpdate?.(meta.clientMessageId, 'DELIVERED', seq);
        }
        this.frameMetadata.delete(seq);
      }
    }
  }

  /**
   * Deterministic time step called by wall-clock interval.
   */
  public tick(deltaMs: number): void {
    let timedOut = false;
    let failed = false;
    const retransmissions: Frame[] = [];

    if (this.sawSender) {
      const res = this.sawSender.tick(deltaMs);
      timedOut = res.timedOut;
      failed = Boolean(res.failed);
      if (res.retransmittedFrame) {
        retransmissions.push(res.retransmittedFrame);
      }
    } else if (this.gbnSender) {
      const res = this.gbnSender.tick(deltaMs);
      timedOut = res.timedOut;
      failed = Boolean(res.failed);
      if (res.retransmittedFrames) {
        retransmissions.push(...res.retransmittedFrames);
      }
    } else if (this.srSender) {
      const res = this.srSender.tick(deltaMs);
      timedOut = res.timedOut;
      failed = Boolean(res.failed);
      if (res.retransmittedFrames) {
        retransmissions.push(...res.retransmittedFrames);
      }
    }

    if (timedOut) {
      this.emitTelemetry({
        type: 'TIMEOUT',
        direction: 'LOCAL',
        description: `Timer expired. Initiating ARQ retransmission of ${retransmissions.length} frame(s)`,
      });

      for (const frame of retransmissions) {
        if (this.dropNextData) {
          this.dropNextData = false;
          this.emitTelemetry({
            type: 'FAULT_DATA_DROPPED',
            direction: 'LOCAL',
            seqNum: frame.seqNum,
            isRetransmission: true,
            description: `Simulated loss: Dropped retransmitted frame seq ${frame.seqNum} (fault injection)`,
          });
          continue;
        }

        const meta = this.frameMetadata.get(frame.seqNum);

        const dataPkt: DataUdpPacket = {
          type: 'DATA',
          sessionId: this.config.sessionId,
          version: '1.0',
          timestamp: Date.now(),
          frame,
          payloadType: meta?.payloadType ?? 'TEXT',
          transferId: meta?.transferId,
        };

        this.config.onPacketToSend(dataPkt);

        this.emitTelemetry({
          type: 'RETRANSMISSION',
          direction: 'OUTBOUND',
          seqNum: frame.seqNum,
          isRetransmission: true,
          description: `Retransmitted frame [seq ${frame.seqNum}] via UDP (${dataPkt.payloadType})`,
        });
      }
    }

    if (failed) {
      for (const [seq, meta] of this.frameMetadata.entries()) {
        if (meta.clientMessageId) {
          this.config.onMessageStatusUpdate?.(meta.clientMessageId, 'FAILED', seq);
        }
      }
      this.stop(); // Cease timer on retry exhaustion
      this.config.onError(
        `Session transmission failed: Maximum retransmission limit (${this.config.maxRetries}) reached.`
      );
    }

    if (this.config.onStatsUpdate) {
      this.config.onStatsUpdate(this.getStats());
    }
  }

  public getSenderWindowState(): WindowState {
    if (this.gbnSender) {
      return this.gbnSender.getWindowState();
    }
    if (this.srSender) {
      return this.srSender.getWindowState();
    }
    if (this.sawSender) {
      const seq = this.sawSender.getCurrentSeqNum();
      return {
        base: seq,
        nextSeqNum: seq,
        windowSize: 1,
        bufferSize: this.sawSender.getStatus() === 'AWAITING_ACK' ? 1 : 0,
      };
    }

    return {
      base: 0,
      nextSeqNum: 0,
      windowSize: 1,
      bufferSize: 0,
    };
  }

  public getReceiverBase(): number {
    if (this.gbnReceiver) {
      return this.gbnReceiver.getExpectedSeqNum();
    }
    if (this.srReceiver) {
      return this.srReceiver.getRcvBase();
    }
    if (this.sawReceiver) {
      return this.sawReceiver.getExpectedSeqNum();
    }
    return 0;
  }

  public getStats(): ProtocolStatistics {
    let sStats: ProtocolStatistics = {
      framesSent: 0,
      framesAcknowledged: 0,
      retransmissions: 0,
      timeouts: 0,
      lostFramesSimulated: 0,
      lostAcksSimulated: 0,
      bytesTransferred: 0,
    };

    if (this.sawSender) sStats = this.sawSender.getStatistics();
    else if (this.gbnSender) sStats = this.gbnSender.getStatistics();
    else if (this.srSender) sStats = this.srSender.getStatistics();

    return sStats;
  }

  private emitTelemetry(options: {
    type: string;
    direction: 'OUTBOUND' | 'INBOUND' | 'LOCAL';
    description: string;
    seqNum?: number;
    ackNum?: number;
    isRetransmission?: boolean;
  }): void {
    this.telemetryCounter += 1;
    const event: LiveTelemetryEvent = {
      id: `live-telemetry-${Date.now()}-${this.telemetryCounter}`,
      timestamp: Date.now(),
      type: options.type,
      direction: options.direction,
      protocol: this.config.protocol,
      seqNum: options.seqNum,
      ackNum: options.ackNum,
      isRetransmission: options.isRetransmission,
      senderWindow: this.getSenderWindowState(),
      receiverBase: this.getReceiverBase(),
      description: options.description,
    };

    this.config.onTelemetry(event);
  }
}
