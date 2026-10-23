import { WindowState } from '../types/protocol.js';

export interface WindowEntry<T> {
  seqNum: number;
  data: T;
  absoluteIndex: number;
  timestamp: number;
}

export interface CumulativeAckResult<T> {
  valid: boolean;
  acknowledgedCount: number;
  acknowledgedItems: WindowEntry<T>[];
  newBase: number;
  reason?: string;
}

/**
 * Reusable General Sliding Window Mechanism.
 *
 * Implements sender window tracking for flow-control and ARQ protocols.
 * Distinguishes between:
 * 1. Monotonic internal sequence indices (`absoluteIndex`: 0, 1, 2, ...) to prevent
 *    cross-cycle ambiguity during sequence wraparound.
 * 2. Modulo wire sequence numbers (`seqNum` in [0, seqNumberSpace - 1]).
 *
 * Enforces the protocol invariant:
 * seqNumberSpace (M) > windowSize (N) for Go-Back-N to avoid ACK ambiguity.
 */
export class SlidingWindow<T> {
  private readonly windowSize: number;
  private readonly seqNumberSpace: number;
  private buffer: WindowEntry<T>[] = [];
  private base: number = 0;
  private nextSeqNum: number = 0;
  private baseAbsoluteIndex: number = 0;
  private nextAbsoluteIndex: number = 0;

  constructor(options: { windowSize: number; seqNumberSpace?: number }) {
    if (!Number.isInteger(options.windowSize) || options.windowSize < 1) {
      throw new Error(`Window size must be a positive integer, received: ${options.windowSize}`);
    }

    this.windowSize = options.windowSize;
    // Default sequence number space: 2 * windowSize (common power-of-2 / multi-window sizing)
    this.seqNumberSpace = options.seqNumberSpace ?? Math.max(8, options.windowSize * 2);

    if (!Number.isInteger(this.seqNumberSpace) || this.seqNumberSpace <= this.windowSize) {
      throw new Error(
        `Sequence number space M (${this.seqNumberSpace}) must be strictly greater than window size N (${this.windowSize}) to prevent sequence ambiguity.`
      );
    }
  }

  public getCapacity(): number {
    return this.windowSize;
  }

  public getSeqNumberSpace(): number {
    return this.seqNumberSpace;
  }

  public getBase(): number {
    return this.base;
  }

  public getNextSeqNum(): number {
    return this.nextSeqNum;
  }

  public getBaseAbsoluteIndex(): number {
    return this.baseAbsoluteIndex;
  }

  public getNextAbsoluteIndex(): number {
    return this.nextAbsoluteIndex;
  }

  public getOutstandingCount(): number {
    return this.buffer.length;
  }

  public getAvailableCapacity(): number {
    return this.windowSize - this.buffer.length;
  }

  public canSend(): boolean {
    return this.buffer.length < this.windowSize;
  }

  public isFull(): boolean {
    return this.buffer.length >= this.windowSize;
  }

  public getOutstanding(): ReadonlyArray<WindowEntry<T>> {
    return [...this.buffer];
  }

  public getWindowState(): WindowState {
    return {
      base: this.base,
      nextSeqNum: this.nextSeqNum,
      windowSize: this.windowSize,
      bufferSize: this.buffer.length,
    };
  }

  /**
   * Appends an item to the transmission window if capacity exists.
   * Advances nextSeqNum modulo seqNumberSpace and increments absoluteIndex.
   */
  public push(data: T, timestamp?: number): WindowEntry<T> {
    if (this.isFull()) {
      throw new Error(
        `Cannot push to window: capacity reached (${this.buffer.length}/${this.windowSize})`
      );
    }

    const entry: WindowEntry<T> = {
      seqNum: this.nextSeqNum,
      data,
      absoluteIndex: this.nextAbsoluteIndex,
      timestamp: timestamp ?? Date.now(),
    };

    this.buffer.push(entry);

    // Advance sequence number modulo M
    this.nextSeqNum = (this.nextSeqNum + 1) % this.seqNumberSpace;
    this.nextAbsoluteIndex += 1;

    return entry;
  }

  /**
   * Processes a cumulative acknowledgement for wire sequence number ackNum.
   * Under the Inclusive Cumulative ACK Convention, ACK k acknowledges
   * frame k and all outstanding frames in the window prior to k.
   */
  public acknowledgeCumulative(ackNum: number): CumulativeAckResult<T> {
    const matchIndex = this.buffer.findIndex((entry) => entry.seqNum === ackNum);

    if (matchIndex === -1) {
      return {
        valid: false,
        acknowledgedCount: 0,
        acknowledgedItems: [],
        newBase: this.base,
        reason: `ackNum ${ackNum} does not match any outstanding frame in the active window [base=${this.base}]`,
      };
    }

    // Frames from index 0 to matchIndex are acknowledged cumulatively
    const acknowledgedItems = this.buffer.splice(0, matchIndex + 1);
    this.baseAbsoluteIndex += acknowledgedItems.length;

    // Update base wire sequence number
    if (this.buffer.length > 0) {
      this.base = this.buffer[0].seqNum;
    } else {
      this.base = this.nextSeqNum;
    }

    return {
      valid: true,
      acknowledgedCount: acknowledgedItems.length,
      acknowledgedItems,
      newBase: this.base,
    };
  }

  public reset(): void {
    this.buffer = [];
    this.base = 0;
    this.nextSeqNum = 0;
    this.baseAbsoluteIndex = 0;
    this.nextAbsoluteIndex = 0;
  }
}

