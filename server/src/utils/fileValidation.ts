import path from 'path';

export const MAX_FILE_SIZE_BYTES = 1_000_000; // 1,000,000 bytes strict limit

export interface ValidatedFileResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename: string;
  detectedMimeType: string;
}

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt']);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.js', '.mjs', '.cjs',
  '.ts', '.py', '.rb', '.pl', '.html', '.htm', '.xhtml', '.svg', '.jar', '.war',
  '.vbs', '.ps1', '.dll', '.so', '.dylib', '.com', '.scr', '.msi', '.jsp', '.asp', '.aspx'
]);

/**
 * Validates file buffer magic bytes/signatures against allowed types.
 */
export function detectMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length === 0) return null;

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG: \x89PNG\r\n\x1a\n (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // JPEG: \xFF\xD8\xFF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return 'image/jpeg';
  }

  // Plain text (UTF-8 / ASCII) validation:
  // Must not contain null bytes or illegal control characters
  let isText = true;
  const sampleLength = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleLength; i++) {
    const byte = buffer[i];
    // Reject null byte or control characters except \t (9), \n (10), \r (13)
    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      isText = false;
      break;
    }
  }

  if (isText) {
    return 'text/plain';
  }

  return null;
}

/**
 * Sanitizes filename to prevent directory traversal and invalid characters.
 */
export function sanitizeFilename(rawName: string): string {
  // Strip path separators
  let cleaned = path.basename(rawName).trim();
  // Remove control characters and non-printable characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  // Replace dangerous filesystem characters
  cleaned = cleaned.replace(/[<>:"/\\|?*]/g, '_');
  // Collapse multiple spaces/underscores
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Prevent leading dots (hidden files)
  cleaned = cleaned.replace(/^\.+/, '');
  // Cap length to 100 characters
  if (cleaned.length > 100) {
    const ext = path.extname(cleaned);
    const base = path.basename(cleaned, ext).slice(0, 100 - ext.length);
    cleaned = `${base}${ext}`;
  }
  return cleaned || 'unnamed_file';
}

/**
 * Comprehensive file upload validation.
 */
export function validateUploadedFile(
  buffer: Buffer,
  originalFilename: string,
  clientMimeType?: string
): ValidatedFileResult {
  // 1. Check size limit
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      error: 'Empty upload: File buffer has 0 bytes.',
      sanitizedFilename: '',
      detectedMimeType: ''
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size ${buffer.length} bytes exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES} bytes.`,
      sanitizedFilename: '',
      detectedMimeType: ''
    };
  }

  // 2. Validate filename and extension
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized).toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Dangerous or unsupported file extension: ${ext}`,
      sanitizedFilename: sanitized,
      detectedMimeType: ''
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Extension ${ext} is not allowed. Allowed types: PDF, PNG, JPG, JPEG, TXT.`,
      sanitizedFilename: sanitized,
      detectedMimeType: ''
    };
  }

  // 3. Inspect magic bytes signature (never trust client header)
  const detectedMime = detectMagicBytes(buffer);
  if (!detectedMime) {
    return {
      isValid: false,
      error: 'Invalid file signature: Content does not match supported safe formats (PDF, PNG, JPEG, TXT).',
      sanitizedFilename: sanitized,
      detectedMimeType: ''
    };
  }

  // 4. Verify extension matches detected signature (MIME spoofing check)
  if (detectedMime === 'application/pdf' && ext !== '.pdf') {
    return {
      isValid: false,
      error: `MIME spoofing detected: PDF content uploaded with non-pdf extension ${ext}`,
      sanitizedFilename: sanitized,
      detectedMimeType: detectedMime
    };
  }

  if (detectedMime === 'image/png' && ext !== '.png') {
    return {
      isValid: false,
      error: `MIME spoofing detected: PNG content uploaded with non-png extension ${ext}`,
      sanitizedFilename: sanitized,
      detectedMimeType: detectedMime
    };
  }

  if (detectedMime === 'image/jpeg' && ext !== '.jpg' && ext !== '.jpeg') {
    return {
      isValid: false,
      error: `MIME spoofing detected: JPEG content uploaded with non-jpeg extension ${ext}`,
      sanitizedFilename: sanitized,
      detectedMimeType: detectedMime
    };
  }

  if (detectedMime === 'text/plain' && ext !== '.txt') {
    return {
      isValid: false,
      error: `MIME spoofing detected: TXT content uploaded with non-txt extension ${ext}`,
      sanitizedFilename: sanitized,
      detectedMimeType: detectedMime
    };
  }

  return {
    isValid: true,
    sanitizedFilename: sanitized,
    detectedMimeType: detectedMime
  };
}
