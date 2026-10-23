import { describe, it, expect } from 'vitest';
import { compareProtocols, SimulationConfig } from '@agent';

describe('Frontend Protocol Comparison Integration', () => {
  const sampleConfig: SimulationConfig = {
    protocol: 'go-back-n',
    payloads: ['Packet 0', 'Packet 1', 'Packet 2', 'Packet 3'],
    windowSize: 4,
    seqNumberSpace: 8,
    seed: 99,
    oneWayDelayMs: 50,
    frameLossRate: 0.1,
    ackLossRate: 0,
    corruptionRate: 0,
    timeoutMs: 250,
    maxRetries: 3,
  };

  it('runs protocol comparison and generates metrics for all 3 protocols', () => {
    const report = compareProtocols(sampleConfig);
    expect(report.results).toHaveLength(3);

    const saw = report.results.find((r) => r.protocol === 'stop-and-wait');
    const gbn = report.results.find((r) => r.protocol === 'go-back-n');
    const sr = report.results.find((r) => r.protocol === 'selective-repeat');

    expect(saw).toBeDefined();
    expect(gbn).toBeDefined();
    expect(sr).toBeDefined();

    expect(saw?.payloadsDelivered).toBe(4);
    expect(gbn?.payloadsDelivered).toBe(4);
    expect(sr?.payloadsDelivered).toBe(4);

    expect(report.keyInsights.length).toBeGreaterThan(0);
  });

  it('validates theoretical utilization formulas across window sizes', () => {
    const report = compareProtocols(sampleConfig);
    const saw = report.results.find((r) => r.protocol === 'stop-and-wait')!;
    const sr = report.results.find((r) => r.protocol === 'selective-repeat')!;

    // T_frame = 20ms, RTT = 100ms -> Denominator = 120ms
    // SAW: 20 / 120 = 16.67% -> ~17%
    // SR (N=4): (4 * 20) / 120 = 80 / 120 = 66.67% -> ~67%
    expect(saw.theoreticalUtilizationPercent).toBe(17);
    expect(sr.theoreticalUtilizationPercent).toBe(67);
  });
});

