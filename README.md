# Network Flow Control Protocols Visualizer

An educational and empirical Software Engineering project designed to model, test, and visualize data link and transport layer flow control and Automatic Repeat reQuest (ARQ) reliability protocols.

The system supports both **deterministic simulation** and **live peer-to-peer UDP transmission** over local LAN/Wi-Fi with browser-based real-time telemetry.

---

## 1. Supported Protocols & Mechanisms

| Protocol / Mechanism | Classification | Description |
|---|---|---|
| **Stop-and-Wait ARQ** | 1-Frame ARQ Protocol | Transmits a single frame and waits for an acknowledgement (ACK) before transmitting the next. Handles frame/ACK loss with timeouts. |
| **Sliding Window** | Windowing Mechanism | General flow control technique allowing multiple unacknowledged frames in transit within sender and receiver window boundaries. |
| **Go-Back-N (GBN) ARQ** | Windowed ARQ Protocol | Employs sliding window with cumulative ACKs. Retransmits all outstanding frames in the window upon timeout. |
| **Selective Repeat (SR) ARQ** | Windowed ARQ Protocol | Employs sliding window with individual frame ACKs and receiver buffering. Retransmits only frames that timed out or failed integrity checks. |

> **Note on Protocol Taxonomy:**  
> Sliding Window is a general mechanism, whereas Go-Back-N and Selective Repeat are specific ARQ protocols that utilize windowing.

---

## 2. Operating Modes

1. **Simulation Mode:**
   - Runs locally in the browser/node environment with two virtual endpoints.
   - Emulates frame propagation delay, frame loss, ACK loss, and out-of-order delivery.
   - Provides step-by-step playback, pause/resume, and empirical performance metrics (throughput, retransmission ratio, link utilization).

2. **Live Mode:**
   - Runs two peer Node.js networking agents communicating directly via **UDP sockets** across a LAN or Wi-Fi network.
   - Real message and small-file data chunks encapsulated inside custom application-layer frames.
   - Streams live protocol state and telemetry events to the local React visualizer dashboard via **WebSockets**.

---

## 3. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend / Networking Agent:** Node.js, TypeScript, Native UDP (`dgram`)
- **Browser-to-Agent Event Streaming:** WebSocket (`ws`)
- **Testing Framework:** Vitest
- **Package Management & Monorepo:** npm workspaces
- **Documentation:** Markdown & Mermaid UML

---

## 4. Repository Structure

```text
network-flow-control-visualizer/
├── .gitignore               # Ignored dependencies, build outputs, environment files
├── README.md                # System overview and quick-start guide
├── package.json             # Root monorepo workspace configuration
├── docs/                    # Software Engineering specification documents
│   ├── SRS.md               # Software Requirements Specification (IEEE standard)
│   ├── design.md            # Architecture, data flow, and module boundaries
│   ├── diagrams.md          # UML Mermaid diagrams (Use case, sequence, state)
│   ├── test-plan.md         # Unit, integration, and system test plan
│   └── traceability-matrix.md # Requirements-to-test mapping matrix
├── agent/                   # Node.js networking agent & protocol engine
│   ├── src/
│   │   ├── protocols/       # Protocol engines (Stop-and-Wait, Sliding Window, Go-Back-N, Selective Repeat)
│   │   ├── simulation/      # Simulation engine, virtual channel, adapters, stats, events
│   │   ├── types/           # Canonical protocol types & event definitions
│   │   ├── utils/           # CRC-32 checksum and frame codec (serialization/validation)
│   │   └── index.ts         # Agent entry point
│   ├── tests/               # Vitest unit test suite (codec, protocol & simulation tests)
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
└── frontend/                # React visualizer application
    ├── src/
    │   ├── App.tsx          # Main application dashboard
    │   ├── main.tsx         # React root mounting
    │   └── index.css        # Tailwind CSS imports
    ├── tests/               # Vitest frontend tests
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 5. Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher, v22 LTS recommended)
- npm (v9.0.0 or higher)

### Installation
Install all workspace dependencies from the root directory:
```bash
npm install
```

### Type Checking
Run TypeScript type-checks across all packages:
```bash
npm run typecheck
```

### Automated Tests
Run Vitest test suites across all packages:
```bash
npm run test
```

### Production Build
Build the agent and frontend packages:
```bash
npm run build
```

### Development Servers
- **Frontend Interactive Visualizer:**
  ```bash
  npm run dev:frontend
  # or
  npm run dev --workspace=frontend
  ```
  Launches the Vite React laboratory dashboard (e.g. `http://localhost:5173` or `http://localhost:5174`).

