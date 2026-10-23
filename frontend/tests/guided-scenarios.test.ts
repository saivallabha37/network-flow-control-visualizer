import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '@agent';
import { GUIDED_SCENARIOS } from '../src/types/scenarios.js';

describe('Guided Lab Scenarios Validation', () => {
  it('validates loss-free baseline: completes with 0 drops and 0 retransmissions', () => {
    const scenario = GUIDED_SCENARIOS.find((s) => s.id === 'loss-free-baseline')!;
    expect(scenario).toBeDefined();

    const engine = new SimulationEngine(scenario.config);
    const stats = engine.runToCompletion();

    expect(engine.getStatus()).toBe('COMPLETED');
    expect(stats.framesDropped).toBe(0);
    expect(stats.acksDropped).toBe(0);
    expect(stats.retransmissions).toBe(0);
    expect(stats.payloadsDelivered).toBe(scenario.config.payloads.length);
  });

  it('validates high-latency link: handles higher delay with Stop-and-Wait correctly', () => {
    const scenario = GUIDED_SCENARIOS.find((s) => s.id === 'high-latency-link')!;
    expect(scenario).toBeDefined();
    expect(scenario.config.oneWayDelayMs).toBe(150);

    const engine = new SimulationEngine(scenario.config);
    const stats = engine.runToCompletion();

    expect(engine.getStatus()).toBe('COMPLETED');
    expect(stats.payloadsDelivered).toBe(scenario.config.payloads.length);
    // 4 payloads with 300ms RTT per payload = at least 1200ms duration
    expect(stats.simulationDurationMs).toBeGreaterThanOrEqual(1200);
  });

  it('validates Go-Back-N loss recovery: drops a frame and triggers retransmissions', () => {
    const scenario = GUIDED_SCENARIOS.find((s) => s.id === 'go-back-n-recovery')!;
    expect(scenario).toBeDefined();

    const engine = new SimulationEngine(scenario.config);
    const stats = engine.runToCompletion();

    expect(engine.getStatus()).toBe('COMPLETED');
    expect(stats.framesDropped).toBeGreaterThan(0);
    expect(stats.retransmissions).toBeGreaterThan(0);
    expect(stats.payloadsDelivered).toBe(scenario.config.payloads.length);
  });

  it('validates Selective Repeat buffering: drops a frame and triggers individual retransmission with cascade delivery', () => {
    const scenario = GUIDED_SCENARIOS.find((s) => s.id === 'selective-repeat-buffering')!;
    expect(scenario).toBeDefined();

    const engine = new SimulationEngine(scenario.config);
    const stats = engine.runToCompletion();

    expect(engine.getStatus()).toBe('COMPLETED');
    expect(stats.framesDropped).toBeGreaterThan(0);
    expect(stats.retransmissions).toBeGreaterThan(0);
    expect(stats.payloadsDelivered).toBe(scenario.config.payloads.length);

    // Verify buffered event occurred
    const events = engine.getEvents();
    const hasBuffered = events.some((e) => e.type === 'FRAME_BUFFERED');
    expect(hasBuffered).toBe(true);
  });

  it('validates ACK loss recovery: recovers from lost ACKs and completes successfully', () => {
    const scenario = GUIDED_SCENARIOS.find((s) => s.id === 'ack-loss')!;
    expect(scenario).toBeDefined();

    const engine = new SimulationEngine(scenario.config);
    const stats = engine.runToCompletion();

    expect(engine.getStatus()).toBe('COMPLETED');
    expect(stats.acksDropped).toBeGreaterThan(0);
    expect(stats.payloadsDelivered).toBe(scenario.config.payloads.length);
  });
});
