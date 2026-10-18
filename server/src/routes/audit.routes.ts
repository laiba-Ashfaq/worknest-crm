import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate, requireWorkspace, requirePermission('audit.view'));

/**
 * Filter and search append-only audit trail
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityType, action, actorType } = req.query;

    const where: any = { workspaceId: req.workspaceId };
    if (entityType) where.entityType = entityType as string;
    if (action) where.action = action as string;
    if (actorType) where.actorType = actorType as string;

    const logs = await prisma.auditLog.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { fullName: true, email: true } },
      },
    });

    const parsedLogs = logs.map((log) => {
      let beforeStateParsed = null;
      let afterStateParsed = null;
      try {
        if (log.beforeState) beforeStateParsed = JSON.parse(log.beforeState);
      } catch (e) {}
      try {
        if (log.afterState) afterStateParsed = JSON.parse(log.afterState);
      } catch (e) {}

      return {
        ...log,
        beforeState: beforeStateParsed,
        afterState: afterStateParsed,
      };
    });

    res.json(parsedLogs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
