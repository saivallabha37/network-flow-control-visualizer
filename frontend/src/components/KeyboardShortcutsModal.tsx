import React, { useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  action: string;
  description: string;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts: ShortcutItem[] = [
    {
      key: 'Space',
      action: 'Play / Pause / Resume',
      description: 'Toggles between running and paused simulation states',
    },
    {
      key: 'S',
      action: 'Single Step',
      description: 'Advances virtual time by one discrete simulation tick',
    },
    {
      key: 'R',
      action: 'Reset',
      description: 'Restores the simulation to its initial state with fresh queues',
    },
    {
      key: 'C',
      action: 'Compare Protocols',
      description: 'Opens the side-by-side comparative performance benchmark',
    },
    {
      key: '1',
      action: 'Stop-and-Wait ARQ',
      description: 'Switches protocol to 1-frame Stop-and-Wait (when stopped/ready)',
    },
    {
      key: '2',
      action: 'Go-Back-N ARQ',
      description: 'Switches protocol to windowed Go-Back-N with cumulative ACKs',
    },
    {
      key: '3',
      action: 'Selective Repeat ARQ',
      description: 'Switches protocol to Selective Repeat with receiver buffering',
    },
    {
      key: 'Esc',
      action: 'Dismiss / Close',
      description: 'Closes dialogs, modals, and deselects inspected packets',
    },
    {
      key: '?',
      action: 'Shortcuts Help',
      description: 'Opens this keyboard shortcuts reference dialog',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 ring-1 ring-indigo-500/20">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 id="shortcuts-dialog-title" className="text-sm font-bold text-white flex items-center gap-2">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-slate-400">Quick navigation during demonstrations</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts dialog"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-200">{sc.action}</div>
                <div className="text-[11px] text-slate-400">{sc.description}</div>
              </div>
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-xs text-indigo-300 font-bold shadow-sm shrink-0 ml-3">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Command className="w-3.5 h-3.5 text-slate-400" /> Shortcuts active in Simulation Mode
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

