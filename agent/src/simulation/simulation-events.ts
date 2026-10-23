import { ProtocolType, WindowState } from '../types/protocol.js';

export type SimulationEventType =
  | 'SIMULATION_STARTED'
  | 'SIMULATION_PAUSED'
  | 'SIMULATION_RESUMED'
  | 'SIMULATION_STEPPED'
  | 'SIMULATION_COMPLETED'
  | 'SIMULATION_FAILED'
  | 'SIMULATION_STOPPED'
  | 'FRAME_TRANSMITTED'
  | 'FRAME_DROPPED'
  | 'FRAME_CORRUPTED'
  | 'FRAME_DELIVERED'
  | 'FRAME_BUFFERED'
  | 'PAYLOAD_DELIVERED'
  | 'ACK_TRANSMITTED'
  | 'ACK_DROPPED'
  | 'ACK_DELIVERED'
  | 'TIMEOUT'
  | 'RETRANSMISSION'
  | 'SENDER_WINDOW_SLID'
  | 'RECEIVER_WINDOW_SLID';

export interface SimulationEventDetails {
  protocol: ProtocolType;
  description: string;
  seqNum?: number;
  ackNum?: number;
  payload?: string;
  payloadIndex?: number;
  isRetransmission?: boolean;
  attempt?: number;
  senderWindow?: WindowState;
  receiverBase?: number;
  bufferedCount?: number;
  remainingPayloads?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface SimulationEvent {
  id: string;
  virtualTimestamp: number;
  type: SimulationEventType;
  details: SimulationEventDetails;
}

