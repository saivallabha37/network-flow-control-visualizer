# Requirements Traceability Matrix
## Network Flow Control Protocols Visualizer

**Version:** 1.0  
**Status:** Initial planning draft

## 1. Purpose

This document maps the Software Requirements Specification (SRS) to the system components and planned test cases. It helps ensure that every requirement has a corresponding implementation responsibility and verification method.

## 2. Traceability Matrix

| Requirement ID | Requirement | Planned Component | Verification |
|---|---|---|---|
| FR-01 | Select a flow control protocol | Protocol Selector UI | AT-01 |
| FR-02 | Configure simulation parameters | Simulation Configuration | UT-01, AT-02 |
| FR-03 | Visualize sender state | Sender Visualization | IT-01 |
| FR-04 | Visualize receiver state | Receiver Visualization | IT-01 |
| FR-05 | Transmit frames between endpoints | Protocol Engine | UT-02, IT-02 |
| FR-06 | Generate and process acknowledgements | Protocol Engine | UT-03 |
| FR-07 | Simulate frame and ACK loss | Simulation Engine | UT-04 |
| FR-08 | Detect transmission timeouts | Timer Manager | UT-05 |
| FR-09 | Retransmit frames according to protocol rules | Protocol Engine | UT-06, IT-03 |
| FR-10 | Start, pause, resume and reset simulations | Simulation Controller | AT-03 |
| FR-11 | Display a chronological event log | Event Logger | IT-04 |
| FR-12 | Establish live communication between two systems | Networking Agent | IT-05 |
| FR-13 | Transfer text messages between systems | Message Transfer Module | IT-06 |
| FR-14 | Transfer small files between systems | File Transfer Module | IT-07 |
| FR-15 | Verify received data integrity | Integrity Checker | UT-07, IT-08 |
| FR-16 | Display protocol performance statistics | Statistics Module | UT-08 |
| FR-17 | Compare protocol performance | Comparison Module | AT-04 |
| FR-18 | Display live connection and session status | Connection Manager | IT-09 |

## 3. Non-Functional Requirement Verification

| Requirement ID | Requirement | Verification Method |
|---|---|---|
| NFR-01 | Usable interface | User acceptance testing |
| NFR-02 | Correct protocol behavior | Protocol unit tests |
| NFR-03 | Reliable transfer and recovery | Loss and timeout tests |
| NFR-04 | Responsive visualization | Performance testing |
| NFR-05 | Maintainable modular design | Code review and module separation |
| NFR-06 | Cross-platform compatibility | Environment testing |
| NFR-07 | Data integrity | Checksum or hash verification |
| NFR-08 | Safe live communication | Input validation and network testing |
| NFR-09 | Testable architecture | Automated test coverage |
| NFR-10 | Observable protocol events | Event-log verification |

## 4. Traceability Rules

1. Every implemented feature should map to at least one requirement.
2. Every requirement should have one or more planned verification tests.
3. Test results must be recorded only after the tests are executed.
4. If a requirement changes, update the SRS, design and relevant tests.
5. Requirements not implemented in the current release must be marked as pending or deferred.

## 5. Current Status

| Requirement ID | Description | Component Mapping | Verification Test(s) | Status |
|---|---|---|---|---|
| FR-01 | Protocol Selection (Stop-and-Wait, GBN, SR) | `ProtocolSelector.tsx`, `protocols/` | TC-SW-01..12, TC-GBN-01..13, TC-SR-01..15, TC-FE-01..02 | **VERIFIED (PASS)** |
| FR-02 | Simulation Configuration | `SimulationConfigPanel.tsx`, `simulation-config.ts` | TC-SIM-01..03, TC-FE-03 | **VERIFIED (PASS)** |
| FR-03 | Sender Visualization & Window State | `NetworkTopology.tsx` | TC-FE-04, TC-FE-10 | **VERIFIED (PASS)** |
| FR-04 | Receiver Visualization & Buffering | `NetworkTopology.tsx` | TC-SR-07..08, TC-FE-10 | **VERIFIED (PASS)** |
| FR-05 | Frame Transmission & Trajectory Mapping | `virtual-channel.ts`, `SpaceTimeDiagram.tsx`, `PacketInspector.tsx` | TC-SIM-04..06, TC-FE-11, TC-FE-13..14 | **VERIFIED (PASS)** |
| FR-06 | Acknowledgement Generation & Processing | Protocol Engines, `protocol-adapters.ts` | TC-SW-04, TC-GBN-03..04, TC-SR-04..05 | **VERIFIED (PASS)** |
| FR-07 | Error Simulation (Loss, Delay, Corruption) | `virtual-channel.ts` | TC-SIM-07..08, TC-FE-12, TC-FE-16..19 | **VERIFIED (PASS)** |
| FR-08 | Timeout Detection & Recovery | Protocol Adapters, Engine Timers | TC-SW-06, TC-GBN-10, TC-SR-12..13, TC-SIM-07 | **VERIFIED (PASS)** |
| FR-09 | Retransmission Mechanics | Protocol Engines | TC-SW-07, TC-GBN-10, TC-SR-12, TC-SIM-09..10 | **VERIFIED (PASS)** |
| FR-10 | Execution Controls (Play, Pause, Step, Reset) | `simulation-engine.ts`, `SimulationControls.tsx` | TC-SIM-11..14, TC-FE-05..06 | **VERIFIED (PASS)** |
| FR-11 | Event Logging & Space-Time Correlation | `simulation-events.ts`, `EventTimeline.tsx` | TC-FE-07, TC-FE-11 | **VERIFIED (PASS)** |
| FR-12 | Live UDP Communication | `networking-agent.ts`, `udp-codec.ts` | TC-LIVE-01..03, TC-LIVE-09, TC-LIVE-11..15 | **VERIFIED (PASS local loopback; physical multi-laptop deferred)** |
| FR-13 | Live Text Message Transfer | `live-session.ts`, `LiveNetworkingPanel.tsx` | TC-LIVE-04..05 | **VERIFIED (PASS local loopback; physical multi-laptop deferred)** |
| FR-14 | Live Chunked File Transfer | `file-transfer.ts`, `LiveNetworkingPanel.tsx` | TC-LIVE-06..08, TC-LIVE-16..19 | **VERIFIED (PASS)** |
| FR-15 | Data Integrity (CRC-32 & SHA-256) | `checksum.ts`, `frame-codec.ts`, `file-transfer.ts` | TC-FC-01..07, TC-LIVE-06, TC-LIVE-15 | **VERIFIED (PASS)** |
| FR-16 | Transmission Statistics & Utilization | `simulation-stats.ts`, `StatisticsPanel.tsx` | TC-SIM-15, TC-FE-08 | **VERIFIED (PASS)** |
| FR-17 | Protocol Comparison Benchmark | `protocol-comparison.ts`, `ProtocolComparisonModal.tsx` | TC-COMP-01..02, TC-FE-COMP-01..02 | **VERIFIED (PASS)** |
| FR-18 | Live Connection & Session Status | `LiveNetworkingPanel.tsx`, `Header.tsx` | TC-LIVE-10 | **VERIFIED (PASS)** |

All automated unit, integration, and scenario tests pass cleanly across agent and frontend workspaces.
