# TrustVault — REST API Specification (`API.md`)

TrustVault implements a zero-trust, server-authorized REST API designed for high-assurance confidential document sharing.

## Base URL & General Conventions
- Default Base URL: `http://localhost:5000/api`
- All protected endpoints require a Bearer token in the `Authorization` header: `Authorization: Bearer <token>`
- Correlation Request ID: Pass optional `X-Request-Id: <uuid>`, or the server automatically assigns one.
- Content Type: `application/json` (except multipart upload/update endpoints which use `multipart/form-data`).
- Error Responses adhere to RFC 7807 Problem Details.

---

## Permission Matrix

| Role / Privilege | View Metadata | Download File Bytes | Upload Document | Edit Metadata | Edit Content | Manage Grants (ACL) | Soft-Delete / Restore | View Document Audit | Verify Audit Chain | Manage User Roles |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **DOCUMENT OWNER** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No* | No |
| **VIEWER (with READ grant)** | Yes | Yes | No | No | No | No | No | No | No | No |
| **VIEWER (with EDIT grant)** | Yes | Yes | No | Yes | Yes | No | No | No | No | No |
| **UNAUTHORIZED VIEWER** | 404** | 404** | No | 403 | 403 | 403 | 403 | 403 | No | No |
| **ADMINISTRATOR** | Only if granted / Compliance Overview | Only if granted | No | Only if granted | Only if granted | No | No | Yes (Global Audit) | Yes | Yes |

*\* Administrators verify system-wide audit integrity via `/api/admin/audit/integrity`.*  
*\*\* Returns HTTP 404 rather than 403 to prevent document existence enumeration by unauthorized callers.*

---

## 1. Authentication & System Endpoints

### `GET /api/health`
Health check endpoint.
- **Auth**: None
- **Response 200**:
```json
{
  "status": "UP",
  "service": "TrustVault API Gateway",
  "version": "1.0.0",
  "timestamp": "2026-10-20T09:30:00.000Z"
}
```

### `GET /api/me`
Retrieves current authenticated user profile and authoritative server-side role.
- **Auth**: Required (`Bearer <token>`)
- **Response 200**:
```json
{
  "user": {
    "id": "user_owner_001",
    "email": "owner@trustvault.local",
    "displayName": "Elena Rostova",
    "role": "OWNER",
    "createdAt": "2026-10-20T09:00:00.000Z",
    "updatedAt": "2026-10-20T09:00:00.000Z"
  }
}
```

### `GET /api/users`
Lists registered users in the directory for permission granting.
- **Auth**: Required (`Bearer <token>`)
- **Response 200**: Array of user summaries (ID, email, name, role).

---

## 2. Document Operations

### `POST /api/documents`
Uploads a confidential document. Stores metadata in `documents` and binary content in `documentContents`.
- **Auth**: Required (`Bearer <token>`)
- **Content-Type**: `multipart/form-data`
- **Payload**:
  - `file`: Binary file (PDF, PNG, JPG, JPEG, TXT; max 1,000,000 bytes)
  - `title`: String (1-120 chars)
  - `category`: Enum (`FINANCIAL`, `LEGAL`, `ENGINEERING`, `HR`, `CONFIDENTIAL`, `GENERAL`)
  - `description`: Optional String (max 500 chars)
