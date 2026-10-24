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

  /**
   * Registers a new user account. Defaults to VIEWER role.
   */
  static async register(req: Request, res: Response): Promise<void> {
    const { email, displayName, password } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Invalid Email',
        status: 400,
        detail: 'A valid email address is required.'
      });
      return;
    }

    try {
      const db = getFirestoreDb();
      const existingSnap = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();

      if (!existingSnap.empty) {
        res.status(409).json({
          type: 'https://trustvault.internal/errors/conflict',
          title: 'Account Already Exists',
          status: 409,
          detail: 'An account with this email address already exists. Please sign in.'
        });
        return;
      }

      const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const name = displayName?.trim() || email.split('@')[0];

      const newUser: UserProfile = {
        id: uid,
        email: email.trim().toLowerCase(),
        displayName: name,
        role: 'VIEWER',
        createdAt: now,
        updatedAt: now
      };

      await db.collection('users').doc(uid).set(newUser);

      res.status(201).json({
        message: 'Account created successfully',
        user: newUser,
        token: `dev_${uid}`
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Registration Failed',
        status: 500,
        detail: (err as Error).message
      });
    }
  }

  /**
   * Updates authenticated user profile (e.g. displayName).
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string') {
      res.status(400).json({
        type: 'https://trustvault.internal/errors/bad-request',
        title: 'Invalid Display Name',
        status: 400,
        detail: 'displayName is required.'
      });
      return;
    }

    try {
      const db = getFirestoreDb();
      const now = new Date().toISOString();
      const updatedUser = {
        ...user,
        displayName: displayName.trim(),
        updatedAt: now
      };

      await db.collection('users').doc(user.id).update({
        displayName: displayName.trim(),
        updatedAt: now
      });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://trustvault.internal/errors/internal-error',
        title: 'Error Updating Profile',
        status: 500,
        detail: (err as Error).message
      });
    }
  }
}
