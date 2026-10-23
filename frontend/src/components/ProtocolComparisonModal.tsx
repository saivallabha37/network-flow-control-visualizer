import React, { useMemo } from 'react';
import {
  SimulationConfig,
  compareProtocols,
  ProtocolType,
} from '@agent';
import {
  X,
  Scale,
  Award,
  Zap,
  Clock,
  RotateCcw,
  BarChart2,
  TrendingUp,
  Info,
  CheckCircle,
} from 'lucide-react';

interface ProtocolComparisonModalProps {
  config: SimulationConfig;
  isOpen: boolean;
  onClose: () => void;
  onSelectProtocol: (protocol: ProtocolType) => void;
}

export const ProtocolComparisonModal: React.FC<ProtocolComparisonModalProps> = ({
  config,
  isOpen,
  onClose,
  onSelectProtocol,
}) => {
  // Execute comparative benchmark when modal is open
  const report = useMemo(() => {
    if (!isOpen) return null;
    return compareProtocols(config);
  }, [isOpen, config]);

  if (!isOpen || !report) return null;

  const saw = report.results.find((r) => r.protocol === 'stop-and-wait')!;
  const gbn = report.results.find((r) => r.protocol === 'go-back-n')!;
  const sr = report.results.find((r) => r.protocol === 'selective-repeat')!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto ring-1 ring-indigo-500/20">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 id="comparison-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                Protocol Performance Benchmark
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                  Side-by-Side Analysis
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Side-by-side execution under identical RTT ({report.commonParameters.rttMs} ms), loss rate (
                {Math.round(report.commonParameters.frameLossRate * 100)}% DATA /{' '}
                {Math.round(report.commonParameters.ackLossRate * 100)}% ACK), and PRNG seed (
                {report.commonParameters.seed}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Comparison Modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Comparison Matrix */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Protocol Metric</th>
                <th className="p-3.5 text-center">
                  <div className="font-bold text-white">Stop-and-Wait</div>
                  <div className="text-[10px] text-slate-500 font-normal">N=1</div>
                </th>
                <th className="p-3.5 text-center">
                  <div className="font-bold text-white">Go-Back-N</div>
                  <div className="text-[10px] text-slate-500 font-normal">N={config.windowSize ?? 4} (Cumul. ACK)</div>
                </th>
                <th className="p-3.5 text-center">
                  <div className="font-bold text-white">Selective Repeat</div>
                  <div className="text-[10px] text-slate-500 font-normal">N={config.windowSize ?? 4} (Buffer + Indiv.)</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {/* Delivery Status */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3.5 font-sans font-medium text-slate-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Delivery Status
                </td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${saw.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                    {saw.status} ({saw.payloadsDelivered}/{saw.totalPayloads})
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${gbn.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                    {gbn.status} ({gbn.payloadsDelivered}/{gbn.totalPayloads})
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${sr.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                    {sr.status} ({sr.payloadsDelivered}/{sr.totalPayloads})
                  </span>
                </td>
              </tr>

              {/* Completion Duration */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3.5 font-sans font-medium text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" /> Virtual Duration
                </td>
                <td className="p-3.5 text-center text-slate-200">{saw.durationMs} ms</td>
                <td className="p-3.5 text-center text-slate-200">{gbn.durationMs} ms</td>
                <td className="p-3.5 text-center text-slate-200">{sr.durationMs} ms</td>
              </tr>

              {/* Throughput */}
              <tr className="hover:bg-slate-900/40 bg-indigo-950/20">
                <td className="p-3.5 font-sans font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Delivery Throughput
                </td>
                <td className="p-3.5 text-center font-bold text-indigo-300">
                  {saw.throughputPayloadsPerSec.toFixed(2)} /s
                </td>
                <td className="p-3.5 text-center font-bold text-indigo-300">
                  {gbn.throughputPayloadsPerSec.toFixed(2)} /s
                </td>
                <td className="p-3.5 text-center font-bold text-emerald-300">
                  {sr.throughputPayloadsPerSec.toFixed(2)} /s
                </td>
              </tr>

              {/* Total Frames Sent */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3.5 font-sans font-medium text-slate-300 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-slate-400" /> Total Frames Sent
                </td>
                <td className="p-3.5 text-center text-slate-300">
                  {saw.originalFramesSent + saw.retransmissions} ({saw.originalFramesSent} orig + {saw.retransmissions} retx)
                </td>
                <td className="p-3.5 text-center text-slate-300">
                  {gbn.originalFramesSent + gbn.retransmissions} ({gbn.originalFramesSent} orig + {gbn.retransmissions} retx)
                </td>
                <td className="p-3.5 text-center text-slate-300">
                  {sr.originalFramesSent + sr.retransmissions} ({sr.originalFramesSent} orig + {sr.retransmissions} retx)
                </td>
              </tr>

              {/* Retransmissions & Timeouts */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3.5 font-sans font-medium text-slate-300 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-400" /> Retransmissions / Timeouts
                </td>
                <td className="p-3.5 text-center text-slate-300">
                  {saw.retransmissions} / {saw.timeouts}
                </td>
                <td className="p-3.5 text-center text-slate-300">
                  {gbn.retransmissions} / {gbn.timeouts}
                </td>
                <td className="p-3.5 text-center text-slate-300">
                  {sr.retransmissions} / {sr.timeouts}
                </td>
              </tr>

              {/* Transmission Efficiency */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3.5 font-sans font-medium text-slate-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Channel Efficiency
                </td>
                <td className="p-3.5 text-center text-slate-200">
                  {saw.empiricalEfficiencyPercent}%
                </td>
                <td className="p-3.5 text-center text-slate-200">
                  {gbn.empiricalEfficiencyPercent}%
                </td>
                <td className="p-3.5 text-center text-slate-200">
                  {sr.empiricalEfficiencyPercent}%
                </td>
              </tr>

              {/* Theoretical Utilization */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3.5 font-sans font-medium text-slate-300 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-400" /> Theoretical Utilization Limit
                </td>
                <td className="p-3.5 text-center text-slate-400">{saw.theoreticalUtilizationPercent}%</td>
                <td className="p-3.5 text-center text-slate-400">{gbn.theoreticalUtilizationPercent}%</td>
                <td className="p-3.5 text-center text-slate-400">{sr.theoreticalUtilizationPercent}%</td>
              </tr>

              {/* Action: Activate Protocol */}
              <tr className="bg-slate-900/60">
                <td className="p-3.5 font-sans text-xs text-slate-400">Load into Active Visualizer:</td>
                <td className="p-3.5 text-center font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProtocol('stop-and-wait');
                      onClose();
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
                  >
                    Select Stop-and-Wait
                  </button>
                </td>
                <td className="p-3.5 text-center font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProtocol('go-back-n');
                      onClose();
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
                  >
                    Select Go-Back-N
                  </button>
                </td>
                <td className="p-3.5 text-center font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProtocol('selective-repeat');
                      onClose();
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition-colors font-semibold"
                  >
                    Select Selective Repeat
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Educational Takeaways & Analysis */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>Comparative Takeaways for Current Link Parameters:</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300 pl-6 list-disc">
            {report.keyInsights.map((insight, idx) => (
              <li key={idx} className="leading-relaxed">
                {insight}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

