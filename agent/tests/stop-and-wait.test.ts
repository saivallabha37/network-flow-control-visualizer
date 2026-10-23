import { describe, it, expect, beforeEach } from 'vitest';
import {
  StopAndWaitSender,
  StopAndWaitReceiver,
  createAckFrame,
  createDataFrame,
  serializeFrame,
} from '../src/index.js';

describe('Stop-and-Wait ARQ Protocol State Machine Tests', () => {
  let sender: StopAndWaitSender;
  let receiver: StopAndWaitReceiver;

  beforeEach(() => {
    sender = new StopAndWaitSender({ timeoutMs: 1000, maxRetries: 3 });
    receiver = new StopAndWaitReceiver();
  });

  it('TC-4: Initial frame transmission state and event transitions', () => {
    expect(sender.getStatus()).toBe('IDLE');
    expect(sender.getCurrentSeqNum()).toBe(0);
    expect(sender.getOutstandingFrame()).toBeNull();

    const sendResult = sender.send('First Payload Block');
    expect(sendResult.success).toBe(true);
    expect(sendResult.frame).toBeDefined();

    expect(sender.getStatus()).toBe('AWAITING_ACK');
    expect(sender.getCurrentSeqNum()).toBe(0);
    expect(sender.getCurrentAttempt()).toBe(1);

    const outstanding = sender.getOutstandingFrame();
    expect(outstanding).not.toBeNull();
    expect(outstanding?.seqNum).toBe(0);
    expect(outstanding?.payload).toBe('First Payload Block');

    const events = sender.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('FRAME_SENT');
    expect(events[0].details.seqNum).toBe(0);
    expect(events[0].details.attempt).toBe(1);

    // Cannot send another frame while awaiting ACK
    const secondSend = sender.send('Blocked Payload');
    expect(secondSend.success).toBe(false);
    expect(secondSend.error).toContain('awaiting acknowledgement');
  });

  it('TC-5: Valid ACK handling and sequence-number advancement', () => {
    sender.send('Block 0');
    expect(sender.getCurrentSeqNum()).toBe(0);

    // Valid ACK for frame 0
    const ack0 = createAckFrame({ ackNum: 0 });
    const ackResult = sender.onAckReceived(ack0);

    expect(ackResult.accepted).toBe(true);
    expect(ackResult.advanced).toBe(true);
    expect(sender.getStatus()).toBe('IDLE');
    expect(sender.getOutstandingFrame()).toBeNull();
    // Alternating bit advanced to 1
    expect(sender.getCurrentSeqNum()).toBe(1);

    const events = sender.getEvents();
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('FRAME_SENT');
    expect(eventTypes).toContain('ACK_RECEIVED');
    expect(eventTypes).toContain('TRANSMISSION_COMPLETED');

    const stats = sender.getStatistics();
    expect(stats.framesSent).toBe(1);
    expect(stats.framesAcknowledged).toBe(1);

    // Now send frame 1
    const send1Result = sender.send('Block 1');
    expect(send1Result.success).toBe(true);
    expect(send1Result.frame?.seqNum).toBe(1);
    expect(sender.getCurrentSeqNum()).toBe(1);

    // ACK 1 advances sequence number back to 0
    const ack1 = createAckFrame({ ackNum: 1 });
    const ack1Result = sender.onAckReceived(ack1);
    expect(ack1Result.accepted).toBe(true);
    expect(sender.getCurrentSeqNum()).toBe(0);
  });

  it('TC-6: Incorrect or stale ACK rejection', () => {
    sender.send('Block 0');
    expect(sender.getCurrentSeqNum()).toBe(0);

    // Stale ACK with ackNum = 1
    const staleAck = createAckFrame({ ackNum: 1 });
    const ackResult = sender.onAckReceived(staleAck);

    expect(ackResult.accepted).toBe(false);
    expect(ackResult.advanced).toBe(false);
    expect(ackResult.reason).toContain('Mismatched ACK');

    // Sender state must not change
    expect(sender.getStatus()).toBe('AWAITING_ACK');
    expect(sender.getCurrentSeqNum()).toBe(0);
    expect(sender.getOutstandingFrame()).not.toBeNull();

    const events = sender.getEvents();
    expect(events.some((e) => e.type === 'FRAME_REJECTED')).toBe(true);
  });

  it('TC-7: Receiver accepts valid frame and delivers payload exactly once', () => {
    expect(receiver.getExpectedSeqNum()).toBe(0);
    expect(receiver.getDeliveredCount()).toBe(0);

    const frame0 = createDataFrame({ seqNum: 0, payload: 'Alpha Payload' });
    const rxResult = receiver.onFrameReceived(frame0);

    expect(rxResult.accepted).toBe(true);
    expect(rxResult.isDuplicate).toBe(false);
    expect(rxResult.deliveredPayload).toBe('Alpha Payload');
    expect(rxResult.ackFrame?.ackNum).toBe(0);

    // Receiver delivered payload and advanced expected sequence to 1
    expect(receiver.getDeliveredPayloads()).toEqual(['Alpha Payload']);
    expect(receiver.getExpectedSeqNum()).toBe(1);

    const events = receiver.getEvents();
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('FRAME_RECEIVED');
    expect(eventTypes).toContain('PAYLOAD_DELIVERED');
    expect(eventTypes).toContain('ACK_SENT');
  });

  it('TC-8: Duplicate frame detection and re-acknowledgement without redelivery', () => {
    const frame0 = createDataFrame({ seqNum: 0, payload: 'Unique Payload Data' });

    // Initial receipt of frame 0
    const firstReceipt = receiver.onFrameReceived(frame0);
    expect(firstReceipt.accepted).toBe(true);
    expect(receiver.getDeliveredPayloads()).toEqual(['Unique Payload Data']);
    expect(receiver.getExpectedSeqNum()).toBe(1);

    // Duplicate receipt (simulates scenario where receiver ACK was lost in network)
    const duplicateReceipt = receiver.onFrameReceived(frame0);

    expect(duplicateReceipt.accepted).toBe(false);
    expect(duplicateReceipt.isDuplicate).toBe(true);
    expect(duplicateReceipt.ackFrame).toBeDefined();
    // Must re-acknowledge frame 0 so sender can advance
    expect(duplicateReceipt.ackFrame?.ackNum).toBe(0);

    // CRITICAL: Payload must NOT be delivered a second time
    expect(receiver.getDeliveredPayloads()).toEqual(['Unique Payload Data']);
    expect(receiver.getDeliveredCount()).toBe(1);
    // Expected sequence number must still remain 1
    expect(receiver.getExpectedSeqNum()).toBe(1);

    const events = receiver.getEvents();
    expect(events.some((e) => e.type === 'DUPLICATE_FRAME_DETECTED')).toBe(true);
  });

  it('TC-9: Lost ACK followed by deterministic timeout and retransmission', () => {
    const sendResult = sender.send('Block requiring retry');
    const sentFrame = sendResult.frame!;
    expect(sender.getCurrentAttempt()).toBe(1);

    // Advance time by 500ms (timeout configured to 1000ms)
    const tick1 = sender.tick(500);
    expect(tick1.timedOut).toBe(false);
    expect(sender.getCurrentAttempt()).toBe(1);

    // Advance time by another 500ms (total 1000ms -> timeout expires)
    const tick2 = sender.tick(500);
    expect(tick2.timedOut).toBe(true);
    expect(tick2.failed).toBe(false);
    expect(tick2.retransmittedFrame).toBeDefined();
    expect(tick2.retransmittedFrame?.seqNum).toBe(sentFrame.seqNum);
    expect(sender.getCurrentAttempt()).toBe(2);
    expect(sender.getRetransmissionCount()).toBe(1);

    const events = sender.getEvents();
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('TIMEOUT');
    expect(eventTypes).toContain('RETRANSMISSION');

    const stats = sender.getStatistics();
    expect(stats.timeouts).toBe(1);
    expect(stats.retransmissions).toBe(1);
    expect(stats.framesSent).toBe(2); // Initial send + retransmission
  });

  it('TC-10: Successful completion after a retransmitted frame is acknowledged', () => {
    // 1. Sender sends frame 0
    const sendResult = sender.send('Data Payload');
    const frame0 = sendResult.frame!;

    // 2. Receiver accepts frame 0 and produces ACK 0
    const rxResult = receiver.onFrameReceived(frame0);
    const lostAck = rxResult.ackFrame!;

    // 3. Simulate ACK 0 being lost in network: sender times out
    const timeoutResult = sender.handleTimeout();
    expect(timeoutResult.timedOut).toBe(true);
    expect(timeoutResult.retransmittedFrame).toBeDefined();

    // 4. Receiver receives retransmitted frame 0 (duplicate), does not redeliver, resends ACK 0
    const dupResult = receiver.onFrameReceived(timeoutResult.retransmittedFrame!);
    expect(dupResult.isDuplicate).toBe(true);
    expect(dupResult.ackFrame?.ackNum).toBe(0);
    expect(receiver.getDeliveredCount()).toBe(1);

    // 5. Recovered ACK 0 reaches sender
    const ackResult = sender.onAckReceived(dupResult.ackFrame!);
    expect(ackResult.accepted).toBe(true);
    expect(ackResult.advanced).toBe(true);
    expect(sender.getStatus()).toBe('IDLE');
    expect(sender.getCurrentSeqNum()).toBe(1);
  });

  it('TC-11: Retry-limit exhaustion transitions sender to FAILED state', () => {
    // maxRetries configured to 3 attempts total
    sender.send('Data doomed to fail');
    expect(sender.getCurrentAttempt()).toBe(1);

    // Attempt 1 -> 2 (retransmit 1)
    const timeout1 = sender.handleTimeout();
    expect(timeout1.failed).toBe(false);
    expect(sender.getCurrentAttempt()).toBe(2);

    // Attempt 2 -> 3 (retransmit 2)
    const timeout2 = sender.handleTimeout();
    expect(timeout2.failed).toBe(false);
    expect(sender.getCurrentAttempt()).toBe(3);

    // Attempt 3 -> exhausted!
    const timeout3 = sender.handleTimeout();
    expect(timeout3.timedOut).toBe(true);
    expect(timeout3.failed).toBe(true);
    expect(sender.getStatus()).toBe('FAILED');

    const events = sender.getEvents();
    expect(events.some((e) => e.type === 'TRANSMISSION_FAILED')).toBe(true);

    // Cannot send further frames while in FAILED state
    const blockedSend = sender.send('Another block');
    expect(blockedSend.success).toBe(false);
  });

  it('TC-12: Receiver rejects a corrupted frame without delivering payload', () => {
    const validFrame = createDataFrame({ seqNum: 0, payload: 'Original Untampered Text' });
    const serialized = serializeFrame(validFrame);

    // Simulate bit error in the serialized JSON string payload
    const corruptedRaw = serialized.replace('Original Untampered Text', 'Corrupted Text In Transit');

    const rxResult = receiver.onFrameReceived(corruptedRaw);
    expect(rxResult.accepted).toBe(false);
    expect(rxResult.error).toContain('Integrity check failed');
    expect(rxResult.ackFrame).toBeUndefined();

    // Receiver must NOT deliver anything and must NOT advance sequence
    expect(receiver.getDeliveredCount()).toBe(0);
    expect(receiver.getExpectedSeqNum()).toBe(0);

    const events = receiver.getEvents();
    expect(events.some((e) => e.type === 'FRAME_REJECTED')).toBe(true);
  });

  it('End-to-End alternating-bit multi-frame exchange', () => {
    const messages = ['Message chunk #0', 'Message chunk #1', 'Message chunk #2', 'Message chunk #3'];

    for (let i = 0; i < messages.length; i++) {
      const expectedSeq = (i % 2) as 0 | 1;
      expect(sender.getCurrentSeqNum()).toBe(expectedSeq);
      expect(receiver.getExpectedSeqNum()).toBe(expectedSeq);

      // Sender sends
      const tx = sender.send(messages[i]);
      expect(tx.success).toBe(true);

      // Receiver receives serialized string (simulating transmission)
      const wireData = serializeFrame(tx.frame!);
      const rx = receiver.onFrameReceived(wireData);
      expect(rx.accepted).toBe(true);

      // Sender receives serialized ACK
      const wireAck = serializeFrame(rx.ackFrame!);
      const ackStatus = sender.onAckReceived(wireAck);
      expect(ackStatus.accepted).toBe(true);
      expect(ackStatus.advanced).toBe(true);
    }

    expect(receiver.getDeliveredPayloads()).toEqual(messages);
    expect(sender.getStatistics().framesAcknowledged).toBe(4);
    expect(sender.getStatus()).toBe('IDLE');
  });
});

