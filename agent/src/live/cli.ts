import { NetworkingAgent } from './networking-agent.js';

function parseArgs(): { udpPort: number; wsPort: number; udpHost: string; wsHost: string } {
  const args = process.argv.slice(2);
  let udpPort = 9000;
  let wsPort = 8080;
  let udpHost = '0.0.0.0';
  const wsHost = '127.0.0.1';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--udp' || arg === '-u') && i + 1 < args.length) {
      udpPort = parseInt(args[++i], 10);
      if (isNaN(udpPort) || udpPort < 1 || udpPort > 65535) {
        console.error(`Invalid UDP port: ${args[i]}. Must be between 1 and 65535.`);
        process.exit(1);
      }
    } else if ((arg === '--ws' || arg === '-w') && i + 1 < args.length) {
      wsPort = parseInt(args[++i], 10);
      if (isNaN(wsPort) || wsPort < 1 || wsPort > 65535) {
        console.error(`Invalid WebSocket port: ${args[i]}. Must be between 1 and 65535.`);
        process.exit(1);
      }
    } else if (arg === '--host' && i + 1 < args.length) {
      udpHost = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Network Flow Control Visualizer — Live Networking Agent
Usage:
  tsx src/live/cli.ts [options]

Options:
  --udp, -u <port>   UDP port to listen for peer datagrams (default: 9000)
  --ws,  -w <port>   WebSocket port for local browser connection (default: 8080)
  --host <ip>        UDP bind address (default: 0.0.0.0)
  --help, -h         Show this help message
      `);
      process.exit(0);
    }
  }

  return { udpPort, wsPort, udpHost, wsHost };
}

async function main() {
  const { udpPort, wsPort, udpHost, wsHost } = parseArgs();

  console.log('='.repeat(60));
  console.log('  Network Flow Control Protocols Visualizer — Live Agent');
  console.log('='.repeat(60));
  console.log(`Local UDP bind:       ${udpHost}:${udpPort}`);
  console.log(`Browser WebSocket:    ws://${wsHost}:${wsPort}`);
  console.log('Security safeguard:   WS server binds strictly to loopback 127.0.0.1');
  console.log('File staging:         received_files/');
  console.log('='.repeat(60));

  const agent = new NetworkingAgent({
    udpPort,
    udpHost,
    wsPort,
    wsHost,
  });

  try {
    await agent.start();
    console.log('Agent is ready. Connect your browser visualizer to proceed.');
  } catch (err) {
    console.error('Failed to start Networking Agent:', err);
    process.exit(1);
  }

  const shutdown = async () => {
    console.log('\nShutting down agent gracefully...');
    await agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run when executed
main();
