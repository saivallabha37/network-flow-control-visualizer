import React from 'react';
import { ProtocolType } from '@agent';
import { PROTOCOL_INFO } from '../types/visualizer';
import { BookOpen, Check, X, ShieldAlert } from 'lucide-react';

interface ProtocolExplanationProps {
  protocol: ProtocolType;
}

export const ProtocolExplanation: React.FC<ProtocolExplanationProps> = ({ protocol }) => {
  const info = PROTOCOL_INFO[protocol];

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          Protocol Mechanics & Trade-offs: {info.name}
        </h3>
        <span className="text-[11px] text-indigo-300 font-medium">{info.category}</span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        {info.description}
      </p>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block mb-1">
            Window & Capacity
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {info.keyRules.windowing}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider block mb-1">
            Acknowledgement Strategy
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {info.keyRules.acknowledgement}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block mb-1">
            Loss & Timeout Recovery
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {info.keyRules.lossRecovery}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block mb-1">
            Receiver Buffering Policy
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {info.keyRules.receiverBuffering}
          </p>
        </div>
      </div>

      {/* Trade-offs */}
      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-1.5">
            <Check className="w-3.5 h-3.5" /> Strengths
          </span>
          <ul className="space-y-1 text-slate-400 text-[11px]">
            {info.tradeoffs.pros.map((pro, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">&bull;</span>
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 mb-1.5">
            <X className="w-3.5 h-3.5" /> Trade-offs & Limitations
          </span>
          <ul className="space-y-1 text-slate-400 text-[11px]">
            {info.tradeoffs.cons.map((con, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-rose-500 font-bold">&bull;</span>
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Distinction Note */}
      <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-300/90 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-indigo-400" />
        <span>
          <strong>Software Engineering Note:</strong> All visual states, packet journeys, and metric counts are calculated directly by the TypeScript protocol state machine and virtual channel.
        </span>
      </div>
    </div>
  );
};

