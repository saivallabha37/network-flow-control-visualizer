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
