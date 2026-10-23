import { ProtocolType } from '@agent';

export interface ProtocolMetadata {
  id: ProtocolType;
  name: string;
  tagline: string;
  category: string;
  defaultWindowSize: number;
  defaultSeqSpace: number;
  description: string;
  tradeoffs: {
    pros: string[];
    cons: string[];
  };
  keyRules: {
    windowing: string;
    acknowledgement: string;
    lossRecovery: string;
    receiverBuffering: string;
  };
}

export const PROTOCOL_INFO: Record<ProtocolType, ProtocolMetadata> = {
  'stop-and-wait': {
    id: 'stop-and-wait',
    name: 'Stop-and-Wait ARQ',
    tagline: 'Transmits one data frame at a time; halts until positive ACK is confirmed.',
    category: '1-Frame ARQ Protocol',
    defaultWindowSize: 1,
    defaultSeqSpace: 2,
    description:
      'The sender transmits a single frame and waits for its corresponding acknowledgement before sending the next. Alternating 1-bit sequence numbers (0 and 1) handle duplicate detection.',
    tradeoffs: {
      pros: ['Simple to implement', 'Minimal memory requirements', 'No receiver buffering needed'],
      cons: ['Low link utilization on high-latency links', 'Pipeline cannot accommodate multiple frames'],
    },
    keyRules: {
      windowing: 'Window size N = 1. Only one frame in-flight at any time.',
      acknowledgement: 'Individual ACK carrying the sequence number of the accepted frame.',
      lossRecovery: 'Single-frame timeout timer triggers retransmission of the outstanding frame.',
      receiverBuffering: 'No buffering; discards duplicates and re-acknowledges them.',
    },
  },
  'go-back-n': {
    id: 'go-back-n',
    name: 'Go-Back-N ARQ',
    tagline: 'Pipelines up to N frames with cumulative ACKs; retransmits entire window on timeout.',
    category: 'Windowed ARQ Protocol',
    defaultWindowSize: 4,
    defaultSeqSpace: 8,
    description:
      'Allows up to N unacknowledged frames in transit. The receiver accepts only strictly in-order frames and emits cumulative ACKs. When a timeout occurs, the sender retransmits all outstanding frames starting from the oldest unacknowledged base.',
    tradeoffs: {
      pros: ['High pipeline utilization', 'Simple receiver without buffer requirement', 'Cumulative ACKs recover from lost intermediate ACKs'],
      cons: ['Bulk retransmissions waste bandwidth when error rates are high'],
    },
    keyRules: {
      windowing: 'Sender window N > 1 with sequence space M > N.',
      acknowledgement: 'Inclusive cumulative ACK confirms all frames up to and including ackNum.',
      lossRecovery: 'Single timer for base; timeout retransmits all frames in the window.',
      receiverBuffering: 'Strictly zero buffering; any out-of-order frame is discarded.',
    },
  },
  'selective-repeat': {
    id: 'selective-repeat',
    name: 'Selective Repeat ARQ',
    tagline: 'Pipelines N frames with individual ACKs & receiver buffering; retransmits only lost frames.',
    category: 'Windowed ARQ Protocol',
    defaultWindowSize: 4,
    defaultSeqSpace: 8,
    description:
      'Maintains both sender and receiver windows of size N. Valid out-of-order frames are acknowledged individually and buffered at the receiver. The sender maintains independent timers and retransmits only frames that time out.',
    tradeoffs: {
      pros: ['Bandwidth-efficient retransmissions', 'Minimizes redundant frame re-sending'],
      cons: ['Complex sender & receiver state', 'Requires receiver-side memory buffers', 'Requires sequence space M >= 2N'],
    },
    keyRules: {
      windowing: 'Sender & receiver window N > 1 with strict constraint M >= 2N.',
      acknowledgement: 'Individual ACK for each successfully received frame.',
      lossRecovery: 'Independent timer per outstanding frame; only timed-out frame is resent.',
      receiverBuffering: 'Buffers valid out-of-order frames in [rcvBase, rcvBase + N - 1] and cascades sequential delivery.',
    },
  },
};

