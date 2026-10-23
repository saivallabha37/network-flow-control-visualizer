import { useState } from 'react';
import { SimulationConfig } from '@agent';
import { Sliders, AlertCircle, RefreshCw } from 'lucide-react';

interface SimulationConfigPanelProps {
  config: SimulationConfig;
  onUpdateConfig: (updater: (prev: SimulationConfig) => SimulationConfig) => void;
  error: string | null;
  disabled?: boolean;
}

export const SimulationConfigPanel: React.FC<SimulationConfigPanelProps> = ({
  config,
  onUpdateConfig,
  error,
  disabled = false,
}) => {
  const [payloadText, setPayloadText] = useState(config.payloads.join(', '));

  const handlePayloadsChange = (val: string) => {
    setPayloadText(val);
    const parsed = val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parsed.length > 0) {
      onUpdateConfig((prev) => ({ ...prev, payloads: parsed }));
    }
  };

  const handleRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 100000);
    onUpdateConfig((prev) => ({ ...prev, seed: newSeed }));
  };

  const isStopAndWait = config.protocol === 'stop-and-wait';

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          Network & Protocol Parameters
        </h3>
        <span className="text-xs text-slate-400">Deterministic Channel Model</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Configuration Error:</span> {error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Payload stream */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Data Payloads (comma-separated sequence)
          </label>
          <input
            type="text"
            disabled={disabled}
            value={payloadText}
            onChange={(e) => handlePayloadsChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
            placeholder="Chunk 0, Chunk 1, Chunk 2..."
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            {config.payloads.length} payloads configured for transfer.
          </span>
        </div>

        {/* Window Size N */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>Window Size (N)</span>
            <span className="font-mono text-indigo-400">{isStopAndWait ? 1 : config.windowSize ?? 4}</span>
          </div>
          <input
            type="number"
            min={1}
            max={8}
            disabled={disabled || isStopAndWait}
            value={isStopAndWait ? 1 : config.windowSize ?? 4}
            onChange={(e) => {
              const val = Math.max(1, parseInt(e.target.value) || 1);
              onUpdateConfig((prev) => ({
                ...prev,
                windowSize: val,
                seqNumberSpace:
                  prev.protocol === 'selective-repeat'
                    ? Math.max(prev.seqNumberSpace ?? 8, 2 * val)
                    : Math.max(prev.seqNumberSpace ?? 8, val + 1),
              }));
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {isStopAndWait ? 'Locked to 1 for Stop-and-Wait' : 'Pipeline transmission window'}
          </span>
        </div>

        {/* Sequence Space M */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>Seq Space (M)</span>
            <span className="font-mono text-indigo-400">{isStopAndWait ? 2 : config.seqNumberSpace ?? 8}</span>
          </div>
          <input
            type="number"
            min={isStopAndWait ? 2 : (config.windowSize ?? 4) + 1}
            max={32}
            disabled={disabled || isStopAndWait}
            value={isStopAndWait ? 2 : config.seqNumberSpace ?? 8}
            onChange={(e) => {
              const val = Math.max(2, parseInt(e.target.value) || 2);
              onUpdateConfig((prev) => ({ ...prev, seqNumberSpace: val }));
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {isStopAndWait
              ? 'Modulo 2 (alternating bit)'
              : config.protocol === 'selective-repeat'
              ? 'Requires M >= 2N'
              : 'Requires M > N'}
          </span>
        </div>

        {/* Propagation Delay */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>One-Way Delay</span>
            <span className="font-mono text-indigo-400">{config.oneWayDelayMs} ms</span>
          </div>
          <input
            type="range"
            min={10}
            max={300}
            step={10}
            disabled={disabled}
            value={config.oneWayDelayMs}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onUpdateConfig((prev) => ({ ...prev, oneWayDelayMs: val }));
            }}
            className="w-full accent-indigo-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">Virtual network link latency</span>
        </div>

        {/* Timeout Duration */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>Timeout Timer</span>
            <span className="font-mono text-indigo-400">{config.timeoutMs} ms</span>
          </div>
          <input
            type="range"
            min={50}
            max={800}
            step={25}
            disabled={disabled}
            value={config.timeoutMs}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onUpdateConfig((prev) => ({ ...prev, timeoutMs: val }));
            }}
            className="w-full accent-indigo-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">ACK timeout threshold</span>
        </div>

        {/* Frame Loss Rate */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>DATA Frame Loss</span>
            <span className="font-mono text-amber-400">{Math.round(config.frameLossRate * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            disabled={disabled}
            value={config.frameLossRate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateConfig((prev) => ({ ...prev, frameLossRate: val }));
            }}
            className="w-full accent-amber-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">Forward channel drop rate</span>
        </div>

        {/* ACK Loss Rate */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>ACK Loss Rate</span>
            <span className="font-mono text-amber-400">{Math.round(config.ackLossRate * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            disabled={disabled}
            value={config.ackLossRate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateConfig((prev) => ({ ...prev, ackLossRate: val }));
            }}
            className="w-full accent-amber-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">Reverse channel drop rate</span>
        </div>

        {/* Retry Limit */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>Retry Limit</span>
            <span className="font-mono text-indigo-400">{config.maxRetries}</span>
          </div>
          <input
            type="number"
            min={1}
            max={10}
            disabled={disabled}
            value={config.maxRetries}
            onChange={(e) => {
              const val = Math.max(1, parseInt(e.target.value) || 1);
              onUpdateConfig((prev) => ({ ...prev, maxRetries: val }));
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">Retries before failure</span>
        </div>

        {/* Seed */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
            <span>PRNG Seed</span>
            <button
              type="button"
              disabled={disabled}
              onClick={handleRandomSeed}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Randomize
            </button>
          </div>
          <input
            type="number"
            disabled={disabled}
            value={config.seed}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              onUpdateConfig((prev) => ({ ...prev, seed: val }));
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">Reproducible pseudo-random seed</span>
        </div>
      </div>
    </div>
  );
};

