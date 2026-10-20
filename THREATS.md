# TrustVault — Threat Model & Security Architecture (`THREATS.md`)

## 1. Executive Summary & Security Objectives
TrustVault is an enterprise-grade secure document-sharing platform engineered to ensure strict confidentiality, server-enforced authorization, non-repudiation via tamper-evident audit logging, and defense-in-depth against data exfiltration.

The fundamental security invariant is:
> **The backend, not React or the client, authorizes every single access to metadata, content, and permissions.**
> **Administrators never automatically inherit access to confidential document contents.**
> **Access revocation is immediate upon the very next request.**

---

## 2. Assets and Trust Boundaries

### 2.1 Primary Assets
1. **Document Binary Contents**: Confidential files stored exclusively in Firestore `documentContents/{documentId}` as raw bytes fields (`Buffer`). Max upload size: 1,000,000 bytes.
2. **Document Metadata**: Filename, size, MIME type, owner ID, category, creation/modification timestamps in `documents/{documentId}`.
3. **Document Grants**: Access control lists in `documentGrants/{documentId_userId}` defining `READ` or `EDIT` privileges.
4. **User Identities & Roles**: Profiles and role assignments (`ADMIN`, `OWNER`, `VIEWER`) in `users/{userId}`.
5. **Audit Trail**: Append-only log of security and data-access events in `auditEvents/{eventId}` and chain checkpoint pointers in `auditHeads/global`.

### 2.2 Trust Boundaries
- **Boundary 1: Untrusted Browser Client vs. Express API Gateway**:
  Any HTTP request from a browser is treated as hostile. No client-asserted identity or client-cached permissions are trusted.
- **Boundary 2: Authentication (Firebase Auth) vs. Authorization (TrustVault Policy Engine)**:
  A valid Firebase ID token verifies *identity* (who the user is), but grants *zero* document access by itself. Authorization is computed dynamically from authoritative Firestore records.
- **Boundary 3: Direct Client Access vs. Firestore Database**:
  Direct client SDK access to Firestore is completely disabled via `firestore.rules`. Only the backend Express service (using Firebase Admin SDK) interacts with Firestore.
- **Boundary 4: System Administration vs. Confidential Document Content**:
  Platform administrators (`ADMIN` role) can administer user accounts and view audit logs, but cannot read or download document contents unless explicitly granted permission by the document owner.

---

## 3. Threat Actors and Capabilities

| Actor Profile | Description | Capabilities / Vectors |
| :--- | :--- | :--- |
| **Unauthenticated External Attacker** | Internet actor probing the public endpoint. | Exploiting exposed API routes, port scanning, brute-forcing IDs, path traversal, DOS attacks. |
| **Malicious Authenticated Viewer** | Valid user with a VIEWER role attempting to access unauthorized files. | IDOR/BOLA attacks, parameter tampering, requesting revoked documents, sniffing download tokens, modifying metadata. |
| **Malicious Authenticated Owner** | Valid document owner attempting privilege escalation or cross-tenant harm. | Elevating role to ADMIN, uploading malware, attempting file size bypass (>1MB), forging audit trails. |
| **Rogue or Compromised Administrator** | Privileged user with ADMIN role trying to snoop on confidential files. | Bypassing document read controls, deleting audit records, altering user roles, impersonating users. |
| **Compensated Man-in-the-Middle (MitM)** | Network adversary eavesdropping or tampering with in-flight data. | Replaying tokens, tampering with multipart payloads, sniffing download streams. |

---

## 4. Threat Matrix, Mitigations, and Automated Test Mapping

