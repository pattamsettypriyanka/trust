import { Request, Response } from 'express';
import { getFirestoreDb } from '../db/firestore.js';
import { UserProfile } from '../types/index.js';

export class AuthController {
  /**
   * Returns current authenticated user's profile and server-enforced role.
   */
  static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        type: 'https://trustvault.internal/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      });
      return;
    }

    res.json({
      user: req.user
    });
  }

  /**
   * Lists users in the system for permission granting (name, email, role).
   * Excludes sensitive data.
   */
  static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const db = getFirestoreDb();
      const snapshot = await db.collection('users').get();
      const users: UserProfile[] = snapshot.docs.map((doc: any) => {
        const u = doc.data() as UserProfile;
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        };
      });

      res.json({ users });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Listing Users',
        status: 500,
        detail: (err as Error).message
      });
    }
  }
}
