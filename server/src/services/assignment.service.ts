import { prisma } from '../lib/prisma';
import { AuditService } from './audit.service';
import { emitToWorkspace, emitToMember } from './socket.service';

export interface AssignmentResult {
  assignedMembershipId: string | null;
  status: 'ASSIGNED' | 'UNASSIGNED';
  reason: string;
  ackDeadlineAt: Date | null;
  escalationLevel: number;
}

export class AssignmentService {
  /**
   * Find next eligible employee using round-robin and availability/capacity limits.
   * Runs within or with database consistency.
   */
  static async findNextEligibleRep(workspaceId: string, excludeMembershipIds: string[] = []): Promise<string | null> {
    const rules = await prisma.assignmentRule.findUnique({
      where: { workspaceId },
    });

    const maxLeads = rules?.maxOpenLeadsPerRep ?? 10;

    // Find all active members with role Employee or Manager who are AVAILABLE
    const candidates = await prisma.workspaceMembership.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        availability: 'AVAILABLE',
        currentOpenLeads: { lt: maxLeads },
        id: { notIn: excludeMembershipIds },
        role: { name: { in: ['Employee', 'Manager'] } },
      },
      orderBy: [
        // Round-robin: prioritize rep who has gone longest since last assigned
        { lastAssignedAt: 'asc' },
        { currentOpenLeads: 'asc' },
      ],
    });

    if (candidates.length > 0) {
      return candidates[0].id;
    }

    // Check designated backup employee
    if (rules?.backupMembershipId && !excludeMembershipIds.includes(rules.backupMembershipId)) {
      const backup = await prisma.workspaceMembership.findUnique({
        where: { id: rules.backupMembershipId },
      });
      if (backup && backup.status === 'ACTIVE' && backup.availability === 'AVAILABLE' && backup.currentOpenLeads < maxLeads) {
        return backup.id;
      }
    }

    // Check manager fallback
    if (rules?.managerFallbackMembershipId && !excludeMembershipIds.includes(rules.managerFallbackMembershipId)) {
      const fallback = await prisma.workspaceMembership.findUnique({
        where: { id: rules.managerFallbackMembershipId },
      });
      if (fallback && fallback.status === 'ACTIVE' && fallback.availability !== 'ON_LEAVE' && fallback.availability !== 'OFFLINE') {
        return fallback.id;
      }
    }

    return null;
  }

  /**
   * Assign a lead to an eligible employee with concurrency protection and durable timer creation.
   */
  static async assignLead(
    workspaceId: string,
    leadId: string,
    reason: 'INITIAL_ROUND_ROBIN' | 'TIMEOUT_ESCALATION' | 'ABSENCE_REASSIGNMENT' | 'MANUAL_OVERRIDE' | 'FALLBACK',
    actor?: { type: 'USER' | 'SYSTEM'; id?: string; name?: string },
    forcedMembershipId?: string
  ): Promise<AssignmentResult> {
    const txResult: any = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: { assignedRep: { include: { user: true } }, contact: true },
      });

      if (!lead || lead.workspaceId !== workspaceId) {
        throw new Error('Lead not found or workspace mismatch.');
      }

      // If lead is already resolved/acknowledged and this is not a manual override or absence
      if (lead.status === 'ACKNOWLEDGED' && reason === 'TIMEOUT_ESCALATION') {
        return {
          assignedMembershipId: lead.assignedMembershipId,
          status: 'ASSIGNED',
          reason: 'Lead already acknowledged.',
          ackDeadlineAt: lead.ackDeadlineAt,
          escalationLevel: lead.escalationLevel,
        };
      }

      const rules = await tx.assignmentRule.findUnique({
        where: { workspaceId },
      });

      // Calculate timer duration (demo mode or standard)
      let ackWindowSeconds = rules?.defaultAckWindowSeconds || 300;
      if (rules?.isDemoMode && rules.demoTimerSeconds) {
        ackWindowSeconds = rules.demoTimerSeconds;
      }

      // Collect previously assigned reps to prevent cycling back immediately during escalation
      const history = await tx.assignmentHistory.findMany({
        where: { leadId },
        select: { newMembershipId: true },
      });
      const previousReps = history.map((h) => h.newMembershipId).filter(Boolean) as string[];

      let nextRepId: string | null = null;

      if (forcedMembershipId) {
        // Explicit manual assignment
        nextRepId = forcedMembershipId;
      } else {
        const excludeList = (reason === 'TIMEOUT_ESCALATION' || reason === 'ABSENCE_REASSIGNMENT')
          ? [lead.assignedMembershipId || '', ...previousReps]
          : [];
        nextRepId = await this.findNextEligibleRep(workspaceId, excludeList);
      }

      const previousMembershipId = lead.assignedMembershipId;

      if (nextRepId) {
        // Decrease current count on previous owner
        if (previousMembershipId && previousMembershipId !== nextRepId) {
          await tx.workspaceMembership.update({
            where: { id: previousMembershipId },
            data: { currentOpenLeads: { decrement: 1 } },
          });
        }

        // Increase current count on new owner and update lastAssignedAt
        await tx.workspaceMembership.update({
          where: { id: nextRepId },
          data: {
            currentOpenLeads: { increment: 1 },
            lastAssignedAt: new Date(),
          },
        });

        const newEscalationLevel = reason === 'TIMEOUT_ESCALATION' ? lead.escalationLevel + 1 : lead.escalationLevel;
        const ackDeadline = new Date(Date.now() + ackWindowSeconds * 1000);

        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: {
            assignedMembershipId: nextRepId,
            status: 'ASSIGNED',
            escalationLevel: newEscalationLevel,
            assignedAt: new Date(),
            ackDeadlineAt: ackDeadline,
          },
        });

        // Record assignment history
        await tx.assignmentHistory.create({
          data: {
            workspaceId,
            leadId,
            previousMembershipId,
            newMembershipId: nextRepId,
            reason,
            level: newEscalationLevel,
            triggeredBy: actor?.type || 'SYSTEM',
            actorId: actor?.id || null,
          },
        });

        // Schedule persistent durable job for timeout escalation
        // Prevents duplicate jobs by marking older pending jobs for this lead as completed
        await tx.durableJob.updateMany({
          where: {
            workspaceId,
            jobType: 'LEAD_ACK_TIMEOUT',
            targetEntityId: leadId,
            status: 'PENDING',
          },
          data: { status: 'COMPLETED' },
        });

        await tx.durableJob.create({
          data: {
            workspaceId,
            jobType: 'LEAD_ACK_TIMEOUT',
            targetEntityId: leadId,
            runAt: ackDeadline,
            status: 'PENDING',
            payload: JSON.stringify({
              leadId,
              expectedMembershipId: nextRepId,
              assignedAt: updatedLead.assignedAt?.toISOString(),
              escalationLevel: newEscalationLevel,
            }),
          },
        });

        // Create in-app notification for the newly assigned representative
        await tx.notification.create({
          data: {
            workspaceId,
            membershipId: nextRepId,
            title: reason === 'TIMEOUT_ESCALATION' ? 'URGENT: Escalated Lead Assigned' : 'New Lead Assigned',
            message: `Lead "${lead.title}" has been assigned to you. Acknowledgement required within ${ackWindowSeconds}s.`,
            type: reason === 'TIMEOUT_ESCALATION' ? 'LEAD_ESCALATED' : 'LEAD_ASSIGNED',
            linkUrl: `/leads?id=${leadId}`,
          },
        });

        return {
          assignedMembershipId: nextRepId,
          status: 'ASSIGNED',
          reason: 'Successfully assigned to eligible representative.',
          ackDeadlineAt: ackDeadline,
          escalationLevel: newEscalationLevel,
          audit: {
            workspaceId,
            actorType: actor?.type || 'SYSTEM',
            actorId: actor?.id,
            actorName: actor?.name,
            action: reason === 'TIMEOUT_ESCALATION' ? 'LEAD_AUTOMATIC_ESCALATED' : 'LEAD_ASSIGNED',
            entityType: 'LEAD',
            entityId: leadId,
            beforeState: { assignedMembershipId: previousMembershipId, status: lead.status },
            afterState: { assignedMembershipId: nextRepId, status: 'ASSIGNED', ackDeadline: ackDeadline.toISOString() },
            reason: `Reason: ${reason}. Level: ${newEscalationLevel}`,
          },
          socketPayload: {
            leadId,
            assignedMembershipId: nextRepId,
            previousMembershipId,
            reason,
            ackDeadlineAt: ackDeadline,
            escalationLevel: newEscalationLevel,
          },
          leadTitle: lead.title,
        };
      } else {
        // No eligible representative available -> Place into Recovery Queue as Unassigned Fallback
        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: {
            assignedMembershipId: null,
            status: 'UNASSIGNED',
            ackDeadlineAt: null,
          },
        });

        await tx.recoveryQueue.create({
          data: {
            workspaceId,
            leadId,
            reason: 'UNASSIGNED_FALLBACK',
            escalationCount: lead.escalationLevel,
            lastActivityAt: new Date(),
            status: 'PENDING',
            notes: 'No eligible representatives available within configured capacity or availability.',
          },
        });

        return {
          assignedMembershipId: null,
          status: 'UNASSIGNED',
          reason: 'No representative available. Lead queued into Recovery Queue.',
          ackDeadlineAt: null,
          escalationLevel: lead.escalationLevel,
          audit: {
            workspaceId,
            actorType: actor?.type || 'SYSTEM',
            actorId: actor?.id,
            actorName: actor?.name,
            action: 'LEAD_PLACED_IN_RECOVERY_QUEUE',
            entityType: 'LEAD',
            entityId: leadId,
            reason: 'No eligible representative available. Routed to Fallback Recovery Queue.',
          },
          socketPayload: null,
          leadTitle: lead.title,
        };
      }
    });

    // Execute audit logging and real-time events outside transaction lock
    if (txResult.audit) {
      await AuditService.log(txResult.audit as any);
    }

    if (txResult.status === 'ASSIGNED' && txResult.socketPayload) {
      emitToWorkspace(workspaceId, 'lead_assigned', txResult.socketPayload);
      if (txResult.assignedMembershipId) {
        emitToMember(txResult.assignedMembershipId, 'notification', {
          title: 'Lead Assigned',
          message: `Lead "${txResult.leadTitle}" requires your acknowledgement.`,
          leadId,
        });
      }
    } else if (txResult.status === 'UNASSIGNED') {
      emitToWorkspace(workspaceId, 'recovery_queue_updated', {
        leadId,
        reason: 'UNASSIGNED_FALLBACK',
      });
    }

    return {
      assignedMembershipId: txResult.assignedMembershipId,
      status: txResult.status as 'ASSIGNED' | 'UNASSIGNED',
      reason: txResult.reason,
      ackDeadlineAt: txResult.ackDeadlineAt,
      escalationLevel: txResult.escalationLevel,
    };
  }

  /**
   * Acknowledge lead (either manually or via qualifying action).
   * First response measurement is locked and never overwritten.
   */
  static async acknowledgeLead(
    workspaceId: string,
    leadId: string,
    membershipId: string,
    method: 'MANUAL' | 'NOTE' | 'MESSAGE' | 'CALL' | 'STAGE_CHANGE' | 'APPOINTMENT',
    actorName?: string
  ) {
    const txResult: any = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || lead.workspaceId !== workspaceId) {
        throw new Error('Lead not found.');
      }

      if (lead.status === 'ACKNOWLEDGED' || lead.acknowledgedAt) {
        // Already acknowledged; do not overwrite time to first response
        return lead;
      }

      const now = new Date();
      let responseSeconds: number | null = null;
      if (lead.assignedAt) {
        responseSeconds = Math.round((now.getTime() - lead.assignedAt.getTime()) / 1000);
      }

      const updated = await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: now,
          ackMethod: method,
          timeToFirstResponseSeconds: responseSeconds,
        },
      });

      // Cancel pending durable timeout jobs for this lead
      await tx.durableJob.updateMany({
        where: {
          workspaceId,
          jobType: 'LEAD_ACK_TIMEOUT',
          targetEntityId: leadId,
          status: 'PENDING',
        },
        data: { status: 'COMPLETED' },
      });

      // If lead was in recovery queue, mark it resolved
      await tx.recoveryQueue.updateMany({
        where: {
          workspaceId,
          leadId,
          status: 'PENDING',
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: now,
          resolvedByMembershipId: membershipId,
        },
      });

      return {
        updated,
        isNewAck: true,
        audit: {
          workspaceId,
          actorType: 'USER',
          actorId: membershipId,
          actorName,
          action: 'LEAD_ACKNOWLEDGED',
          entityType: 'LEAD',
          entityId: leadId,
          beforeState: { status: lead.status },
          afterState: { status: 'ACKNOWLEDGED', ackMethod: method, timeToFirstResponseSeconds: responseSeconds },
          reason: `Lead acknowledged via ${method}. Time to first response: ${responseSeconds}s.`,
        },
        socketPayload: {
          leadId,
          membershipId,
          method,
          timeToFirstResponseSeconds: responseSeconds,
        },
      };
    });

    if (txResult.isNewAck && txResult.audit) {
      await AuditService.log(txResult.audit as any);
      emitToWorkspace(workspaceId, 'lead_acknowledged', txResult.socketPayload);
    }

    return txResult.updated || txResult;
  }

  /**
   * Handle employee availability change (e.g. going ON_LEAVE or OFFLINE).
   * Immediately reassigns their unacknowledged leads!
   */
  static async handleAvailabilityChange(
    workspaceId: string,
    membershipId: string,
    newAvailability: string,
    reason?: string
  ) {
    if (newAvailability !== 'ON_LEAVE' && newAvailability !== 'OFFLINE') {
      return;
    }

    // Find all leads assigned to this employee that are NOT yet acknowledged
    const unacknowledgedLeads = await prisma.lead.findMany({
      where: {
        workspaceId,
        assignedMembershipId: membershipId,
        status: { in: ['ASSIGNED', 'ESCALATED'] },
      },
    });

    console.log(`[AssignmentService] Reassigning ${unacknowledgedLeads.length} leads due to rep absence (${newAvailability}).`);

    for (const lead of unacknowledgedLeads) {
      await this.assignLead(
        workspaceId,
        lead.id,
        'ABSENCE_REASSIGNMENT',
        { type: 'SYSTEM', name: 'WorkNest Absence Engine' }
      );
    }
  }
}
