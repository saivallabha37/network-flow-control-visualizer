/**
 * Checksum utility for data integrity verification in protocol frames.
 *
 * Implementation: CRC-32 (IEEE 802.3 standard polynomial: 0xEDB88320).
 *
 * IMPORTANT NOTE ON INTEGRITY ASSURANCE:
 * CRC-32 is a non-cryptographic cyclic redundancy check designed specifically
 * to detect accidental bit flips, burst transmission errors, and truncation in
 * network frames (such as Ethernet frames). It is NOT cryptographically secure
 * and does not protect against deliberate malicious tampering.
 */

// Precomputed CRC-32 lookup table for performance
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Computes an unsigned 32-bit CRC-32 checksum of an input string.
 *
 * @param input The raw string to verify
 * @returns 32-bit unsigned integer checksum
 */
export function calculateCRC32(input: string): number {
  let crc = 0xffffffff;
  const len = input.length;

  const encoder = new TextEncoder();
  for (let i = 0; i < len; i++) {
    const code = input.charCodeAt(i);
    // Fast path for ASCII
    if (code < 128) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ code) & 0xff];
    } else {
      const bytes = encoder.encode(input[i]);
      for (let b = 0; b < bytes.length; b++) {
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[b]) & 0xff];
      }
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Validates whether the calculated checksum of input matches the expected checksum.
 *
 * @param input The raw string
 * @param expectedChecksum The checksum to compare against
 * @returns true if checksums match, false otherwise
 */
export function verifyChecksum(input: string, expectedChecksum: number): boolean {
  if (typeof expectedChecksum !== 'number' || !Number.isInteger(expectedChecksum)) {
    return false;
  }
  const calculated = calculateCRC32(input);
  return calculated === (expectedChecksum >>> 0);
}

