import { describe, it, expect } from 'vitest';
import { SimulationEvent } from '@agent';

describe('Space-Time Diagram Event Mapping & Logic', () => {
  it('correctly associates transmission and delivery events', () => {
    const events: SimulationEvent[] = [
      {
        id: 'evt-1',
        virtualTimestamp: 0,
        type: 'FRAME_TRANSMITTED',
        details: { protocol: 'go-back-n', description: 'Transmitted Frame 0', seqNum: 0 },
      },
      {
        id: 'evt-2',
        virtualTimestamp: 60,
        type: 'FRAME_DELIVERED',
        details: { protocol: 'go-back-n', description: 'Delivered Frame 0', seqNum: 0 },
      },
      {
        id: 'evt-3',
        virtualTimestamp: 60,
        type: 'ACK_TRANSMITTED',
        details: { protocol: 'go-back-n', description: 'Transmitted ACK 0', ackNum: 0 },
      },
      {
        id: 'evt-4',
        virtualTimestamp: 120,
        type: 'ACK_DELIVERED',
        details: { protocol: 'go-back-n', description: 'Delivered ACK 0', ackNum: 0 },
      },
    ];

    expect(events.length).toBe(4);
    const tx = events.find((e) => e.type === 'FRAME_TRANSMITTED');
    const rx = events.find((e) => e.type === 'FRAME_DELIVERED');
    expect(tx?.details.seqNum).toBe(0);
    expect(rx?.details.seqNum).toBe(0);
    expect(rx!.virtualTimestamp - tx!.virtualTimestamp).toBe(60);
  });

  it('correctly maps dropped frames and timeouts', () => {
    const events: SimulationEvent[] = [
      {
        id: 'evt-10',
        virtualTimestamp: 0,
        type: 'FRAME_TRANSMITTED',
        details: { protocol: 'go-back-n', description: 'Frame 1 transmitted', seqNum: 1 },
      },
      {
        id: 'evt-11',
        virtualTimestamp: 60,
        type: 'FRAME_DROPPED',
        details: { protocol: 'go-back-n', description: 'Frame 1 dropped in channel', seqNum: 1 },
      },
      {
        id: 'evt-12',
        virtualTimestamp: 250,
        type: 'TIMEOUT',
        details: { protocol: 'go-back-n', description: 'Sender timeout expired' },
      },
      {
        id: 'evt-13',
        virtualTimestamp: 250,
        type: 'FRAME_TRANSMITTED',
        details: { protocol: 'go-back-n', description: 'Retransmitted Frame 1', seqNum: 1, isRetransmission: true },
      },
    ];

    const dropped = events.find((e) => e.type === 'FRAME_DROPPED');
    const timeout = events.find((e) => e.type === 'TIMEOUT');
    const retx = events.find((e) => e.details.isRetransmission === true);

    expect(dropped).toBeDefined();
    expect(timeout?.virtualTimestamp).toBe(250);
    expect(retx?.details.seqNum).toBe(1);
  });
});

