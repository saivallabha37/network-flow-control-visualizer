import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Radio,
  Send,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sliders,
  Layers,
} from 'lucide-react';
import { ProtocolType } from '@agent';
import { useLiveAgent } from '../hooks/useLiveAgent';

export const LiveNetworkingPanel: React.FC = () => {
  const {
    wsUrl,
    setWsUrl,
    isWsConnected,
    connectWs,
    agentState,
    events,
    messages,
    files,
    lastError,
    connectPeer,
    disconnectPeer,
    sendText,
    sendFile,
    setFault,
    clearEvents,
  } = useLiveAgent();

  const [peerHost, setPeerHost] = useState('127.0.0.1');
  const [peerPort, setPeerPort] = useState('9000');
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('go-back-n');
  const [windowSize, setWindowSize] = useState('4');
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dropDataActive, setDropDataActive] = useState(false);
  const [dropAckActive, setDropAckActive] = useState(false);

  const isConnectedToPeer = agentState?.status === 'CONNECTED' || agentState?.status === 'TRANSFERRING';
  const isConnecting = agentState?.status === 'CONNECTING';

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !isConnectedToPeer) return;
    sendText(messageInput.trim());
    setMessageInput('');
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
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {isWsConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">Local Networking Agent</h3>
                <span
                  className={`px-2 py-0.5 text-[11px] rounded-full border font-mono ${
                    isWsConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isWsConnected ? 'Agent Online' : 'Agent Offline'}
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

          {!isWsConnected && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs rounded text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                placeholder="ws://127.0.0.1:8080"
              />
              <button
                onClick={() => connectWs()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
            </div>
          )}
        </div>

        {lastError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{lastError}</span>
          </div>
        )}
      </div>

      {/* Grid: Peer Connection Configuration & Fault Injection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Peer Handshake & Connection */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Radio className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Two-Laptop Peer Connection</h3>
          </div>

          {!isConnectedToPeer ? (
            <form onSubmit={handleConnectPeer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Peer Laptop LAN IP
                  </label>
                  <input
                    type="text"
                    value={peerHost}
                    onChange={(e) => setPeerHost(e.target.value)}
                    placeholder="192.168.1.X or 127.0.0.1"
                    required
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Peer UDP Port
                  </label>
                  <input
                    type="number"
                    value={peerPort}
                    onChange={(e) => setPeerPort(e.target.value)}
                    placeholder="9000"
                    required
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ARQ Protocol
                  </label>
                  <select
                    value={selectedProtocol}
                    onChange={(e) => setSelectedProtocol(e.target.value as ProtocolType)}
                    className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="stop-and-wait">Stop-and-Wait ARQ</option>
                    <option value="go-back-n">Go-Back-N ARQ</option>
                    <option value="selective-repeat">Selective Repeat ARQ</option>
                  </select>
                </div>

                {selectedProtocol !== 'stop-and-wait' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Window Size (N)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={windowSize}
                      onChange={(e) => setWindowSize(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
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

              {/* Active Window & State Info */}
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

      {/* Live Data Dispatch (Text Message & File Transfer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Send Live Text Message */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Send className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Send Text Over Live ARQ</h3>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-3">
            <textarea
              rows={3}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={!isConnectedToPeer}
              placeholder={
                isConnectedToPeer
                  ? 'Type a message to transmit over UDP with flow control...'
                  : 'Connect to a peer first to send text messages.'
              }
              className="w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isConnectedToPeer || !messageInput.trim()}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              Transmit Datagram
            </button>
          </form>

          {/* Delivered Text Messages Stream */}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Received Messages Feed ({messages.length})
            </h4>
            <div className="h-40 overflow-y-auto space-y-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs">
              {messages.length === 0 ? (
                <div className="text-slate-500 text-center py-12">No messages received yet.</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Peer Message</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-200 mt-1">{m.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Send Live File Transfer */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Upload className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">Safe Small File Transfer (Chunked)</h3>
          </div>

          <div className="space-y-3">
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
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
              >
                Send File
              </button>
            </div>
            {selectedFile && (
              <p className="text-[11px] text-slate-400">
                Selected: <span className="text-slate-200 font-medium">{selectedFile.name}</span> (
                {(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Delivered Files List */}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Assembled &amp; Verified Files ({files.length})
            </h4>
            <div className="h-40 overflow-y-auto space-y-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs">
              {files.length === 0 ? (
                <div className="text-slate-500 text-center py-12">No files transferred yet.</div>
              ) : (
                files.map((f, i) => (
                  <div key={i} className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        {f.filename}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          f.completed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {f.completed ? '100% Verified' : `${f.progressPercent}% Chunks`}
                      </span>
                    </div>

                    {f.sha256 && (
                      <div className="text-[10px] text-slate-400 truncate mt-1">
                        SHA-256: <span className="text-slate-300">{f.sha256}</span>
                      </div>
                    )}
                    {f.filePath && (
                      <div className="text-[10px] text-emerald-400 truncate mt-0.5">
                        Saved to: {f.filePath}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
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

