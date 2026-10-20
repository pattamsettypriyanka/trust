import dotenv from 'dotenv';
dotenv.config();

import { getFirestoreDb } from '../db/firestore.js';
import { AuditService } from '../services/audit.service.js';
import { DocumentMetadata, DocumentGrant, UserProfile } from '../types/index.js';
import { computeBufferSha256 } from '../utils/crypto.js';

export async function seedDemoData() {
  console.log('[Seed] Initializing TrustVault demo database...');
  const db = getFirestoreDb();
  const now = new Date().toISOString();

  // 1. Seed 3 Core Demo Roles
  const users: UserProfile[] = [
    {
      id: 'user_admin_001',
      email: 'admin@trustvault.local',
      displayName: 'Security Administrator (Admin)',
      role: 'ADMIN',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'user_owner_001',
      email: 'owner@trustvault.local',
      displayName: 'Elena Rostova (Document Owner)',
      role: 'OWNER',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'user_viewer_001',
      email: 'viewer@trustvault.local',
      displayName: 'Marcus Chen (Compliance Viewer)',
      role: 'VIEWER',
      createdAt: now,
      updatedAt: now
    }
  ];

  for (const user of users) {
    await db.collection('users').doc(user.id).set(user);
    console.log(`[Seed] Created User: ${user.email} (${user.role})`);
  }

  // 2. Seed Initial Documents (Stored binary content in documentContents, metadata in documents)
  const samplePdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const sampleTxtContent = Buffer.from('CONFIDENTIAL LEGAL AGREEMENT\n\nThis agreement is executed between TrustVault Enterprise and CypherSec Inc.\n1. Confidentiality: All document contents stored strictly in Firestore bytes.\n2. Access: Server-side real-time authorization enforced on every request.\n3. Non-repudiation: SHA-256 hash chaining active.');
  const samplePngContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89]);

  const docsToSeed = [
    {
      id: 'doc_financial_q3_report',
      title: 'Q3 Financial Audit & Revenue Projections',
      filename: 'q3_financial_audit.pdf',
      originalName: 'q3_financial_audit.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdfContent,
      category: 'FINANCIAL' as const,
      description: 'Quarterly financial statements with external auditor sign-off and balance sheet breakdown.',
      ownerId: 'user_owner_001',
      ownerEmail: 'owner@trustvault.local'
    },
    {
      id: 'doc_legal_nda_contract',
      title: 'Mutual Non-Disclosure Agreement (CypherSec)',
      filename: 'mutual_nda_cyphersec.txt',
      originalName: 'mutual_nda_cyphersec.txt',
      mimeType: 'text/plain',
      buffer: sampleTxtContent,
      category: 'LEGAL' as const,
      description: 'Strictly confidential bilateral NDA for enterprise client integration.',
      ownerId: 'user_owner_001',
      ownerEmail: 'owner@trustvault.local'
    },
    {
      id: 'doc_eng_zero_trust_spec',
      title: 'Zero-Trust Architecture Blueprint',
      filename: 'architecture_diagram.png',
      originalName: 'architecture_diagram.png',
      mimeType: 'image/png',
      buffer: samplePngContent,
      category: 'ENGINEERING' as const,
      description: 'System architectural blueprint highlighting Firestore byte containment and authorization barriers.',
      ownerId: 'user_owner_001',
      ownerEmail: 'owner@trustvault.local'
    }
  ];

  for (const doc of docsToSeed) {
    const sha256 = computeBufferSha256(doc.buffer);
    const metadata: DocumentMetadata = {
      id: doc.id,
      title: doc.title,
      filename: doc.filename,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.buffer.length,
      sha256,
      ownerId: doc.ownerId,
      ownerEmail: doc.ownerEmail,
      category: doc.category,
      description: doc.description,
      version: 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };

    // Metadata in documents
    await db.collection('documents').doc(doc.id).set(metadata);

    // Binary content in documentContents
    await db.collection('documentContents').doc(doc.id).set({
      documentId: doc.id,
      content: doc.buffer,
      size: doc.buffer.length,
      sha256,
      updatedAt: now
    });

    // Audit event
    await AuditService.logEvent({
      actorId: doc.ownerId,
      actorEmail: doc.ownerEmail,
      actorRole: 'OWNER',
      action: 'DOCUMENT_UPLOAD',
      documentId: doc.id,
      outcome: 'SUCCESS',
      requestId: 'req_seed_init',
      details: { title: doc.title, filename: doc.filename, size: doc.buffer.length }
    });

    console.log(`[Seed] Seeded Document: ${doc.title} (${doc.id})`);
  }

  // 3. Seed Grants
  // Grant Marcus Chen (VIEWER) READ access to the Financial Report
  const financialGrant: DocumentGrant = {
    id: 'doc_financial_q3_report_user_viewer_001',
    documentId: 'doc_financial_q3_report',
    userId: 'user_viewer_001',
    userEmail: 'viewer@trustvault.local',
    permission: 'READ',
    grantedBy: 'user_owner_001',
    grantedAt: now
  };
  await db.collection('documentGrants').doc(financialGrant.id).set(financialGrant);
  await AuditService.logEvent({
    actorId: 'user_owner_001',
    actorEmail: 'owner@trustvault.local',
    actorRole: 'OWNER',
    action: 'PERMISSION_GRANT',
    documentId: 'doc_financial_q3_report',
    targetUserId: 'user_viewer_001',
    outcome: 'SUCCESS',
    requestId: 'req_seed_grant',
    details: { permission: 'READ', targetEmail: 'viewer@trustvault.local' }
  });

  // Grant Marcus Chen (VIEWER) EDIT access to the Engineering Architecture Blueprint
  const engGrant: DocumentGrant = {
    id: 'doc_eng_zero_trust_spec_user_viewer_001',
    documentId: 'doc_eng_zero_trust_spec',
    userId: 'user_viewer_001',
    userEmail: 'viewer@trustvault.local',
    permission: 'EDIT',
    grantedBy: 'user_owner_001',
    grantedAt: now
  };
  await db.collection('documentGrants').doc(engGrant.id).set(engGrant);
  await AuditService.logEvent({
    actorId: 'user_owner_001',
    actorEmail: 'owner@trustvault.local',
    actorRole: 'OWNER',
    action: 'PERMISSION_GRANT',
    documentId: 'doc_eng_zero_trust_spec',
    targetUserId: 'user_viewer_001',
    outcome: 'SUCCESS',
    requestId: 'req_seed_grant',
    details: { permission: 'EDIT', targetEmail: 'viewer@trustvault.local' }
  });

  console.log('[Seed] Database seed completed successfully!');
}

// Execute if run directly via tsx
if (process.argv[1]?.includes('seed')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
