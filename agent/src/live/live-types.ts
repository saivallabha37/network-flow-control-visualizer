import { Frame, ProtocolType, WindowState, ProtocolStatistics } from '../types/protocol.js';

export type LiveAgentStatus =
  | 'IDLE'
  | 'LISTENING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'TRANSFERRING'
  | 'DISCONNECTED'
  | 'ERROR';

export type LiveRole = 'HOST_A' | 'HOST_B' | 'UNASSIGNED';

// ================= UDP Packet Types =================

export type UdpPacketType =
  | 'HANDSHAKE_INIT'
  | 'HANDSHAKE_ACK'
  | 'HANDSHAKE_REJECT'
  | 'DATA'
  | 'ACK'
  | 'FILE_HEADER'
  | 'FILE_COMPLETE'
  | 'DISCONNECT'
  | 'PING'
  | 'PONG';

export interface BaseUdpPacket {
  type: UdpPacketType;
  sessionId: string;
  version: '1.0';
  timestamp: number;
}

export interface HandshakeInitPacket extends BaseUdpPacket {
  type: 'HANDSHAKE_INIT';
  protocol: ProtocolType;
  windowSize: number;
  seqNumberSpace: number;
  maxPayloadSize: number;
  role: 'HOST_A';
  agentVersion: string;
}

export interface HandshakeAckPacket extends BaseUdpPacket {
  type: 'HANDSHAKE_ACK';
  protocol: ProtocolType;
  windowSize: number;
  seqNumberSpace: number;
  maxPayloadSize: number;
  role: 'HOST_B';
  agentVersion: string;
}

export interface HandshakeRejectPacket extends BaseUdpPacket {
  type: 'HANDSHAKE_REJECT';
  reason: string;
}

export interface DataUdpPacket extends BaseUdpPacket {
  type: 'DATA';
  frame: Frame;
  payloadType: 'TEXT' | 'FILE_CHUNK';
  transferId?: string;
}

export interface AckUdpPacket extends BaseUdpPacket {
  type: 'ACK';
  frame: Frame;
}

export interface FileHeaderPacket extends BaseUdpPacket {
  type: 'FILE_HEADER';
  transferId: string;
  filename: string;
  fileSize: number;
  totalChunks: number;
  chunkSize: number;
  sha256: string;
}

export interface FileCompletePacket extends BaseUdpPacket {
  type: 'FILE_COMPLETE';
  transferId: string;
  sha256: string;
}

export interface DisconnectPacket extends BaseUdpPacket {
  type: 'DISCONNECT';
  reason?: string;
}

export interface PingPongPacket extends BaseUdpPacket {
  type: 'PING' | 'PONG';
}

export type UdpPacket =
  | HandshakeInitPacket
  | HandshakeAckPacket
  | HandshakeRejectPacket
  | DataUdpPacket
  | AckUdpPacket
  | FileHeaderPacket
  | FileCompletePacket
  | DisconnectPacket
  | PingPongPacket;

// ================= WebSocket Message Types (Browser <-> Local Agent) =================

export type WsClientCommandType =
  | 'GET_STATUS'
  | 'START_LISTENER'
  | 'STOP_LISTENER'
  | 'CONNECT_PEER'
  | 'DISCONNECT_PEER'
  | 'SEND_TEXT'
  | 'SEND_FILE'
  | 'LIST_RECEIVED_FILES'
  | 'DOWNLOAD_FILE'
  | 'SET_TEST_FAULT'; // Optional controlled fault injection

export interface StartListenerCmd {
  command: 'START_LISTENER';
  udpPort: number;
  udpHost?: string;
}

export interface ConnectPeerCmd {
  command: 'CONNECT_PEER';
  peerHost: string;
  peerUdpPort: number;
  protocol: ProtocolType;
  windowSize?: number;
  seqNumberSpace?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface SendTextCmd {
  command: 'SEND_TEXT';
  text: string;
  clientMessageId?: string;
}

export interface ListReceivedFilesCmd {
  command: 'LIST_RECEIVED_FILES';
}

export interface DownloadFileCmd {
  command: 'DOWNLOAD_FILE';
  filename: string;
}

export interface SendFileCmd {
  command: 'SEND_FILE';
  filename: string;
  fileBase64: string;
}

export interface DisconnectPeerCmd {
  command: 'DISCONNECT_PEER';
  reason?: string;
}

export interface SetTestFaultCmd {
  command: 'SET_TEST_FAULT';
  dropNextData?: boolean;
  dropNextAck?: boolean;
}

export type WsClientCommand =
  | { command: 'GET_STATUS' }
  | { command: 'STOP_LISTENER' }
  | StartListenerCmd
  | ConnectPeerCmd
  | SendTextCmd
  | SendFileCmd
  | ListReceivedFilesCmd
  | DownloadFileCmd
  | DisconnectPeerCmd
  | SetTestFaultCmd;

export type WsServerEventType =
  | 'AGENT_STATUS_UPDATE'
  | 'PEER_HANDSHAKE_SUCCESS'
  | 'PEER_HANDSHAKE_FAILED'
  | 'PEER_DISCONNECTED'
  | 'LIVE_PROTOCOL_EVENT'
  | 'LIVE_STATISTICS_UPDATE'
  | 'MESSAGE_DELIVERED'
  | 'MESSAGE_STATUS_UPDATE'
  | 'FILE_TRANSFER_PROGRESS'
  | 'FILE_DELIVERED'
  | 'RECEIVED_FILES_LIST'
  | 'FILE_DOWNLOAD_DATA'
  | 'AGENT_ERROR';

export interface VerifiedFileInfo {
  filename: string;
  fileSize: number;
  sha256: string;
  receivedAt: number;
}

export interface LiveTelemetryEvent {
  id: string;
  timestamp: number;
  type: string;
  direction: 'OUTBOUND' | 'INBOUND' | 'LOCAL';
  protocol: ProtocolType;
  seqNum?: number;
  ackNum?: number;
  isRetransmission?: boolean;
  senderWindow?: WindowState;
  receiverBase?: number;
  description: string;
}

export interface LiveAgentStateDto {
  status: LiveAgentStatus;
  role: LiveRole;
  localUdpPort?: number;
  localUdpHost?: string;
  peerHost?: string;
  peerUdpPort?: number;
  sessionId?: string;
  protocol?: ProtocolType;
  windowSize?: number;
  seqNumberSpace?: number;
  senderWindow?: WindowState;
  receiverBase?: number;
  stats: ProtocolStatistics;
  lastError?: string;
}

export interface WsServerMessage {
  type: WsServerEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

