# TrustVault — Enterprise Secure Document Sharing Platform

[![Security: Zero-Trust](https://img.shields.io/badge/Security-Zero--Trust%20Enforced-blue.svg)](#security-principles)
[![Storage: Firestore Bytes Only](https://img.shields.io/badge/Storage-Cloud%20Firestore%20Bytes-orange.svg)](#storage-architecture)
[![Audit: SHA-256 Hash Chained](https://img.shields.io/badge/Audit-Cryptographic%20Hash%20Chain-emerald.svg)](#audit-trail--integrity)

> **TrustVault** is a production-conscious, zero-trust document-sharing platform built for enterprise security, strict confidentiality, and continuous audit integrity.
> Engineered for hiring evaluation, TrustVault demonstrates server-enforced authorization, immediate access revocation, defense against IDOR/BOLA, and tamper-evident audit logging.

---

## 1. Core Security Principles & Architecture

### A. The Backend Authorizes Every Action
The React frontend is never treated as a security boundary. Client-side state, hidden buttons, or token claims are never trusted for authorization.
- Every read, preview, download, edit, deletion, grant, and revocation executes a server-side permission check before any document bytes are touched.
- Firebase Authentication is used to verify **identity** (who the user is); authoritative Firestore records determine **authorization** (what the user can do).

### B. Cloud Firestore as the ONLY Storage Engine
- **No Firebase Storage, no Supabase, no AWS S3, no local filesystem storage, and no Base64 permanent storage.**
- File contents are stored strictly in a separate `documentContents` Firestore collection using binary bytes (`Buffer`).
- Document metadata is stored in `documents` (omitting binary content) to prevent metadata queries from incurring massive bandwidth or memory overhead.
- Strict upload size cap: **1,000,000 bytes** original size (enforced at multipart parser, application layer, and Firestore payload calculation). Oversized uploads are rejected with **HTTP 413 Payload Too Large**.
- File validation examines magic bytes/file signatures (PDF `%PDF`, PNG, JPEG, TXT) to prevent MIME spoofing, path traversal, and executable ingestion.

### C. Immediate Access Revocation
- Permissions are never cached in long-lived JWTs, frontend state, or backend sessions.
- Authorization performs a real-time lookup against `documentGrants/{documentId}_{userId}` on *every protected request*.
- When an owner revokes a grant, access is terminated immediately on the recipient's very next request.

### D. Cryptographic Audit Trail (SHA-256 Hash Chaining)
- Every security-relevant event (authentication, upload, download, metadata change, version edit, grant, revocation, denied access, rejected upload) is recorded in `auditEvents`.
- Uses **canonical JSON serialization** (deterministic key ordering) to guarantee reproducible hashing across platforms.
- Events are linked via `prevHash` and `sequence` into an append-only hash chain anchored at `auditHeads/global`.
- Tampering detection: `GET /api/admin/audit/integrity` verifies continuity, links, and recomputes hashes across the entire chain from genesis.

---

## 2. Roles & Permission Matrix

TrustVault implements three distinct server-enforced roles:

1. **ADMIN**:
   - Manages user accounts and role assignments (`ADMIN`, `OWNER`, `VIEWER`).
   - Inspects global document activity, recent downloads, and permission audit logs.
   - Verifies cryptographic audit chain integrity.
   - **Critical Invariant**: Administrators do NOT automatically gain access to read or download confidential document contents simply by being administrators. Access to document bytes requires an explicit owner grant.
2. **OWNER**:
   - Uploads confidential documents.
   - Full read, edit, delete (soft-delete), and restore authority over owned documents.
   - Grants `READ` or `EDIT` permissions to named existing users.
   - Revokes permissions with immediate effect.
   - Inspects document-specific audit trails.
3. **VIEWER**:
   - Reads metadata and downloads files for which they have an active `READ` or `EDIT` grant.
   - Edits content only if they hold an explicit `EDIT` grant.
   - Cannot delete documents, manage grants, or alter roles.

### Permission Matrix

| Operation | OWNER | VIEWER (READ) | VIEWER (EDIT) | UNAUTHORIZED VIEWER | ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Metadata** | Yes | Yes | Yes | 404 (Enumeration Shield) | Audit Overview Only |
| **Download File Bytes** | Yes | Yes | Yes | 404 | Only if explicitly granted |
| **Upload New Document** | Yes | Yes (owns new doc) | Yes (owns new doc) | Yes (owns new doc) | Yes (owns new doc) |
| **Update Metadata** | Yes | No (403) | Yes | 403 | No (403) |
| **Update Content (New Version)**| Yes | No (403) | Yes | 403 | No (403) |
| **Grant / Revoke Permissions** | Yes | No (403) | No (403) | 403 | No (403) |
| **Soft Delete / Restore** | Yes | No (403) | No (403) | 403 | No (403) |
| **View Document Audit** | Yes | No (403) | No (403) | 403 | Yes (Compliance oversight) |
| **Manage User Roles** | No (403) | No (403) | No (403) | 403 | Yes |
| **Verify Audit Hash Chain** | No (403) | No (403) | No (403) | 403 | Yes |

---

## 3. Tech Stack

- **Frontend**: React 19, Vite, TypeScript, React Router 7, Tailwind CSS, Lucide React icons.
- **Backend**: Node.js 22+, Express 4, TypeScript, Firebase Admin SDK, Zod, Multer (memory storage with 1MB hard cap), Helmet, CORS, Express-Rate-Limit.
- **Database & Binary Storage**: Google Cloud Firestore (collections: `documents`, `documentContents`, `documentGrants`, `users`, `auditEvents`, `auditHeads`).
- **Security Testing**: Vitest 3, Supertest, automated mutation test suite.

---

## 4. Quick Start & Local Development

### Prerequisites
- Node.js 20+ (Node 22 or 24 recommended)
- npm 10+
- (Optional for live GCP emulator) Java 17+ and Firebase CLI. *Note: If Java or the emulator is not present, TrustVault automatically uses its built-in in-memory Firestore engine for instant local development and test execution without external daemon prerequisites.*

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd TRUST

# Install dependencies across all workspaces
npm install
```

### Environment Configuration
Copy the example configuration:
```bash
cp .env.example .env
```
Default environment variables:
```ini
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FIREBASE_PROJECT_ID=trustvault-dev
USE_EMULATOR=true
```

### Database Seeding
Seed the database with pre-configured demo personas, confidential documents, and initial grants:
```bash
npm run seed
```
This provisions:
- **Admin**: `admin@trustvault.local` (Role: `ADMIN`)
- **Owner**: `owner@trustvault.local` (Elena Rostova, Role: `OWNER`)
- **Viewer**: `viewer@trustvault.local` (Marcus Chen, Role: `VIEWER`)
- Initial documents: Financial Audit PDF, Confidential Legal Contract TXT, Zero-Trust Architecture PNG.

### Running the Application
Start both the backend API (port 5000) and frontend dashboard (port 5173) concurrently:
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 5. Automated Security & Mutation Testing

Testing is a core deliverable. Run the full test suite with:
```bash
npm test
```

### Test Coverage Highlights:
- **Authentication**: Unauthenticated requests fail (401); client-supplied actor IDs and roles in headers/bodies are strictly ignored.
- **Cross-User Isolation & IDOR**: Unauthorized viewers guessing document IDs receive HTTP 404 (preventing enumeration); unauthorized downloads fail.
- **Administrative Boundaries**: Proves administrators cannot download confidential documents without an explicit grant.
- **Immediate Access Revocation**: Proves that after an owner calls revoke, the viewer's immediate next download request is rejected.
- **Storage Limits & MIME Spoofing**: Files > 1,000,000 bytes rejected with HTTP 413; PDF disguised as `.png` rejected with 422; executable `.exe` rejected.
- **Audit Hash Chaining**: Verifies continuous sequence and prevHash linking; proves that altering a database record breaks chain verification.
- **Mutation Testing (`server/src/tests/mutation.test.ts`)**: Systematically bypasses the authorization check to demonstrate that the security test detects and flags the vulnerability.

---

## 6. Five-Minute Hiring Evaluation Demo Script

Follow this script to evaluate all core security requirements in under 5 minutes:

1. **Step 1: Sign in as Document Owner (Elena Rostova)**
   - Navigate to `http://localhost:5173/login`.
   - Click **Elena Rostova (Document Owner)**.
   - Notice the **OWNER** badge in the navigation bar.
2. **Step 2: Upload a Confidential Document**
   - Click **Upload Document**.
   - Select a sample PDF or TXT file (<= 1MB). Set Title to `"2026 M&A Due Diligence"` and Category to `CONFIDENTIAL`.
   - Click **Upload & Secure Document**.
   - Inspect the technical attributes: notice the SHA-256 content hash, version 1, and confirmation of byte storage in `documentContents`.
3. **Step 3: Test Immediate Cross-User Isolation (IDOR Prevention)**
   - Copy the document URL (e.g. `/documents/doc_...`).
   - Use the Role Switcher in the top navbar to switch to **Marcus Chen (Auditor - VIEWER)**.
   - Attempt to navigate to the document URL or find it in **Shared With Me**.
   - The document is invisible and returns **404 Document Not Found**, preventing metadata or byte discovery!
4. **Step 4: Grant Access**
   - Switch back to **Elena Rostova (OWNER)**.
   - On the document page, click **Manage Permissions**.
   - Select **Marcus Chen** from the user dropdown and assign **READ** permission. Click **Grant Permission**.
   - Marcus now appears in the active grants list.
5. **Step 5: Verify Authorized Access**
   - Switch back to **Marcus Chen (VIEWER)**.
   - Navigate to **Shared With Me**: the document is now visible with a `READ ACCESS` badge.
   - Click **Download**: the file bytes download successfully.
6. **Step 6: Test Immediate Revocation**
   - Switch back to **Elena Rostova (OWNER)**.
   - In **Manage Permissions**, click **Revoke** next to Marcus Chen and confirm.
   - Switch immediately to **Marcus Chen (VIEWER)**.
   - Click **Download** or refresh: access is instantly denied with 404!
7. **Step 7: Verify Admin Governance & Hash Chain Integrity**
   - Switch to **Security Administrator (ADMIN)**.
   - Navigate to **Audit Trail & Integrity**.
   - Observe the real-time security events (Upload, Grant, Download, Revoke, Access Denied).
   - Click **Verify Cryptographic Integrity**: watch the system recalculate SHA-256 hashes across the chain from genesis and verify 100% chain validity!

---

## 7. Production Deployment Guide

### A. Deploy Frontend to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

### B. Deploy Backend to Google Cloud Run
Build the container and deploy to Cloud Run with Firestore integration:
```bash
gcloud run deploy trustvault-api \
  --source ./server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=<your-gcp-project-id>
```

### C. Deploy Production Security Rules
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 8. Architecture Decisions, Limitations & Unfinished Work

### Security Decisions
1. **Firestore Bytes Containment**:
   - Rather than relying on Firebase Storage (which uses public download URLs and bearer tokens), document contents are stored strictly as binary fields inside Firestore `documentContents`.
   - Access to Firestore is completely closed to browsers via `firestore.rules` (`allow read, write: if false;`), forcing every request through the Express API gateway where authorization policies run on every transaction.
2. **Canonical Hash Chaining**:
   - Rather than naive `JSON.stringify`, TrustVault recursively sorts object keys lexicographically before computing SHA-256 hashes, preventing false-positive integrity alarms due to key order variations.
3. **Enumeration Resistance**:
   - Unauthorized document queries return HTTP 404 instead of 403 to prevent attackers from determining whether a secret document ID exists.

### Known Limitations
1. **1 MiB Database Document Envelope**:
   - Cloud Firestore limits individual documents to 1,048,576 bytes. TrustVault enforces a strict 1,000,000-byte cap on uploaded files to ensure document metadata and binary contents fit safely within Firestore constraints.
2. **Post-Download Physical Containment**:
   - Once an authorized user downloads file bytes to their local storage, server-side revocation cannot erase bytes already present on the client disk.
3. **Audit Chain Trust Boundary**:
   - While the hash chain prevents application-layer tampering, a compromised cloud root service account could theoretically recalculate hashes from genesis. Production hardening should anchor head hashes into an immutable external log (e.g., Certificate Transparency style ledger or Google Cloud Key Access Justifications).
