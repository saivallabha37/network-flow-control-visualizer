import { ProtocolType, SimulationConfig } from '@agent';

export interface GuidedScenario {
  id: string;
  title: string;
  targetProtocol: ProtocolType;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  badge: string;
  summary: string;
  whatToObserve: string;
  config: SimulationConfig;
}

export const GUIDED_SCENARIOS: GuidedScenario[] = [
  {
    id: 'loss-free-baseline',
    title: '1. Loss-Free Baseline',
    targetProtocol: 'go-back-n',
    difficulty: 'Beginner',
    badge: 'Zero Loss',
    summary: 'A clean, ideal transmission showcasing regular window progression without channel impairments.',
    whatToObserve:
      'Notice how the sender window slides forward steadily as cumulative ACKs arrive. No timeouts or retransmissions occur.',
    config: {
      protocol: 'go-back-n',
      payloads: ['Packet #0', 'Packet #1', 'Packet #2', 'Packet #3', 'Packet #4', 'Packet #5'],
      windowSize: 4,
      seqNumberSpace: 8,
      seed: 100,
      oneWayDelayMs: 60,
      frameLossRate: 0,
      ackLossRate: 0,
      corruptionRate: 0,
      timeoutMs: 250,
      maxRetries: 4,
      tickStepMs: 15,
    },
  },
  {
    id: 'high-latency-link',
    title: '2. High-Latency Satellite Link',
    targetProtocol: 'stop-and-wait',
    difficulty: 'Intermediate',
    badge: 'High Latency',
    summary: 'Demonstrates the severe throughput penalty of Stop-and-Wait when propagation delay is high (large RTT).',
    whatToObserve:
      'In Stop-and-Wait, the sender remains idle for 300ms (2 × 150ms delay) between packets. Switch to Go-Back-N or Selective Repeat to see how pipelining overcomes this limitation.',
    config: {
      protocol: 'stop-and-wait',
      payloads: ['Packet #0', 'Packet #1', 'Packet #2', 'Packet #3'],
      windowSize: 1,
      seqNumberSpace: 2,
      seed: 42,
      oneWayDelayMs: 150,
      frameLossRate: 0,
      ackLossRate: 0,
      corruptionRate: 0,
      timeoutMs: 400,
      maxRetries: 4,
      tickStepMs: 15,
    },
  },
  {
    id: 'go-back-n-recovery',
    title: '3. Go-Back-N Loss & Bulk Recovery',
    targetProtocol: 'go-back-n',
    difficulty: 'Intermediate',
    badge: 'Packet Drop',
    summary: 'Demonstrates how a single dropped DATA frame causes Go-Back-N to discard subsequent frames and retransmit the entire window.',
    whatToObserve:
      'When frame #1 is dropped, receiver discards frames #2 and #3 because it strictly expects #1. When timer expires, sender retransmits all outstanding frames (#1, #2, #3).',
    config: {
      protocol: 'go-back-n',
      payloads: ['Frame #0', 'Frame #1', 'Frame #2', 'Frame #3', 'Frame #4', 'Frame #5'],
      windowSize: 4,
      seqNumberSpace: 8,
      seed: 12,
      oneWayDelayMs: 60,
      frameLossRate: 0.25,
      ackLossRate: 0,
      corruptionRate: 0,
      timeoutMs: 250,
      maxRetries: 4,
      tickStepMs: 15,
    },
  },
  {
    id: 'selective-repeat-buffering',
    title: '4. Selective Repeat Out-of-Order Buffering',
    targetProtocol: 'selective-repeat',
    difficulty: 'Advanced',
    badge: 'Buffer & Cascade',
    summary: 'Demonstrates receiver-side buffering of out-of-order frames, individual ACKs, and cascade delivery.',
    whatToObserve:
      'When a frame is dropped, subsequent frames are buffered rather than discarded. The sender only retransmits the single missing frame. Upon arrival, all contiguous buffered frames cascade deliver!',
    config: {
      protocol: 'selective-repeat',
      payloads: ['Data #0', 'Data #1', 'Data #2', 'Data #3', 'Data #4', 'Data #5'],
      windowSize: 4,
      seqNumberSpace: 8,
      seed: 7,
      oneWayDelayMs: 60,
      frameLossRate: 0.25,
      ackLossRate: 0,
      corruptionRate: 0,
      timeoutMs: 250,
      maxRetries: 4,
      tickStepMs: 15,
    },
  },
  {
    id: 'ack-loss',
    title: '5. Lost Acknowledgement Recovery',
    targetProtocol: 'go-back-n',
    difficulty: 'Intermediate',
    badge: 'ACK Drop',
    summary: 'Demonstrates how flow control protocols handle lost return ACKs and recover without duplicate delivery.',
    whatToObserve:
      'Observe what happens when an ACK is dropped in the reverse channel. In Go-Back-N, a subsequent cumulative ACK may acknowledge it before timeout, or a timeout causes retransmission which receiver detects as duplicate.',
    config: {
      protocol: 'go-back-n',
      payloads: ['Message #0', 'Message #1', 'Message #2', 'Message #3', 'Message #4'],
      windowSize: 4,
      seqNumberSpace: 8,
      seed: 19,
      oneWayDelayMs: 60,
      frameLossRate: 0,
      ackLossRate: 0.35,
      corruptionRate: 0,
      timeoutMs: 250,
      maxRetries: 4,
      tickStepMs: 15,
    },
  },
];

