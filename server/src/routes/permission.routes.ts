import { Router } from 'express';
import { PermissionController } from '../controllers/permission.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { sensitiveOpsRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Permission grant and revocation routes
router.get('/:id/grants', authenticateToken, PermissionController.listGrants);
router.post('/:id/grants', authenticateToken, sensitiveOpsRateLimiter, PermissionController.createGrant);
router.delete('/:id/grants/:userId', authenticateToken, sensitiveOpsRateLimiter, PermissionController.revokeGrant);

export default router;
