export type Role = 'ADMIN' | 'OWNER' | 'VIEWER';

export type GrantPermission = 'READ' | 'EDIT';

export type DocumentCategory = 
  | 'FINANCIAL' 
  | 'LEGAL' 
  | 'ENGINEERING' 
  | 'HR' 
  | 'CONFIDENTIAL' 
  | 'GENERAL';

export interface UserProfile {
  id: string; // Firebase UID
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // <= 1,000,000 bytes
  sha256: string;
  ownerId: string;
  ownerEmail: string;
  category: DocumentCategory;
  description?: string;
  version: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentContent {
  documentId: string;
  content: Buffer;
  size: number;
  sha256: string;
  updatedAt: string;
}

export interface DocumentGrant {
  id: string; // `${documentId}_${userId}`
  documentId: string;
  userId: string;
  userEmail: string;
  permission: GrantPermission;
  grantedBy: string; // userId who granted
  grantedAt: string;
}

export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_FAILED'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_READ_METADATA'
  | 'DOCUMENT_DOWNLOAD'
  | 'DOCUMENT_UPDATE_METADATA'
  | 'DOCUMENT_UPDATE_CONTENT'
  | 'DOCUMENT_DELETE'
  | 'DOCUMENT_RESTORE'
  | 'PERMISSION_GRANT'
  | 'PERMISSION_REVOKE'
  | 'ROLE_CHANGE'
  | 'ACCESS_DENIED'
  | 'UPLOAD_REJECTED'
  | 'AUDIT_INTEGRITY_CHECK'
  | 'ADMIN_ACTION';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILED';

export interface AuditEvent {
  id: string;
  sequence: number;
  timestamp: string;
  actorId: string; // userId or 'ANONYMOUS' or 'SYSTEM'
  actorEmail?: string;
  actorRole?: Role;
  action: AuditAction;
  documentId?: string;
  targetUserId?: string;
  outcome: AuditOutcome;
  requestId: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface AuditHead {
  headId: 'global';
  latestEventId: string;
  latestSequence: number;
  latestHash: string;
  updatedAt: string;
}
