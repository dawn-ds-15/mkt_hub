import * as path from 'path';

/**
 * Rules shared by every "hồ sơ đính kèm" upload (inventory batches, expense lines):
 * PDF, images, Excel or Word, at most 10MB per file.
 */

/** Max size of one attachment (~10MB per file). */
export const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Max number of files accepted in one upload request. */
export const ATTACHMENT_MAX_FILES = 20;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.heic',
  '.heif',
  '.xls',
  '.xlsx',
  '.csv',
  '.doc',
  '.docx',
]);

/**
 * Multer delivers multipart filenames as latin1. Re-decode as UTF-8 (same as project documents)
 * so Vietnamese names survive, but only when the value really looks like mis-decoded UTF-8 bytes.
 */
export function decodeUploadFilename(
  originalName: string | undefined | null,
): string {
  const name = originalName || 'file';
  // Characters above U+00FF mean the name was already decoded correctly
  if (/[^\u0000-ÿ]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
  } catch {
    return name;
  }
}

export function isAllowedAttachment(file: {
  originalname?: string;
  mimetype?: string;
}): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path
    .extname(decodeUploadFilename(file.originalname))
    .toLowerCase();
  if (ALLOWED_MIME_TYPES.has(mime)) return true;
  // Some browsers send Office files as octet-stream / zip; fall back to the extension
  return (
    ALLOWED_EXTENSIONS.has(ext) &&
    !mime.startsWith('text/html') &&
    mime !== 'image/svg+xml'
  );
}

/** Unique storage file name keeping a sanitized version of the original name. */
export function buildStoredFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const sanitizedBaseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${Date.now()}_${randomSuffix}_${sanitizedBaseName}${ext.replace(/[^a-zA-Z0-9.]/g, '')}`;
}

/** Multer options for a multi-file "files" upload that follows the rules above. */
export const attachmentUploadOptions = (
  makeError: (message: string) => Error,
) => ({
  limits: { fileSize: ATTACHMENT_MAX_FILE_SIZE },
  fileFilter: (
    _req: any,
    file: any,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!isAllowedAttachment(file)) {
      return callback(
        makeError(
          `File "${decodeUploadFilename(file.originalname)}" không đúng định dạng. Chỉ nhận PDF, ảnh, Excel hoặc Word.`,
        ),
        false,
      );
    }
    callback(null, true);
  },
});
