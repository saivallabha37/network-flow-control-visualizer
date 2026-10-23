import * as dgram from 'dgram';
import { WebSocket, WebSocketServer } from 'ws';
import {
  LiveAgentStateDto,
  LiveAgentStatus,
  LiveRole,
  LiveTelemetryEvent,
  UdpPacket,
  WsClientCommand,
  WsServerMessage,
  HandshakeInitPacket,
  HandshakeAckPacket,
  HandshakeRejectPacket,
  DisconnectPacket,
  FileHeaderPacket,
} from './live-types.js';
import { deserializeUdpPacket, serializeUdpPacket } from './udp-codec.js';
import { LiveSession } from './live-session.js';
import { FileChunkPayload, FileTransferManager } from './file-transfer.js';
import { ProtocolStatistics, ProtocolType } from '../types/protocol.js';

export interface NetworkingAgentConfig {
  udpPort?: number;
  udpHost?: string;
  wsPort?: number;
  wsHost?: string;
  storageDir?: string;
}

export class NetworkingAgent {
  private status: LiveAgentStatus = 'IDLE';
  private role: LiveRole = 'UNASSIGNED';

  private udpSocket?: dgram.Socket;
  private wsServer?: WebSocketServer;
  private connectedWsClients = new Set<WebSocket>();

  private localUdpPort: number;
  private localUdpHost: string;
  private wsPort: number;
  private wsHost: string;

  private peerHost?: string;
  private peerUdpPort?: number;
  private activeSessionId?: string;
  private activeProtocol?: ProtocolType;
  private activeWindowSize?: number;
  private activeSeqNumberSpace?: number;

  private liveSession?: LiveSession;
  private fileManager: FileTransferManager;
  private lastError?: string;

  // Handshake retry timer
  private handshakeTimer?: NodeJS.Timeout;
  private handshakeAttempts: number = 0;
  private readonly maxHandshakeRetries = 3;
  private readonly handshakeTimeoutMs = 1500;

  constructor(config?: NetworkingAgentConfig) {
    this.localUdpPort = config?.udpPort ?? 9000;
    this.localUdpHost = config?.udpHost ?? '0.0.0.0';
    this.wsPort = config?.wsPort ?? 8080;
    this.wsHost = config?.wsHost ?? '127.0.0.1'; // Binds strictly to loopback by default for security
    this.fileManager = new FileTransferManager(config?.storageDir);
  }

  /**
   * Initializes both the local WebSocket server for browser UI connections
   * and the UDP socket for peer communication.
   */
  public async start(): Promise<void> {
    await this.startWsServer();
    await this.startUdpListener(this.localUdpPort, this.localUdpHost);
  }

  /**
   * Shuts down both UDP and WebSocket servers cleanly and cleans up resources.
   */
  public async stop(): Promise<void> {
    this.clearHandshakeTimer();

    if (this.liveSession) {
      this.liveSession.stop();
      this.liveSession = undefined;
    }

    this.fileManager.cancelAllTransfers();

    if (this.udpSocket) {
      await new Promise<void>((resolve) => {
        try {
          this.udpSocket?.close(() => resolve());
        } catch {
          resolve();
        }
      });
      this.udpSocket = undefined;
    }

    if (this.wsServer) {
      for (const client of this.connectedWsClients) {
        try {
          client.close();
        } catch {
          // ignore
        }
      }
      this.connectedWsClients.clear();

      await new Promise<void>((resolve) => {
        try {
          this.wsServer?.close(() => resolve());
        } catch {
          resolve();
        }
      });
      this.wsServer = undefined;
    }

    this.status = 'DISCONNECTED';
    this.broadcastStatusUpdate();
  }

  // ================= WebSocket Server Handling =================