- **Response 201**:
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "id": "doc_123456",
    "title": "Quarterly Financial Audit",
    "filename": "audit.pdf",
    "originalName": "audit.pdf",
    "mimeType": "application/pdf",
    "size": 48291,
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "ownerId": "user_owner_001",
    "ownerEmail": "owner@trustvault.local",
    "category": "FINANCIAL",
    "description": "Audited balance sheet",
    "version": 1,
    "isDeleted": false,
    "createdAt": "2026-10-20T09:10:00.000Z",
    "updatedAt": "2026-10-20T09:10:00.000Z"
  }
}
```
- **Error 413**: File exceeds 1,000,000 bytes.
- **Error 422**: MIME spoofing or unsafe file signature detected.

### `GET /api/documents`
Lists documents visible to caller with server-side filtering.
- **Auth**: Required
- **Query Params**:
  - `tab`: `my` (owned), `shared` (granted), `all` (compliance admin)
  - `category`: Category filter
  - `search`: Case-insensitive title/filename search
  - `limit`: Default 20, max 100
  - `offset`: Default 0
- **Response 200**: `{ "documents": [...], "pagination": { "total": 12, "hasMore": false } }`

### `GET /api/documents/:id`
Retrieves metadata of an authorized document.
- **Auth**: Required
- **Response 200**: Document metadata + caller's authorization level (`isOwner`, `userGrant`).
- **Error 404**: Document does not exist OR caller is not authorized (enumeration-resistant).

### `GET /api/documents/:id/download`
Downloads authorized binary file bytes directly from Firestore `documentContents`.
- **Auth**: Required (re-verified on every single download request).
- **Headers Returned**:
  - `Content-Type`: `<mimeType>`
  - `Content-Disposition`: `attachment; filename="<sanitizedFilename>"`
  - `X-Content-Type-Options`: `nosniff`
  - `Cache-Control`: `private, no-cache, no-store, must-revalidate`
- **Response 200**: Binary stream (`Buffer`).
- **Error 404**: Unauthorized caller or file not found.

### `PATCH /api/documents/:id`
Updates document metadata (Title, Category, Description).
- **Auth**: Required (Owner or EDIT grant holder).
- **Body**: `{ "title": "New Title", "category": "LEGAL", "description": "Updated notes" }`
- **Response 200**: Updated document metadata.
- **Error 403**: Forbidden (caller has only READ or no permission).

### `PUT /api/documents/:id/content`
Uploads a new binary version for the document. Increments `version`, recomputes SHA-256, updates Firestore `documentContents`.
- **Auth**: Required (Owner or EDIT grant holder).
- **Content-Type**: `multipart/form-data` (`file`)
- **Response 200**: `{ "message": "Document content updated successfully", "version": 2 }`

### `DELETE /api/documents/:id`
Soft-deletes a document.
- **Auth**: Required (Document Owner ONLY).
- **Response 200**: `{ "message": "Document soft-deleted successfully" }`
- **Error 403**: Caller is not document owner.

### `POST /api/documents/:id/restore`
Restores a soft-deleted document.
- **Auth**: Required (Document Owner ONLY).
- **Response 200**: `{ "message": "Document restored successfully" }`

### `GET /api/documents/:id/audit`
Retrieves activity log for this specific document.
- **Auth**: Required (Document Owner or Compliance Admin).
- **Response 200**: Array of audit events.

---

## 3. Permission & ACL Endpoints

### `GET /api/documents/:id/grants`
Lists active permission grants on the document.
- **Auth**: Required (Document Owner or Admin).
- **Response 200**: Array of `{ "id", "documentId", "userId", "userEmail", "permission", "grantedAt" }`.

### `POST /api/documents/:id/grants`
Grants `READ` or `EDIT` permission to a named user.
- **Auth**: Required (Document Owner ONLY).
- **Body**: `{ "targetUserId": "user_viewer_001", "permission": "READ" }`
- **Response 201**: Created grant record.

### `DELETE /api/documents/:id/grants/:userId`
Revokes an existing user's grant. Takes effect immediately on the next protected request.
- **Auth**: Required (Document Owner ONLY).
- **Response 200**: `{ "message": "Permission revoked successfully. Access terminates immediately." }`

---

## 4. Administration & Governance Endpoints

### `GET /api/admin/users`
Lists all users for administrative role governance.
- **Auth**: Required (`ADMIN` role strictly enforced on server).
- **Response 200**: Array of user profiles.

### `PATCH /api/admin/users/:userId/role`
Updates a user's role (`ADMIN`, `OWNER`, `VIEWER`).
- **Auth**: Required (`ADMIN` role strictly enforced).
- **Body**: `{ "role": "OWNER" }`
- **Response 200**: Confirmation of role mutation.
- **Error 400**: Self-demotion rejected (prevents lockout).

### `GET /api/admin/audit`
Queries global security audit trail with filters.
- **Auth**: Required (`ADMIN` role).
- **Query Params**: `action`, `actorId`, `outcome`, `limit`, `offset`.
- **Response 200**: Array of audit events with pagination.

### `GET /api/admin/audit/integrity`
Re-computes and cryptographically verifies the SHA-256 hash chain across all audit events from genesis.
- **Auth**: Required (`ADMIN` role).
- **Response 200**:
```json
{
  "integrity": {
    "isValid": true,
    "totalEvents": 48,
    "lastSequence": 48,
    "lastHash": "7f8b9a1e4c3d2..."
  }
}
```
If tampered:
```json
{
  "integrity": {
    "isValid": false,
    "totalEvents": 48,
    "error": "Hash mismatch at sequence 12: event content has been tampered with."
  }
}
```

### `GET /api/admin/stats`
Aggregates security metrics: downloads, grants, revocations, denied attempts, failed uploads.
- **Auth**: Required (`ADMIN` role).
- **Response 200**: Security statistics object.
