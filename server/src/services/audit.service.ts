import { v4 as uuidv4 } from 'uuid';
import { getFirestoreDb } from '../db/firestore.js';
import { AuditAction, AuditEvent, AuditHead, AuditOutcome, Role } from '../types/index.js';
import { computeAuditEventHash, GENESIS_HASH } from '../utils/crypto.js';

export interface LogAuditParams {
  actorId: string;
  actorEmail?: string;
  actorRole?: Role;
  action: AuditAction;
  outcome: AuditOutcome;
  requestId: string;
  documentId?: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Appends an audit event to the cryptographic hash chain using a Firestore transaction.
   * Ensures atomic sequence increments and head pointer updates.
   */
  static async logEvent(params: LogAuditParams, existingTransaction?: any): Promise<AuditEvent> {
    const db = getFirestoreDb();
    const eventId = `audit_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const executeInTransaction = async (tx: any) => {
      const headRef = db.collection('auditHeads').doc('global');
      const headDoc = await tx.get(headRef);

      let prevHash = GENESIS_HASH;
      let nextSequence = 1;

      if (headDoc.exists) {
        const headData = headDoc.data() as AuditHead;
        prevHash = headData.latestHash || GENESIS_HASH;
        nextSequence = (headData.latestSequence || 0) + 1;
      }

      const eventPayloadWithoutHash = {
        id: eventId,
        sequence: nextSequence,
        timestamp,
        actorId: params.actorId || 'UNAUTHENTICATED',
        actorEmail: params.actorEmail || undefined,
        actorRole: params.actorRole || undefined,
        action: params.action,
        documentId: params.documentId || undefined,
        targetUserId: params.targetUserId || undefined,
        outcome: params.outcome,
        requestId: params.requestId,
        ip: params.ip || undefined,
        userAgent: params.userAgent || undefined,
        details: params.details || {},
        prevHash
      };

      const eventHash = computeAuditEventHash(prevHash, nextSequence, eventPayloadWithoutHash);

      const completeEvent: AuditEvent = {
        ...eventPayloadWithoutHash,
        hash: eventHash
      };

      const eventRef = db.collection('auditEvents').doc(eventId);
      tx.set(eventRef, completeEvent);

      tx.set(headRef, {
        headId: 'global',
        latestEventId: eventId,
        latestSequence: nextSequence,
        latestHash: eventHash,
        updatedAt: timestamp
      });

      return completeEvent;
    };

    if (existingTransaction) {
      return executeInTransaction(existingTransaction);
    } else {
      return db.runTransaction(executeInTransaction);
    }
  }

  /**
   * Verifies the entire audit trail integrity by re-computing every hash,
   * checking sequence continuity, and validating head pointers.
   */
  static async verifyAuditIntegrity(): Promise<{
    isValid: boolean;
    totalEvents: number;
    error?: string;
    lastSequence?: number;
    lastHash?: string;
  }> {
    const db = getFirestoreDb();
    const headDoc = await db.collection('auditHeads').doc('global').get();

    if (!headDoc.exists) {
      // Check if there are any events at all
      const snapshot = await db.collection('auditEvents').limit(1).get();
      if (snapshot.empty) {
        return { isValid: true, totalEvents: 0, lastSequence: 0, lastHash: GENESIS_HASH };
      }
      return {
        isValid: false,
        totalEvents: snapshot.size,
        error: 'Audit chain head pointer is missing while audit events exist.'
      };
    }

    const headData = headDoc.data() as AuditHead;

    const eventsSnapshot = await db
      .collection('auditEvents')
      .orderBy('sequence', 'asc')
      .get();

    const events: AuditEvent[] = eventsSnapshot.docs.map((doc: any) => doc.data() as AuditEvent);

    let expectedPrevHash = GENESIS_HASH;
    let expectedSequence = 1;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];

      // 1. Check sequence continuity
      if (ev.sequence !== expectedSequence) {
        return {
          isValid: false,
          totalEvents: events.length,
          error: `Sequence gap detected at index ${i}: expected sequence ${expectedSequence}, found ${ev.sequence} (Event ID: ${ev.id})`
        };
      }

      // 2. Check prevHash link
      if (ev.prevHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEvents: events.length,
          error: `Hash chain break detected at sequence ${ev.sequence}: expected prevHash ${expectedPrevHash}, found ${ev.prevHash}`
        };
      }

      // 3. Recompute hash
      const payloadWithoutHash = {
        id: ev.id,
        sequence: ev.sequence,
        timestamp: ev.timestamp,
        actorId: ev.actorId,
        actorEmail: ev.actorEmail,
        actorRole: ev.actorRole,
        action: ev.action,
        documentId: ev.documentId,
        targetUserId: ev.targetUserId,
        outcome: ev.outcome,
        requestId: ev.requestId,
        ip: ev.ip,
        userAgent: ev.userAgent,
        details: ev.details || {},
        prevHash: ev.prevHash
      };

      const computed = computeAuditEventHash(ev.prevHash, ev.sequence, payloadWithoutHash);
      if (computed !== ev.hash) {
        return {
          isValid: false,
          totalEvents: events.length,
          error: `Hash mismatch at sequence ${ev.sequence} (Event ID: ${ev.id}): event content has been tampered with.`
        };
      }

      expectedPrevHash = ev.hash;
      expectedSequence++;
    }

    // 4. Validate head pointer consistency
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      if (headData.latestHash !== lastEvent.hash || headData.latestSequence !== lastEvent.sequence) {
        return {
          isValid: false,
          totalEvents: events.length,
          error: `Audit head mismatch: head points to sequence ${headData.latestSequence} / hash ${headData.latestHash}, but last event is sequence ${lastEvent.sequence} / hash ${lastEvent.hash}`
        };
      }
    }

    return {
      isValid: true,
      totalEvents: events.length,
      lastSequence: headData.latestSequence,
      lastHash: headData.latestHash
    };
  }
}
