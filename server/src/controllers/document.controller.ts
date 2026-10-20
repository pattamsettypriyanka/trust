import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getFirestoreDb } from '../db/firestore.js';
import { AuditService } from '../services/audit.service.js';
import { AuthorizationService } from '../services/authz.service.js';
import { DocumentCategory, DocumentMetadata } from '../types/index.js';
import { computeBufferSha256 } from '../utils/crypto.js';
import { validateUploadedFile, MAX_FILE_SIZE_BYTES } from '../utils/fileValidation.js';

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title cannot exceed 120 characters'),
  category: z.enum(['FINANCIAL', 'LEGAL', 'ENGINEERING', 'HR', 'CONFIDENTIAL', 'GENERAL'] as const),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional()
});

const updateMetadataSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  category: z.enum(['FINANCIAL', 'LEGAL', 'ENGINEERING', 'HR', 'CONFIDENTIAL', 'GENERAL'] as const).optional(),
  description: z.string().max(500).optional()
});

export class DocumentController {
  /**
   * Uploads a document. Validates size, magic bytes, sanitizes filename.
   * Stores binary content ONLY in documentContents, metadata in documents.
   * Atomically records audit event.
   */
  static async uploadDocument(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const file = req.file;

    // 1. Check if file is provided
    if (!file) {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Missing File',
        status: 400,
        detail: 'No file was uploaded in the "file" multipart field.',
        requestId: req.requestId
      });
      return;
    }

    // 2. Validate metadata fields with Zod
    const parsedBody = uploadSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(422).json({
        type: 'https://trustvault.internal/errors/validation-error',
        title: 'Validation Failed',
        status: 422,
        errors: parsedBody.error.errors,
        requestId: req.requestId
      });
      return;
    }

    // 3. Inspect buffer size, magic bytes signature, and extension spoofing
    const validation = validateUploadedFile(file.buffer, file.originalname, file.mimetype);
    if (!validation.isValid) {
      await AuditService.logEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'UPLOAD_REJECTED',
        outcome: 'FAILED',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          originalFilename: file.originalname,
          size: file.size,
          reason: validation.error
        }
      });

      const isTooLarge = file.buffer.length > MAX_FILE_SIZE_BYTES;
      res.status(isTooLarge ? 413 : 422).json({
        type: isTooLarge
          ? 'https://trustvault.internal/errors/payload-too-large'
          : 'https://trustvault.internal/errors/invalid-file',
        title: isTooLarge ? 'Payload Too Large' : 'Invalid File Upload',
        status: isTooLarge ? 413 : 422,
        detail: validation.error,
        requestId: req.requestId
      });
      return;
    }

    const documentId = `doc_${uuidv4()}`;
    const timestamp = new Date().toISOString();
    const sha256 = computeBufferSha256(file.buffer);

    const metadata: DocumentMetadata = {
      id: documentId,
      title: parsedBody.data.title,
      filename: validation.sanitizedFilename,
      originalName: file.originalname,
      mimeType: validation.detectedMimeType,
      size: file.buffer.length,
      sha256,
      ownerId: user.id,
      ownerEmail: user.email,
      category: parsedBody.data.category as DocumentCategory,
      description: parsedBody.data.description || '',
      version: 1,
      isDeleted: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const db = getFirestoreDb();

    // Atomic transaction: save metadata, save binary content in separate collection, log audit
    await db.runTransaction(async (tx: any) => {
      const docRef = db.collection('documents').doc(documentId);
      const contentRef = db.collection('documentContents').doc(documentId);

      // Metadata only in documents
      tx.set(docRef, metadata);

      // Binary content only in documentContents (never duplicated in documents)
      tx.set(contentRef, {
        documentId,
        content: file.buffer,
        size: file.buffer.length,
        sha256,
        updatedAt: timestamp
      });

      // Audit event
      await AuditService.logEvent(
        {
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'DOCUMENT_UPLOAD',
          documentId,
          outcome: 'SUCCESS',
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: {
            title: metadata.title,
            filename: metadata.filename,
            size: metadata.size,
            mimeType: metadata.mimeType,
            sha256: metadata.sha256
          }
        },
        tx
      );
    });

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: metadata
    });
  }

  /**
   * Lists documents visible to the caller (server-side filtered).
   * Search and filter applied server-side.
   */
  static async listDocuments(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const db = getFirestoreDb();

    const tab = (req.query.tab as string) || 'my'; // 'my' | 'shared' | 'all'
    const category = req.query.category as string;
    const search = (req.query.search as string || '').toLowerCase().trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    let docList: DocumentMetadata[] = [];

    if (tab === 'my' || (tab === 'all' && user.role !== 'ADMIN')) {
      // Documents owned by current user
      let q = db.collection('documents').where('ownerId', '==', user.id).where('isDeleted', '==', false);
      if (category) {
        q = q.where('category', '==', category);
      }
      const myDocsSnap = await q.get();
      docList.push(...myDocsSnap.docs.map((d: any) => d.data() as DocumentMetadata));
    }

    if (tab === 'shared' || (tab === 'all' && user.role !== 'ADMIN')) {
      // Documents explicitly granted to current user
      const grantsSnap = await db.collection('documentGrants').where('userId', '==', user.id).get();
      const grantedDocIds = grantsSnap.docs.map((d: any) => d.data().documentId);

      for (const dId of grantedDocIds) {
        const dSnap = await db.collection('documents').doc(dId).get();
        if (dSnap.exists) {
          const doc = dSnap.data() as DocumentMetadata;
          if (!doc.isDeleted && (!category || doc.category === category)) {
            // Avoid duplicates if user somehow owns it too
            if (!docList.some((existing) => existing.id === doc.id)) {
              docList.push(doc);
            }
          }
        }
      }
    }

    if (tab === 'all' && user.role === 'ADMIN') {
      // ADMIN compliance inspection: view all document metadata (never contents)
      let q = db.collection('documents').where('isDeleted', '==', false);
      if (category) {
        q = q.where('category', '==', category);
      }
      const allDocsSnap = await q.get();
      docList = allDocsSnap.docs.map((d: any) => d.data() as DocumentMetadata);
    }

    // Apply client search query filter on filename/title
    if (search) {
      docList = docList.filter(
        (d) =>
          d.title.toLowerCase().includes(search) ||
          d.filename.toLowerCase().includes(search) ||
          d.originalName.toLowerCase().includes(search)
      );
    }

    // Sort by createdAt desc
    docList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = docList.length;
    const paginated = docList.slice(offset, offset + limit);

    res.json({
      documents: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  }

  /**
   * Retrieves document metadata. Strictly server-authorized.
   */
  static async getDocumentMetadata(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'READ_METADATA');

    if (!authResult.authorized) {
      await AuditService.logEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'ACCESS_DENIED',
        documentId,
        outcome: 'DENIED',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: { reason: authResult.reason, operation: 'READ_METADATA' }
      });

      res.status(authResult.statusCode).json({
        type: 'https://trustvault.internal/errors/not-found-or-denied',
        title: authResult.statusCode === 404 ? 'Document Not Found' : 'Access Denied',
        status: authResult.statusCode,
        detail: authResult.reason,
        requestId: req.requestId
      });
      return;
    }

    res.json({
      document: authResult.document,
      isOwner: authResult.isOwner,
      userGrant: authResult.grant?.permission || (authResult.isOwner ? 'OWNER' : null)
    });
  }

  /**
   * Downloads document content.
   * Rechecks authorization immediately on request.
   * Returns safe headers (nosniff, attachment, sanitized name).
   */
  static async downloadDocument(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'DOWNLOAD');

    if (!authResult.authorized) {
      await AuditService.logEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'ACCESS_DENIED',
        documentId,
        outcome: 'DENIED',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: { reason: authResult.reason, operation: 'DOWNLOAD' }
      });

      res.status(authResult.statusCode).json({
        type: 'https://trustvault.internal/errors/not-found-or-denied',
        title: authResult.statusCode === 404 ? 'Document Not Found' : 'Access Denied',
        status: authResult.statusCode,
        detail: authResult.reason,
        requestId: req.requestId
      });
      return;
    }

    const document = authResult.document!;
    const db = getFirestoreDb();
    const contentSnap = await db.collection('documentContents').doc(documentId).get();

    if (!contentSnap.exists) {
      res.status(404).json({
        type: 'https://trustvault.internal/errors/not-found',
        title: 'Content Not Found',
        status: 404,
        detail: 'Binary content for this document was not found in storage.',
        requestId: req.requestId
      });
      return;
    }

    const contentData = contentSnap.data();
    const buffer = Buffer.isBuffer(contentData.content)
      ? contentData.content
      : Buffer.from(contentData.content);

    // Record download audit event
    await AuditService.logEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DOCUMENT_DOWNLOAD',
      documentId,
      outcome: 'SUCCESS',
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        filename: document.filename,
        size: buffer.length,
        sha256: document.sha256
      }
    });

    // Enforce safe headers
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(buffer);
  }

  /**
   * Updates document metadata (title, category, description).
   */
  static async updateDocumentMetadata(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'UPDATE_METADATA');

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

    const parsed = updateMetadataSchema.safeParse(req.body);
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

    const db = getFirestoreDb();
    const updateData: Partial<DocumentMetadata> = {
      updatedAt: new Date().toISOString()
    };
    if (parsed.data.title) updateData.title = parsed.data.title;
    if (parsed.data.category) updateData.category = parsed.data.category;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;

    await db.collection('documents').doc(documentId).update(updateData);

    await AuditService.logEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DOCUMENT_UPDATE_METADATA',
      documentId,
      outcome: 'SUCCESS',
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: { updatedFields: Object.keys(updateData) }
    });

    const refreshed = await db.collection('documents').doc(documentId).get();
    res.json({
      message: 'Metadata updated successfully',
      document: refreshed.data()
    });
  }

  /**
   * Updates document binary content (new version).
   * Authorized for owner or EDIT grant holders.
   */
  static async updateDocumentContent(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Missing File',
        status: 400,
        detail: 'No replacement file was uploaded in the "file" multipart field.',
        requestId: req.requestId
      });
      return;
    }

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'UPDATE_CONTENT');

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

    const validation = validateUploadedFile(file.buffer, file.originalname, file.mimetype);
    if (!validation.isValid) {
      const isTooLarge = file.buffer.length > MAX_FILE_SIZE_BYTES;
      res.status(isTooLarge ? 413 : 422).json({
        type: isTooLarge
          ? 'https://trustvault.internal/errors/payload-too-large'
          : 'https://trustvault.internal/errors/invalid-file',
        title: isTooLarge ? 'Payload Too Large' : 'Invalid File',
        status: isTooLarge ? 413 : 422,
        detail: validation.error,
        requestId: req.requestId
      });
      return;
    }

    const db = getFirestoreDb();
    const existingDoc = authResult.document!;
    const timestamp = new Date().toISOString();
    const newSha256 = computeBufferSha256(file.buffer);
    const newVersion = (existingDoc.version || 1) + 1;

    await db.runTransaction(async (tx: any) => {
      const docRef = db.collection('documents').doc(documentId);
      const contentRef = db.collection('documentContents').doc(documentId);

      tx.update(docRef, {
        filename: validation.sanitizedFilename,
        mimeType: validation.detectedMimeType,
        size: file.buffer.length,
        sha256: newSha256,
        version: newVersion,
        updatedAt: timestamp
      });

      tx.set(contentRef, {
        documentId,
        content: file.buffer,
        size: file.buffer.length,
        sha256: newSha256,
        updatedAt: timestamp
      });

      await AuditService.logEvent(
        {
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'DOCUMENT_UPDATE_CONTENT',
          documentId,
          outcome: 'SUCCESS',
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: {
            newVersion,
            newSize: file.buffer.length,
            newSha256
          }
        },
        tx
      );
    });

    res.json({
      message: 'Document content updated successfully',
      version: newVersion
    });
  }

  /**
   * Deletes a document (soft delete policy). Restricted ONLY to owner.
   */
  static async deleteDocument(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'DELETE');

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
    const timestamp = new Date().toISOString();

    await db.collection('documents').doc(documentId).update({
      isDeleted: true,
      deletedAt: timestamp,
      deletedBy: user.id,
      updatedAt: timestamp
    });

    await AuditService.logEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DOCUMENT_DELETE',
      documentId,
      outcome: 'SUCCESS',
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: { softDeleted: true }
    });

    res.json({
      message: 'Document soft-deleted successfully'
    });
  }

  /**
   * Restores a soft-deleted document. Restricted ONLY to owner.
   */
  static async restoreDocument(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'RESTORE');

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
    const timestamp = new Date().toISOString();

    await db.collection('documents').doc(documentId).update({
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedAt: timestamp
    });

    await AuditService.logEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DOCUMENT_RESTORE',
      documentId,
      outcome: 'SUCCESS',
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      message: 'Document restored successfully'
    });
  }

  /**
   * Retrieves document activity/audit trail for authorized readers (Owner or Admin).
   */
  static async getDocumentAudit(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const documentId = req.params.id;

    const authResult = await AuthorizationService.authorizeDocumentAccess(documentId, user, 'VIEW_AUDIT');

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
    const eventsSnap = await db
      .collection('auditEvents')
      .where('documentId', '==', documentId)
      .orderBy('sequence', 'desc')
      .get();

    res.json({
      events: eventsSnap.docs.map((d: any) => d.data())
    });
  }
}
