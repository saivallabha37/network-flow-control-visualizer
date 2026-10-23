import { ProtocolType } from '../types/protocol.js';

export interface SimulationConfig {
  /** The protocol algorithm under test */
  protocol: ProtocolType;
  /** Ordered list of string payloads to transmit */
  payloads: string[];
  /** Sender and receiver window size (required for GBN and SR; 1 for Stop-and-Wait) */
  windowSize?: number;
  /** Sequence number space size M */
  seqNumberSpace?: number;
  /** Seed for the deterministic pseudo-random number generator */
  seed: number;
  /** One-way simulated network propagation delay in virtual milliseconds */
  oneWayDelayMs: number;
  /** Frame drop probability in range [0, 1] */
  frameLossRate: number;
  /** ACK drop probability in range [0, 1] */
  ackLossRate: number;
  /** Optional corruption probability in range [0, 1] */
  corruptionRate?: number;
  /** Protocol acknowledgement timeout in virtual milliseconds */
  timeoutMs: number;
  /** Maximum retransmissions before failure */
  maxRetries: number;
  /** Maximum virtual simulation time before safety abort (ms) */
  maxVirtualTimeMs?: number;
  /** Maximum simulation step iterations before safety abort */
  maxSteps?: number;
  /** Step increment in virtual ms when stepping time */
  tickStepMs?: number;
}

export interface ValidatedSimulationConfig extends Required<SimulationConfig> {
  corruptionRate: number;
  maxVirtualTimeMs: number;
  maxSteps: number;
  tickStepMs: number;
}

/**
 * Validates simulation configuration parameters and protocol-specific invariants.
 * Throws explicit descriptive errors on any violation.
 */
export function validateSimulationConfig(config: SimulationConfig): ValidatedSimulationConfig {
  if (!config) {
    throw new Error('Simulation configuration must be provided');
  }

  const validProtocols: ProtocolType[] = ['stop-and-wait', 'go-back-n', 'selective-repeat'];
  if (!validProtocols.includes(config.protocol)) {
    throw new Error(`Unsupported protocol: ${String(config.protocol)}`);
  }

  if (!Array.isArray(config.payloads) || config.payloads.length === 0) {
    throw new Error('Payloads must be a non-empty array of strings');
  }

  for (let i = 0; i < config.payloads.length; i++) {
    if (typeof config.payloads[i] !== 'string') {
      throw new Error(`Payload at index ${i} must be a string`);
    }
  }

  if (typeof config.seed !== 'number' || !Number.isInteger(config.seed)) {
    throw new Error('Simulation seed must be an integer');
  }

  if (typeof config.oneWayDelayMs !== 'number' || config.oneWayDelayMs < 0) {
    throw new Error('oneWayDelayMs must be a non-negative number');
  }

  if (
    typeof config.frameLossRate !== 'number' ||
    config.frameLossRate < 0 ||
    config.frameLossRate > 1
  ) {
    throw new Error('frameLossRate must be a number between 0 and 1');
  }

  if (
    typeof config.ackLossRate !== 'number' ||
    config.ackLossRate < 0 ||
    config.ackLossRate > 1
  ) {
    throw new Error('ackLossRate must be a number between 0 and 1');
  }

  const corruptionRate = config.corruptionRate ?? 0;
  if (
    typeof corruptionRate !== 'number' ||
    corruptionRate < 0 ||
    corruptionRate > 1
  ) {
    throw new Error('corruptionRate must be a number between 0 and 1');
  }

  if (typeof config.timeoutMs !== 'number' || config.timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive number');
  }

  if (
    typeof config.maxRetries !== 'number' ||
    !Number.isInteger(config.maxRetries) ||
    config.maxRetries < 0
  ) {
    throw new Error('maxRetries must be a non-negative integer');
  }

  let windowSize = config.windowSize ?? 1;
  let seqNumberSpace = config.seqNumberSpace ?? 2;

  // Protocol-specific constraints
  if (config.protocol === 'stop-and-wait') {
    if (config.windowSize !== undefined && config.windowSize !== 1) {
      throw new Error('Stop-and-Wait ARQ requires windowSize = 1');
    }
    windowSize = 1;
    seqNumberSpace = 2; // Alternating bit modulo 2
  } else if (config.protocol === 'go-back-n') {
    windowSize = config.windowSize ?? 4;
    seqNumberSpace = config.seqNumberSpace ?? Math.max(8, windowSize + 1);

    if (!Number.isInteger(windowSize) || windowSize < 1) {
      throw new Error('Go-Back-N requires windowSize to be an integer >= 1');
    }
    if (seqNumberSpace <= windowSize) {
      throw new Error(
        `Go-Back-N requires sequence number space M (${seqNumberSpace}) > window size N (${windowSize})`
      );
    }
  } else if (config.protocol === 'selective-repeat') {
    windowSize = config.windowSize ?? 4;
    seqNumberSpace = config.seqNumberSpace ?? Math.max(8, 2 * windowSize);

    if (!Number.isInteger(windowSize) || windowSize < 1) {
      throw new Error('Selective Repeat requires windowSize to be an integer >= 1');
    }
    if (seqNumberSpace < 2 * windowSize) {
      throw new Error(
        `Selective Repeat requires sequence number space M (${seqNumberSpace}) >= 2 * window size N (${2 * windowSize})`
      );
    }
  }

  return {
    protocol: config.protocol,
    payloads: [...config.payloads],
    windowSize,
    seqNumberSpace,
    seed: config.seed,
    oneWayDelayMs: config.oneWayDelayMs,
    frameLossRate: config.frameLossRate,
    ackLossRate: config.ackLossRate,
    corruptionRate,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    maxVirtualTimeMs: config.maxVirtualTimeMs ?? 60000,
    maxSteps: config.maxSteps ?? 5000,
    tickStepMs: config.tickStepMs ?? 10,
  };
}

