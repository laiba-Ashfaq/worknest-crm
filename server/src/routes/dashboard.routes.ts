import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { hasPermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate, requireWorkspace);

/**
 * Live Operational Dashboard Metrics
 */
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const canViewSensitive = hasPermission(req, 'opportunity.sensitive_value');

    // Start of today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. New leads received today
    const leadsTodayCount = await prisma.lead.count({
      where: {
        workspaceId,
        createdAt: { gte: startOfToday },
      },
    });

    // 2. Open pipeline value grouped by stage
    const stages = await prisma.pipelineStage.findMany({
      where: { workspaceId },
      include: {
        opportunities: {
          where: { workspaceId, status: 'OPEN' },
          select: { expectedValue: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    let totalOpenPipelineValue = 0;
    const stageBreakdown = stages.map((stage) => {
      const stageValue = stage.opportunities.reduce((sum, opp) => sum + opp.expectedValue, 0);
      if (!stage.isWon && !stage.isLost) {
        totalOpenPipelineValue += stageValue;
      }
      return {
        stageId: stage.id,
        stageName: stage.name,
        color: stage.color,
        count: stage.opportunities.length,
        value: canViewSensitive ? stageValue : 0,
      };
    });

    // 3. Average time to first response
    const acknowledgedLeads = await prisma.lead.findMany({
      where: {
        workspaceId,
        status: 'ACKNOWLEDGED',
        timeToFirstResponseSeconds: { not: null },
      },
      select: { timeToFirstResponseSeconds: true },
    });

    let avgFirstResponseSeconds = 0;
    if (acknowledgedLeads.length > 0) {
      const sum = acknowledgedLeads.reduce((acc, curr) => acc + (curr.timeToFirstResponseSeconds || 0), 0);
      avgFirstResponseSeconds = Math.round(sum / acknowledgedLeads.length);
    }

    // 4. Leads currently in the Recovery Queue
    const recoveryQueueCount = await prisma.recoveryQueue.count({
      where: {
        workspaceId,
        status: 'PENDING',
      },
    });

    // 5. Automatic escalations in the last 24 hours
    const escalations24h = await prisma.assignmentHistory.count({
      where: {
        workspaceId,
        reason: 'TIMEOUT_ESCALATION',
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    // 6. Employee availability breakdown
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: {
        id: true,
        availability: true,
        currentOpenLeads: true,
        maxOpenLeads: true,
        user: { select: { fullName: true } },
      },
    });

    const availabilitySummary = {
      available: members.filter((m) => m.availability === 'AVAILABLE').length,
      busy: members.filter((m) => m.availability === 'BUSY').length,
      onLeave: members.filter((m) => m.availability === 'ON_LEAVE').length,
      offline: members.filter((m) => m.availability === 'OFFLINE').length,
      totalMembers: members.length,
      roster: members.map((m) => ({
        id: m.id,
        name: m.user.fullName,
        availability: m.availability,
        leads: `${m.currentOpenLeads}/${m.maxOpenLeads}`,
      })),
    };

    // 7. Upcoming appointments
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        workspaceId,
        startTime: { gte: now },
        status: 'SCHEDULED',
      },
      take: 5,
      include: {
        contact: true,
        hostRep: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });

    // 8. Payments received this month & projected
    const paymentsThisMonth = await prisma.payment.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startOfMonth },
      },
    });

    const collectedThisMonth = paymentsThisMonth
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingThisMonth = paymentsThisMonth
      .filter((p) => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      leadsToday: leadsTodayCount,
      openPipelineValue: canViewSensitive ? totalOpenPipelineValue : 0,
      stageBreakdown,
      avgFirstResponseSeconds,
      avgFirstResponseFormatted:
        avgFirstResponseSeconds > 60
          ? `${Math.floor(avgFirstResponseSeconds / 60)}m ${avgFirstResponseSeconds % 60}s`
          : `${avgFirstResponseSeconds}s`,
      recoveryQueueCount,
      escalations24h,
      availabilitySummary,
      upcomingAppointmentsCount: upcomingAppointments.length,
      upcomingAppointments,
      collectedThisMonth: canViewSensitive ? collectedThisMonth : 0,
      projectedThisMonth: canViewSensitive ? totalOpenPipelineValue + pendingThisMonth : 0,
      currency: 'PKR',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get / update user dashboard widget preferences
 */
router.get('/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const pref = await prisma.userPreference.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.user!.id,
          workspaceId: req.workspaceId!,
        },
      },
    });

    let widgets = [
      'leadsToday',
      'pipelineValue',
      'firstResponseTime',
      'recoveryQueue',
      'escalations24h',
      'availability',
      'appointments',
      'paymentsMonth',
    ];

    if (pref?.dashboardWidgets) {
      try {
        widgets = JSON.parse(pref.dashboardWidgets);
      } catch (e) {}
    }

    res.json({ widgets, theme: pref?.theme || 'light' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const { widgets, theme } = req.body;

    const pref = await prisma.userPreference.upsert({
      where: {
        userId_workspaceId: {
          userId: req.user!.id,
          workspaceId: req.workspaceId!,
        },
      },
      update: {
        dashboardWidgets: Array.isArray(widgets) ? JSON.stringify(widgets) : undefined,
        theme: theme || undefined,
      },
      create: {
        userId: req.user!.id,
        workspaceId: req.workspaceId!,
        dashboardWidgets: Array.isArray(widgets) ? JSON.stringify(widgets) : '[]',
        theme: theme || 'light',
      },
    });

    res.json(pref);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
