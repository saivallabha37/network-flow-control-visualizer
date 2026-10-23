import { Frame } from '../types/protocol.js';

/**
 * 32-bit deterministic Mulberry32 Pseudo-Random Number Generator.
 * Produces an identical sequence of floats in [0, 1) given the same integer seed.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export interface InFlightPacket {
  id: string;
  type: 'DATA' | 'ACK';
  frame: Frame;
  departureTime: number;
  scheduledDeliveryTime: number;
  isDropped: boolean;
  isCorrupted: boolean;
}

export class VirtualChannel {
  private inFlight: InFlightPacket[] = [];
  private packetCounter: number = 0;
  private readonly oneWayDelayMs: number;
  private readonly frameLossRate: number;
  private readonly ackLossRate: number;
  private readonly corruptionRate: number;
  private readonly prng: SeededRandom;

  constructor(options: {
    oneWayDelayMs: number;
    frameLossRate: number;
    ackLossRate: number;
    corruptionRate?: number;
    seed: number;
  }) {
    this.oneWayDelayMs = options.oneWayDelayMs;
    this.frameLossRate = options.frameLossRate;
    this.ackLossRate = options.ackLossRate;
    this.corruptionRate = options.corruptionRate ?? 0;
    this.prng = new SeededRandom(options.seed);
  }

  /**
   * Transmits a DATA frame through the virtual channel.
   * Clones the frame to prevent mutable reference sharing across endpoints.
   */
  public transmitData(frame: Frame, departureTime: number): InFlightPacket {
    this.packetCounter += 1;
    const isDropped = this.prng.next() < this.frameLossRate;
    const isCorrupted = !isDropped && this.prng.next() < this.corruptionRate;

    // Deep clone to ensure memory isolation between virtual sender and receiver
    const clonedFrame: Frame = { ...frame };
    if (isCorrupted) {
      // Invert checksum bits to simulate transmission corruption
      clonedFrame.checksum = (clonedFrame.checksum ^ 0xffffffff) >>> 0;
    }

    const packet: InFlightPacket = {
      id: `pkt-data-${this.packetCounter}`,
      type: 'DATA',
      frame: clonedFrame,
      departureTime,
      scheduledDeliveryTime: departureTime + this.oneWayDelayMs,
      isDropped,
      isCorrupted,
    };

    this.insertSorted(packet);
    return packet;
  }

  /**
   * Transmits an ACK frame through the virtual channel.
   */
  public transmitAck(ackFrame: Frame, departureTime: number): InFlightPacket {
    this.packetCounter += 1;
    const isDropped = this.prng.next() < this.ackLossRate;
    const isCorrupted = !isDropped && this.prng.next() < this.corruptionRate;

    const clonedFrame: Frame = { ...ackFrame };
    if (isCorrupted) {
      clonedFrame.checksum = (clonedFrame.checksum ^ 0xffffffff) >>> 0;
    }

    const packet: InFlightPacket = {
      id: `pkt-ack-${this.packetCounter}`,
      type: 'ACK',
      frame: clonedFrame,
      departureTime,
      scheduledDeliveryTime: departureTime + this.oneWayDelayMs,
      isDropped,
      isCorrupted,
    };

    this.insertSorted(packet);
    return packet;
  }

  /**
   * Retrieves and removes all packets whose scheduled delivery time has arrived.
   */
  public getDeliverablePackets(currentTime: number): InFlightPacket[] {
    const deliverable: InFlightPacket[] = [];
    while (this.inFlight.length > 0 && this.inFlight[0].scheduledDeliveryTime <= currentTime) {
      deliverable.push(this.inFlight.shift()!);
    }
    return deliverable;
  }

  public peekNextDeliveryTime(): number | null {
    return this.inFlight.length > 0 ? this.inFlight[0].scheduledDeliveryTime : null;
  }

  public getInFlightCount(): number {
    return this.inFlight.length;
  }

  public getInFlightPackets(): ReadonlyArray<InFlightPacket> {
    return [...this.inFlight];
  }

  public clear(): void {
    this.inFlight = [];
    this.packetCounter = 0;
  }

  private insertSorted(packet: InFlightPacket): void {
    // Binary or linear insertion maintaining stable sort by scheduledDeliveryTime
    let i = this.inFlight.length - 1;
    while (i >= 0 && this.inFlight[i].scheduledDeliveryTime > packet.scheduledDeliveryTime) {
      i--;
    }
    this.inFlight.splice(i + 1, 0, packet);
  }
}

