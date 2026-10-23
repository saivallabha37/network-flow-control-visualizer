import { ProtocolType } from '@agent';
import { PROTOCOL_INFO } from '../types/visualizer';
import { CheckCircle2 } from 'lucide-react';

interface ProtocolSelectorProps {
  selectedProtocol: ProtocolType;
  onSelectProtocol: (protocol: ProtocolType) => void;
  disabled?: boolean;
}

export const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({
  selectedProtocol,
  onSelectProtocol,
  disabled = false,
}) => {
  const protocols: ProtocolType[] = ['stop-and-wait', 'go-back-n', 'selective-repeat'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Flow Control Protocol
        </label>
        <span className="text-[11px] text-slate-500">IEEE / Computer Networks Standard</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {protocols.map((protoKey) => {
          const info = PROTOCOL_INFO[protoKey];
          const isSelected = selectedProtocol === protoKey;

          return (
            <button
              key={protoKey}
              type="button"
              disabled={disabled}
              onClick={() => onSelectProtocol(protoKey)}
              className={`p-4 rounded-xl text-left transition-all border relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-950/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className={`font-semibold text-sm ${isSelected ? 'text-indigo-200' : 'text-slate-200'}`}>
                    {info.name}
                  </h3>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {info.tagline}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono">
                  {protoKey === 'stop-and-wait'
                    ? 'N=1 (1-frame)'
                    : protoKey === 'go-back-n'
                    ? 'N>1, M>N (cumul.)'
                    : 'N>1, M>=2N (indiv.)'}
                </span>
                <span className="text-indigo-400/90 font-medium">
                  {info.category}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

