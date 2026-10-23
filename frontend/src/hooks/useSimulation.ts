import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulationConfig,
  SimulationEngine,
  SimulationEvent,
  SimulationState,
  SimulationStatistics,
  SimulationStatus,
  validateSimulationConfig,
} from '@agent';

export interface UseSimulationReturn {
  config: SimulationConfig;
  status: SimulationStatus;
  virtualTimeMs: number;
  engineState: SimulationState | null;
  events: ReadonlyArray<SimulationEvent>;
  statistics: SimulationStatistics | null;
  speedMs: number;
  error: string | null;
  selectedEventId: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  step: (stepSizeMs?: number) => void;
  reset: () => void;
  runToCompletion: () => void;
  setSpeed: (ms: number) => void;
  updateConfig: (updater: (prev: SimulationConfig) => SimulationConfig) => void;
  selectEvent: (id: string | null) => void;
}

export function useSimulation(initialConfig: SimulationConfig): UseSimulationReturn {
  const [config, setConfig] = useState<SimulationConfig>(initialConfig);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SimulationStatus>('READY');
  const [virtualTimeMs, setVirtualTimeMs] = useState<number>(0);
  const [events, setEvents] = useState<ReadonlyArray<SimulationEvent>>([]);
  const [engineState, setEngineState] = useState<SimulationState | null>(null);
  const [statistics, setStatistics] = useState<SimulationStatistics | null>(null);
  const [speedMs, setSpeedMs] = useState<number>(150); // Playback step delay in ms
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const engineRef = useRef<SimulationEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync state from engine instance
  const syncFromEngine = useCallback((eng: SimulationEngine) => {
    setStatus(eng.getStatus());
    setVirtualTimeMs(eng.getVirtualTime());
    setEvents(eng.getEvents());
    setEngineState(eng.getState());
    setStatistics(eng.getStatistics());
  }, []);

  // Initialize or re-create engine when config is applied/updated
  const initEngine = useCallback((cfg: SimulationConfig) => {
    try {
      validateSimulationConfig(cfg);
      const newEngine = new SimulationEngine(cfg);
      engineRef.current = newEngine;
      setError(null);
      syncFromEngine(newEngine);
      return newEngine;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    }
  }, [syncFromEngine]);

  // Initial mount
  useEffect(() => {
    initEngine(initialConfig);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback timer loop when status is RUNNING
  useEffect(() => {
    if (status === 'RUNNING') {
      timerRef.current = setInterval(() => {
        if (!engineRef.current) return;
        const result = engineRef.current.step();
        syncFromEngine(engineRef.current);

        if (
          result.status === 'COMPLETED' ||
          result.status === 'FAILED' ||
          result.status === 'STOPPED'
        ) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      }, speedMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, speedMs, syncFromEngine]);

  const start = useCallback(() => {
    if (!engineRef.current) {
      const eng = initEngine(config);
      if (!eng) return;
    }
    engineRef.current!.start();
    syncFromEngine(engineRef.current!);
  }, [config, initEngine, syncFromEngine]);

  const pause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
      syncFromEngine(engineRef.current);
    }
  }, [syncFromEngine]);

  const resume = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resume();
      syncFromEngine(engineRef.current);
    }
  }, [syncFromEngine]);

  const step = useCallback((stepSizeMs?: number) => {
    if (!engineRef.current) {
      const eng = initEngine(config);
      if (!eng) return;
    }
    engineRef.current!.step(stepSizeMs);
    syncFromEngine(engineRef.current!);
  }, [config, initEngine, syncFromEngine]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (engineRef.current) {
      engineRef.current.reset();
      syncFromEngine(engineRef.current);
    } else {
      initEngine(config);
    }
    setSelectedEventId(null);
  }, [config, initEngine, syncFromEngine]);

  const runToCompletion = useCallback(() => {
    if (!engineRef.current) {
      const eng = initEngine(config);
      if (!eng) return;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    engineRef.current!.runToCompletion();
    syncFromEngine(engineRef.current!);
  }, [config, initEngine, syncFromEngine]);

  const updateConfig = useCallback((updater: (prev: SimulationConfig) => SimulationConfig) => {
    setConfig((prev) => {
      const next = updater(prev);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      initEngine(next);
      return next;
    });
  }, [initEngine]);

  return {
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
    setSpeed: setSpeedMs,
    updateConfig,
    selectEvent: setSelectedEventId,
  };
}

