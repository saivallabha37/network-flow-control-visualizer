import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveAgentStateDto,
  LiveTelemetryEvent,
  ProtocolType,
  WsClientCommand,
  WsServerMessage,
  VerifiedFileInfo,
} from '@agent';

export interface IncomingFileInfo {
  transferId: string;
  filename: string;
  filePath?: string;
  sha256?: string;
  progressPercent: number;
  completed: boolean;
}

export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface ChatMessage {
  id: string;
  sender: 'SELF' | 'PEER';
  senderRole?: 'HOST_A' | 'HOST_B' | 'UNASSIGNED';
  senderLabel: string;
  text: string;
  timestamp: number;
  status: MessageDeliveryStatus;
  seqNum?: number;
}

export type WsConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'OFFLINE';

export const STORAGE_KEY_WS_URL = 'nfcv_agent_ws_url';

export function resolveDefaultWsUrl(explicitDefault?: string): string {
  // 1. Environment variable if set at build or run time
  const envUrl = (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_AGENT_WS_URL) as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }

  // 2. Persisted user configuration in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const persisted = window.localStorage.getItem(STORAGE_KEY_WS_URL);
      if (persisted && persisted.trim()) {
        return persisted.trim();
      }
    } catch {
      // ignore
    }
  }

  // 3. Explicit default parameter (if supplied and not standard fallback)
  if (explicitDefault && explicitDefault !== 'ws://127.0.0.1:8080') {
    return explicitDefault;
  }

  // 4. Protocol-aware context default
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'wss://127.0.0.1:8443';
  }

  return 'ws://127.0.0.1:8080';
}

