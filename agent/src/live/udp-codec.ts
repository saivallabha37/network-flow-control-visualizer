import { UdpPacket, UdpPacketType } from './live-types.js';

export const MAX_UDP_PACKET_SIZE = 65535;
export const SAFE_UDP_PAYLOAD_LIMIT = 1472; // Standard Ethernet MTU (1500) minus IP (20) & UDP (8) headers

export interface UdpDecodeSuccess {
  success: true;
  packet: UdpPacket;
}

export interface UdpDecodeFailure {
  success: false;
  error: string;
}

export type UdpDecodeResult = UdpDecodeSuccess | UdpDecodeFailure;

/**
 * Serializes a high-level UdpPacket object to a Buffer for dgram transmission.
 */
export function serializeUdpPacket(packet: UdpPacket): Buffer {
  const jsonStr = JSON.stringify(packet);
  return Buffer.from(jsonStr, 'utf-8');
}

/**
 * Validates and deserializes raw bytes received over UDP into a typed UdpPacket.
 */
export function deserializeUdpPacket(raw: Buffer | Uint8Array): UdpDecodeResult {
  if (!raw || raw.length === 0) {
    return { success: false, error: 'Empty UDP datagram received' };
  }

  if (raw.length > MAX_UDP_PACKET_SIZE) {
    return {
      success: false,
      error: `UDP datagram exceeds maximum supported size (${raw.length} > ${MAX_UDP_PACKET_SIZE})`,
    };
  }

  let parsed: unknown;
  try {
    const jsonStr = Buffer.isBuffer(raw) ? raw.toString('utf-8') : new TextDecoder().decode(raw);
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error for UDP datagram: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, error: 'Datagram does not contain a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;

  // Check base fields
  if (typeof obj.type !== 'string') {
    return { success: false, error: 'Missing or invalid packet type' };
  }
  if (typeof obj.sessionId !== 'string' || !obj.sessionId.trim()) {
    return { success: false, error: 'Missing or empty sessionId' };
  }
  if (obj.version !== '1.0') {
    return { success: false, error: `Unsupported protocol version: ${obj.version}` };
  }
  if (typeof obj.timestamp !== 'number' || isNaN(obj.timestamp)) {
    return { success: false, error: 'Missing or invalid timestamp' };
  }

  const type = obj.type as UdpPacketType;

  switch (type) {
    case 'HANDSHAKE_INIT':
    case 'HANDSHAKE_ACK': {
      const protoNorm = typeof obj.protocol === 'string' ? obj.protocol.toLowerCase().replace(/_/g, '-') : '';
      const validProtocols = ['stop-and-wait', 'go-back-n', 'selective-repeat'];
      if (!validProtocols.includes(protoNorm)) {
        return { success: false, error: `${type} invalid protocol: ${obj.protocol}` };
      }
      if (typeof obj.windowSize !== 'number' || !Number.isInteger(obj.windowSize) || obj.windowSize < 1 || obj.windowSize > 1024) {
        return { success: false, error: `${type} invalid windowSize: ${obj.windowSize}` };
      }
      if (typeof obj.seqNumberSpace !== 'number' || !Number.isInteger(obj.seqNumberSpace) || obj.seqNumberSpace < 2) {
        return { success: false, error: `${type} invalid seqNumberSpace: ${obj.seqNumberSpace}` };
      }
      if (protoNorm === 'selective-repeat' && obj.seqNumberSpace < 2 * obj.windowSize) {
        return {
          success: false,
          error: `${type} violates Selective Repeat condition M >= 2N (${obj.seqNumberSpace} < ${2 * obj.windowSize})`,
        };
      }
      break;
    }

    case 'HANDSHAKE_REJECT': {
      if (typeof obj.reason !== 'string') {
        return { success: false, error: 'HANDSHAKE_REJECT missing reason' };
      }
      break;
    }

    case 'DATA': {
      if (!obj.frame || typeof obj.frame !== 'object') {
        return { success: false, error: 'DATA packet missing frame' };
      }
      const frame = obj.frame as Record<string, unknown>;
      if (frame.frameType !== 'DATA') {
        return { success: false, error: 'DATA packet frameType is not DATA' };
      }
      if (typeof frame.seqNum !== 'number' || !Number.isInteger(frame.seqNum) || frame.seqNum < 0) {
        return { success: false, error: 'DATA packet frame invalid seqNum' };
      }
      if (typeof frame.checksum !== 'number' || !Number.isFinite(frame.checksum)) {
        return { success: false, error: 'DATA packet frame missing or non-numeric checksum' };
      }
      if (typeof frame.payload !== 'string') {
        return { success: false, error: 'DATA packet frame missing payload string' };
      }
      break;
    }

    case 'ACK': {
      if (!obj.frame || typeof obj.frame !== 'object') {
        return { success: false, error: 'ACK packet missing frame' };
      }
      const frame = obj.frame as Record<string, unknown>;
      if (frame.frameType !== 'ACK') {
        return { success: false, error: 'ACK packet frameType is not ACK' };
      }
      if (typeof frame.ackNum !== 'number' || !Number.isInteger(frame.ackNum) || frame.ackNum < 0) {
        return { success: false, error: 'ACK packet frame invalid ackNum' };
      }
      if (typeof frame.checksum !== 'number' || !Number.isFinite(frame.checksum)) {
        return { success: false, error: 'ACK packet frame missing or non-numeric checksum' };
      }
      break;
    }

    case 'FILE_HEADER': {
      if (typeof obj.transferId !== 'string' || !obj.transferId.trim()) {
        return { success: false, error: 'FILE_HEADER missing transferId' };
      }
      if (typeof obj.filename !== 'string' || !obj.filename.trim()) {
        return { success: false, error: 'FILE_HEADER missing filename' };
      }
      if (typeof obj.fileSize !== 'number' || !Number.isFinite(obj.fileSize) || obj.fileSize < 0) {
        return { success: false, error: 'FILE_HEADER invalid fileSize' };
      }
      if (typeof obj.totalChunks !== 'number' || !Number.isInteger(obj.totalChunks) || obj.totalChunks < 1) {
        return { success: false, error: 'FILE_HEADER invalid totalChunks' };
      }
      if (typeof obj.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(obj.sha256)) {
        return { success: false, error: 'FILE_HEADER invalid sha256 hex digest' };
      }
      break;
    }

    case 'FILE_COMPLETE': {
      if (typeof obj.transferId !== 'string') {
        return { success: false, error: 'FILE_COMPLETE missing transferId' };
      }
      if (typeof obj.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(obj.sha256)) {
        return { success: false, error: 'FILE_COMPLETE invalid sha256 hex digest' };
      }
      break;
    }

    case 'DISCONNECT':
    case 'PING':
    case 'PONG':
      break;

    default:
      return { success: false, error: `Unknown packet type: ${type}` };
  }

  return {
    success: true,
    packet: parsed as UdpPacket,
  };
}
