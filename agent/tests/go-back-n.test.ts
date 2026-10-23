import { describe, it, expect, beforeEach } from 'vitest';
import {
  GoBackNSender,
  GoBackNReceiver,
  createAckFrame,
  createDataFrame,
  serializeFrame,
} from '../src/index.js';

describe('Go-Back-N ARQ Protocol State Machine Tests', () => {
  let sender: GoBackNSender;
  let receiver: GoBackNReceiver;

  beforeEach(() => {
    // Window size 4, sequence number space 8 (0..7), timeout 1000ms, maxRetries 3
    sender = new GoBackNSender({ windowSize: 4, seqNumberSpace: 8, timeoutMs: 1000, maxRetries: 3 });
    receiver = new GoBackNReceiver({ seqNumberSpace: 8 });
  });

  it('1. A sender fills its transmission window', () => {
    expect(sender.getBase()).toBe(0);
    expect(sender.getNextSeqNum()).toBe(0);
    expect(sender.getOutstandingCount()).toBe(0);

    const f0 = sender.send('Frame 0');
    const f1 = sender.send('Frame 1');
    const f2 = sender.send('Frame 2');
    const f3 = sender.send('Frame 3');

    expect(f0.success).toBe(true);
    expect(f1.success).toBe(true);
    expect(f2.success).toBe(true);
    expect(f3.success).toBe(true);

    expect(sender.getOutstandingCount()).toBe(4);
    expect(sender.getBase()).toBe(0);
    expect(sender.getNextSeqNum()).toBe(4);
    expect(sender.getStatus()).toBe('AWAITING_ACK');

    const frames = sender.getOutstandingFrames();
    expect(frames.map((f) => f.seqNum)).toEqual([0, 1, 2, 3]);
  });

  it('2. The sender refuses to exceed the configured window capacity', () => {
    sender.send('F0');
    sender.send('F1');
    sender.send('F2');
    sender.send('F3');
    expect(sender.getOutstandingCount()).toBe(4);

    // 5th frame attempt should fail because window size is 4
    const excess = sender.send('F4 (Over Capacity)');
    expect(excess.success).toBe(false);
    expect(excess.error).toContain('Window is full');
    expect(sender.getOutstandingCount()).toBe(4);
    expect(sender.getNextSeqNum()).toBe(4);
  });

  it('3. A valid cumulative ACK advances the base correctly', () => {
    sender.send('F0');
    sender.send('F1');
    expect(sender.getBase()).toBe(0);

    // Cumulative ACK for 0 advances base to 1
    const ack0 = createAckFrame({ ackNum: 0 });
    const ackResult = sender.onAckReceived(ack0);

    expect(ackResult.accepted).toBe(true);
    expect(ackResult.advanced).toBe(true);
    expect(ackResult.acknowledgedCount).toBe(1);
    expect(sender.getBase()).toBe(1);
    expect(sender.getOutstandingCount()).toBe(1);

    const events = sender.getEvents();
    expect(events.some((e) => e.type === 'WINDOW_SLID')).toBe(true);
  });

  it('4. Multiple acknowledged frames advance the window correctly (cumulative ACK)', () => {
    sender.send('F0');
    sender.send('F1');
    sender.send('F2');
    sender.send('F3');
    expect(sender.getOutstandingCount()).toBe(4);

    // ACK 2 acknowledges F0, F1, and F2 cumulatively
    const ack2 = createAckFrame({ ackNum: 2 });
    const ackResult = sender.onAckReceived(ack2);

    expect(ackResult.accepted).toBe(true);
    expect(ackResult.acknowledgedCount).toBe(3);
    expect(sender.getBase()).toBe(3);
    expect(sender.getOutstandingCount()).toBe(1); // Only F3 remains
    expect(sender.getStatistics().framesAcknowledged).toBe(3);

    // Now capacity is released; sender can send new frames
    const f4 = sender.send('F4');
    expect(f4.success).toBe(true);
    expect(f4.frame?.seqNum).toBe(4);
  });

  it('5. Sequence-number wraparound works cleanly', () => {
    // Window size 3, sequence number space 5 (modulo 5)
    const wrapSender = new GoBackNSender({ windowSize: 3, seqNumberSpace: 5 });
    const wrapReceiver = new GoBackNReceiver({ seqNumberSpace: 5 });

    // Send 0, 1, 2
    const tx0 = wrapSender.send('Data 0');
    const tx1 = wrapSender.send('Data 1');
    const tx2 = wrapSender.send('Data 2');

    // Receiver accepts 0, 1, 2
    wrapReceiver.onFrameReceived(tx0.frame!);
    wrapReceiver.onFrameReceived(tx1.frame!);
    const rx2 = wrapReceiver.onFrameReceived(tx2.frame!);

    // ACK 2 received by sender -> base advances to 3
    wrapSender.onAckReceived(rx2.ackFrame!);
    expect(wrapSender.getBase()).toBe(3);

    // Send 3, 4, then wraps around to 0
    const tx3 = wrapSender.send('Data 3');
    const tx4 = wrapSender.send('Data 4');
    const tx5 = wrapSender.send('Data 5 (Wrapped seq 0)');

    expect(tx3.frame?.seqNum).toBe(3);
    expect(tx4.frame?.seqNum).toBe(4);
    expect(tx5.frame?.seqNum).toBe(0); // Wrapped around!

    // Receiver accepts wrapped frames in order
    wrapReceiver.onFrameReceived(tx3.frame!);
    wrapReceiver.onFrameReceived(tx4.frame!);
    const rx5 = wrapReceiver.onFrameReceived(tx5.frame!);
    expect(rx5.accepted).toBe(true);

    // Cumulative ACK for wrapped frame 0 acknowledges 3, 4, 0
    const wrapAck = wrapSender.onAckReceived(rx5.ackFrame!);
    expect(wrapAck.accepted).toBe(true);
    expect(wrapAck.acknowledgedCount).toBe(3);
    expect(wrapSender.getBase()).toBe(1); // New base is nextSeqNum (1)
    expect(wrapSender.getOutstandingCount()).toBe(0);
  });

  it('6. Invalid or stale ACKs do not corrupt sender state', () => {
    sender.send('F0');
    sender.send('F1');
    expect(sender.getBase()).toBe(0);

    // Stale ACK for non-outstanding sequence number 5
    const staleAck = createAckFrame({ ackNum: 5 });
    const res = sender.onAckReceived(staleAck);

    expect(res.accepted).toBe(false);
    expect(res.advanced).toBe(false);
    expect(sender.getBase()).toBe(0);
    expect(sender.getOutstandingCount()).toBe(2);

    const events = sender.getEvents();
    expect(events.some((e) => e.type === 'FRAME_REJECTED')).toBe(true);
  });

  it('7. The receiver accepts the expected frame and advances expectedSeqNum', () => {
    expect(receiver.getExpectedSeqNum()).toBe(0);
    expect(receiver.getDeliveredCount()).toBe(0);

    const f0 = createDataFrame({ seqNum: 0, payload: 'Payload 0' });
    const rxResult = receiver.onFrameReceived(f0);

    expect(rxResult.accepted).toBe(true);
    expect(rxResult.isOutOfOrder).toBe(false);
    expect(rxResult.deliveredPayload).toBe('Payload 0');
    expect(rxResult.ackFrame?.ackNum).toBe(0);
    expect(receiver.getExpectedSeqNum()).toBe(1);
    expect(receiver.getLastAcknowledgedSeqNum()).toBe(0);
  });

  it('8. The receiver discards out-of-order frames without buffering', () => {
    // Deliver frame 0 first
    const f0 = createDataFrame({ seqNum: 0, payload: 'Payload 0' });
    receiver.onFrameReceived(f0);
    expect(receiver.getExpectedSeqNum()).toBe(1);

    // Now send frame 2 while receiver expects 1 (simulating loss of frame 1)
    const f2 = createDataFrame({ seqNum: 2, payload: 'Payload 2' });
    const rxResult = receiver.onFrameReceived(f2);

    expect(rxResult.accepted).toBe(false);
    expect(rxResult.isOutOfOrder).toBe(true);
    // Must re-send cumulative ACK for highest in-order frame (0)
    expect(rxResult.ackFrame?.ackNum).toBe(0);

    // Receiver must NOT deliver Payload 2, and must still expect 1
    expect(receiver.getDeliveredPayloads()).toEqual(['Payload 0']);
    expect(receiver.getExpectedSeqNum()).toBe(1);
  });

  it('9. The receiver does not deliver duplicate payloads', () => {
    const f0 = createDataFrame({ seqNum: 0, payload: 'Unique Payload' });
    receiver.onFrameReceived(f0);
    expect(receiver.getDeliveredCount()).toBe(1);

    // Receive duplicate frame 0 again
    const dupResult = receiver.onFrameReceived(f0);
    expect(dupResult.accepted).toBe(false);
    expect(dupResult.isOutOfOrder).toBe(true);
    expect(dupResult.ackFrame?.ackNum).toBe(0); // Re-acknowledges 0

    // Payload count remains 1
    expect(receiver.getDeliveredCount()).toBe(1);
    expect(receiver.getDeliveredPayloads()).toEqual(['Unique Payload']);
  });

  it('10. A timeout retransmits ALL outstanding frames from the base (Go-Back-N)', () => {
    sender.send('F0');
    sender.send('F1');
    sender.send('F2');
    expect(sender.getOutstandingCount()).toBe(3);

    // Deterministic tick steps time past timeout (1000ms)
    const tickResult = sender.tick(1000);
    expect(tickResult.timedOut).toBe(true);
    expect(tickResult.retransmittedFrames).toBeDefined();
    expect(tickResult.retransmittedFrames?.length).toBe(3);

    // Verifies Go-Back-N behavior: ALL outstanding frames retransmitted starting from base
    const retransmittedSeqs = tickResult.retransmittedFrames?.map((f) => f.seqNum);
    expect(retransmittedSeqs).toEqual([0, 1, 2]);

    const stats = sender.getStatistics();
    expect(stats.timeouts).toBe(1);
    expect(stats.retransmissions).toBe(3);
  });

  it('11. A successful ACK after retransmission resumes transmission', () => {
    sender.send('Data 0');
    sender.send('Data 1');

    // Simulate timeout and retransmission
    const timeoutRes = sender.handleTimeout();
    expect(timeoutRes.timedOut).toBe(true);
    expect(timeoutRes.retransmittedFrames?.length).toBe(2);

    // Receiver receives the retransmitted frames in order
    const f0 = timeoutRes.retransmittedFrames![0];
    const f1 = timeoutRes.retransmittedFrames![1];

    receiver.onFrameReceived(f0);
    const rx1 = receiver.onFrameReceived(f1);

    // Cumulative ACK 1 acknowledges both Data 0 and Data 1
    const ackRes = sender.onAckReceived(rx1.ackFrame!);
    expect(ackRes.accepted).toBe(true);
    expect(ackRes.acknowledgedCount).toBe(2);
    expect(sender.getOutstandingCount()).toBe(0);

    // Sender resumes sending new data
    const nextTx = sender.send('Data 2');
    expect(nextTx.success).toBe(true);
    expect(nextTx.frame?.seqNum).toBe(2);
  });

  it('12. Retry exhaustion terminates the sender correctly in FAILED state', () => {
    sender.send('Doomed Data');
    expect(sender.getCurrentRetries()).toBe(0);

    // Retries 1, 2, 3
    sender.handleTimeout(); // Attempt 1
    expect(sender.getCurrentRetries()).toBe(1);
    sender.handleTimeout(); // Attempt 2
    expect(sender.getCurrentRetries()).toBe(2);
    sender.handleTimeout(); // Attempt 3
    expect(sender.getCurrentRetries()).toBe(3);

    // 4th timeout exceeds maxRetries (3) -> terminates
    const exhausted = sender.handleTimeout();
    expect(exhausted.timedOut).toBe(true);
    expect(exhausted.failed).toBe(true);
    expect(sender.getStatus()).toBe('FAILED');

    // Sender refuses to transmit when in FAILED state
    const blocked = sender.send('Blocked Data');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('FAILED state');
  });

  it('13. Corrupted frames are rejected by the receiver', () => {
    const validFrame = createDataFrame({ seqNum: 0, payload: 'Authentic Data' });
    const raw = serializeFrame(validFrame);

    // Corrupt payload
    const corruptedRaw = raw.replace('Authentic Data', 'Corrupted Data In Flight');
    const rxRes = receiver.onFrameReceived(corruptedRaw);

    expect(rxRes.accepted).toBe(false);
    expect(rxRes.error).toContain('Integrity check failed');
    expect(receiver.getDeliveredCount()).toBe(0);
    expect(receiver.getExpectedSeqNum()).toBe(0);
  });
});

