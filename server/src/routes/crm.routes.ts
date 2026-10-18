import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { hasPermission } from '../middleware/permission.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();

router.use(authenticate, requireWorkspace);

// Helper for phone normalization
const normalizePhone = (phone: string): string => {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('03') && cleaned.length === 11) {
    return '+92' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('+')) {
    return '+' + cleaned;
  }
  return cleaned;
};

// -------------------------------------------------------------
// CONTACTS
// -------------------------------------------------------------

router.get('/contacts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, tag, companyId } = req.query;

    const where: any = { workspaceId: req.workspaceId };
    if (companyId) where.companyId = companyId as string;
    if (tag) where.tags = { contains: tag as string };
    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        company: true,
        assignedRep: { include: { user: { select: { fullName: true, email: true } } } },
        opportunities: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/contacts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, companyId, leadSource, tags, notes, consentStatus, assignedMembershipId } = req.body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Contact name and phone number are required.' });
      return;
    }

    const normalized = normalizePhone(phone);

    const contact = await prisma.contact.create({
      data: {
        workspaceId: req.workspaceId!,
        name,
        email: email || null,
        phone: normalized,
        companyId: companyId || null,
        leadSource: leadSource || 'MANUAL',
        tags: Array.isArray(tags) ? JSON.stringify(tags) : (tags || '[]'),
        notes: notes || null,
        consentStatus: consentStatus || 'OPTED_IN',
        assignedMembershipId: assignedMembershipId || null,
      },
      include: { company: true },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CONTACT_CREATED',
      entityType: 'CONTACT',
      entityId: contact.id,
      afterState: contact,
    });

    res.status(201).json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Complete Customer 360 Profile: Contact, company, all opportunities, payments, conversations, appointments, notes
 */
router.get('/contacts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        company: true,
        assignedRep: { include: { user: true } },
        opportunities: {
          include: { stage: true, pipeline: true },
          orderBy: { createdAt: 'desc' },
        },
        appointments: {
          include: { hostRep: { include: { user: true } } },
          orderBy: { startTime: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              take: 20,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        leads: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contact || contact.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }

    // Mask sensitive opportunity values if user lacks permission
    const canSeeSensitive = hasPermission(req, 'opportunity.sensitive_value');
    if (!canSeeSensitive) {
      contact.opportunities = contact.opportunities.map((opp) => ({
        ...opp,
        expectedValue: 0,
      }));
    }

    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/contacts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, companyId, leadSource, tags, notes, consentStatus, assignedMembershipId } = req.body;

    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }

    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : undefined,
        email: email !== undefined ? email : undefined,
        phone: phone ? normalizePhone(phone) : undefined,
        companyId: companyId !== undefined ? companyId : undefined,
        leadSource: leadSource !== undefined ? leadSource : undefined,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags !== undefined ? tags : undefined,
        notes: notes !== undefined ? notes : undefined,
        consentStatus: consentStatus !== undefined ? consentStatus : undefined,
        assignedMembershipId: assignedMembershipId !== undefined ? assignedMembershipId : undefined,
      },
      include: { company: true },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CONTACT_UPDATED',
      entityType: 'CONTACT',
      entityId: updated.id,
      beforeState: existing,
      afterState: updated,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// COMPANIES
// -------------------------------------------------------------

router.get('/companies', async (req: Request, res: Response): Promise<void> => {
  try {
    const companies = await prisma.company.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/companies', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, industry, website, phone, email, address, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Company name is required.' });
      return;
    }

    const company = await prisma.company.create({
      data: {
        workspaceId: req.workspaceId!,
        name,
        industry: industry || null,
        website: website || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      },
    });

    res.status(201).json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// PIPELINES & STAGES
// -------------------------------------------------------------

