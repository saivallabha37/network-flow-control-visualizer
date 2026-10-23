# Software Test Plan
## Network Flow Control Protocols Visualizer

**Version:** 1.0  
**Status:** Initial planning draft

## 1. Objective

The objective of testing is to verify that the visualizer implements the selected protocols correctly, handles transmission errors, visualizes protocol events accurately, and supports live message and file transfer.

## 2. Scope of Testing

The following areas will be tested:

- Stop-and-Wait ARQ
- Sliding Window mechanism
- Go-Back-N ARQ
- Selective Repeat ARQ
- Frame and acknowledgement loss
- Timeout and retransmission behavior
- Sender and receiver window states
- Simulation controls and event logs
- Live UDP communication between two systems
- Message and file transfer
- Data integrity and performance statistics

## 3. Testing Levels

### 3.1 Unit Testing

Individual modules will be tested independently.

Examples:
- Verify sequence-number generation.
- Verify acknowledgement processing.
- Verify timeout handling.
- Verify retransmission decisions.
- Verify window-boundary calculations.
- Verify checksums or hashes.

**Planned tool:** Vitest.

### 3.2 Integration Testing

Test interactions between connected modules.

Examples:
- Protocol engine with simulation engine.
- Protocol engine with event logger.
- Networking agent with UDP transport.
- Networking agent with WebSocket event streaming.
- File transfer module with integrity checker.

### 3.3 System Testing

Test the complete application against the requirements.

Examples:
- Run an entire simulation from start to completion.
- Introduce frame loss and verify recovery.
- Transfer a message between two laptops on the same network.
- Transfer a file and verify the received contents.
- Verify statistics against recorded protocol events.

### 3.4 Acceptance Testing

Verify that the application satisfies its intended use cases.

Examples:
- A user can select a protocol and configure a simulation.
- A user can observe frames, acknowledgements and retransmissions.
- A user can compare protocol behavior under equivalent conditions.
- Two users on separate systems can exchange data in live mode, when networking and firewall configurations permit it.

## 4. Planned Test Cases

| Test ID | Test Scenario | Expected Result |
|---|---|---|
| UT-01 | Configure valid simulation parameters | Configuration is accepted |
| UT-02 | Send a frame successfully | Frame reaches the receiver |
| UT-03 | Process a valid ACK | Sender updates its state correctly |
| UT-04 | Simulate frame or ACK loss | Loss is recorded and handled |
| UT-05 | Allow a transmission timer to expire | Timeout event is generated |
| UT-06 | Trigger retransmission | Correct frame or frames are retransmitted |
| UT-07 | Alter received data during a test | Integrity verification detects the mismatch |
| UT-08 | Calculate protocol statistics | Counts and ratios match the event history |
| IT-01 | Run a simulation and inspect both endpoints | Sender and receiver states remain consistent |
| IT-02 | Transmit multiple frames | Frames follow the selected protocol rules |
| IT-03 | Lose a frame during transmission | Recovery follows the selected ARQ protocol |
| IT-04 | Generate protocol events | Events appear in chronological order |
| IT-05 | Connect two networking agents | Connection status reflects the actual state |
| IT-06 | Transfer a text message | Receiver obtains the original message |
| IT-07 | Transfer a small file | Receiver obtains the file successfully |
| IT-08 | Verify received file integrity | Matching hashes confirm identical content |
| IT-09 | Interrupt a live session | Disconnection is reported correctly |
| AT-01 | Select each supported protocol | Selected protocol is activated |
| AT-02 | Configure loss and timing parameters | Simulation uses the configured parameters |
| AT-03 | Start, pause, resume and reset | Controls behave as specified |
| AT-04 | Compare protocols under equivalent conditions | Statistics and event histories are displayed |

## 5. Important Protocol-Specific Tests

### Stop-and-Wait ARQ
- Send one frame and wait for its acknowledgement.
- Drop a data frame and verify timeout-based retransmission.
- Drop an ACK and verify duplicate-frame handling.
- Verify that duplicate frames do not create duplicate application data.

### Go-Back-N ARQ
- Transmit multiple frames within the sender window.
- Drop one frame and verify that the required outstanding frames are retransmitted.
- Verify cumulative acknowledgement behavior.
- Verify sender-window movement after valid acknowledgements.

### Selective Repeat ARQ
- Drop one frame while later frames arrive.
- Verify that correctly received frames can be buffered.
- Verify that only the required missing or unacknowledged frames are retransmitted.
- Verify receiver-window and sequence-number handling.

### Sliding Window
- Verify that multiple frames may be outstanding within the configured window.
- Verify window movement when acknowledgements arrive.
- Test window sizes at their valid boundaries.

## 6. Test Environment

**Development environment**
- Node.js and npm
- TypeScript
- React and Vite
- Vitest
- Modern web browser

