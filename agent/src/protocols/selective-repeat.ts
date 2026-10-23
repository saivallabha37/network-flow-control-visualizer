import {
  Frame,
  ProtocolEvent,
  ProtocolEventType,
  ProtocolStatistics,
  SelectiveRepeatReceiverConfig,
  SelectiveRepeatSenderConfig,
  SenderStatus,
  WindowState,
} from '../types/protocol.js';
import {
  createAckFrame,
  createDataFrame,
  deserializeFrame,
} from '../utils/frame-codec.js';

export interface SRSenderSlot {
  seqNum: number;
  frame: Frame;
  absoluteIndex: number;
  acknowledged: boolean;
  timerElapsedMs: number;
  retries: number;
}

export interface SRReceiverWindowState {
  rcvBase: number;
  windowSize: number;
  bufferedCount: number;
  bufferedSeqNums: number[];
}

/**
 * Selective Repeat ARQ Sender State Machine.
 *
 * Implements independent acknowledgement tracking, individual frame timers,
 * selective retransmission of only timed-out frames, and window advancement.
 *
 * Enforces the fundamental protocol invariant:
 * sequence-number space M >= 2 * windowSize N.
 */
export class SelectiveRepeatSender {
  private readonly windowSize: number;
  private readonly seqNumberSpace: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sessionId?: string;

  private slots: SRSenderSlot[] = [];
  private nextSeqNum: number = 0;
  private nextAbsoluteIndex: number = 0;
  private status: SenderStatus = 'IDLE';

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

  constructor(config?: SelectiveRepeatSenderConfig, onEvent?: (event: ProtocolEvent) => void) {
    this.windowSize = config?.windowSize ?? 4;
    this.seqNumberSpace = config?.seqNumberSpace ?? Math.max(8, this.windowSize * 2);
    this.timeoutMs = config?.timeoutMs ?? 1000;
    this.maxRetries = config?.maxRetries ?? 3;
    this.sessionId = config?.sessionId;
    this.onEventListener = onEvent;

    if (!Number.isInteger(this.windowSize) || this.windowSize < 1) {
      throw new Error(`Window size must be a positive integer, received: ${this.windowSize}`);
    }

    if (!Number.isInteger(this.seqNumberSpace)) {
      throw new Error(`Sequence number space must be an integer, received: ${this.seqNumberSpace}`);
    }

    // Mathematical invariant for Selective Repeat: M >= 2N
    if (this.seqNumberSpace < 2 * this.windowSize) {
      throw new Error(
        `Invalid Selective Repeat configuration: sequence number space M (${this.seqNumberSpace}) must be at least 2 * window size N (${2 * this.windowSize}) to prevent sequence ambiguity.`
      );
    }
  }

  public getBase(): number {
    return this.slots.length > 0 ? this.slots[0].seqNum : this.nextSeqNum;
  }

  public getNextSeqNum(): number {
    return this.nextSeqNum;
  }

  public getWindowSize(): number {
    return this.windowSize;
  }

  public getSeqNumberSpace(): number {
    return this.seqNumberSpace;
  }

  public getStatus(): SenderStatus {
    return this.status;
  }

  public getOutstandingCount(): number {
    return this.slots.length;
  }

  public getSlots(): ReadonlyArray<SRSenderSlot> {
    return this.slots.map((s) => ({ ...s }));
  }

  public getWindowState(): WindowState {
    return {
      base: this.getBase(),
      nextSeqNum: this.nextSeqNum,
      windowSize: this.windowSize,
      bufferSize: this.slots.length,
    };
  }

  public canSend(): boolean {
    return this.slots.length < this.windowSize && this.status !== 'FAILED';
  }

