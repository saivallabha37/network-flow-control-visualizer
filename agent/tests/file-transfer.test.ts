import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileTransferManager } from '../src/live/file-transfer.js';

describe('FileTransferManager', () => {
  let tempDir: string;
  let manager: FileTransferManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfcv-test-files-'));
    manager = new FileTransferManager(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('sanitizes unsafe filenames to prevent directory traversal', () => {
    expect(FileTransferManager.sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(FileTransferManager.sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
    expect(FileTransferManager.sanitizeFilename('foo/bar/test.txt')).toBe('test.txt');
    expect(FileTransferManager.sanitizeFilename('hello\0world.txt')).toBe('helloworld.txt');
  });

  it('computes correct sha256 checksum', () => {
    const data = Buffer.from('Antigravity Network Flow Control Visualizer', 'utf-8');
    const hash = FileTransferManager.computeSha256(data);
    expect(hash).toHaveLength(64);
  });

  it('chunks and reassembles small file with exact hash match', () => {
    const content = 'Line 1\nLine 2: The quick brown fox jumps over the lazy dog\n'.repeat(50);
    const sourceBuffer = Buffer.from(content, 'utf-8');

    const { header, chunkPayloads } = manager.prepareOutgoingFile('sample-notes.txt', sourceBuffer);

    expect(header.totalChunks).toBeGreaterThan(1);
    expect(chunkPayloads.length).toBe(header.totalChunks);

    // Register incoming transfer
    manager.handleIncomingHeader({
      ...header,
      sessionId: 'sess-test',
      version: '1.0',
      timestamp: Date.now(),
    });

    let completedResult;
    for (const chunk of chunkPayloads) {
      completedResult = manager.handleIncomingChunk(chunk);
    }

    expect(completedResult).toBeDefined();
    expect(completedResult?.completed).toBe(true);
    expect(completedResult?.sha256).toBe(header.sha256);
    expect(completedResult?.filePath).toBeDefined();

    // Verify file content on disk
    const savedContent = fs.readFileSync(completedResult!.filePath!, 'utf-8');
    expect(savedContent).toBe(content);
  });

  it('detects corrupted chunk and rejects assembly', () => {
    const sourceBuffer = Buffer.from('Important payload data', 'utf-8');
    const { header, chunkPayloads } = manager.prepareOutgoingFile('test.bin', sourceBuffer);

    manager.handleIncomingHeader({
      ...header,
      sessionId: 'sess-test',
      version: '1.0',
      timestamp: Date.now(),
    });

    // Corrupt the data in the chunk
    chunkPayloads[0].dataBase64 = Buffer.from('Corrupted payload data', 'utf-8').toString('base64');

    const result = manager.handleIncomingChunk(chunkPayloads[0]);
    expect(result.completed).toBe(false);
    expect(result.error).toContain('SHA-256 checksum mismatch');
  });

  it('auto-initializes transfer from self-describing chunk when FILE_HEADER is dropped', () => {
    const content = 'Data transfer without header packet notification'.repeat(20);
    const sourceBuffer = Buffer.from(content, 'utf-8');
    const { header, chunkPayloads } = manager.prepareOutgoingFile('unheaded.txt', sourceBuffer);

    // Intentionally DO NOT call manager.handleIncomingHeader(header)
    let completedResult;
    for (const chunk of chunkPayloads) {
      completedResult = manager.handleIncomingChunk(chunk);
    }

    expect(completedResult).toBeDefined();
    expect(completedResult?.completed).toBe(true);
    expect(completedResult?.sha256).toBe(header.sha256);
    expect(fs.readFileSync(completedResult!.filePath!, 'utf-8')).toBe(content);
  });

  it('handles out-of-order and duplicate chunks gracefully', () => {
    const content = 'ABCDEFGHIJ-'.repeat(200);
    const sourceBuffer = Buffer.from(content, 'utf-8');
    const { header, chunkPayloads } = manager.prepareOutgoingFile('shuffled.txt', sourceBuffer);

    expect(chunkPayloads.length).toBeGreaterThan(2);

    // Shuffle chunks and inject duplicates
    const shuffled = [...chunkPayloads].reverse();
    shuffled.splice(1, 0, chunkPayloads[0]); // Duplicate of chunk 0
    shuffled.push(chunkPayloads[1]); // Duplicate of chunk 1

    let completedResult;
    for (const chunk of shuffled) {
      const res = manager.handleIncomingChunk(chunk);
      if (res.completed) {
        completedResult = res;
      }
    }

    expect(completedResult).toBeDefined();
    expect(completedResult?.completed).toBe(true);
    expect(fs.readFileSync(completedResult!.filePath!, 'utf-8')).toBe(content);
  });

  it('protects against accidental file overwrite by appending unique suffix', () => {
    const content1 = 'Existing initial file on disk';
    const content2 = 'New file with identical name arriving over network';

    const existingPath = path.join(tempDir, 'conflict.txt');
    fs.writeFileSync(existingPath, content1, 'utf-8');

    const sourceBuffer = Buffer.from(content2, 'utf-8');
    const { chunkPayloads } = manager.prepareOutgoingFile('conflict.txt', sourceBuffer);

    let completedResult;
    for (const chunk of chunkPayloads) {
      completedResult = manager.handleIncomingChunk(chunk);
    }

    expect(completedResult?.completed).toBe(true);
    // The original file must remain untouched
    expect(fs.readFileSync(existingPath, 'utf-8')).toBe(content1);
    // The new file should have been written to a non-colliding path
    expect(completedResult?.filePath).not.toBe(existingPath);
    expect(fs.existsSync(completedResult!.filePath!)).toBe(true);
    expect(fs.readFileSync(completedResult!.filePath!, 'utf-8')).toBe(content2);
  });

  it('cleans up transfers when cancelAllTransfers is invoked', () => {
    const sourceBuffer = Buffer.from('Partial data', 'utf-8');
    const { chunkPayloads } = manager.prepareOutgoingFile('partial.txt', sourceBuffer);

    manager.handleIncomingChunk(chunkPayloads[0]);
    manager.cancelAllTransfers();

    // After cancel, internal transfer state is discarded
    expect(manager.getActiveIncomingTransfers()).toHaveLength(0);
  });

  it('lists verified completed files in storage directory ignoring temporary files', () => {
    // Write completed files
    fs.writeFileSync(path.join(tempDir, 'document.pdf'), 'PDF content payload');
    fs.writeFileSync(path.join(tempDir, 'notes.txt'), 'Plain text note');
    // Write temporary chunk file (should be ignored)
    fs.writeFileSync(path.join(tempDir, 'notes.txt.tmp_123'), 'Incomplete chunk data');
    // Write hidden file (should be ignored)
    fs.writeFileSync(path.join(tempDir, '.hidden_meta'), 'Secret data');

    const completed = manager.getCompletedFiles();
    expect(completed).toHaveLength(2);
    const filenames = completed.map((f) => f.filename);
    expect(filenames).toContain('document.pdf');
    expect(filenames).toContain('notes.txt');
    expect(filenames).not.toContain('notes.txt.tmp_123');
    expect(filenames).not.toContain('.hidden_meta');

    const pdfInfo = completed.find((f) => f.filename === 'document.pdf');
    expect(pdfInfo?.sha256).toBe(FileTransferManager.computeSha256(Buffer.from('PDF content payload')));
    expect(pdfInfo?.fileSize).toBe(Buffer.from('PDF content payload').length);
  });

  it('safely reads completed file with correct MIME type and prevents path traversal', () => {
    const rawContent = 'Hello Antigravity visualizer';
    fs.writeFileSync(path.join(tempDir, 'hello.txt'), rawContent);

    const result = manager.readCompletedFile('hello.txt');
    expect(result.filename).toBe('hello.txt');
    expect(result.mimeType).toBe('text/plain');
    expect(Buffer.from(result.dataBase64, 'base64').toString('utf-8')).toBe(rawContent);
    expect(result.sha256).toBe(FileTransferManager.computeSha256(Buffer.from(rawContent)));

    // Rejection of directory traversal
    expect(() => manager.readCompletedFile('../../outside.txt')).toThrow();
    // Rejection of non-existent file
    expect(() => manager.readCompletedFile('non_existent.txt')).toThrow('File not found');
  });
});

