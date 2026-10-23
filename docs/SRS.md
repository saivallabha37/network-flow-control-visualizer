# Software Requirements Specification (SRS)
## Network Flow Control Protocols Visualizer

**Version:** 1.0  
**Status:** Initial Draft  
**Project Type:** Educational Software / Computer Networks Prototype  
**Development Methodology:** Iterative and Incremental SDLC

---

## 1. Introduction

### 1.1 Purpose

The purpose of this Software Requirements Specification (SRS) is to define the functional and non-functional requirements of the Network Flow Control Protocols Visualizer. This document serves as the baseline for system design, implementation, testing, and validation.

The application will provide interactive visualizations of network flow-control and error-control protocols. It will also support a live communication prototype in which two computers exchange data using application-level frames and acknowledgements.

### 1.2 Scope

The system will provide two operating modes:

1. **Simulation Mode:** Simulates sender-receiver communication in a controlled environment and visualizes frame transmission, acknowledgements, packet loss, timeouts, and retransmissions.
2. **Live Communication Mode:** Enables two computers to exchange messages and files over a local network while displaying protocol events in real time.

The application will support the following protocols and mechanisms:

- Stop-and-Wait ARQ
- Sliding Window
- Go-Back-N ARQ
- Selective Repeat ARQ

The system will also provide execution controls, event logs, performance statistics, and protocol comparisons.

### 1.3 Intended Audience

This document is intended for:

- Project developers
- Faculty members and project reviewers
- Computer Networks students
- Software Engineering evaluators
- Testers and future maintainers

### 1.4 Definitions and Abbreviations

| Term | Definition |
|---|---|
| ARQ | Automatic Repeat reQuest |
| ACK | Acknowledgement |
| NAK | Negative Acknowledgement |
| Frame | A unit of data managed by the application-level protocol |
| Sender | Component responsible for transmitting frames |
| Receiver | Component responsible for receiving and validating frames |
| Timeout | A condition triggered when an expected acknowledgement is not received within a specified interval |
| Sliding Window | A technique that permits multiple outstanding frames |
| UDP | User Datagram Protocol |
| WebSocket | A communication protocol used to stream events between the networking agent and the browser interface |
| SDLC | Software Development Life Cycle |
| SRS | Software Requirements Specification |

### 1.5 References

- Computer Networks course materials on flow control and ARQ protocols.
- IEEE 830, Recommended Practice for Software Requirements Specifications, as a structural reference.
- IEEE 29148, Systems and Software Engineering — Life Cycle Processes — Requirements Engineering, as a requirements-engineering reference.

---

## 2. Overall Description

### 2.1 Product Perspective

The Network Flow Control Protocols Visualizer is a standalone educational application consisting of a browser-based frontend and a networking component.

In simulation mode, the protocol engine will generate and process events without requiring an external computer.

In live mode, a networking agent will run on each participating computer. The agents will exchange application-level frames over UDP and communicate with their respective browser interfaces through WebSocket connections.

The application will implement its own acknowledgement, sequencing, timeout, retransmission, and window-management logic for the selected protocol.

### 2.2 Product Functions

The major functions of the system are:

1. Protocol selection and configuration.
2. Visualization of sender and receiver operations.
3. Frame generation, transmission, and reception.
4. Acknowledgement generation and processing.
5. Simulation of frame loss, delay, and transmission errors.
6. Timeout detection and retransmission.
7. Live message and file transfer between two computers.
8. Display of protocol events and transmission statistics.
9. Step-by-step execution and simulation control.
10. Comparison of protocol behavior and performance.

### 2.3 User Classes

**Student / Learner**

- Selects a protocol.
- Configures simulation parameters.
- Observes frame transmission and acknowledgement behavior.
- Compares protocol performance.

**Demonstrator / Tester**

- Configures packet loss and delay.
- Runs test scenarios.
- Observes errors and retransmissions.
- Evaluates protocol correctness and performance.

**Live Communication User**

- Starts the networking agent.
- Connects to another computer.
- Sends messages or files.
- Monitors transfer progress and completion status.

