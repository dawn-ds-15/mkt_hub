import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stores uploaded files (project documents, expense line attachments, inventory batch attachments).
 *
 * - With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set, files go to a PRIVATE Supabase Storage bucket
 *   (SUPABASE_STORAGE_BUCKET, default "mkt-hub-files"), so they survive Render redeploys.
 *   The stored path looks like `supabase://<bucket>/<folder>/<file>`.
 * - Otherwise files are written to the local `uploads/<folder>/` directory as before
 *   (stored path `uploads/<folder>/<file>`).
 *
 * Reading supports both kinds, so files uploaded before the switch keep working.
 */

const REMOTE_PREFIX = 'supabase://';

export interface ReadableStoredFile {
  /** set for local files: absolute path to stream with res.sendFile */
  localPath?: string;
  /** set for remote files */
  buffer?: Buffer;
}

class FileStorage {
  private readonly logger = new Logger('FileStorage');
  private bucketReady: Promise<void> | null = null;

  private get config() {
    const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'mkt-hub-files';
    return { url, key, bucket, enabled: Boolean(url && key) };
  }

  isRemoteEnabled(): boolean {
    return this.config.enabled;
  }

  /** "supabase" (persistent) or "local" (uploads/ folder, wiped on every Render deploy). */
  getMode(): 'supabase' | 'local' {
    return this.config.enabled ? 'supabase' : 'local';
  }

  /**
   * Logs where uploads go. On Render (env RENDER is set by the platform) the local disk is
   * ephemeral, so local mode there means every uploaded file is lost at the next deploy.
   */
  logMode(): void {
    if (this.config.enabled) {
      this.logger.log(`Uploads are stored in Supabase Storage bucket "${this.config.bucket}"`);
    } else if (process.env.RENDER) {
      this.logger.error(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set: uploads are written to the local ' +
          'uploads/ folder, which Render wipes on every deploy. Set both variables to keep files.',
      );
    } else {
      this.logger.warn('Uploads are stored in the local uploads/ folder');
    }
  }

  isRemotePath(storedPath?: string | null): boolean {
    return !!storedPath && storedPath.startsWith(REMOTE_PREFIX);
  }

  private headers(extra: Record<string, string> = {}) {
    const { key } = this.config;
    return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
  }

  private objectUrl(bucket: string, objectKey: string) {
    const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
    return `${this.config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedKey}`;
  }

  private parseRemote(storedPath: string): { bucket: string; objectKey: string } {
    const rest = storedPath.slice(REMOTE_PREFIX.length);
    const slash = rest.indexOf('/');
    return { bucket: rest.slice(0, slash), objectKey: rest.slice(slash + 1) };
  }

  /** Creates the private bucket once per process if it does not exist yet. */
  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      const { url, bucket } = this.config;
      this.bucketReady = (async () => {
        const res = await fetch(`${url}/storage/v1/bucket`, {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: bucket, name: bucket, public: false }),
        });
        if (!res.ok) {
          const text = await res.text();
          // 400/409 "already exists" is fine
          if (!/exist/i.test(text)) {
            throw new Error(`Supabase Storage: cannot create bucket "${bucket}" (${res.status}): ${text}`);
          }
        }
      })().catch((err) => {
        this.bucketReady = null;
        throw err;
      });
    }
    return this.bucketReady;
  }

  /**
   * Saves a file and returns the path to store in the database.
   * `folder` is e.g. "documents", "expenses", "inventory-batches"; `fileName` must be unique.
   */
  async save(
    folder: string,
    fileName: string,
    content: Buffer,
    mimeType?: string | null,
  ): Promise<string> {
    const { enabled, bucket } = this.config;
    if (!enabled) {
      const dir = path.join(process.cwd(), 'uploads', folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, fileName), content);
      return `uploads/${folder}/${fileName}`;
    }

    await this.ensureBucket();
    const objectKey = `${folder}/${fileName}`;
    const res = await fetch(this.objectUrl(bucket, objectKey), {
      method: 'POST',
      headers: this.headers({
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'false',
      }),
      body: new Uint8Array(content),
    });
    if (!res.ok) {
      throw new Error(`Supabase Storage upload failed (${res.status}): ${await res.text()}`);
    }
    return `${REMOTE_PREFIX}${bucket}/${objectKey}`;
  }

  /** Returns the file content/location, or null when it does not exist. */
  async read(storedPath?: string | null): Promise<ReadableStoredFile | null> {
    if (!storedPath) return null;
    if (!this.isRemotePath(storedPath)) {
      const fullPath = path.isAbsolute(storedPath)
        ? storedPath
        : path.join(process.cwd(), storedPath);
      return fs.existsSync(fullPath) ? { localPath: fullPath } : null;
    }
    if (!this.config.enabled) {
      this.logger.error(`Cannot read ${storedPath}: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set`);
      return null;
    }
    const { bucket, objectKey } = this.parseRemote(storedPath);
    const res = await fetch(this.objectUrl(bucket, objectKey), {
      headers: this.headers(),
    });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Supabase Storage download failed (${res.status}): ${await res.text()}`);
    }
    return { buffer: Buffer.from(await res.arrayBuffer()) };
  }

  /** Best-effort removal (used to clean up after a failed DB write). */
  async remove(storedPath?: string | null): Promise<void> {
    if (!storedPath) return;
    try {
      if (!this.isRemotePath(storedPath)) {
        const fullPath = path.isAbsolute(storedPath)
          ? storedPath
          : path.join(process.cwd(), storedPath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        return;
      }
      if (!this.config.enabled) return;
      const { bucket, objectKey } = this.parseRemote(storedPath);
      await fetch(`${this.config.url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
        method: 'DELETE',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prefixes: [objectKey] }),
      });
    } catch (err) {
      this.logger.warn(`Could not remove ${storedPath}: ${err}`);
    }
  }
}

export const fileStorage = new FileStorage();

/** Content of a multer file whether it was kept in memory or written to a temp path. */
export function readUploadedFile(file: { buffer?: Buffer; path?: string }): Buffer {
  if (file.buffer) return file.buffer;
  if (file.path) return fs.readFileSync(file.path);
  return Buffer.alloc(0);
}

/**
 * `Content-Disposition: inline` with an ASCII fallback name plus the RFC 5987 UTF-8 name,
 * so browsers save "Hóa đơn.pdf" instead of "H%C3%B3a%20%C4%91%C6%A1n.pdf".
 */
export function inlineContentDisposition(fileName: string): string {
  const name = fileName || 'attachment';
  const asciiFallback = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: "Hóa đơn" -> "Hoa đon"
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** Sends a stored file: streams local files, writes remote content from memory. */
export function sendStoredFile(
  res: { sendFile: (p: string) => any; setHeader: (k: string, v: any) => any; end: (b: Buffer) => any },
  file: ReadableStoredFile,
) {
  if (file.localPath) return res.sendFile(file.localPath);
  const buffer = file.buffer ?? Buffer.alloc(0);
  res.setHeader('Content-Length', buffer.length);
  return res.end(buffer);
}
