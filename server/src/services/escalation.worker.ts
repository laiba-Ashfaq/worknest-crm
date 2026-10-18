import { prisma } from '../lib/prisma';
import { AssignmentService } from './assignment.service';
import { SmtpAdapter } from './integrations/smtp.adapter';
import { emitToWorkspace } from './socket.service';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export class EscalationWorker {
  static start(intervalMs: number = 3000) {
    if (workerInterval) return;
    console.log('[EscalationWorker] Starting durable escalation worker...');

    // Run immediate check
    this.processPendingJobs();

    workerInterval = setInterval(() => {
      this.processPendingJobs();
    }, intervalMs);
  }

  static stop() {
    if (workerInterval) {
      clearInterval(workerInterval);
      workerInterval = null;
      console.log('[EscalationWorker] Stopped durable escalation worker.');
    }
  }

  /**
   * Process all pending durable jobs that have reached their scheduled runAt timestamp.
   */
  static async processPendingJobs() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const now = new Date();

      // Find due pending jobs
      const dueJobs = await prisma.durableJob.findMany({
        where: {
          status: 'PENDING',
          runAt: { lte: now },
        },
        take: 20,
        orderBy: { runAt: 'asc' },
      });

      for (const job of dueJobs) {
        await this.executeJob(job);
      }
    } catch (error) {
      console.error('[EscalationWorker] Error in job processing loop:', error);
    } finally {
      isProcessing = false;
    }
  }

  private static async executeJob(job: any) {
    // Acquire lock by updating to RUNNING
    const locked = await prisma.durableJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'RUNNING', attempts: { increment: 1 } },
    });

    if (locked.count === 0) {
      // Job already acquired by another worker instance
      return;
    }

    try {
      if (job.jobType === 'LEAD_ACK_TIMEOUT') {
        await this.handleLeadAckTimeout(job);
      } else if (job.jobType === 'RECOVERY_CHECK') {
        await this.handleRecoveryQueueSweep(job);
      }

      // Mark completed
      await prisma.durableJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      });
    } catch (err: any) {
      console.error(`[EscalationWorker] Job ${job.id} failed:`, err);
      const isExhausted = job.attempts + 1 >= job.maxAttempts;
      await prisma.durableJob.update({
        where: { id: job.id },
        data: {
          status: isExhausted ? 'FAILED' : 'PENDING',
          lastError: err?.message || String(err),
          // Exponential backoff if retrying
          runAt: new Date(Date.now() + Math.pow(2, job.attempts) * 5000),
        },
      });
    }
  }

  private static async handleLeadAckTimeout(job: any) {
    const payload = JSON.parse(job.payload || '{}');
    const leadId = job.targetEntityId;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        contact: true,
        assignedRep: { include: { user: true } },
      },
    });

    if (!lead) return;

    // 1. Confirm lead still requires acknowledgement
    if (lead.status === 'ACKNOWLEDGED' || lead.acknowledgedAt) {
      return;
    }

    // 2. Confirm the timer is still current for this assignment
    if (payload.expectedMembershipId && lead.assignedMembershipId !== payload.expectedMembershipId) {
      // Rep was already reassigned, this timer is stale
      return;
    }

    // 3. Check if max escalations exceeded -> Send to Recovery Queue
    if (lead.escalationLevel >= lead.maxEscalationLevel) {
      console.log(`[EscalationWorker] Lead ${lead.id} exceeded max escalations (${lead.escalationLevel}). Placing into Recovery Queue.`);

      await prisma.recoveryQueue.create({
        data: {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          reason: 'REPEATED_ESCALATION',
          escalationCount: lead.escalationLevel,
          status: 'PENDING',
          notes: `Lead failed acknowledgement across all ${lead.escalationLevel} escalation tiers.`,
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'ESCALATED' },
      });

      emitToWorkspace(lead.workspaceId, 'recovery_queue_updated', {
        leadId: lead.id,
        reason: 'REPEATED_ESCALATION',
      });

      // Send email alert to workspace managers/owner
      await SmtpAdapter.sendEscalationAlert(lead.workspaceId, {
        leadTitle: lead.title,
        customerName: lead.contact.name,
        customerPhone: lead.contact.phone,
        escalationReason: `Max escalation reached (${lead.escalationLevel}). No response recorded.`,
        currentOwner: lead.assignedRep?.user.fullName || 'Unassigned',
        leadId: lead.id,
      });

      return;
    }

    // 4. Trigger next escalation step
    console.log(`[EscalationWorker] Escalating lead ${lead.id} from level ${lead.escalationLevel} to level ${lead.escalationLevel + 1}...`);
    await AssignmentService.assignLead(
      lead.workspaceId,
      lead.id,
      'TIMEOUT_ESCALATION',
      { type: 'SYSTEM', name: 'WorkNest Escalation Timer' }
    );
  }

  private static async handleRecoveryQueueSweep(job: any) {
    const rules = await prisma.assignmentRule.findUnique({
      where: { workspaceId: job.workspaceId },
    });

    const idleMinutes = rules?.recoveryQueueIdleThresholdMinutes || 120;
    const thresholdDate = new Date(Date.now() - idleMinutes * 60 * 1000);

    // Find leads with no activity since thresholdDate that are still open/unresolved
    const staleLeads = await prisma.lead.findMany({
      where: {
        workspaceId: job.workspaceId,
        status: { in: ['ASSIGNED', 'ESCALATED', 'UNASSIGNED'] },
        updatedAt: { lte: thresholdDate },
        recoveryItems: {
          none: { status: 'PENDING' },
        },
      },
    });

    for (const lead of staleLeads) {
      await prisma.recoveryQueue.create({
        data: {
          workspaceId: job.workspaceId,
          leadId: lead.id,
          reason: 'IDLE_NO_ACTIVITY',
          escalationCount: lead.escalationLevel,
          status: 'PENDING',
          notes: `No activity recorded for over ${idleMinutes} minutes.`,
        },
      });
    }
  }
}
