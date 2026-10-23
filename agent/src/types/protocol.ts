/**
 * Core protocol domain definitions for Network Flow Control Protocols Visualizer.
 * 
 * Note on taxonomy:
 * - 'sliding-window' is the general windowing mechanism.
 * - 'stop-and-wait', 'go-back-n', and 'selective-repeat' are the specific ARQ protocols.
 */

export type ProtocolType = 'stop-and-wait' | 'go-back-n' | 'selective-repeat';

export type OperatingMode = 'simulation' | 'live';

export type FrameType = 'DATA' | 'ACK' | 'NAK' | 'SYN' | 'FIN';

export interface Frame {
  frameType: FrameType;
  seqNum: number;
  ackNum?: number;
  payload: string;
  checksum: number;
  timestamp: number;
  sessionId?: string;
}

export type FrameDecodeErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_STRUCTURE'
  | 'INVALID_FRAME_TYPE'
  | 'INVALID_SEQ_NUM'
  | 'INVALID_ACK_NUM'
  | 'INVALID_PAYLOAD'
  | 'CORRUPTED_CHECKSUM';

export type FrameDecodeResult =
  | { success: true; frame: Frame }
  | { success: false; error: string; code: FrameDecodeErrorCode };

export type ProtocolEventType =
  | 'FRAME_SENT'
  | 'FRAME_RECEIVED'
  | 'ACK_SENT'
  | 'ACK_RECEIVED'
  | 'FRAME_REJECTED'
  | 'FRAME_BUFFERED'
  | 'DUPLICATE_FRAME_DETECTED'
  | 'TIMEOUT'
  | 'RETRANSMISSION'
  | 'FRAME_LOST'
  | 'ACK_LOST'
  | 'PAYLOAD_DELIVERED'
  | 'TRANSMISSION_COMPLETED'
  | 'TRANSMISSION_FAILED'
  | 'WINDOW_SLID'
  | 'CONNECTION_STATE_CHANGED';

export interface ProtocolEvent {
  id: string;
  type: ProtocolEventType;
  timestamp: number;
  protocol: ProtocolType;
  details: Record<string, unknown>;
}

export type SenderStatus = 'IDLE' | 'AWAITING_ACK' | 'COMPLETED' | 'FAILED';

export interface WindowState {
  base: number;
  nextSeqNum: number;
  windowSize: number;
  bufferSize: number;
}

export interface ProtocolStatistics {
  framesSent: number;
  framesAcknowledged: number;
  retransmissions: number;
  timeouts: number;
  lostFramesSimulated: number;
  lostAcksSimulated: number;
  bytesTransferred: number;
  startTime?: number;
  endTime?: number;
}

export interface StopAndWaitSenderConfig {
  timeoutMs?: number;
  maxRetries?: number;
  sessionId?: string;
}

export interface StopAndWaitReceiverConfig {
  sessionId?: string;
}

export interface GoBackNSenderConfig {
  windowSize?: number;
  seqNumberSpace?: number;
  timeoutMs?: number;
  maxRetries?: number;
  sessionId?: string;
}

export interface GoBackNReceiverConfig {
  seqNumberSpace?: number;
  sessionId?: string;
}

export interface SelectiveRepeatSenderConfig {
  windowSize?: number;
  seqNumberSpace?: number;
  timeoutMs?: number;
  maxRetries?: number;
  sessionId?: string;
}

export interface SelectiveRepeatReceiverConfig {
  windowSize?: number;
  seqNumberSpace?: number;
  sessionId?: string;
}
