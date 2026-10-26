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

export function useLiveAgent(defaultWsUrl = 'ws://127.0.0.1:8080') {
  const [wsUrl, setWsUrl] = useState(defaultWsUrl);
  const [isWsConnected, setIsWsConnected] = useState(false);
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

  const sendCommand = useCallback((cmd: WsClientCommand) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setLastError('Not connected to local Networking Agent.');
      return;
    }
    wsRef.current.send(JSON.stringify(cmd));
  }, []);

  const refreshReceivedFiles = useCallback(() => {
    sendCommand({ command: 'LIST_RECEIVED_FILES' });
  }, [sendCommand]);

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
        // Request initial status and received files
        ws.send(JSON.stringify({ command: 'GET_STATUS' }));
        ws.send(JSON.stringify({ command: 'LIST_RECEIVED_FILES' }));
      };

      ws.onclose = () => {
        setIsWsConnected(false);
      };

      ws.onerror = () => {
        setIsWsConnected(false);
        setLastError(`Cannot connect to agent at ${url}. Is the background agent running?`);
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

              // Handle session change or disconnection cleanly
              if (state.sessionId !== currentSessionIdRef.current) {
                currentSessionIdRef.current = state.sessionId;
                if (!state.sessionId) {
                  // Session ended
                }
              }
              break;
            }

            case 'LIVE_PROTOCOL_EVENT': {
              const evt = msg.payload.event as LiveTelemetryEvent;
              setEvents((prev) => [...prev.slice(-199), evt]); // Keep last 200 events
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

      wsRef.current = ws;
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, [wsUrl, sendCommand]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs]);

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
    isWsConnected,
    connectWs,
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
