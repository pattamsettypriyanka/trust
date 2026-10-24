import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public account registration
router.post('/register', AuthController.register);
router.post('/auth/register', AuthController.register);

// Retrieve authenticated user's profile and server-enforced role
router.get('/me', authenticateToken, AuthController.getMe);
router.patch('/me/profile', authenticateToken, AuthController.updateProfile);

// List registered users for permission sharing
router.get('/users', authenticateToken, AuthController.listUsers);

export default router;