The initial release will not require user accounts or a centralized administrator.

### 2.4 Operating Environment

The proposed application will use the following environment:

- Operating System: Windows 10/11 or another compatible operating system.
- Frontend: React, TypeScript, and Vite.
- Styling: Tailwind CSS.
- Networking Agent: Node.js and TypeScript.
- Data Transport: UDP.
- Dashboard Event Communication: WebSocket.
- Testing Framework: Vitest.
- Version Control: Git and GitHub.
- Browser: A modern browser supporting the required web technologies.

### 2.5 Design and Implementation Constraints

1. The frontend must remain separate from the networking and protocol logic.
2. The application must distinguish simulated events from events generated by live communication.
3. Protocol behavior must be implemented according to the selected protocol's rules.
4. UDP does not guarantee delivery, ordering, or duplicate suppression; the application must implement the reliability behavior required by its protocol.
5. Live communication may require firewall configuration and network permissions.
6. The initial live prototype will target computers connected to the same local network.
7. The application must not claim to display raw Ethernet frames when it is displaying application-level frames carried inside UDP datagrams.
8. The initial version will not require a database or cloud-hosted backend.

### 2.6 Assumptions and Dependencies

- The user has access to a compatible computer and browser.
- For live mode, both computers can run the networking agent.
- The required UDP and WebSocket ports can be accessed on the local network.
- Network connectivity exists between the participating computers.
- Simulation mode remains available when live communication cannot be established.

---

## 3. Functional Requirements

### FR-01: Protocol Selection

The system shall allow users to select Stop-and-Wait ARQ, Sliding Window, Go-Back-N ARQ, or Selective Repeat ARQ.

### FR-02: Simulation Configuration

The system shall allow users to configure applicable parameters, including frame count, window size, acknowledgement timeout, transmission delay, and frame-loss probability.

### FR-03: Sender Visualization

The system shall visually represent the sender, its transmission queue, outstanding frames, and the current sending window where applicable.

### FR-04: Receiver Visualization

The system shall visually represent received frames, expected sequence numbers, buffered frames, and receiver acknowledgement behavior.

### FR-05: Frame Transmission

The system shall display frame transmission from the sender to the receiver and indicate the status of each frame.

### FR-06: Acknowledgement Handling

The system shall display acknowledgement generation, transmission, and processing according to the selected protocol.

### FR-07: Error Simulation

The system shall allow users to simulate frame loss, acknowledgement loss, transmission delay, and selected transmission errors.

### FR-08: Timeout Handling

The system shall detect when the configured acknowledgement timeout expires and initiate the appropriate protocol-specific recovery behavior.

### FR-09: Retransmission

The system shall implement retransmission behavior appropriate to the selected protocol.

- Stop-and-Wait shall retransmit an unacknowledged frame after timeout.
- Go-Back-N shall retransmit the required outstanding frames beginning with the oldest unacknowledged frame after the applicable recovery condition.
- Selective Repeat shall retransmit only the frames requiring recovery.
- Sliding Window behavior shall follow the configured window and acknowledgement rules.

### FR-10: Execution Controls

The system shall provide controls to start, pause, resume, execute one step, and reset a simulation.

### FR-11: Event Logging

The system shall maintain an event log containing relevant events such as frame transmission, reception, acknowledgement, loss, timeout, retransmission, and delivery completion.

### FR-12: Live Communication

The system shall support communication between two computers running compatible networking agents on the same local network.

### FR-13: Message Transfer

The system shall support the transmission of text messages between connected computers and display the transfer status.

### FR-14: File Transfer

The system shall support the transfer of small files using application-level framing and protocol-specific reliability mechanisms.

### FR-15: Data Integrity

The system shall validate received frame data and verify the integrity of completed file transfers before reporting successful delivery.

### FR-16: Transmission Statistics

The system shall display relevant statistics, including frames sent, frames acknowledged, retransmissions, delivery status, elapsed time, and measured throughput.

