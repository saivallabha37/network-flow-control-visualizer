import { describe, it, expect } from 'vitest';
import { serializeUdpPacket, deserializeUdpPacket, MAX_UDP_PACKET_SIZE } from '../src/live/udp-codec.js';
import { HandshakeInitPacket, DataUdpPacket, AckUdpPacket, FileHeaderPacket } from '../src/live/live-types.js';
import { createDataFrame, createAckFrame } from '../src/utils/frame-codec.js';

describe('UDP Packet Codec', () => {
  it('serializes and deserializes a HANDSHAKE_INIT packet', () => {
    const packet: HandshakeInitPacket = {
      type: 'HANDSHAKE_INIT',
      sessionId: 'sess-1234',
      version: '1.0',
      timestamp: 1000,
      protocol: 'GO_BACK_N',
      windowSize: 4,
      seqNumberSpace: 8,
      maxPayloadSize: 1024,
      role: 'HOST_A',
      agentVersion: '0.1.0',
    };

    const buffer = serializeUdpPacket(packet);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const result = deserializeUdpPacket(buffer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.packet).toEqual(packet);
    }
  });

  it('serializes and deserializes a DATA packet with CRC frame', () => {
    const frame = createDataFrame({ seqNum: 3, payload: 'Hello LAN' });
    const packet: DataUdpPacket = {
      type: 'DATA',
      sessionId: 'sess-abc',
      version: '1.0',
      timestamp: 2000,
      frame,
      payloadType: 'TEXT',
    };

    const buffer = serializeUdpPacket(packet);
    const result = deserializeUdpPacket(buffer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.packet.type).toBe('DATA');
      const dataPkt = result.packet as DataUdpPacket;
      expect(dataPkt.frame.seqNum).toBe(3);
      expect(dataPkt.frame.payload).toBe('Hello LAN');
    }
  });

  it('serializes and deserializes an ACK packet', () => {
    const frame = createAckFrame({ ackNum: 4 });
    const packet: AckUdpPacket = {
      type: 'ACK',
      sessionId: 'sess-abc',
      version: '1.0',
      timestamp: 2100,
      frame,
    };

    const buffer = serializeUdpPacket(packet);
    const result = deserializeUdpPacket(buffer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.packet.type).toBe('ACK');
    }
  });

  it('serializes and deserializes a FILE_HEADER packet', () => {
    const packet: FileHeaderPacket = {
      type: 'FILE_HEADER',
      sessionId: 'sess-abc',
      version: '1.0',
      timestamp: 2200,
      transferId: 'tx-1',
      filename: 'sample.txt',
      fileSize: 4096,
      totalChunks: 4,
      chunkSize: 1024,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    const buffer = serializeUdpPacket(packet);
    const result = deserializeUdpPacket(buffer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.packet).toEqual(packet);
    }
  });

  it('rejects empty buffer', () => {
    const result = deserializeUdpPacket(Buffer.alloc(0));
    expect(result.success).toBe(false);
  });

  it('rejects packet exceeding max size', () => {
    const oversized = Buffer.alloc(MAX_UDP_PACKET_SIZE + 10);
    const result = deserializeUdpPacket(oversized);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('exceeds maximum supported size');
    }
  });

  it('rejects invalid JSON', () => {
    const corrupted = Buffer.from('{ corrupt json: [', 'utf-8');
    const result = deserializeUdpPacket(corrupted);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('JSON parse error');
    }
  });

  it('rejects packets with missing or invalid fields', () => {
    const missingType = Buffer.from(JSON.stringify({ sessionId: 's1', version: '1.0', timestamp: 1 }), 'utf-8');
    expect(deserializeUdpPacket(missingType).success).toBe(false);

    const badVersion = Buffer.from(JSON.stringify({ type: 'PING', sessionId: 's1', version: '2.0', timestamp: 1 }), 'utf-8');
    expect(deserializeUdpPacket(badVersion).success).toBe(false);
  });

  it('rejects Selective Repeat handshake violating M >= 2N', () => {
    const invalidSrHandshake = {
      type: 'HANDSHAKE_INIT',
      sessionId: 'sess-invalid-sr',
      version: '1.0',
      timestamp: Date.now(),
      protocol: 'selective-repeat',
      windowSize: 5,
      seqNumberSpace: 8, // 8 < 2 * 5 = 10 -> Violates M >= 2N
      maxPayloadSize: 1024,
      role: 'HOST_A',
      agentVersion: '0.1.0',
    };

    const buffer = Buffer.from(JSON.stringify(invalidSrHandshake), 'utf-8');
    const result = deserializeUdpPacket(buffer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('violates Selective Repeat condition M >= 2N');
    }
  });

  it('rejects FILE_HEADER with invalid SHA-256 hash format', () => {
    const badHashPacket = {
      type: 'FILE_HEADER',
      sessionId: 'sess-abc',
      version: '1.0',
      timestamp: 2200,
      transferId: 'tx-1',
      filename: 'sample.txt',
      fileSize: 4096,
      totalChunks: 4,
      chunkSize: 1024,
      sha256: 'not-a-valid-64-char-hex-hash',
    };

    const buffer = Buffer.from(JSON.stringify(badHashPacket), 'utf-8');
    const result = deserializeUdpPacket(buffer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('sha256 hex digest');
    }
  });

  it('rejects DATA packet with non-numeric checksum or negative sequence number', () => {
    const badDataPacket = {
      type: 'DATA',
      sessionId: 'sess-abc',
      version: '1.0',
      timestamp: 2000,
      frame: {
        frameType: 'DATA',
        seqNum: -1,
        payload: 'test',
        checksum: 12345,
      },
    };

    const res1 = deserializeUdpPacket(Buffer.from(JSON.stringify(badDataPacket), 'utf-8'));
    expect(res1.success).toBe(false);

    const badChecksumPacket = {
      ...badDataPacket,
      frame: {
        ...badDataPacket.frame,
        seqNum: 1,
        checksum: 'invalid-checksum',
      },
    };
    const res2 = deserializeUdpPacket(Buffer.from(JSON.stringify(badChecksumPacket), 'utf-8'));
    expect(res2.success).toBe(false);
  });
});

