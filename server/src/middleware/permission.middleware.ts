import { Request, Response, NextFunction } from 'express';

export const requirePermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.membership) {
      res.status(403).json({ error: 'Workspace membership context not established.' });
      return;
    }

    // Owner has super-privilege across all capabilities
    if (req.membership.isOwner) {
      next();
      return;
    }

    const permissions = req.permissions || [];
    if (!permissions.includes(permissionCode)) {
      res.status(403).json({
        error: `Permission denied: Missing required capability '${permissionCode}'.`,
        requiredPermission: permissionCode,
      });
      return;
    }

    next();
  };
};

export const hasPermission = (req: Request, permissionCode: string): boolean => {
  if (!req.membership) return false;
  if (req.membership.isOwner) return true;
  return (req.permissions || []).includes(permissionCode);
};