**Live networking environment**
- Two laptops connected to the same Wi-Fi/LAN
- Networking agents running on both systems
- UDP communication enabled through appropriate firewall rules
- Browser access to the local visualization interface

## 7. Entry and Exit Criteria

**Entry criteria**
- Requirements and expected protocol behavior are documented.
- The module under test has been implemented.
- Required test data and environment are available.

**Exit criteria**
- All tests planned for the release have been executed.
- Results and defects have been documented.
- Critical protocol correctness and data-integrity defects are resolved.
- Acceptance criteria are verified before claiming the corresponding feature is complete.

## 8. Defect Management

Each defect should record:
- Defect ID
- Description and reproduction steps
- Expected behavior
- Actual behavior
- Severity
- Related requirement and test ID
- Fix and retest status

## 9. Limitations

Network delays, packet loss and timing may vary between runs. Automated tests should use controlled conditions wherever possible. Live networking tests must distinguish application-level protocol behavior from reliability provided by the underlying transport.

## 10. Test Reporting

For each executed test, record:

| Field | Description |
|---|---|
| Test ID | Unique identifier |
| Execution date | Date the test was run |
| Result | Pass, Fail or Blocked |
| Actual outcome | Observed behavior |
| Defect reference | Related issue, if any |

**Note:** Test cases in this document are planned tests. They must not be reported as passed until they have actually been executed.

---

## 11. Executed Test Log (Phase 1 & Phase 2)

