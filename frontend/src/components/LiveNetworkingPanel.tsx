import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Radio,
  Send,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  CheckCheck,
  Check,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sliders,
  Layers,
  FileText,
  MessageSquare,
  HelpCircle,
  HardDrive,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { ProtocolType } from '@agent';
import { useLiveAgent } from '../hooks/useLiveAgent';

export const LiveNetworkingPanel: React.FC = () => {
  const {
    wsUrl,
    setWsUrl,
    connectionStatus,
    isWsConnected,
    retryConnect,
    agentState,
    events,
    chatMessages,
    files,
    receivedFiles,
    downloadingFilename,
    lastError,
    connectPeer,
    disconnectPeer,
    sendText,
    sendFile,
    downloadFile,
    refreshReceivedFiles,
    setFault,
    clearEvents,
    clearChat,
  } = useLiveAgent();

  const [peerHost, setPeerHost] = useState('127.0.0.1');
  const [peerPort, setPeerPort] = useState('9000');
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('go-back-n');
  const [windowSize, setWindowSize] = useState('4');
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dropDataActive, setDropDataActive] = useState(false);
  const [dropAckActive, setDropAckActive] = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const isConnectedToPeer =
    agentState?.status === 'CONNECTED' || agentState?.status === 'TRANSFERRING';
  const isConnecting = agentState?.status === 'CONNECTING';

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleConnectPeer = (e: React.FormEvent) => {
    e.preventDefault();
    const port = parseInt(peerPort, 10);
    const winSize = parseInt(windowSize, 10);
    if (isNaN(port) || port <= 0 || port > 65535) return;

    connectPeer({
      peerHost: peerHost.trim(),
      peerUdpPort: port,
      protocol: selectedProtocol,
      windowSize: selectedProtocol === 'stop-and-wait' ? 1 : isNaN(winSize) ? 4 : winSize,
    });
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !isConnectedToPeer) return;
    sendText(messageInput.trim());
    setMessageInput('');
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || !isConnectedToPeer) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      sendFile(selectedFile.name, base64);
      setSelectedFile(null);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleToggleFault = (type: 'DATA' | 'ACK') => {
    if (type === 'DATA') {
      const next = !dropDataActive;
      setDropDataActive(next);
      setFault({ dropNextData: next });
    } else {
      const next = !dropAckActive;
      setDropAckActive(next);
      setFault({ dropNextAck: next });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isConnectingWs = connectionStatus === 'CONNECTING';
  const isOffline = connectionStatus === 'OFFLINE';

  return (
    <div className="space-y-6">
      {/* Local Agent Status Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-lg border ${
                isWsConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isConnectingWs
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {isWsConnected ? (
                <Wifi className="w-5 h-5" />
              ) : isConnectingWs ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <WifiOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">Local Networking Agent</h3>
                <span
                  className={`px-2 py-0.5 text-[11px] rounded-full border font-mono ${
                    isWsConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : isConnectingWs
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isWsConnected
                    ? 'Agent Online'
                    : isConnectingWs
                    ? 'Connecting to Agent...'
                    : 'Agent Offline'}
                </span>
                {agentState?.role && agentState.role !== 'UNASSIGNED' && (
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-medium">
                    Role: {agentState.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                WebSocket control:{' '}
                <span className="font-mono text-slate-300">{wsUrl}</span> &bull; UDP Listener:{' '}
                <span className="font-mono text-slate-300">
                  {agentState?.localUdpHost ?? '0.0.0.0'}:{agentState?.localUdpPort ?? 9000}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isWsConnected && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  placeholder="ws://127.0.0.1:8080"
                  className="bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs rounded-lg text-slate-200 w-48 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => retryConnect(wsUrl)}
                  disabled={isConnectingWs}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnectingWs ? 'animate-spin' : ''}`} />
                  {isConnectingWs ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}

            <button
              onClick={() => setShowSetupHelp(!showSetupHelp)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              Setup Guide
            </button>
          </div>
        </div>

        {/* Offline Friendly Message & Quick-Start Guidance */}
        {isOffline && (
          <div className="mt-4 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <WifiOff className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white text-sm">
                    Local Networking Agent is Offline or Unreachable
                  </h4>
                  <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                    The web visualizer requires the local networking agent running on your laptop to send real UDP datagrams over your network.
                  </p>
                </div>
              </div>
              <button
                onClick={() => retryConnect(wsUrl)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs shrink-0 flex items-center gap-1.5 shadow transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>

            <div className="pt-2 border-t border-rose-500/20 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-white block mb-0.5">Quick Start (Windows)</span>
                Double-click <code className="text-indigo-300 font-mono">start-agent.bat</code> in the repository root. The agent listens on <strong>UDP 9000</strong>, <strong>WS 8080</strong>, and <strong>WSS 8443</strong> simultaneously.
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-white block mb-0.5">Target Address Presets</span>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => { setWsUrl('wss://127.0.0.1:8443'); retryConnect('wss://127.0.0.1:8443'); }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 font-mono text-[10px]"
                  >
                    wss://127.0.0.1:8443 (HTTPS)
                  </button>
                  <button
                    onClick={() => { setWsUrl('ws://127.0.0.1:8080'); retryConnect('ws://127.0.0.1:8080'); }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-mono text-[10px]"
                  >
                    ws://127.0.0.1:8080 (Local HTTP)
                  </button>
                </div>
              </div>
            </div>

            {wsUrl.startsWith('wss://') && (
              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    <strong>HTTPS Browser Security Note:</strong> If your browser blocks self-signed localhost WSS, authorize the certificate once or run <code className="text-white font-mono bg-indigo-900/60 px-1 py-0.5 rounded">scripts/windows/trust-cert.bat</code>.
                  </span>
                </div>
                <a
                  href="https://127.0.0.1:8443"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 shrink-0 self-start sm:self-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                  Authorize https://127.0.0.1:8443
                </a>
              </div>
            )}
          </div>
        )}

        {/* Expandable Setup & Architecture Guide Banner */}
        {showSetupHelp && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-300 space-y-3 bg-slate-950/40 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-indigo-400" />
                Local Networking Agent Architecture &amp; Setup Guide
              </span>
              <button
                onClick={() => setShowSetupHelp(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="font-semibold text-indigo-300 mb-1">1. Run Agent on Windows</div>
                <p className="text-slate-400">
                  Double-click <code className="text-slate-200">start-agent.bat</code> in the project root, or run{' '}
                  <code className="text-slate-200">npm run agent:service:install</code> to start silently on Windows login without opening VS Code or a command window.
                </p>
              </div>
              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="font-semibold text-emerald-300 mb-1">2. Zero-Config Local Dev</div>
                <p className="text-slate-400">
                  Run <code className="text-slate-200">npm run dev:frontend</code> and open{' '}
                  <code className="text-slate-200">http://localhost:5173</code> in your browser. It connects directly to{' '}
                  <code className="text-slate-200">ws://127.0.0.1:8080</code> with zero certificate configuration needed.
                </p>
              </div>
              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="font-semibold text-amber-300 mb-1">3. Windows Firewall (UDP 9000)</div>
                <p className="text-slate-400">
                  To allow inbound packets from the second laptop on your LAN, right-click{' '}
                  <code className="text-slate-200">scripts/windows/configure-firewall.bat</code> and select <em>Run as administrator</em>.
                </p>
              </div>
            </div>
          </div>
        )}

        {lastError && !isOffline && (
          <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{lastError}</span>
          </div>
        )}
      </div>

      {/* Top Configuration & Fault Injection Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Peer Handshake & Session Controls */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Radio className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Peer Handshake &amp; Protocol Setup</h3>
          </div>

          {!isConnectedToPeer ? (
            <form onSubmit={handleConnectPeer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Peer IPv4 Address
                  </label>
                  <input
                    type="text"
                    value={peerHost}
                    onChange={(e) => setPeerHost(e.target.value)}
                    placeholder="192.168.1.50 or 127.0.0.1"
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Peer UDP Port
                  </label>
                  <input
                    type="number"
                    value={peerPort}
                    onChange={(e) => setPeerPort(e.target.value)}
                    placeholder="9000"
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Flow Control Protocol
                  </label>
                  <select
                    value={selectedProtocol}
                    onChange={(e) => setSelectedProtocol(e.target.value as ProtocolType)}
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="stop-and-wait">Stop-and-Wait ARQ</option>
                    <option value="go-back-n">Go-Back-N ARQ (Sliding Window)</option>
                    <option value="selective-repeat">Selective Repeat ARQ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Window Size (Frames)
                  </label>
                  <input
                    type="number"
                    disabled={selectedProtocol === 'stop-and-wait'}
                    value={selectedProtocol === 'stop-and-wait' ? '1' : windowSize}
                    onChange={(e) => setWindowSize(e.target.value)}
                    min={1}
                    max={16}
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isWsConnected || isConnecting}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                {isConnecting ? 'Handshake in progress...' : 'Initiate Handshake with Peer'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Connected to Peer: {agentState?.peerHost}:{agentState?.peerUdpPort}
                  </p>
                  <p className="text-[11px] text-emerald-400/80 mt-1 font-mono">
                    Protocol: {agentState?.protocol?.toUpperCase()} &bull; Session:{' '}
                    {agentState?.sessionId}
                  </p>
                </div>

                <button
                  onClick={() => disconnectPeer()}
                  className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {/* Active Window & State Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Sender Base</div>
                  <div className="text-lg font-mono font-bold text-white mt-0.5">
                    {agentState?.senderWindow?.base ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Next Seq Num</div>
                  <div className="text-lg font-mono font-bold text-indigo-400 mt-0.5">
                    {agentState?.senderWindow?.nextSeqNum ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Window Size</div>
                  <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                    {agentState?.windowSize ?? 1}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Receiver Base</div>
                  <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                    {agentState?.receiverBase ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fault Injection Toolbar */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-white text-sm">Controlled Fault Injection</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Simulate channel loss on demand without interrupting network connectivity.
              Observe duplicate suppression and verify automatic ARQ timeout retransmissions over the live UDP socket.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleToggleFault('DATA')}
                className={`w-full p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                  dropDataActive
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-medium">Drop Next DATA Frame</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Forces sender timer to expire &amp; trigger ARQ retransmission
                  </div>
                </div>
                <span
                  className={`w-3 h-3 rounded-full ${
                    dropDataActive ? 'bg-rose-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => handleToggleFault('ACK')}
                className={`w-full p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                  dropAckActive
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-medium">Drop Next Outgoing ACK</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Tests receiver duplicate detection &amp; recovery
                  </div>
                </div>
                <span
                  className={`w-3 h-3 rounded-full ${
                    dropAckActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            Fault triggers once on next datagram and then resets automatically.
          </div>
        </div>
      </div>

      {/* Feature 2: Bidirectional Live Chat Interface */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">
                Bidirectional Live Chat with Protocol Delivery Status
              </h3>
              <p className="text-xs text-slate-400">
                Messages transmit as real UDP datagrams under active ARQ flow control with automatic retransmission.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800">
              {chatMessages.length} message{chatMessages.length === 1 ? '' : 's'}
            </span>
            {chatMessages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-slate-400 hover:text-slate-200 text-xs p-1.5 rounded hover:bg-slate-800 transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chat Feed */}
        <div
          ref={chatScrollRef}
          className="h-80 overflow-y-auto space-y-3 p-4 rounded-lg bg-slate-950/70 border border-slate-800 font-sans text-xs"
        >
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-700" />
              <p className="text-xs">No messages exchanged in this session yet.</p>
              <p className="text-[11px] text-slate-600">
                {isConnectedToPeer
                  ? 'Type a message below and hit Enter to transmit over UDP.'
                  : 'Connect to a peer laptop first to begin live messaging.'}
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isSelf = msg.sender === 'SELF';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 px-1">
                    <span className="font-medium text-slate-300">{msg.senderLabel}</span>
                    <span>&bull;</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <div
                    className={`max-w-[75%] rounded-2xl p-3 shadow-md ${
                      isSelf
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-sm'
                        : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>

                    {/* Delivery Status Indicator for Self Messages */}
                    {isSelf && (
                      <div className="mt-1.5 pt-1 border-t border-indigo-400/30 flex items-center justify-end gap-1.5 text-[10px] text-indigo-200">
                        {msg.status === 'SENDING' && (
                          <span className="flex items-center gap-1 text-amber-200">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>Queued in window...</span>
                          </span>
                        )}
                        {msg.status === 'SENT' && (
                          <span className="flex items-center gap-1 text-sky-200">
                            <Check className="w-3 h-3" />
                            <span>
                              Transmitted on UDP {msg.seqNum !== undefined ? `[seq ${msg.seqNum}]` : ''}
                            </span>
                          </span>
                        )}
                        {msg.status === 'DELIVERED' && (
                          <span className="flex items-center gap-1 text-emerald-300 font-medium">
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Delivered &amp; ACKed</span>
                          </span>
                        )}
                        {msg.status === 'FAILED' && (
                          <span className="flex items-center gap-1 text-rose-300 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Failed (Timeout / Retry Exhaustion)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="mt-4">
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative">
              <textarea
                rows={2}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={!isConnectedToPeer}
                placeholder={
                  isConnectedToPeer
                    ? 'Type a message... (Press Enter to send, Shift+Enter for newline)'
                    : 'Establish handshake with peer laptop to begin live communication.'
                }
                className="w-full bg-slate-950 border border-slate-700 pr-24 pl-3 py-2 text-xs rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 resize-none font-sans"
              />
              <button
                type="submit"
                disabled={!isConnectedToPeer || !messageInput.trim()}
                className="absolute right-2 bottom-3 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Enter to send &bull; Shift+Enter for new line</span>
              <span className="font-mono text-slate-400">
                {isConnectedToPeer ? 'Live Socket Active' : 'Disconnected'}
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Feature 3: Received Files Dashboard & File Transfer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Outgoing File Transfer Card */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Upload className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">Send File via UDP Chunks</h3>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Files are sliced into safe 768-byte chunks, hashed with SHA-256, and reliably transmitted over UDP with ARQ flow control.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="file"
                disabled={!isConnectedToPeer}
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSendFile}
                disabled={!isConnectedToPeer || !selectedFile}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Send
              </button>
            </div>

            {selectedFile && (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300">
                Selected: <span className="text-white font-medium">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)})
              </div>
            )}

            {/* Active Transfer Progress */}
            {files.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Active / Recent Transfer Progress
                </div>
                {files.map((f, i) => (
                  <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200 truncate">{f.filename}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        f.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {f.completed ? '100% Complete' : `${f.progressPercent}%`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 transition-all duration-300"
                        style={{ width: `${f.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feature 3: Received Files Dashboard with 1-Click Browser Download */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <div>
                <h3 className="font-semibold text-white text-sm">
                  Received Files Dashboard &amp; Direct Browser Download
                </h3>
                <p className="text-xs text-slate-400">
                  SHA-256 verified files received on this laptop. Click Download to save directly to your browser's Downloads folder.
                </p>
              </div>
            </div>

            <button
              onClick={refreshReceivedFiles}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
              title="Refresh received files list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 overflow-y-auto space-y-2 p-1 font-mono text-xs">
            {receivedFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-16 space-y-2">
                <FileText className="w-8 h-8 text-slate-700" />
                <p className="text-xs">No completed files received on this laptop yet.</p>
                <p className="text-[11px] text-slate-600">
                  Transferred files are verified with SHA-256 and will appear here with 1-click download.
                </p>
              </div>
            ) : (
              receivedFiles.map((f, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-white truncate">{f.filename}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                        {formatFileSize(f.fileSize)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-400/90 font-mono">
                        <CheckCircle className="w-3 h-3" />
                        SHA-256: <span className="text-slate-300 truncate max-w-[140px] sm:max-w-[200px]">{f.sha256}</span>
                      </span>
                      <span>&bull;</span>
                      <span>{new Date(f.receivedAt).toLocaleTimeString()} ({new Date(f.receivedAt).toLocaleDateString()})</span>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadFile(f.filename)}
                    disabled={downloadingFilename === f.filename}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 shadow"
                  >
                    {downloadingFilename === f.filename ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Event Timeline & Telemetry Log */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="font-semibold text-white text-sm">
              Live UDP Protocol Telemetry Stream ({events.length} events)
            </h3>
          </div>

          <button
            onClick={clearEvents}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear Log
          </button>
        </div>

        <div className="h-64 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-xs">
          {events.length === 0 ? (
            <div className="text-slate-500 text-center py-24">
              Waiting for UDP protocol activity...
            </div>
          ) : (
            events.map((evt) => {
              const isOut = evt.direction === 'OUTBOUND';
              const isIn = evt.direction === 'INBOUND';
              const isRetrans = evt.isRetransmission;

              return (
                <div
                  key={evt.id}
                  className={`p-2 rounded border flex items-center justify-between text-[11px] ${
                    isRetrans
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : isOut
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                      : isIn
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isOut ? (
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    ) : isIn ? (
                      <ArrowLeft className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    )}
                    <span className="font-bold">{evt.type}</span>
                    <span className="text-slate-300 truncate">{evt.description}</span>
                  </div>

                  <span className="text-[10px] text-slate-500 shrink-0 ml-3">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
