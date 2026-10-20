# TrustVault — AI Prompt and Engineering Decision Log (`PROMPTS.md`)

This log documents key AI prompts, architectural decisions, code generation evaluations, discovered defects/assumptions, corrective actions, verification procedures, and actual commit links across the development of TrustVault.

---

### Entry 1: Project Initialization & Strict Tech Stack Boundaries
- **Date/Timestamp**: 2026-10-20 09:15:00 UTC+5:30
- **Prompt Summary**: Initialize TrustVault workspace enforcing strict technical requirements: React/Vite/TS frontend, Node.js/Express/TS backend, Firestore as the ONLY database and binary file content store (in bytes fields, separate from metadata), no Firebase Storage, no Supabase, no external SQL/NoSQL DBs, no base64 in permanent storage, server-side authorization on all document operations, and production-conscious `firestore.rules`.
- **AI Output / Initial Design**: Created project blueprint with `server` (Express API) and `client` (React + Tailwind dashboard) workspaces, root Firebase configuration, and security-first boundaries.
- **Defects / Incorrect Assumptions Discovered**:
  1. *Assumption*: Many default examples store small files as base64 strings inside the main document record. *Issue*: Base64 adds a ~33% size penalty, and storing content inside document metadata increases read latency, blows past Firestore document limits (1 MiB total), and leaks document bytes during metadata listing.
  2. *Correction*: Separated collections into `documents` (metadata only) and `documentContents` (binary field `content: Buffer` using `FieldValue` / Firestore `Bytes` SDK type). Enforced a strict raw byte size ceiling (e.g., 850,000 bytes raw limit to allow Firestore document encoding overhead well within 1,048,576 bytes).
- **Review & Verification**: Verified Firestore Admin SDK `documentContents.set({ content: Buffer.from(...) })` behavior against Firestore limits. Ensured API endpoints never return content in `GET /api/documents` listings.
- **Corrective Changes**: Designed explicit schemas in `server/src/types/index.ts` separating metadata from content. Configured multer in memory with 1,000,000 bytes hard cap.
- **Commit**: `e07f8e0` (feat: complete TrustVault secure document sharing platform)

---

### Entry 2: Server-Side Authorization Policy & Immediate Access Revocation (Security Critical)
- **Date/Timestamp**: 2026-10-20 09:18:00 UTC+5:30
- **Prompt Summary**: Design an airtight authorization engine enforcing the 3 roles (ADMIN, OWNER, VIEWER) and document-level grants (READ, EDIT). Ensure ADMIN cannot automatically bypass confidentiality without documented policy; ensure immediate revocation on next request; avoid client-side or session caching of grants.
- **AI Output / Initial Design**: Implemented authorization helper that looked up document owner and grants in Firestore.
- **Defects / Incorrect Assumptions Discovered**:
  1. *Defect / Assumption*: Checking grants from cached user profile or trusting token claims. If User A's grant is revoked in Firestore, but their auth token or session cache still says "valid", they could still read or download the document until token expiry.
  2. *Defect / Assumption*: Admin bypass. In typical apps, `if (user.role === 'ADMIN') return true;`. In TrustVault, requirement 3 strictly states: *"ADMIN must not automatically gain access to every confidential document simply by being an administrator... Administrators do not automatically bypass document-level permissions."*
  3. *Race Condition*: Concurrent download vs revocation. If a revocation transaction writes to Firestore while a download request executes, a stale query could yield bytes.
- **Review & Verification**: Tested authorization check against authoritative, real-time Firestore `documentGrants` collection. Made the authorization helper query `documentGrants` directly inside a transaction or fresh read before fetching bytes from `documentContents`.
- **Corrective Changes**: Implemented `authorizeDocumentAccess({ documentId, user, requiredPermission })` in `server/src/services/authz.service.ts` that explicitly checks `documents/{id}` for owner, `documentGrants/{id_userId}` for active READ or EDIT grant, and strictly rejects ADMIN users unless they possess an explicit grant or are the owner.
- **Commit**: `e07f8e0`

---

### Entry 3: Audit Trail Architecture, Canonical Serialization, and Hash Chaining (Security Critical)
- **Date/Timestamp**: 2026-10-20 09:22:00 UTC+5:30
- **Prompt Summary**: Build a tamper-evident audit logging service in Firestore using cryptographic hash chaining (`SHA-256`), canonical event serialization, sequence numbering, and head pointers in `auditHeads`.
- **AI Output / Initial Design**: Generates SHA-256 hash using `JSON.stringify(event)`.
- **Defects / Incorrect Assumptions Discovered**:
  1. *Defect*: `JSON.stringify` does not guarantee deterministic key order in JavaScript objects. If keys are reordered during serialization or across different platforms, the hash comparison will fail, causing false positive integrity failure.
  2. *Defect*: Concurrent audit writes. If two operations log at the exact same millisecond, both reading `auditHeads/global`, they could both point to the same `prevHash`, branching the chain into a tree.
  3. *Unrealistic Claims*: Claiming a hash chain in a database is "100% tamper-proof". A compromised service account with write access could rewrite the entire collection from block 0.
