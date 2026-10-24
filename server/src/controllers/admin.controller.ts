import { Request, Response } from 'express';
import { z } from 'zod';
import { getFirestoreDb } from '../db/firestore.js';
import { AuditService } from '../services/audit.service.js';
import { AuditEvent, Role, UserProfile } from '../types/index.js';

const roleUpdateSchema = z.object({
  role: z.enum(['ADMIN', 'OWNER', 'VIEWER'] as const)
});

export class AdminController {
  /**
   * Lists all users in the system for administrative management.
   */
  static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const db = getFirestoreDb();
      const [usersSnap, grantsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('documentGrants').get()
      ]);

      const grantCounts: Record<string, number> = {};
      for (const gDoc of grantsSnap.docs) {
        const g = gDoc.data();
        if (g.userId) {
          grantCounts[g.userId] = (grantCounts[g.userId] || 0) + 1;
        }
      }

      const users: Array<UserProfile & { sharedDocumentsCount: number }> = usersSnap.docs.map((doc: any) => {
        const u = doc.data() as UserProfile;
        return {
          ...u,
          sharedDocumentsCount: grantCounts[u.id] || 0
        };
      });

      // Sort by createdAt desc
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ users });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Listing Users',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Updates a user's role.
   * STRICT SECURITY RULES:
   * - Only authenticated ADMINs can call this endpoint.
   * - An admin cannot demote themselves (prevents lockout).
   * - A user cannot elevate their own privileges.
   */
  static async updateUserRole(req: Request, res: Response): Promise<void> {
    const adminUser = req.user!;
    const targetUserId = req.params.userId;

    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        type: 'https://trustvault.internal/errors/validation-error',
        title: 'Validation Failed',
        status: 422,
        errors: parsed.error.errors,
        requestId: req.requestId
      });
      return;
    }

    const { role: newRole } = parsed.data;

    // Reject self-role modification
    if (targetUserId === adminUser.id) {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Self Modification Forbidden',
        status: 400,
        detail: 'Administrators cannot alter their own role. Another administrator must perform this action.',
        requestId: req.requestId
      });
      return;
    }

    const db = getFirestoreDb();
    const targetUserRef = db.collection('users').doc(targetUserId);
    const targetUserSnap = await targetUserRef.get();

    if (!targetUserSnap.exists) {
      res.status(404).json({
        type: 'https://trustvault.internal/errors/user-not-found',
        title: 'User Not Found',
        status: 404,
        detail: `User with ID "${targetUserId}" does not exist.`,
        requestId: req.requestId
      });
      return;
    }

    const targetUser = targetUserSnap.data() as UserProfile;
    const oldRole = targetUser.role;

    const timestamp = new Date().toISOString();

    await db.runTransaction(async (tx: any) => {
      tx.update(targetUserRef, {
        role: newRole,
        updatedAt: timestamp
      });

      await AuditService.logEvent(
        {
          actorId: adminUser.id,
          actorEmail: adminUser.email,
          actorRole: adminUser.role,
          action: 'ROLE_CHANGE',
          targetUserId,
          outcome: 'SUCCESS',
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: {
            targetEmail: targetUser.email,
            oldRole,
            newRole
          }
        },
        tx
      );
    });

    res.json({
      message: `User ${targetUser.email} role updated from ${oldRole} to ${newRole}`,
      userId: targetUserId,
      newRole
    });
  }

  /**
   * Retrieves global audit logs with comprehensive filtering and pagination.
   */
  static async listAuditEvents(req: Request, res: Response): Promise<void> {
    try {
      const db = getFirestoreDb();
      const action = req.query.action as string;
      const actorId = req.query.actorId as string;
      const documentId = req.query.documentId as string;
      const outcome = req.query.outcome as string;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      let snapshot = await db.collection('auditEvents').orderBy('sequence', 'desc').get();
      let events: AuditEvent[] = snapshot.docs.map((d: any) => d.data() as AuditEvent);

      // In-memory filter for flexible multi-dimensional query
      if (action) {
        events = events.filter((e) => e.action === action);
      }
      if (actorId) {
        events = events.filter((e) => e.actorId === actorId || (e.actorEmail && e.actorEmail.includes(actorId)));
      }
      if (documentId) {
        events = events.filter((e) => e.documentId === documentId);
      }
      if (outcome) {
        events = events.filter((e) => e.outcome === outcome);
      }

      const total = events.length;
      const paginated = events.slice(offset, offset + limit);

      res.json({
        events: paginated,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Querying Audit Trail',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Cryptographically validates the audit trail hash chain.
   */
  static async verifyAuditIntegrity(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuditService.verifyAuditIntegrity();

      await AuditService.logEvent({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'AUDIT_INTEGRITY_CHECK',
        outcome: result.isValid ? 'SUCCESS' : 'FAILED',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          totalEvents: result.totalEvents,
          isValid: result.isValid,
          lastSequence: result.lastSequence,
          error: result.error
        }
      });

      res.json({
        integrity: result
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Audit Verification Failed',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Aggregates security metrics: downloads, permission changes, denied attempts, failed uploads.
   */
  static async getSecurityStats(req: Request, res: Response): Promise<void> {
    try {
      const db = getFirestoreDb();
      const eventsSnap = await db.collection('auditEvents').get();
      const events: AuditEvent[] = eventsSnap.docs.map((d: any) => d.data() as AuditEvent);

      const stats = {
        totalEvents: events.length,
        downloadsCount: events.filter((e) => e.action === 'DOCUMENT_DOWNLOAD').length,
        permissionChangesCount: events.filter((e) => e.action === 'PERMISSION_GRANT' || e.action === 'PERMISSION_REVOKE').length,
        deniedAttemptsCount: events.filter((e) => e.action === 'ACCESS_DENIED').length,
        failedUploadsCount: events.filter((e) => e.action === 'UPLOAD_REJECTED').length,
        roleChangesCount: events.filter((e) => e.action === 'ROLE_CHANGE').length,
        recentDeniedEvents: events
          .filter((e) => e.action === 'ACCESS_DENIED' || e.outcome === 'DENIED')
          .slice(-10)
          .reverse()
      };

      res.json({ stats });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Aggregating Stats',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Retrieves full details for a specific user: profile, grants, and owned documents.
   */
  static async getUserDetails(req: Request, res: Response): Promise<void> {
    const targetUserId = req.params.userId;
    try {
      const db = getFirestoreDb();
      const userSnap = await db.collection('users').doc(targetUserId).get();

      if (!userSnap.exists) {
        res.status(404).json({
          type: 'https://trustvault.internal/errors/not-found',
          title: 'User Not Found',
          status: 404,
          detail: `User with ID ${targetUserId} does not exist.`
        });
        return;
      }

      const targetUser = userSnap.data() as UserProfile;

      // 1. Fetch grants where userId === targetUserId
      const grantsSnap = await db
        .collection('documentGrants')
        .where('userId', '==', targetUserId)
        .get();

      const grants = [];
      for (const gDoc of grantsSnap.docs) {
        const grant = gDoc.data();
        const docSnap = await db.collection('documents').doc(grant.documentId).get();
        const docData = docSnap.exists ? docSnap.data() : null;
        grants.push({
          ...grant,
          documentTitle: docData?.title || 'Unknown Document',
          documentFilename: docData?.filename || 'unknown.bin',
          documentCategory: docData?.category || 'GENERAL',
          documentSize: docData?.size || 0,
          documentOwnerEmail: docData?.ownerEmail || 'Unknown'
        });
      }

      // 2. Fetch documents owned by this user
      const ownedSnap = await db
        .collection('documents')
        .where('ownerId', '==', targetUserId)
        .where('isDeleted', '==', false)
        .get();

      const ownedDocuments = ownedSnap.docs.map((d: any) => d.data());

      res.json({
        user: targetUser,
        grants,
        ownedDocuments
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Loading User Details',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Allows Admin to directly share a particular document with a specific user.
   */
  static async shareDocumentWithUser(req: Request, res: Response): Promise<void> {
    const adminUser = req.user!;
    const targetUserId = req.params.userId;
    const { documentId, permission = 'READ' } = req.body;

    if (!documentId) {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Missing Document ID',
        status: 400,
        detail: 'documentId is required in request body.'
      });
      return;
    }

    try {
      const db = getFirestoreDb();
      const [docSnap, targetUserSnap] = await Promise.all([
        db.collection('documents').doc(documentId).get(),
        db.collection('users').doc(targetUserId).get()
      ]);

      if (!docSnap.exists) {
        res.status(404).json({
          type: 'https://trustvault.internal/errors/not-found',
          title: 'Document Not Found',
          status: 404,
          detail: `Document with ID ${documentId} does not exist.`
        });
        return;
      }

      if (!targetUserSnap.exists) {
        res.status(404).json({
          type: 'https://trustvault.internal/errors/not-found',
          title: 'Target User Not Found',
          status: 404,
          detail: `Target user with ID ${targetUserId} does not exist.`
        });
        return;
      }

      const docData = docSnap.data();
      const targetUser = targetUserSnap.data() as UserProfile;

      if (docData.ownerId === targetUserId) {
        res.status(400).json({
          type: 'https://trustvault.internal/errors/bad-request',
          title: 'Cannot Grant to Document Owner',
          status: 400,
          detail: 'User is already the owner of this document.'
        });
        return;
      }

      const grantId = `${documentId}_${targetUserId}`;
      const now = new Date().toISOString();
      const grant = {
        id: grantId,
        documentId,
        userId: targetUserId,
        userEmail: targetUser.email,
        userName: targetUser.displayName,
        permission,
        grantedBy: adminUser.id,
        grantedByEmail: adminUser.email,
        createdAt: now,
        updatedAt: now
      };

      await db.collection('documentGrants').doc(grantId).set(grant);

      // Audit event
      await AuditService.logEvent({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        action: 'PERMISSION_GRANT',
        documentId,
        outcome: 'SUCCESS',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          targetUserId,
          targetUserEmail: targetUser.email,
          permission,
          documentTitle: docData.title,
          source: 'ADMIN_CONSOLE'
        }
      });

      res.status(201).json({
        message: `Successfully granted ${permission} access on "${docData.title}" to ${targetUser.email}`,
        grant
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Granting Permission',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Allows Admin to immediately revoke a user's access to a document.
   */
  static async revokeDocumentForUser(req: Request, res: Response): Promise<void> {
    const adminUser = req.user!;
    const { userId: targetUserId, documentId } = req.params;

    try {
      const db = getFirestoreDb();
      const grantId = `${documentId}_${targetUserId}`;
      const grantRef = db.collection('documentGrants').doc(grantId);
      const grantSnap = await grantRef.get();

      if (!grantSnap.exists) {
        res.status(404).json({
          type: 'https://trustvault.internal/errors/not-found',
          title: 'Grant Not Found',
          status: 404,
          detail: 'No active grant exists for this user and document.'
        });
        return;
      }

      const grantData = grantSnap.data();
      await grantRef.delete();

      // Audit event
      await AuditService.logEvent({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        action: 'PERMISSION_REVOKE',
        documentId,
        outcome: 'SUCCESS',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          targetUserId,
          targetUserEmail: grantData.userEmail,
          revokedPermission: grantData.permission,
          source: 'ADMIN_CONSOLE'
        }
      });

      res.json({
        message: `Successfully revoked access for ${grantData.userEmail} on document ${documentId}`
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Revoking Permission',
        status: 500,
        detail: (err as Error).message
      });
    }
  }
}