export function useLiveAgent(defaultWsUrl?: string) {
  const [wsUrl, setWsUrlState] = useState<string>(() => resolveDefaultWsUrl(defaultWsUrl));

  const setWsUrl = useCallback((newUrl: string) => {
    const trimmed = newUrl.trim();
    setWsUrlState(trimmed);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_WS_URL, trimmed);
      } catch {
        // ignore
      }
    }
  }, []);
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>('CONNECTING');
  const [agentState, setAgentState] = useState<LiveAgentStateDto | null>(null);
  const [events, setEvents] = useState<LiveTelemetryEvent[]>([]);
  const [messages, setMessages] = useState<Array<{ text: string; timestamp: number }>>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<IncomingFileInfo[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<VerifiedFileInfo[]>([]);
  const [downloadingFilename, setDownloadingFilename] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentSessionIdRef = useRef<string | undefined>(undefined);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isIntentionalCloseRef = useRef<boolean>(false);
  const MAX_AUTO_RECONNECT_ATTEMPTS = 3;

  const isWsConnected = connectionStatus === 'CONNECTED';

  const sendCommand = useCallback((cmd: WsClientCommand) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setLastError('Not connected to local Networking Agent.');
      return;
    }
    try {
      wsRef.current.send(JSON.stringify(cmd));
    } catch (err) {
      setLastError(`Failed to dispatch command: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const refreshReceivedFiles = useCallback(() => {
    sendCommand({ command: 'LIST_RECEIVED_FILES' });
  }, [sendCommand]);

  const connectWs = useCallback((targetUrl: string, force: boolean = false) => {
    // Clear any pending reconnect timers
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Guard against duplicate connection attempts
    if (
      !force &&
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    // Cleanly close prior connection if switching URLs or forcing reconnect
    if (wsRef.current) {
      isIntentionalCloseRef.current = true;
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    isIntentionalCloseRef.current = false;
    setConnectionStatus('CONNECTING');
    setLastError(null);

    try {
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Verify this is still the active socket instance
        if (wsRef.current !== ws) return;

        setConnectionStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;
        setLastError(null);

        // Fetch initial agent status and completed files
        try {
          ws.send(JSON.stringify({ command: 'GET_STATUS' }));
          ws.send(JSON.stringify({ command: 'LIST_RECEIVED_FILES' }));
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setConnectionStatus('OFFLINE');
        setLastError(
          `Local Networking Agent is offline or unreachable at ${targetUrl}. Start the agent using start-agent.bat on your laptop and click Retry.`
        );
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;

        setConnectionStatus('OFFLINE');
        wsRef.current = null;

        // Trigger safe auto-reconnect with exponential backoff if not closed manually
        if (!isIntentionalCloseRef.current) {
          if (reconnectAttemptsRef.current < MAX_AUTO_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current += 1;
            const delay = 1500 * reconnectAttemptsRef.current;
            reconnectTimerRef.current = setTimeout(() => {
              connectWs(targetUrl, false);
            }, delay);
          } else {
            setLastError(
              `Local Networking Agent is offline at ${targetUrl}. Ensure start-agent.bat is running on your machine, then click Retry.`
            );
          }
        }
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return;

        try {
          const msg = JSON.parse(event.data) as WsServerMessage;

          switch (msg.type) {
            case 'AGENT_STATUS_UPDATE': {
              const state = msg.payload.state as LiveAgentStateDto;
              setAgentState(state);
              if (state.lastError) {
                setLastError(state.lastError);
              }

              if (state.sessionId !== currentSessionIdRef.current) {
                currentSessionIdRef.current = state.sessionId;
              }
              break;
            }

            case 'LIVE_PROTOCOL_EVENT': {
              const evt = msg.payload.event as LiveTelemetryEvent;
              setEvents((prev) => [...prev.slice(-199), evt]);
              break;
            }

            case 'MESSAGE_STATUS_UPDATE': {
              const p = msg.payload as {
                clientMessageId: string;
                status: MessageDeliveryStatus;
                seqNum?: number;
              };
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === p.clientMessageId
                    ? {
                        ...m,
                        status: p.status,
                        seqNum: p.seqNum !== undefined ? p.seqNum : m.seqNum,
                      }
                    : m
                )
              );
              break;
            }

            case 'MESSAGE_DELIVERED': {
              const m = msg.payload as {
                id?: string;
                senderRole?: 'HOST_A' | 'HOST_B';
                senderName?: string;
                text: string;
                timestamp: number;
              };

              setMessages((prev) => [...prev, { text: m.text, timestamp: m.timestamp }]);

              setChatMessages((prev) => {
                if (m.id && prev.some((existing) => existing.id === m.id)) {
                  return prev; // duplicate suppression
                }
                const peerRole = m.senderRole || 'HOST_B';
                const peerLabel = m.senderName || (peerRole === 'HOST_B' ? 'Laptop B' : 'Laptop A');

                const inMsg: ChatMessage = {
                  id: m.id || `msg_in_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  sender: 'PEER',
                  senderRole: peerRole,
                  senderLabel: peerLabel,
                  text: m.text,
                  timestamp: m.timestamp || Date.now(),
                  status: 'DELIVERED',
                };
                return [...prev, inMsg];
              });
              break;
            }

            case 'RECEIVED_FILES_LIST': {
              const filesList = (msg.payload.files as VerifiedFileInfo[]) || [];
              setReceivedFiles(filesList);
              break;
            }

            case 'FILE_DOWNLOAD_DATA': {
              const fileData = msg.payload as {
                filename: string;
                mimeType: string;
                dataBase64: string;
                sha256: string;
                fileSize: number;
              };
              try {
                const byteCharacters = atob(fileData.dataBase64);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([byteNumbers], {
                  type: fileData.mimeType || 'application/octet-stream',
                });
                const downloadUrl = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = downloadUrl;
                anchor.download = fileData.filename;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(downloadUrl);
              } catch (err) {
                setLastError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                setDownloadingFilename(null);
              }
              break;
            }

            case 'FILE_TRANSFER_PROGRESS': {
              const p = msg.payload as {
                transferId: string;
                filename: string;
                progressPercent: number;
              };
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

              // Request fresh completed files list from agent
              sendCommand({ command: 'LIST_RECEIVED_FILES' });
              break;
            }

            case 'AGENT_ERROR': {
              setLastError(String(msg.payload.error));
              setDownloadingFilename(null);
              break;
            }

            default:
              break;
          }
        } catch {
          // ignore parse errors
        }
      };
    } catch (err) {
      setConnectionStatus('OFFLINE');
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, [sendCommand]);

  // Initial connection on mount & url changes
  useEffect(() => {
    connectWs(wsUrl, false);

    return () => {
      isIntentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, [wsUrl, connectWs]);

  // Explicit user-triggered retry
  const retryConnect = useCallback(
    (customUrl?: string) => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      connectWs(customUrl ?? wsUrl, true);
    },
    [connectWs, wsUrl]
  );

  const startListener = useCallback(
    (udpPort: number, udpHost = '0.0.0.0') => {
      sendCommand({ command: 'START_LISTENER', udpPort, udpHost });
    },
    [sendCommand]
  );

  const stopListener = useCallback(() => {
    sendCommand({ command: 'STOP_LISTENER' });
  }, [sendCommand]);

  const connectPeer = useCallback(
    (options: {
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
    },
    [sendCommand]
  );

  const disconnectPeer = useCallback(
    (reason?: string) => {
      sendCommand({ command: 'DISCONNECT_PEER', reason });
    },
    [sendCommand]
  );

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const localRole = agentState?.role;
      const localLabel = localRole === 'HOST_B' ? 'Laptop B (You)' : 'Laptop A (You)';

      const newChatMsg: ChatMessage = {
        id: msgId,
        sender: 'SELF',
        senderRole: localRole,
        senderLabel: localLabel,
        text: trimmed,
        timestamp: Date.now(),
        status: 'SENDING',
      };

      setChatMessages((prev) => [...prev, newChatMsg]);
      setMessages((prev) => [...prev, { text: trimmed, timestamp: Date.now() }]);

      sendCommand({ command: 'SEND_TEXT', text: trimmed, clientMessageId: msgId });
    },
    [sendCommand, agentState?.role]
  );

  const sendFile = useCallback(
    (filename: string, fileBase64: string) => {
      sendCommand({ command: 'SEND_FILE', filename, fileBase64 });
    },
    [sendCommand]
  );

  const downloadFile = useCallback(
    (filename: string) => {
      setDownloadingFilename(filename);
      sendCommand({ command: 'DOWNLOAD_FILE', filename });
    },
    [sendCommand]
  );

  const setFault = useCallback(
    (fault: { dropNextData?: boolean; dropNextAck?: boolean }) => {
      sendCommand({ command: 'SET_TEST_FAULT', ...fault });
    },
    [sendCommand]
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const clearChat = useCallback(() => {
    setChatMessages([]);
    setMessages([]);
  }, []);

  return {
    wsUrl,
    setWsUrl,
    connectionStatus,
    isWsConnected,
    connectWs,
    retryConnect,
    agentState,
    events,
    messages,
    chatMessages,
    files,
    receivedFiles,
    downloadingFilename,
    lastError,
    startListener,
    stopListener,
    connectPeer,
    disconnectPeer,
    sendText,
    sendFile,
    downloadFile,
    refreshReceivedFiles,
    setFault,
    clearEvents,
    clearChat,
  };
}
