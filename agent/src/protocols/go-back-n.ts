import {
  Frame,
  GoBackNReceiverConfig,
  GoBackNSenderConfig,
  ProtocolEvent,
  ProtocolEventType,
  ProtocolStatistics,
  SenderStatus,
  WindowState,
} from '../types/protocol.js';
import {
  createAckFrame,
  createDataFrame,
  deserializeFrame,
} from '../utils/frame-codec.js';
import { SlidingWindow } from './sliding-window.js';

/**
 * Go-Back-N ARQ Sender State Machine.
 *
 * Implements cumulative acknowledgements, sliding-window transmission boundaries,
 * and bulk retransmission of all outstanding frames from the window base upon timeout.
 *
 * ACK CONVENTION:
 * Uses the Inclusive Highest-Received Cumulative ACK Convention:
 * An ACK carrying `ackNum = k` confirms that frame k and all preceding frames
 * outstanding in the window have been successfully received and delivered.
 */
export class GoBackNSender {
  private readonly window: SlidingWindow<Frame>;
  private status: SenderStatus = 'IDLE';
  private currentRetries: number = 0;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sessionId?: string;
  private timerElapsedMs: number = 0;
  private isTimerRunning: boolean = false;
  private eventCounter: number = 0;
  private events: ProtocolEvent[] = [];
  private stats: ProtocolStatistics = {
    framesSent: 0,
    framesAcknowledged: 0,
    retransmissions: 0,
    timeouts: 0,
    lostFramesSimulated: 0,
    lostAcksSimulated: 0,
    bytesTransferred: 0,
  };
  private onEventListener?: (event: ProtocolEvent) => void;

  constructor(config?: GoBackNSenderConfig, onEvent?: (event: ProtocolEvent) => void) {
    const windowSize = config?.windowSize ?? 4;
    const seqNumberSpace = config?.seqNumberSpace ?? Math.max(8, windowSize * 2);

    this.window = new SlidingWindow<Frame>({ windowSize, seqNumberSpace });
    this.timeoutMs = config?.timeoutMs ?? 1000;
    this.maxRetries = config?.maxRetries ?? 3;
    this.sessionId = config?.sessionId;
    this.onEventListener = onEvent;
  }

  public getStatus(): SenderStatus {
    return this.status;
  }

  public getBase(): number {
    return this.window.getBase();
  }

  public getNextSeqNum(): number {
    return this.window.getNextSeqNum();
  }

  public getWindowCapacity(): number {
    return this.window.getCapacity();
  }

  public getOutstandingCount(): number {
    return this.window.getOutstandingCount();
  }

  public getOutstandingFrames(): ReadonlyArray<Frame> {
    return this.window.getOutstanding().map((entry) => entry.data);
  }

  public getWindowState(): WindowState {
    return this.window.getWindowState();
  }

  public getCurrentRetries(): number {
    return this.currentRetries;
  }

  public getStatistics(): Readonly<ProtocolStatistics> {
    return { ...this.stats };
  }

  public getEvents(): ReadonlyArray<ProtocolEvent> {
    return [...this.events];
  }

