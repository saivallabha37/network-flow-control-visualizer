import { useState, useMemo, useEffect } from 'react';
import { ProtocolType, SimulationConfig, InFlightPacket } from '@agent';
import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { ProtocolSelector } from './components/ProtocolSelector';
import { SimulationConfigPanel } from './components/SimulationConfigPanel';
import { SimulationControls } from './components/SimulationControls';
import { NetworkTopology } from './components/NetworkTopology';
import { EventTimeline } from './components/EventTimeline';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ProtocolExplanation } from './components/ProtocolExplanation';
import { LiveNetworkingPanel } from './components/LiveNetworkingPanel';
import { SpaceTimeDiagram } from './components/SpaceTimeDiagram';
import { PacketInspector, PacketInspectorTarget } from './components/PacketInspector';
import { LabScenariosPanel } from './components/LabScenariosPanel';
import { ProtocolComparisonModal } from './components/ProtocolComparisonModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { GuidedScenario } from './types/scenarios';
import { Keyboard } from 'lucide-react';

const DEFAULT_CONFIG: SimulationConfig = {
  protocol: 'go-back-n',
  payloads: ['Packet #0', 'Packet #1', 'Packet #2', 'Packet #3', 'Packet #4', 'Packet #5'],
  windowSize: 4,
  seqNumberSpace: 8,
  seed: 42,
  oneWayDelayMs: 60,
  frameLossRate: 0.2,
  ackLossRate: 0.1,
  corruptionRate: 0,
  timeoutMs: 250,
  maxRetries: 4,
  tickStepMs: 15,
};

