import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireWorkspace } from '../middleware/workspace.middleware';
import { GoogleCalendarAdapter } from '../services/integrations/google-calendar.adapter';
import { AssignmentService } from '../services/assignment.service';
import { AuditService } from '../services/audit.service';

const router = Router();

router.use(authenticate, requireWorkspace);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId, hostId } = req.query;

    const where: any = { workspaceId: req.workspaceId };
    if (contactId) where.contactId = contactId as string;
    if (hostId) where.hostMembershipId = hostId as string;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        contact: true,
        opportunity: true,
        hostRep: { include: { user: { select: { fullName: true, email: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json(appointments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, contactId, opportunityId, hostMembershipId, startTime, endTime, location } = req.body;

    if (!title || !contactId || !startTime || !endTime) {
      res.status(400).json({ error: 'Title, Contact, Start Time, and End Time are required.' });
      return;
    }

    const hostId = hostMembershipId || req.membership!.id;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      res.status(400).json({ error: 'End time must be after start time.' });
      return;
    }

    // Check for scheduling conflicts!
    const conflictCheck = await GoogleCalendarAdapter.checkConflict(
      req.workspaceId!,
      hostId,
      start,
      end
    );

    if (conflictCheck.hasConflict) {
      res.status(409).json({
        error: `Scheduling Conflict: Representative already has an appointment "${conflictCheck.conflictingAppointment.title}" during this slot.`,
        conflictingAppointment: conflictCheck.conflictingAppointment,
      });
      return;
    }

    const appointment = await prisma.appointment.create({
      data: {
        workspaceId: req.workspaceId!,
        title,
        description: description || null,
        contactId,
        opportunityId: opportunityId || null,
        hostMembershipId: hostId,
        startTime: start,
        endTime: end,
        location: location || null,
        status: 'SCHEDULED',
      },
      include: { contact: true, hostRep: { include: { user: true } } },
    });

    // Qualifying action: if contact has an open lead, booking an appointment acknowledges it!
    const openLead = await prisma.lead.findFirst({
      where: {
        workspaceId: req.workspaceId,
        contactId,
        status: { in: ['ASSIGNED', 'ESCALATED'] },
      },
    });

    if (openLead) {
      await AssignmentService.acknowledgeLead(
        req.workspaceId!,
        openLead.id,
        hostId,
        'APPOINTMENT',
        req.user!.fullName
      );
    }

    await AuditService.log({
      workspaceId: req.workspaceId!,
      actorType: 'USER',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'APPOINTMENT_SCHEDULED',
      entityType: 'APPOINTMENT',
      entityId: appointment.id,
      afterState: appointment,
    });

    const calendarSync = await GoogleCalendarAdapter.syncAppointmentToGoogle(appointment.id);
    res.status(201).json({ ...appointment, calendarSync });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: { contact: true, hostRep: { include: { user: true } } },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
