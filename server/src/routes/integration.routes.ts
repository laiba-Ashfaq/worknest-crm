import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { WhatsAppAdapter } from '../services/integrations/whatsapp.adapter';
import { SafepayAdapter } from '../services/integrations/safepay.adapter';
import { GoogleCalendarAdapter } from '../services/integrations/google-calendar.adapter';
import { SmtpAdapter } from '../services/integrations/smtp.adapter';

const router = Router();

// -------------------------------------------------------------
// PUBLIC WEBHOOK ENDPOINTS (External provider callbacks)
// -------------------------------------------------------------

router.get('/google-calendar/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;
  if (error) {
    res.status(400).send(`Google authorization was not completed: ${error}`);
    return;
  }
  if (typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send('Missing Google OAuth code or state.');
    return;
  }

  try {
    await GoogleCalendarAdapter.handleOAuthCallback(code, state);
    res.send('Google Calendar connected successfully. You can close this window and return to WorkNest.');
  } catch (err: any) {
    console.error('[Google Calendar OAuth Error]:', err.response?.data || err.message);
    res.status(400).send('Google Calendar authorization failed. Check the backend logs for details.');
  }
});

/**
 * Meta WhatsApp Webhook Verification Challenge
 */
router.get('/whatsapp/webhook', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful.');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification token mismatch.');
  }
});

router.get('/google-calendar/connect', authenticate, requireWorkspace, (req: Request, res: Response): void => {
  try {
    const url = GoogleCalendarAdapter.createAuthorizationUrl(
      req.workspaceId!,
      req.membership!.id,
      req.user!.id
    );
    res.redirect(url);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

/**
 * Meta WhatsApp Incoming Messages Webhook
 */
router.post('/whatsapp/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = (req.query.workspaceId as string) || (await prisma.workspace.findFirst())?.id;
    if (!workspaceId) {
      res.status(400).send('No workspace resolved.');
      return;
    }

    const result = await WhatsAppAdapter.handleIncomingWebhook(workspaceId, req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[WhatsApp Webhook Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Safepay Sandbox Webhook Receiver
 */
router.post('/safepay/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = (req.query.workspaceId as string) || (await prisma.workspace.findFirst())?.id;
    if (!workspaceId) {
      res.status(400).send('No workspace resolved.');
      return;
    }

    const signature = (req.headers['x-sfpy-signature'] || req.headers['signature']) as string | undefined;

    const result = await SafepayAdapter.handleWebhook(workspaceId, req.body, signature);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[Safepay Webhook Error]:', err);
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PROTECTED WORKSPACE INTEGRATION HUBS & LOGS
// -------------------------------------------------------------

router.use(authenticate, requireWorkspace);

/**
* Central Integrations Overview Page
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [whatsapp, safepay, googleCalendar, smtp] = await Promise.all([
      WhatsAppAdapter.getStatus(req.workspaceId!),
      SafepayAdapter.getStatus(req.workspaceId!),
      GoogleCalendarAdapter.getStatus(req.workspaceId!, req.membership?.id),
      SmtpAdapter.getStatus(req.workspaceId!),
    ]);

    const jazzcash = {
      provider: 'JazzCash Direct Debit / Merchant',
      code: 'JAZZCASH',
      isConnected: false,
      statusLabel: 'Available for Future Adapter',
      capabilities: ['Mobile Account Direct Debit', 'Voucher Payments', 'QR Code Payments'],
      setupInstructions: 'JazzCash merchant API integration slot ready for sandbox credentials.',
    };

    const easypaisa = {
      provider: 'Easypaisa MA / OTC Gateway',
      code: 'EASYPAISA',
      isConnected: false,
      statusLabel: 'Available for Future Adapter',
      capabilities: ['Wallet Deductions', 'OTC Token Payments', 'Subscription Debits'],
      setupInstructions: 'Easypaisa merchant API integration slot ready for sandbox credentials.',
    };

    res.json([whatsapp, safepay, googleCalendar, smtp, jazzcash, easypaisa]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Integration Synchronization & Event History Log
 */
router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, status } = req.query;

    const where: any = { workspaceId: req.workspaceId };
    if (provider) where.provider = provider as string;
    if (status) where.status = status as string;

    const logs = await prisma.integrationLog.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