| Threat ID | Threat Category | Threat Scenario | Implemented Mitigation | Automated Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **TH-01** | **IDOR / BOLA** | User B attempts to view or download User A's document by guessing `documentId` in `GET /api/documents/:id`. | Dynamic server-side lookup checking ownership or explicit `documentGrants`. Unauthorized requests return HTTP 404 (preventing ID enumeration) or 403. | `security.test.ts` -> Cross-user isolation test suite |
| **TH-02** | **Admin Bypass** | User with `ADMIN` role attempts to read/download a confidential document without an explicit grant. | Authorization engine explicitly enforces that `ADMIN` role does NOT bypass document access controls. Denied with HTTP 403. | `security.test.ts` -> Admin boundary tests |
| **TH-03** | **Stale Permission / Revocation Race** | User has READ access revoked, but attempts to download using an open browser tab or cached token. | Authorization verifies current Firestore state on *every* request. Revocations are atomic. Next request fails immediately. | `security.test.ts` -> Immediate revocation tests |
| **TH-04** | **Privilege Escalation** | User submits `PATCH /api/admin/users/:id/role` or includes `role: "ADMIN"` in profile/registration requests. | Role mutation is restricted to authenticated `ADMIN` users only. Self-role modification is rejected. Role fields in regular requests are ignored. | `security.test.ts` -> Role privilege escalation tests |
| **TH-05** | **Direct Database Access** | Client uses Firebase Web SDK with valid ID token to directly read `documentContents` or `auditEvents`. | `firestore.rules` enforces `allow read, write: if false;` on all protected collections for client SDKs. Only Admin SDK bypasses rules. | `rules.test.ts` -> Firestore security rules test suite |
| **TH-06** | **MIME Spoofing & Malicious Uploads** | Attacker uploads `exploit.php` or `script.html` with spoofed `Content-Type: image/png`. | Server examines magic numbers/signatures (PDF `%PDF`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`). Disallowed types are rejected with 422/400. | `security.test.ts` -> MIME validation & magic byte tests |
| **TH-07** | **Oversized Upload / DoS** | Attacker uploads > 1,000,000 byte file to exhaust Firestore 1 MiB limit or server memory. | 3-tier validation: 1) Multer multipart parser limit (1MB), 2) App-level buffer size check, 3) Firestore payload calculation. Rejects with HTTP 413. | `security.test.ts` -> Upload size limit 413 tests |
| **TH-08** | **XSS & Content Confusion via Download** | User uploads malicious SVG or HTML; browser executes scripts when downloading or previewing. | Downloads set `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and sanitized MIME types. Content is never rendered as raw inline HTML. | `security.test.ts` -> Download headers security tests |
| **TH-09** | **Audit Trail Tampering** | Attacker or rogue admin attempts to delete or alter historical audit log entries to cover tracks. | Cryptographic SHA-256 hash chaining with canonical serialization. Each event hashes `prevHash + canonical(eventData)`. Tampering breaks chain integrity verification (`GET /api/admin/audit/integrity`). | `security.test.ts` -> Audit chain integrity & tampering detection tests |
| **TH-10** | **Audit-Write Failure Silent Pass** | API performs document deletion or grant mutation, but audit write fails due to Firestore error. | Atomic Firestore transactions combine state mutation with audit event and head pointer progression. If audit fails, entire operation rolls back. | `security.test.ts` -> Transactional rollback tests |
| **TH-11** | **Information Disclosure in Errors** | Attacker sends malformed queries to trigger database stack traces or reveal internal paths. | Centralized error handler catches all exceptions, logs detailed context securely on server, and returns sanitized RFC 7807 problem details to client. | `security.test.ts` -> Error sanitization tests |
| **TH-12** | **Brute Force & Enumeration** | Attacker enumerates sequential or UUID document IDs to detect valid documents. | Nanoid/UUIDv4 identifiers; unauthorized document queries return HTTP 404 (Not Found) rather than 403 (Forbidden), revealing zero metadata existence. | `security.test.ts` -> Timing & enumeration resistance |

---

## 5. Accepted Residual Risks & Limitations

1. **Existing Downloaded Copies**:
   - *Risk*: Once a user with legitimate READ access downloads a document onto their local machine, server-side revocation cannot revoke or erase physical bytes already stored on the user's endpoint.
   - *Rationale*: Client-side physical containment is fundamentally outside web application scope without invasive OS-level enterprise DRM software.
2. **Host / Root Cloud Compromise**:
   - *Risk*: A rogue engineer with root access to the Google Cloud Console / Firebase Project service account keys could rewrite Firestore collections and re-calculate the SHA-256 hash chain from genesis.
   - *Rationale*: The hash chain guarantees *tamper-evidence* against application-layer compromise and insider manipulation within the app, but not against root cloud infrastructure compromise.
3. **Firestore Document Size Limit (1 MiB)**:
   - *Risk*: Firestore imposes a strict 1,048,576-byte maximum limit per document.
   - *Mitigation*: TrustVault enforces a strict 1,000,000-byte cap on file uploads. When combined with document field overhead, total document size remains well within the 1 MiB envelope.

---

## 6. Production Hardening Recommendations

1. **External Audit Anchoring**:
   - Periodically anchor the latest `auditHeads` hash into an immutable append-only ledger or external public blockchain / RFC 6962 Certificate Transparency style log.
2. **KMS Envelope Encryption**:
   - Encrypt file bytes in memory using Google Cloud KMS customer-managed encryption keys (CMEK) before storing into Firestore `documentContents`.
3. **Cloud Armor & WAF**:
   - Protect Google Cloud Run endpoints with Cloud Armor rate-limiting and DDoS protection rules.
4. **Content Disarm & Reconstruction (CDR) / Virus Scanning**:
   - Connect file uploads to a background asynchronous Cloud Function running ClamAV or Google Cloud Web Risk API to detect embedded zero-days in PDFs and images.