| Test ID | Suite | Description | Status |
|---|---|---|---|
| TC-SW-01 | Frame Codec | CRC-32 determinism, verification, and corruption detection | **PASS** |
| TC-SW-02 | Frame Codec | Serialization and round-trip deserialization | **PASS** |
| TC-SW-03 | Frame Codec | Malformed JSON & schema error rejection | **PASS** |
| TC-SW-04 | Stop-and-Wait | Initial frame transmission & event transitions | **PASS** |
| TC-SW-05 | Stop-and-Wait | Valid ACK handling and sequence number advancement (modulo 2) | **PASS** |
| TC-SW-06 | Stop-and-Wait | Stale & unexpected ACK rejection | **PASS** |
| TC-SW-07 | Stop-and-Wait | Receiver accepts valid frame and delivers payload once | **PASS** |
| TC-SW-08 | Stop-and-Wait | Duplicate frame detection & re-acknowledgement | **PASS** |
| TC-SW-09 | Stop-and-Wait | Lost ACK, deterministic timeout & retransmission | **PASS** |
| TC-SW-10 | Stop-and-Wait | Multi-frame alternating-bit exchange | **PASS** |
| TC-SW-11 | Stop-and-Wait | Retry limit exhaustion transitions to FAILED | **PASS** |
| TC-SW-12 | Stop-and-Wait | Receiver rejects corrupted frame without payload delivery | **PASS** |
| TC-SW-13 | Sliding Window | Invariant validation: positive window size and $M > N$ constraint | **PASS** |
| TC-SW-14 | Sliding Window | Window capacity tracking and full-window push rejection | **PASS** |
| TC-SW-15 | Sliding Window | Cumulative acknowledgement base advancement & capacity release | **PASS** |
| TC-SW-16 | Sliding Window | Sequence-number wraparound without cycle ambiguity | **PASS** |
| TC-SW-17 | Sliding Window | Stale and out-of-window ACK rejection | **PASS** |
| TC-GBN-01 | Go-Back-N | Sender fills transmission window ($N = 4$) | **PASS** |
| TC-GBN-02 | Go-Back-N | Sender refuses to exceed configured window capacity | **PASS** |
| TC-GBN-03 | Go-Back-N | Valid cumulative ACK advances base correctly | **PASS** |
| TC-GBN-04 | Go-Back-N | Multiple acknowledged frames advance window (cumulative ACK) | **PASS** |
| TC-GBN-05 | Go-Back-N | Sequence number wraparound (modulo 5) | **PASS** |
| TC-GBN-06 | Go-Back-N | Invalid and stale ACKs do not corrupt sender state | **PASS** |
| TC-GBN-07 | Go-Back-N | Receiver accepts expected frame and advances expected sequence | **PASS** |
| TC-GBN-08 | Go-Back-N | Receiver discards out-of-order frame without buffering | **PASS** |
| TC-GBN-09 | Go-Back-N | Receiver does not deliver duplicate payloads | **PASS** |
| TC-GBN-10 | Go-Back-N | Timeout retransmits ALL outstanding frames from base | **PASS** |
| TC-GBN-11 | Go-Back-N | Successful ACK after retransmission resumes transmission | **PASS** |
| TC-GBN-12 | Go-Back-N | Retry exhaustion terminates sender in FAILED state | **PASS** |
| TC-GBN-13 | Go-Back-N | Corrupted frames rejected by receiver without delivery | **PASS** |
| TC-SR-01 | Selective Repeat | Valid configuration succeeds ($M \ge 2N$) | **PASS** |
| TC-SR-02 | Selective Repeat | Strict rejection when $M < 2N$ mathematical constraint is violated | **PASS** |
| TC-SR-03 | Selective Repeat | Sender window filling and refusal of excess frames | **PASS** |
| TC-SR-04 | Selective Repeat | Individual ACK tracking for each outstanding frame slot | **PASS** |
| TC-SR-05 | Selective Repeat | Contiguous sender-window sliding after base ACK | **PASS** |
| TC-SR-06 | Selective Repeat | Sequence-number wraparound handling | **PASS** |
| TC-SR-07 | Selective Repeat | Out-of-order frame buffering in receiver ($[rcvBase, rcvBase + N - 1]$) | **PASS** |
| TC-SR-08 | Selective Repeat | Cascaded sequential delivery of buffered frames upon missing frame arrival | **PASS** |
| TC-SR-09 | Selective Repeat | Duplicate frame prevention and non-redelivery | **PASS** |
| TC-SR-10 | Selective Repeat | Individual frame ACK transmission | **PASS** |
| TC-SR-11 | Selective Repeat | Rejection of out-of-window frames | **PASS** |
| TC-SR-12 | Selective Repeat | Selective retransmission of ONLY affected timed-out frame | **PASS** |
| TC-SR-13 | Selective Repeat | Independent timers: ACK of one frame does not reset unrelated timers | **PASS** |
| TC-SR-14 | Selective Repeat | Retry exhaustion marks sender FAILED and halts transmission | **PASS** |
| TC-SR-15 | Selective Repeat | Corrupted frame rejection without payload delivery | **PASS** |
| TC-SIM-01 | Simulation Engine | Valid configuration accepted & invalid configuration rejected | **PASS** |
| TC-SIM-02 | Simulation Engine | Seed reproducibility: identical configuration and seed yield identical results | **PASS** |
| TC-SIM-03 | Simulation Engine | Seed variation: distinct seeds yield distinct PRNG loss sequences | **PASS** |
| TC-SIM-04 | Simulation Engine | Stop-and-Wait transfer with zero loss runs to completion | **PASS** |
| TC-SIM-05 | Simulation Engine | Go-Back-N transfer with zero loss runs to completion | **PASS** |
| TC-SIM-06 | Simulation Engine | Selective Repeat transfer with zero loss runs to completion | **PASS** |
| TC-SIM-07 | Simulation Engine | Dropped data frame triggers timeout recovery and retransmission | **PASS** |
| TC-SIM-08 | Simulation Engine | Dropped ACK triggers recovery without duplicate payload delivery | **PASS** |
| TC-SIM-09 | Simulation Engine | Go-Back-N timeout retransmits all outstanding frames in window | **PASS** |
| TC-SIM-10 | Simulation Engine | Selective Repeat timeout retransmits only the affected frame | **PASS** |
| TC-SIM-11 | Simulation Engine | Pause halts virtual time and event progression | **PASS** |
| TC-SIM-12 | Simulation Engine | Step advances virtual time deterministically by specified delta | **PASS** |
| TC-SIM-13 | Simulation Engine | Resume continues paused simulation to completion | **PASS** |
| TC-SIM-14 | Simulation Engine | Reset restores initial state, clears queues, channels and timers | **PASS** |
| TC-SIM-15 | Simulation Engine | Performance statistics match expected counts and ratios | **PASS** |
| TC-SIM-16 | Simulation Engine | Safety limit prevents infinite execution upon retry exhaustion | **PASS** |
| TC-FE-01 | Frontend Visualizer | Protocol metadata covers all three protocols with distinct mechanics | **PASS** |
| TC-FE-02 | Frontend Visualizer | Protocol switching enforces mathematical constraints (SAW N=1, GBN M>N, SR M>=2N) | **PASS** |
| TC-FE-03 | Frontend Visualizer | Configuration form validation and negative parameter feedback | **PASS** |
| TC-FE-04 | Frontend Visualizer | Engine initialization and start lifecycle transitions | **PASS** |
| TC-FE-05 | Frontend Visualizer | Pause and resume control states freezing/resuming virtual time | **PASS** |
| TC-FE-06 | Frontend Visualizer | Discrete step execution and complete state reset | **PASS** |
| TC-FE-07 | Frontend Visualizer | Event timeline chronological display and normalized event rendering | **PASS** |
| TC-FE-08 | Frontend Visualizer | Statistics calculations and empty state handling without division-by-zero | **PASS** |
| TC-FE-09 | Frontend Visualizer | Simulation failure and retry exhaustion handling | **PASS** |
| TC-FE-10 | Frontend Visualizer | Selective Repeat out-of-order buffering and cascade delivery integration | **PASS** |
