import { Request, Response } from 'express';
import { z } from 'zod';
import { getFirestoreDb } from '../db/firestore.js';
import { AuditService } from '../services/audit.service.js';
import { AuthorizationService } from '../services/authz.service.js';
import { DocumentGrant, GrantPermission, UserProfile } from '../types/index.js';

const grantSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID is required'),
  permission: z.enum(['READ', 'EDIT'] as const)
});

export class PermissionController {
  /**
   * Lists explicit grants for a document. Restricted to Owner or Admin.
   */
  static async listGrants(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    // Check authorization: Must be owner or admin
    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'READ_METADATA');
    if (!authResult.authorized || (!authResult.isOwner && user.role !== 'ADMIN')) {
      res.status(403).json({
        type: 'https://trustvault.internal/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only the document owner or compliance administrator can view permission grants.',
        requestId: req.requestId
      });
      return;
    }

    const db = getFirestoreDb();
    const grantsSnap = await db
      .collection('documentGrants')
      .where('documentId', '==', documentId)
      .get();

    const grants: DocumentGrant[] = grantsSnap.docs.map((d: any) => d.data() as DocumentGrant);

    res.json({ grants });
  }

  /**
   * Grants or updates READ/EDIT permission to a named user. Restricted ONLY to Document Owner.
   */
  static async createGrant(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'MANAGE_GRANTS');
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({
        type: 'https://trustvault.internal/errors/forbidden',
        title: 'Forbidden',
        status: authResult.statusCode,
        detail: authResult.reason,
        requestId: req.requestId
      });
      return;
    }

    const parsed = grantSchema.safeParse(req.body);
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

    const { targetUserId, permission } = parsed.data;

    // Disallow granting permissions to oneself (owner already owns the document)
    if (targetUserId === user.id) {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Invalid Grant',
        status: 400,
        detail: 'Cannot grant permissions to yourself as the document owner.',
        requestId: req.requestId
      });
      return;
    }

    const db = getFirestoreDb();

    // Verify target user exists
    const targetUserSnap = await db.collection('users').doc(targetUserId).get();
    if (!targetUserSnap.exists) {
      res.status(404).json({
        type: 'https://trustvault.internal/errors/user-not-found',
        title: 'User Not Found',
        status: 404,
        detail: `Target user with ID "${targetUserId}" was not found.`,
        requestId: req.requestId
      });
      return;
    }

    const targetUser = targetUserSnap.data() as UserProfile;
    const grantId = `${documentId}_${targetUserId}`;
    const timestamp = new Date().toISOString();

    const grantRecord: DocumentGrant = {
      id: grantId,
      documentId,
      userId: targetUserId,
      userEmail: targetUser.email,
      permission: permission as GrantPermission,
      grantedBy: user.id,
      grantedAt: timestamp
    };

    // Transactionally persist grant and audit log
    await db.runTransaction(async (tx: any) => {
      const grantRef = db.collection('documentGrants').doc(grantId);
      tx.set(grantRef, grantRecord);

      await AuditService.logEvent(
        {
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'PERMISSION_GRANT',
          documentId,
          targetUserId,
          outcome: 'SUCCESS',
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: {
            permission,
            targetEmail: targetUser.email
          }
        },
        tx
      );
    });

    res.status(201).json({
      message: `Permission ${permission} granted to ${targetUser.email}`,
      grant: grantRecord
    });
  }

  /**
   * Revokes a user's permission grant. Restricted ONLY to Document Owner.
   * Takes effect immediately on the next protected request.
   */
  static async revokeGrant(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;
    const targetUserId = req.params.userId;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'MANAGE_GRANTS');
    if (!authResult.authorized) {
      res.status(authResult.statusCode).json({
        type: 'https://trustvault.internal/errors/forbidden',
        title: 'Forbidden',
        status: authResult.statusCode,
        detail: authResult.reason,
        requestId: req.requestId
      });
      return;
    }

    const db = getFirestoreDb();
    const grantId = `${documentId}_${targetUserId}`;
    const grantRef = db.collection('documentGrants').doc(grantId);
    const grantSnap = await grantRef.get();

    if (!grantSnap.exists) {
      res.status(404).json({
        type: 'https://trustvault.internal/errors/grant-not-found',
        title: 'Grant Not Found',
        status: 404,
        detail: 'No active grant exists for this user on this document.',
        requestId: req.requestId
      });
      return;
    }

    // Transactionally delete grant and record audit log
    await db.runTransaction(async (tx: any) => {
      tx.delete(grantRef);

      await AuditService.logEvent(
        {
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'PERMISSION_REVOKE',
          documentId,
          targetUserId,
          outcome: 'SUCCESS',
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: {
            revokedUserId: targetUserId
          }
        },
        tx
      );
    });

    res.json({
      message: 'Permission revoked successfully. Access terminates immediately.'
    });
  }
}
