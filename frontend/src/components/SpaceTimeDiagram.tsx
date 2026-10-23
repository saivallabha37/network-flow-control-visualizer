import React, { useMemo, useRef, useEffect, useState } from 'react';
import { SimulationEvent } from '@agent';
import { ZoomIn, ZoomOut, Maximize2, GitCommit, ArrowDown, ArrowUp } from 'lucide-react';

interface SpaceTimeDiagramProps {
  events: ReadonlyArray<SimulationEvent>;
  virtualTimeMs: number;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  oneWayDelayMs?: number;
}

interface DiagramTransmission {
  id: string;
  type: 'DATA' | 'ACK';
  num: number; // seqNum or ackNum
  departureTime: number;
  outcomeTime?: number;
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DROPPED' | 'CORRUPTED';
  isRetransmission: boolean;
  startEventId: string;
  endEventId?: string;
  description: string;
}

interface TimeoutMarker {
  id: string;
  timestamp: number;
  description: string;
}

export const SpaceTimeDiagram: React.FC<SpaceTimeDiagramProps> = ({
  events,
  virtualTimeMs,
  selectedEventId,
  onSelectEvent,
  oneWayDelayMs = 60,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(0.8); // pixels per ms
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Parse events into space-time packet trajectories and timeout markers
  const { transmissions, timeouts } = useMemo(() => {
    const list: DiagramTransmission[] = [];
    const timeoutList: TimeoutMarker[] = [];

    // Track active transmissions in flight for pairing
    const activeDataQueue: DiagramTransmission[] = [];
    const activeAckQueue: DiagramTransmission[] = [];

    for (const evt of events) {
      if (evt.type === 'FRAME_TRANSMITTED') {
        const item: DiagramTransmission = {
          id: `tx-${evt.id}`,
          type: 'DATA',
          num: evt.details.seqNum ?? 0,
          departureTime: evt.virtualTimestamp,
          status: 'IN_FLIGHT',
          isRetransmission: Boolean(evt.details.isRetransmission),
          startEventId: evt.id,
          description: evt.details.description,
        };
        list.push(item);
        activeDataQueue.push(item);
      } else if (evt.type === 'FRAME_DELIVERED') {
        const seq = evt.details.seqNum;
        const matchIdx = activeDataQueue.findIndex((item) => item.num === seq);
        if (matchIdx >= 0) {
          const item = activeDataQueue.splice(matchIdx, 1)[0];
          item.outcomeTime = evt.virtualTimestamp;
          item.status = 'DELIVERED';
          item.endEventId = evt.id;
        }
      } else if (evt.type === 'FRAME_DROPPED') {
        const seq = evt.details.seqNum;
        const matchIdx = activeDataQueue.findIndex((item) => item.num === seq);
        if (matchIdx >= 0) {
          const item = activeDataQueue.splice(matchIdx, 1)[0];
          item.outcomeTime = evt.virtualTimestamp;
          item.status = 'DROPPED';
          item.endEventId = evt.id;
        }
      } else if (evt.type === 'FRAME_CORRUPTED') {
        const seq = evt.details.seqNum;
        const match = activeDataQueue.find((item) => item.num === seq);
        if (match) {
          match.status = 'CORRUPTED';
        }
      } else if (evt.type === 'ACK_TRANSMITTED') {
        const item: DiagramTransmission = {
          id: `tx-${evt.id}`,
          type: 'ACK',
          num: evt.details.ackNum ?? 0,
          departureTime: evt.virtualTimestamp,
          status: 'IN_FLIGHT',
          isRetransmission: false,
          startEventId: evt.id,
          description: evt.details.description,
        };
        list.push(item);
        activeAckQueue.push(item);
      } else if (evt.type === 'ACK_DELIVERED') {
        const ack = evt.details.ackNum;
        const matchIdx = activeAckQueue.findIndex((item) => item.num === ack);
        if (matchIdx >= 0) {
          const item = activeAckQueue.splice(matchIdx, 1)[0];
          item.outcomeTime = evt.virtualTimestamp;
          item.status = 'DELIVERED';
          item.endEventId = evt.id;
        }
      } else if (evt.type === 'ACK_DROPPED') {
        const ack = evt.details.ackNum;
        const matchIdx = activeAckQueue.findIndex((item) => item.num === ack);
        if (matchIdx >= 0) {
          const item = activeAckQueue.splice(matchIdx, 1)[0];
          item.outcomeTime = evt.virtualTimestamp;
          item.status = 'DROPPED';
          item.endEventId = evt.id;
        }
      } else if (evt.type === 'TIMEOUT') {
        timeoutList.push({
          id: evt.id,
          timestamp: evt.virtualTimestamp,
          description: evt.details.description,
        });
      }
    }

    return { transmissions: list, timeouts: timeoutList };
  }, [events]);

  // Diagram geometry
  const maxTime = Math.max(virtualTimeMs, 300);
  const topPadding = 40;
  const bottomPadding = 60;
  const totalHeight = Math.max(380, topPadding + maxTime * zoomLevel + bottomPadding);

  const senderX = 90;
  const receiverX = 460;
  const svgWidth = 550;

  // Auto-scroll downward as virtual time advances
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      const targetY = topPadding + virtualTimeMs * zoomLevel;
      scrollContainerRef.current.scrollTop = Math.max(0, targetY - 180);
    }
  }, [virtualTimeMs, zoomLevel, autoScroll]);

  // Generate periodic time tick marks on the time axis
  const timeTicks: number[] = [];
  const tickStep = zoomLevel > 1.2 ? 50 : zoomLevel > 0.6 ? 100 : 200;
  for (let t = 0; t <= maxTime + 100; t += tickStep) {
    timeTicks.push(t);
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <GitCommit className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-white text-sm">Space-Time Sequence Diagram</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            Ladder Sequence
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[11px] mr-1">Zoom:</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.3, z - 0.2))}
              aria-label="Zoom Out"
              className="p-1 hover:text-white text-slate-400 rounded transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-slate-200 text-[10px] w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              aria-label="Zoom In"
              className="p-1 hover:text-white text-slate-400 rounded transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors flex items-center gap-1 ${
              autoScroll
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 font-medium'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            {autoScroll ? 'Auto-Follow On' : 'Auto-Follow Off'}
          </button>
        </div>
      </div>

      {/* SVG Canvas Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="relative h-[420px] overflow-y-auto overflow-x-auto rounded-lg bg-slate-950/90 border border-slate-800/80 p-2"
      >
        {events.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs italic pointer-events-none z-10">
            <span>No space-time trajectories plotted yet.</span>
            <span className="text-[11px] mt-1 text-slate-600">Start the simulation or step forward to observe packet vectors.</span>
          </div>
        )}

        <svg
          width={svgWidth}
          height={totalHeight}
          className="mx-auto block selection:bg-none"
        >
          <defs>
            {/* Arrowhead marker: DATA Frame (Indigo) */}
            <marker
              id="arrow-data"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
            </marker>

            {/* Arrowhead marker: Retransmitted DATA Frame (Amber/Orange) */}
            <marker
              id="arrow-retx"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
            </marker>

            {/* Arrowhead marker: ACK Frame (Cyan) */}
            <marker
              id="arrow-ack"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
            </marker>
          </defs>

          {/* Time ticks and horizontal guides */}
          {timeTicks.map((t) => {
            const y = topPadding + t * zoomLevel;
            return (
              <g key={`tick-${t}`}>
                <line
                  x1={senderX - 45}
                  x2={receiverX + 45}
                  y1={y}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
                <text
                  x={senderX - 52}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {t}ms
                </text>
              </g>
            );
          })}

          {/* Vertical Timeline Axis: SENDER (Host A) */}
          <line
            x1={senderX}
            x2={senderX}
            y1={topPadding}
            y2={totalHeight - bottomPadding}
            stroke="#475569"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text
            x={senderX}
            y={topPadding - 16}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="bold"
          >
            Sender (Host A)
          </text>
          <text
            x={senderX}
            y={topPadding - 4}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="9"
            fontFamily="monospace"
          >
            t &darr;
          </text>

          {/* Vertical Timeline Axis: RECEIVER (Host B) */}
          <line
            x1={receiverX}
            x2={receiverX}
            y1={topPadding}
            y2={totalHeight - bottomPadding}
            stroke="#475569"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text
            x={receiverX}
            y={topPadding - 16}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="bold"
          >
            Receiver (Host B)
          </text>
          <text
            x={receiverX}
            y={topPadding - 4}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="9"
            fontFamily="monospace"
          >
            t &darr;
          </text>

          {/* Current Virtual Time Horizon Indicator */}
          {virtualTimeMs > 0 && (
            <g>
              <line
                x1={senderX - 10}
                x2={receiverX + 10}
                y1={topPadding + virtualTimeMs * zoomLevel}
                y2={topPadding + virtualTimeMs * zoomLevel}
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.8"
              />
              <text
                x={receiverX + 16}
                y={topPadding + virtualTimeMs * zoomLevel + 3}
                fill="#818cf8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                Now: {virtualTimeMs}ms
              </text>
            </g>
          )}

          {/* Render Trajectories: DATA Frames and ACKs */}
          {transmissions.map((tx) => {
            const isData = tx.type === 'DATA';
            const y1 = topPadding + tx.departureTime * zoomLevel;
            const x1 = isData ? senderX : receiverX;

            const targetX = isData ? receiverX : senderX;
            const arrivalTime =
              tx.outcomeTime ??
              (tx.status === 'IN_FLIGHT' ? tx.departureTime + oneWayDelayMs : tx.departureTime + oneWayDelayMs);

            const y2 = topPadding + arrivalTime * zoomLevel;

            // Check if selected
            const isSelected =
              selectedEventId === tx.startEventId ||
              (tx.endEventId && selectedEventId === tx.endEventId);

            // If dropped, trajectory stops halfway with an X indicator
            if (tx.status === 'DROPPED') {
              const midX = (x1 + targetX) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g
                  key={tx.id}
                  className="cursor-pointer group"
                  onClick={() => onSelectEvent(tx.startEventId)}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={midX}
                    y2={midY}
                    stroke="#f43f5e"
                    strokeWidth={isSelected ? '3' : '2'}
                    strokeDasharray="4 2"
                  />
                  {/* Drop Cross Icon */}
                  <circle cx={midX} cy={midY} r="7" fill="#881337" stroke="#f43f5e" strokeWidth="1.5" />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill="#ffe4e6"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    &times;
                  </text>
                  {/* Label */}
                  <text
                    x={(x1 + midX) / 2}
                    y={(y1 + midY) / 2 - 4}
                    textAnchor="middle"
                    fill="#f43f5e"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {isData ? `DATA #${tx.num} (LOST)` : `ACK #${tx.num} (LOST)`}
                  </text>
                </g>
              );
            }

            // Normal or Retransmission or In-Flight Trajectory
            let strokeColor = '#6366f1';
            let marker = 'url(#arrow-data)';

            if (!isData) {
              strokeColor = '#06b6d4';
              marker = 'url(#arrow-ack)';
            } else if (tx.isRetransmission) {
              strokeColor = '#f59e0b';
              marker = 'url(#arrow-retx)';
            }

            if (tx.status === 'CORRUPTED') {
              strokeColor = '#c084fc';
            }

            // Calculate endpoint if currently in flight
            let actualX2 = targetX;
            let actualY2 = y2;
            let currentMarker = marker;

            if (tx.status === 'IN_FLIGHT') {
              const elapsed = virtualTimeMs - tx.departureTime;
              const progress = Math.max(0, Math.min(1, elapsed / (oneWayDelayMs || 1)));
              actualX2 = x1 + (targetX - x1) * progress;
              actualY2 = y1 + (y2 - y1) * progress;
              currentMarker = ''; // No arrowhead while in mid-flight
            }

            const labelX = (x1 + actualX2) / 2;
            const labelY = (y1 + actualY2) / 2 - 4;

            return (
              <g
                key={tx.id}
                className="cursor-pointer group"
                onClick={() => onSelectEvent(tx.startEventId)}
              >
                {/* Hit target line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={actualX2}
                  y2={actualY2}
                  stroke="transparent"
                  strokeWidth="12"
                />
                {/* Visual Arrow Line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={actualX2}
                  y2={actualY2}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? '3.5' : tx.isRetransmission ? '2.5' : '2'}
                  strokeDasharray={tx.isRetransmission ? '4 2' : undefined}
                  markerEnd={currentMarker}
                  filter={isSelected ? 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.8))' : undefined}
                />
                {/* Sequence Label */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  fill={strokeColor}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {isData ? (tx.isRetransmission ? `DATA #${tx.num} (RETX)` : `DATA #${tx.num}`) : `ACK #${tx.num}`}
                </text>
              </g>
            );
          })}

          {/* Timeout Markers on Sender Axis */}
          {timeouts.map((to) => {
            const y = topPadding + to.timestamp * zoomLevel;
            return (
              <g
                key={to.id}
                className="cursor-pointer"
                onClick={() => onSelectEvent(to.id)}
              >
                <circle cx={senderX} cy={y} r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
                <rect
                  x={senderX + 8}
                  y={y - 8}
                  width="110"
                  height="16"
                  rx="3"
                  fill="#78350f"
                  stroke="#f59e0b"
                  strokeWidth="1"
                />
                <text
                  x={senderX + 14}
                  y={y + 3}
                  fill="#fef3c7"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  TIMEOUT EXPIRED
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Diagram Legend and Guidance */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800">
        <span className="font-semibold text-slate-300">Space-Time Notation:</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-indigo-500 inline-block" />
            <ArrowDown className="w-3 h-3 text-indigo-400 rotate-[-45deg]" />
            <span>DATA Transmission</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400 inline-block" />
            <span>Retransmitted DATA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-cyan-400 inline-block" />
            <ArrowUp className="w-3 h-3 text-cyan-400 rotate-[-45deg]" />
            <span>ACK Frame</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-900 border border-rose-500 inline-block" />
            <span>Dropped / Lost in Transit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Sender Timeout Trigger</span>
          </div>
        </div>
      </div>
    </div>
  );
};

