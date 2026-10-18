import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();

const DEFAULT_PERMISSIONS = [
  { code: 'crm.view', name: 'View CRM Records', category: 'CRM' },
  { code: 'crm.create', name: 'Create CRM Records', category: 'CRM' },
  { code: 'crm.edit', name: 'Edit CRM Records', category: 'CRM' },
  { code: 'crm.delete', name: 'Delete CRM Records', category: 'CRM' },
  { code: 'crm.export', name: 'Export CRM Records', category: 'CRM' },
  { code: 'users.manage', name: 'Manage Users & Roles', category: 'Team' },
  { code: 'assignment.manage', name: 'Manage Lead Assignment Rules', category: 'Leads' },
  { code: 'integrations.manage', name: 'Manage Integrations', category: 'Integrations' },
  { code: 'audit.view', name: 'View Audit History', category: 'Security' },
  { code: 'opportunity.sensitive_value', name: 'View Opportunity Revenue Values', category: 'CRM' },
  { code: 'appointments.manage', name: 'Manage Appointments', category: 'Appointments' },
  { code: 'payments.manage', name: 'Manage Payment Requests', category: 'Payments' },
];

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Register a new company workspace and Owner account
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      res.status(400).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // Create user, workspace, roles, permissions, default pipeline, and assignment rules in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create global permissions if they don't exist yet
      for (const p of DEFAULT_PERMISSIONS) {
        await tx.permission.upsert({
          where: { code: p.code },
          update: { name: p.name, category: p.category },
          create: p,
        });
      }

      const allPerms = await tx.permission.findMany();

      // 2. Create User
      const user = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email.toLowerCase(),
          passwordHash,
          phone: data.phone || null,
        },
      });

      // 3. Create Workspace
      const slug = data.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
      const workspace = await tx.workspace.create({
        data: {
          name: data.companyName,
          slug,
          timezone: 'Asia/Karachi',
          currency: 'PKR',
        },
      });

      // 4. Create Standard Roles for Workspace: Owner, Admin, Manager, Employee
      const ownerRole = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: 'Owner',
          description: 'Company owner with full unrevokable administrative control.',
          isSystem: true,
        },
      });

      const adminRole = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: 'Admin',
          description: 'Administrator capable of managing settings and team members.',
          isSystem: true,
        },
      });

      const managerRole = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: 'Manager',
          description: 'Team supervisor who can monitor leads, reassign, and view reports.',
          isSystem: false,
        },
      });

      const employeeRole = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: 'Employee',
          description: 'Sales representative handling assigned leads and customers.',
          isSystem: true,
        },
      });

      // Assign all permissions to Owner and Admin
      for (const perm of allPerms) {
        await tx.rolePermission.create({
          data: { roleId: ownerRole.id, permissionId: perm.id },
        });
        await tx.rolePermission.create({
          data: { roleId: adminRole.id, permissionId: perm.id },
        });
      }

      // Assign subset of permissions to Manager
      const managerPermCodes = ['crm.view', 'crm.create', 'crm.edit', 'crm.export', 'assignment.manage', 'audit.view', 'opportunity.sensitive_value', 'appointments.manage'];
      for (const perm of allPerms.filter((p) => managerPermCodes.includes(p.code))) {
        await tx.rolePermission.create({
          data: { roleId: managerRole.id, permissionId: perm.id },
        });
      }

      // Assign base permissions to Employee
      const employeePermCodes = ['crm.view', 'crm.create', 'crm.edit', 'appointments.manage'];
      for (const perm of allPerms.filter((p) => employeePermCodes.includes(p.code))) {
        await tx.rolePermission.create({
          data: { roleId: employeeRole.id, permissionId: perm.id },
        });
      }

      // 5. Create Owner Membership
      const membership = await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
          availability: 'AVAILABLE',
          maxOpenLeads: 20,
        },
      });

      // 6. Create Default Assignment Rules
      await tx.assignmentRule.create({
        data: {
          workspaceId: workspace.id,
          roundRobinEnabled: true,
          maxOpenLeadsPerRep: 15,
          defaultAckWindowSeconds: config.demoMode ? config.defaultDemoTimerSeconds : 300,
          escalationLevels: 3,
          ackWindowPerLevelSeconds: config.demoMode ? config.defaultDemoTimerSeconds : 300,
          isDemoMode: config.demoMode,
          demoTimerSeconds: config.defaultDemoTimerSeconds,
        },
      });

      // 7. Create Default Sales Pipeline & Stages
      const pipeline = await tx.pipeline.create({
        data: {
          workspaceId: workspace.id,
          name: 'Direct Sales Pipeline',
          isDefault: true,
        },
      });

      const stages = [
        { name: 'Lead Intake', order: 0, color: '#4F9CF9', isWon: false, isLost: false },
        { name: 'Contacted', order: 1, color: '#F59E0B', isWon: false, isLost: false },
        { name: 'Proposal Sent', order: 2, color: '#8B5CF6', isWon: false, isLost: false },
        { name: 'Under Negotiation', order: 3, color: '#3B82F6', isWon: false, isLost: false },
        { name: 'Closed Won', order: 4, color: '#10B981', isWon: true, isLost: false },
        { name: 'Closed Lost', order: 5, color: '#EF4444', isWon: false, isLost: true },
      ];

      for (const s of stages) {
        await tx.pipelineStage.create({
          data: {
            workspaceId: workspace.id,
            pipelineId: pipeline.id,
            name: s.name,
            order: s.order,
            color: s.color,
            isWon: s.isWon,
            isLost: s.isLost,
          },
        });
      }

      return { user, workspace, membership };
    });

    const token = jwt.sign({ userId: result.user.id }, config.jwtSecret, {
      expiresIn: config.sessionExpiry as any,
    });

    await AuditService.log({
      workspaceId: result.workspace.id,
      actorType: 'USER',
      actorId: result.user.id,
      actorName: result.user.fullName,
      action: 'WORKSPACE_REGISTERED',
      entityType: 'USER',
      entityId: result.user.id,
      reason: 'Initial company registration and Owner creation.',
    });

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
        currency: result.workspace.currency,
        timezone: result.workspace.timezone,
      },
      membershipId: result.membership.id,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message || 'Registration failed.' });
  }
});

/**
 * Login user
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        memberships: {
          include: {
            workspace: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: config.sessionExpiry as any,
    });

    const workspaces = user.memberships.map((m) => ({
      workspaceId: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role.name,
      membershipId: m.id,
      availability: m.availability,
    }));

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      workspaces,
      activeWorkspace: workspaces[0] || null,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Login failed.' });
  }
});

/**
 * Get current session user info and active workspaces
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        memberships: {
          include: {
            workspace: true,
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
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const workspaces = user.memberships.map((m) => ({
      workspaceId: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role.name,
      membershipId: m.id,
      availability: m.availability,
      permissions: m.role.rolePermissions.map((rp) => rp.permission.code),
    }));

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      workspaces,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch session.' });
  }
});

export default router;
