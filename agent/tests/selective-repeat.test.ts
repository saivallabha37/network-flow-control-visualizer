import { describe, it, expect, beforeEach } from 'vitest';
import {
  SelectiveRepeatSender,
  SelectiveRepeatReceiver,
  createAckFrame,
  createDataFrame,
  serializeFrame,
} from '../src/index.js';

describe('Selective Repeat ARQ Protocol Engine Tests', () => {
  let sender: SelectiveRepeatSender;
  let receiver: SelectiveRepeatReceiver;

  beforeEach(() => {
    // Window size 3, sequence number space 8 (8 >= 2 * 3 satisfies M >= 2N)
    sender = new SelectiveRepeatSender({ windowSize: 3, seqNumberSpace: 8, timeoutMs: 1000, maxRetries: 3 });
    receiver = new SelectiveRepeatReceiver({ windowSize: 3, seqNumberSpace: 8 });
  });

  it('1. Valid Selective Repeat configuration succeeds', () => {
    expect(sender.getWindowSize()).toBe(3);
    expect(sender.getSeqNumberSpace()).toBe(8);
    expect(receiver.getWindowSize()).toBe(3);
    expect(receiver.getSeqNumberSpace()).toBe(8);
  });

  it('2. Rejection when M < 2N constraint is violated', () => {
    // Window size 4, M = 7 (7 < 2 * 4 = 8)
    expect(() => new SelectiveRepeatSender({ windowSize: 4, seqNumberSpace: 7 })).toThrow(
      /must be at least 2 \* window size N/
    );

    expect(() => new SelectiveRepeatReceiver({ windowSize: 4, seqNumberSpace: 7 })).toThrow(
      /must be at least 2 \* window size N/
    );

    // M == 2N must succeed
    expect(() => new SelectiveRepeatSender({ windowSize: 4, seqNumberSpace: 8 })).not.toThrow();
  });

  it('3. Sending frames up to sender-window capacity and refusing excess', () => {
    expect(sender.canSend()).toBe(true);

    const tx0 = sender.send('Frame 0');
    const tx1 = sender.send('Frame 1');
    const tx2 = sender.send('Frame 2');

    expect(tx0.success).toBe(true);
    expect(tx1.success).toBe(true);
    expect(tx2.success).toBe(true);
    expect(sender.getOutstandingCount()).toBe(3);
    expect(sender.isFull()).toBe(true);
    expect(sender.canSend()).toBe(false);

    // 4th send attempt is blocked because window size is 3
    const tx3 = sender.send('Frame 3 (Excess)');
    expect(tx3.success).toBe(false);
    expect(tx3.error).toContain('Sender window is full');
  });

  it('4. Individual ACK tracking for each outstanding frame', () => {
    sender.send('F0');
    sender.send('F1');
    sender.send('F2');

    // Acknowledge F1 before F0 is acknowledged (out of order ACK)
    const ack1 = createAckFrame({ ackNum: 1 });
    const res1 = sender.onAckReceived(ack1);

    expect(res1.accepted).toBe(true);
    // Base does NOT advance yet because F0 is still unacknowledged!
    expect(sender.getBase()).toBe(0);
    expect(res1.advanced).toBe(false);

    const slots = sender.getSlots();
    expect(slots[0].seqNum).toBe(0);
    expect(slots[0].acknowledged).toBe(false); // F0 unacknowledged
    expect(slots[1].seqNum).toBe(1);
    expect(slots[1].acknowledged).toBe(true);  // F1 individually acknowledged
    expect(slots[2].seqNum).toBe(2);
    expect(slots[2].acknowledged).toBe(false); // F2 unacknowledged
  });

  it('5. Sender-window advancement after base frame is acknowledged', () => {
    sender.send('F0');
    sender.send('F1');
    sender.send('F2');

    // Pre-acknowledge F1
    sender.onAckReceived(createAckFrame({ ackNum: 1 }));
    expect(sender.getBase()).toBe(0);

    // Now acknowledge base frame F0
    const ack0 = createAckFrame({ ackNum: 0 });
    const res0 = sender.onAckReceived(ack0);

    expect(res0.accepted).toBe(true);
    expect(res0.advanced).toBe(true);
    // Window advances past BOTH F0 and F1 because F1 was already acknowledged!
    expect(sender.getBase()).toBe(2);
    expect(sender.getOutstandingCount()).toBe(1); // Only F2 remains

    // Can now send two more frames to fill capacity
    const tx3 = sender.send('F3');
    const tx4 = sender.send('F4');
    expect(tx3.success).toBe(true);
    expect(tx4.success).toBe(true);
  });

  it('6. Sequence-number wraparound in Selective Repeat', () => {
    // Window size 2, seqNumberSpace 4 (M = 4 >= 2 * 2 = 4)
    const wrapSender = new SelectiveRepeatSender({ windowSize: 2, seqNumberSpace: 4 });
    const wrapReceiver = new SelectiveRepeatReceiver({ windowSize: 2, seqNumberSpace: 4 });

    // Send 0, 1
    const t0 = wrapSender.send('D0');
    const t1 = wrapSender.send('D1');

    // Receiver accepts 0, 1
    const r0 = wrapReceiver.onFrameReceived(t0.frame!);
    const r1 = wrapReceiver.onFrameReceived(t1.frame!);

    wrapSender.onAckReceived(r0.ackFrame!);
    wrapSender.onAckReceived(r1.ackFrame!);
    expect(wrapSender.getBase()).toBe(2);

    // Send 2, 3
    const t2 = wrapSender.send('D2');
    const t3 = wrapSender.send('D3');
    const r2 = wrapReceiver.onFrameReceived(t2.frame!);
    const r3 = wrapReceiver.onFrameReceived(t3.frame!);
    wrapSender.onAckReceived(r2.ackFrame!);
    wrapSender.onAckReceived(r3.ackFrame!);

    // Sequence numbers wrap to 0, 1
    expect(wrapSender.getNextSeqNum()).toBe(0);
    const tWrapped = wrapSender.send('DWrapped');
    expect(tWrapped.frame?.seqNum).toBe(0);

    const rWrapped = wrapReceiver.onFrameReceived(tWrapped.frame!);
    expect(rWrapped.accepted).toBe(true);
    expect(rWrapped.deliveredPayloads).toEqual(['DWrapped']);
  });

  it('7. Out-of-order frames are buffered by the receiver', () => {
    expect(receiver.getRcvBase()).toBe(0);

    // Receive F1 and F2 while expecting F0 (simulating loss of F0)
    const f1 = createDataFrame({ seqNum: 1, payload: 'Payload 1' });
    const f2 = createDataFrame({ seqNum: 2, payload: 'Payload 2' });

    const res1 = receiver.onFrameReceived(f1);
    expect(res1.accepted).toBe(true);
    expect(res1.isBuffered).toBe(true);
    expect(res1.ackFrame?.ackNum).toBe(1); // Sends individual ACK 1

    const res2 = receiver.onFrameReceived(f2);
    expect(res2.accepted).toBe(true);
    expect(res2.isBuffered).toBe(true);
    expect(res2.ackFrame?.ackNum).toBe(2); // Sends individual ACK 2

    // Neither frame should be delivered to the application yet
    expect(receiver.getDeliveredCount()).toBe(0);
    expect(receiver.getBufferedCount()).toBe(2);
    expect(receiver.getBufferedSeqNums()).toEqual([1, 2]);
    expect(receiver.getRcvBase()).toBe(0);
  });

  it('8. Buffered frames are delivered in order when the missing frame arrives', () => {
    // Buffer F1 and F2 first
    receiver.onFrameReceived(createDataFrame({ seqNum: 1, payload: 'Payload 1' }));
    receiver.onFrameReceived(createDataFrame({ seqNum: 2, payload: 'Payload 2' }));
    expect(receiver.getDeliveredCount()).toBe(0);

    // Now missing frame F0 arrives!
    const f0 = createDataFrame({ seqNum: 0, payload: 'Payload 0' });
    const res0 = receiver.onFrameReceived(f0);

    expect(res0.accepted).toBe(true);
    expect(res0.isBuffered).toBe(false);
    expect(res0.ackFrame?.ackNum).toBe(0);

    // All three payloads are cascaded and delivered in strictly sequential order
    expect(res0.deliveredPayloads).toEqual(['Payload 0', 'Payload 1', 'Payload 2']);
    expect(receiver.getDeliveredPayloads()).toEqual(['Payload 0', 'Payload 1', 'Payload 2']);
    expect(receiver.getBufferedCount()).toBe(0);
    expect(receiver.getRcvBase()).toBe(3); // Window slid to 3
  });

  it('9. Duplicate frame is not delivered twice', () => {
    const f0 = createDataFrame({ seqNum: 0, payload: 'Pristine 0' });
    receiver.onFrameReceived(f0);
    expect(receiver.getDeliveredCount()).toBe(1);

    // F0 arrives again (e.g. sender retransmitted due to delayed ACK)
    const dupRes = receiver.onFrameReceived(f0);
    expect(dupRes.isDuplicate).toBe(true);
    // Must re-ACK so sender can clear its slot
    expect(dupRes.ackFrame?.ackNum).toBe(0);

    // Payload is NOT delivered again
    expect(receiver.getDeliveredCount()).toBe(1);
    expect(receiver.getDeliveredPayloads()).toEqual(['Pristine 0']);
  });

  it('10. Each valid frame is acknowledged individually', () => {
    const f0 = createDataFrame({ seqNum: 0, payload: 'P0' });
    const f1 = createDataFrame({ seqNum: 1, payload: 'P1' });

    const rx0 = receiver.onFrameReceived(f0);
    const rx1 = receiver.onFrameReceived(f1);

    expect(rx0.ackFrame?.frameType).toBe('ACK');
    expect(rx0.ackFrame?.ackNum).toBe(0);
    expect(rx1.ackFrame?.frameType).toBe('ACK');
    expect(rx1.ackFrame?.ackNum).toBe(1);
  });

  it('11. Out-of-window frames are rejected appropriately', () => {
    // rcvBase is 0, window size is 3 -> receive window is [0, 1, 2]
    // previous window is [rcvBase - 3, rcvBase - 1] (mod 8) = [5, 6, 7]
    // Sequence number 4 is outside both [0..2] and [5..7]
    const farFrame = createDataFrame({ seqNum: 4, payload: 'Far Out' });
    const rxRes = receiver.onFrameReceived(farFrame);

    expect(rxRes.accepted).toBe(false);
    expect(rxRes.isBuffered).toBe(false);
    expect(rxRes.error).toContain('outside receive window');
    expect(receiver.getDeliveredCount()).toBe(0);
  });

  it('12. A timeout retransmits ONLY the affected unacknowledged frame', () => {
    sender.send('F0');
    sender.send('F1');
    sender.send('F2');

    // Acknowledge F0 and F2; F1 remains unacknowledged
    sender.onAckReceived(createAckFrame({ ackNum: 0 }));
    sender.onAckReceived(createAckFrame({ ackNum: 2 }));

    // Advance time past timeout
    const tickRes = sender.tick(1000);
    expect(tickRes.timedOut).toBe(true);
    expect(tickRes.retransmittedFrames.length).toBe(1);
    // In Selective Repeat, ONLY F1 is retransmitted (not F0 or F2!)
    expect(tickRes.retransmittedFrames[0].seqNum).toBe(1);

    const stats = sender.getStatistics();
    expect(stats.retransmissions).toBe(1);
  });

  it('13. Acknowledging one frame does not reset unrelated frame timers', () => {
    sender.send('F0');
    sender.send('F1');

    // Advance time by 600ms (timeout is 1000ms)
    sender.tick(600);

    const slotsBefore = sender.getSlots();
    expect(slotsBefore[0].timerElapsedMs).toBe(600);
    expect(slotsBefore[1].timerElapsedMs).toBe(600);

    // ACK F0 arriving stops F0 timer, but F1 timer must continue at 600ms
    sender.onAckReceived(createAckFrame({ ackNum: 0 }));

    const slotsAfter = sender.getSlots();
    // F0 was at base and acknowledged, so window slid; remaining slot is F1
    expect(slotsAfter[0].seqNum).toBe(1);
    expect(slotsAfter[0].timerElapsedMs).toBe(600);

    // Advance time by 400ms more -> F1 reaches 1000ms and times out
    const tickRes = sender.tick(400);
    expect(tickRes.timedOut).toBe(true);
    expect(tickRes.retransmittedFrames[0].seqNum).toBe(1);
  });

  it('14. Retry exhaustion is handled correctly and marks sender FAILED', () => {
    sender.send('Doomed F0');

    // 3 retries configured
    sender.handleTimeout(0); // Attempt 1
    sender.handleTimeout(0); // Attempt 2
    sender.handleTimeout(0); // Attempt 3

    // 4th timeout exhausts retries
    const failRes = sender.handleTimeout(0);
    expect(failRes.timedOut).toBe(true);
    expect(failRes.failed).toBe(true);
    expect(sender.getStatus()).toBe('FAILED');

    // Further send attempts are rejected
    const blocked = sender.send('Another frame');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('FAILED state');
  });

  it('15. Corrupted frames are rejected without payload delivery', () => {
    const validFrame = createDataFrame({ seqNum: 0, payload: 'Authentic Text' });
    const raw = serializeFrame(validFrame);
    const corrupted = raw.replace('Authentic Text', 'Corrupted Text');

    const rxRes = receiver.onFrameReceived(corrupted);
    expect(rxRes.accepted).toBe(false);
    expect(rxRes.error).toContain('Integrity check failed');
    expect(receiver.getDeliveredCount()).toBe(0);
  });
});

