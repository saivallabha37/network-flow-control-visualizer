import { ProtocolType, SimulationConfig } from '@agent';
import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { ProtocolSelector } from './components/ProtocolSelector';
import { SimulationConfigPanel } from './components/SimulationConfigPanel';
import { SimulationControls } from './components/SimulationControls';
import { NetworkTopology } from './components/NetworkTopology';
import { EventTimeline } from './components/EventTimeline';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ProtocolExplanation } from './components/ProtocolExplanation';

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

  const isSimActive = status === 'RUNNING';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <Header status={status} virtualTimeMs={virtualTimeMs} />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
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

        {/* Central Network Topology & Packet Journey */}
        <NetworkTopology
          protocol={config.protocol}
          engineState={engineState}
          latestEvent={events[events.length - 1]}
          virtualTimeMs={virtualTimeMs}
        />

        {/* Two-Column Telemetry: Event Timeline & Performance Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <EventTimeline
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={selectEvent}
            />
          </div>

          <div className="lg:col-span-5">
            <StatisticsPanel
              statistics={statistics}
              virtualTimeMs={virtualTimeMs}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-4 text-xs text-slate-500 text-center flex flex-wrap items-center justify-between gap-2">
        <span>Network Flow Control Protocols Visualizer &mdash; Software Engineering Laboratory</span>
        <span className="font-mono text-slate-600">Phase 5 Interactive Frontend &bull; Verified Engine Integration</span>
      </footer>
    </div>
  );
}
