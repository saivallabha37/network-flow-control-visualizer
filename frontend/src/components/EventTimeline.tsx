import React, { useState, useEffect, useRef } from 'react';
import { SimulationEvent } from '@agent';
import { ListFilter, ArrowDownCircle } from 'lucide-react';

interface EventTimelineProps {
  events: ReadonlyArray<SimulationEvent>;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'FRAME_TRANSMITTED':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
      case 'ACK_TRANSMITTED':
      case 'ACK_DELIVERED':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'FRAME_DROPPED':
      case 'ACK_DROPPED':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-semibold';
      case 'FRAME_CORRUPTED':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-semibold';
      case 'TIMEOUT':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold';
      case 'RETRANSMISSION':
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      case 'PAYLOAD_DELIVERED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold';
      case 'SIMULATION_COMPLETED':
        return 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40 font-bold';
      case 'SIMULATION_FAILED':
      case 'SIMULATION_STOPPED':
        return 'bg-rose-600/20 text-rose-200 border-rose-500/40 font-bold';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col h-[380px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2">
          <ListFilter className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Chronological Event Timeline</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {events.length} events
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAutoScroll((prev) => !prev)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
            autoScroll
              ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
          title="Toggle automatic scrolling to latest event"
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          <span>Auto-scroll</span>
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs mt-2 pr-1"
      >
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs italic">
            <span>No simulation events recorded yet.</span>
            <span className="text-[11px] mt-1 text-slate-600">Start the simulation to inspect protocol telemetry.</span>
          </div>
        ) : (
          events.map((evt) => {
            const isSelected = selectedEventId === evt.id;
            const badgeClass = getEventBadge(evt.type);

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(isSelected ? null : evt.id)}
                className={`py-2 px-2.5 rounded-md transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-indigo-950/50 border border-indigo-500/50'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className="text-[11px] text-slate-500 shrink-0 w-14">
                    +{evt.virtualTimestamp}ms
                  </span>

                  <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                    {evt.type}
                  </span>

                  <span className="text-slate-300 truncate text-[11px]">
                    {evt.details.description || evt.type}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-[10px] text-slate-500 shrink-0">
                  {evt.details.seqNum !== undefined && (
                    <span className="text-indigo-400">Seq #{evt.details.seqNum}</span>
                  )}
                  {evt.details.ackNum !== undefined && (
                    <span className="text-cyan-400">ACK #{evt.details.ackNum}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

