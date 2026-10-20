import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/document.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { sensitiveOpsRateLimiter } from '../middleware/rateLimiter.js';
import { MAX_FILE_SIZE_BYTES } from '../utils/fileValidation.js';

const router = Router();

// Strict multipart parser configured with in-memory storage and hard 1,000,000 byte limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 1,000,000 bytes hard ceiling
    files: 1
  }
});

// Document CRUD & download routes - All server authorized
router.post('/', authenticateToken, sensitiveOpsRateLimiter, upload.single('file'), DocumentController.uploadDocument);
router.get('/', authenticateToken, DocumentController.listDocuments);
router.get('/:id', authenticateToken, DocumentController.getDocumentMetadata);
router.get('/:id/download', authenticateToken, DocumentController.downloadDocument);
router.patch('/:id', authenticateToken, DocumentController.updateDocumentMetadata);
router.put('/:id/content', authenticateToken, sensitiveOpsRateLimiter, upload.single('file'), DocumentController.updateDocumentContent);
router.delete('/:id', authenticateToken, sensitiveOpsRateLimiter, DocumentController.deleteDocument);
router.post('/:id/restore', authenticateToken, sensitiveOpsRateLimiter, DocumentController.restoreDocument);
router.get('/:id/audit', authenticateToken, DocumentController.getDocumentAudit);

export default router;
