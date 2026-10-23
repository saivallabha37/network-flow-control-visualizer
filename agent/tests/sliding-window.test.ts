import { describe, it, expect } from 'vitest';
import { SlidingWindow } from '../src/index.js';

describe('General Sliding Window Mechanism Unit Tests', () => {
  it('enforces positive window size and seqNumberSpace > windowSize invariants', () => {
    expect(() => new SlidingWindow({ windowSize: 0 })).toThrow(/positive integer/);
    expect(() => new SlidingWindow({ windowSize: -2 })).toThrow(/positive integer/);
    expect(() => new SlidingWindow({ windowSize: 4, seqNumberSpace: 4 })).toThrow(/strictly greater/);
    expect(() => new SlidingWindow({ windowSize: 4, seqNumberSpace: 3 })).toThrow(/strictly greater/);

    const validWindow = new SlidingWindow({ windowSize: 4, seqNumberSpace: 8 });
    expect(validWindow.getCapacity()).toBe(4);
    expect(validWindow.getSeqNumberSpace()).toBe(8);
  });

  it('tracks capacity and rejects items when window is full', () => {
    const window = new SlidingWindow<string>({ windowSize: 3, seqNumberSpace: 8 });
    expect(window.canSend()).toBe(true);
    expect(window.isFull()).toBe(false);
    expect(window.getAvailableCapacity()).toBe(3);

    window.push('Item 0');
    window.push('Item 1');
    window.push('Item 2');

    expect(window.canSend()).toBe(false);
    expect(window.isFull()).toBe(true);
    expect(window.getAvailableCapacity()).toBe(0);
    expect(window.getOutstandingCount()).toBe(3);

    expect(() => window.push('Item 3')).toThrow(/capacity reached/);
  });

  it('advances base and releases capacity on cumulative acknowledgement', () => {
    const window = new SlidingWindow<string>({ windowSize: 4, seqNumberSpace: 8 });
    window.push('P0'); // seqNum 0
    window.push('P1'); // seqNum 1
    window.push('P2'); // seqNum 2

    expect(window.getBase()).toBe(0);
    expect(window.getNextSeqNum()).toBe(3);

    // Cumulative ACK for sequence number 1 (acknowledges P0 and P1)
    const ackResult = window.acknowledgeCumulative(1);
    expect(ackResult.valid).toBe(true);
    expect(ackResult.acknowledgedCount).toBe(2);
    expect(ackResult.acknowledgedItems.map((i) => i.data)).toEqual(['P0', 'P1']);
    expect(window.getBase()).toBe(2); // New base is P2
    expect(window.getOutstandingCount()).toBe(1);
    expect(window.canSend()).toBe(true);
  });

  it('handles sequence-number wraparound correctly without cross-cycle confusion', () => {
    // Window size 3, sequence number space 5 (modulo 5: 0, 1, 2, 3, 4)
    const window = new SlidingWindow<string>({ windowSize: 3, seqNumberSpace: 5 });

    // Push seq 0, 1, 2
    window.push('A'); // seq 0
    window.push('B'); // seq 1
    window.push('C'); // seq 2
    expect(window.isFull()).toBe(true);

    // Acknowledge seq 1 (A and B) -> base becomes 2
    window.acknowledgeCumulative(1);
    expect(window.getBase()).toBe(2);
    expect(window.getAvailableCapacity()).toBe(2);

    // Push seq 3, 4
    window.push('D'); // seq 3
    window.push('E'); // seq 4
    expect(window.getNextSeqNum()).toBe(0); // Wrapped around to 0!
    expect(window.isFull()).toBe(true);

    // Acknowledge seq 4 (C, D, E) -> base wraps around to nextSeqNum (0)
    const ackResult = window.acknowledgeCumulative(4);
    expect(ackResult.valid).toBe(true);
    expect(ackResult.acknowledgedCount).toBe(3);
    expect(window.getBase()).toBe(0);
    expect(window.getOutstandingCount()).toBe(0);

    // Can push on the wrapped sequence number
    const nextEntry = window.push('F');
    expect(nextEntry.seqNum).toBe(0);
    expect(window.getBase()).toBe(0);
  });

  it('rejects stale or out-of-window acknowledgements', () => {
    const window = new SlidingWindow<string>({ windowSize: 4, seqNumberSpace: 8 });
    window.push('X'); // seq 0
    window.push('Y'); // seq 1

    // Try to acknowledge seq 5 (not in flight)
    const invalidAck = window.acknowledgeCumulative(5);
    expect(invalidAck.valid).toBe(false);
    expect(invalidAck.acknowledgedCount).toBe(0);
    expect(window.getBase()).toBe(0);
    expect(window.getOutstandingCount()).toBe(2);
  });
});

