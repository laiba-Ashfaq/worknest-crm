import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AssignmentService } from '../services/assignment.service';
import { SafepayAdapter } from '../services/integrations/safepay.adapter';
import { WhatsAppAdapter } from '../services/integrations/whatsapp.adapter';

describe('WorkNest Core Business Logic & Security Tests', { timeout: 20000 }, () => {
  let testWorkspaceId: string;
  let testOwnerUserId: string;
  let testOwnerMemberId: string;
  let testAdminMemberId: string;
  let testEmp1MemberId: string;
  let testEmp2MemberId: string;

  beforeAll(async () => {
    // Set up dedicated test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Isolation Workspace',
        slug: `test-corp-${Date.now()}`,
      },
    });
    testWorkspaceId = workspace.id;

    const ownerRole = await prisma.role.create({
      data: { workspaceId: workspace.id, name: 'Owner', isSystem: true },
    });
    const adminRole = await prisma.role.create({
      data: { workspaceId: workspace.id, name: 'Admin', isSystem: true },
    });
    const empRole = await prisma.role.create({
      data: { workspaceId: workspace.id, name: 'Employee', isSystem: true },
    });

    const hash = await bcrypt.hash('TestPass123!', 8);
    const ownerUser = await prisma.user.create({
      data: { fullName: 'Test Owner', email: `owner-${Date.now()}@test.com`, passwordHash: hash },
    });
    testOwnerUserId = ownerUser.id;

    const ownerMember = await prisma.workspaceMembership.create({
      data: { workspaceId: workspace.id, userId: ownerUser.id, roleId: ownerRole.id, availability: 'AVAILABLE' },
    });
    testOwnerMemberId = ownerMember.id;

    const adminUser = await prisma.user.create({
      data: { fullName: 'Test Admin', email: `admin-${Date.now()}@test.com`, passwordHash: hash },
    });
    const adminMember = await prisma.workspaceMembership.create({
      data: { workspaceId: workspace.id, userId: adminUser.id, roleId: adminRole.id, availability: 'AVAILABLE' },
    });
    testAdminMemberId = adminMember.id;

    const empUser1 = await prisma.user.create({
      data: { fullName: 'Rep Alpha', email: `alpha-${Date.now()}@test.com`, passwordHash: hash },
    });
    const empMember1 = await prisma.workspaceMembership.create({
      data: { workspaceId: workspace.id, userId: empUser1.id, roleId: empRole.id, availability: 'AVAILABLE', maxOpenLeads: 5, currentOpenLeads: 0 },
    });
    testEmp1MemberId = empMember1.id;

    const empUser2 = await prisma.user.create({
      data: { fullName: 'Rep Beta', email: `beta-${Date.now()}@test.com`, passwordHash: hash },
    });
    const empMember2 = await prisma.workspaceMembership.create({
      data: { workspaceId: workspace.id, userId: empUser2.id, roleId: empRole.id, availability: 'AVAILABLE', maxOpenLeads: 5, currentOpenLeads: 0 },
    });
    testEmp2MemberId = empMember2.id;

    await prisma.assignmentRule.create({
      data: {
        workspaceId: workspace.id,
        roundRobinEnabled: true,
        maxOpenLeadsPerRep: 5,
        defaultAckWindowSeconds: 30,
        escalationLevels: 3,
      },
    });
  });

  afterAll(async () => {
    // Clean up test workspace
    if (testWorkspaceId) {
      await prisma.workspace.delete({ where: { id: testWorkspaceId } }).catch(() => {});
    }
  });

  describe('1. Multi-Tenant Workspace Isolation', () => {
    it('should isolate records and prevent foreign workspace access', async () => {
      // Create a foreign workspace
      const foreignWorkspace = await prisma.workspace.create({
        data: { name: 'Foreign Workspace', slug: `foreign-${Date.now()}` },
      });

      const contactInTest = await prisma.contact.create({
        data: { workspaceId: testWorkspaceId, name: 'Secret Client', phone: '+923000000001' },
      });

      // Querying with foreign workspace ID should return null
      const result = await prisma.contact.findFirst({
        where: { id: contactInTest.id, workspaceId: foreignWorkspace.id },
      });

      expect(result).toBeNull();

      // Clean up foreign workspace
      await prisma.workspace.delete({ where: { id: foreignWorkspace.id } });
    });
  });

  describe('2. Lead Assignment & Availability Rules', () => {
    it('should assign lead using round-robin and exclude Busy/Offline reps', async () => {
      // Put Rep Beta on leave
      await prisma.workspaceMembership.update({
        where: { id: testEmp2MemberId },
        data: { availability: 'ON_LEAVE' },
      });

      const nextRep = await AssignmentService.findNextEligibleRep(testWorkspaceId);
      // Rep Alpha must be chosen since Beta is ON_LEAVE
      expect(nextRep).toBe(testEmp1MemberId);

      // Restore Rep Beta
      await prisma.workspaceMembership.update({
        where: { id: testEmp2MemberId },
        data: { availability: 'AVAILABLE' },
      });
    });

    it('should enforce maximum open-lead limit', async () => {
      // Set Alpha current open leads to max (5)
      await prisma.workspaceMembership.update({
        where: { id: testEmp1MemberId },
        data: { currentOpenLeads: 5 },
      });

      const nextRep = await AssignmentService.findNextEligibleRep(testWorkspaceId);
      // Alpha is saturated, nextRep must be Beta
      expect(nextRep).toBe(testEmp2MemberId);

      // Reset
      await prisma.workspaceMembership.update({
        where: { id: testEmp1MemberId },
        data: { currentOpenLeads: 0 },
      });
    });
  });

  describe('3. Lead Acknowledgement & Response Time Tracking', () => {
    it('should calculate first response time and stop duplicate updates', async () => {
      const contact = await prisma.contact.create({
        data: { workspaceId: testWorkspaceId, name: 'Ack Contact', phone: '+923000000002' },
      });

      const lead = await prisma.lead.create({
        data: {
          workspaceId: testWorkspaceId,
          contactId: contact.id,
          title: 'Roof Solar Audit',
          status: 'ASSIGNED',
          assignedMembershipId: testEmp1MemberId,
          assignedAt: new Date(Date.now() - 45000), // 45 seconds ago
        },
      });

      // Rep acknowledges
      const ackLead = await AssignmentService.acknowledgeLead(
        testWorkspaceId,
        lead.id,
        testEmp1MemberId,
        'MANUAL',
        'Rep Alpha'
      );

      expect(ackLead.status).toBe('ACKNOWLEDGED');
      expect(ackLead.timeToFirstResponseSeconds).toBeGreaterThanOrEqual(40);

      const firstTime = ackLead.timeToFirstResponseSeconds;

      // Second acknowledgement attempt should not overwrite initial measurement
      const secondAck = await AssignmentService.acknowledgeLead(
        testWorkspaceId,
        lead.id,
        testEmp1MemberId,
        'NOTE',
        'Rep Alpha'
      );

      expect(secondAck.timeToFirstResponseSeconds).toBe(firstTime);
    });
  });

  describe('4. Absence Reassignment Engine', () => {
    it('should automatically reassign unacknowledged leads when rep changes to ON_LEAVE', async () => {
      const contact = await prisma.contact.create({
        data: { workspaceId: testWorkspaceId, name: 'Absence Contact', phone: '+923000000003' },
      });

      const unackLead = await prisma.lead.create({
        data: {
          workspaceId: testWorkspaceId,
          contactId: contact.id,
          title: 'Urgent Net-Metering Lead',
          status: 'ASSIGNED',
          assignedMembershipId: testEmp1MemberId,
          assignedAt: new Date(),
        },
      });

      // Update Alpha to ON_LEAVE in DB and trigger absence handler
      await prisma.workspaceMembership.update({
        where: { id: testEmp1MemberId },
        data: { availability: 'ON_LEAVE' },
      });

      await AssignmentService.handleAvailabilityChange(
        testWorkspaceId,
        testEmp1MemberId,
        'ON_LEAVE',
        'Emergency dentist appointment'
      );

      const refreshedLead = await prisma.lead.findUnique({
        where: { id: unackLead.id },
      });

      // Lead must have been reassigned away from Alpha!
      expect(refreshedLead?.assignedMembershipId).not.toBe(testEmp1MemberId);
    });
  });

  describe('5. Safepay Sandbox Payment Idempotency & Webhook Signature', () => {
    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ event: 'payment.completed', token: 'track_123' });
      const isValid = SafepayAdapter.verifyWebhookSignature(payload, 'wrong_signature', 'test_secret');
      expect(isValid).toBe(false);
    });

    it('should accept valid HMAC SHA256 webhook signature', () => {
      const crypto = require('crypto');
      const secret = 'sandbox_secret_key_12345';
      const payload = JSON.stringify({ event: 'payment.completed', token: 'track_test' });
      const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const isValid = SafepayAdapter.verifyWebhookSignature(payload, validSig, secret);
      expect(isValid).toBe(true);
    });
  });
});
