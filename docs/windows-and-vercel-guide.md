# Windows Background Agent & Vercel Deployment Setup Guide

This guide explains how to run the Network Flow Control Protocols Visualizer's live networking agent independently on Windows (without keeping VS Code or a command prompt open) and how to connect the live agent to the project deployed on **Vercel** (`https://<your-project>.vercel.app`).

---

## 1. Running the Agent Without Opening VS Code / CLI

The repository includes pre-configured Windows batch and VBScript automation runners in the root directory and under `scripts/windows/`.

### Option A: 1-Click Visible Console Runner
- Simply double-click **`start-agent.bat`** in the project root.
- A terminal window will open and start the Networking Agent with dual WebSocket listeners:
  - **Standard WebSocket:** `ws://127.0.0.1:8080` (for local HTTP development)
  - **Secure WebSocket (TLS):** `wss://127.0.0.1:8443` (for HTTPS deployments like Vercel)
  - **Real UDP Socket:** Listening on `0.0.0.0:9000` for physical network datagrams.
- To stop the agent, press `Ctrl+C` or close the window.

### Option B: Silent Background Execution (Hidden Window)
- Double-click **`scripts/windows/start-agent-background.vbs`**.
- The Networking Agent runs completely invisibly in the background with both port 8080 and port 8443 active.
- To check if the agent is active:
  - Double-click **`status-agent.bat`** in the root, or run:
    ```bash
    npm run agent:service:status
    ```
- To stop the background agent:
  - Double-click **`stop-agent.bat`** in the root, or run:
    ```bash
    npm run agent:stop
    ```

### Option C: Automatic Windows Startup Service
If you want the networking agent to start automatically whenever you turn on or sign in to your laptop:
1. Double-click **`scripts/windows/install-startup.bat`** (or run `npm run agent:service:install`).
2. A Windows Startup shortcut will be registered in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`.
3. To remove the auto-start registration:
   - Double-click **`scripts/windows/uninstall-startup.bat`** (or run `npm run agent:service:uninstall`).

---

## 2. Windows Defender Firewall Configuration (UDP Port 9000)

When two laptops are connected to the same Wi-Fi or LAN subnet, Windows Defender Firewall might silently drop incoming UDP datagrams if a firewall rule is not configured.

### Automatic Setup (Recommended)
1. Right-click **`scripts/windows/configure-firewall.bat`** and select **Run as administrator**.
2. The script adds inbound and outbound firewall rules allowing UDP traffic on port `9000`.

### Manual PowerShell Setup
Alternatively, open PowerShell as Administrator and run:
```powershell
New-NetFirewallRule -DisplayName "NFCV Live UDP 9000 Inbound" -Direction Inbound -Protocol UDP -LocalPort 9000 -Action Allow
New-NetFirewallRule -DisplayName "NFCV Live UDP 9000 Outbound" -Direction Outbound -Protocol UDP -LocalPort 9000 -Action Allow
```

---

## 3. Local Networking Agent & Vercel HTTPS Architecture

When you access the visualizer via its deployed Vercel URL (e.g., `https://network-flow-control-visualizer.vercel.app`), the web page is served over **HTTPS**, while your local networking agent runs on loopback `127.0.0.1` on each laptop.

### Understanding Browser Mixed-Content Architecture
Modern web browsers enforce strict Mixed Content policies: pages served over secure `https://` (such as `https://network-flow-control-visualizer.vercel.app`) cannot establish unencrypted `ws://` WebSocket connections.

To provide a secure and clean environment without compromising browser security:

#### Option A: Zero-Configuration Local Development (Fastest Local Evaluation)
1. Run the frontend locally on your laptop:
   ```bash
   npm run dev:frontend
   ```
2. Open `http://localhost:5173`.
3. Because the site is served over standard `http://`, the browser connects to `ws://127.0.0.1:8080` immediately without certificate requirements or mixed-content restrictions.

#### Option B: Secure Local Agent Endpoint (WSS / TLS on Port 8443)
The local agent automatically runs a **dual-listener architecture**: it binds `ws://127.0.0.1:8080` and `wss://127.0.0.1:8443` concurrently using the bundled local loopback certificates in `agent/certs/`.

Because modern browsers require TLS trust for `wss://`, complete this simple one-time setup on Windows:

1. **One-Click Windows Certificate Trust (Recommended):**
   - Double-click **`scripts/windows/trust-cert.bat`** (or run `npm run cert:trust`).
   - This registers `agent/certs/cert.pem` into the Windows Current User Trusted Root store using standard Windows `certutil`.
   - Chrome and Edge will now natively trust `wss://127.0.0.1:8443` with zero interstitial warnings.
   - *(To remove the certificate at any time, run `scripts/windows/untrust-cert.bat` or `npm run cert:untrust`).*

2. **Alternative: Browser One-Click Authorization:**
   - With `start-agent.bat` running, open `https://127.0.0.1:8443` in a new browser tab.
   - Click **Advanced** &rarr; **Proceed to 127.0.0.1 (unsafe)**.
   - Return to your Vercel tab and click **Retry Connection**.

3. **Open the Deployed Vercel Website:**
   - Visit `https://network-flow-control-visualizer.vercel.app`.
   - The web app opens directly to the **Live UDP Network** tab and connects securely to `wss://127.0.0.1:8443`.
   - The status badge will display **Agent Online**.

> [!NOTE]
> Loopback WebSocket binding is strictly confined to `127.0.0.1`. The local agent's management interface is never exposed to the wider LAN or internet, and it automatically validates incoming client origins (`localhost`, `127.0.0.1`, and `*.vercel.app`) to prevent Cross-Site WebSocket Hijacking.

---

## 4. Feature Overview & Demonstration Workflow

### Two-Way Bidirectional Live Chat
- Located in the **Live UDP Network** tab under *Bidirectional Live Chat*.
- Type a message and press **Enter** (use **Shift+Enter** for multiline messages).
- Watch real-time delivery status progression:
  - ⏳ **Sending...**: Frame queued in sender protocol window.
  - 📡 **Transmitted on UDP [seq N]**: Packet placed on the network wire.
  - ✅ **Delivered & ACKed**: Verified receiver acknowledgement processed.
  - ⚠️ **Failed**: Triggers upon timeout retry exhaustion if link is disconnected.

### Received Files Dashboard & 1-Click Browser Download
- All files transferred over UDP are segmented into 768-byte chunks, verified with SHA-256 upon assembly, and stored safely in `./received_files/`.
- The **Received Files Dashboard** displays:
  - Filename & formatted size (KB/MB).
  - SHA-256 cryptographic checksum badge.
  - Received date & time.
  - **Download Button**: Streams the file data directly into your browser's default **Downloads folder** without needing to browse local disk directories.

