import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { WhatsAppAdapter } from '../services/integrations/whatsapp.adapter';
import { AssignmentService } from '../services/assignment.service';

const router = Router();

router.use(authenticate, requireWorkspace);

/**
 * List all conversations with latest message preview
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        contact: true,
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get messages for a specific conversation
 */
router.get('/:id/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation || conversation.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send message in a conversation (via WhatsApp Cloud API)
 */
router.post('/:id/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { contact: true },
    });

    if (!conversation || conversation.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    // Send via WhatsApp Adapter
    const message = await WhatsAppAdapter.sendMessage(
      req.workspaceId!,
      conversation.id,
      conversation.contact.phone,
      content,
      req.membership!.id
    );

    // If contact has an open assigned lead, sending a message qualifies as acknowledgement!
    const openLead = await prisma.lead.findFirst({
      where: {
        workspaceId: req.workspaceId,
        contactId: conversation.contactId,
        status: { in: ['ASSIGNED', 'ESCALATED'] },
      },
    });

    if (openLead) {
      await AssignmentService.acknowledgeLead(
        req.workspaceId!,
        openLead.id,
        req.membership!.id,
        'MESSAGE',
        req.user!.fullName
      );
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
