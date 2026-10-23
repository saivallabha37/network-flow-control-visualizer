import { ProtocolType } from '../types/protocol.js';
import { SimulationConfig } from './simulation-config.js';
import { SimulationEngine, SimulationStatus } from './simulation-engine.js';

export interface ProtocolComparisonItem {
  protocol: ProtocolType;
  name: string;
  status: SimulationStatus;
  durationMs: number;
  totalPayloads: number;
  payloadsDelivered: number;
  originalFramesSent: number;
  retransmissions: number;
  timeouts: number;
  throughputPayloadsPerSec: number;
  deliverySuccessRatio: number;
  empiricalEfficiencyPercent: number;
  theoreticalUtilizationPercent: number;
}

export interface ProtocolComparisonReport {
  timestamp: number;
  commonParameters: {
    payloadCount: number;
    oneWayDelayMs: number;
    rttMs: number;
    frameLossRate: number;
    ackLossRate: number;
    corruptionRate: number;
    timeoutMs: number;
    seed: number;
  };
  results: ProtocolComparisonItem[];
  winnerThroughput: ProtocolType;
  winnerEfficiency: ProtocolType;
  keyInsights: string[];
}

/**
 * Executes a deterministic comparative benchmark of all three ARQ protocols
 * (Stop-and-Wait, Go-Back-N, Selective Repeat) under equivalent network conditions.
 */
export function compareProtocols(baseConfig: SimulationConfig): ProtocolComparisonReport {
  const windowSize = baseConfig.windowSize ?? 4;
  const seqNumberSpace = baseConfig.seqNumberSpace ?? 8;

  // Normalized frame transmission time: 20 ms
  const tFrameMs = 20;
  const rttMs = 2 * baseConfig.oneWayDelayMs;
  const denominator = tFrameMs + rttMs;

  const protocolConfigs: Array<{
    protocol: ProtocolType;
    name: string;
    windowSize: number;
    seqNumberSpace: number;
  }> = [
    {
      protocol: 'stop-and-wait',
      name: 'Stop-and-Wait ARQ',
      windowSize: 1,
      seqNumberSpace: 2,
    },
    {
      protocol: 'go-back-n',
      name: 'Go-Back-N ARQ',
      windowSize,
      seqNumberSpace: Math.max(seqNumberSpace, windowSize + 1),
    },
    {
      protocol: 'selective-repeat',
      name: 'Selective Repeat ARQ',
      windowSize,
      seqNumberSpace: Math.max(seqNumberSpace, 2 * windowSize),
    },
  ];

  const results: ProtocolComparisonItem[] = [];

  for (const pc of protocolConfigs) {
    const config: SimulationConfig = {
      ...baseConfig,
      protocol: pc.protocol,
      windowSize: pc.windowSize,
      seqNumberSpace: pc.seqNumberSpace,
    };

    const engine = new SimulationEngine(config);
    const stats = engine.runToCompletion();

    const totalTransmissions = stats.originalFramesSent + stats.retransmissions;
    const empiricalEfficiency =
      totalTransmissions > 0
        ? Math.round((stats.payloadsDelivered / totalTransmissions) * 100)
        : 0;

    const effectiveN = pc.protocol === 'stop-and-wait' ? 1 : Math.max(1, pc.windowSize);
    const theoreticalUtilization = Math.min(1, (effectiveN * tFrameMs) / denominator);

    results.push({
      protocol: pc.protocol,
      name: pc.name,
      status: engine.getStatus(),
      durationMs: engine.getVirtualTime(),
      totalPayloads: stats.totalPayloads,
      payloadsDelivered: stats.payloadsDelivered,
      originalFramesSent: stats.originalFramesSent,
      retransmissions: stats.retransmissions,
      timeouts: stats.timeouts,
      throughputPayloadsPerSec: Number(stats.throughputPayloadsPerSec),
      deliverySuccessRatio: stats.deliverySuccessRatio,
      empiricalEfficiencyPercent: empiricalEfficiency,
      theoreticalUtilizationPercent: Math.round(theoreticalUtilization * 100),
    });
  }

  // Identify highest throughput
  const sortedByThroughput = [...results].sort(
    (a, b) => b.throughputPayloadsPerSec - a.throughputPayloadsPerSec
  );
  const winnerThroughput = sortedByThroughput[0].protocol;

  // Identify highest transmission efficiency (least redundant retransmissions)
  const sortedByEfficiency = [...results].sort(
    (a, b) => b.empiricalEfficiencyPercent - a.empiricalEfficiencyPercent
  );
  const winnerEfficiency = sortedByEfficiency[0].protocol;

  // Synthesize educational insights
  const insights: string[] = [];
  const saw = results.find((r) => r.protocol === 'stop-and-wait')!;
  const gbn = results.find((r) => r.protocol === 'go-back-n')!;
  const sr = results.find((r) => r.protocol === 'selective-repeat')!;

  if (baseConfig.oneWayDelayMs >= 40 && saw.throughputPayloadsPerSec > 0) {
    const speedup = (Math.max(gbn.throughputPayloadsPerSec, sr.throughputPayloadsPerSec) / saw.throughputPayloadsPerSec).toFixed(1);
    insights.push(
      `Pipelined windowing achieved up to ${speedup}x higher throughput than Stop-and-Wait on this ${rttMs}ms RTT link by preventing idle wait states.`
    );
  }

  if (baseConfig.frameLossRate > 0 || baseConfig.ackLossRate > 0) {
    if (gbn.retransmissions > sr.retransmissions) {
      const saved = gbn.retransmissions - sr.retransmissions;
      insights.push(
        `Selective Repeat saved ${saved} redundant frame retransmission${saved === 1 ? '' : 's'} compared to Go-Back-N by buffering out-of-order packets at the receiver.`
      );
    } else if (gbn.retransmissions === sr.retransmissions && sr.retransmissions === 0) {
      insights.push('Zero frame drops occurred with this random seed; pipeline throughput was maximized.');
    }
  }

  insights.push(
    `Theoretical channel utilization limits: Stop-and-Wait (${saw.theoreticalUtilizationPercent}%) vs. Pipelined N=${windowSize} (${sr.theoreticalUtilizationPercent}%).`
  );

  return {
    timestamp: Date.now(),
    commonParameters: {
      payloadCount: baseConfig.payloads.length,
      oneWayDelayMs: baseConfig.oneWayDelayMs,
      rttMs,
      frameLossRate: baseConfig.frameLossRate,
      ackLossRate: baseConfig.ackLossRate,
      corruptionRate: baseConfig.corruptionRate ?? 0,
      timeoutMs: baseConfig.timeoutMs,
      seed: baseConfig.seed,
    },
    results,
    winnerThroughput,
    winnerEfficiency,
    keyInsights: insights,
  };
}

