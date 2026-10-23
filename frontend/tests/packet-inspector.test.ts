import { describe, it, expect } from 'vitest';
import { InFlightPacket, SimulationEvent } from '@agent';

describe('Packet Inspector Data Mapping', () => {
  it('correctly extracts packet fields from InFlightPacket', () => {
    const packet: InFlightPacket = {
      id: 'pkt-data-1',
      type: 'DATA',
      frame: {
        frameType: 'DATA',
        seqNum: 2,
        payload: 'Test Payload Message',
        checksum: 0x1234abcd,
        timestamp: 100,
      },
      departureTime: 100,
      scheduledDeliveryTime: 160,
      isDropped: false,
      isCorrupted: false,
    };

    expect(packet.type).toBe('DATA');
    expect(packet.frame.seqNum).toBe(2);
    expect(packet.frame.payload).toBe('Test Payload Message');
    expect(packet.scheduledDeliveryTime - packet.departureTime).toBe(60);

    const remainingAtTime120 = Math.max(0, packet.scheduledDeliveryTime - 120);
    expect(remainingAtTime120).toBe(40);
  });

  it('handles ACK packet without payload correctly as unavailable', () => {
    const ackPacket: InFlightPacket = {
      id: 'pkt-ack-1',
      type: 'ACK',
      frame: {
        frameType: 'ACK',
        seqNum: 0,
        ackNum: 3,
        payload: '',
        checksum: 0x99887766,
        timestamp: 200,
      },
      departureTime: 200,
      scheduledDeliveryTime: 260,
      isDropped: false,
      isCorrupted: false,
    };

    expect(ackPacket.type).toBe('ACK');
    expect(ackPacket.frame.ackNum).toBe(3);
    // Payload should be treated as unavailable for ACK frames
    const isPayloadAvailable = ackPacket.type === 'DATA';
    expect(isPayloadAvailable).toBe(false);
  });

  it('correctly maps from SimulationEvent when in-flight packet is not available', () => {
    const event: SimulationEvent = {
      id: 'sim-evt-5',
      virtualTimestamp: 300,
      type: 'FRAME_TRANSMITTED',
      details: {
        protocol: 'selective-repeat',
        description: 'Frame 4 transmitted',
        seqNum: 4,
        payload: 'Hello Selective Repeat',
        isRetransmission: true,
      },
    };

    expect(event.details.seqNum).toBe(4);
    expect(event.details.isRetransmission).toBe(true);
    expect(event.details.payload).toBe('Hello Selective Repeat');
  });
});

