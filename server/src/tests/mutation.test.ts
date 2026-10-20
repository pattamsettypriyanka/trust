import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetInMemoryDb, getFirestoreDb } from '../db/firestore.js';
import { AuthorizationService } from '../services/authz.service.js';

const app = createApp();
const validTxtBuffer = Buffer.from('Confidential strategic plan for TrustVault internal audit.');

describe('F. Authorization Mutation & Regression Testing', () => {
  let docId: string;

  beforeEach(async () => {
    resetInMemoryDb();

    // Seed test users
    const db = getFirestoreDb();
    await db.collection('users').doc('user_owner_001').set({
      id: 'user_owner_001',
      email: 'owner@trustvault.local',
      displayName: 'Document Owner',
      role: 'OWNER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await db.collection('users').doc('user_outsider_001').set({
      id: 'user_outsider_001',
      email: 'outsider@trustvault.local',
      displayName: 'Unauthorized Outsider',
      role: 'VIEWER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Upload document as OWNER
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', 'Bearer dev_owner')
      .field('title', 'Confidential Plan')
      .field('category', 'CONFIDENTIAL')
      .attach('file', validTxtBuffer, 'strategy.txt');

    docId = uploadRes.body.document.id;
  });

  it('Baseline Check: Unauthorized outsider is rejected when authorization is enabled', async () => {
    const res = await request(app)
      .get(`/api/documents/${docId}/download`)
      .set('Authorization', 'Bearer dev_outsider');

    expect(res.status).toBe(404);
  });

  it('Mutation Test: Proves that disabling the grant check causes the security test to fail', async () => {
    // Save original authorization method
    const originalAuthorize = AuthorizationService.authorizeDocumentAccess;

    try {
      // INTRODUCE MUTATION: Bypass authorization by simulating a buggy/permissive check
      // e.g. "if (user) return { authorized: true, statusCode: 200, document }"
      AuthorizationService.authorizeDocumentAccess = async (documentId, user, op) => {
        const db = getFirestoreDb();
        const docSnap = await db.collection('documents').doc(documentId).get();
        return {
          authorized: true, // BUGGY MUTATION: Always authorizes any authenticated user!
          statusCode: 200,
          reason: 'MUTATION: Security check bypassed',
          document: docSnap.data(),
          isOwner: false
        };
      };

      // Perform the download as unauthorized outsider
      const mutatedRes = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Authorization', 'Bearer dev_outsider');

      // The mutated code allows the unauthorized access (status 200 instead of 404)
      expect(mutatedRes.status).toBe(200);

      // Verifying that our standard security assertion (expect status 404) FAILS under this mutation:
      const doesStandardSecurityAssertionFail = mutatedRes.status !== 404;
      expect(doesStandardSecurityAssertionFail).toBe(true);
    } finally {
      // Restore original authoritative implementation
      AuthorizationService.authorizeDocumentAccess = originalAuthorize;
    }
  });

  it('Post-Mutation Restoration: Authoritative checks are fully active again', async () => {
    const res = await request(app)
      .get(`/api/documents/${docId}/download`)
      .set('Authorization', 'Bearer dev_outsider');

    // Confirm system returned to secure state
    expect(res.status).toBe(404);
  });
});