router.get('/pipelines', async (req: Request, res: Response): Promise<void> => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        customFields: { orderBy: { order: 'asc' } },
      },
    });
    res.json(pipelines);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pipelines', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, stages } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Pipeline name is required.' });
      return;
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        workspaceId: req.workspaceId!,
        name,
        stages: {
          create: (stages || [
            { name: 'Prospect', order: 0, color: '#4F9CF9' },
            { name: 'Proposal', order: 1, color: '#8B5CF6' },
            { name: 'Negotiation', order: 2, color: '#F59E0B' },
            { name: 'Closed Won', order: 3, color: '#10B981', isWon: true },
            { name: 'Closed Lost', order: 4, color: '#EF4444', isLost: true },
          ]).map((s: any, idx: number) => ({
            workspaceId: req.workspaceId!,
            name: s.name,
            order: s.order ?? idx,
            color: s.color || '#4F9CF9',
            isWon: s.isWon || false,
            isLost: s.isLost || false,
            requiredFieldNames: Array.isArray(s.requiredFieldNames) ? JSON.stringify(s.requiredFieldNames) : '[]',
          })),
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json(pipeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update stages in a pipeline (ordering, required fields, etc.)
 */
router.put('/pipelines/:pipelineId/stages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { stages } = req.body; // Array of stages
    const { pipelineId } = req.params;

    for (const s of stages) {
      if (s.id) {
        await prisma.pipelineStage.update({
          where: { id: s.id },
          data: {
            name: s.name,
            order: s.order,
            color: s.color,
            isWon: s.isWon,
            isLost: s.isLost,
            requiredFieldNames: Array.isArray(s.requiredFieldNames) ? JSON.stringify(s.requiredFieldNames) : s.requiredFieldNames,
          },
        });
      } else {
        await prisma.pipelineStage.create({
          data: {
            workspaceId: req.workspaceId!,
            pipelineId,
            name: s.name,
            order: s.order,
            color: s.color,
            isWon: s.isWon || false,
            isLost: s.isLost || false,
            requiredFieldNames: Array.isArray(s.requiredFieldNames) ? JSON.stringify(s.requiredFieldNames) : '[]',
          },
        });
      }
    }

    const updatedPipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    res.json(updatedPipeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a stage with safe migration requirement:
 * Cannot delete a stage containing opportunities unless migrated to another stage!
 */
router.delete('/pipelines/:pipelineId/stages/:stageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { stageId } = req.params;
    const { targetStageId } = req.query;

    const count = await prisma.opportunity.count({
      where: { stageId },
    });

    if (count > 0 && !targetStageId) {
      res.status(400).json({
        error: `Cannot delete stage: It contains ${count} active opportunities. Please specify targetStageId to migrate them first.`,
        opportunitiesCount: count,
      });
      return;
    }

    if (count > 0 && targetStageId) {
      await prisma.opportunity.updateMany({
        where: { stageId },
        data: { stageId: targetStageId as string },
      });
    }

    await prisma.pipelineStage.delete({
      where: { id: stageId },
    });

    res.json({ success: true, migratedOpportunities: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// OPPORTUNITIES
// -------------------------------------------------------------

router.get('/opportunities', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pipelineId, stageId, assignedTo } = req.query;

    const where: any = { workspaceId: req.workspaceId };
    if (pipelineId) where.pipelineId = pipelineId as string;
    if (stageId) where.stageId = stageId as string;
    if (assignedTo) where.assignedMembershipId = assignedTo as string;

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        contact: true,
        company: true,
        stage: true,
        assignedRep: { include: { user: { select: { fullName: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const canSeeSensitive = hasPermission(req, 'opportunity.sensitive_value');

    const sanitized = opportunities.map((opp) => {
      let customFieldsParsed = {};
      try {
        customFieldsParsed = JSON.parse(opp.customFields || '{}');
      } catch (e) {}

      return {
        ...opp,
        expectedValue: canSeeSensitive ? opp.expectedValue : 0,
        customFields: customFieldsParsed,
      };
    });

    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/opportunities', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, contactId, companyId, pipelineId, stageId, expectedValue, currency, assignedMembershipId, expectedCloseDate, customFields } = req.body;

    if (!title || !contactId || !pipelineId || !stageId) {
      res.status(400).json({ error: 'Title, Contact, Pipeline, and Stage are required.' });
      return;
    }

    const opportunity = await prisma.opportunity.create({
      data: {
        workspaceId: req.workspaceId!,
        title,
        contactId,
        companyId: companyId || null,
        pipelineId,
        stageId,
        expectedValue: Number(expectedValue) || 0,
        currency: currency || 'PKR',
        assignedMembershipId: assignedMembershipId || null,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        customFields: typeof customFields === 'object' ? JSON.stringify(customFields) : '{}',
      },
      include: { contact: true, company: true, stage: true },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'OPPORTUNITY_CREATED',
      entityType: 'OPPORTUNITY',
      entityId: opportunity.id,
      afterState: opportunity,
    });

    res.status(201).json(opportunity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Move or update opportunity stage with stage-specific required field validation!
 */
router.put('/opportunities/:id/stage', async (req: Request, res: Response): Promise<void> => {
  try {
    const { stageId } = req.body;
    const { id } = req.params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: { stage: true },
    });

    if (!opportunity || opportunity.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Opportunity not found.' });
      return;
    }

    const targetStage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
    });

    if (!targetStage || targetStage.workspaceId !== req.workspaceId) {
      res.status(404).json({ error: 'Target stage not found.' });
      return;
    }

    // Stage validation: Check stage-specific required fields
    let requiredFields: string[] = [];
    try {
      requiredFields = JSON.parse(targetStage.requiredFieldNames || '[]');
    } catch (e) {}

    const customFields = JSON.parse(opportunity.customFields || '{}');
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (field === 'expectedValue' && (!opportunity.expectedValue || opportunity.expectedValue <= 0)) {
        missingFields.push('Expected Value');
      } else if (field.startsWith('custom:')) {
        const key = field.replace('custom:', '');
        if (!customFields[key]) {
          missingFields.push(key);
        }
      }
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        error: `Cannot move to "${targetStage.name}": Required fields missing: ${missingFields.join(', ')}`,
        missingFields,
      });
      return;
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        stageId,
        status: targetStage.isWon ? 'WON' : targetStage.isLost ? 'LOST' : 'OPEN',
      },
      include: { stage: true, contact: true },
    });

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'OPPORTUNITY_STAGE_CHANGED',
      entityType: 'OPPORTUNITY',
      entityId: id,
      beforeState: { stageId: opportunity.stageId, stageName: opportunity.stage.name },
      afterState: { stageId, stageName: targetStage.name, status: updated.status },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// CUSTOM FIELDS
// -------------------------------------------------------------

router.get('/custom-fields', async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityType, pipelineId } = req.query;

    const where: any = { workspaceId: req.workspaceId };
    if (entityType) where.entityType = entityType as string;
    if (pipelineId) where.pipelineId = pipelineId as string;

    const fields = await prisma.customFieldDefinition.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    const parsed = fields.map((f) => {
      let opts = [];
      try {
        opts = JSON.parse(f.options || '[]');
      } catch (e) {}
      return { ...f, options: opts };
    });

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/custom-fields', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, key, fieldType, entityType, pipelineId, options, isRequired } = req.body;

    if (!name || !key || !fieldType) {
      res.status(400).json({ error: 'Field name, key, and field type are required.' });
      return;
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        workspaceId: req.workspaceId!,
        pipelineId: pipelineId || null,
        entityType: entityType || 'OPPORTUNITY',
        name,
        key: key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        fieldType,
        options: Array.isArray(options) ? JSON.stringify(options) : '[]',
        isRequired: isRequired || false,
      },
    });

    res.status(201).json(field);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// SAVED FILTERS
// -------------------------------------------------------------

router.get('/saved-filters', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = await prisma.savedFilter.findMany({
      where: { workspaceId: req.workspaceId },
    });

    const parsed = filters.map((f) => {
      let crit = {};
      try {
        crit = JSON.parse(f.criteria);
      } catch (e) {}
      return { ...f, criteria: crit };
    });

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/saved-filters', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, entityType, criteria } = req.body;

    const saved = await prisma.savedFilter.create({
      data: {
        workspaceId: req.workspaceId!,
        membershipId: req.membership!.id,
        entityType: entityType || 'LEADS',
        name,
        criteria: typeof criteria === 'object' ? JSON.stringify(criteria) : '{}',
      },
    });

    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