- **Networking Agent:**
  ```bash
  npm run dev:agent
  ```

---

## 6. Simulation Mode vs. Live Networking Mode

| Mode | Status | Description |
|---|---|---|
| **Simulation Mode** | **Implemented (Phases 1–5.1)** | Full in-memory deterministic simulation integrating Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ. Includes Space-Time (ladder) sequence diagrams, interactive packet inspector, smooth motion animation, theoretical channel utilization metrics, and 5 guided educational presets. |
| **Live Networking Mode** | **Implemented (Phase 6)** | Real Node.js networking agents communicating via native UDP datagrams (`dgram`) over local LAN/Wi-Fi or loopback, bidirectional handshakes, ARQ flow control, chunked file transfer with SHA-256 verification, and real-time WebSocket telemetry to the React visualizer. |

---

## 7. Advanced Educational Visualization Features (Phase 5.1)

### 1. Space-Time Sequence Diagram (Ladder / Bounce View)
- Displays Sender (Host A) and Receiver (Host B) as vertical axes with virtual time progressing downward.
- Draws diagonal vector trajectories for DATA frames ($A \to B$) and ACKs ($B \to A$).
- Shows actual propagation delay slopes, dropped packets (marked with midpoint loss icons), retransmissions (amber dashed vectors), and timeout expirations.
- Synchronized with the chronological event timeline: selecting an arrow highlights the corresponding event, and selecting an event highlights the diagram trajectory.
- Features dynamic zoom scaling (30% to 250%) and auto-scroll tracking.

### 2. Guided Lab Scenarios
Curated educational presets with deterministic seeds designed to produce specific protocol outcomes:
1. **Loss-Free Baseline:** Ideal transmission establishing regular window sliding without channel noise.
2. **High-Latency Satellite Link:** Demonstrates the severe throughput penalty of Stop-and-Wait over large RTTs ($D = 150\text{ ms}$, RTT $= 300\text{ ms}$) versus pipelined windowing.
3. **Go-Back-N Recovery:** Illustrates receiver discarding of subsequent out-of-order frames when a frame drops, followed by bulk retransmission of the entire window upon timer expiration.
4. **Selective Repeat Buffering:** Demonstrates receiver-side out-of-order buffering, individual ACKs, retransmission of only the missing frame, and cascade delivery.
5. **Lost Acknowledgement Recovery:** Demonstrates recovery when reverse ACKs are lost, including duplicate detection without repeated payload delivery.

### 3. Interactive Packet Inspector
- Clicking any in-flight packet in the channel animation or trajectory in the space-time diagram opens the Inspector.
- Displays frame type (`DATA` / `ACK`), sequence/ACK number, payload text & byte size, CRC-32 integrity status, departure/arrival timestamps, and remaining in-flight delay.
- Allows pausing playback directly to inspect transient packets, with a one-click resume button.
- Strictly labels unexposed fields as "Unavailable" without inventing fake values.

### 4. Theoretical Channel Utilization Metrics
- Enhanced statistics panel displaying observed empirical delivery throughput side-by-side with theoretical link utilization:
  - Stop-and-Wait: $U = \frac{T_{frame}}{T_{frame} + 2D} = \frac{1}{1 + 2a}$
  - Pipelined Sliding Window: $U = \min\left(1, \frac{N \cdot T_{frame}}{T_{frame} + 2D}\right)$
- Includes an educational metrics guide detailing all mathematical definitions and assumptions.

---

## 7. Two-Laptop Live UDP Networking (Phase 6 Guide)

The visualizer supports real datagram communication between two physical laptops connected to the same Wi-Fi or local area network (LAN), as well as local loopback testing on a single machine.

### Architecture Overview

```
Laptop A (Host A)                                 Laptop B (Host B)
┌────────────────────────┐                       ┌────────────────────────┐
│  React Browser UI      │                       │  React Browser UI      │
│  (Vite port 5173)      │                       │  (Vite port 5173)      │
└───────────┬────────────┘                       └───────────┬────────────┘
            │ WebSocket (127.0.0.1:8080)                     │ WebSocket (127.0.0.1:8080)
┌───────────▼────────────┐                       ┌───────────▼────────────┐
│ Node.js Agent A        │      Real UDP         │ Node.js Agent B        │
│ UDP Listen: 0.0.0.0:9000│ ◄───────────────────► │ UDP Listen: 0.0.0.0:9000│
└────────────────────────┘     (Port 9000)       └────────────────────────┘
```

