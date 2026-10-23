import { describe, it, expect } from 'vitest';
import {
  SimulationEngine,
  SimulationConfig,
  validateSimulationConfig,
} from '@agent';
import { PROTOCOL_INFO as PROTOS } from '../src/types/visualizer';

describe('Frontend Visualizer Engine Integration Tests', () => {
  const testConfig: SimulationConfig = {
    protocol: 'stop-and-wait',
    payloads: ['Packet #0', 'Packet #1'],
    windowSize: 1,
    seqNumberSpace: 2,
    seed: 1234,
    oneWayDelayMs: 20,
    frameLossRate: 0,
    ackLossRate: 0,
    timeoutMs: 100,
    maxRetries: 3,
    tickStepMs: 10,
  };

  it('1. Protocol metadata covers all three required protocols', () => {
    expect(PROTOS['stop-and-wait']).toBeDefined();
    expect(PROTOS['go-back-n']).toBeDefined();
    expect(PROTOS['selective-repeat']).toBeDefined();

    expect(PROTOS['stop-and-wait'].name).toBe('Stop-and-Wait ARQ');
    expect(PROTOS['go-back-n'].name).toBe('Go-Back-N ARQ');
    expect(PROTOS['selective-repeat'].name).toBe('Selective Repeat ARQ');
  });

  it('2. Switching protocol configuration constraints enforces mathematical rules', () => {
    // Stop-and-Wait: N=1, M=2
    const saw = validateSimulationConfig({ ...testConfig, protocol: 'stop-and-wait' });
    expect(saw.windowSize).toBe(1);
    expect(saw.seqNumberSpace).toBe(2);

    // Go-Back-N: M > N
    const gbn = validateSimulationConfig({
      ...testConfig,
      protocol: 'go-back-n',
      windowSize: 4,
      seqNumberSpace: 8,
    });
    expect(gbn.windowSize).toBe(4);
    expect(gbn.seqNumberSpace).toBe(8);

    // Selective Repeat: M >= 2N
    const sr = validateSimulationConfig({
      ...testConfig,
      protocol: 'selective-repeat',
      windowSize: 4,
      seqNumberSpace: 8,
    });
    expect(sr.windowSize).toBe(4);
    expect(sr.seqNumberSpace).toBe(8);

    // Selective Repeat rejects M < 2N
    expect(() =>
      validateSimulationConfig({
        ...testConfig,
        protocol: 'selective-repeat',
        windowSize: 4,
        seqNumberSpace: 6,
      })
    ).toThrow(/M \(6\) >= 2 \* window size N \(8\)/);
  });

  it('3. Configuration fields and validation feedback', () => {
    // Negative delay rejected
    expect(() =>
      validateSimulationConfig({ ...testConfig, oneWayDelayMs: -5 })
    ).toThrow(/oneWayDelayMs/);

    // Invalid loss rate rejected
    expect(() =>
      validateSimulationConfig({ ...testConfig, frameLossRate: 1.2 })
    ).toThrow(/frameLossRate/);

    // Empty payloads rejected
    expect(() =>
      validateSimulationConfig({ ...testConfig, payloads: [] })
    ).toThrow(/payloads/i);
  });

  it('4. Starting a simulation using the real engine initializes state', () => {
    const engine = new SimulationEngine(testConfig);
    expect(engine.getStatus()).toBe('READY');
    expect(engine.getVirtualTime()).toBe(0);

    engine.start();
    expect(engine.getStatus()).toBe('RUNNING');
    expect(engine.getEvents().length).toBeGreaterThan(0);
    expect(engine.getEvents()[0].type).toBe('SIMULATION_STARTED');
  });

  it('5. Pause and resume control states behave properly', () => {
    const engine = new SimulationEngine(testConfig);
    engine.start();
    expect(engine.getStatus()).toBe('RUNNING');

    engine.pause();
    expect(engine.getStatus()).toBe('PAUSED');

    const timeAtPause = engine.getVirtualTime();
    engine.step(50); // Step while paused does not advance
    expect(engine.getVirtualTime()).toBe(timeAtPause);

    engine.resume();
    expect(engine.getStatus()).toBe('RUNNING');
  });

  it('6. Step and reset behavior', () => {
    const engine = new SimulationEngine({ ...testConfig, tickStepMs: 15 });
    expect(engine.getVirtualTime()).toBe(0);

    engine.step(15);
    expect(engine.getVirtualTime()).toBe(15);

    engine.step(30);
    expect(engine.getVirtualTime()).toBe(45);

    engine.reset();
    expect(engine.getStatus()).toBe('READY');
    expect(engine.getVirtualTime()).toBe(0);
    expect(engine.getEvents().length).toBe(0);
  });

  it('7. Rendering actual simulation events in the timeline', () => {
    const engine = new SimulationEngine({
      ...testConfig,
      protocol: 'go-back-n',
      payloads: ['Alpha', 'Beta'],
      windowSize: 2,
      seqNumberSpace: 4,
    });

    engine.runToCompletion();
    const events = engine.getEvents();

    expect(events.length).toBeGreaterThan(0);
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('SIMULATION_STARTED');
    expect(eventTypes).toContain('FRAME_TRANSMITTED');
    expect(eventTypes).toContain('FRAME_DELIVERED');
    expect(eventTypes).toContain('PAYLOAD_DELIVERED');
    expect(eventTypes).toContain('ACK_TRANSMITTED');
    expect(eventTypes).toContain('SIMULATION_COMPLETED');
  });

  it('8. Statistics rendering and empty states', () => {
    const engine = new SimulationEngine(testConfig);
    const initialStats = engine.getStatistics();

    expect(initialStats.totalFramesSent).toBe(0);
    expect(initialStats.payloadsDelivered).toBe(0);
    expect(initialStats.throughputPayloadsPerSec).toBe(0);
    expect(initialStats.deliverySuccessRatio).toBe(0);

    engine.runToCompletion();
    const finalStats = engine.getStatistics();
    expect(finalStats.payloadsDelivered).toBe(2);
    expect(finalStats.deliverySuccessRatio).toBe(1);
    expect(finalStats.throughputPayloadsPerSec).toBeGreaterThan(0);
  });

  it('9. Simulation completion and failure handling', () => {
    // 100% loss causes retry exhaustion and fails
    const failingEngine = new SimulationEngine({
      ...testConfig,
      payloads: ['Doomed'],
      frameLossRate: 1.0,
      maxRetries: 2,
      timeoutMs: 50,
    });

    failingEngine.runToCompletion();
    expect(['FAILED', 'STOPPED']).toContain(failingEngine.getStatus());
    const stats = failingEngine.getStatistics();
    expect(stats.payloadsDelivered).toBe(0);
    expect(stats.retransmissions).toBeGreaterThanOrEqual(1);
  });

  it('10. Selective Repeat out-of-order buffering telemetry', () => {
    const srEngine = new SimulationEngine({
      protocol: 'selective-repeat',
      payloads: ['P0', 'P1', 'P2'],
      windowSize: 3,
      seqNumberSpace: 8,
      seed: 42,
      oneWayDelayMs: 20,
      frameLossRate: 0,
      ackLossRate: 0,
      timeoutMs: 150,
      maxRetries: 3,
    });

    srEngine.runToCompletion();
    expect(srEngine.getStatus()).toBe('COMPLETED');
    expect(srEngine.getDeliveredPayloads()).toEqual(['P0', 'P1', 'P2']);
  });
});