  public isFull(): boolean {
    return this.slots.length >= this.windowSize;
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
      id: `sr-sender-evt-${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      protocol: 'selective-repeat',
      details,
    };
    this.events.push(event);
    if (this.onEventListener) {
      this.onEventListener(event);
    }
    return event;
  }

  /**
   * Transmits a new payload if the window capacity allows.
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

    if (this.slots.length >= this.windowSize) {
      return {
        success: false,
        error: `Cannot send: Sender window is full (${this.slots.length}/${this.windowSize})`,
      };
    }

    const seqNum = this.nextSeqNum;
    const frame = createDataFrame({
      seqNum,
      payload,
      sessionId: this.sessionId,
    });

    const slot: SRSenderSlot = {
      seqNum,
      frame,
      absoluteIndex: this.nextAbsoluteIndex,
      acknowledged: false,
      timerElapsedMs: 0,
      retries: 0,
    };

    this.slots.push(slot);
    this.nextSeqNum = (this.nextSeqNum + 1) % this.seqNumberSpace;
    this.nextAbsoluteIndex += 1;

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
      windowBase: this.getBase(),
      outstandingCount: this.slots.length,
      capacity: this.windowSize,
    });

    return {
      success: true,
      frame,
    };
  }

  /**
   * Processes an incoming individual ACK for a specific sequence number.
   */
  public onAckReceived(rawOrFrame: unknown): {
    accepted: boolean;
    advanced: boolean;
    alreadyAcknowledged?: boolean;
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

    if (ackFrame.frameType !== 'ACK' || ackFrame.ackNum === undefined) {
      this.emitEvent('FRAME_REJECTED', {
        reason: `Expected ACK frame with valid ackNum, received ${ackFrame.frameType}`,
      });
      return {
        accepted: false,
        advanced: false,
        reason: `Invalid ACK frame type: ${ackFrame.frameType}`,
      };
    }

    const ackNum = ackFrame.ackNum;
    const targetSlot = this.slots.find((s) => s.seqNum === ackNum);

    if (!targetSlot) {
      // Stale ACK for already slid frame, or out-of-window ACK
      this.emitEvent('FRAME_REJECTED', {
        reason: `ACK ${ackNum} does not correspond to an unacknowledged frame in the current sender window`,
        ackNum,
        windowBase: this.getBase(),
      });

      return {
        accepted: false,
        advanced: false,
        reason: 'Out-of-window or stale ACK',
      };
    }

    if (targetSlot.acknowledged) {
      // Duplicate ACK for an already marked frame in the current window
      this.emitEvent('ACK_RECEIVED', {
        ackNum,
        duplicate: true,
        windowBase: this.getBase(),
      });

      return {
        accepted: true,
        advanced: false,
        alreadyAcknowledged: true,
      };
    }

    // Mark individual slot as acknowledged and stop its timer
    targetSlot.acknowledged = true;
    targetSlot.timerElapsedMs = 0;
    this.stats.framesAcknowledged += 1;

    this.emitEvent('ACK_RECEIVED', {
      ackNum,
      windowBase: this.getBase(),
      outstandingCount: this.slots.length,
    });

    const oldBase = this.getBase();
    let advancedCount = 0;

    // In Selective Repeat, the sender window advances past contiguous acknowledged slots starting from base
    while (this.slots.length > 0 && this.slots[0].acknowledged) {
      this.slots.shift();
      advancedCount += 1;
    }

    const newBase = this.getBase();

    if (advancedCount > 0) {
      this.emitEvent('WINDOW_SLID', {
        oldBase,
        newBase,
        advancedBy: advancedCount,
        remainingOutstanding: this.slots.length,
      });
    }

    if (this.slots.length === 0) {
      this.status = 'COMPLETED';
      this.emitEvent('TRANSMISSION_COMPLETED', {
        finalBase: newBase,
        totalAcknowledged: this.stats.framesAcknowledged,
      });
    }

    return {
      accepted: true,
      advanced: advancedCount > 0,
      newBase,
    };
  }

  /**
   * Advances elapsed time deterministically across all unacknowledged slots.
   * Retransmits ONLY individual frames that time out.
   */
  public tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrames: Frame[];
    failed?: boolean;
  } {
    if (this.slots.length === 0 || this.status === 'FAILED') {
      return { timedOut: false, retransmittedFrames: [] };
    }

    const timedOutSlots: SRSenderSlot[] = [];

    for (const slot of this.slots) {
      if (!slot.acknowledged) {
        slot.timerElapsedMs += deltaMs;
        if (slot.timerElapsedMs >= this.timeoutMs) {
          timedOutSlots.push(slot);
        }
      }
    }

    if (timedOutSlots.length === 0) {
      return { timedOut: false, retransmittedFrames: [] };
    }

    const retransmitted: Frame[] = [];

    for (const slot of timedOutSlots) {
      this.stats.timeouts += 1;
      this.emitEvent('TIMEOUT', {
        seqNum: slot.seqNum,
        attempt: slot.retries + 1,
        timeoutMs: this.timeoutMs,
      });

      if (slot.retries < this.maxRetries) {
        slot.retries += 1;
        slot.timerElapsedMs = 0; // Reset timer for this specific frame
        this.stats.retransmissions += 1;
        this.stats.framesSent += 1;

        retransmitted.push(slot.frame);

        this.emitEvent('RETRANSMISSION', {
          seqNum: slot.seqNum,
          attempt: slot.retries,
          maxRetries: this.maxRetries,
        });

        this.emitEvent('FRAME_SENT', {
          seqNum: slot.seqNum,
          isRetransmission: true,
          attempt: slot.retries,
          windowBase: this.getBase(),
        });
      } else {
        // Retry limit exhausted for this slot!
        this.status = 'FAILED';
        this.emitEvent('TRANSMISSION_FAILED', {
          seqNum: slot.seqNum,
          attemptsExhausted: slot.retries,
          maxRetries: this.maxRetries,
        });

        return {
          timedOut: true,
          retransmittedFrames: retransmitted,
          failed: true,
        };
      }
    }

    return {
      timedOut: true,
      retransmittedFrames: retransmitted,
      failed: false,
    };
  }

  /**
   * Explicitly triggers timeout for a specific sequence number or the oldest unacknowledged frame.
   */
  public handleTimeout(targetSeqNum?: number): {
    timedOut: boolean;
    retransmittedFrame?: Frame;
    failed?: boolean;
    attempt?: number;
  } {
    const slot =
      targetSeqNum !== undefined
        ? this.slots.find((s) => s.seqNum === targetSeqNum && !s.acknowledged)
        : this.slots.find((s) => !s.acknowledged);

    if (!slot) {
      return { timedOut: false };
    }

    this.stats.timeouts += 1;
    this.emitEvent('TIMEOUT', {
      seqNum: slot.seqNum,
      attempt: slot.retries + 1,
      timeoutMs: this.timeoutMs,
    });

    if (slot.retries < this.maxRetries) {
      slot.retries += 1;
      slot.timerElapsedMs = 0;
      this.stats.retransmissions += 1;
      this.stats.framesSent += 1;

      this.emitEvent('RETRANSMISSION', {
        seqNum: slot.seqNum,
        attempt: slot.retries,
        maxRetries: this.maxRetries,
      });

      this.emitEvent('FRAME_SENT', {
        seqNum: slot.seqNum,
        isRetransmission: true,
        attempt: slot.retries,
        windowBase: this.getBase(),
      });

      return {
        timedOut: true,
        retransmittedFrame: slot.frame,
        failed: false,
        attempt: slot.retries,
      };
    } else {
      this.status = 'FAILED';
      this.emitEvent('TRANSMISSION_FAILED', {
        seqNum: slot.seqNum,
        attemptsExhausted: slot.retries,
        maxRetries: this.maxRetries,
      });

      return {
        timedOut: true,
        failed: true,
        attempt: slot.retries,
      };
    }
  }

  public reset(): void {
    this.slots = [];
    this.nextSeqNum = 0;
    this.nextAbsoluteIndex = 0;
    this.status = 'IDLE';
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
 * Selective Repeat ARQ Receiver State Machine.
 *
 * Implements receiver-side buffering of out-of-order frames, individual ACKs,
 * sequential payload delivery to the application, and duplicate recovery.
 *
 * Enforces M >= 2 * windowSize N.
 */
export class SelectiveRepeatReceiver {
  private readonly windowSize: number;
  private readonly seqNumberSpace: number;
  private readonly sessionId?: string;

  private rcvBase: number = 0;
  private buffer: Map<number, string> = new Map();
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

  constructor(config?: SelectiveRepeatReceiverConfig, onEvent?: (event: ProtocolEvent) => void) {
    this.windowSize = config?.windowSize ?? 4;
    this.seqNumberSpace = config?.seqNumberSpace ?? Math.max(8, this.windowSize * 2);
    this.sessionId = config?.sessionId;
    this.onEventListener = onEvent;

    if (!Number.isInteger(this.windowSize) || this.windowSize < 1) {
      throw new Error(`Window size must be a positive integer, received: ${this.windowSize}`);
    }

    if (this.seqNumberSpace < 2 * this.windowSize) {
      throw new Error(
        `Invalid Selective Repeat configuration: sequence number space M (${this.seqNumberSpace}) must be at least 2 * window size N (${2 * this.windowSize}) to prevent sequence ambiguity.`
      );
    }
  }

  public getRcvBase(): number {
    return this.rcvBase;
  }

  public getWindowSize(): number {
    return this.windowSize;
  }

  public getSeqNumberSpace(): number {
    return this.seqNumberSpace;
  }

  public getBufferedCount(): number {
    return this.buffer.size;
  }

  public getBufferedSeqNums(): number[] {
    return Array.from(this.buffer.keys()).sort((a, b) => a - b);
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return [...this.deliveredPayloads];
  }

  public getDeliveredCount(): number {
    return this.deliveredPayloads.length;
  }

  public getWindowState(): SRReceiverWindowState {
    return {
      rcvBase: this.rcvBase,
      windowSize: this.windowSize,
      bufferedCount: this.buffer.size,
      bufferedSeqNums: this.getBufferedSeqNums(),
    };
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
      id: `sr-receiver-evt-${this.eventCounter}`,
      type,
      timestamp: Date.now(),
      protocol: 'selective-repeat',
      details,
    };
    this.events.push(event);
    if (this.onEventListener) {
      this.onEventListener(event);
    }
    return event;
  }

  /**
   * Processes an incoming frame in Selective Repeat.
   *
   * Boundaries evaluated:
   * 1. [rcvBase, rcvBase + N - 1] (mod M): Receive window. Accept, ACK, deliver/buffer.
   * 2. [rcvBase - N, rcvBase - 1] (mod M): Previously accepted frames. Re-ACK, do not deliver again.
   * 3. Otherwise: Out-of-window. Reject.
   */
  public onFrameReceived(rawOrFrame: unknown): {
    accepted: boolean;
    isDuplicate: boolean;
    isBuffered: boolean;
    ackFrame?: Frame;
    deliveredPayloads?: string[];
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
          isBuffered: false,
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
        isBuffered: false,
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
        isBuffered: false,
        error: `Unexpected frame type: ${frame.frameType}`,
      };
    }

    this.emitEvent('FRAME_RECEIVED', {
      seqNum: frame.seqNum,
      rcvBase: this.rcvBase,
      payloadLength: frame.payload.length,
    });

    const forwardDistance = (frame.seqNum - this.rcvBase + this.seqNumberSpace) % this.seqNumberSpace;

    // Case 1: Frame falls inside the receive window [rcvBase, rcvBase + N - 1]
    if (forwardDistance >= 0 && forwardDistance < this.windowSize) {
      const ackFrame = createAckFrame({
        ackNum: frame.seqNum,
        sessionId: this.sessionId,
      });

      this.stats.framesSent += 1; // ACK transmitted
      this.emitEvent('ACK_SENT', {
        ackNum: ackFrame.ackNum,
        seqNum: frame.seqNum,
      });

      // Check if already buffered
      if (this.buffer.has(frame.seqNum)) {
        this.emitEvent('DUPLICATE_FRAME_DETECTED', {
          seqNum: frame.seqNum,
          buffered: true,
        });

        return {
          accepted: true,
          isDuplicate: true,
          isBuffered: false,
          ackFrame,
        };
      }

      // If frame is exactly rcvBase, deliver it and cascade any contiguous buffered frames
      if (frame.seqNum === this.rcvBase) {
        const newlyDelivered: string[] = [frame.payload];
        this.deliveredPayloads.push(frame.payload);
        this.stats.bytesTransferred += frame.payload.length;
        this.stats.framesAcknowledged += 1;

        this.emitEvent('PAYLOAD_DELIVERED', {
          seqNum: frame.seqNum,
          payload: frame.payload,
          totalDelivered: this.deliveredPayloads.length,
        });

        const oldBase = this.rcvBase;
        this.rcvBase = (this.rcvBase + 1) % this.seqNumberSpace;

        // Cascade deliver contiguous buffered frames
        while (this.buffer.has(this.rcvBase)) {
          const nextPayload = this.buffer.get(this.rcvBase)!;
          this.buffer.delete(this.rcvBase);
          this.deliveredPayloads.push(nextPayload);
          newlyDelivered.push(nextPayload);
          this.stats.bytesTransferred += nextPayload.length;
          this.stats.framesAcknowledged += 1;

          this.emitEvent('PAYLOAD_DELIVERED', {
            seqNum: this.rcvBase,
            payload: nextPayload,
            fromBuffer: true,
            totalDelivered: this.deliveredPayloads.length,
          });

          this.rcvBase = (this.rcvBase + 1) % this.seqNumberSpace;
        }

        this.emitEvent('WINDOW_SLID', {
          endpoint: 'receiver',
          oldBase,
          newBase: this.rcvBase,
          advancedBy: newlyDelivered.length,
        });

        return {
          accepted: true,
          isDuplicate: false,
          isBuffered: false,
          ackFrame,
          deliveredPayloads: newlyDelivered,
        };
      } else {
        // Out-of-order frame within the receive window: BUFFER IT!
        this.buffer.set(frame.seqNum, frame.payload);

        this.emitEvent('FRAME_BUFFERED', {
          seqNum: frame.seqNum,
          rcvBase: this.rcvBase,
          bufferedCount: this.buffer.size,
        });

        return {
          accepted: true,
          isDuplicate: false,
          isBuffered: true,
          ackFrame,
        };
      }
    }

    // Case 2: Frame falls in the previous window [rcvBase - N, rcvBase - 1] (mod M)
    const backwardDistance =
      (this.rcvBase - 1 - frame.seqNum + this.seqNumberSpace) % this.seqNumberSpace;

    if (backwardDistance >= 0 && backwardDistance < this.windowSize) {
      // Re-acknowledge previously accepted frame so sender can advance
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

      this.emitEvent('DUPLICATE_FRAME_DETECTED', {
        seqNum: frame.seqNum,
        rcvBase: this.rcvBase,
        alreadyDelivered: true,
      });

      return {
        accepted: false,
        isDuplicate: true,
        isBuffered: false,
        ackFrame,
      };
    }

    // Case 3: Out-of-window frame
    this.emitEvent('FRAME_REJECTED', {
      reason: 'Frame sequence number is outside both receive window and previous window',
      seqNum: frame.seqNum,
      rcvBase: this.rcvBase,
      windowSize: this.windowSize,
    });

    return {
      accepted: false,
      isDuplicate: false,
      isBuffered: false,
      error: `Frame ${frame.seqNum} is outside receive window [${this.rcvBase}, ${(this.rcvBase + this.windowSize - 1) % this.seqNumberSpace}]`,
    };
  }

  public reset(): void {
    this.rcvBase = 0;
    this.buffer.clear();
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

