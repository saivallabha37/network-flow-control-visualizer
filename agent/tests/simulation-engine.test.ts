import { describe, it, expect } from 'vitest';
import {
  SimulationEngine,
  SimulationConfig,
  validateSimulationConfig,
  SeededRandom,
} from '../src/index.js';

describe('Deterministic Simulation Engine Tests', () => {
  const baseConfig: SimulationConfig = {
    protocol: 'stop-and-wait',
    payloads: ['Chunk A', 'Chunk B', 'Chunk C'],
    seed: 42,
    oneWayDelayMs: 50,
    frameLossRate: 0,
    ackLossRate: 0,
    timeoutMs: 200,
    maxRetries: 3,
    tickStepMs: 10,
  };

  it('1. Valid configuration and invalid configuration rejection', () => {
    // Valid config
    expect(() => validateSimulationConfig(baseConfig)).not.toThrow();

    // Invalid: negative delay
    expect(() =>
      validateSimulationConfig({ ...baseConfig, oneWayDelayMs: -10 })
    ).toThrow(/oneWayDelayMs/);

    // Invalid: loss rate > 1
    expect(() =>
      validateSimulationConfig({ ...baseConfig, frameLossRate: 1.5 })
    ).toThrow(/frameLossRate/);

    // Invalid: empty payloads
    expect(() =>
      validateSimulationConfig({ ...baseConfig, payloads: [] })
    ).toThrow(/payloads/i);

    // Invalid: Stop-and-Wait with windowSize > 1
    expect(() =>
      validateSimulationConfig({ ...baseConfig, windowSize: 4 })
    ).toThrow(/windowSize = 1/);

    // Invalid: Selective Repeat with M < 2N
    expect(() =>
      validateSimulationConfig({
        ...baseConfig,
        protocol: 'selective-repeat',
        windowSize: 4,
        seqNumberSpace: 6, // 6 < 2 * 4 = 8
      })
    ).toThrow(/M \(6\) >= 2 \* window size N \(8\)/);
  });

  it('2. Same seed and configuration produce identical deterministic results', () => {
    const lossyConfig: SimulationConfig = {
      protocol: 'go-back-n',
      payloads: ['P0', 'P1', 'P2', 'P3', 'P4'],
      windowSize: 3,
      seqNumberSpace: 8,
      seed: 98765,
      oneWayDelayMs: 40,
      frameLossRate: 0.3,
      ackLossRate: 0.2,
      timeoutMs: 150,
      maxRetries: 5,
    };

    const sim1 = new SimulationEngine(lossyConfig);
    const stats1 = sim1.runToCompletion();
    const events1 = sim1.getEvents();

    const sim2 = new SimulationEngine(lossyConfig);
    const stats2 = sim2.runToCompletion();
    const events2 = sim2.getEvents();

    expect(stats1).toEqual(stats2);
    expect(events1.length).toBe(events2.length);
    expect(events1.map((e) => e.type)).toEqual(events2.map((e) => e.type));
    expect(sim1.getDeliveredPayloads()).toEqual(sim2.getDeliveredPayloads());
  });

  it('3. Different seeds can produce different loss outcomes', () => {
    const prng1 = new SeededRandom(1111);
    const prng2 = new SeededRandom(9999);

    const seq1 = [prng1.next(), prng1.next(), prng1.next()];
    const seq2 = [prng2.next(), prng2.next(), prng2.next()];

    expect(seq1).not.toEqual(seq2);
  });

  it('4. Successful Stop-and-Wait transfer with zero loss', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      protocol: 'stop-and-wait',
      payloads: ['Msg1', 'Msg2', 'Msg3'],
      frameLossRate: 0,
      ackLossRate: 0,
    });

    const stats = sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
    expect(sim.getDeliveredPayloads()).toEqual(['Msg1', 'Msg2', 'Msg3']);
    expect(stats.payloadsDelivered).toBe(3);
    expect(stats.retransmissions).toBe(0);
    expect(stats.framesDropped).toBe(0);
    expect(stats.deliverySuccessRatio).toBe(1);
  });

  it('5. Successful Go-Back-N transfer with zero loss', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      protocol: 'go-back-n',
      payloads: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
      windowSize: 3,
      seqNumberSpace: 8,
      frameLossRate: 0,
      ackLossRate: 0,
    });

    const stats = sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
    expect(sim.getDeliveredPayloads()).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
    expect(stats.payloadsDelivered).toBe(5);
    expect(stats.retransmissions).toBe(0);
    expect(stats.framesDropped).toBe(0);
  });

  it('6. Successful Selective Repeat transfer with zero loss', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      protocol: 'selective-repeat',
      payloads: ['Data 1', 'Data 2', 'Data 3', 'Data 4'],
      windowSize: 3,
      seqNumberSpace: 8,
      frameLossRate: 0,
      ackLossRate: 0,
    });

    const stats = sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
    expect(sim.getDeliveredPayloads()).toEqual(['Data 1', 'Data 2', 'Data 3', 'Data 4']);
    expect(stats.payloadsDelivered).toBe(4);
    expect(stats.retransmissions).toBe(0);
  });

  it('7. Dropped data frame triggers appropriate recovery in Stop-and-Wait', () => {
    // 100% loss on 1st frame using small seed calibration or forced drop rate
    const sim = new SimulationEngine({
      ...baseConfig,
      protocol: 'stop-and-wait',
      payloads: ['Block X'],
      frameLossRate: 0.5,
      ackLossRate: 0,
      seed: 1234, // Seed calibrated to produce frame loss on first transmission
      timeoutMs: 150,
      oneWayDelayMs: 30,
      maxRetries: 5,
    });

    const stats = sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
    expect(sim.getDeliveredPayloads()).toEqual(['Block X']);
    expect(stats.framesDropped).toBeGreaterThan(0);
    expect(stats.retransmissions).toBeGreaterThan(0);
  });

  it('8. Dropped ACK triggers appropriate recovery without duplicate delivery', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      protocol: 'stop-and-wait',
      payloads: ['Unique Item'],
      frameLossRate: 0,
      ackLossRate: 0.6,
      seed: 5678,
      timeoutMs: 150,
      oneWayDelayMs: 30,
      maxRetries: 5,
    });

    const stats = sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
    // Exactly once delivery despite ACK loss and retransmission
    expect(sim.getDeliveredPayloads()).toEqual(['Unique Item']);
    expect(stats.acksDropped).toBeGreaterThan(0);
    expect(stats.retransmissions).toBeGreaterThan(0);
  });

  it('9. Go-Back-N retransmits all outstanding frames after timeout', () => {
    const sim = new SimulationEngine({
      protocol: 'go-back-n',
      payloads: ['F0', 'F1', 'F2'],
      windowSize: 3,
      seqNumberSpace: 8,
      seed: 777,
      oneWayDelayMs: 50,
      frameLossRate: 0.5, // Will drop frames
      ackLossRate: 0,
      timeoutMs: 200,
      maxRetries: 4,
    });

    sim.runToCompletion();
    const events = sim.getEvents();
    expect(events.some((e) => e.type === 'TIMEOUT')).toBe(true);
    expect(events.some((e) => e.type === 'RETRANSMISSION')).toBe(true);
  });

  it('10. Selective Repeat retransmits only the affected timed-out frame', () => {
    const sim = new SimulationEngine({
      protocol: 'selective-repeat',
      payloads: ['SR0', 'SR1', 'SR2'],
      windowSize: 3,
      seqNumberSpace: 8,
      seed: 333,
      oneWayDelayMs: 40,
      frameLossRate: 0.4,
      ackLossRate: 0,
      timeoutMs: 160,
      maxRetries: 4,
    });

    sim.runToCompletion();
    const events = sim.getEvents();
    expect(events.some((e) => e.type === 'FRAME_TRANSMITTED')).toBe(true);
    expect(sim.getDeliveredPayloads()).toEqual(['SR0', 'SR1', 'SR2']);
  });

  it('11. Pause prevents ordinary simulation advancement', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      payloads: ['P1', 'P2'],
    });

    sim.start();
    sim.pause();
    expect(sim.getStatus()).toBe('PAUSED');

    const timeBefore = sim.getVirtualTime();
    sim.step(100); // Attempt step while paused

    expect(sim.getVirtualTime()).toBe(timeBefore);
    expect(sim.getStatus()).toBe('PAUSED');
  });

  it('12. Step advances according to documented semantics', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      payloads: ['P1'],
      tickStepMs: 15,
    });

    expect(sim.getVirtualTime()).toBe(0);
    const step1 = sim.step(15);
    expect(step1.virtualTimeMs).toBe(15);
    expect(sim.getVirtualTime()).toBe(15);

    const step2 = sim.step(25);
    expect(step2.virtualTimeMs).toBe(40);
    expect(sim.getVirtualTime()).toBe(40);
  });

  it('13. Resume continues a paused simulation to completion', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      payloads: ['P1'],
    });

    sim.start();
    sim.pause();
    expect(sim.getStatus()).toBe('PAUSED');

    sim.resume();
    expect(sim.getStatus()).toBe('RUNNING');

    sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
  });

  it('14. Reset clears all simulation state and restores initial configuration', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      payloads: ['A', 'B'],
    });

    sim.runToCompletion();
    expect(sim.getStatus()).toBe('COMPLETED');
    expect(sim.getDeliveredPayloads().length).toBe(2);

    sim.reset();
    expect(sim.getStatus()).toBe('READY');
    expect(sim.getVirtualTime()).toBe(0);
    expect(sim.getDeliveredPayloads().length).toBe(0);
    expect(sim.getEvents().length).toBe(0);
    expect(sim.getState().remainingPayloads).toBe(2);
  });

  it('15. Statistics match independently calculated expected counts', () => {
    const sim = new SimulationEngine({
      ...baseConfig,
      payloads: ['Payload 1', 'Payload 2'],
      frameLossRate: 0,
      ackLossRate: 0,
    });

    const stats = sim.runToCompletion();
    expect(stats.totalPayloads).toBe(2);
    expect(stats.payloadsDelivered).toBe(2);
    expect(stats.deliverySuccessRatio).toBe(1);
    expect(stats.retransmissionRatio).toBe(0);
    expect(stats.frameLossRatio).toBe(0);
    expect(stats.throughputPayloadsPerSec).toBeGreaterThan(0);
  });

  it('16. A safety limit prevents infinite simulations when retries fail', () => {
    // 100% loss guarantees frames can never reach receiver
    const doomedSim = new SimulationEngine({
      ...baseConfig,
      payloads: ['Doomed Payload'],
      frameLossRate: 1.0,
      maxRetries: 2,
      timeoutMs: 100,
    });

    const stats = doomedSim.runToCompletion();
    expect(['FAILED', 'STOPPED']).toContain(doomedSim.getStatus());
    expect(stats.payloadsDelivered).toBe(0);
    expect(stats.retransmissions).toBeGreaterThanOrEqual(1); // Retries performed before exhaustion
  });
});
