export * from './types/protocol.js';
export * from './utils/checksum.js';
export * from './utils/frame-codec.js';
export * from './protocols/stop-and-wait.js';
export * from './protocols/sliding-window.js';
export * from './protocols/go-back-n.js';
export * from './protocols/selective-repeat.js';

// Simulation Subsystem
export * from './simulation/simulation-config.js';
export * from './simulation/simulation-events.js';
export * from './simulation/simulation-stats.js';
export * from './simulation/virtual-channel.js';
export * from './simulation/protocol-adapters.js';
export * from './simulation/simulation-engine.js';

export function getAgentVersion(): string {
  return '0.1.0';
}
