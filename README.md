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
| **Simulation Mode** | **Implemented (Phases 1–5)** | Full in-memory deterministic simulation integrating Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ. Powered by a virtual clock, Mulberry32 PRNG loss model, and live interactive React telemetry. |
| **Live Networking Mode** | **Planned (Phase 6+)** | Physical Node.js networking agents communicating via native UDP datagrams (`dgram`) over local LAN/Wi-Fi, streaming real-time protocol telemetry to the browser via WebSockets. |
