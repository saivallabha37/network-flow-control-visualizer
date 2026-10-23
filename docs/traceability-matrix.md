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

This matrix represents the initial design baseline. Implementation status and test results will be updated throughout development.
