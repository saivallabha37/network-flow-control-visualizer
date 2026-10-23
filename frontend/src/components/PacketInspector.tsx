import React from 'react';
import { InFlightPacket, SimulationEvent } from '@agent';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Pause,
  Play,
  X,
  Layers,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export interface PacketInspectorTarget {
  inFlightPacket?: InFlightPacket | null;
  event?: SimulationEvent | null;
}

interface PacketInspectorProps {
  target: PacketInspectorTarget | null;
  virtualTimeMs: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({
  target,
  virtualTimeMs,
  isPaused,
  onPause,
  onResume,
  onClose,
}) => {
  if (!target || (!target.inFlightPacket && !target.event)) {
    return null;
  }

  const pkt = target.inFlightPacket;
  const evt = target.event;

  // Extract available fields
  const type: 'DATA' | 'ACK' =
    pkt?.type ??
    (evt?.type.startsWith('ACK') ? 'ACK' : 'DATA');

  const seqNum: number | undefined =
    pkt?.frame.seqNum ??
    (evt?.details.seqNum as number | undefined);

  const ackNum: number | undefined =
    pkt?.frame.ackNum ??
    (evt?.details.ackNum as number | undefined);

  const payloadText: string | undefined =
    pkt?.frame.payload ??
    (evt?.details.payload as string | undefined);

  const payloadSize: string =
    type === 'DATA'
      ? payloadText !== undefined
        ? `${payloadText.length} characters (${new TextEncoder().encode(payloadText).length} bytes)`
        : 'Unavailable'
      : 'Unavailable (ACK frame carries no application payload)';

  const checksum: number | undefined = pkt?.frame.checksum;
  const checksumHex = checksum !== undefined ? `0x${checksum.toString(16).toUpperCase()}` : 'Unavailable';

  const departureTime: number | undefined =
    pkt?.departureTime ?? (evt ? evt.virtualTimestamp : undefined);

  const scheduledDeliveryTime: number | undefined = pkt?.scheduledDeliveryTime;

  const remainingDelay: string =
    scheduledDeliveryTime !== undefined
      ? `${Math.max(0, scheduledDeliveryTime - virtualTimeMs)} ms`
      : 'Delivered / Completed';

  const isRetransmission: boolean =
    Boolean(evt?.details.isRetransmission) ||
    Boolean(evt?.details.attempt && (evt.details.attempt as number) > 1);

  const isDropped: boolean =
    pkt?.isDropped ??
    (evt ? evt.type === 'FRAME_DROPPED' || evt.type === 'ACK_DROPPED' : false);

  const isCorrupted: boolean =
    pkt?.isCorrupted ??
    (evt ? evt.type === 'FRAME_CORRUPTED' : false);

  return (
    <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-5 shadow-2xl backdrop-blur-md space-y-4 ring-1 ring-indigo-500/20">
      {/* Inspector Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-white text-sm">Interactive Packet Inspector</h3>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              type === 'DATA'
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
            }`}
          >
            {type === 'DATA' ? `DATA #${seqNum ?? '?'}` : `ACK #${ackNum ?? '?'}`}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Pause / Resume helper toggle */}
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded text-xs transition-colors"
            >
              <Play className="w-3 h-3" /> Resume Playback
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/80 hover:bg-amber-600 text-white rounded text-xs transition-colors"
            >
              <Pause className="w-3 h-3" /> Pause to Inspect
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Inspector"
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Inspectable Attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Frame Type & Identifier */}
        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span>Frame Type &amp; Number</span>
            {type === 'DATA' ? (
              <ArrowRight className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowLeft className="w-3 h-3 text-cyan-400" />
            )}
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {type === 'DATA' ? `DATA Frame [seq ${seqNum}]` : `ACK Frame [ackNum ${ackNum}]`}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Direction: {type === 'DATA' ? 'Sender \u2192 Receiver' : 'Receiver \u2192 Sender'}
          </span>
        </div>

        {/* Payload Size */}
        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span>Payload Size</span>
            <Layers className="w-3 h-3 text-slate-500" />
          </div>
          <div className="text-sm font-bold font-mono text-white truncate">
            {payloadText ? `"${payloadText}"` : payloadSize}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
            {payloadSize}
          </span>
        </div>

        {/* Checksum / Integrity */}
        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span>Integrity Checksum</span>
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {checksumHex}
          </div>
          <span
            className={`text-[10px] block mt-0.5 font-medium ${
              isCorrupted
                ? 'text-rose-400'
                : checksum !== undefined
                ? 'text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            {isCorrupted ? 'Checksum Bit Inversion (Corrupted)' : checksum !== undefined ? 'CRC-32 Verified' : 'Unavailable in this event'}
          </span>
        </div>

        {/* Channel Status */}
        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span>Channel Loss Status</span>
            {isDropped ? (
              <AlertTriangle className="w-3 h-3 text-rose-400" />
            ) : (
              <CheckCircle className="w-3 h-3 text-emerald-400" />
            )}
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {isDropped ? 'DROPPED IN CHANNEL' : isCorrupted ? 'CORRUPTED' : 'TRANSMITTING SAFELY'}
          </div>
          <span
            className={`text-[10px] block mt-0.5 font-medium ${
              isDropped ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {isDropped ? 'Simulated Channel Loss' : 'In Transit / Delivered'}
          </span>
        </div>
      </div>

      {/* Timing & Propagation Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Departure Timestamp
          </div>
          <div className="font-mono text-slate-200">
            {departureTime !== undefined ? `${departureTime} ms (virtual time)` : 'Unavailable'}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Scheduled Delivery Time
          </div>
          <div className="font-mono text-slate-200">
            {scheduledDeliveryTime !== undefined
              ? `${scheduledDeliveryTime} ms`
              : 'Unavailable (Derived from channel arrival)'}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" /> Remaining In-Flight Delay
          </div>
          <div className="font-mono text-indigo-300 font-bold">
            {remainingDelay}
          </div>
        </div>
      </div>

      {/* Retransmission Status & Related Description */}
      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Transmission History:</span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
              isRetransmission
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
            }`}
          >
            {isRetransmission ? 'Retransmitted Frame' : 'Original Transmission'}
          </span>
        </div>

        {evt && (
          <div className="text-[11px] text-slate-400 italic">
            Correlated Event: <span className="text-slate-300 font-mono font-medium">{evt.type}</span> &bull; {evt.details.description}
          </div>
        )}
      </div>
    </div>
  );
};

