import crypto from 'crypto';

/**
 * Deterministically sorts object keys recursively for canonical serialization.
 * Ensures consistent hash generation regardless of key insertion order.
 */
export function canonicalJsonStringify(data: any): string {
  if (data === null || data === undefined) {
    return 'null';
  }
  if (typeof data !== 'object') {
    return JSON.stringify(data);
  }
  if (Array.isArray(data)) {
    return '[' + data.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }

  const keys = Object.keys(data).sort();
  const keyValues = keys
    .filter((k) => data[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(data[k])}`);

  return '{' + keyValues.join(',') + '}';
}

/**
 * Computes SHA-256 hash of canonical audit event payload linked to prevHash.
 */
export function computeAuditEventHash(
  prevHash: string,
  sequence: number,
  eventDataWithoutHash: Record<string, unknown>
): string {
  const canonicalPayload = canonicalJsonStringify(eventDataWithoutHash);
  const rawString = `${prevHash}|${sequence}|${canonicalPayload}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

/**
 * Computes SHA-256 hash of a binary buffer.
 */
export function computeBufferSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
