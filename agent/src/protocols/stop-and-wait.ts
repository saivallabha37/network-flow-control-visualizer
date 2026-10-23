import {
  Frame,
  ProtocolEvent,
  ProtocolEventType,
  ProtocolStatistics,
  SenderStatus,
  StopAndWaitReceiverConfig,
  StopAndWaitSenderConfig,
} from '../types/protocol.js';
import {
  createAckFrame,
  createDataFrame,
  deserializeFrame,
} from '../utils/frame-codec.js';

export class StopAndWaitSender {
  private currentSeqNum: 0 | 1 = 0;
  private status: SenderStatus = 'IDLE';
  private outstandingFrame: Frame | null = null;
  private currentAttempt: number = 0;
  private retransmissionsCount: number = 0;
  private timeoutMs: number;
  private maxRetries: number;
  private sessionId?: string;
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

  constructor(config?: StopAndWaitSenderConfig, onEvent?: (event: ProtocolEvent) => void) {
    this.timeoutMs = config?.timeoutMs ?? 1000;
    this.maxRetries = config?.maxRetries ?? 3;
    this.sessionId = config?.sessionId;
    this.onEventListener = onEvent;
  }

  public getCurrentSeqNum(): 0 | 1 {
    return this.currentSeqNum;
  }

  public getStatus(): SenderStatus {
    return this.status;
  }

  public getOutstandingFrame(): Frame | null {
    return this.outstandingFrame;
  }

  public getCurrentAttempt(): number {
    return this.currentAttempt;
  }

