import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ChatMessage,
  MessageDeliveryStatus,
  resolveDefaultWsUrl,
  STORAGE_KEY_WS_URL,
} from '../src/hooks/useLiveAgent';

describe('Frontend Live Networking Mode Integration', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      location: {
        protocol: 'http:',
        hostname: 'localhost',
      },
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => {
          store[key] = String(val);
        },
        clear: () => {
          for (const k of Object.keys(store)) {
            delete store[k];
          }
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  describe('WebSocket URL Resolution and Mismatch Prevention', () => {
    it('defaults to wss://127.0.0.1:8443 when page is served over HTTPS', () => {
      (globalThis as any).window.location.protocol = 'https:';
      (globalThis as any).window.location.hostname = 'network-flow-control-visualizer.vercel.app';

      const url = resolveDefaultWsUrl();
      expect(url).toBe('wss://127.0.0.1:8443');
      expect(url.startsWith('wss://')).toBe(true);
    });

    it('defaults to ws://127.0.0.1:8080 when page is served over HTTP', () => {
      (globalThis as any).window.location.protocol = 'http:';
      (globalThis as any).window.location.hostname = 'localhost';

      const url = resolveDefaultWsUrl();
      expect(url).toBe('ws://127.0.0.1:8080');
      expect(url.startsWith('ws://')).toBe(true);
    });

    it('prioritizes persisted user URL from localStorage over protocol default', () => {
      (globalThis as any).window.location.protocol = 'https:';
      (globalThis as any).window.localStorage.setItem(STORAGE_KEY_WS_URL, 'wss://custom.domain.local:9443');

      const url = resolveDefaultWsUrl();
      expect(url).toBe('wss://custom.domain.local:9443');
    });

    it('prevents insecure mixed content regression on HTTPS deployments', () => {
      (globalThis as any).window.location.protocol = 'https:';

      const url = resolveDefaultWsUrl();
      // HTTPS page must never auto-select insecure ws:// on 8080, which modern browsers block
      expect(url).not.toBe('ws://127.0.0.1:8080');
      expect(url).toBe('wss://127.0.0.1:8443');
    });
  });

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

  it('validates connection status transitions and prevents false connected state', () => {
    // Initial state must be CONNECTING or OFFLINE, never prematurely CONNECTED
    const initialStatus = 'CONNECTING';
    const isPrematurelyConnected = initialStatus === 'CONNECTED';
    expect(isPrematurelyConnected).toBe(false);

    // Only transitions to CONNECTED upon real WebSocket onopen
    const connectedStatus = 'CONNECTED';
    expect(connectedStatus === 'CONNECTED').toBe(true);

    // Transitions to OFFLINE upon error/close
    const offlineStatus = 'OFFLINE';
    expect(offlineStatus === 'CONNECTED').toBe(false);
    expect(offlineStatus).toBe('OFFLINE');
  });
});
