import React from 'react';
import { Network, Activity, Radio, FlaskConical, Scale, Keyboard } from 'lucide-react';
import { SimulationStatus } from '@agent';

interface HeaderProps {
  status: SimulationStatus;
  virtualTimeMs: number;
  activeMode: 'simulation' | 'live';
  onSelectMode: (mode: 'simulation' | 'live') => void;
  onOpenComparison?: () => void;
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  virtualTimeMs,
  activeMode,
  onSelectMode,
  onOpenComparison,
  onOpenShortcuts,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'RUNNING':
        return {
          label: 'Simulation Running',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'PAUSED':
        return {
          label: 'Paused',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          dot: 'bg-sky-400',
        };
      case 'FAILED':
        return {
          label: 'Retries Exhausted',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      case 'STOPPED':
        return {
          label: 'Safety Limit Reached',
          bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          dot: 'bg-orange-400',
        };
      case 'READY':
      default:
        return {
          label: 'Ready to Simulate',
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Network className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Network Flow Control Protocols Visualizer
          </h1>
          <p className="text-xs text-slate-400">
            Interactive flow &amp; error control simulation with real UDP socket transport
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => onSelectMode('simulation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeMode === 'simulation'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Simulation Laboratory
          </button>
          <button
            onClick={() => onSelectMode('live')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeMode === 'live'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Live UDP Network
          </button>
        </div>

        {activeMode === 'simulation' && (
          <>
            {onOpenComparison && (
              <button
                type="button"
                onClick={onOpenComparison}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/80 hover:bg-indigo-950/40 text-indigo-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-700/60 text-xs font-medium transition-colors"
                title="Run side-by-side comparative benchmark of all 3 protocols"
              >
                <Scale className="w-3.5 h-3.5 text-indigo-400" />
                <span>Compare Protocols</span>
              </button>
            )}

            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors"
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-950/60 border border-slate-800 text-xs">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">Virtual Clock:</span>
              <span className="font-mono font-medium text-slate-200">{virtualTimeMs} ms</span>
            </div>

            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium ${badge.bg}`}
            >
              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
