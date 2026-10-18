import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { AssignmentService } from '../services/assignment.service';
import { AuditService } from '../services/audit.service';
import { emitToWorkspace } from '../services/socket.service';

const router = Router();

router.use(authenticate, requireWorkspace);

/**
 * List all items in the Recovery Queue with reasons, owner, and escalation history
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const recoveryItems = await prisma.recoveryQueue.findMany({
      where: {
        workspaceId: req.workspaceId,
        status: 'PENDING',
      },
      include: {
        lead: {
          include: {
            contact: true,
            assignedRep: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = recoveryItems.map((item) => {
      const now = Date.now();
      const lastActivityMs = item.lastActivityAt ? now - item.lastActivityAt.getTime() : 0;
      const hoursSinceActivity = Math.round((lastActivityMs / (1000 * 60 * 60)) * 10) / 10;

      return {
        id: item.id,
        leadId: item.leadId,
        leadTitle: item.lead.title,
        customerName: item.lead.contact.name,
        customerPhone: item.lead.contact.phone,
        currentOwner: item.lead.assignedRep?.user.fullName || 'Unassigned',
        currentOwnerId: item.lead.assignedMembershipId,
        source: item.lead.source,
        reason: item.reason,
        escalationCount: item.escalationCount,
        hoursSinceActivity,
        status: item.status,
        notes: item.notes,
        createdAt: item.createdAt,
      };
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resolve or reassign a recovery queue item
 */
router.post('/:queueId/reassign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueId } = req.params;
    const { targetMembershipId, notes } = req.body;

    const item = await prisma.recoveryQueue.findUnique({
      where: { id: queueId },
      include: { lead: true },
    });

    if (!item || item.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Recovery queue item not found.' });
      return;
    }

    // Reassign the lead
    const result = await AssignmentService.assignLead(
      req.workspaceId!,
      item.leadId,
      'MANUAL_OVERRIDE',
      { type: 'USER', id: req.user!.id, name: req.user!.fullName },
      targetMembershipId
    );

    // Mark recovery item as resolved
    await prisma.recoveryQueue.update({
      where: { id: queueId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByMembershipId: req.membership!.id,
        notes: notes || 'Manually reassigned from Recovery Queue.',
      },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'RECOVERY_ITEM_REASSIGNED',
      entityType: 'LEAD',
      entityId: item.leadId,
      reason: `Recovered lead reassigned to member ${targetMembershipId}.`,
    });

    emitToWorkspace(req.workspaceId!, 'recovery_queue_updated', {
      queueId,
      leadId: item.leadId,
      status: 'RESOLVED',
    });

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
