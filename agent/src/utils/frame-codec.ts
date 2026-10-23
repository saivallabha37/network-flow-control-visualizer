import {
  Frame,
  FrameDecodeResult,
  FrameType,
} from '../types/protocol.js';
import { calculateCRC32 } from './checksum.js';

/**
 * Computes the canonical integrity string for a frame to calculate its checksum.
 * Excludes the checksum field itself and timestamp to ensure reproducible verification.
 */
export function getFrameCanonicalString(frame: Omit<Frame, 'checksum'>): string {
  const ackStr = frame.ackNum !== undefined ? String(frame.ackNum) : '';
  const sessionStr = frame.sessionId ?? '';
  return `${frame.frameType}:${frame.seqNum}:${ackStr}:${frame.payload}:${sessionStr}`;
}

/**
 * Calculates a CRC-32 checksum for a frame based on its header and payload fields.
 */
export function computeFrameChecksum(frame: Omit<Frame, 'checksum'>): number {
  return calculateCRC32(getFrameCanonicalString(frame));
}

/**
 * Factory for creating a valid DATA frame with computed checksum and timestamp.
 */
export function createDataFrame(options: {
  seqNum: number;
  payload: string;
  timestamp?: number;
  sessionId?: string;
}): Frame {
  const partial = {
    frameType: 'DATA' as FrameType,
    seqNum: options.seqNum,
    payload: options.payload,
    timestamp: options.timestamp ?? Date.now(),
    sessionId: options.sessionId,
  };

  return {
    ...partial,
    checksum: computeFrameChecksum(partial),
  };
}

/**
 * Factory for creating a valid ACK frame with computed checksum and timestamp.
 */
export function createAckFrame(options: {
  ackNum: number;
  seqNum?: number;
  timestamp?: number;
  sessionId?: string;
}): Frame {
  const partial = {
    frameType: 'ACK' as FrameType,
    seqNum: options.seqNum ?? options.ackNum,
    ackNum: options.ackNum,
    payload: '',
    timestamp: options.timestamp ?? Date.now(),
    sessionId: options.sessionId,
  };

  return {
    ...partial,
    checksum: computeFrameChecksum(partial),
  };
}

/**
 * Serializes a Frame object into a transmission string.
 */
export function serializeFrame(frame: Frame): string {
  return JSON.stringify(frame);
}

/**
 * Deserializes and rigorously validates an incoming raw frame string.
 * Performs structural validation, type checks, and CRC-32 integrity verification.
 * Does not throw exceptions; returns a structured FrameDecodeResult.
 */
export function deserializeFrame(raw: unknown): FrameDecodeResult {
  if (typeof raw !== 'string') {
    return {
      success: false,
      error: 'Frame data must be a string',
      code: 'INVALID_STRUCTURE',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      success: false,
      error: 'Malformed frame data: JSON parse failed',
      code: 'INVALID_JSON',
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      error: 'Invalid frame structure: root must be an object',
      code: 'INVALID_STRUCTURE',
    };
  }

  const candidate = parsed as Record<string, unknown>;

  const validFrameTypes: FrameType[] = ['DATA', 'ACK', 'NAK', 'SYN', 'FIN'];
  if (
    typeof candidate.frameType !== 'string' ||
    !validFrameTypes.includes(candidate.frameType as FrameType)
  ) {
    return {
      success: false,
      error: `Invalid or missing frameType: ${String(candidate.frameType)}`,
      code: 'INVALID_FRAME_TYPE',
    };
  }

  if (
    typeof candidate.seqNum !== 'number' ||
    !Number.isInteger(candidate.seqNum) ||
    candidate.seqNum < 0
  ) {
    return {
      success: false,
      error: 'Invalid seqNum: must be a non-negative integer',
      code: 'INVALID_SEQ_NUM',
    };
  }

  if (
    candidate.ackNum !== undefined &&
    (typeof candidate.ackNum !== 'number' ||
      !Number.isInteger(candidate.ackNum) ||
      candidate.ackNum < 0)
  ) {
    return {
      success: false,
      error: 'Invalid ackNum: must be a non-negative integer when provided',
      code: 'INVALID_ACK_NUM',
    };
  }

  if (typeof candidate.payload !== 'string') {
    return {
      success: false,
      error: 'Invalid payload: must be a string',
      code: 'INVALID_PAYLOAD',
    };
  }

  if (typeof candidate.checksum !== 'number' || !Number.isInteger(candidate.checksum)) {
    return {
      success: false,
      error: 'Invalid checksum: must be an integer',
      code: 'CORRUPTED_CHECKSUM',
    };
  }

  if (typeof candidate.timestamp !== 'number' || isNaN(candidate.timestamp)) {
    return {
      success: false,
      error: 'Invalid timestamp: must be a valid number',
      code: 'INVALID_STRUCTURE',
    };
  }

  // Construct frame object without checksum to verify integrity
  const frameCandidate: Omit<Frame, 'checksum'> = {
    frameType: candidate.frameType as FrameType,
    seqNum: candidate.seqNum,
    ackNum: candidate.ackNum as number | undefined,
    payload: candidate.payload,
    timestamp: candidate.timestamp,
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : undefined,
  };

  const calculatedChecksum = computeFrameChecksum(frameCandidate);
  if (calculatedChecksum !== (candidate.checksum >>> 0)) {
    return {
      success: false,
      error: `Integrity check failed: checksum mismatch (expected ${candidate.checksum}, calculated ${calculatedChecksum})`,
      code: 'CORRUPTED_CHECKSUM',
    };
  }

  const validFrame: Frame = {
    ...frameCandidate,
    checksum: candidate.checksum >>> 0,
  };

  return {
    success: true,
    frame: validFrame,
  };
}

