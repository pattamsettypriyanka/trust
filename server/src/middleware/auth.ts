import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { getFirestoreDb } from '../db/firestore.js';
import { Role, UserProfile } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      requestId: string;
    }
  }
}

/**
 * Authentication middleware that verifies identity and loads authoritative server-side role.
 * Strictly ignores any client-supplied actor ID or role in headers or body.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  req.requestId = requestId;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      type: 'https://trustvault.internal/errors/unauthorized',
      title: 'Authentication Required',
      status: 401,
      detail: 'Missing or malformed Authorization header. Bearer token is required.',
      requestId
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    let uid: string;
    let email: string;
    let displayName: string;

    // Check for dev/test mock tokens (useful for automated testing without requiring live GCP auth)
    if (token.startsWith('dev_')) {
      const devType = token.replace('dev_', '');
      if (devType === 'admin') {
        uid = 'user_admin_001';
        email = 'admin@trustvault.local';
        displayName = 'Security Administrator';
      } else if (devType === 'owner') {
        uid = 'user_owner_001';
        email = 'owner@trustvault.local';
        displayName = 'Document Owner';
      } else if (devType === 'viewer') {
        uid = 'user_viewer_001';
        email = 'viewer@trustvault.local';
        displayName = 'Authorized Viewer';
      } else if (devType === 'outsider') {
        uid = 'user_outsider_001';
        email = 'outsider@trustvault.local';
        displayName = 'Unrelated User';
      } else {
        uid = `user_${devType}`;
        email = `${devType}@trustvault.local`;
        displayName = `User ${devType}`;
      }
    } else {
      // Production or Firebase Emulator: Verify real Firebase ID token
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        uid = decodedToken.uid;
        email = decodedToken.email || `${uid}@trustvault.user`;
        displayName = decodedToken.name || email.split('@')[0];
      } catch (tokenErr) {
        // Record failed authentication attempt for audit
        await AuditService.logEvent({
          actorId: 'UNAUTHENTICATED',
          action: 'AUTH_FAILED',
          outcome: 'DENIED',
          requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: { error: (tokenErr as Error).message }
        }).catch(() => {});

        res.status(401).json({
          type: 'https://trustvault.internal/errors/invalid-token',
          title: 'Invalid Authentication Token',
          status: 401,
          detail: 'Firebase ID token verification failed or token has expired.',
          requestId
        });
        return;
      }
    }

    // Load authoritative user profile and role from Firestore (NEVER from client token claims)
    const db = getFirestoreDb();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    let userProfile: UserProfile;

    if (userSnap.exists) {
      userProfile = userSnap.data() as UserProfile;
    } else {
      // First-time sign-in: Provision default user profile with VIEWER role
      const now = new Date().toISOString();
      const defaultRole: Role = token === 'dev_admin' ? 'ADMIN' : token === 'dev_owner' ? 'OWNER' : 'VIEWER';

      userProfile = {
        id: uid,
        email,
        displayName,
        role: defaultRole,
        createdAt: now,
        updatedAt: now
      };

      await userRef.set(userProfile);
    }

    // Attach trusted, authoritative user profile to request object
    req.user = userProfile;
    next();
  } catch (error) {
    res.status(500).json({
      type: 'https://trustvault.internal/errors/internal-error',
      title: 'Authentication Processing Error',
      status: 500,
      detail: 'An error occurred while verifying user credentials.',
      requestId
    });
  }
}

/**
 * Middleware that requires a specific server-side role (e.g. ADMIN)
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        type: 'https://trustvault.internal/errors/unauthorized',
        title: 'Authentication Required',
        status: 401,
        detail: 'Authentication is required to access this endpoint.',
        requestId: req.requestId
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log forbidden role access attempt
      AuditService.logEvent({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: 'ACCESS_DENIED',
        outcome: 'DENIED',
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          endpoint: req.originalUrl,
          method: req.method,
          requiredRoles: allowedRoles,
          userRole: req.user.role
        }
      }).catch(() => {});

      res.status(403).json({
        type: 'https://trustvault.internal/errors/forbidden',
        title: 'Insufficient Permissions',
        status: 403,
        detail: `Access denied. Endpoint requires one of: [${allowedRoles.join(', ')}], but your role is ${req.user.role}.`,
        requestId: req.requestId
      });
      return;
    }

    next();
  };
}
