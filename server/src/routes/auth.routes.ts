import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Retrieve authenticated user's profile and server-enforced role
router.get('/me', authenticateToken, AuthController.getMe);

// List registered users for permission sharing
router.get('/users', authenticateToken, AuthController.listUsers);

export default router;
