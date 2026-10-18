import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { AssignmentService } from '../services/assignment.service';
import { AuditService } from '../services/audit.service';
import { emitToWorkspace } from '../services/socket.service';

const router = Router();

// All workspace routes require authentication and workspace context
router.use(authenticate, requireWorkspace);

/**
 * Get current workspace details and assignment rules
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.workspaceId },
      include: {
        assignmentRules: true,
        roles: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    res.json(workspace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update workspace settings (Name, timezone, currency)
 */
router.put('/', requirePermission('users.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, timezone, currency } = req.body;

    const updated = await prisma.workspace.update({
      where: { id: req.workspaceId },
      data: {
        name: name || undefined,
        timezone: timezone || undefined,
        currency: currency || undefined,
      },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'WORKSPACE_SETTINGS_UPDATED',
      entityType: 'USER',
      entityId: req.workspaceId!,
      afterState: { name, timezone, currency },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List all members of the workspace with their roles and availability
 */
router.get('/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            avatarUrl: true,
          },
        },
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update member availability (Available, Busy, On leave, Offline)
 * Triggers automatic lead reassignment on absence (On leave or Offline)!
 */
router.put('/members/:memberId/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { availability, reason } = req.body;

    const validStatuses = ['AVAILABLE', 'BUSY', 'ON_LEAVE', 'OFFLINE'];
    if (!validStatuses.includes(availability)) {
      res.status(400).json({ error: 'Invalid availability status.' });
      return;
    }

    // A user can update their own availability, or an Admin/Owner can update any member's availability
    const isSelf = req.membership?.id === memberId;
    const canManage = req.membership?.isOwner || req.membership?.isAdmin;

    if (!isSelf && !canManage) {
      res.status(403).json({ error: 'You do not have permission to update another member\'s availability.' });
      return;
    }

    const previousMember = await prisma.workspaceMembership.findUnique({
      where: { id: memberId },
    });

    const updated = await prisma.workspaceMembership.update({
      where: { id: memberId },
      data: {
        availability,
        availabilityReason: reason || null,
      },
      include: { user: true, role: true },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'MEMBER_AVAILABILITY_CHANGED',
      entityType: 'USER',
      entityId: memberId,
      beforeState: { availability: previousMember?.availability },
      afterState: { availability, reason },
    });

    emitToWorkspace(req.workspaceId!, 'member_availability_updated', {
      membershipId: memberId,
      availability,
      userName: updated.user.fullName,
    });

    // Check if reassigning leads on absence is required!
    if (availability === 'ON_LEAVE' || availability === 'OFFLINE') {
      await AssignmentService.handleAvailabilityChange(
        req.workspaceId!,
        memberId,
        availability,
        reason
      );
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update member role (Owner / Admin capability safeguard: cannot demote Owner!)
 */
router.put('/members/:memberId/role', requirePermission('users.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { roleId } = req.body;

    const targetMember = await prisma.workspaceMembership.findUnique({
      where: { id: memberId },
      include: { role: true },
    });

    if (!targetMember || targetMember.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    // Essential Safeguard: Owner cannot lose ownership through an ordinary Admin action
    if (targetMember.role.name === 'Owner' && !req.membership?.isOwner) {
      res.status(403).json({ error: 'Safeguard Violation: An Admin cannot modify the workspace Owner.' });
      return;
    }

    const newRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!newRole || newRole.workspaceId !== req.workspaceId) {
      res.status(400).json({ error: 'Target role not found in this workspace.' });
      return;
    }

    const updated = await prisma.workspaceMembership.update({
      where: { id: memberId },
      data: { roleId: newRole.id },
      include: { role: true, user: true },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'MEMBER_ROLE_CHANGED',
      entityType: 'ROLE',
      entityId: memberId,
      beforeState: { role: targetMember.role.name },
      afterState: { role: newRole.name },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update assignment rules (Round-robin, timers, demo mode, thresholds)
 */
router.put('/assignment-rules', requirePermission('assignment.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      roundRobinEnabled,
      maxOpenLeadsPerRep,
      defaultAckWindowSeconds,
      escalationLevels,
      ackWindowPerLevelSeconds,
      backupMembershipId,
      managerFallbackMembershipId,
      recoveryQueueIdleThresholdMinutes,
      isDemoMode,
      demoTimerSeconds,
    } = req.body;

    const updated = await prisma.assignmentRule.upsert({
      where: { workspaceId: req.workspaceId! },
      update: {
        roundRobinEnabled: roundRobinEnabled ?? undefined,
        maxOpenLeadsPerRep: maxOpenLeadsPerRep ?? undefined,
        defaultAckWindowSeconds: defaultAckWindowSeconds ?? undefined,
        escalationLevels: escalationLevels ?? undefined,
        ackWindowPerLevelSeconds: ackWindowPerLevelSeconds ?? undefined,
        backupMembershipId: backupMembershipId !== undefined ? backupMembershipId : undefined,
        managerFallbackMembershipId: managerFallbackMembershipId !== undefined ? managerFallbackMembershipId : undefined,
        recoveryQueueIdleThresholdMinutes: recoveryQueueIdleThresholdMinutes ?? undefined,
        isDemoMode: isDemoMode ?? undefined,
        demoTimerSeconds: demoTimerSeconds ?? undefined,
      },
      create: {
        workspaceId: req.workspaceId!,
        roundRobinEnabled: roundRobinEnabled ?? true,
        maxOpenLeadsPerRep: maxOpenLeadsPerRep ?? 10,
        defaultAckWindowSeconds: defaultAckWindowSeconds ?? 300,
        escalationLevels: escalationLevels ?? 3,
        ackWindowPerLevelSeconds: ackWindowPerLevelSeconds ?? 300,
        backupMembershipId,
        managerFallbackMembershipId,
        recoveryQueueIdleThresholdMinutes: recoveryQueueIdleThresholdMinutes ?? 120,
        isDemoMode: isDemoMode ?? false,
        demoTimerSeconds: demoTimerSeconds ?? 30,
      },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'ASSIGNMENT_RULES_UPDATED',
      entityType: 'LEAD',
      entityId: updated.id,
      afterState: updated,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