  public getRetransmissionCount(): number {
    return this.retransmissionsCount;
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
      id: `saw-sender-evt-${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      protocol: 'stop-and-wait',
      details,
    };
    this.events.push(event);
    if (this.onEventListener) {
      this.onEventListener(event);
    }
    return event;
  }

  /**
   * Transmits a new payload. Stop-and-Wait permits sending only when IDLE
   * (no frame is currently awaiting an ACK).
   */
  public send(payload: string): { success: boolean; frame?: Frame; error?: string } {
    if (this.status === 'AWAITING_ACK') {
      return {
        success: false,
        error: `Cannot send: Frame ${this.currentSeqNum} is currently awaiting acknowledgement`,
      };
    }

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

    const frame = createDataFrame({
      seqNum: this.currentSeqNum,
      payload,
      sessionId: this.sessionId,
    });

    this.outstandingFrame = frame;
    this.status = 'AWAITING_ACK';
    this.currentAttempt = 1;
    this.timerElapsedMs = 0;
    this.isTimerRunning = true;

    this.stats.framesSent += 1;
    this.stats.bytesTransferred += payload.length;
    if (!this.stats.startTime) {
      this.stats.startTime = Date.now();
    }

    this.emitEvent('FRAME_SENT', {
      seqNum: frame.seqNum,
      payloadLength: payload.length,
      attempt: this.currentAttempt,
      checksum: frame.checksum,
    });

    return {
      success: true,
      frame,
    };
  }

  /**
   * Processes an incoming ACK frame or raw ACK payload string.
   */
  public onAckReceived(rawOrFrame: unknown): {
    accepted: boolean;
    advanced: boolean;
    reason?: string;
    ackNum?: number;
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
        reason: 'Invalid ACK format',
      };
    }

    if (ackFrame.frameType !== 'ACK') {
      this.emitEvent('FRAME_REJECTED', {
        reason: `Expected ACK frame type, received ${ackFrame.frameType}`,
        seqNum: ackFrame.seqNum,
      });
      return {
        accepted: false,
        advanced: false,
        reason: `Received unexpected frame type: ${ackFrame.frameType}`,
      };
    }

    if (this.status !== 'AWAITING_ACK' || !this.outstandingFrame) {
      this.emitEvent('FRAME_REJECTED', {
        reason: 'Sender is not awaiting an acknowledgement',
        ackNum: ackFrame.ackNum,
      });
      return {
        accepted: false,
        advanced: false,
        reason: 'Sender not awaiting ACK',
      };
    }

    // Stop-and-Wait Alternating-Bit rule:
    // ACK ackNum must match the sequence number of the outstanding frame.
    if (ackFrame.ackNum === this.currentSeqNum) {
      this.emitEvent('ACK_RECEIVED', {
        ackNum: ackFrame.ackNum,
        seqNum: this.currentSeqNum,
        attempt: this.currentAttempt,
      });

      this.isTimerRunning = false;
      this.timerElapsedMs = 0;
      this.outstandingFrame = null;
      this.stats.framesAcknowledged += 1;

      // Advance alternating bit: 0 -> 1 -> 0
      const prevSeq = this.currentSeqNum;
      this.currentSeqNum = (this.currentSeqNum === 0 ? 1 : 0);
      this.status = 'IDLE';

      this.emitEvent('TRANSMISSION_COMPLETED', {
        acknowledgedSeqNum: prevSeq,
        nextSeqNum: this.currentSeqNum,
      });

      return {
        accepted: true,
        advanced: true,
        ackNum: ackFrame.ackNum,
      };
    } else {
      // Stale or invalid ACK number
      this.emitEvent('FRAME_REJECTED', {
        reason: `Unexpected ACK number: expected ${this.currentSeqNum}, received ${ackFrame.ackNum}`,
        expectedAckNum: this.currentSeqNum,
        receivedAckNum: ackFrame.ackNum,
      });

      return {
        accepted: false,
        advanced: false,
        reason: `Mismatched ACK: expected ${this.currentSeqNum}, got ${ackFrame.ackNum}`,
        ackNum: ackFrame.ackNum,
      };
    }
  }

  /**
   * Deterministic time step. Advances the sender's internal timer and triggers
   * timeout recovery if elapsed time reaches timeoutMs.
   */
  public tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrame?: Frame;
    failed?: boolean;
    attempt?: number;
  } {
    if (!this.isTimerRunning || this.status !== 'AWAITING_ACK') {
      return { timedOut: false };
    }

    this.timerElapsedMs += deltaMs;
    if (this.timerElapsedMs >= this.timeoutMs) {
      return this.handleTimeout();
    }

    return { timedOut: false };
  }

  /**
   * Triggers timeout handling explicitly, facilitating deterministic testing.
   */
  public handleTimeout(): {
    timedOut: boolean;
    retransmittedFrame?: Frame;
    failed?: boolean;
    attempt?: number;
  } {
    if (this.status !== 'AWAITING_ACK' || !this.outstandingFrame) {
      return { timedOut: false };
    }

    this.stats.timeouts += 1;
    this.emitEvent('TIMEOUT', {
      seqNum: this.currentSeqNum,
      attempt: this.currentAttempt,
      timeoutMs: this.timeoutMs,
    });

    if (this.currentAttempt < this.maxRetries) {
      this.currentAttempt += 1;
      this.retransmissionsCount += 1;
      this.stats.retransmissions += 1;
      this.stats.framesSent += 1;
      this.timerElapsedMs = 0;

      this.emitEvent('RETRANSMISSION', {
        seqNum: this.currentSeqNum,
        attempt: this.currentAttempt,
        maxRetries: this.maxRetries,
      });

      this.emitEvent('FRAME_SENT', {
        seqNum: this.outstandingFrame.seqNum,
        payloadLength: this.outstandingFrame.payload.length,
        attempt: this.currentAttempt,
        isRetransmission: true,
      });

      return {
        timedOut: true,
        retransmittedFrame: this.outstandingFrame,
        failed: false,
        attempt: this.currentAttempt,
      };
    } else {
      // Retransmissions exhausted
      this.isTimerRunning = false;
      this.status = 'FAILED';

      this.emitEvent('TRANSMISSION_FAILED', {
        seqNum: this.currentSeqNum,
        attemptsExhausted: this.currentAttempt,
        maxRetries: this.maxRetries,
      });

      return {
        timedOut: true,
        failed: true,
        attempt: this.currentAttempt,
      };
    }
  }

  public reset(): void {
    this.currentSeqNum = 0;
    this.status = 'IDLE';
    this.outstandingFrame = null;
    this.currentAttempt = 0;
    this.retransmissionsCount = 0;
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

export class StopAndWaitReceiver {
  private expectedSeqNum: 0 | 1 = 0;
  private deliveredPayloads: string[] = [];
  private lastDeliveredSeqNum: number | null = null;
  private sessionId?: string;
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

  constructor(config?: StopAndWaitReceiverConfig, onEvent?: (event: ProtocolEvent) => void) {
    this.sessionId = config?.sessionId;
    this.onEventListener = onEvent;
  }

  public getExpectedSeqNum(): 0 | 1 {
    return this.expectedSeqNum;
  }

  public getLastDeliveredSeqNum(): number | null {
    return this.lastDeliveredSeqNum;
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return [...this.deliveredPayloads];
  }

  public getDeliveredCount(): number {
    return this.deliveredPayloads.length;
  }

  public getEvents(): ReadonlyArray<ProtocolEvent> {
    return [...this.events];
  }

  public getStatistics(): Readonly<ProtocolStatistics> {
    return { ...this.stats };
  }

  private emitEvent(type: ProtocolEventType, details: Record<string, unknown>): ProtocolEvent {
    this.eventCounter += 1;
    const event: ProtocolEvent = {
      id: `saw-receiver-evt-${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      protocol: 'stop-and-wait',
      details,
    };
    this.events.push(event);
    if (this.onEventListener) {
      this.onEventListener(event);
    }
    return event;
  }

