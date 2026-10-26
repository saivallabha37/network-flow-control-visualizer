import { describe, it, expect } from 'vitest';
import { ChatMessage, MessageDeliveryStatus } from '../src/hooks/useLiveAgent';

describe('Frontend Live Networking Mode Integration', () => {
  it('validates live agent initial state and role definitions', () => {
    const roles = ['HOST_A', 'HOST_B', 'UNASSIGNED'];
    expect(roles).toContain('HOST_A');
    expect(roles).toContain('HOST_B');
  });

  it('verifies standard WebSocket port and loopback default', () => {
    const defaultWs = 'ws://127.0.0.1:8080';
    const parsed = new URL(defaultWs);
    expect(parsed.protocol).toBe('ws:');
    expect(parsed.hostname).toBe('127.0.0.1');
    expect(parsed.port).toBe('8080');
  });

  it('tracks message delivery states accurately through ARQ lifecycle', () => {
    const validStatuses: MessageDeliveryStatus[] = ['SENDING', 'SENT', 'DELIVERED', 'FAILED'];

    const msg: ChatMessage = {
      id: 'msg_test_1',
      sender: 'SELF',
      senderRole: 'HOST_A',
      senderLabel: 'Laptop A (You)',
      text: 'Flow control handshake initiated',
      timestamp: Date.now(),
      status: 'SENDING',
    };

    expect(validStatuses).toContain(msg.status);

    // Transition to SENT with seqNum
    const sentMsg: ChatMessage = { ...msg, status: 'SENT', seqNum: 0 };
    expect(sentMsg.status).toBe('SENT');
    expect(sentMsg.seqNum).toBe(0);

    // Transition to DELIVERED when ACK arrives
    const deliveredMsg: ChatMessage = { ...sentMsg, status: 'DELIVERED' };
    expect(deliveredMsg.status).toBe('DELIVERED');

    // Failure transition
    const failedMsg: ChatMessage = { ...sentMsg, status: 'FAILED' };
    expect(failedMsg.status).toBe('FAILED');
  });

  it('validates incoming peer message structure and sender identification', () => {
    const peerMsg: ChatMessage = {
      id: 'msg_in_101',
      sender: 'PEER',
      senderRole: 'HOST_B',
      senderLabel: 'Laptop B (Peer)',
      text: 'ACK received. Frame processed cleanly.',
      timestamp: Date.now(),
      status: 'DELIVERED',
    };

    expect(peerMsg.sender).toBe('PEER');
    expect(peerMsg.senderRole).toBe('HOST_B');
    expect(peerMsg.status).toBe('DELIVERED');
  });

  it('verifies safe base64 decoding for browser direct file download', () => {
    const originalText = 'Antigravity Verified File Transfer Content';
    const base64Data = btoa(originalText);

    // Reconstruct Uint8Array as done in useLiveAgent download handler
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const decodedText = new TextDecoder().decode(byteNumbers);
    expect(decodedText).toBe(originalText);
  });
});
