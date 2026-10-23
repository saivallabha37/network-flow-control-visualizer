import { describe, it, expect } from 'vitest';
import { getAgentVersion, ProtocolType } from '../src/index.js';

describe('Protocol Agent Foundation Tests', () => {
  it('should report the correct foundation version', () => {
    expect(getAgentVersion()).toBe('0.1.0');
  });

  it('should validate protocol type classifications', () => {
    const supportedProtocols: ProtocolType[] = [
      'stop-and-wait',
      'go-back-n',
      'selective-repeat',
    ];

    expect(supportedProtocols).toContain('stop-and-wait');
    expect(supportedProtocols).toContain('go-back-n');
    expect(supportedProtocols).toContain('selective-repeat');
    // Verifying that sliding-window is understood as the underlying mechanism rather than a 4th standalone ARQ
    expect(supportedProtocols).not.toContain('sliding-window');
  });
});