  /**
   * Processes an incoming frame (either serialized string or parsed Frame).
   * Validates structure, checksum, and alternating-bit sequence number.
   */
  public onFrameReceived(rawOrFrame: unknown): {
    accepted: boolean;
    isDuplicate: boolean;
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
          isDuplicate: false,
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
        isDuplicate: false,
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
        isDuplicate: false,
        error: `Unexpected frame type: ${frame.frameType}`,
      };
    }

    this.emitEvent('FRAME_RECEIVED', {
      seqNum: frame.seqNum,
      payloadLength: frame.payload.length,
      expectedSeqNum: this.expectedSeqNum,
    });

    // Case 1: Frame matches expected sequence number
    if (frame.seqNum === this.expectedSeqNum) {
      this.deliveredPayloads.push(frame.payload);
      this.lastDeliveredSeqNum = frame.seqNum;
      this.stats.bytesTransferred += frame.payload.length;

      this.emitEvent('PAYLOAD_DELIVERED', {
        seqNum: frame.seqNum,
        payload: frame.payload,
        totalDelivered: this.deliveredPayloads.length,
      });

      const ackFrame = createAckFrame({
        ackNum: frame.seqNum,
        sessionId: this.sessionId,
      });

      this.stats.framesAcknowledged += 1;
      this.stats.framesSent += 1; // ACK frame transmission

      this.emitEvent('ACK_SENT', {
        ackNum: ackFrame.ackNum,
        forSeqNum: frame.seqNum,
      });

      // Advance expected sequence number: 0 -> 1 -> 0
      this.expectedSeqNum = (this.expectedSeqNum === 0 ? 1 : 0);

      return {
        accepted: true,
        isDuplicate: false,
        ackFrame,
        deliveredPayload: frame.payload,
      };
    }

    // Case 2: Frame is a duplicate of the previous frame (its ACK was likely lost)
    const previousSeqNum = (this.expectedSeqNum === 0 ? 1 : 0);
    if (frame.seqNum === previousSeqNum) {
      this.emitEvent('DUPLICATE_FRAME_DETECTED', {
        seqNum: frame.seqNum,
        expectedSeqNum: this.expectedSeqNum,
      });

      // Crucial ARQ rule: Do NOT deliver the duplicate payload to the application again,
      // but DO re-send the ACK so the sender can recover and advance.
      const ackFrame = createAckFrame({
        ackNum: frame.seqNum,
        sessionId: this.sessionId,
      });

      this.stats.framesSent += 1;
      this.emitEvent('ACK_SENT', {
        ackNum: ackFrame.ackNum,
        forSeqNum: frame.seqNum,
        isDuplicateRecovery: true,
      });

      return {
        accepted: false,
        isDuplicate: true,
        ackFrame,
      };
    }

    // Case 3: Out-of-bounds or unexpected sequence number
    this.emitEvent('FRAME_REJECTED', {
      reason: `Out of sequence frame: received ${frame.seqNum}, expected ${this.expectedSeqNum}`,
      seqNum: frame.seqNum,
      expectedSeqNum: this.expectedSeqNum,
    });

    return {
      accepted: false,
      isDuplicate: false,
      error: `Invalid sequence number ${frame.seqNum}`,
    };
  }

  public reset(): void {
    this.expectedSeqNum = 0;
    this.deliveredPayloads = [];
    this.lastDeliveredSeqNum = null;
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
