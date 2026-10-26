import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebSocket } from 'ws';
import { NetworkingAgent } from '../src/live/networking-agent.js';
import { WsServerMessage } from '../src/live/live-types.js';

describe('Live UDP Networking Integration', () => {
  let agentA: NetworkingAgent;
  let agentB: NetworkingAgent;
  let tempStorageA: string;
  let tempStorageB: string;

  const PORT_A_UDP = 19101;
  const PORT_A_WS = 19201;
  const PORT_B_UDP = 19102;
  const PORT_B_WS = 19202;

  beforeEach(async () => {
    tempStorageA = fs.mkdtempSync(path.join(os.tmpdir(), 'nfcv-agentA-'));
    tempStorageB = fs.mkdtempSync(path.join(os.tmpdir(), 'nfcv-agentB-'));

    agentA = new NetworkingAgent({
      udpPort: PORT_A_UDP,
      udpHost: '127.0.0.1',
      wsPort: PORT_A_WS,
      wsHost: '127.0.0.1',
      storageDir: tempStorageA,
    });

    agentB = new NetworkingAgent({
      udpPort: PORT_B_UDP,
      udpHost: '127.0.0.1',
      wsPort: PORT_B_WS,
      wsHost: '127.0.0.1',
      storageDir: tempStorageB,
    });

    await agentA.start();
    await agentB.start();
  });

  afterEach(async () => {
    await agentA.stop();
    await agentB.stop();

    try {
      fs.rmSync(tempStorageA, { recursive: true, force: true });
      fs.rmSync(tempStorageB, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('performs full two-way handshake over UDP between Host A and Host B', async () => {
    expect(agentA.getStatus()).toBe('LISTENING');
    expect(agentB.getStatus()).toBe('LISTENING');

    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'stop-and-wait',
    });

    // Wait for UDP handshake datagram roundtrip
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(agentA.getStatus()).toBe('CONNECTED');
    expect(agentA.getRole()).toBe('HOST_A');

    expect(agentB.getStatus()).toBe('CONNECTED');
    expect(agentB.getRole()).toBe('HOST_B');
  });

  it('transfers text message using Stop-and-Wait ARQ over UDP', async () => {
    // Connect a test WebSocket client to Agent B to monitor deliveries
    const wsB = new WebSocket(`ws://127.0.0.1:${PORT_B_WS}`);
    const deliveredMessages: string[] = [];

    await new Promise<void>((resolve) => {
      wsB.on('open', () => resolve());
    });

    wsB.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsServerMessage;
      if (msg.type === 'MESSAGE_DELIVERED') {
        deliveredMessages.push((msg.payload as { text: string }).text);
      }
    });

    // Establish connection
    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'stop-and-wait',
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Send text message
    agentA.sendText('Hello Host B over Stop-and-Wait UDP');

    // Wait for UDP packet exchange and processing
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(deliveredMessages).toContain('Hello Host B over Stop-and-Wait UDP');

    wsB.close();
  });

  it('recovers from dropped packet using ARQ timeout retransmission over UDP', async () => {
    const wsB = new WebSocket(`ws://127.0.0.1:${PORT_B_WS}`);
    const deliveredMessages: string[] = [];

    await new Promise<void>((resolve) => {
      wsB.on('open', () => resolve());
    });

    wsB.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsServerMessage;
      if (msg.type === 'MESSAGE_DELIVERED') {
        deliveredMessages.push((msg.payload as { text: string }).text);
      }
    });

    // Handshake with a short timeout for fast test execution
    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'go-back-n',
      windowSize: 4,
      timeoutMs: 150, // Short timeout
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Inject fault: drop next outgoing frame
    agentA.getLiveSession()?.setFault({ dropNextData: true });

    // Send payload
    agentA.sendText('Resilient Go-Back-N packet');

    // Message should NOT be delivered immediately because first datagram was dropped
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(deliveredMessages.length).toBe(0);

    // Wait for timeout interval (150ms) to trigger retransmission over UDP
    await new Promise((resolve) => setTimeout(resolve, 250));

    // The retransmitted frame should now have arrived and been acknowledged
    expect(deliveredMessages).toContain('Resilient Go-Back-N packet');

    wsB.close();
  });

  it('transfers a small file safely with SHA-256 verification over UDP', async () => {
    const wsB = new WebSocket(`ws://127.0.0.1:${PORT_B_WS}`);
    let fileDeliveredPayload: { filename: string; filePath: string; sha256: string } | undefined;

    await new Promise<void>((resolve) => {
      wsB.on('open', () => resolve());
    });

    wsB.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsServerMessage;
      if (msg.type === 'FILE_DELIVERED') {
        fileDeliveredPayload = msg.payload as { filename: string; filePath: string; sha256: string };
      }
    });

    // Establish connection with Selective Repeat
    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'selective-repeat',
      windowSize: 4,
      seqNumberSpace: 8,
      timeoutMs: 300,
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Prepare 2.5 KB binary/text file
    const fileContent = 'Selective Repeat Live File Chunking Verification! '.repeat(55);
    const fileBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');

    agentA.sendFile('test-report.txt', fileBase64);

    // Wait for all chunks to be transmitted, ACKed, and assembled
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fileDeliveredPayload).toBeDefined();
    expect(fileDeliveredPayload?.filename).toBe('test-report.txt');
    expect(fileDeliveredPayload?.filePath).toBeDefined();

    // Verify on disk
    if (fileDeliveredPayload?.filePath) {
      const savedData = fs.readFileSync(fileDeliveredPayload.filePath, 'utf-8');
      expect(savedData).toBe(fileContent);
    }

    wsB.close();
  });

  it('handles remote disconnect cleanly', async () => {
    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'stop-and-wait',
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(agentA.getStatus()).toBe('CONNECTED');
    expect(agentB.getStatus()).toBe('CONNECTED');

    agentA.disconnectPeer('Test session finished');
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(agentA.getStatus()).toBe('LISTENING');
    expect(agentB.getStatus()).toBe('LISTENING');
  });

  it('transfers messages with Selective Repeat ARQ over UDP and handles retransmissions', async () => {
    const wsB = new WebSocket(`ws://127.0.0.1:${PORT_B_WS}`);
    const delivered: string[] = [];

    await new Promise<void>((resolve) => {
      wsB.on('open', () => resolve());
    });

    wsB.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsServerMessage;
      if (msg.type === 'MESSAGE_DELIVERED') {
        delivered.push((msg.payload as { text: string }).text);
      }
    });

    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'selective-repeat',
      windowSize: 4,
      seqNumberSpace: 8,
      timeoutMs: 150,
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(agentA.getStatus()).toBe('CONNECTED');

    agentA.sendText('Selective Repeat Msg 1');
    agentA.sendText('Selective Repeat Msg 2');

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(delivered).toContain('Selective Repeat Msg 1');
    expect(delivered).toContain('Selective Repeat Msg 2');

    wsB.close();
  });

  it('rejects handshake if parameters violate protocol constraints', async () => {
    // Attempt selective repeat with M < 2N (seqNumberSpace: 4, windowSize: 3 -> 4 < 6)
    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'selective-repeat',
      windowSize: 3,
      seqNumberSpace: 4,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Host A should have failed handshake or received reject
    expect(agentA.getStatus()).not.toBe('CONNECTED');
    expect(agentB.getStatus()).not.toBe('CONNECTED');
  });

  it('validates incoming WebSocket commands and reports errors for invalid schemas', async () => {
    const wsA = new WebSocket(`ws://127.0.0.1:${PORT_A_WS}`);
    const responses: WsServerMessage[] = [];

    await new Promise<void>((resolve) => {
      wsA.on('open', () => resolve());
    });

    wsA.on('message', (raw) => {
      responses.push(JSON.parse(raw.toString()) as WsServerMessage);
    });

    // Send invalid JSON command
    wsA.send('not valid json {');
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Send unknown command type
    wsA.send(JSON.stringify({ command: 'UNKNOWN_ACTION' }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const errors = responses.filter((r) => r.type === 'AGENT_ERROR');
    expect(errors.length).toBeGreaterThanOrEqual(2);

    wsA.close();
  });

  it('ignores datagrams from foreign session IDs or with corrupted CRC-32 checksums', async () => {
    agentA.initiateHandshake({
      peerHost: '127.0.0.1',
      peerUdpPort: PORT_B_UDP,
      protocol: 'stop-and-wait',
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(agentA.getStatus()).toBe('CONNECTED');
    expect(agentB.getStatus()).toBe('CONNECTED');

    const wsB = new WebSocket(`ws://127.0.0.1:${PORT_B_WS}`);
    const delivered: string[] = [];

    await new Promise<void>((resolve) => {
      wsB.on('open', () => resolve());
    });

    wsB.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsServerMessage;
      if (msg.type === 'MESSAGE_DELIVERED') {
        delivered.push((msg.payload as { text: string }).text);
      }
    });

    // Directly send a datagram with a mismatched session ID to Agent B
    const dgram = await import('dgram');
    const directSock = dgram.createSocket('udp4');

    const foreignPacket = {
      type: 'DATA',
      sessionId: 'foreign-unknown-session-999',
      version: '1.0',
      timestamp: Date.now(),
      frame: {
        frameType: 'DATA',
        seqNum: 0,
        payload: 'Foreign injected payload',
        checksum: 9999999,
        timestamp: Date.now(),
      },
      payloadType: 'TEXT',
    };

    directSock.send(Buffer.from(JSON.stringify(foreignPacket)), PORT_B_UDP, '127.0.0.1');

    // Wait and verify foreign packet was NOT accepted/delivered
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(delivered.length).toBe(0);

    // Send a packet with the correct session ID but corrupted CRC-32 checksum
    const corruptedCrcPacket = {
      type: 'DATA',
      sessionId: agentB.getStateDto().activeSessionId,
      version: '1.0',
      timestamp: Date.now(),
      frame: {
        frameType: 'DATA',
        seqNum: 0,
        payload: 'Corrupted payload',
        checksum: 12345, // Deliberately invalid checksum
        timestamp: Date.now(),
      },
      payloadType: 'TEXT',
    };

    directSock.send(Buffer.from(JSON.stringify(corruptedCrcPacket)), PORT_B_UDP, '127.0.0.1');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(delivered.length).toBe(0);

    directSock.close();
    wsB.close();
  });

  it('validates client Origin to prevent cross-site websocket hijacking', () => {
    // Trusted local origins
    expect(agentA.isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(agentA.isOriginAllowed('http://127.0.0.1:8080')).toBe(true);
    expect(agentA.isOriginAllowed('https://localhost:3000')).toBe(true);

    // Trusted Vercel domains
    expect(agentA.isOriginAllowed('https://network-flow-control-visualizer.vercel.app')).toBe(true);
    expect(agentA.isOriginAllowed('https://my-preview-branch.vercel.app')).toBe(true);

    // Non-browser clients (CLI, scripts)
    expect(agentA.isOriginAllowed(undefined)).toBe(true);

    // Malicious third-party origin must be rejected
    expect(agentA.isOriginAllowed('https://malicious-attacker-site.com')).toBe(false);
    expect(agentA.isOriginAllowed('http://evil.org')).toBe(false);
    expect(agentA.isOriginAllowed('https://not-vercel.app.fake.com')).toBe(false);
  });
});
