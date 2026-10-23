import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveAgentStateDto,
  LiveTelemetryEvent,
  ProtocolType,
  WsClientCommand,
  WsServerMessage,
} from '@agent';

export interface IncomingFileInfo {
  transferId: string;
  filename: string;
  filePath?: string;
  sha256?: string;
  progressPercent: number;
  completed: boolean;
}

export function useLiveAgent(defaultWsUrl = 'ws://127.0.0.1:8080') {
  const [wsUrl, setWsUrl] = useState(defaultWsUrl);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [agentState, setAgentState] = useState<LiveAgentStateDto | null>(null);
  const [events, setEvents] = useState<LiveTelemetryEvent[]>([]);
  const [messages, setMessages] = useState<Array<{ text: string; timestamp: number }>>([]);
  const [files, setFiles] = useState<IncomingFileInfo[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback((url = wsUrl) => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsWsConnected(true);
        setLastError(null);
        // Request initial status
        ws.send(JSON.stringify({ command: 'GET_STATUS' }));
      };

      ws.onclose = () => {
        setIsWsConnected(false);
      };

      ws.onerror = () => {
        setIsWsConnected(false);
        setLastError(`Cannot connect to agent at ${url}. Is 'npm run agent:live' running?`);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsServerMessage;

          switch (msg.type) {
            case 'AGENT_STATUS_UPDATE': {
              const state = msg.payload.state as LiveAgentStateDto;
              setAgentState(state);
              if (state.lastError) {
                setLastError(state.lastError);
              }
              break;
            }

            case 'LIVE_PROTOCOL_EVENT': {
              const evt = msg.payload.event as LiveTelemetryEvent;
              setEvents((prev) => [...prev.slice(-199), evt]); // Keep last 200 events
              break;
            }

            case 'MESSAGE_DELIVERED': {
              const m = msg.payload as { text: string; timestamp: number };
              setMessages((prev) => [...prev, m]);
              break;
            }

            case 'FILE_TRANSFER_PROGRESS': {
              const p = msg.payload as { transferId: string; filename: string; progressPercent: number };
              setFiles((prev) => {
                const idx = prev.findIndex((f) => f.transferId === p.transferId);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = { ...updated[idx], progressPercent: p.progressPercent };
                  return updated;
                }
                return [
                  ...prev,
                  {
                    transferId: p.transferId,
                    filename: p.filename,
                    progressPercent: p.progressPercent,
                    completed: false,
                  },
                ];
              });
              break;
            }

            case 'FILE_DELIVERED': {
              const d = msg.payload as { filename: string; filePath?: string; sha256?: string };
              setFiles((prev) => {
                const idx = prev.findIndex((f) => f.filename === d.filename);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = {
                    ...updated[idx],
                    filePath: d.filePath,
                    sha256: d.sha256,
                    progressPercent: 100,
                    completed: true,
                  };
                  return updated;
                }
                return [
                  ...prev,
                  {
                    transferId: `tx_${Date.now()}`,
                    filename: d.filename,
                    filePath: d.filePath,
                    sha256: d.sha256,
                    progressPercent: 100,
                    completed: true,
                  },
                ];
              });
              break;
            }

            case 'AGENT_ERROR': {
              setLastError(String(msg.payload.error));
              break;
            }

            default:
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      wsRef.current = ws;
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, [wsUrl]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  const sendCommand = useCallback((cmd: WsClientCommand) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setLastError('Not connected to local Networking Agent.');
      return;
    }
    wsRef.current.send(JSON.stringify(cmd));
  }, []);

  const startListener = useCallback((udpPort: number, udpHost = '0.0.0.0') => {
    sendCommand({ command: 'START_LISTENER', udpPort, udpHost });
  }, [sendCommand]);

  const stopListener = useCallback(() => {
    sendCommand({ command: 'STOP_LISTENER' });
  }, [sendCommand]);

  const connectPeer = useCallback((options: {
    peerHost: string;
    peerUdpPort: number;
    protocol: ProtocolType;
    windowSize?: number;
    seqNumberSpace?: number;
    timeoutMs?: number;
  }) => {
    sendCommand({
      command: 'CONNECT_PEER',
      peerHost: options.peerHost,
      peerUdpPort: options.peerUdpPort,
      protocol: options.protocol,
      windowSize: options.windowSize,
      seqNumberSpace: options.seqNumberSpace,
      timeoutMs: options.timeoutMs,
    });
  }, [sendCommand]);

  const disconnectPeer = useCallback((reason?: string) => {
    sendCommand({ command: 'DISCONNECT_PEER', reason });
  }, [sendCommand]);

  const sendText = useCallback((text: string) => {
    sendCommand({ command: 'SEND_TEXT', text });
  }, [sendCommand]);

  const sendFile = useCallback((filename: string, fileBase64: string) => {
    sendCommand({ command: 'SEND_FILE', filename, fileBase64 });
  }, [sendCommand]);

  const setFault = useCallback((fault: { dropNextData?: boolean; dropNextAck?: boolean }) => {
    sendCommand({ command: 'SET_TEST_FAULT', ...fault });
  }, [sendCommand]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    wsUrl,
    setWsUrl,
    isWsConnected,
    connectWs,
    agentState,
    events,
    messages,
    files,
    lastError,
    startListener,
    stopListener,
    connectPeer,
    disconnectPeer,
    sendText,
    sendFile,
    setFault,
    clearEvents,
  };
}

