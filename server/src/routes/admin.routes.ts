import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sensitiveOpsRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All admin routes strictly enforce authentication AND the server-side ADMIN role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// User management
router.get('/users', AdminController.listUsers);
router.get('/users/:userId/details', AdminController.getUserDetails);
router.patch('/users/:userId/role', sensitiveOpsRateLimiter, AdminController.updateUserRole);
router.post('/users/:userId/share', sensitiveOpsRateLimiter, AdminController.shareDocumentWithUser);
router.delete('/users/:userId/grants/:documentId', sensitiveOpsRateLimiter, AdminController.revokeDocumentForUser);

// Compliance audit trail and integrity verification
router.get('/audit', AdminController.listAuditEvents);
router.get('/audit/integrity', AdminController.verifyAuditIntegrity);
router.get('/stats', AdminController.getSecurityStats);

export default router;