export default function App() {
  const [activeMode, setActiveMode] = useState<'simulation' | 'live'>('simulation');
  const [selectedInFlightPacket, setSelectedInFlightPacket] = useState<InFlightPacket | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const {
    config,
    status,
    virtualTimeMs,
    engineState,
    events,
    statistics,
    speedMs,
    error,
    selectedEventId,
    start,
    pause,
    resume,
    step,
    reset,
    runToCompletion,
    setSpeed,
    updateConfig,
    selectEvent,
  } = useSimulation(DEFAULT_CONFIG);

  const isSimActive = status === 'RUNNING';

  const handleSelectProtocol = (proto: ProtocolType) => {
    updateConfig((prev) => {
      let windowSize = prev.windowSize ?? 4;
      let seqNumberSpace = prev.seqNumberSpace ?? 8;

      if (proto === 'stop-and-wait') {
        windowSize = 1;
        seqNumberSpace = 2;
      } else if (proto === 'go-back-n') {
        windowSize = 4;
        seqNumberSpace = 8;
      } else if (proto === 'selective-repeat') {
        windowSize = 4;
        seqNumberSpace = 8; // 8 >= 2 * 4 satisfies M >= 2N
      }

      return {
        ...prev,
        protocol: proto,
        windowSize,
        seqNumberSpace,
      };
    });
  };

  // Keyboard accessibility shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (selectedInFlightPacket || selectedEventId) {
          setSelectedInFlightPacket(null);
          selectEvent(null);
        }
        if (isComparisonOpen) {
          setIsComparisonOpen(false);
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (status === 'RUNNING') {
          pause();
        } else if (status === 'PAUSED') {
          resume();
        } else if (status === 'READY') {
          start();
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (status !== 'RUNNING') {
          step();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      } else if (e.key === 'c' || e.key === 'C') {
        setIsComparisonOpen((prev) => !prev);
      } else if (e.key === '?') {
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === '1' && !isSimActive) {
        handleSelectProtocol('stop-and-wait');
      } else if (e.key === '2' && !isSimActive) {
        handleSelectProtocol('go-back-n');
      } else if (e.key === '3' && !isSimActive) {
        handleSelectProtocol('selective-repeat');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    status,
    isSimActive,
    selectedInFlightPacket,
    selectedEventId,
    isComparisonOpen,
    isShortcutsOpen,
    start,
    pause,
    resume,
    step,
    reset,
    selectEvent,
  ]);

  const handleSelectScenario = (scenario: GuidedScenario) => {
    updateConfig(() => scenario.config);
    reset();
  };

  // Correlate selected packet/event for Inspector
  const selectedEvent = useMemo(() => {
    return selectedEventId ? events.find((e) => e.id === selectedEventId) || null : null;
  }, [events, selectedEventId]);

  const inspectorTarget: PacketInspectorTarget | null = useMemo(() => {
    if (selectedInFlightPacket) {
      return { inFlightPacket: selectedInFlightPacket, event: null };
    }
    if (selectedEvent) {
      return { inFlightPacket: null, event: selectedEvent };
    }
    return null;
  }, [selectedInFlightPacket, selectedEvent]);

  const handleSelectInFlightPacket = (pkt: InFlightPacket) => {
    setSelectedInFlightPacket(pkt);
    // Pause playback so user can comfortably inspect
    if (status === 'RUNNING') {
      pause();
    }
  };

  const handleCloseInspector = () => {
    setSelectedInFlightPacket(null);
    selectEvent(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <Header
        status={status}
        virtualTimeMs={virtualTimeMs}
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        onOpenComparison={() => setIsComparisonOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeMode === 'live' ? (
          /* Live UDP Network Mode */
          <LiveNetworkingPanel />
        ) : (
          /* Deterministic Simulation Laboratory Mode */
          <>
            {/* Guided Scenarios Presets Panel */}
            <LabScenariosPanel
              currentConfig={config}
              onSelectScenario={handleSelectScenario}
              disabled={isSimActive}
            />

            {/* Protocol Selector */}
            <ProtocolSelector
              selectedProtocol={config.protocol}
              onSelectProtocol={handleSelectProtocol}
              disabled={isSimActive}
            />

            {/* Controls Toolbar */}
            <SimulationControls
              status={status}
              speedMs={speedMs}
              onStart={start}
              onPause={pause}
              onResume={resume}
              onStep={() => step()}
              onReset={reset}
              onRunToCompletion={runToCompletion}
              onSetSpeed={setSpeed}
            />

            {/* Central Network Topology & Channel Animation */}
            <NetworkTopology
              protocol={config.protocol}
              engineState={engineState}
              latestEvent={events[events.length - 1]}
              virtualTimeMs={virtualTimeMs}
              selectedPacketId={selectedInFlightPacket?.id}
              onSelectInFlightPacket={handleSelectInFlightPacket}
            />

            {/* Interactive Packet Inspector Modal/Panel */}
            {inspectorTarget && (
              <PacketInspector
                target={inspectorTarget}
                virtualTimeMs={virtualTimeMs}
                isPaused={status === 'PAUSED'}
                onPause={pause}
                onResume={resume}
                onClose={handleCloseInspector}
              />
            )}

            {/* Space-Time Sequence Diagram (Ladder / Bounce Diagram) */}
            <SpaceTimeDiagram
              events={events}
              virtualTimeMs={virtualTimeMs}
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => {
                selectEvent(id);
                setSelectedInFlightPacket(null);
              }}
              oneWayDelayMs={config.oneWayDelayMs}
            />

            {/* Two-Column Telemetry: Event Timeline & Performance Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <EventTimeline
                  events={events}
                  selectedEventId={selectedEventId}
                  onSelectEvent={(id) => {
                    selectEvent(id);
                    setSelectedInFlightPacket(null);
                  }}
                />
              </div>

              <div className="lg:col-span-5">
                <StatisticsPanel
                  statistics={statistics}
                  virtualTimeMs={virtualTimeMs}
                  protocol={config.protocol}
                  windowSize={config.windowSize}
                  oneWayDelayMs={config.oneWayDelayMs}
                />
              </div>
            </div>

            {/* Configuration Parameters Panel */}
            <SimulationConfigPanel
              config={config}
              onUpdateConfig={updateConfig}
              error={error}
              disabled={isSimActive}
            />

            {/* Protocol Mechanics & Educational Reference */}
            <ProtocolExplanation protocol={config.protocol} />

            {/* Protocol Comparison Benchmark Modal */}
            <ProtocolComparisonModal
              config={config}
              isOpen={isComparisonOpen}
              onClose={() => setIsComparisonOpen(false)}
              onSelectProtocol={handleSelectProtocol}
            />

            {/* Keyboard Shortcuts Reference Dialog */}
            <KeyboardShortcutsModal
              isOpen={isShortcutsOpen}
              onClose={() => setIsShortcutsOpen(false)}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-slate-400">
          <span>Network Flow Control Protocols Visualizer &mdash; Interactive Educational Laboratory</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Keyboard Shortcuts</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
