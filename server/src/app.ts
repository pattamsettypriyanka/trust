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

  // 5. Friendly root & Health check endpoints
  app.get('/', (req, res) => {
    if (req.accepts('html')) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>TrustVault API Gateway</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0B0F17; color: #E2E8F0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
            .card { background: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 32px; max-width: 540px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h1 { color: #38BDF8; font-size: 24px; margin-top: 0; display: flex; align-items: center; gap: 8px; }
            p { color: #94A3B8; line-height: 1.6; }
            .btn { display: inline-block; background: #0284C7; color: #FFF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; transition: background 0.2s; }
            .btn:hover { background: #0369A1; }
            code { background: #1E293B; padding: 2px 6px; border-radius: 4px; color: #38BDF8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🛡️ TrustVault API Gateway</h1>
            <p>The backend security API is <strong>active and operational</strong> on port <code>5000</code>.</p>
            <p>To access the enterprise document sharing dashboard, open the React application:</p>
            <a href="http://localhost:5173" class="btn">🚀 Open TrustVault Web App (localhost:5173)</a>
            <p style="margin-top: 24px; font-size: 13px;">API Health status: <a href="/api/health" style="color: #38BDF8;">/api/health</a></p>
          </div>
        </body>
        </html>
      `);
    } else {
      res.json({
        status: 'UP',
        service: 'TrustVault API Gateway',
        frontendUrl: 'http://localhost:5173',
        healthUrl: 'http://localhost:5000/api/health'
      });
    }
  });

  app.get(['/health', '/api/health'], (req, res) => {
    res.json({
      status: 'UP',
      service: 'TrustVault API Gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // 6. Mount domain routers (supports both standard Express and Vercel serverless /api rewrites)
  app.use('/api', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/documents', permissionRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/', authRoutes);
  app.use('/documents', documentRoutes);
  app.use('/documents', permissionRoutes);
  app.use('/admin', adminRoutes);

  // 7. 404 Fallback for unknown API routes
  app.use(['/api/*', '/*'], (req, res, next) => {
    // If request accepts html and is not an api call, let static frontend handle it
    if (req.accepts('html') && !req.path.startsWith('/api')) {
      return next();
    }
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
