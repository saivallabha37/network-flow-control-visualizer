import { describe, it, expect } from 'vitest';
import {
  calculateCRC32,
  verifyChecksum,
  createDataFrame,
  createAckFrame,
  serializeFrame,
  deserializeFrame,
} from '../src/index.js';

describe('Checksum & Frame Codec Tests', () => {
  describe('CRC-32 Checksum Engine', () => {
    it('computes deterministic CRC-32 checksums', () => {
      const data = 'Hello, Flow Control!';
      const checksum1 = calculateCRC32(data);
      const checksum2 = calculateCRC32(data);
      expect(checksum1).toBe(checksum2);
      expect(typeof checksum1).toBe('number');
      expect(checksum1).toBeGreaterThan(0);
    });

    it('verifies valid checksum correctly', () => {
      const data = 'Network Protocol Frame Payload';
      const checksum = calculateCRC32(data);
      expect(verifyChecksum(data, checksum)).toBe(true);
    });

    it('detects altered or corrupted data via checksum verification', () => {
      const data = 'Original pristine payload';
      const corrupted = 'Original pristine pay1oad'; // 1-character bit difference
      const checksum = calculateCRC32(data);

      expect(verifyChecksum(corrupted, checksum)).toBe(false);
    });
  });

  describe('Frame Serialization & Deserialization', () => {
    it('TC-1: Valid frame serialization and round-trip deserialization', () => {
      const originalFrame = createDataFrame({
        seqNum: 0,
        payload: 'Packet chunk #1',
        sessionId: 'session-alpha',
      });

      const serialized = serializeFrame(originalFrame);
      expect(typeof serialized).toBe('string');

      const result = deserializeFrame(serialized);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.frame.seqNum).toBe(0);
        expect(result.frame.frameType).toBe('DATA');
        expect(result.frame.payload).toBe('Packet chunk #1');
        expect(result.frame.sessionId).toBe('session-alpha');
        expect(result.frame.checksum).toBe(originalFrame.checksum);
      }
    });

    it('TC-2: Invalid frame rejection (malformed JSON and structure)', () => {
      // Non-JSON string
      const nonJson = 'NOT_JSON_DATA';
      const res1 = deserializeFrame(nonJson);
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.code).toBe('INVALID_JSON');
      }

      // Valid JSON but invalid structure (array instead of object)
      const arrayJson = JSON.stringify([1, 2, 3]);
      const res2 = deserializeFrame(arrayJson);
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.code).toBe('INVALID_STRUCTURE');
      }

      // Missing or invalid frameType
      const invalidTypeJson = JSON.stringify({
        frameType: 'INVALID_TYPE',
        seqNum: 0,
        payload: 'test',
        checksum: 12345,
        timestamp: Date.now(),
      });
      const res3 = deserializeFrame(invalidTypeJson);
      expect(res3.success).toBe(false);
      if (!res3.success) {
        expect(res3.code).toBe('INVALID_FRAME_TYPE');
      }

      // Negative sequence number
      const negativeSeqJson = JSON.stringify({
        frameType: 'DATA',
        seqNum: -1,
        payload: 'test',
        checksum: 12345,
        timestamp: Date.now(),
      });
      const res4 = deserializeFrame(negativeSeqJson);
      expect(res4.success).toBe(false);
      if (!res4.success) {
        expect(res4.code).toBe('INVALID_SEQ_NUM');
      }
    });

    it('TC-3: Corrupted payload detection via checksum validation', () => {
      const validFrame = createDataFrame({
        seqNum: 1,
        payload: 'Important financial datagram',
      });

      // Tamper with payload while keeping original checksum
      const tamperedRaw = JSON.stringify({
        ...validFrame,
        payload: 'Tampered malicious datagram',
      });

      const decodeResult = deserializeFrame(tamperedRaw);
      expect(decodeResult.success).toBe(false);
      if (!decodeResult.success) {
        expect(decodeResult.code).toBe('CORRUPTED_CHECKSUM');
        expect(decodeResult.error).toContain('Integrity check failed');
      }
    });

    it('correctly serializes and deserializes ACK frames', () => {
      const ackFrame = createAckFrame({
        ackNum: 0,
        sessionId: 'session-xyz',
      });

      const serialized = serializeFrame(ackFrame);
      const decodeResult = deserializeFrame(serialized);

      expect(decodeResult.success).toBe(true);
      if (decodeResult.success) {
        expect(decodeResult.frame.frameType).toBe('ACK');
        expect(decodeResult.frame.ackNum).toBe(0);
        expect(decodeResult.frame.payload).toBe('');
      }
    });
  });
});

