export interface SimulationStatistics {
  /** Original data frames sent (initial transmission attempts) */
  originalFramesSent: number;
  /** Retransmitted data frames (attempt > 1) */
  retransmissions: number;
  /** Total data frame transmissions (original + retransmissions) */
  totalFramesSent: number;
  /** Acknowledgements transmitted by the receiver */
  acksSent: number;
  /** Data frames dropped by the virtual channel */
  framesDropped: number;
  /** ACKs dropped by the virtual channel */
  acksDropped: number;
  /** Data frames corrupted by the channel */
  framesCorrupted: number;
  /** Timeouts triggered across sender state machines */
  timeouts: number;
  /** Total payloads successfully delivered in order to receiver application */
  payloadsDelivered: number;
  /** Total target payloads to transmit */
  totalPayloads: number;
  /** Total elapsed virtual time in ms */
  simulationDurationMs: number;
  /** Total steps executed */
  stepsExecuted: number;
  /** Effective throughput: delivered payloads per virtual second */
  throughputPayloadsPerSec: number;
  /** Delivery success ratio: payloadsDelivered / totalPayloads */
  deliverySuccessRatio: number;
  /** Frame loss ratio: framesDropped / totalFramesSent */
  frameLossRatio: number;
  /** ACK loss ratio: acksDropped / acksSent */
  ackLossRatio: number;
  /** Retransmission overhead ratio: retransmissions / totalFramesSent */
  retransmissionRatio: number;
}

export function computeSimulationStatistics(data: {
  originalFramesSent: number;
  retransmissions: number;
  acksSent: number;
  framesDropped: number;
  acksDropped: number;
  framesCorrupted: number;
  timeouts: number;
  payloadsDelivered: number;
  totalPayloads: number;
  simulationDurationMs: number;
  stepsExecuted: number;
}): SimulationStatistics {
  const totalFramesSent = data.originalFramesSent + data.retransmissions;
  const durationSec = data.simulationDurationMs / 1000;

  const throughputPayloadsPerSec =
    durationSec > 0 ? Number((data.payloadsDelivered / durationSec).toFixed(3)) : 0;

  const deliverySuccessRatio =
    data.totalPayloads > 0
      ? Number((data.payloadsDelivered / data.totalPayloads).toFixed(3))
      : 0;

  const frameLossRatio =
    totalFramesSent > 0
      ? Number((data.framesDropped / totalFramesSent).toFixed(3))
      : 0;

  const ackLossRatio =
    data.acksSent > 0
      ? Number((data.acksDropped / data.acksSent).toFixed(3))
      : 0;

  const retransmissionRatio =
    totalFramesSent > 0
      ? Number((data.retransmissions / totalFramesSent).toFixed(3))
      : 0;

  return {
    originalFramesSent: data.originalFramesSent,
    retransmissions: data.retransmissions,
    totalFramesSent,
    acksSent: data.acksSent,
    framesDropped: data.framesDropped,
    acksDropped: data.acksDropped,
    framesCorrupted: data.framesCorrupted,
    timeouts: data.timeouts,
    payloadsDelivered: data.payloadsDelivered,
    totalPayloads: data.totalPayloads,
    simulationDurationMs: data.simulationDurationMs,
    stepsExecuted: data.stepsExecuted,
    throughputPayloadsPerSec,
    deliverySuccessRatio,
    frameLossRatio,
    ackLossRatio,
    retransmissionRatio,
  };
}