### FR-17: Protocol Comparison

The system shall allow users to compare protocol behavior under equivalent simulation conditions.

### FR-18: Session Status

The system shall display the current mode, selected protocol, connection status where applicable, and simulation or transfer progress.

---

## 4. Non-Functional Requirements

### NFR-01: Usability

The interface shall provide clear labels, visible protocol states, and understandable event descriptions suitable for students learning Computer Networks.

### NFR-02: Correctness

The protocol engine shall follow the rules of the selected protocol and shall be validated through automated tests.

### NFR-03: Reliability

The system shall handle timeouts, duplicate frames, invalid data, and communication interruptions without silently reporting failed transfers as successful.

### NFR-04: Performance

The interface shall process ordinary simulation events without requiring a page reload. Performance targets will be established and evaluated during testing.

### NFR-05: Maintainability

The application shall separate UI components, protocol implementations, networking code, and test code into modular components.

### NFR-06: Portability

The application shall be designed to run on compatible development environments and support live communication between compatible computers on a local network.

### NFR-07: Data Integrity

The system shall use appropriate validation and integrity checks to detect corrupted or incomplete transfers.

### NFR-08: Security

The live prototype shall validate incoming messages, restrict accepted message sizes, and avoid executing received file contents. The application shall not expose unnecessary network services.

### NFR-09: Testability

The protocol engine shall support deterministic tests in which loss, delay, acknowledgement behavior, and timeout conditions can be controlled.

### NFR-10: Observability

The system shall provide sufficient event information to explain protocol state changes and diagnose failures.

---

## 5. Use Cases

### UC-01: Simulate a Protocol

**Primary Actor:** Student

**Preconditions:** The application is running.

**Main Flow:**
1. The user selects a protocol.
2. The user configures simulation parameters.
3. The user starts the simulation.
4. The system generates and transmits frames.
5. The system displays receiver events and acknowledgements.
6. The system updates protocol state and statistics.
7. The user pauses, steps through, or resets the simulation.

**Postcondition:** The user can observe the protocol's behavior and review the event log.

### UC-02: Simulate Frame Loss

**Primary Actor:** Student or Tester

**Preconditions:** A simulation is configured.

**Main Flow:**
1. The user enables frame loss or acknowledgement loss.
2. The simulation begins.
3. A configured loss condition occurs.
4. The system records the loss.
5. The sender responds according to the selected protocol.
6. The system visualizes the timeout and recovery events.

**Postcondition:** The user can observe the protocol's error-recovery behavior.

### UC-03: Transfer a Message Between Computers

**Primary Actor:** Live Communication User

**Preconditions:** Both networking agents are running and the computers can communicate over the network.

**Main Flow:**
1. The user configures the receiver address and port.
2. The agents establish or identify a communication session.
3. The sender selects a protocol and enters a message.
4. The sender frames and transmits the data.
5. The receiver processes the frames and returns acknowledgements.
6. The system displays protocol events on the dashboard.
7. The receiver reports successful delivery after the required validation.

**Postcondition:** The message is delivered and its transfer status is displayed, or a failure is reported.

### UC-04: Transfer a File

**Primary Actor:** Live Communication User

**Preconditions:** The live communication agents are available.

**Main Flow:**
1. The sender selects a file.
2. The system divides the file into application-level frames.
3. The sender transmits frames according to the selected protocol.
4. The receiver validates and processes received frames.
5. Lost or invalid frames are handled according to the protocol.
6. The receiver reassembles the data.
7. The system verifies file integrity and reports the final result.

**Postcondition:** A validated file is available at the receiver, or the transfer is reported as unsuccessful.

---

## 6. External Interface Requirements

### 6.1 User Interface

The application shall provide:

- Protocol selection controls.
- Simulation and live communication modes.
- Sender and receiver visualizations.
- Frame and acknowledgement animations.
- Play, pause, step, and reset controls.
- Simulation configuration controls.
- Event logs and status indicators.
- Statistics and comparison displays.
- Live connection and file-transfer status.

