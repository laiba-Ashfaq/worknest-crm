import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { AssignmentService } from '../services/assignment.service';
import { AuditService } from '../services/audit.service';
import { emitToWorkspace } from '../services/socket.service';

const router = Router();

const publicLeadSchema = z.object({
  workspaceSlug: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(7),
  title: z.string().min(2),
  notes: z.string().optional(),
  companyName: z.string().optional(),
});

/**
 * PUBLIC LEAD FORM INTAKE (No authentication required)
 * Handles customer form submissions from marketing websites/landing pages.
 */
router.post('/public', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = publicLeadSchema.parse(req.body);

    const workspace = await prisma.workspace.findUnique({
      where: { slug: data.workspaceSlug },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }

    // Phone normalization: +92 format for Pakistan numbers or international clean format
    let cleanPhone = data.phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.startsWith('03') && cleanPhone.length === 11) {
      cleanPhone = '+92' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    // 1. Find or create Contact
    let contact = await prisma.contact.findFirst({
      where: {
        workspaceId: workspace.id,
        phone: cleanPhone,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          workspaceId: workspace.id,
          name: data.name,
          email: data.email || null,
          phone: cleanPhone,
          leadSource: 'PUBLIC_FORM',
          notes: data.companyName ? `Company: ${data.companyName}` : null,
        },
      });
    }

    // 2. Create Lead
    const lead = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        contactId: contact.id,
        title: data.title,
        source: 'PUBLIC_FORM',
        status: 'UNASSIGNED',
        priority: 'MEDIUM',
        notes: data.notes || null,
      },
      include: { contact: true },
    });

    // 3. Immediately assign via Assignment Engine
    const assignResult = await AssignmentService.assignLead(
      workspace.id,
      lead.id,
      'INITIAL_ROUND_ROBIN',
      { type: 'SYSTEM', name: 'Public Lead Intake' }
    );

    emitToWorkspace(workspace.id, 'lead_received', {
      leadId: lead.id,
      title: lead.title,
      customerName: contact.name,
      source: 'PUBLIC_FORM',
      assignedMembershipId: assignResult.assignedMembershipId,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your inquiry has been received and assigned to a representative.',
      leadId: lead.id,
    });
  } catch (error: any) {
    console.error('Public lead intake error:', error);
    res.status(400).json({ error: error.message || 'Submission failed.' });
  }
});

// All following lead routes require authentication and workspace context
router.use(authenticate, requireWorkspace);

/**
 * List leads with filters, search, and dynamic countdown computation
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, assignedTo, search, source } = req.query;

    const where: any = {
      workspaceId: req.workspaceId,
    };

    if (status) {
      where.status = status as string;
    }

    if (source) {
      where.source = source as string;
    }

    if (assignedTo === 'me') {
      where.assignedMembershipId = req.membership!.id;
    } else if (assignedTo) {
      where.assignedMembershipId = assignedTo as string;
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { title: { contains: q } },
        { contact: { name: { contains: q } } },
        { contact: { phone: { contains: q } } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        contact: true,
        assignedRep: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const leadsWithTimers = leads.map((lead) => {
      let remainingSeconds = 0;
      let isOverdue = false;

      if (lead.ackDeadlineAt && (lead.status === 'ASSIGNED' || lead.status === 'ESCALATED')) {
        const diffMs = lead.ackDeadlineAt.getTime() - now;
        remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
        isOverdue = diffMs <= 0;
      }

      return {
        ...lead,
        remainingSeconds,
        isOverdue,
      };
    });

    res.json(leadsWithTimers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new lead manually
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId, title, source, priority, notes, assignToMembershipId } = req.body;

    if (!contactId || !title) {
      res.status(400).json({ error: 'Contact ID and Lead Title are required.' });
      return;
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        workspaceId: req.workspaceId!,
        contactId,
        title,
        source: source || 'MANUAL',
        priority: priority || 'MEDIUM',
        notes: notes || null,
        status: 'UNASSIGNED',
      },
      include: { contact: true },
    });

    // Assign via round-robin or explicit choice
    const assignResult = await AssignmentService.assignLead(
      req.workspaceId!,
      lead.id,
      assignToMembershipId ? 'MANUAL_OVERRIDE' : 'INITIAL_ROUND_ROBIN',
      { type: 'USER', id: req.user!.id, name: req.user!.fullName },
      assignToMembershipId
    );

    const refreshedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: { contact: true, assignedRep: { include: { user: true } } },
    });

    res.status(201).json(refreshedLead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get lead details with full assignment history
 */
router.get('/:leadId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        contact: true,
        assignedRep: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
        assignmentHistory: {
          orderBy: { createdAt: 'desc' },
        },
        recoveryItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead || lead.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const now = Date.now();
    let remainingSeconds = 0;
    let isOverdue = false;

    if (lead.ackDeadlineAt && (lead.status === 'ASSIGNED' || lead.status === 'ESCALATED')) {
      const diffMs = lead.ackDeadlineAt.getTime() - now;
      remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
      isOverdue = diffMs <= 0;
    }

    res.json({ ...lead, remainingSeconds, isOverdue });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Acknowledge lead (Explicit button click)
 */
router.post('/:leadId/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;

    const updated = await AssignmentService.acknowledgeLead(
      req.workspaceId!,
      leadId,
      req.membership!.id,
      'MANUAL',
      req.user!.fullName
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add note to lead (qualifies as automatic acknowledgement if assigned rep adds it!)
 */
router.post('/:leadId/notes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { note } = req.body;

    if (!note) {
      res.status(400).json({ error: 'Note text is required.' });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || lead.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const updatedNotes = lead.notes ? `${lead.notes}\n[${new Date().toISOString()}] ${req.user!.fullName}: ${note}` : `[${new Date().toISOString()}] ${req.user!.fullName}: ${note}`;

    await prisma.lead.update({
      where: { id: leadId },
      data: { notes: updatedNotes },
    });

    // If assigned rep adds a note and lead is not yet acknowledged, acknowledge it!
    if (lead.status !== 'ACKNOWLEDGED') {
      await AssignmentService.acknowledgeLead(
        req.workspaceId!,
        leadId,
        req.membership!.id,
        'NOTE',
        req.user!.fullName
      );
    }

    res.json({ success: true, notes: updatedNotes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually reassign a lead to another member
 */
router.post('/:leadId/reassign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { newMembershipId, reason } = req.body;

    if (!newMembershipId) {
      res.status(400).json({ error: 'New membership ID is required.' });
      return;
    }

    const result = await AssignmentService.assignLead(
      req.workspaceId!,
      leadId,
      'MANUAL_OVERRIDE',
      { type: 'USER', id: req.user!.id, name: req.user!.fullName },
      newMembershipId
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update lead status (e.g. RESOLVED, LOST)
 */
router.put('/:leadId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    const validStatuses = ['ASSIGNED', 'ACKNOWLEDGED', 'RESOLVED', 'LOST'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid lead status.' });
      return;
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { status },
      include: { contact: true, assignedRep: { include: { user: true } } },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'LEAD_STATUS_CHANGED',
      entityType: 'LEAD',
      entityId: leadId,
      afterState: { status },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
