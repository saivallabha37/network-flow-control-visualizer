import { Network, Activity } from 'lucide-react';
import { SimulationStatus } from '@agent';

interface HeaderProps {
  status: SimulationStatus;
  virtualTimeMs: number;
}

export const Header: React.FC<HeaderProps> = ({ status, virtualTimeMs }) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'RUNNING':
        return { label: 'Simulation Running', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400 animate-pulse' };
      case 'PAUSED':
        return { label: 'Paused', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30', dot: 'bg-sky-400' };
      case 'FAILED':
        return { label: 'Retries Exhausted', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' };
      case 'STOPPED':
        return { label: 'Safety Limit Reached', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' };
      case 'READY':
      default:
        return { label: 'Ready to Simulate', bg: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400' };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Network className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Network Flow Control Protocols Visualizer
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
              Phase 5 Lab
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Empirical simulation of Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-950/60 border border-slate-800 text-xs">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Virtual Clock:</span>
          <span className="font-mono font-medium text-slate-200">{virtualTimeMs} ms</span>
        </div>

        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium ${badge.bg}`}>
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          <span>{badge.label}</span>
        </div>
      </div>
    </header>
  );
};