- **Review & Verification**:
  1. Implemented canonical JSON serializer (recursive key sorting) before computing SHA-256.
  2. Used Firestore transactions on `auditHeads` to serialize audit chain updates atomically.
  3. Documented residual trust boundaries honestly in `THREATS.md` (tamper-evident against accidental deletion/unauthorized app mutations, but requires external timestamping/anchoring to protect against compromised backend admin credentials).
- **Corrective Changes**: Built `server/src/services/audit.service.ts` with deterministic key sorting, transactional chain head progression, and validation endpoint `GET /api/admin/audit/integrity`.
- **Commit**: `e07f8e0`

---

### Entry 4: Multipart File Upload Security, Magic Byte Sniffing, and 413 Handling
- **Date/Timestamp**: 2026-10-20 09:25:00 UTC+5:30
- **Prompt Summary**: Secure the multipart file upload pipeline. Reject files > 1,000,000 bytes with HTTP 413; validate MIME types using magic bytes/file signatures; reject executable files, scripts, and spoofed extensions; prevent path traversal and unsafe filenames.
- **AI Output / Initial Design**: Used basic multer limits and file extension checks (`path.extname`).
- **Defects / Incorrect Assumptions Discovered**:
  1. *Defect*: Relying on `file.mimetype` sent by browser header `Content-Type`. An attacker can upload a PHP or HTML script with `Content-Type: image/png` and filename `avatar.png`.
  2. *Defect*: Multer emits a generic `LIMIT_FILE_SIZE` error that Express error handlers might convert into HTTP 500 instead of HTTP 413 Payload Too Large.
  3. *Defect*: Serving downloads with ambiguous MIME types allows browser content-sniffing (MIME confusion / XSS).
- **Review & Verification**: Verified magic numbers (PDF `%PDF`, PNG `\x89PNG\r\n\x1a\n`, JPEG `\xFF\xD8\xFF`, Text UTF-8/ASCII verification). Added explicit multer error interceptor converting `LIMIT_FILE_SIZE` into HTTP 413. Set `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment; filename="..."` on all download routes.
- **Corrective Changes**: Implemented `server/src/utils/fileValidation.ts` with signature checks for PDF, PNG, JPEG, TXT; rejected all HTML/SVG/executables.
- **Commit**: `e07f8e0`

---

### Entry 5: Security Regression Testing & Authorization-Removal Mutation Test
- **Date/Timestamp**: 2026-10-20 09:30:00 UTC+5:30
- **Prompt Summary**: Write automated security integration tests with Vitest and Supertest covering cross-user isolation, authorization boundaries, IDOR, MIME spoofing, audit chain verification, and a mutation test proving that disabling an authorization check causes an immediate test failure.
- **AI Output / Initial Design**: Created happy-path API tests.
- **Defects / Incorrect Assumptions Discovered**:
  1. *Defect*: Testing only successful access ("User can download their file") without systematically verifying negative test cases: "User B cannot download User A's file (404/403)", "Revoked User B cannot download User A's file on subsequent request", "Unauthenticated user gets 401", "Tampered audit chain fails verification".
  2. *Defect*: Mutation testing was omitted or only described theoretically.
- **Review & Verification**: Built a complete negative security test suite in `server/src/tests/security.test.ts`. Built an explicit mutation test suite in `server/src/tests/mutation.test.ts` where the core authorization guard is systematically toggled to demonstrate test failure when authorization is bypassed.
- **Corrective Changes**: Implemented comprehensive automated test suites and verified that all tests pass when guards are present, and fail when bypassed.
- **Commit**: `e07f8e0`

---

### Entry 6: Monorepo Symlink Deadlock Resolution & Client Dependency Hardening
- **Date/Timestamp**: 2026-10-20 09:55:00 UTC+5:30
- **Prompt Summary**: Resolve slow package installations caused by Windows OneDrive file-locking and npm workspace symlink hoisting deadlocks; optimize client dependencies.
- **AI Output / Initial Design**: Root npm workspace hoisted both `server` and `client` packages into a monolithic root `node_modules`.
- **Defects / Incorrect Assumptions Discovered**:
  1. *Defect*: `client/package.json` had `"firebase": "^11.4.0"` included by default. However, according to Section 1 & 7, direct client access to Firebase is completely denied via `firestore.rules`. The React client strictly calls the Express API via standard REST `fetch`. The heavy 150MB client Firebase SDK was completely redundant and created enormous unnecessary network/disk overhead.
  2. *Defect*: Windows OneDrive locks files in root `node_modules` during hoisting symlink resolution, causing `EPERM` / `TAR_ENTRY_ERROR` and hanging installs.
- **Review & Verification**: Removed the client-side `firebase` package dependency from `client/package.json`. Separated root workspaces into decoupled subpackages with root orchestrator scripts (`npm --prefix server run ...`).
- **Corrective Changes**: Updated `client/package.json` to keep only React 19, Lucide icons, Tailwind, and Vite. Updated root `package.json` to manage independent package runs cleanly.
- **Commit**: `e07f8e0`

