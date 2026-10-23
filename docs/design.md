# System Design
## Network Flow Control Protocols Visualizer

**Version:** 1.0  
**Status:** Initial Design

## 1. Design Objectives

- Separate presentation, protocol logic, simulation, and networking.
- Support all four required protocol modes.
- Allow protocol logic to be tested independently of the user interface.
- Support simulation and live communication.
- Make protocol events available for visualization and debugging.

## 2. Proposed Architecture

### 2.1 Frontend
**Technology:** React, TypeScript, Vite, Tailwind CSS.

Responsibilities:
- Display sender and receiver.
- Visualize frames, acknowledgements, losses, and retransmissions.
- Provide protocol configuration and execution controls.
- Display event logs and performance statistics.

### 2.2 Protocol Engine
**Technology:** TypeScript.

Responsibilities:
- Maintain sender and receiver protocol states.
- Generate and process sequence numbers.
- Manage transmission windows.
- Process acknowledgements.
- Detect timeouts and schedule retransmissions.
- Emit structured protocol events.

### 2.3 Simulation Engine

Responsibilities:
- Execute protocol logic under controlled conditions.
- Simulate frame loss, acknowledgement loss, and delay.
- Provide deterministic scenarios for testing.
- Support pause, resume, single-step, and reset operations.

### 2.4 Networking Agent
**Technology:** Node.js UDP sockets.

Responsibilities:
- Send and receive application-level frames.
- Communicate with the protocol engine.
- Validate incoming messages.
- Maintain communication-session information.
- Expose protocol events to the local dashboard through WebSockets.

### 2.5 Statistics Module

Responsibilities:
- Track transmitted and acknowledged frames.
- Count retransmissions and detected losses.
- Measure transfer duration and effective throughput.
- Provide comparable results for equivalent test scenarios.

## 3. Logical Data Flow

1. The user selects a protocol and configures parameters.
2. The frontend sends configuration to the protocol engine.
3. The protocol engine creates frames and determines transmission behavior.
4. In simulation mode, a controlled network model delivers, delays, or drops frames.
5. In live mode, the networking agent transmits frames through UDP.
6. The receiver processes frames and generates protocol-specific acknowledgements.
7. The protocol engine updates its state and emits events.
8. The frontend displays the events and updates the statistics.

## 4. Protocol Abstraction

Each protocol implementation shall define the behavior needed to:

- Initialize sender and receiver state.
- Generate frames for transmission.
- Process incoming frames.
- Process acknowledgements.
- Handle timeouts.
- Determine retransmissions.
- Report delivery status.

Shared interfaces shall be used where appropriate, while protocol-specific behavior remains separate.

## 5. Communication Model

The live prototype will use UDP for application-level data frames and acknowledgements. WebSockets will carry events between each local networking agent and its browser dashboard.

The application-level protocol will define frame identifiers, sequence numbers, acknowledgements, session identifiers, and integrity checks.

## 6. Error Handling

The system shall handle:

- Lost frames.
- Lost acknowledgements.
- Duplicate frames.
- Out-of-order frames.
- Invalid frames.
- Timeouts.
- Connection interruptions.
- Incomplete file transfers.

The behavior shall depend on the selected protocol and the communication mode.

## 7. Design Constraints

- The frontend shall not implement protocol state transitions directly.
- Simulation and live communication shall use the same protocol logic where practical.
- Protocol behavior shall be testable without a graphical interface.
- Simulation results shall be distinguishable from live network measurements.
- The initial live deployment shall target a local network.

## 8. Design Validation

The design will be reviewed against the SRS. Each functional requirement shall map to one or more system components and corresponding test cases.

---

## 9. Implemented Protocol Architecture & Conventions

### 9.1 General Sliding Window Abstraction (`SlidingWindow<T>`)
The sliding window mechanism (`agent/src/protocols/sliding-window.ts`) manages sender window capacity and sequencing:
- **Capacity Management:** Allows transmission of up to $N$ frames before requiring acknowledgement.
- **Dual Indexing:** Tracks internal monotonic frame indices (`absoluteIndex`) alongside wire sequence numbers (`seqNum` in $[0, M - 1]$). This eliminates ambiguity across sequence wraparound boundaries.
- **Sequence Space Constraint:** Enforces $M > N$ (where $M$ is the sequence number space and $N$ is the window size). For $M \le N$, unambiguous cumulative acknowledgement across cycles is mathematically impossible.
- **Reusability:** Provides `acknowledgeCumulative(ackNum)` for Go-Back-N, capacity tracking, and sequential wraparound modeling.

### 9.2 Go-Back-N ARQ Protocol
Implemented in `agent/src/protocols/go-back-n.ts`:
- **Cumulative ACK Convention (Inclusive Highest-Received):**
  An ACK carrying `ackNum = k` confirms that frame $k$ and all preceding unacknowledged frames currently outstanding in the window have been successfully received and delivered. The sender advances its window base past frame $k$.
- **Sender Timeout Behavior:**
  Maintains a timer for the oldest unacknowledged frame (`base`). Upon timeout expiration, the sender retransmits **all** frames currently outstanding in the window ($[base, base + \text{count} - 1]$), resetting the timer for the retransmitted window.
- **Receiver Strict In-Order Acceptance:**
  The receiver accepts only frame $k$ where $k == \text{expectedSeqNum}$, delivers the payload once, and issues cumulative ACK $k$. Any duplicate or out-of-order frame is **discarded immediately without buffering** (distinguishing GBN from Selective Repeat), and the receiver re-issues an ACK for the highest in-order frame accepted.
- **Retry Exhaustion:**
  Tracks retransmission attempts per window base against `maxRetries`. When exhausted, transitions to `FAILED` and halts transmission.

