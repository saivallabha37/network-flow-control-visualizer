import { Frame, ProtocolType, WindowState } from '../types/protocol.js';
import { StopAndWaitReceiver, StopAndWaitSender } from '../protocols/stop-and-wait.js';
import { GoBackNReceiver, GoBackNSender } from '../protocols/go-back-n.js';
import { SelectiveRepeatReceiver, SelectiveRepeatSender } from '../protocols/selective-repeat.js';
import { ValidatedSimulationConfig } from './simulation-config.js';

export interface IProtocolSimulationAdapter {
  readonly protocol: ProtocolType;
  canSend(): boolean;
  send(payload: string): { success: boolean; frame?: Frame; error?: string };
  onAckReceived(ackFrame: Frame): { accepted: boolean; advanced: boolean };
  onFrameReceived(frame: Frame): {
    accepted: boolean;
    ackFrame?: Frame;
    deliveredPayloads: string[];
    isBuffered?: boolean;
    isDuplicate?: boolean;
  };
  tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrames: Frame[];
    failed: boolean;
  };
  isSenderFailed(): boolean;
  isSenderCompleted(): boolean;
  getSenderWindowState(): WindowState;
  getReceiverBase(): number;
  getDeliveredPayloads(): ReadonlyArray<string>;
  reset(): void;
}

export class StopAndWaitAdapter implements IProtocolSimulationAdapter {
  public readonly protocol: ProtocolType = 'stop-and-wait';
  private sender: StopAndWaitSender;
  private receiver: StopAndWaitReceiver;

  constructor(config: ValidatedSimulationConfig) {
    this.sender = new StopAndWaitSender({
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
    this.receiver = new StopAndWaitReceiver();
  }

  public canSend(): boolean {
    return this.sender.getStatus() !== 'AWAITING_ACK' && this.sender.getStatus() !== 'FAILED';
  }

  public send(payload: string): { success: boolean; frame?: Frame; error?: string } {
    return this.sender.send(payload);
  }

  public onAckReceived(ackFrame: Frame): { accepted: boolean; advanced: boolean } {
    const res = this.sender.onAckReceived(ackFrame);
    return { accepted: res.accepted, advanced: res.advanced };
  }

  public onFrameReceived(frame: Frame): {
    accepted: boolean;
    ackFrame?: Frame;
    deliveredPayloads: string[];
    isBuffered?: boolean;
    isDuplicate?: boolean;
  } {
    const res = this.receiver.onFrameReceived(frame);
    return {
      accepted: res.accepted,
      ackFrame: res.ackFrame,
      deliveredPayloads: res.deliveredPayload ? [res.deliveredPayload] : [],
      isBuffered: false,
      isDuplicate: res.isDuplicate,
    };
  }

  public tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrames: Frame[];
    failed: boolean;
  } {
    const res = this.sender.tick(deltaMs);
    return {
      timedOut: res.timedOut,
      retransmittedFrames: res.retransmittedFrame ? [res.retransmittedFrame] : [],
      failed: Boolean(res.failed),
    };
  }

  public isSenderFailed(): boolean {
    return this.sender.getStatus() === 'FAILED';
  }

  public isSenderCompleted(): boolean {
    return this.sender.getStatus() === 'IDLE' && !this.sender.getOutstandingFrame();
  }

  public getSenderWindowState(): WindowState {
    const hasOutstanding = Boolean(this.sender.getOutstandingFrame());
    return {
      base: this.sender.getCurrentSeqNum(),
      nextSeqNum: this.sender.getCurrentSeqNum(),
      windowSize: 1,
      bufferSize: hasOutstanding ? 1 : 0,
    };
  }

  public getReceiverBase(): number {
    return this.receiver.getExpectedSeqNum();
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return this.receiver.getDeliveredPayloads();
  }

  public reset(): void {
    this.sender.reset();
    this.receiver.reset();
  }
}

export class GoBackNAdapter implements IProtocolSimulationAdapter {
  public readonly protocol: ProtocolType = 'go-back-n';
  private sender: GoBackNSender;
  private receiver: GoBackNReceiver;

