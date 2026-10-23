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

**End of Document**
