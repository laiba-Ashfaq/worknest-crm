import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import workspaceRoutes from './routes/workspace.routes';
import leadRoutes from './routes/lead.routes';
import recoveryRoutes from './routes/recovery.routes';
import crmRoutes from './routes/crm.routes';
import conversationRoutes from './routes/conversation.routes';
import appointmentRoutes from './routes/appointment.routes';
import paymentRoutes from './routes/payment.routes';
import integrationRoutes from './routes/integration.routes';
import dashboardRoutes from './routes/dashboard.routes';
import auditRoutes from './routes/audit.routes';

export const createApp = () => {
  const app = express();

  // Basic security and parsing
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // Rate limiting for auth endpoints (brute-force prevention)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  });
  app.use('/api/auth/login', authLimiter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      platform: 'WorkNest Unified Business Management Platform',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/recovery', recoveryRoutes);
  app.use('/api/crm', crmRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit', auditRoutes);

  // Global 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.baseUrl}` });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Application Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
};
