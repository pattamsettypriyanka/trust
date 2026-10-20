import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetInMemoryDb, getFirestoreDb } from '../db/firestore.js';
import { AuditService } from '../services/audit.service.js';

// Setup test app
const app = createApp();

// Sample valid buffers
const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89]);
const validTxtBuffer = Buffer.from('Confidential board meeting minutes and compliance review notes.');
const oversizedBuffer = Buffer.alloc(1_000_001, 'A'); // 1,000,001 bytes > 1MB limit

describe('TrustVault Security Verification Test Suite', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  // =========================================================================
  // Section A: Authentication Middleware & Identity Verification
  // =========================================================================
  describe('A. Authentication & Identity Verification', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(401);
      expect(res.body.type).toContain('unauthorized');
    });

    it('rejects malformed authorization header with HTTP 401', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', 'Basic invalid_creds');
      expect(res.status).toBe(401);
    });

    it('ignores client-supplied actor ID or role in headers or request body', async () => {
      // User connects with dev_viewer token but tries to supply admin headers and body
      const res = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer dev_viewer')
        .set('x-user-id', 'hacked_admin_id')
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('user_viewer_001');
      expect(res.body.user.role).toBe('VIEWER'); // Role cannot be spoofed
    });

    it('prevents regular users from elevating their role via profile mutation', async () => {
      // Non-admin attempting to access admin role endpoint
      const res = await request(app)
        .patch('/api/admin/users/user_viewer_001/role')
        .set('Authorization', 'Bearer dev_viewer')
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // Section B & C: Cross-User Isolation, IDOR Protection & Permission Model
  // =========================================================================
  describe('B & C. Cross-User Isolation & Document Permissions', () => {
    let ownerDocId: string;

    beforeEach(async () => {
      // Seed user profiles
      const db = getFirestoreDb();
      await db.collection('users').doc('user_owner_001').set({
        id: 'user_owner_001',
        email: 'owner@trustvault.local',
        displayName: 'Document Owner',
        role: 'OWNER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.collection('users').doc('user_viewer_001').set({
        id: 'user_viewer_001',
        email: 'viewer@trustvault.local',
        displayName: 'Authorized Viewer',
        role: 'VIEWER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.collection('users').doc('user_outsider_001').set({
        id: 'user_outsider_001',
        email: 'outsider@trustvault.local',
        displayName: 'Unrelated User',
        role: 'VIEWER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Upload document as OWNER
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Q3 Financial Audit')
        .field('category', 'FINANCIAL')
        .attach('file', validPdfBuffer, 'q3_audit.pdf');

      expect(uploadRes.status).toBe(201);
      ownerDocId = uploadRes.body.document.id;
    });

    it('allows document owner to retrieve metadata and download file bytes', async () => {
      const metaRes = await request(app)
        .get(`/api/documents/${ownerDocId}`)
        .set('Authorization', 'Bearer dev_owner');
      expect(metaRes.status).toBe(200);
      expect(metaRes.body.document.title).toBe('Q3 Financial Audit');

      const dlRes = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_owner');
      expect(dlRes.status).toBe(200);
      expect(dlRes.header['content-type']).toBe('application/pdf');
      expect(dlRes.header['x-content-type-options']).toBe('nosniff');
      expect(dlRes.header['content-disposition']).toContain('attachment');
      expect(dlRes.body.toString()).toContain('%PDF');
    });

    it('prevents ungranted outsider from retrieving metadata (returns 404 to avoid enumeration)', async () => {
      const res = await request(app)
        .get(`/api/documents/${ownerDocId}`)
        .set('Authorization', 'Bearer dev_outsider');

      // Returns 404 rather than 403 to prevent document existence discovery
      expect(res.status).toBe(404);
      expect(res.body.document).toBeUndefined();
    });

    it('prevents ungranted outsider from downloading file bytes', async () => {
      const res = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_outsider');

      expect(res.status).toBe(404);
      expect(res.header['content-type']).not.toBe('application/pdf');
    });

    it('prevents ungranted outsider from editing document metadata', async () => {
      const res = await request(app)
        .patch(`/api/documents/${ownerDocId}`)
        .set('Authorization', 'Bearer dev_outsider')
        .send({ title: 'Tampered Title' });

      expect(res.status).toBe(403);
    });

    it('prevents ungranted outsider from deleting document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${ownerDocId}`)
        .set('Authorization', 'Bearer dev_outsider');

      expect(res.status).toBe(403);
    });

    it('does NOT allow administrator to read or download confidential document without explicit grant', async () => {
      // ADMIN user tries to download confidential document
      const res = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_admin');

      // Admin does NOT bypass document-level authorization
      expect(res.status).toBe(404);
    });

    it('allows owner to grant READ access to viewer, enabling download but not editing', async () => {
      // 1. Grant READ permission
      const grantRes = await request(app)
        .post(`/api/documents/${ownerDocId}/grants`)
        .set('Authorization', 'Bearer dev_owner')
        .send({ targetUserId: 'user_viewer_001', permission: 'READ' });

      expect(grantRes.status).toBe(201);

      // 2. Viewer can now read metadata
      const metaRes = await request(app)
        .get(`/api/documents/${ownerDocId}`)
        .set('Authorization', 'Bearer dev_viewer');
      expect(metaRes.status).toBe(200);

      // 3. Viewer can download bytes
      const dlRes = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_viewer');
      expect(dlRes.status).toBe(200);
      expect(dlRes.body.toString()).toContain('%PDF');

      // 4. Viewer cannot edit content (READ does not permit EDIT)
      const editRes = await request(app)
        .put(`/api/documents/${ownerDocId}/content`)
        .set('Authorization', 'Bearer dev_viewer')
        .attach('file', validPdfBuffer, 'replacement.pdf');
      expect(editRes.status).toBe(403);

      // 5. Viewer cannot grant permissions to another user
      const shareRes = await request(app)
        .post(`/api/documents/${ownerDocId}/grants`)
        .set('Authorization', 'Bearer dev_viewer')
        .send({ targetUserId: 'user_outsider_001', permission: 'READ' });
      expect(shareRes.status).toBe(403);
    });

    it('enforces IMMEDIATE ACCESS REVOCATION on next protected request', async () => {
      // 1. Grant READ permission to viewer
      await request(app)
        .post(`/api/documents/${ownerDocId}/grants`)
        .set('Authorization', 'Bearer dev_owner')
        .send({ targetUserId: 'user_viewer_001', permission: 'READ' });

      // 2. Verify viewer has access
      const checkRes = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_viewer');
      expect(checkRes.status).toBe(200);

      // 3. Owner revokes access
      const revokeRes = await request(app)
        .delete(`/api/documents/${ownerDocId}/grants/user_viewer_001`)
        .set('Authorization', 'Bearer dev_owner');
      expect(revokeRes.status).toBe(200);

      // 4. Immediate revocation: Next request by viewer is instantly rejected
      const nextReq = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_viewer');
      expect(nextReq.status).toBe(404);

      // 5. Alternate route (metadata) is also instantly denied
      const metaReq = await request(app)
        .get(`/api/documents/${ownerDocId}`)
        .set('Authorization', 'Bearer dev_viewer');
      expect(metaReq.status).toBe(404);
    });

    it('allows EDIT grant holder to modify content', async () => {
      // 1. Grant EDIT permission
      await request(app)
        .post(`/api/documents/${ownerDocId}/grants`)
        .set('Authorization', 'Bearer dev_owner')
        .send({ targetUserId: 'user_viewer_001', permission: 'EDIT' });

      // 2. Edit content
      const replacementBuffer = Buffer.from('%PDF-1.4\n2 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 2 0 R >>\n%%EOF');
      const editRes = await request(app)
        .put(`/api/documents/${ownerDocId}/content`)
        .set('Authorization', 'Bearer dev_viewer')
        .attach('file', replacementBuffer, 'v2_audit.pdf');

      expect(editRes.status).toBe(200);
      expect(editRes.body.version).toBe(2);

      // 3. Verify downloaded bytes reflect new version
      const dlRes = await request(app)
        .get(`/api/documents/${ownerDocId}/download`)
        .set('Authorization', 'Bearer dev_viewer');
      expect(dlRes.status).toBe(200);
      expect(dlRes.body.toString()).toContain('2 0 obj');
    });
  });

  // =========================================================================
  // Section D: Storage, Multipart Limits & File Validation
  // =========================================================================
  describe('D. Upload Limits, MIME Spoofing & File Signature Validation', () => {
    it('rejects uploads exceeding 1,000,000 bytes with HTTP 413 Payload Too Large', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Giant File')
        .field('category', 'GENERAL')
        .attach('file', oversizedBuffer, 'oversized.pdf');

      expect(res.status).toBe(413);
      expect(res.body.type).toContain('payload-too-large');
    });

    it('rejects MIME spoofing: PDF file content disguised as .png extension', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Spoofed Image')
        .field('category', 'GENERAL')
        .attach('file', validPdfBuffer, 'fake_image.png');

      expect(res.status).toBe(422);
      expect(res.body.detail).toContain('MIME spoofing detected');
    });

    it('rejects dangerous executable files (.exe) with invalid signatures', async () => {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Malware.exe')
        .field('category', 'GENERAL')
        .attach('file', exeBuffer, 'payload.exe');

      expect(res.status).toBe(422);
      expect(res.body.detail).toContain('Dangerous or unsupported file extension');
    });

    it('rejects empty uploads (0-byte file)', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Empty')
        .field('category', 'GENERAL')
        .attach('file', emptyBuffer, 'empty.txt');

      expect(res.status).toBe(422);
      expect(res.body.detail).toContain('Empty upload');
    });
  });

  // =========================================================================
  // Section E: Audit Logging & Cryptographic Integrity Verification
  // =========================================================================
  describe('E. Audit Trail & Hash Chain Tamper Detection', () => {
    it('generates a valid, verified cryptographic audit trail for operations', async () => {
      // 1. Upload a document
      await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Audit Test')
        .field('category', 'LEGAL')
        .attach('file', validTxtBuffer, 'notes.txt');

      // 2. Verify audit chain integrity
      const verifyRes = await request(app)
        .get('/api/admin/audit/integrity')
        .set('Authorization', 'Bearer dev_admin');

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.integrity.isValid).toBe(true);
      expect(verifyRes.body.integrity.totalEvents).toBeGreaterThan(0);
    });

    it('detects tampering when an audit event is modified in the database', async () => {
      // 1. Create operations to build a chain
      await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Doc 1')
        .field('category', 'LEGAL')
        .attach('file', validTxtBuffer, 'doc1.txt');

      await request(app)
        .post('/api/documents')
        .set('Authorization', 'Bearer dev_owner')
        .field('title', 'Doc 2')
        .field('category', 'LEGAL')
        .attach('file', validTxtBuffer, 'doc2.txt');

      // 2. Tamper with an existing event in Firestore
      const db = getFirestoreDb();
      const eventsSnap = await db.collection('auditEvents').orderBy('sequence', 'asc').get();
      const firstEvent = eventsSnap.docs[0].data();

      // Maliciously modify the action name in the database
      await db.collection('auditEvents').doc(firstEvent.id).update({
        action: 'MALICIOUS_ALTERATION'
      });

      // 3. Run audit verification
      const verifyResult = await AuditService.verifyAuditIntegrity();
      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.error).toContain('tampered with');
    });
  });
});
