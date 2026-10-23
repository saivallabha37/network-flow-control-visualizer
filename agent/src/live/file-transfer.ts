import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileHeaderPacket } from './live-types.js';

export const CHUNK_SIZE = 768; // 768 bytes raw = ~1024 base64 chars -> datagram ~1.2 KB, fits safely within 1472 MTU payload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB maximum safeguard
export const MAX_CONCURRENT_TRANSFERS = 20;
export const STALE_TRANSFER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface FileChunkPayload {
  kind: 'FILE_CHUNK';
  transferId: string;
  filename: string;
  fileSize: number;
  sha256: string;
  chunkIndex: number;
  totalChunks: number;
  dataBase64: string;
}

export interface ActiveIncomingTransfer {
  transferId: string;
  sanitizedFilename: string;
  fileSize: number;
  totalChunks: number;
  sha256: string;
  receivedChunks: Map<number, Buffer>;
  tempPath: string;
  targetPath: string;
  startTime: number;
  lastActivity: number;
}

export class FileTransferManager {
  private readonly storageDir: string;
  private readonly incomingTransfers = new Map<string, ActiveIncomingTransfer>();

  constructor(storageDir?: string) {
    this.storageDir = storageDir ?? path.resolve(process.cwd(), 'received_files');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Sanitizes a filename to protect against directory traversal, relative paths,
   * null bytes, backslashes, and non-printable characters across all operating systems.
   */
  public static sanitizeFilename(rawFilename: string): string {
    const normalized = rawFilename.replace(/\\/g, '/');
    const base = path.basename(normalized);
    const cleaned = base
      .replace(/[\0\r\n\t]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, ''); // Remove leading dots

    return cleaned || `received_file_${Date.now()}`;
  }

  /**
   * Calculates the SHA-256 hex digest of a buffer.
   */
  public static computeSha256(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Clean up stale transfers that exceeded timeout or limit.
   */
  public cleanupStaleTransfers(): void {
    const now = Date.now();
    for (const [id, transfer] of this.incomingTransfers.entries()) {
      if (now - transfer.lastActivity > STALE_TRANSFER_TIMEOUT_MS) {
        this.cancelTransfer(id);
      }
    }
  }

  /**
   * Prepares an outgoing file for transmission: slices buffer into safe chunks.
   */
  public prepareOutgoingFile(
    filename: string,
    buffer: Buffer
  ): {
    header: Omit<FileHeaderPacket, 'sessionId' | 'version' | 'timestamp'>;
    chunkPayloads: FileChunkPayload[];
  } {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${buffer.length} exceeds maximum limit of ${MAX_FILE_SIZE} bytes`);
    }

    const sanitized = FileTransferManager.sanitizeFilename(filename);
    const sha256 = FileTransferManager.computeSha256(buffer);
    const totalChunks = Math.max(1, Math.ceil(buffer.length / CHUNK_SIZE));
    const transferId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const chunkPayloads: FileChunkPayload[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, buffer.length);
      const chunkBuf = buffer.subarray(start, end);
      chunkPayloads.push({
        kind: 'FILE_CHUNK',
        transferId,
        filename: sanitized,
        fileSize: buffer.length,
        sha256,
        chunkIndex: i,
        totalChunks,
        dataBase64: chunkBuf.toString('base64'),
      });
    }

    return {
      header: {
        type: 'FILE_HEADER',
        transferId,
        filename: sanitized,
        fileSize: buffer.length,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        sha256,
      },
      chunkPayloads,
    };
  }

  /**
   * Registers an incoming file header and creates a safe temporary workspace.
   */
  public handleIncomingHeader(header: FileHeaderPacket): void {
    this.cleanupStaleTransfers();

    if (this.incomingTransfers.has(header.transferId)) {
      // Already registered (e.g. duplicate header or initialized by chunk)
      return;
    }

    if (this.incomingTransfers.size >= MAX_CONCURRENT_TRANSFERS) {
      throw new Error(`Cannot accept file: maximum concurrent transfers limit (${MAX_CONCURRENT_TRANSFERS}) reached`);
    }

    if (header.fileSize > MAX_FILE_SIZE) {
      throw new Error(`Rejected incoming file: size (${header.fileSize} B) exceeds maximum limit (${MAX_FILE_SIZE} B)`);
    }

    const sanitized = FileTransferManager.sanitizeFilename(header.filename);
    let targetPath = path.join(this.storageDir, sanitized);

    // If file already exists, avoid overwriting by suffixing timestamp
    if (fs.existsSync(targetPath)) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      targetPath = path.join(this.storageDir, `${name}_${Date.now()}${ext}`);
    }

    const tempPath = `${targetPath}.tmp_${header.transferId}`;

    this.incomingTransfers.set(header.transferId, {
      transferId: header.transferId,
      sanitizedFilename: sanitized,
      fileSize: header.fileSize,
      totalChunks: header.totalChunks,
      sha256: header.sha256,
      receivedChunks: new Map(),
      tempPath,
      targetPath,
      startTime: Date.now(),
      lastActivity: Date.now(),
    });
  }

  /**
   * Handles an incoming chunk payload.
   * Auto-initializes transfer if header was dropped or arrived out of order.
   * If all chunks are present, verifies SHA-256 and finalizes the file safely.
   */
  public handleIncomingChunk(payload: FileChunkPayload): {
    completed: boolean;
    progressPercent: number;
    filename: string;
    filePath?: string;
    sha256?: string;
    error?: string;
  } {
    let transfer = this.incomingTransfers.get(payload.transferId);

    // If header packet was dropped on the network, auto-initialize from self-describing chunk metadata
    if (!transfer) {
      if (payload.filename && payload.fileSize !== undefined && payload.sha256) {
        this.handleIncomingHeader({
          type: 'FILE_HEADER',
          sessionId: 'auto',
          version: '1.0',
          timestamp: Date.now(),
          transferId: payload.transferId,
          filename: payload.filename,
          fileSize: payload.fileSize,
          totalChunks: payload.totalChunks,
          chunkSize: CHUNK_SIZE,
          sha256: payload.sha256,
        });
        transfer = this.incomingTransfers.get(payload.transferId);
      }
    }

    if (!transfer) {
      return {
        completed: false,
        progressPercent: 0,
        filename: payload.filename || 'unknown',
        error: `Unknown or uninitialized file transfer ID: ${payload.transferId}`,
      };
    }

    transfer.lastActivity = Date.now();
    const chunkBuf = Buffer.from(payload.dataBase64, 'base64');
    // Map.set inherently handles duplicate chunks idempotently
    transfer.receivedChunks.set(payload.chunkIndex, chunkBuf);

    const receivedCount = transfer.receivedChunks.size;
    const progressPercent = Math.min(100, Math.round((receivedCount / transfer.totalChunks) * 100));

    if (receivedCount < transfer.totalChunks) {
      return {
        completed: false,
        progressPercent,
        filename: transfer.sanitizedFilename,
      };
    }

    // All chunks received! Assemble and verify
    try {
      const orderedBuffers: Buffer[] = [];
      for (let i = 0; i < transfer.totalChunks; i++) {
        const buf = transfer.receivedChunks.get(i);
        if (!buf) {
          throw new Error(`Missing chunk index ${i} during file assembly`);
        }
        orderedBuffers.push(buf);
      }

      const fullBuffer = Buffer.concat(orderedBuffers);
      const computedSha256 = FileTransferManager.computeSha256(fullBuffer);

      if (computedSha256.toLowerCase() !== transfer.sha256.toLowerCase()) {
        throw new Error(
          `SHA-256 checksum mismatch! Expected ${transfer.sha256}, calculated ${computedSha256}. Possible corruption.`
        );
      }

      // Re-verify that targetPath does not overwrite any file created in the interim
      let finalTarget = transfer.targetPath;
      if (fs.existsSync(finalTarget)) {
        const ext = path.extname(transfer.sanitizedFilename);
        const name = path.basename(transfer.sanitizedFilename, ext);
        finalTarget = path.join(
          this.storageDir,
          `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`
        );
      }

      // Write verified buffer to disk
      fs.writeFileSync(finalTarget, fullBuffer);

      // Clean up transfer state
      this.incomingTransfers.delete(payload.transferId);

      return {
        completed: true,
        progressPercent: 100,
        filename: transfer.sanitizedFilename,
        filePath: finalTarget,
        sha256: computedSha256,
      };
    } catch (err) {
      // Clean up partial state on failure
      this.incomingTransfers.delete(payload.transferId);
      if (fs.existsSync(transfer.tempPath)) {
        try {
          fs.unlinkSync(transfer.tempPath);
        } catch {
          // ignore
        }
      }

      return {
        completed: false,
        progressPercent,
        filename: transfer.sanitizedFilename,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public cancelTransfer(transferId: string): void {
    const transfer = this.incomingTransfers.get(transferId);
    if (transfer) {
      this.incomingTransfers.delete(transferId);
      if (fs.existsSync(transfer.tempPath)) {
        try {
          fs.unlinkSync(transfer.tempPath);
        } catch {
          // ignore
        }
      }
    }
  }

  public cancelAllTransfers(): void {
    for (const transferId of Array.from(this.incomingTransfers.keys())) {
      this.cancelTransfer(transferId);
    }
  }

  public getActiveIncomingTransfers(): ActiveIncomingTransfer[] {
    return Array.from(this.incomingTransfers.values());
  }
}
