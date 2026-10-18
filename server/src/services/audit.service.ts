import { prisma } from '../lib/prisma';

export interface AuditLogParams {
  workspaceId: string;
  actorType: 'USER' | 'SYSTEM' | 'WEBHOOK';
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: 'LEAD' | 'CONTACT' | 'OPPORTUNITY' | 'INTEGRATION' | 'USER' | 'ROLE' | 'PIPELINE' | 'PAYMENT' | 'APPOINTMENT';
  entityId: string;
  beforeState?: any;
  afterState?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Append-only audit logger.
   * Never permits updating or deleting existing audit logs.
   */
  static async log(params: AuditLogParams) {
    try {
      const beforeString = params.beforeState ? JSON.stringify(params.beforeState) : null;
      const afterString = params.afterState ? JSON.stringify(params.afterState) : null;

      let validActorId: string | null = null;
      if (params.actorId) {
        const userExists = await prisma.user.findUnique({
          where: { id: params.actorId },
          select: { id: true },
        });
        if (userExists) {
          validActorId = userExists.id;
        }
      }

      return await prisma.auditLog.create({
        data: {
          workspaceId: params.workspaceId,
          actorType: params.actorType,
          actorId: validActorId,
          actorName: params.actorName || (params.actorType === 'SYSTEM' ? 'WorkNest System' : 'Integration Webhook'),
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          beforeState: beforeString,
          afterState: afterString,
          reason: params.reason || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      console.error('[AuditService] Failed to record audit log:', error);
      // Audit log failures should not crash user transaction but should log loudly
      return null;
    }
  }
}