  private emitEvent(type: ProtocolEventType, details: Record<string, unknown>): ProtocolEvent {
    this.eventCounter += 1;
    const event: ProtocolEvent = {
      id: `gbn-sender-evt-${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      protocol: 'go-back-n',
      details,
    };
    this.events.push(event);
    if (this.onEventListener) {
      this.onEventListener(event);
    }
    return event;
  }

  /**
   * Transmits a new payload if the sliding window has available capacity.
   */
  public send(payload: string): { success: boolean; frame?: Frame; error?: string } {
    if (this.status === 'FAILED') {
      return {
        success: false,
        error: 'Cannot send: Sender is in FAILED state due to retry exhaustion. Call reset() to recover.',
      };
    }

    if (typeof payload !== 'string') {
      return {
        success: false,
        error: 'Payload must be a string',
      };
    }

    if (!this.window.canSend()) {
      return {
        success: false,
        error: `Cannot send: Window is full (${this.window.getOutstandingCount()}/${this.window.getCapacity()})`,
      };
    }

    const seqNum = this.window.getNextSeqNum();
    const frame = createDataFrame({
      seqNum,
      payload,
      sessionId: this.sessionId,
    });

    this.window.push(frame);

    // If timer is not currently running, start it for the oldest unacknowledged frame
    if (!this.isTimerRunning) {
      this.isTimerRunning = true;
      this.timerElapsedMs = 0;
      this.currentRetries = 0;
    }

    this.status = 'AWAITING_ACK';
    this.stats.framesSent += 1;
    this.stats.bytesTransferred += payload.length;
    if (!this.stats.startTime) {
      this.stats.startTime = Date.now();
    }

    this.emitEvent('FRAME_SENT', {
      seqNum: frame.seqNum,
      payloadLength: payload.length,
      isRetransmission: false,
      windowBase: this.window.getBase(),
      outstandingCount: this.window.getOutstandingCount(),
      capacity: this.window.getCapacity(),
    });

    return {
      success: true,
      frame,
    };
  }

  /**
   * Processes an incoming cumulative ACK.
   */
  public onAckReceived(rawOrFrame: unknown): {
    accepted: boolean;
    advanced: boolean;
    acknowledgedCount: number;
    newBase?: number;
    reason?: string;
  } {
    let ackFrame: Frame;

    if (typeof rawOrFrame === 'string') {
      const decoded = deserializeFrame(rawOrFrame);
      if (!decoded.success) {
        this.emitEvent('FRAME_REJECTED', {
          reason: decoded.error,
          code: decoded.code,
        });
        return {
          accepted: false,
          advanced: false,
          acknowledgedCount: 0,
          reason: `ACK decode failed: ${decoded.error}`,
        };
      }
      ackFrame = decoded.frame;
    } else if (typeof rawOrFrame === 'object' && rawOrFrame !== null) {
      ackFrame = rawOrFrame as Frame;
    } else {
      this.emitEvent('FRAME_REJECTED', {
        reason: 'Invalid ACK format: must be string or Frame object',
      });
      return {
        accepted: false,
        advanced: false,
        acknowledgedCount: 0,
        reason: 'Invalid ACK format',
      };
    }

    if (ackFrame.frameType !== 'ACK' || ackFrame.ackNum === undefined) {
      this.emitEvent('FRAME_REJECTED', {
        reason: `Expected ACK frame with valid ackNum, received ${ackFrame.frameType}`,
      });
      return {
        accepted: false,
        advanced: false,
        acknowledgedCount: 0,
        reason: `Invalid ACK frame type: ${ackFrame.frameType}`,
      };
    }

    if (this.window.getOutstandingCount() === 0) {
      this.emitEvent('FRAME_REJECTED', {
        reason: 'Sender has no outstanding frames awaiting acknowledgement',
        ackNum: ackFrame.ackNum,
      });
      return {
        accepted: false,
        advanced: false,
        acknowledgedCount: 0,
        reason: 'No outstanding frames awaiting ACK',
      };
    }

    const oldBase = this.window.getBase();
    const ackResult = this.window.acknowledgeCumulative(ackFrame.ackNum);

    if (ackResult.valid) {
      this.stats.framesAcknowledged += ackResult.acknowledgedCount;
      this.currentRetries = 0; // Reset retries since progress was made

      this.emitEvent('ACK_RECEIVED', {
        ackNum: ackFrame.ackNum,
        acknowledgedCount: ackResult.acknowledgedCount,
        oldBase,
        newBase: ackResult.newBase,
        remainingOutstanding: this.window.getOutstandingCount(),
      });

      this.emitEvent('WINDOW_SLID', {
        oldBase,
        newBase: ackResult.newBase,
        advancedBy: ackResult.acknowledgedCount,
      });

      if (this.window.getOutstandingCount() === 0) {
        // All outstanding frames acknowledged: stop timer
        this.isTimerRunning = false;
        this.timerElapsedMs = 0;
        this.status = 'COMPLETED';

        this.emitEvent('TRANSMISSION_COMPLETED', {
          finalBase: ackResult.newBase,
          totalAcknowledged: this.stats.framesAcknowledged,
        });
      } else {
        // Frames still outstanding: restart timer for the new base
        this.timerElapsedMs = 0;
        this.status = 'AWAITING_ACK';
      }

      return {
        accepted: true,
        advanced: true,
        acknowledgedCount: ackResult.acknowledgedCount,
        newBase: ackResult.newBase,
      };
    } else {
      // Stale, duplicate, or out-of-window ACK
      this.emitEvent('FRAME_REJECTED', {
        reason: ackResult.reason,
        ackNum: ackFrame.ackNum,
        currentBase: this.window.getBase(),
      });

      return {
        accepted: false,
        advanced: false,
        acknowledgedCount: 0,
        reason: ackResult.reason,
      };
    }
  }

  /**
   * Steps time deterministically. If elapsed time reaches timeoutMs, triggers Go-Back-N retransmission.
   */
  public tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrames?: Frame[];
    failed?: boolean;
    attempt?: number;
  } {
    if (!this.isTimerRunning || this.window.getOutstandingCount() === 0) {
      return { timedOut: false };
    }

    this.timerElapsedMs += deltaMs;
    if (this.timerElapsedMs >= this.timeoutMs) {
      return this.handleTimeout();
    }

    return { timedOut: false };
  }

  /**
   * Explicitly triggers Go-Back-N timeout recovery.
   * Retransmits ALL outstanding frames starting from window base.
   */
  public handleTimeout(): {
    timedOut: boolean;
    retransmittedFrames?: Frame[];
    failed?: boolean;
    attempt?: number;
  } {
    if (!this.isTimerRunning || this.window.getOutstandingCount() === 0) {
      return { timedOut: false };
    }

    this.stats.timeouts += 1;
    this.emitEvent('TIMEOUT', {
      base: this.window.getBase(),
      timeoutMs: this.timeoutMs,
      attempt: this.currentRetries + 1,
    });

    if (this.currentRetries < this.maxRetries) {
      this.currentRetries += 1;
      this.timerElapsedMs = 0;

      const outstandingEntries = this.window.getOutstanding();
      const retransmittedFrames = outstandingEntries.map((e) => e.data);

      this.stats.retransmissions += retransmittedFrames.length;
      this.stats.framesSent += retransmittedFrames.length;

      this.emitEvent('RETRANSMISSION', {
        base: this.window.getBase(),
        count: retransmittedFrames.length,
        attempt: this.currentRetries,
        maxRetries: this.maxRetries,
      });

      for (const frame of retransmittedFrames) {
        this.emitEvent('FRAME_SENT', {
          seqNum: frame.seqNum,
          isRetransmission: true,
          attempt: this.currentRetries,
          windowBase: this.window.getBase(),
        });
      }

      return {
        timedOut: true,
        retransmittedFrames,
        failed: false,
        attempt: this.currentRetries,
      };
    } else {
      // Retransmissions exhausted
      this.isTimerRunning = false;
      this.status = 'FAILED';

      this.emitEvent('TRANSMISSION_FAILED', {
        base: this.window.getBase(),
        attemptsExhausted: this.currentRetries,
        maxRetries: this.maxRetries,
      });

      return {
        timedOut: true,
        failed: true,
        attempt: this.currentRetries,
      };
    }
  }

  public reset(): void {
    this.window.reset();
    this.status = 'IDLE';
    this.currentRetries = 0;
    this.timerElapsedMs = 0;
    this.isTimerRunning = false;
    this.events = [];
    this.eventCounter = 0;
    this.stats = {
      framesSent: 0,
      framesAcknowledged: 0,
      retransmissions: 0,
      timeouts: 0,
      lostFramesSimulated: 0,
      lostAcksSimulated: 0,
      bytesTransferred: 0,
    };
  }
}

/**
 * Go-Back-N ARQ Receiver State Machine.
 *
 * Implements strict in-order acceptance and cumulative acknowledgements.
 * Discards any out-of-order frame without buffering (strict Go-Back-N rule).
 */
export class GoBackNReceiver {
  private readonly seqNumberSpace: number;
  private readonly sessionId?: string;
  private expectedSeqNum: number = 0;
  private lastAcknowledgedSeqNum: number | null = null;
  private deliveredPayloads: string[] = [];
  private eventCounter: number = 0;
  private events: ProtocolEvent[] = [];
  private stats: ProtocolStatistics = {
    framesSent: 0,
    framesAcknowledged: 0,
    retransmissions: 0,
    timeouts: 0,
    lostFramesSimulated: 0,
    lostAcksSimulated: 0,
    bytesTransferred: 0,
  };
  private onEventListener?: (event: ProtocolEvent) => void;

  constructor(config?: GoBackNReceiverConfig, onEvent?: (event: ProtocolEvent) => void) {
    this.seqNumberSpace = config?.seqNumberSpace ?? 8;
    this.sessionId = config?.sessionId;
    this.onEventListener = onEvent;
  }

  public getExpectedSeqNum(): number {
    return this.expectedSeqNum;
  }

  public getLastAcknowledgedSeqNum(): number | null {
    return this.lastAcknowledgedSeqNum;
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return [...this.deliveredPayloads];
  }

  public getDeliveredCount(): number {
    return this.deliveredPayloads.length;
  }

  public getStatistics(): Readonly<ProtocolStatistics> {
    return { ...this.stats };
  }

  public getEvents(): ReadonlyArray<ProtocolEvent> {
    return [...this.events];
  }

  private emitEvent(type: ProtocolEventType, details: Record<string, unknown>): ProtocolEvent {
    this.eventCounter += 1;
    const event: ProtocolEvent = {
      id: `gbn-receiver-evt-${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      protocol: 'go-back-n',
      details,
    };
    this.events.push(event);
    if (this.onEventListener) {
      this.onEventListener(event);
    }
    return event;
  }

  /**
   * Processes an incoming frame.
   * If in-order: accepts, delivers, and generates cumulative ACK.
   * If out-of-order or duplicate: discards without buffering, re-sends cumulative ACK for last valid frame.
   */
  public onFrameReceived(rawOrFrame: unknown): {
    accepted: boolean;
    isOutOfOrder: boolean;
    ackFrame?: Frame;
    deliveredPayload?: string;
    error?: string;
  } {
    let frame: Frame;

    if (typeof rawOrFrame === 'string') {
      const decoded = deserializeFrame(rawOrFrame);
      if (!decoded.success) {
        this.emitEvent('FRAME_REJECTED', {
          reason: decoded.error,
          code: decoded.code,
        });
        return {
          accepted: false,
          isOutOfOrder: false,
          error: `Frame validation error: ${decoded.error}`,
        };
      }
      frame = decoded.frame;
    } else if (typeof rawOrFrame === 'object' && rawOrFrame !== null) {
      frame = rawOrFrame as Frame;
    } else {
      this.emitEvent('FRAME_REJECTED', {
        reason: 'Frame must be a string or Frame object',
      });
      return {
        accepted: false,
        isOutOfOrder: false,
        error: 'Invalid frame format',
      };
    }

    if (frame.frameType !== 'DATA') {
      this.emitEvent('FRAME_REJECTED', {
        reason: `Receiver expects DATA frames, received ${frame.frameType}`,
        frameType: frame.frameType,
      });
      return {
        accepted: false,
        isOutOfOrder: false,
        error: `Unexpected frame type: ${frame.frameType}`,
      };
    }

    this.emitEvent('FRAME_RECEIVED', {
      seqNum: frame.seqNum,
      expectedSeqNum: this.expectedSeqNum,
      payloadLength: frame.payload.length,
    });

    // Case 1: In-order expected frame
    if (frame.seqNum === this.expectedSeqNum) {
      this.deliveredPayloads.push(frame.payload);
      this.stats.bytesTransferred += frame.payload.length;
      this.stats.framesAcknowledged += 1;
      this.lastAcknowledgedSeqNum = frame.seqNum;

      this.emitEvent('PAYLOAD_DELIVERED', {
        seqNum: frame.seqNum,
        payload: frame.payload,
        totalDelivered: this.deliveredPayloads.length,
      });

      const ackFrame = createAckFrame({
        ackNum: frame.seqNum,
        sessionId: this.sessionId,
      });

      this.stats.framesSent += 1;
      this.emitEvent('ACK_SENT', {
        ackNum: ackFrame.ackNum,
        forSeqNum: frame.seqNum,
        isCumulative: true,
      });

      // Advance expected sequence number modulo M
      this.expectedSeqNum = (this.expectedSeqNum + 1) % this.seqNumberSpace;

      return {
        accepted: true,
        isOutOfOrder: false,
        ackFrame,
        deliveredPayload: frame.payload,
      };
    }

    // Case 2: Out-of-order or duplicate frame
    // Go-Back-N MUST discard out-of-order frames without buffering!
    this.emitEvent('FRAME_REJECTED', {
      reason: 'Out-of-order frame discarded (Go-Back-N does not buffer)',
      receivedSeqNum: frame.seqNum,
      expectedSeqNum: this.expectedSeqNum,
    });

    if (this.lastAcknowledgedSeqNum !== null) {
      // Re-send cumulative ACK for the highest in-order frame accepted
      const ackFrame = createAckFrame({
        ackNum: this.lastAcknowledgedSeqNum,
        sessionId: this.sessionId,
      });

      this.stats.framesSent += 1;
      this.emitEvent('ACK_SENT', {
        ackNum: ackFrame.ackNum,
        forSeqNum: this.lastAcknowledgedSeqNum,
        isDuplicateRecovery: true,
        reason: 'Re-acknowledging highest in-order frame',
      });

      return {
        accepted: false,
        isOutOfOrder: true,
        ackFrame,
        error: `Out-of-order frame ${frame.seqNum} discarded; re-sent cumulative ACK ${this.lastAcknowledgedSeqNum}`,
      };
    }

    return {
      accepted: false,
      isOutOfOrder: true,
      error: `Out-of-order frame ${frame.seqNum} discarded; no in-order frame has been accepted yet`,
    };
  }

  public reset(): void {
    this.expectedSeqNum = 0;
    this.lastAcknowledgedSeqNum = null;
    this.deliveredPayloads = [];
    this.events = [];
    this.eventCounter = 0;
    this.stats = {
      framesSent: 0,
      framesAcknowledged: 0,
      retransmissions: 0,
      timeouts: 0,
      lostFramesSimulated: 0,
      lostAcksSimulated: 0,
      bytesTransferred: 0,
    };
  }
}

