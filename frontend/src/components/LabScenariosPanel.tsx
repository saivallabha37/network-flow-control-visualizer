import React from 'react';
import { Compass, Play, BookOpen, Check } from 'lucide-react';
import { SimulationConfig } from '@agent';
import { GUIDED_SCENARIOS, GuidedScenario } from '../types/scenarios.js';

interface LabScenariosPanelProps {
  currentConfig: SimulationConfig;
  onSelectScenario: (scenario: GuidedScenario) => void;
  disabled?: boolean;
}

export const LabScenariosPanel: React.FC<LabScenariosPanelProps> = ({
  currentConfig,
  onSelectScenario,
  disabled = false,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Guided Educational Scenarios</h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Curated presets with deterministic outcomes for laboratory observation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {GUIDED_SCENARIOS.map((sc) => {
          const isSelected =
            currentConfig.protocol === sc.config.protocol &&
            currentConfig.seed === sc.config.seed &&
            currentConfig.frameLossRate === sc.config.frameLossRate &&
            currentConfig.ackLossRate === sc.config.ackLossRate &&
            currentConfig.oneWayDelayMs === sc.config.oneWayDelayMs;

          return (
            <div
              key={sc.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all text-xs ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {sc.badge}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      sc.difficulty === 'Beginner'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : sc.difficulty === 'Intermediate'
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-purple-500/10 text-purple-300'
                    }`}
                  >
                    {sc.difficulty}
                  </span>
                </div>

                <h4 className="font-bold text-white text-xs leading-snug">{sc.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{sc.summary}</p>

                <div className="p-2 rounded bg-slate-900/90 border border-slate-800/80 text-[10px] text-indigo-200/90 leading-tight">
                  <div className="flex items-center gap-1 font-semibold text-indigo-300 mb-0.5">
                    <BookOpen className="w-2.5 h-2.5 shrink-0" /> Observe:
                  </div>
                  {sc.whatToObserve}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectScenario(sc)}
                  className={`w-full py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-indigo-600/80 hover:bg-indigo-600 text-white disabled:opacity-50'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3 h-3" /> Active Preset
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Load Scenario
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