### 6.2 Software Interfaces

The frontend shall communicate with its local networking agent through WebSocket connections.

The networking agents shall communicate over UDP using a documented application-level frame format.

The protocol engine shall expose events to the visualization layer without depending on UI-specific code.

### 6.3 Communication Interfaces

The live communication protocol shall define the required message types, frame identifiers, sequence numbers, acknowledgement fields, session identifiers, and integrity information.

Message sizes shall respect configured limits and applicable network constraints.

---

## 7. System Architecture Overview

The system shall consist of the following logical components:

1. **Frontend:** Displays protocol behavior and accepts user input.
2. **Protocol Engine:** Implements sequencing, window management, acknowledgements, timers, and retransmission logic.
3. **Simulation Engine:** Provides controlled and repeatable simulation conditions.
4. **Networking Agent:** Sends and receives UDP datagrams.
5. **Event Service:** Streams protocol events to the dashboard through WebSockets.
6. **Statistics Module:** Calculates and presents transfer metrics.
7. **Test Module:** Validates protocol behavior and system integration.

In live mode, the networking agent and protocol engine shall coordinate actual transmissions and acknowledgements. The visualization shall be based on recorded protocol events rather than fabricated animation sequences.

---

## 8. Data and Performance Metrics

The system shall collect the following metrics where applicable:

- Total frames transmitted.
- Successfully received frames.
- Acknowledgements sent and received.
- Retransmission count.
- Lost or invalid frame count.
- Transfer completion time.
- Effective throughput.
- Configured window size.
- Configured timeout and delay.
- Delivery and integrity status.

Metrics shall be interpreted in the context of the selected protocol and operating mode. Simulation results and live measurements shall be clearly distinguished.

---

## 9. Acceptance Criteria

The initial release shall be considered acceptable when the following conditions are satisfied:

1. Users can select and run all four supported protocol modes.
2. Frame transmission and acknowledgement events are displayed correctly.
3. Configured frame loss triggers the appropriate protocol recovery behavior.
4. Go-Back-N and Selective Repeat demonstrate their distinct retransmission strategies.
5. Execution controls operate correctly during simulation.
6. Event logs and statistics reflect actual simulation events.
7. Two compatible computers can exchange messages over a local network.
8. File transfer includes frame handling, recovery, reassembly, and integrity verification.
9. Automated tests cover major protocol state transitions and error scenarios.
10. Setup instructions allow another user to run the application in a compatible environment.

These criteria will be verified during the testing phase. Requirements that have not yet been implemented or tested shall not be reported as completed.

---

## 10. Testing Strategy

The project shall use multiple levels of testing.

### 10.1 Unit Testing

Test protocol state transitions, sequence-number handling, acknowledgement processing, window management, timeout handling, and retransmission decisions independently.

### 10.2 Integration Testing

Test communication between the protocol engine, networking agent, event service, and frontend.

### 10.3 System Testing

Test complete simulation and live communication workflows.

### 10.4 Error and Recovery Testing

Test frame loss, acknowledgement loss, duplication, delay, invalid frames, out-of-order delivery, and connection interruption.

### 10.5 Acceptance Testing

Verify that the system meets the requirements and acceptance criteria specified in this document.

---

## 11. Project Limitations

- The initial live prototype targets a local network.
- UDP communication may be affected by firewalls and network configuration.
- The application visualizes application-level frames, not raw Ethernet frames.
- Results from a controlled simulation may differ from real network measurements.
- Advanced security, internet-wide discovery, and production-scale deployment are outside the initial scope.
- Sliding Window is a general technique; its exact behavior depends on the selected acknowledgement and recovery mechanism.

---

## 12. Future Enhancements

Potential future enhancements include:

- Internet-wide communication support.
- More advanced performance graphs.
- Session history and exportable reports.
- Additional network error models.
- Protocol parameter recommendations.
- Enhanced security and authenticated sessions.
- Support for additional error-control protocols.

---

## 13. Revision History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-10-23 | Initial SRS draft |

---

**End of Document**

