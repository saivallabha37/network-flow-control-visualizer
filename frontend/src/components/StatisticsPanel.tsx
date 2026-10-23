import React from 'react';
import { SimulationStatistics } from '@agent';
import { BarChart3, TrendingUp, AlertOctagon, CheckCircle } from 'lucide-react';

interface StatisticsPanelProps {
  statistics: SimulationStatistics | null;
  virtualTimeMs: number;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  statistics,
  virtualTimeMs,
}) => {
  const s = statistics;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          Empirical Performance Metrics
        </h3>
        <span className="text-[11px] text-slate-500 font-mono">
          Virtual Duration: {virtualTimeMs} ms
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        {/* Metric 1: Delivery Ratio */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>Delivered / Total</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-white">
            {s ? `${s.payloadsDelivered} / ${s.totalPayloads}` : '0 / 0'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {s ? `${Math.round(s.deliverySuccessRatio * 100)}% delivered` : 'No data'}
          </span>
        </div>

        {/* Metric 2: Throughput */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>Throughput</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-base font-bold font-mono text-white">
            {s ? `${s.throughputPayloadsPerSec}` : '0.00'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            payloads / virtual sec
          </span>
        </div>

        {/* Metric 3: Total Transmissions */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>DATA Transmissions</span>
          </div>
          <div className="text-base font-bold font-mono text-indigo-300">
            {s ? s.totalFramesSent : 0}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {s ? `${s.originalFramesSent} orig + ${s.retransmissions} retx` : '0 orig'}
          </span>
        </div>

        {/* Metric 4: Retransmission Overhead */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>Retransmissions</span>
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-bold font-mono text-amber-300">
            {s ? s.retransmissions : 0}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {s ? `${Math.round(s.retransmissionRatio * 100)}% overhead` : '0%'}
          </span>
        </div>

        {/* Metric 5: Dropped Frames */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>DATA Drops</span>
          </div>
          <div className="text-base font-bold font-mono text-rose-300">
            {s ? s.framesDropped : 0}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {s ? `${Math.round(s.frameLossRatio * 100)}% drop rate` : '0%'}
          </span>
        </div>

        {/* Metric 6: ACKs Sent & Dropped */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>ACKs Sent / Lost</span>
          </div>
          <div className="text-base font-bold font-mono text-cyan-300">
            {s ? `${s.acksSent} / ${s.acksDropped}` : '0 / 0'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {s ? `${Math.round(s.ackLossRatio * 100)}% lost` : '0%'}
          </span>
        </div>
      </div>
    </div>
  );
};