  public async startWsServer(): Promise<void> {
    if (this.wsServer) return;

    return new Promise((resolve, reject) => {
      try {
        const server = new WebSocketServer({
          port: this.wsPort,
          host: this.wsHost,
        });

        server.on('listening', () => {
          this.wsServer = server;
          resolve();
        });

        server.on('error', (err) => {
          this.lastError = `WS Server Error: ${err.message}`;
          reject(err);
        });

        server.on('connection', (ws) => {
          this.connectedWsClients.add(ws);

          // Push immediate state to newly connected frontend
          this.sendWsMessage(ws, {
            type: 'AGENT_STATUS_UPDATE',
            payload: { state: this.getStateDto() },
            timestamp: Date.now(),
          });

          ws.on('message', (data) => {
            this.handleWsCommand(data.toString());
          });

          ws.on('close', () => {
            this.connectedWsClients.delete(ws);
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleWsCommand(rawMessage: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      this.sendErrorToClients('Invalid JSON command format received from WebSocket client');
      return;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      this.sendErrorToClients('WebSocket command must be a JSON object');
      return;
    }

    const obj = parsed as Record<string, unknown>;
    const command = obj.command;

    if (typeof command !== 'string') {
      this.sendErrorToClients('Missing command property in WebSocket message');
      return;
    }

    switch (command) {
      case 'GET_STATUS':
        this.broadcastStatusUpdate();
        break;

      case 'START_LISTENER': {
        const port = Number(obj.udpPort);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          this.sendErrorToClients(`START_LISTENER: Invalid udpPort ${obj.udpPort}`);
          return;
        }
        const host = typeof obj.udpHost === 'string' && obj.udpHost ? obj.udpHost : '0.0.0.0';
        this.startUdpListener(port, host).catch((err) => {
          this.sendErrorToClients(`Failed to start UDP listener: ${err.message}`);
        });
        break;
      }

      case 'STOP_LISTENER':
        this.stopUdpListener();
        break;

      case 'CONNECT_PEER': {
        if (typeof obj.peerHost !== 'string' || !obj.peerHost.trim()) {
          this.sendErrorToClients('CONNECT_PEER: Missing or invalid peerHost');
          return;
        }
        const port = Number(obj.peerUdpPort);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          this.sendErrorToClients(`CONNECT_PEER: Invalid peerUdpPort ${obj.peerUdpPort}`);
          return;
        }
        const validProtos: ProtocolType[] = ['stop-and-wait', 'go-back-n', 'selective-repeat'];
        if (typeof obj.protocol !== 'string' || !validProtos.includes(obj.protocol as ProtocolType)) {
          this.sendErrorToClients(`CONNECT_PEER: Invalid protocol ${obj.protocol}`);
          return;
        }
        const winSize = obj.windowSize !== undefined ? Number(obj.windowSize) : undefined;
        if (winSize !== undefined && (!Number.isInteger(winSize) || winSize < 1)) {
          this.sendErrorToClients(`CONNECT_PEER: Invalid windowSize ${obj.windowSize}`);
          return;
        }

        this.initiateHandshake({
          peerHost: obj.peerHost.trim(),
          peerUdpPort: port,
          protocol: obj.protocol as ProtocolType,
          windowSize: winSize,
          seqNumberSpace: obj.seqNumberSpace !== undefined ? Number(obj.seqNumberSpace) : undefined,
          timeoutMs: obj.timeoutMs !== undefined ? Number(obj.timeoutMs) : undefined,
          maxRetries: obj.maxRetries !== undefined ? Number(obj.maxRetries) : undefined,
        });
        break;
      }

      case 'DISCONNECT_PEER':
        this.disconnectPeer(typeof obj.reason === 'string' ? obj.reason : 'User requested disconnect');
        break;

      case 'SEND_TEXT': {
        if (typeof obj.text !== 'string' || obj.text.length === 0) {
          this.sendErrorToClients('SEND_TEXT: Text payload must be a non-empty string');
          return;
        }
        this.sendText(obj.text);
        break;
      }

      case 'SEND_FILE': {
        if (typeof obj.filename !== 'string' || !obj.filename.trim()) {
          this.sendErrorToClients('SEND_FILE: Missing or invalid filename');
          return;
        }
        if (typeof obj.fileBase64 !== 'string' || !obj.fileBase64) {
          this.sendErrorToClients('SEND_FILE: Missing or invalid fileBase64 data');
          return;
        }
        this.sendFile(obj.filename.trim(), obj.fileBase64);
        break;
      }

      case 'SET_TEST_FAULT': {
        if (this.liveSession) {
          this.liveSession.setFault({
            dropNextData: typeof obj.dropNextData === 'boolean' ? obj.dropNextData : undefined,
            dropNextAck: typeof obj.dropNextAck === 'boolean' ? obj.dropNextAck : undefined,
          });
        }
        break;
      }

      default:
        this.sendErrorToClients(`Unknown WebSocket command: ${command}`);
        break;
    }
  }

  private broadcastWsMessage(msg: WsServerMessage): void {
    const serialized = JSON.stringify(msg);
    for (const ws of this.connectedWsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }

  private sendWsMessage(ws: WebSocket, msg: WsServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastStatusUpdate(): void {
    this.broadcastWsMessage({
      type: 'AGENT_STATUS_UPDATE',
      payload: { state: this.getStateDto() },
      timestamp: Date.now(),
    });
  }

  private sendErrorToClients(message: string): void {
    this.lastError = message;
    this.broadcastWsMessage({
      type: 'AGENT_ERROR',
      payload: { error: message },
      timestamp: Date.now(),
    });
  }

  // ================= UDP Transport Handling =================

  public async startUdpListener(port: number, host: string = '0.0.0.0'): Promise<void> {
    if (this.udpSocket) {
      await this.stopUdpListener();
    }

    return new Promise((resolve, reject) => {
      try {
        const socket = dgram.createSocket('udp4');

        socket.on('error', (err) => {
          this.status = 'ERROR';
          this.lastError = `UDP Socket error: ${err.message}`;
          this.broadcastStatusUpdate();
          reject(err);
        });

        socket.on('message', (msg, rinfo) => {
          this.handleIncomingUdpDatagram(msg, rinfo);
        });

        socket.on('listening', () => {
          const addr = socket.address();
          this.localUdpPort = addr.port;
          this.localUdpHost = addr.address;
          this.status = 'LISTENING';
          this.udpSocket = socket;
          this.broadcastStatusUpdate();
          resolve();
        });

        socket.bind(port, host);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async stopUdpListener(): Promise<void> {
    this.clearHandshakeTimer();

    if (!this.udpSocket) return;

    if (this.liveSession) {
      this.liveSession.stop();
      this.liveSession = undefined;
    }

    await new Promise<void>((resolve) => {
      try {
        this.udpSocket?.close(() => resolve());
      } catch {
        resolve();
      }
    });

    this.udpSocket = undefined;
    this.status = 'IDLE';
    this.role = 'UNASSIGNED';
    this.broadcastStatusUpdate();
  }

  private sendUdpDatagram(packet: UdpPacket, host?: string, port?: number): void {
    const targetHost = host ?? this.peerHost;
    const targetPort = port ?? this.peerUdpPort;

    if (!this.udpSocket) {
      this.sendErrorToClients('Cannot send datagram: UDP socket is not initialized');
      return;
    }

    if (!targetHost || !targetPort) {
      this.sendErrorToClients('Cannot send datagram: No destination peer configured');
      return;
    }

    const buffer = serializeUdpPacket(packet);
    this.udpSocket.send(buffer, targetPort, targetHost, (err) => {
      if (err) {
        this.sendErrorToClients(`UDP send error: ${err.message}`);
      }
    });
  }

  // ================= UDP Packet Dispatcher =================

  private handleIncomingUdpDatagram(raw: Buffer, rinfo: dgram.RemoteInfo): void {
    const cleanAddress = rinfo.address.replace(/^::ffff:/, '');

    const decodeResult = deserializeUdpPacket(raw);
    if (!decodeResult.success) {
      this.sendErrorToClients(`Received malformed UDP packet from ${cleanAddress}:${rinfo.port}: ${decodeResult.error}`);
      return;
    }

    const packet = decodeResult.packet;
    const normalizedRinfo = { ...rinfo, address: cleanAddress };

    switch (packet.type) {
      case 'HANDSHAKE_INIT':
        this.handleHandshakeInit(packet as HandshakeInitPacket, normalizedRinfo);
        break;

      case 'HANDSHAKE_ACK':
        this.handleHandshakeAck(packet as HandshakeAckPacket, normalizedRinfo);
        break;

      case 'HANDSHAKE_REJECT':
        this.handleHandshakeReject(packet as HandshakeRejectPacket);
        break;

      case 'DISCONNECT':
        this.handleRemoteDisconnect(packet as DisconnectPacket);
        break;

      case 'FILE_HEADER':
        this.handleFileHeader(packet as FileHeaderPacket);
        break;

      case 'DATA':
      case 'ACK':
        if (this.liveSession && packet.sessionId === this.activeSessionId) {
          this.liveSession.handleIncomingUdpPacket(packet);
        }
        break;

      default:
        break;
    }
  }

  // ================= Peer Handshake Protocol =================

  public initiateHandshake(options: {
    peerHost: string;
    peerUdpPort: number;
    protocol: ProtocolType;
    windowSize?: number;
    seqNumberSpace?: number;
    timeoutMs?: number;
    maxRetries?: number;
  }): void {
    if (this.status === 'CONNECTED' || this.status === 'TRANSFERRING') {
      this.sendErrorToClients('Cannot initiate connection: already connected to a peer');
      return;
    }

    this.clearHandshakeTimer();

    this.peerHost = options.peerHost;
    this.peerUdpPort = options.peerUdpPort;
    this.activeProtocol = options.protocol;

    const windowSize =
      options.protocol === 'stop-and-wait'
        ? 1
        : options.windowSize ?? 4;

    const seqNumberSpace =
      options.protocol === 'stop-and-wait'
        ? 2
        : options.seqNumberSpace ?? (options.protocol === 'selective-repeat' ? Math.max(8, windowSize * 2) : 8);

    this.activeWindowSize = windowSize;
    this.activeSeqNumberSpace = seqNumberSpace;
    this.activeSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.role = 'HOST_A';
    this.status = 'CONNECTING';
    this.handshakeAttempts = 1;

    // Construct local session
    try {
      this.liveSession = new LiveSession({
        sessionId: this.activeSessionId,
        protocol: options.protocol,
        windowSize,
        seqNumberSpace,
        timeoutMs: options.timeoutMs ?? 1000,
        maxRetries: options.maxRetries ?? 4,
        onPacketToSend: (pkt) => this.sendUdpDatagram(pkt),
        onTelemetry: (evt) => this.handleTelemetryEvent(evt),
        onPayloadDelivered: (p, type, txId) => this.handlePayloadDelivered(p, type, txId),
        onError: (err) => this.sendErrorToClients(err),
        onStatsUpdate: () => this.broadcastStatusUpdate(),
      });
    } catch (err) {
      this.status = 'ERROR';
      const msg = err instanceof Error ? err.message : String(err);
      this.sendErrorToClients(`Failed to initialize session: ${msg}`);
      this.broadcastStatusUpdate();
      return;
    }

    const initPacket: HandshakeInitPacket = {
      type: 'HANDSHAKE_INIT',
      sessionId: this.activeSessionId,
      version: '1.0',
      timestamp: Date.now(),
      protocol: options.protocol,
      windowSize,
      seqNumberSpace,
      maxPayloadSize: 1024,
      role: 'HOST_A',
      agentVersion: '0.1.0',
    };

    this.sendUdpDatagram(initPacket);
    this.broadcastStatusUpdate();

    // Start handshake retry timer
    this.scheduleHandshakeRetry(initPacket);
  }

  private scheduleHandshakeRetry(initPacket: HandshakeInitPacket): void {
    this.handshakeTimer = setTimeout(() => {
      if (this.status !== 'CONNECTING') return;

      if (this.handshakeAttempts < this.maxHandshakeRetries) {
        this.handshakeAttempts += 1;
        this.sendUdpDatagram(initPacket);
        this.scheduleHandshakeRetry(initPacket);
      } else {
        // Retry exhaustion for handshake
        this.status = 'ERROR';
        this.lastError = `Peer connection timed out: No response from ${this.peerHost}:${this.peerUdpPort} after ${this.maxHandshakeRetries} attempts`;
        if (this.liveSession) {
          this.liveSession.stop();
          this.liveSession = undefined;
        }
        this.broadcastWsMessage({
          type: 'PEER_HANDSHAKE_FAILED',
          payload: { reason: this.lastError },
          timestamp: Date.now(),
        });
        this.broadcastStatusUpdate();
      }
    }, this.handshakeTimeoutMs);
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = undefined;
    }
  }

  private handleHandshakeInit(packet: HandshakeInitPacket, rinfo: dgram.RemoteInfo): void {
    // If we receive a retransmitted HANDSHAKE_INIT for the currently established session, re-send HANDSHAKE_ACK
    if (
      (this.status === 'CONNECTED' || this.status === 'TRANSFERRING') &&
      this.activeSessionId === packet.sessionId
    ) {
      const ackPacket: HandshakeAckPacket = {
        type: 'HANDSHAKE_ACK',
        sessionId: packet.sessionId,
        version: '1.0',
        timestamp: Date.now(),
        protocol: packet.protocol,
        windowSize: packet.windowSize,
        seqNumberSpace: packet.seqNumberSpace,
        maxPayloadSize: packet.maxPayloadSize,
        role: 'HOST_B',
        agentVersion: '0.1.0',
      };
      this.sendUdpDatagram(ackPacket, rinfo.address, rinfo.port);
      return;
    }

    // If we are already connected to a different session, reject foreign connection
    if (this.status === 'CONNECTED' || this.status === 'TRANSFERRING' || this.status === 'CONNECTING') {
      const reject: HandshakeRejectPacket = {
        type: 'HANDSHAKE_REJECT',
        sessionId: packet.sessionId,
        version: '1.0',
        timestamp: Date.now(),
        reason: 'Peer is already in an active or pending session',
      };
      this.sendUdpDatagram(reject, rinfo.address, rinfo.port);
      return;
    }

    // Validate parameters safely
    try {
      this.peerHost = rinfo.address;
      this.peerUdpPort = rinfo.port;
      this.activeSessionId = packet.sessionId;
      this.activeProtocol = packet.protocol;
      this.activeWindowSize = packet.windowSize;
      this.activeSeqNumberSpace = packet.seqNumberSpace;
      this.role = 'HOST_B';
      this.status = 'CONNECTED';

      // Initialize receiver/bidirectional live session
      this.liveSession = new LiveSession({
        sessionId: this.activeSessionId,
        protocol: packet.protocol,
        windowSize: packet.windowSize,
        seqNumberSpace: packet.seqNumberSpace,
        timeoutMs: 1000,
        maxRetries: 4,
        onPacketToSend: (pkt) => this.sendUdpDatagram(pkt),
        onTelemetry: (evt) => this.handleTelemetryEvent(evt),
        onPayloadDelivered: (p, type, txId) => this.handlePayloadDelivered(p, type, txId),
        onError: (err) => this.sendErrorToClients(err),
        onStatsUpdate: () => this.broadcastStatusUpdate(),
      });

      this.liveSession.start();

      // Send ACK back
      const ackPacket: HandshakeAckPacket = {
        type: 'HANDSHAKE_ACK',
        sessionId: packet.sessionId,
        version: '1.0',
        timestamp: Date.now(),
        protocol: packet.protocol,
        windowSize: packet.windowSize,
        seqNumberSpace: packet.seqNumberSpace,
        maxPayloadSize: packet.maxPayloadSize,
        role: 'HOST_B',
        agentVersion: '0.1.0',
      };

      this.sendUdpDatagram(ackPacket, rinfo.address, rinfo.port);

      this.broadcastWsMessage({
        type: 'PEER_HANDSHAKE_SUCCESS',
        payload: {
          sessionId: this.activeSessionId,
          protocol: this.activeProtocol,
          role: this.role,
          peerHost: this.peerHost,
          peerUdpPort: this.peerUdpPort,
        },
        timestamp: Date.now(),
      });

      this.broadcastStatusUpdate();
    } catch (err) {
      this.status = 'LISTENING';
      this.role = 'UNASSIGNED';
      const reject: HandshakeRejectPacket = {
        type: 'HANDSHAKE_REJECT',
        sessionId: packet.sessionId,
        version: '1.0',
        timestamp: Date.now(),
        reason: `Handshake rejected: ${err instanceof Error ? err.message : String(err)}`,
      };
      this.sendUdpDatagram(reject, rinfo.address, rinfo.port);
    }
  }

  private handleHandshakeAck(packet: HandshakeAckPacket, rinfo: dgram.RemoteInfo): void {
    if (this.status === 'CONNECTING' && this.activeSessionId === packet.sessionId) {
      this.clearHandshakeTimer();
      this.status = 'CONNECTED';
      this.peerHost = rinfo.address;
      this.peerUdpPort = rinfo.port;

      if (this.liveSession) {
        this.liveSession.start();
      }

      this.broadcastWsMessage({
        type: 'PEER_HANDSHAKE_SUCCESS',
        payload: {
          sessionId: this.activeSessionId,
          protocol: this.activeProtocol,
          role: this.role,
          peerHost: this.peerHost,
          peerUdpPort: this.peerUdpPort,
        },
        timestamp: Date.now(),
      });

      this.broadcastStatusUpdate();
    }
  }

  private handleHandshakeReject(packet: HandshakeRejectPacket): void {
    this.clearHandshakeTimer();
    this.status = 'LISTENING';
    this.role = 'UNASSIGNED';
    if (this.liveSession) {
      this.liveSession.stop();
      this.liveSession = undefined;
    }

    this.broadcastWsMessage({
      type: 'PEER_HANDSHAKE_FAILED',
      payload: { reason: packet.reason },
      timestamp: Date.now(),
    });

    this.broadcastStatusUpdate();
  }

  public disconnectPeer(reason: string = 'User initiated disconnect'): void {
    this.clearHandshakeTimer();

    if (this.activeSessionId && (this.status === 'CONNECTED' || this.status === 'TRANSFERRING')) {
      const discPacket: DisconnectPacket = {
        type: 'DISCONNECT',
        sessionId: this.activeSessionId,
        version: '1.0',
        timestamp: Date.now(),
        reason,
      };
      this.sendUdpDatagram(discPacket);
    }

    if (this.liveSession) {
      this.liveSession.stop();
      this.liveSession = undefined;
    }

    this.fileManager.cancelAllTransfers();

    this.status = 'LISTENING';
    this.role = 'UNASSIGNED';
    this.peerHost = undefined;
    this.peerUdpPort = undefined;
    this.activeSessionId = undefined;

    this.broadcastWsMessage({
      type: 'PEER_DISCONNECTED',
      payload: { reason },
      timestamp: Date.now(),
    });

    this.broadcastStatusUpdate();
  }

  private handleRemoteDisconnect(packet: DisconnectPacket): void {
    this.clearHandshakeTimer();

    if (this.liveSession) {
      this.liveSession.stop();
      this.liveSession = undefined;
    }

    this.fileManager.cancelAllTransfers();

    this.status = 'LISTENING';
    this.role = 'UNASSIGNED';
    this.peerHost = undefined;
    this.peerUdpPort = undefined;
    this.activeSessionId = undefined;

    this.broadcastWsMessage({
      type: 'PEER_DISCONNECTED',
      payload: { reason: packet.reason ?? 'Remote peer disconnected' },
      timestamp: Date.now(),
    });

    this.broadcastStatusUpdate();
  }

  // ================= Data & File Transmission =================

  public sendText(text: string): void {
    if (!this.liveSession || this.status !== 'CONNECTED') {
      this.sendErrorToClients('Cannot send text: No active peer connection');
      return;
    }

    this.liveSession.queuePayload(text, 'TEXT');
  }

  public sendFile(filename: string, fileBase64: string): void {
    if (!this.liveSession || this.status !== 'CONNECTED') {
      this.sendErrorToClients('Cannot send file: No active peer connection');
      return;
    }

    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      const prepared = this.fileManager.prepareOutgoingFile(filename, buffer);

      // Send header datagram
      const headerPacket: FileHeaderPacket = {
        ...prepared.header,
        sessionId: this.activeSessionId!,
        version: '1.0',
        timestamp: Date.now(),
      };
      this.sendUdpDatagram(headerPacket);

      // Queue self-describing chunks through reliable ARQ flow control
      for (const chunk of prepared.chunkPayloads) {
        this.liveSession.queuePayload(JSON.stringify(chunk), 'FILE_CHUNK', prepared.header.transferId);
      }
    } catch (err) {
      this.sendErrorToClients(`Failed to send file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private handleFileHeader(packet: FileHeaderPacket): void {
    try {
      this.fileManager.handleIncomingHeader(packet);
      this.broadcastWsMessage({
        type: 'FILE_TRANSFER_PROGRESS',
        payload: {
          transferId: packet.transferId,
          filename: packet.filename,
          progressPercent: 0,
          totalChunks: packet.totalChunks,
        },
        timestamp: Date.now(),
      });
    } catch (err) {
      this.sendErrorToClients(`File header rejected: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private handlePayloadDelivered(
    payload: string,
    payloadType: 'TEXT' | 'FILE_CHUNK',
    _transferId?: string
  ): void {
    if (payloadType === 'TEXT') {
      this.broadcastWsMessage({
        type: 'MESSAGE_DELIVERED',
        payload: { text: payload, timestamp: Date.now() },
        timestamp: Date.now(),
      });
    } else if (payloadType === 'FILE_CHUNK') {
      try {
        const chunk = JSON.parse(payload) as FileChunkPayload;
        const result = this.fileManager.handleIncomingChunk(chunk);

        if (result.completed) {
          this.broadcastWsMessage({
            type: 'FILE_DELIVERED',
            payload: {
              filename: result.filename,
              filePath: result.filePath,
              sha256: result.sha256,
            },
            timestamp: Date.now(),
          });
        } else if (result.error) {
          this.sendErrorToClients(`File chunk assembly error: ${result.error}`);
        } else {
          this.broadcastWsMessage({
            type: 'FILE_TRANSFER_PROGRESS',
            payload: {
              transferId: chunk.transferId,
              filename: result.filename,
              progressPercent: result.progressPercent,
            },
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        this.sendErrorToClients(`Invalid file chunk payload: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private handleTelemetryEvent(event: LiveTelemetryEvent): void {
    this.broadcastWsMessage({
      type: 'LIVE_PROTOCOL_EVENT',
      payload: { event },
      timestamp: Date.now(),
    });
  }

  // ================= State DTO =================

  public getStateDto(): LiveAgentStateDto {
    const stats: ProtocolStatistics = this.liveSession
      ? this.liveSession.getStats()
      : {
          framesSent: 0,
          framesAcknowledged: 0,
          retransmissions: 0,
          timeouts: 0,
          lostFramesSimulated: 0,
          lostAcksSimulated: 0,
          bytesTransferred: 0,
        };

    return {
      status: this.status,
      role: this.role,
      localUdpPort: this.localUdpPort,
      localUdpHost: this.localUdpHost,
      peerHost: this.peerHost,
      peerUdpPort: this.peerUdpPort,
      sessionId: this.activeSessionId,
      protocol: this.activeProtocol,
      windowSize: this.activeWindowSize,
      seqNumberSpace: this.activeSeqNumberSpace,
      senderWindow: this.liveSession?.getSenderWindowState(),
      receiverBase: this.liveSession?.getReceiverBase(),
      stats,
      lastError: this.lastError,
    };
  }

  public getStatus(): LiveAgentStatus {
    return this.status;
  }

  public getRole(): LiveRole {
    return this.role;
  }

  public getLiveSession(): LiveSession | undefined {
    return this.liveSession;
  }
}