  constructor(config: ValidatedSimulationConfig) {
    this.sender = new GoBackNSender({
      windowSize: config.windowSize,
      seqNumberSpace: config.seqNumberSpace,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
    this.receiver = new GoBackNReceiver({
      seqNumberSpace: config.seqNumberSpace,
    });
  }

  public canSend(): boolean {
    return (
      this.sender.getStatus() !== 'FAILED' &&
      this.sender.getOutstandingCount() < this.sender.getWindowCapacity()
    );
  }

  public send(payload: string): { success: boolean; frame?: Frame; error?: string } {
    return this.sender.send(payload);
  }

  public onAckReceived(ackFrame: Frame): { accepted: boolean; advanced: boolean } {
    const res = this.sender.onAckReceived(ackFrame);
    return { accepted: res.accepted, advanced: res.advanced };
  }

  public onFrameReceived(frame: Frame): {
    accepted: boolean;
    ackFrame?: Frame;
    deliveredPayloads: string[];
    isBuffered?: boolean;
    isDuplicate?: boolean;
  } {
    const res = this.receiver.onFrameReceived(frame);
    return {
      accepted: res.accepted,
      ackFrame: res.ackFrame,
      deliveredPayloads: res.deliveredPayload ? [res.deliveredPayload] : [],
      isBuffered: false,
      isDuplicate: res.isOutOfOrder,
    };
  }

  public tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrames: Frame[];
    failed: boolean;
  } {
    const res = this.sender.tick(deltaMs);
    return {
      timedOut: res.timedOut,
      retransmittedFrames: res.retransmittedFrames ?? [],
      failed: Boolean(res.failed),
    };
  }

  public isSenderFailed(): boolean {
    return this.sender.getStatus() === 'FAILED';
  }

  public isSenderCompleted(): boolean {
    return this.sender.getOutstandingCount() === 0;
  }

  public getSenderWindowState(): WindowState {
    return this.sender.getWindowState();
  }

  public getReceiverBase(): number {
    return this.receiver.getExpectedSeqNum();
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return this.receiver.getDeliveredPayloads();
  }

  public reset(): void {
    this.sender.reset();
    this.receiver.reset();
  }
}

export class SelectiveRepeatAdapter implements IProtocolSimulationAdapter {
  public readonly protocol: ProtocolType = 'selective-repeat';
  private sender: SelectiveRepeatSender;
  private receiver: SelectiveRepeatReceiver;

  constructor(config: ValidatedSimulationConfig) {
    this.sender = new SelectiveRepeatSender({
      windowSize: config.windowSize,
      seqNumberSpace: config.seqNumberSpace,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
    this.receiver = new SelectiveRepeatReceiver({
      windowSize: config.windowSize,
      seqNumberSpace: config.seqNumberSpace,
    });
  }

  public canSend(): boolean {
    return this.sender.canSend();
  }

  public send(payload: string): { success: boolean; frame?: Frame; error?: string } {
    return this.sender.send(payload);
  }

  public onAckReceived(ackFrame: Frame): { accepted: boolean; advanced: boolean } {
    const res = this.sender.onAckReceived(ackFrame);
    return { accepted: res.accepted, advanced: res.advanced };
  }

  public onFrameReceived(frame: Frame): {
    accepted: boolean;
    ackFrame?: Frame;
    deliveredPayloads: string[];
    isBuffered?: boolean;
    isDuplicate?: boolean;
  } {
    const res = this.receiver.onFrameReceived(frame);
    return {
      accepted: res.accepted,
      ackFrame: res.ackFrame,
      deliveredPayloads: res.deliveredPayloads ?? [],
      isBuffered: res.isBuffered,
      isDuplicate: res.isDuplicate,
    };
  }

  public tick(deltaMs: number): {
    timedOut: boolean;
    retransmittedFrames: Frame[];
    failed: boolean;
  } {
    const res = this.sender.tick(deltaMs);
    return {
      timedOut: res.timedOut,
      retransmittedFrames: res.retransmittedFrames,
      failed: Boolean(res.failed),
    };
  }

  public isSenderFailed(): boolean {
    return this.sender.getStatus() === 'FAILED';
  }

  public isSenderCompleted(): boolean {
    return this.sender.getOutstandingCount() === 0;
  }

  public getSenderWindowState(): WindowState {
    return this.sender.getWindowState();
  }

  public getReceiverBase(): number {
    return this.receiver.getRcvBase();
  }

  public getDeliveredPayloads(): ReadonlyArray<string> {
    return this.receiver.getDeliveredPayloads();
  }

  public reset(): void {
    this.sender.reset();
    this.receiver.reset();
  }
}

export function createProtocolAdapter(config: ValidatedSimulationConfig): IProtocolSimulationAdapter {
  switch (config.protocol) {
    case 'stop-and-wait':
      return new StopAndWaitAdapter(config);
    case 'go-back-n':
      return new GoBackNAdapter(config);
    case 'selective-repeat':
      return new SelectiveRepeatAdapter(config);
  }
}

