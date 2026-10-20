import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import documentRoutes from './routes/document.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Helmet security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false // Handled safely or during production proxy
    })
  );

  // 2. CORS configuration restricted to authorized frontend origins
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  app.use(
    cors({
      origin: [allowedOrigin, 'http://127.0.0.1:5173', 'http://localhost:4000'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      credentials: true
    })
  );

  // 3. Strict payload size limits for JSON and URL-encoded bodies
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Global API rate limiter
  app.use('/api', apiRateLimiter);

  // 5. Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'TrustVault API Gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // 6. Mount domain routers
  app.use('/api', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/documents', permissionRoutes);
  app.use('/api/admin', adminRoutes);

  // 7. 404 Fallback for unknown API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      type: 'https://trustvault.internal/errors/not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: `The requested path "${req.originalUrl}" does not exist.`,
      requestId: req.requestId
    });
  });

  // 8. Centralized error handling
  app.use(errorHandler);

  return app;
}
