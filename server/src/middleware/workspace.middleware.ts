import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export interface MembershipContext {
  id: string;
  userId: string;
  workspaceId: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  isAdmin: boolean;
  availability: string;
  maxOpenLeads: number;
  currentOpenLeads: number;
}

declare global {
  namespace Express {
    interface Request {
      workspaceId?: string;
      membership?: MembershipContext;
      permissions?: string[];
    }
  }
}

export const requireWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required prior to workspace resolution.' });
      return;
    }

    // Workspace ID can come from header, path param, or query param
    const workspaceId = (req.headers['x-workspace-id'] as string) || req.params.workspaceId || (req.query.workspaceId as string);

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required (header x-workspace-id or parameter).' });
      return;
    }

    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id,
        },
      },
      include: {
        role: {
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

    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace.' });
      return;
    }

    if (membership.status !== 'ACTIVE') {
      res.status(403).json({ error: `Membership is ${membership.status.toLowerCase()}. Access restricted.` });
      return;
    }

    const permissionCodes = membership.role.rolePermissions.map((rp) => rp.permission.code);
    const isOwner = membership.role.name === 'Owner';
    const isAdmin = isOwner || membership.role.name === 'Admin';

    req.workspaceId = workspaceId;
    req.membership = {
      id: membership.id,
      userId: membership.userId,
      workspaceId: membership.workspaceId,
      roleId: membership.roleId,
      roleName: membership.role.name,
      isOwner,
      isAdmin,
      availability: membership.availability,
      maxOpenLeads: membership.maxOpenLeads,
      currentOpenLeads: membership.currentOpenLeads,
    };
    req.permissions = permissionCodes;

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve workspace membership context.' });
  }
};