### 9.3 Selective Repeat ARQ Protocol
Implemented in `agent/src/protocols/selective-repeat.ts`:
- **Sequence Space Constraint ($M \ge 2N$):**
  Enforces $M \ge 2N$ mathematically. If $M < 2N$, the receiver's advanced window $[N, 2N - 1]$ overlaps with the previous cycle $[0, N - 1] \pmod M$, leading to severe ambiguity where retransmitted old frames would be mistaken for new frames.
- **Individual Frame Timers & Tracking:**
  The sender tracks each outstanding frame independently. Each unacknowledged frame maintains its own elapsed time and retry count. When a frame times out, **only that specific frame is retransmitted**. Acknowledging one frame stops its timer and leaves other frame timers running without reset.
- **Receiver Out-of-Order Buffering:**
  The receiver maintains a receive window of size $N$ ($[rcvBase, rcvBase + N - 1] \pmod M$). Valid out-of-order frames within this range are acknowledged individually and buffered. When the missing frame at $rcvBase$ arrives, it and any subsequent contiguous buffered frames are cascaded and delivered in strictly sequential order.
- **Duplicate Recovery:**
  Frames arriving within $[rcvBase - N, rcvBase - 1] \pmod M$ represent previously delivered frames whose ACKs may have been lost or delayed; the receiver re-issues an ACK for the frame but does not redeliver the payload.

### 9.4 Architectural Comparison Matrix

| Protocol / Mechanism | Sender Window ($N$) | Receiver Window ($N_{rx}$) | Sequence Space ($M$) | Acknowledgement Strategy | Retransmission Scope | Receiver Buffering |
|---|---|---|---|---|---|---|
| **Stop-and-Wait ARQ** | $N = 1$ | $N_{rx} = 1$ | $M = 2$ | Individual ACK per frame | Single outstanding frame | None (accepts current or ignores duplicate) |
| **Sliding Window Mechanism** | $N \ge 1$ | N/A (Abstract) | $M > N$ | Abstract flow control / capacity management | N/A (Underlying engine) | N/A (Underlying engine) |
| **Go-Back-N ARQ** | $N > 1$ | $N_{rx} = 1$ | $M \ge N + 1$ | Cumulative ACK (highest in-order frame) | Entire outstanding window from `base` | None (discards all out-of-order frames) |
| **Selective Repeat ARQ** | $N > 1$ | $N_{rx} = N$ | $M \ge 2N$ | Individual ACK per frame | Only the specifically timed-out frame | Buffers out-of-order frames in $[rcvBase, rcvBase + N - 1]$ |

## 10. Simulation Engine Architecture (Phase 4)

### 10.1 Subsystem Overview
The simulation subsystem (`agent/src/simulation/`) models a full virtual network with deterministic propagation delay, packet loss, and retransmissions. It connects the genuine protocol state machines to virtual sender and receiver endpoints without modifying or faking protocol rules.

### 10.2 Virtual Channel & Deterministic Seeded Loss
- **Mulberry32 PRNG:** Uses a 32-bit seeded pseudo-random number generator to determine frame and ACK drops reproducibly. Running a simulation with the same seed and parameters guarantees an identical event sequence.
- **Memory Isolation:** Clones frames upon transmission so that virtual sender and receiver endpoints never share mutable in-memory frame objects.
- **Propagation Delay:** Enforces a configurable one-way delay $D$, scheduling packet delivery at $t_{departure} + D$.

### 10.3 Virtual Clock & Discrete Stepping
- Uses a controllable virtual clock ($t_{virtual} = 0, \Delta t, 2\Delta t, \dots$) rather than uncontrollable wall-clock timeouts.
- **Step Semantics:** Each step advances virtual time by $\Delta t$ (`tickStepMs`), steps protocol timers, handles timeouts, delivers deliverable channel packets, and transmits pending payloads up to window capacity.
- **Controls:** `start`, `pause`, `resume`, `step`, `reset`, and `runToCompletion`. Pausing strictly freezes virtual time. Reset restores all counters, queues, channels, and protocol state machines.

### 10.4 Protocol Adapters
Bridges existing protocol engines to the unified simulation engine:
- `StopAndWaitAdapter`: Connects `StopAndWaitSender` and `StopAndWaitReceiver`.
- `GoBackNAdapter`: Connects `GoBackNSender` and `GoBackNReceiver`.
- `SelectiveRepeatAdapter`: Connects `SelectiveRepeatSender` and `SelectiveRepeatReceiver`.

### 10.5 Simulation Metrics Definitions
- **Throughput:** $\text{Delivered Payloads} / (\text{Duration (s)})$.
- **Delivery Success Ratio:** $\text{Delivered Payloads} / \text{Total Payloads}$.
- **Frame Loss Ratio:** $\text{Dropped Frames} / \text{Total Frames Transmitted}$.
- **ACK Loss Ratio:** $\text{Dropped ACKs} / \text{Total ACKs Transmitted}$.
- **Retransmission Ratio:** $\text{Retransmitted Frames} / \text{Total Frames Transmitted}$.

### 10.6 Simulation Mode vs. Live UDP Mode
| Dimension | Simulation Mode (Phase 4) | Live UDP Mode (Future Phase 5) |
|---|---|---|
| **Transport** | Virtual in-memory channel (`VirtualChannel`) | Real OS UDP sockets (`dgram`) over LAN/Wi-Fi |
| **Clock** | Deterministic virtual clock (`virtualTimeMs`) | Real-time system clock & event loop |
| **Loss & Delay** | Controlled, seed-reproducible PRNG | Real physical network conditions |
| **Telemetry** | Synchronous simulation event log | Local WebSocket stream to React frontend |

---

**End of Document**
