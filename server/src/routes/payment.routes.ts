import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { SafepayAdapter } from '../services/integrations/safepay.adapter';

const router = Router();

router.use(authenticate, requireWorkspace);

/**
 * List payments and calculate revenue breakdown (collected vs projected)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        contact: true,
        opportunity: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let collectedRevenue = 0;
    let pendingRevenue = 0;

    for (const p of payments) {
      if (p.status === 'PAID') {
        collectedRevenue += p.amount;
      } else if (p.status === 'PENDING') {
        pendingRevenue += p.amount;
      }
    }

    res.json({
      payments,
      summary: {
        collectedRevenue,
        pendingRevenue,
        totalPaymentsCount: payments.length,
        currency: 'PKR',
        isSandbox: true,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new Safepay Sandbox checkout payment request
 */
router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId, opportunityId, amount, currency } = req.body;

    if (!contactId || !amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Valid Contact ID and Amount are required.' });
      return;
    }

    const result = await SafepayAdapter.createPaymentSession({
      workspaceId: req.workspaceId!,
      contactId,
      opportunityId: opportunityId || undefined,
      amount: Number(amount),
      currency: currency || 'PKR',
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
