# Windows Background Agent & Vercel Deployment Setup Guide

This guide explains how to run the Network Flow Control Protocols Visualizer's live networking agent independently on Windows (without keeping VS Code or a command prompt open) and how to connect the live agent to the project deployed on **Vercel** (`https://<your-project>.vercel.app`).

---

## 1. Running the Agent Without Opening VS Code / CLI

The repository includes pre-configured Windows batch and VBScript automation runners in the root directory and under `scripts/windows/`.

### Option A: 1-Click Visible Console Runner
- Simply double-click **`start-agent.bat`** in the project root.
- A terminal window will open, listen for incoming peer UDP datagrams on port `9000`, and establish the local loopback WebSocket server on `127.0.0.1:8080`.
- To stop the agent, press `Ctrl+C` or close the window.

### Option B: Silent Background Execution (Hidden Window)
- Double-click **`scripts/windows/start-agent-background.vbs`**.
- The Networking Agent runs completely invisibly in the background with no pop-up command prompt.
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

## 3. Connecting Vercel HTTPS Deployment to Local Networking Agent

When you access the visualizer via its deployed Vercel URL (e.g., `https://network-flow-control-visualizer.vercel.app`), the web page is served over **HTTPS**, while your local networking agent listens on loopback (`ws://127.0.0.1:8080`).

Modern web browsers enforce Mixed Content security restrictions. Here is how to connect seamlessly:

### Step 1: Ensure Local Agent is Running
Start the agent on your laptop using `start-agent.bat` or `npm run agent:live`.

### Step 2: Allow Loopback / Insecure Content in Browser
When accessing the HTTPS site on Chrome or Edge:
1. Click the **Site Information / Tune icon** to the left of the URL bar (next to `https://...`).
2. Select **Site settings**.
3. Scroll down to **Insecure content**.
4. Change the dropdown from *Block (default)* to **Allow**.
5. Return to the visualizer tab and refresh the page (`F5` or `Ctrl+R`).
6. The top status bar will immediately display **Agent Online**.

> [!NOTE]
> Loopback WebSocket binding is strictly confined to `127.0.0.1`. The local agent's management interface is never exposed to the wider LAN or internet, ensuring robust host security.

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

