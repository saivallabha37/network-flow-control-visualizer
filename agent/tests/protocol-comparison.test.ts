import { describe, it, expect } from 'vitest';
import { compareProtocols } from '../src/simulation/protocol-comparison.js';
import { SimulationConfig } from '../src/simulation/simulation-config.js';

describe('Protocol Comparison Benchmark Engine', () => {
  const baseConfig: SimulationConfig = {
    protocol: 'go-back-n',
    payloads: ['Msg 0', 'Msg 1', 'Msg 2', 'Msg 3', 'Msg 4', 'Msg 5'],
    windowSize: 4,
    seqNumberSpace: 8,
    seed: 42,
    oneWayDelayMs: 60,
    frameLossRate: 0.2,
    ackLossRate: 0.1,
    corruptionRate: 0,
    timeoutMs: 250,
    maxRetries: 4,
  };

  it('runs all 3 protocols to completion and returns comparative metrics', () => {
    const report = compareProtocols(baseConfig);

    expect(report.results).toHaveLength(3);
    const [saw, gbn, sr] = report.results;

    expect(saw.protocol).toBe('stop-and-wait');
    expect(gbn.protocol).toBe('go-back-n');
    expect(sr.protocol).toBe('selective-repeat');

    // All should have attempted 6 payloads
    expect(saw.totalPayloads).toBe(6);
    expect(gbn.totalPayloads).toBe(6);
    expect(sr.totalPayloads).toBe(6);

    // Theoretical utilization check
    expect(saw.theoreticalUtilizationPercent).toBeLessThan(gbn.theoreticalUtilizationPercent);
    expect(sr.theoreticalUtilizationPercent).toBe(gbn.theoreticalUtilizationPercent);

    // Winners identified
    expect(['stop-and-wait', 'go-back-n', 'selective-repeat']).toContain(report.winnerThroughput);
    expect(['stop-and-wait', 'go-back-n', 'selective-repeat']).toContain(report.winnerEfficiency);

    // Key insights populated
    expect(report.keyInsights.length).toBeGreaterThan(0);
  });

  it('demonstrates higher pipelined throughput over high latency link', () => {
    const highLatencyConfig: SimulationConfig = {
      ...baseConfig,
      oneWayDelayMs: 150, // 300ms RTT
      frameLossRate: 0,
      ackLossRate: 0,
      seed: 1234,
    };

    const report = compareProtocols(highLatencyConfig);
    const saw = report.results.find((r) => r.protocol === 'stop-and-wait')!;
    const sr = report.results.find((r) => r.protocol === 'selective-repeat')!;

    expect(sr.throughputPayloadsPerSec).toBeGreaterThan(saw.throughputPayloadsPerSec);
    expect(sr.durationMs).toBeLessThan(saw.durationMs);
  });
});

