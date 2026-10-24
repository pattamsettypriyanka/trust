import { getFirestoreDb } from '../db/firestore.js';
import { DocumentGrant, DocumentMetadata, GrantPermission, UserProfile } from '../types/index.js';

export type ProtectedOperation =
  | 'READ_METADATA'
  | 'DOWNLOAD'
  | 'UPDATE_METADATA'
  | 'UPDATE_CONTENT'
  | 'DELETE'
  | 'RESTORE'
  | 'MANAGE_GRANTS'
  | 'VIEW_AUDIT';

export interface AuthorizationResult {
  authorized: boolean;
  statusCode: number;
  reason: string;
  document?: DocumentMetadata;
  grant?: DocumentGrant;
  isOwner?: boolean;
}

export class AuthorizationService {
  /**
   * Authorizes a user against a specific document for a specific operation.
   * STRICTLY server-enforced:
   * - No client-supplied roles or cached tokens trusted.
   * - Real-time lookup of authoritative documentGrants on EVERY call.
   * - ADMIN role does NOT bypass document confidentiality.
   * - Unauthorized queries return 404 to avoid leaking document existence to unauthorized callers.
   */
  static async authorizeDocumentAccess(
    documentId: string,
    user: UserProfile,
    operation: ProtectedOperation,
    tx?: any
  ): Promise<AuthorizationResult> {
    const db = getFirestoreDb();
    const docRef = db.collection('documents').doc(documentId);
    const docSnap = tx ? await tx.get(docRef) : await docRef.get();

    if (!docSnap.exists) {
      return {
        authorized: false,
        statusCode: 404,
        reason: 'Document not found'
      };
    }

    const document = docSnap.data() as DocumentMetadata;

    // Check soft deletion: If deleted, only owner can inspect or restore
    if (document.isDeleted && operation !== 'RESTORE') {
      return {
        authorized: false,
        statusCode: 404,
        reason: 'Document has been deleted'
      };
    }

    // 1. Is the user the explicit document owner?
    const isOwner = document.ownerId === user.id;

    if (isOwner) {
      // Owner has full control over their own documents
      return {
        authorized: true,
        statusCode: 200,
        reason: 'Authorized as document owner',
        document,
        isOwner: true
      };
    }

    // 2. User is NOT the owner. Check if ADMIN has special audit view policy
    // ADMIN can view audit trail of documents for compliance monitoring if explicitly requested,
    // but CANNOT read, download, edit, or delete document contents/metadata.
    if (user.role === 'ADMIN') {
      if (operation === 'VIEW_AUDIT') {
        return {
          authorized: true,
          statusCode: 200,
          reason: 'Authorized as administrator for compliance audit inspection',
          document,
          isOwner: false
        };
      }
      if (operation === 'MANAGE_GRANTS') {
        return {
          authorized: true,
          statusCode: 200,
          reason: 'Authorized as administrator for access control governance',
          document,
          isOwner: false
        };
      }
      // For all other operations, admin must have an explicit grant just like any other user
    }

    // 3. For operations restricted ONLY to owners:
    // Only the owner can delete/restore the document, or non-admins managing grants
    if (operation === 'MANAGE_GRANTS' || operation === 'DELETE' || operation === 'RESTORE') {
      return {
        authorized: false,
        statusCode: 403,
        reason: 'Only the document owner or an administrator can manage permissions or delete this document',
        document,
        isOwner: false
      };
    }

    // 4. Fetch real-time document grant: documentGrants/{documentId}_{userId}
    const grantId = `${documentId}_${user.id}`;
    const grantRef = db.collection('documentGrants').doc(grantId);
    const grantSnap = tx ? await tx.get(grantRef) : await grantRef.get();

    if (!grantSnap.exists) {
      // No active grant found
      // Return 404 for metadata reads and downloads to prevent document existence enumeration
      const isEnumerationSensitive = operation === 'READ_METADATA' || operation === 'DOWNLOAD' || operation === 'VIEW_AUDIT';
      return {
        authorized: false,
        statusCode: isEnumerationSensitive ? 404 : 403,
        reason: 'Access denied: No active permission grant exists for this document',
        document: undefined, // Do not expose document metadata to unauthorized users
        isOwner: false
      };
    }

    const grant = grantSnap.data() as DocumentGrant;

    // 5. Check permissions: READ vs EDIT
    // EDIT permission implies READ
    if (operation === 'READ_METADATA' || operation === 'DOWNLOAD' || operation === 'VIEW_AUDIT') {
      if (grant.permission === 'READ' || grant.permission === 'EDIT') {
        return {
          authorized: true,
          statusCode: 200,
          reason: `Authorized via explicit ${grant.permission} grant`,
          document,
          grant,
          isOwner: false
        };
      }
    }

    if (operation === 'UPDATE_METADATA' || operation === 'UPDATE_CONTENT') {
      if (grant.permission === 'EDIT') {
        return {
          authorized: true,
          statusCode: 200,
          reason: 'Authorized via explicit EDIT grant',
          document,
          grant,
          isOwner: false
        };
      }
      return {
        authorized: false,
        statusCode: 403,
        reason: 'Forbidden: Insufficient privileges. EDIT grant is required to modify this document.',
        document,
        grant,
        isOwner: false
      };
    }

    return {
      authorized: false,
      statusCode: 403,
      reason: 'Unauthorized operation requested',
      document: undefined,
      isOwner: false
    };
  }
}
