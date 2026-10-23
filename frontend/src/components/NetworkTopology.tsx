import React, { useState, useEffect } from 'react';
import {
  ProtocolType,
  SimulationEvent,
  SimulationState,
  InFlightPacket,
} from '@agent';
import {
  ArrowRight,
  ArrowLeft,
  Server,
  Layers,
  Inbox,
  Send,
  AlertTriangle,
} from 'lucide-react';

interface NetworkTopologyProps {
  protocol: ProtocolType;
  engineState: SimulationState | null;
  latestEvent?: SimulationEvent;
  virtualTimeMs: number;
  selectedPacketId?: string | null;
  onSelectInFlightPacket?: (packet: InFlightPacket) => void;
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  protocol,
  engineState,
  latestEvent,
  virtualTimeMs,
  selectedPacketId,
  onSelectInFlightPacket,
}) => {
  // Respect user preference for reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  if (!engineState) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
        Simulation engine not initialized.
      </div>
    );
  }

  const {
    senderWindow,
    receiverBase,
    deliveredPayloads,
    inFlightPackets,
    remainingPayloads,
  } = engineState;

  const windowSize = senderWindow.windowSize;
  const senderBase = senderWindow.base;
  const inFlightCount = inFlightPackets.length;

  // Compute sender window slots
  const senderSlots: number[] = [];
  for (let i = 0; i < windowSize; i++) {
    senderSlots.push(senderBase + i);
  }

  // Filter in-flight packets into DATA and ACK
  const dataPackets = inFlightPackets.filter((p) => p.type === 'DATA');
  const ackPackets = inFlightPackets.filter((p) => p.type === 'ACK');

  // Check if latest event was a timeout or retransmission
  const isTimeoutActive =
    latestEvent &&
    (latestEvent.type === 'TIMEOUT' || latestEvent.type === 'RETRANSMISSION');

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-6">
      {/* Topology Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-white text-sm">Network Topology &amp; Physical Channel</h3>
        </div>
        <div className="flex items-center space-x-4 text-slate-400">
          <span>
            In-Flight Packets: <strong className="text-indigo-400 font-mono">{inFlightCount}</strong>
          </span>
          <span>
            Delivered: <strong className="text-emerald-400 font-mono">{deliveredPayloads.length}</strong>
          </span>
        </div>
      </div>

      {/* Main Endpoints & Channel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* SENDER ENDPOINT (3 cols) */}
        <div className="lg:col-span-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                  Sender (Host A)
                </h4>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                Base: {senderBase}
              </span>
            </div>

            {/* Sender Window Slots */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Transmission Window (N={windowSize}):</span>
                <span className="font-mono text-indigo-300">
                  [{senderBase} .. {senderBase + windowSize - 1}]
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {senderSlots.map((seq, idx) => {
                  const hasActiveInFlight = dataPackets.some((p) => p.frame.seqNum === seq);
                  return (
                    <div
                      key={`sender-slot-${seq}-${idx}`}
                      className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-mono border transition-all ${
                        hasActiveInFlight
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="font-bold">#{seq}</span>
                      <span className="text-[8px] text-slate-500">
                        {hasActiveInFlight ? 'inflight' : 'slot'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Payload Queue */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Send className="w-3 h-3 text-slate-500" /> Payload Queue:
                </span>
                <span className="text-slate-300 font-mono">{remainingPayloads} pending</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono text-slate-400 max-h-24 overflow-y-auto">
                {remainingPayloads > 0 ? (
                  <span>{remainingPayloads} payloads queued for transmission</span>
                ) : (
                  <span className="text-emerald-500/80">Queue empty (all dispatched)</span>
                )}
              </div>
            </div>
          </div>

          {/* Sender Timeout Alert if active */}
          {isTimeoutActive && (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Timeout recovery in progress!</span>
            </div>
          )}
        </div>

        {/* VIRTUAL CHANNEL (6 cols) */}
        <div className="lg:col-span-6 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/60">
            <span className="font-medium text-slate-300">Virtual Propagation Channel</span>
            <span className="text-[11px] text-slate-400 font-mono">
              Click packet to inspect
            </span>
          </div>

          {/* FORWARD TRACK: Sender -> Receiver (DATA) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-indigo-300 font-medium">
              <span className="flex items-center gap-1">
                Forward Path: DATA Frames <ArrowRight className="w-3 h-3 text-indigo-400" />
              </span>
              <span className="text-slate-500 text-[10px]">Host A &rarr; Host B</span>
            </div>

            <div className="relative h-14 bg-slate-900/90 rounded-lg border border-slate-800 overflow-hidden flex items-center px-2">
              {/* Directional track line */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-900/40 border-t border-dashed border-indigo-700/50" />

              {/* Data Packets traversing track */}
              {dataPackets.map((pkt) => {
                const totalDuration = pkt.scheduledDeliveryTime - pkt.departureTime || 1;
                const elapsed = virtualTimeMs - pkt.departureTime;
                const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
                const leftPercent = progress * 88; // Keep within card width bounds
                const isSelected = selectedPacketId === pkt.id;

                return (
                  <div
                    key={pkt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectInFlightPacket?.(pkt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectInFlightPacket?.(pkt);
                      }
                    }}
                    aria-label={`Inspect DATA packet sequence ${pkt.frame.seqNum}`}
                    className={`absolute transform -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono shadow-md border cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      prefersReducedMotion ? '' : 'transition-all duration-100 ease-linear'
                    } ${
                      isSelected
                        ? 'ring-2 ring-indigo-400 scale-105 z-10'
                        : ''
                    } ${
                      pkt.isDropped && progress >= 0.5
                        ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 opacity-80'
                        : pkt.isCorrupted
                        ? 'bg-purple-950/80 border-purple-500/60 text-purple-300'
                        : 'bg-indigo-900/90 border-indigo-500/80 text-white hover:border-indigo-400'
                    }`}
                    style={{ left: `${leftPercent}%`, top: '50%' }}
                  >
                    <span className="font-bold">DATA #{pkt.frame.seqNum}</span>
                    {pkt.isDropped && progress >= 0.5 && (
                      <span className="text-[8px] bg-rose-900/80 text-rose-200 px-1 rounded">
                        DROP
                      </span>
                    )}
                  </div>
                );
              })}

              {dataPackets.length === 0 && (
                <span className="text-[10px] text-slate-600 mx-auto italic">
                  No DATA frames in transit
                </span>
              )}
            </div>
          </div>

          {/* REVERSE TRACK: Receiver -> Sender (ACK) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-cyan-300 font-medium">
              <span className="flex items-center gap-1">
                <ArrowLeft className="w-3 h-3 text-cyan-400" /> Reverse Path: ACKs
              </span>
              <span className="text-slate-500 text-[10px]">Host B &rarr; Host A</span>
            </div>

            <div className="relative h-14 bg-slate-900/90 rounded-lg border border-slate-800 overflow-hidden flex items-center px-2">
              {/* Directional track line */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-cyan-900/40 border-t border-dashed border-cyan-700/50" />

              {/* ACK Packets traversing track */}
              {ackPackets.map((pkt) => {
                const totalDuration = pkt.scheduledDeliveryTime - pkt.departureTime || 1;
                const elapsed = virtualTimeMs - pkt.departureTime;
                const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
                const rightPercent = progress * 88;
                const isSelected = selectedPacketId === pkt.id;

                return (
                  <div
                    key={pkt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectInFlightPacket?.(pkt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectInFlightPacket?.(pkt);
                      }
                    }}
                    aria-label={`Inspect ACK packet ${pkt.frame.ackNum}`}
                    className={`absolute transform -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono shadow-md border cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                      prefersReducedMotion ? '' : 'transition-all duration-100 ease-linear'
                    } ${
                      isSelected
                        ? 'ring-2 ring-cyan-400 scale-105 z-10'
                        : ''
                    } ${
                      pkt.isDropped && progress >= 0.5
                        ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 opacity-80'
                        : 'bg-cyan-950 border-cyan-500/80 text-cyan-200 hover:border-cyan-400'
                    }`}
                    style={{ right: `${rightPercent}%`, top: '50%' }}
                  >
                    <span className="font-bold">ACK #{pkt.frame.ackNum}</span>
                    {pkt.isDropped && progress >= 0.5 && (
                      <span className="text-[8px] bg-rose-900/80 text-rose-200 px-1 rounded">
                        DROP
                      </span>
                    )}
                  </div>
                );
              })}

              {ackPackets.length === 0 && (
                <span className="text-[10px] text-slate-600 mx-auto italic">
                  No ACKs in transit
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RECEIVER ENDPOINT (3 cols) */}
        <div className="lg:col-span-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                  Receiver (Host B)
                </h4>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
                Expect: {receiverBase}
              </span>
            </div>

            {/* Receiver State */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Expected Sequence:</span>
                <span className="font-mono text-emerald-400 font-semibold">#{receiverBase}</span>
              </div>

              {protocol === 'selective-repeat' && (
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                  <span>Receive Window:</span>
                  <span className="ml-1 text-slate-200 font-mono">
                    [{receiverBase} .. {receiverBase + windowSize - 1}]
                  </span>
                </div>
              )}
            </div>

            {/* Delivered Application Data */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Inbox className="w-3 h-3 text-emerald-400" /> Delivered Payloads:
                </span>
                <span className="text-emerald-400 font-mono font-medium">
                  {deliveredPayloads.length} total
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono max-h-24 overflow-y-auto space-y-1">
                {deliveredPayloads.length > 0 ? (
                  deliveredPayloads.map((msg, i) => (
                    <div
                      key={`delivered-${i}-${msg}`}
                      className="text-emerald-300 flex items-center justify-between text-[10px]"
                    >
                      <span>&bull; {msg}</span>
                      <span className="text-[9px] text-slate-500">#{i}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-600 italic">No payloads delivered yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-300">Channel Legend:</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-indigo-600 border border-indigo-400 inline-block" />
            <span>DATA Frame</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-600 border border-cyan-400 inline-block" />
            <span>ACK Frame</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-400 inline-block" />
            <span>In-Flight / Awaiting ACK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-600 border border-rose-400 inline-block" />
            <span>Dropped / Corrupted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600 border border-emerald-400 inline-block" />
            <span>Delivered</span>
          </div>
        </div>
      </div>
    </div>
  );
};
