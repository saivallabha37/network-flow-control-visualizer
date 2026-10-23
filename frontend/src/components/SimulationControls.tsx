import { Play, Pause, RotateCcw, FastForward, StepForward } from 'lucide-react';
import { SimulationStatus } from '@agent';

interface SimulationControlsProps {
  status: SimulationStatus;
  speedMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onRunToCompletion: () => void;
  onSetSpeed: (speedMs: number) => void;
  disabled?: boolean;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  status,
  speedMs,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  onRunToCompletion,
  onSetSpeed,
  disabled = false,
}) => {
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isFinished = status === 'COMPLETED' || status === 'FAILED' || status === 'STOPPED';

  const speedOptions = [
    { label: '0.5x', ms: 400 },
    { label: '1x', ms: 150 },
    { label: '2x', ms: 60 },
    { label: 'Max', ms: 15 },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center space-x-2">
        {/* Start / Pause / Resume */}
        {!isRunning && !isPaused && (
          <button
            type="button"
            disabled={disabled || isFinished}
            onClick={onStart}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Simulation</span>
          </button>
        )}

        {isRunning && (
          <button
            type="button"
            disabled={disabled}
            onClick={onPause}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            disabled={disabled}
            onClick={onResume}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Resume</span>
          </button>
        )}

        {/* Step */}
        <button
          type="button"
          disabled={disabled || isRunning || isFinished}
          onClick={onStep}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Advance by one discrete simulation tick"
        >
          <StepForward className="w-3.5 h-3.5" />
          <span>Step</span>
        </button>

        {/* Fast-forward Run to completion */}
        <button
          type="button"
          disabled={disabled || isRunning || isFinished}
          onClick={onRunToCompletion}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Run continuously until transfer finishes"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Complete</span>
        </button>

        {/* Reset */}
        <button
          type="button"
          disabled={disabled}
          onClick={onReset}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 hover:border-rose-700/50 text-slate-300 hover:text-rose-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          title="Reset simulation to initial state"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Speed control */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-slate-400 font-medium">Speed:</span>
        <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
          {speedOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onSetSpeed(opt.ms)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                speedMs === opt.ms
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

