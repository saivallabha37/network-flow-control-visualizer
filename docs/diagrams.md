# UML Diagrams
## Network Flow Control Protocols Visualizer

**Version:** 1.0  
**Purpose:** System design and Software Engineering documentation.

---

## 1. Use-Case Diagram

This diagram represents the interactions between the user and the system.

```mermaid
flowchart LR
    U["Student / User"]

    subgraph SYS["Network Flow Control Protocols Visualizer"]
        UC1(["Select Protocol"])
        UC2(["Configure Simulation"])
        UC3(["Run Simulation"])
        UC4(["Visualize Frames and ACKs"])
        UC5(["Simulate Frame Loss"])
        UC6(["View Statistics"])
        UC7(["Compare Protocols"])
        UC8(["Connect to Peer"])
        UC9(["Transfer Message or File"])
        UC10(["View Event Log"])
    end

    U --- UC1
    U --- UC2
    U --- UC3
    U --- UC4
    U --- UC5
    U --- UC6
    U --- UC7
    U --- UC8
    U --- UC9
    U --- UC10
```

**Explanation:** The user selects protocols, configures and executes simulations, observes protocol behavior, compares results, and optionally uses live communication.

## 2. Component Diagram

This diagram describes the major software components and their responsibilities.

```mermaid
flowchart TB
    USER["User"]

    subgraph FRONTEND["Frontend Layer"]
        UI["React + TypeScript UI"]
        VIZ["Visualization Components"]
        STATS["Statistics Dashboard"]
    end

    subgraph CORE["Application Core"]
        ENGINE["Protocol Engine"]
        SIM["Simulation Engine"]
        EVENTS["Protocol Event Service"]
    end

    subgraph NETWORK["Networking Layer"]
        AGENT["Node.js Networking Agent"]
        UDP["UDP Transport"]
        WS["WebSocket Interface"]
    end

    PEER["Peer Computer"]

    USER --> UI
    UI --> VIZ
    UI --> STATS
    UI --> ENGINE
    ENGINE --> SIM
    ENGINE --> EVENTS
    EVENTS --> UI
    ENGINE --> AGENT
    AGENT --> UDP
    AGENT --> WS
    UDP <--> PEER
    WS <--> UI
```

**Explanation:**

- The frontend accepts user input and displays protocol events.
- The protocol engine manages sequencing, windows, acknowledgements, timeouts and retransmissions.
- The simulation engine provides controlled frame loss and delay.
- The networking agent exchanges real UDP datagrams.
- The WebSocket interface streams live events to the dashboard.

The exact implementation interfaces will be finalized during detailed design.

## 3. Sequence Diagram — Successful Frame Transmission

This diagram illustrates a simplified Stop-and-Wait ARQ exchange.

```mermaid
sequenceDiagram
    actor User
    participant S as Sender
    participant N as Network
    participant R as Receiver
    participant V as Visualizer

    User->>S: Start transmission
    S->>S: Create frame with sequence number
    S->>N: Send frame
    S->>V: Emit FRAME_SENT event
    N->>R: Deliver frame
    R->>R: Validate frame and sequence number
    R->>V: Emit FRAME_RECEIVED event
    R->>N: Send ACK
    N->>S: Deliver ACK
    S->>S: Validate ACK and update state
    S->>V: Emit ACK_RECEIVED event
    S->>S: Send next frame if available
```

**Explanation:** The sender transmits one frame and waits for its acknowledgement before proceeding. The visualizer reflects the events produced by the protocol engine.

## 4. Sequence Diagram — Frame Loss and Retransmission

```mermaid
sequenceDiagram
    participant S as Sender
    participant N as Network
    participant R as Receiver
    participant V as Visualizer

    S->>N: Send Frame 0
    N--xR: Frame 0 lost
    S->>V: Emit FRAME_SENT event
    S->>S: Start timeout timer
    Note over S: ACK not received
    S->>S: Timeout expires
    S->>V: Emit TIMEOUT event
    S->>N: Retransmit Frame 0
    N->>R: Deliver Frame 0
    R->>R: Validate and accept frame
    R->>N: Send ACK 0
    N->>S: Deliver ACK 0
    S->>V: Emit RETRANSMISSION and ACK events
```

**Explanation:** When a frame is lost, the sender detects the timeout and retransmits. The receiver processes the retransmitted frame and acknowledges it.

## 5. Protocol State Diagram — Stop-and-Wait ARQ

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> WaitingForACK: Send frame
    WaitingForACK --> Ready: Valid ACK received
    WaitingForACK --> Retransmit: Timeout
    Retransmit --> WaitingForACK: Resend frame
    Ready --> [*]: All frames acknowledged
```

**Explanation:** Stop-and-Wait permits one outstanding data frame at a time. The sender proceeds after receiving the expected acknowledgement or retransmits after a timeout.

## 6. Protocol State Diagram — Go-Back-N ARQ

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Sending: Window has capacity
    Sending --> Sending: Send additional frame
    Sending --> Waiting: Window is full
    Waiting --> Sending: ACK advances send window
    Sending --> Retransmitting: Timeout
    Waiting --> Retransmitting: Timeout
    Retransmitting --> Waiting: Resend outstanding frames
    Waiting --> [*]: All frames acknowledged
```

**Explanation:** Go-Back-N allows multiple outstanding frames. Following a timeout, the sender retransmits the outstanding frames beginning with the oldest unacknowledged frame.

## 7. Protocol State Diagram — Selective Repeat ARQ

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Sending: Window has capacity
    Sending --> Waiting: Frames outstanding
    Waiting --> Waiting: ACK for individual frame
    Waiting --> Retransmitting: Frame timeout
    Retransmitting --> Waiting: Resend affected frame
    Waiting --> Sending: Window advances
    Sending --> [*]: All frames acknowledged
```

**Explanation:** Selective Repeat maintains individual acknowledgement and retransmission state for frames. Valid out-of-order frames can be buffered, and only frames requiring recovery are retransmitted.

---

## 8. Design Notes

1. The diagrams describe the intended architecture and behavior, not proof of an implemented system.
2. Protocol state machines will be refined alongside the detailed design and automated tests.
3. Sliding Window is a general mechanism; Go-Back-N and Selective Repeat are specific ARQ strategies that use windowing.
4. Simulation events and live network events must be distinguishable in the implementation.
5. All final protocol behavior must be verified against the requirements in `SRS.md`.

---

**End of Document**