### Step-by-Step Setup Between Two Physical Laptops

#### Step 1: Connect to the Same Wi-Fi / Local Network
Ensure both Laptop A and Laptop B are connected to the same Wi-Fi or LAN subnet.

#### Step 2: Determine Each Laptop's Local IP Address
- **On Windows:** Open PowerShell/CMD and run `ipconfig`. Look for the IPv4 Address under your Wi-Fi or Ethernet adapter (e.g., `192.168.1.45`).
- **On macOS/Linux:** Open Terminal and run `ifconfig` or `ip a` (e.g., `192.168.1.62`).

#### Step 3: Firewall Access (Windows / macOS)
Ensure incoming UDP on port `9000` is permitted through the local firewall:
- When prompted by Windows Defender or macOS security dialog on first run, select **Allow Access for Private Networks**.

#### Step 4: Start the Networking Agent on Both Laptops
The agent automatically establishes a **dual listener** for both standard WebSockets (`ws://127.0.0.1:8080`) and secure TLS WebSockets (`wss://127.0.0.1:8443`), alongside the real UDP listener on `0.0.0.0:9000`.

You can launch the agent using any of these methods (no VS Code required!):
- **Option A (1-Click Batch):** Double-click `start-agent.bat` in the project root.
- **Option B (Silent Background):** Double-click `scripts/windows/start-agent-background.vbs`.
- **Option C (CLI):**
  - **On Laptop A:**
    ```bash
    npm run agent:live -- --udp 9000 --ws 8080 --wss 8443
    ```
  - **On Laptop B:**
    ```bash
    npm run agent:live -- --udp 9000 --ws 8080 --wss 8443
    ```
*(Note: If running on a single laptop for testing, use distinct UDP and WS ports: e.g. Laptop A on `--udp 9000 --ws 8080 --wss 8443` and Laptop B on `--udp 9001 --ws 8081 --wss 8444`.)*

#### Step 5: Launch the Frontend Visualizer
- **Local Dev:** Run `npm run dev:frontend` and open `http://localhost:5173` (connects seamlessly to `ws://127.0.0.1:8080`).
- **Vercel Deployment:** Open your deployed URL (`https://<project>.vercel.app`). The Live UDP Network tab loads by default and connects securely to `wss://127.0.0.1:8443`.
  - *First-time Windows setup for HTTPS:* Run `scripts/windows/trust-cert.bat` (or open `https://127.0.0.1:8443` once in your browser and proceed past the self-signed certificate warning). See [docs/windows-and-vercel-guide.md](docs/windows-and-vercel-guide.md) for full details.

#### Step 6: Connect and Exchange Protocol Data
1. In the header bar, click **Live UDP Network**.
2. Verify the local agent status displays **Agent Online** (`ws://127.0.0.1:8080`).
3. Under **Peer Handshake & Protocol Setup**:
   - On Laptop A: Enter Laptop B's LAN IP (e.g. `192.168.1.62`) and UDP port `9000`.
   - Select the desired protocol: **Stop-and-Wait ARQ**, **Go-Back-N ARQ**, or **Selective Repeat ARQ**.
   - Click **Initiate Handshake with Peer**.
4. Both laptops transition to **Connected to Peer** (`HOST_A` and `HOST_B`).
5. **Bidirectional Live Chat:**
   - Type a message and press **Enter** (Shift+Enter for newline).
   - Watch real-time delivery status progression: *Sending...*, *Transmitted on UDP [seq N]*, *Delivered & ACKed*, or *Failed*.
   - Incoming messages appear immediately without retransmission duplicates.
6. **Safe Chunked File Transfer & Browser Downloads:**
   - Select a file and click **Send File**. The agent slices the file into safe 768-byte chunks, hashes it with SHA-256, and reliably transmits it over the active ARQ flow control protocol.
   - The **Received Files Dashboard** shows all verified files received on this laptop.
   - Click **Download** next to any received file to save it directly into your browser's **Downloads folder** via the agent API.
7. **Simulate Faults on Demand:**
   - Click **Drop Next DATA Frame** or **Drop Next Outgoing ACK**.
   - Transmit a message. Observe the timer count down and the sender automatically initiate retransmission across the real UDP socket!
