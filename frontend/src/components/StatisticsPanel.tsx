import React, { useState } from 'react';
import { SimulationStatistics, ProtocolType } from '@agent';
import {
  BarChart3,
  TrendingUp,
  AlertOctagon,
  CheckCircle,
  HelpCircle,
  Cpu,
  Layers,
  ArrowDownUp,
} from 'lucide-react';

interface StatisticsPanelProps {
  statistics: SimulationStatistics | null;
  virtualTimeMs: number;
  protocol?: ProtocolType;
  windowSize?: number;
  oneWayDelayMs?: number;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  statistics,
  virtualTimeMs,
  protocol = 'go-back-n',
  windowSize = 4,
  oneWayDelayMs = 60,
}) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);
  const s = statistics;

  // Compute theoretical utilization:
  // Let T_frame be normalized frame transmission time (assume 1 unit = 20ms transmission time for standard packet).
  // Round trip time RTT = 2 * oneWayDelayMs.
  const tFrameMs = 20;
  const rttMs = 2 * oneWayDelayMs;
  const denominator = tFrameMs + rttMs;
  const effectiveN = protocol === 'stop-and-wait' ? 1 : Math.max(1, windowSize);
  const theoreticalUtilization = Math.min(1, (effectiveN * tFrameMs) / denominator);
  const theoreticalUtilizationPercent = Math.round(theoreticalUtilization * 100);

  // Observed byte throughput (approximate assuming 32 bytes average payload)
  const avgPayloadBytes = 32;
  const bytesTransferred = s ? s.payloadsDelivered * avgPayloadBytes : 0;
  const durationSec = virtualTimeMs > 0 ? virtualTimeMs / 1000 : 0;
  const bytesPerSec = durationSec > 0 ? Math.round(bytesTransferred / durationSec) : 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Empirical &amp; Theoretical Performance</h3>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <span className="font-mono">Virtual Duration: <strong className="text-slate-200">{virtualTimeMs} ms</strong></span>
          <button
            type="button"
            onClick={() => setShowFormulaDetails((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showFormulaDetails ? 'Hide Formulas' : 'Metrics Guide'}
          </button>
        </div>
      </div>

      {/* Grid: 6 Core Empirical Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Metric 1: Delivery Ratio */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Delivered Payloads</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-base font-bold font-mono text-white">
              {s ? `${s.payloadsDelivered} / ${s.totalPayloads}` : '0 / 0'}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {s ? `${Math.round(s.deliverySuccessRatio * 100)}% delivered` : 'No data'}
          </span>
        </div>

        {/* Metric 2: Useful Payload Throughput */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Throughput</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-base font-bold font-mono text-indigo-300">
              {s ? s.throughputPayloadsPerSec : '0.00'}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            payloads / sec (~{bytesPerSec} B/s)
          </span>
        </div>

        {/* Metric 3: Total Transmissions */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>DATA Transmissions</span>
              <Layers className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-base font-bold font-mono text-white">
              {s ? s.totalFramesSent : 0}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {s ? `${s.originalFramesSent} orig + ${s.retransmissions} retx` : '0 orig'}
          </span>
        </div>

        {/* Metric 4: Retransmission Overhead */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Retransmissions</span>
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-base font-bold font-mono text-amber-300">
              {s ? s.retransmissions : 0}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {s ? `${Math.round(s.retransmissionRatio * 100)}% overhead` : '0% overhead'}
          </span>
        </div>

        {/* Metric 5: DATA Drops & Timeouts */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>DATA Drops / Timeouts</span>
              <ArrowDownUp className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-base font-bold font-mono text-rose-300">
              {s ? `${s.framesDropped} / ${s.timeouts}` : '0 / 0'}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {s ? `${Math.round(s.frameLossRatio * 100)}% frame loss` : '0% loss'}
          </span>
        </div>

        {/* Metric 6: Theoretical Channel Utilization */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Theoretical Max U</span>
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-base font-bold font-mono text-emerald-300">
              {theoreticalUtilizationPercent}%
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1 font-mono">
            {protocol === 'stop-and-wait' ? 'U = 1 / (1 + 2a)' : 'U = min(1, N / (1+2a))'}
          </span>
        </div>
      </div>

      {/* Educational Guide: Assumptions & Theoretical Formulas */}
      {showFormulaDetails && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 text-xs space-y-3 font-sans">
          <h4 className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" /> Theoretical Utilization &amp; Metrics Definitions
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300 leading-relaxed text-[11px]">
            <div className="space-y-1.5">
              <p>
                <strong>1. Stop-and-Wait Utilization:</strong>
                <code className="block bg-slate-900 p-1.5 rounded font-mono text-indigo-200 mt-0.5">
                  U = T_frame / (T_frame + 2 * D) = 1 / (1 + 2a)
                </code>
                Where <code className="font-mono text-slate-200">a = D / T_frame</code> is the ratio of one-way propagation delay to packet transmission time. When latency is high, utilization degrades significantly.
              </p>
              <p>
                <strong>2. Pipelined Sliding Window Utilization (GBN / SR):</strong>
                <code className="block bg-slate-900 p-1.5 rounded font-mono text-indigo-200 mt-0.5">
                  U = min(1, (N * T_frame) / (T_frame + 2 * D)) = min(1, N / (1 + 2a))
                </code>
                Pipelining allows up to <code className="font-mono text-slate-200">N</code> frames in flight simultaneously, achieving up to 100% link utilization when <code className="font-mono text-slate-200">N &ge; 1 + 2a</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <p>
                <strong>3. Useful Payload Throughput:</strong>
                <code className="block bg-slate-900 p-1.5 rounded font-mono text-slate-200 mt-0.5">
                  Throughput = Delivered Payloads / Virtual Time (seconds)
                </code>
                Strictly counts application-delivered payloads, excluding retransmitted duplicates and control ACKs.
              </p>
              <p>
                <strong>4. Retransmission Overhead Ratio:</strong>
                <code className="block bg-slate-900 p-1.5 rounded font-mono text-slate-200 mt-0.5">
                  Overhead = Retransmissions / Total Transmissions
                </code>
                Measures waste due to loss and timeouts. In Go-Back-N, discarding out-of-order frames increases this overhead compared to Selective Repeat.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
