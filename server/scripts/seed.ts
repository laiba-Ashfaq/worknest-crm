import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

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

async function main() {
  console.log('Seeding WorkNest development database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.durableJob.deleteMany();
  await prisma.integrationLog.deleteMany();
  await prisma.integrationConfig.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.recoveryQueue.deleteMany();
  await prisma.assignmentHistory.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.customFieldDefinition.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.assignmentRule.deleteMany();
  await prisma.workspaceMembership.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Permissions
  for (const p of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, category: p.category },
      create: p,
    });
  }
  const allPerms = await prisma.permission.findMany();

  // 2. Create Workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Apex Solar & Energy Pakistan',
      slug: 'apex-solar-pk',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
    },
  });

  // 3. Create Roles
  const ownerRole = await prisma.role.create({
    data: { workspaceId: workspace.id, name: 'Owner', description: 'Full executive control', isSystem: true },
  });
  const adminRole = await prisma.role.create({
    data: { workspaceId: workspace.id, name: 'Admin', description: 'Operations administrator', isSystem: true },
  });
  const managerRole = await prisma.role.create({
    data: { workspaceId: workspace.id, name: 'Manager', description: 'Team lead & supervisor', isSystem: false },
  });
  const employeeRole = await prisma.role.create({
    data: { workspaceId: workspace.id, name: 'Employee', description: 'Sales and field consultant', isSystem: true },
  });

  for (const perm of allPerms) {
    await prisma.rolePermission.create({ data: { roleId: ownerRole.id, permissionId: perm.id } });
    await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });
  }

  const managerPermCodes = ['crm.view', 'crm.create', 'crm.edit', 'crm.export', 'assignment.manage', 'audit.view', 'opportunity.sensitive_value', 'appointments.manage'];
  for (const perm of allPerms.filter((p) => managerPermCodes.includes(p.code))) {
    await prisma.rolePermission.create({ data: { roleId: managerRole.id, permissionId: perm.id } });
  }

  const employeePermCodes = ['crm.view', 'crm.create', 'crm.edit', 'appointments.manage'];
  for (const perm of allPerms.filter((p) => employeePermCodes.includes(p.code))) {
    await prisma.rolePermission.create({ data: { roleId: employeeRole.id, permissionId: perm.id } });
  }

  // 4. Create Users and Memberships
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Owner
  const ownerUser = await prisma.user.create({
    data: { fullName: 'Bilal Khan', email: 'owner@worknest.app', passwordHash, phone: '+923001234567' },
  });
  const ownerMember = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: ownerUser.id, roleId: ownerRole.id, availability: 'AVAILABLE', maxOpenLeads: 20 },
  });

  // Admin
  const adminUser = await prisma.user.create({
    data: { fullName: 'Sara Ahmed', email: 'admin@worknest.app', passwordHash, phone: '+923002345678' },
  });
  const adminMember = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: adminUser.id, roleId: adminRole.id, availability: 'AVAILABLE', maxOpenLeads: 20 },
  });

  // Manager
  const managerUser = await prisma.user.create({
    data: { fullName: 'Tariq Mahmood', email: 'manager@worknest.app', passwordHash, phone: '+923003456789' },
  });
  const managerMember = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: managerUser.id, roleId: managerRole.id, availability: 'AVAILABLE', maxOpenLeads: 15 },
  });

  // Employees with diverse availability statuses
  const emp1 = await prisma.user.create({
    data: { fullName: 'Hamza Ali', email: 'hamza@worknest.app', passwordHash, phone: '+923004567890' },
  });
  const emp1Member = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: emp1.id, roleId: employeeRole.id, availability: 'AVAILABLE', currentOpenLeads: 2, maxOpenLeads: 10, lastAssignedAt: new Date(Date.now() - 3600000) },
  });

  const emp2 = await prisma.user.create({
    data: { fullName: 'Zainab Fatima', email: 'zainab@worknest.app', passwordHash, phone: '+923005678901' },
  });
  const emp2Member = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: emp2.id, roleId: employeeRole.id, availability: 'BUSY', currentOpenLeads: 4, maxOpenLeads: 10, lastAssignedAt: new Date(Date.now() - 1800000) },
  });

  const emp3 = await prisma.user.create({
    data: { fullName: 'Usman Siddiqui', email: 'usman@worknest.app', passwordHash, phone: '+923006789012' },
  });
  const emp3Member = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: emp3.id, roleId: employeeRole.id, availability: 'ON_LEAVE', availabilityReason: 'On annual leave till Thursday', currentOpenLeads: 0, maxOpenLeads: 10 },
  });

  const emp4 = await prisma.user.create({
    data: { fullName: 'Ayesha Malik', email: 'ayesha@worknest.app', passwordHash, phone: '+923007890123' },
  });
  const emp4Member = await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: emp4.id, roleId: employeeRole.id, availability: 'OFFLINE', currentOpenLeads: 0, maxOpenLeads: 10 },
  });

  // 5. Assignment Rules (Demo mode with 30s timer for lightning fast evaluation)
  await prisma.assignmentRule.create({
    data: {
      workspaceId: workspace.id,
      roundRobinEnabled: true,
      maxOpenLeadsPerRep: 10,
      defaultAckWindowSeconds: 30, // 30s demonstration timer!
      escalationLevels: 3,
      ackWindowPerLevelSeconds: 30,
      backupMembershipId: adminMember.id,
      managerFallbackMembershipId: managerMember.id,
      recoveryQueueIdleThresholdMinutes: 60,
      isDemoMode: true,
      demoTimerSeconds: 30,
    },
  });

  // 6. Pipelines and Stages
  const pipeline = await prisma.pipeline.create({
    data: { workspaceId: workspace.id, name: 'Commercial Solar Installation', isDefault: true },
  });

  const s0 = await prisma.pipelineStage.create({
    data: { workspaceId: workspace.id, pipelineId: pipeline.id, name: 'Lead Intake', order: 0, color: '#4F9CF9', isWon: false, isLost: false },
  });
  const s1 = await prisma.pipelineStage.create({
    data: { workspaceId: workspace.id, pipelineId: pipeline.id, name: 'Site Audit Scheduled', order: 1, color: '#F59E0B', isWon: false, isLost: false },
  });
  const s2 = await prisma.pipelineStage.create({
    data: { workspaceId: workspace.id, pipelineId: pipeline.id, name: 'Proposal Presented', order: 2, color: '#8B5CF6', isWon: false, isLost: false, requiredFieldNames: JSON.stringify(['expectedValue']) },
  });
  const s3 = await prisma.pipelineStage.create({
    data: { workspaceId: workspace.id, pipelineId: pipeline.id, name: 'Contract Negotiation', order: 3, color: '#3B82F6', isWon: false, isLost: false },
  });
  const s4 = await prisma.pipelineStage.create({
    data: { workspaceId: workspace.id, pipelineId: pipeline.id, name: 'Installation Won', order: 4, color: '#10B981', isWon: true, isLost: false },
  });
  const s5 = await prisma.pipelineStage.create({
    data: { workspaceId: workspace.id, pipelineId: pipeline.id, name: 'Lost / Disqualified', order: 5, color: '#EF4444', isWon: false, isLost: true },
  });

  // 7. Custom Fields
  await prisma.customFieldDefinition.create({
    data: {
      workspaceId: workspace.id,
      pipelineId: pipeline.id,
      entityType: 'OPPORTUNITY',
      name: 'System Capacity (kW)',
      key: 'system_capacity_kw',
      fieldType: 'NUMBER',
      isRequired: false,
    },
  });
  await prisma.customFieldDefinition.create({
    data: {
      workspaceId: workspace.id,
      pipelineId: pipeline.id,
      entityType: 'OPPORTUNITY',
      name: 'Roof Type',
      key: 'roof_type',
      fieldType: 'DROPDOWN',
      options: JSON.stringify(['Concrete Flat', 'Corrugated Metal', 'Clay Tile', 'Ground Mount']),
      isRequired: false,
    },
  });

  // 8. Companies
  const comp1 = await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: 'Al-Rahim Textiles Mills',
      industry: 'Manufacturing',
      website: 'https://alrahimtextiles.com.pk',
      phone: '+922135001234',
      email: 'procurement@alrahimtextiles.com.pk',
      address: 'Plot 42, Korangi Industrial Area, Karachi',
    },
  });
  const comp2 = await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: 'Gulberg Health Clinic',
      industry: 'Healthcare',
      phone: '+924235778899',
      email: 'admin@gulberghealth.pk',
      address: 'Main Boulevard, Gulberg III, Lahore',
    },
  });

  // 9. Contacts
  const contact1 = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      name: 'Muhammad Farooq',
      email: 'farooq@alrahimtextiles.com.pk',
      phone: '+923001122334',
      companyId: comp1.id,
      leadSource: 'WEBSITE',
      tags: JSON.stringify(['Industrial', 'High-Priority']),
      assignedMembershipId: emp1Member.id,
      notes: 'Interested in 200kW rooftop grid-tied solar setup.',
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      name: 'Dr. Nida Rehman',
      email: 'nida@gulberghealth.pk',
      phone: '+923214455667',
      companyId: comp2.id,
      leadSource: 'WHATSAPP',
      tags: JSON.stringify(['Commercial', 'Clinic']),
      assignedMembershipId: emp2Member.id,
      notes: 'Requires 50kW solar hybrid system with battery backup.',
    },
  });

  const contact3 = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      name: 'Kashif Mehmood',
      email: 'kashif.m@gmail.com',
      phone: '+923339988776',
      leadSource: 'PUBLIC_FORM',
      tags: JSON.stringify(['Residential', 'Villa']),
      notes: 'Inquiry for 15kW residential net-metering.',
    },
  });

  // 10. Opportunities
  const opp1 = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      title: '200kW Solar Installation - Al-Rahim Mill',
      contactId: contact1.id,
      companyId: comp1.id,
      pipelineId: pipeline.id,
      stageId: s2.id,
      expectedValue: 4500000,
      currency: 'PKR',
      assignedMembershipId: emp1Member.id,
      customFields: JSON.stringify({ system_capacity_kw: 200, roof_type: 'Corrugated Metal' }),
      paymentStatus: 'UNPAID',
    },
  });

  const opp2 = await prisma.opportunity.create({
    data: {
      workspaceId: workspace.id,
      title: '50kW Hybrid Hospital Backup - Gulberg Clinic',
      contactId: contact2.id,
      companyId: comp2.id,
      pipelineId: pipeline.id,
      stageId: s1.id,
      expectedValue: 1850000,
      currency: 'PKR',
      assignedMembershipId: emp2Member.id,
      customFields: JSON.stringify({ system_capacity_kw: 50, roof_type: 'Concrete Flat' }),
      paymentStatus: 'UNPAID',
    },
  });

  // 11. Leads with realistic accountability states
  // Lead 1: Active with countdown timer
  const lead1 = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      contactId: contact3.id,
      title: '15kW Residential Net-Metering System',
      source: 'PUBLIC_FORM',
      status: 'ASSIGNED',
      priority: 'HIGH',
      assignedMembershipId: emp1Member.id,
      assignedAt: new Date(),
      ackDeadlineAt: new Date(Date.now() + 30 * 1000), // 30s countdown!
      escalationLevel: 0,
    },
  });

  await prisma.assignmentHistory.create({
    data: {
      workspaceId: workspace.id,
      leadId: lead1.id,
      newMembershipId: emp1Member.id,
      reason: 'INITIAL_ROUND_ROBIN',
      level: 0,
      triggeredBy: 'SYSTEM',
    },
  });

  // Lead 2: Acknowledged lead with first response time measured
  const lead2 = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      contactId: contact1.id,
      title: '200kW Commercial Solar Inquiry',
      source: 'PUBLIC_FORM',
      status: 'ACKNOWLEDGED',
      priority: 'HIGH',
      assignedMembershipId: emp1Member.id,
      assignedAt: new Date(Date.now() - 3600000),
      acknowledgedAt: new Date(Date.now() - 3540000),
      ackMethod: 'NOTE',
      timeToFirstResponseSeconds: 60,
      notes: 'Initial telephone qualification call completed with Muhammad Farooq.',
    },
  });

  // Lead 3: Overdue & Repeatedly Escalated lead in Recovery Queue
  const lead3 = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      contactId: contact2.id,
      title: '50kW Hybrid System Inquiry - Urgent Followup',
      source: 'WHATSAPP',
      status: 'ESCALATED',
      priority: 'URGENT',
      assignedMembershipId: emp2Member.id,
      assignedAt: new Date(Date.now() - 7200000),
      ackDeadlineAt: new Date(Date.now() - 3600000), // Expired!
      escalationLevel: 3,
      maxEscalationLevel: 3,
    },
  });

  await prisma.recoveryQueue.create({
    data: {
      workspaceId: workspace.id,
      leadId: lead3.id,
      reason: 'REPEATED_ESCALATION',
      escalationCount: 3,
      status: 'PENDING',
      notes: 'Lead expired acknowledgement deadline through 3 consecutive tiers. Requires manager intervention.',
    },
  });

  // 12. Sample Appointments
  await prisma.appointment.create({
    data: {
      workspaceId: workspace.id,
      title: 'On-site Technical Solar Survey',
      contactId: contact1.id,
      opportunityId: opp1.id,
      hostMembershipId: emp1Member.id,
      startTime: new Date(Date.now() + 86400000), // Tomorrow
      endTime: new Date(Date.now() + 90000000),
      location: 'Plot 42, Korangi Industrial Area, Karachi',
      status: 'SCHEDULED',
    },
  });

  // 13. Sample Payments (Safepay Sandbox)
  await prisma.payment.create({
    data: {
      workspaceId: workspace.id,
      opportunityId: opp1.id,
      contactId: contact1.id,
      amount: 450000, // 10% advance deposit
      currency: 'PKR',
      status: 'PAID',
      provider: 'SAFEPAY',
      providerReference: 'track_test_advance_450k',
      trackerToken: 'track_test_advance_450k',
      checkoutUrl: 'https://sandbox.api.getsafepay.com/components?beacon=track_test_advance_450k&env=sandbox',
      isSandbox: true,
      webhookReceivedAt: new Date(Date.now() - 7200000),
    },
  });

  await prisma.payment.create({
    data: {
      workspaceId: workspace.id,
      opportunityId: opp2.id,
      contactId: contact2.id,
      amount: 185000,
      currency: 'PKR',
      status: 'PENDING',
      provider: 'SAFEPAY',
      providerReference: 'track_pending_clinic_185k',
      trackerToken: 'track_pending_clinic_185k',
      checkoutUrl: 'https://sandbox.api.getsafepay.com/components?beacon=track_pending_clinic_185k&env=sandbox',
      isSandbox: true,
    },
  });

  // 14. Audit History Entries
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorType: 'USER',
      actorId: ownerUser.id,
      actorName: 'Bilal Khan',
      action: 'WORKSPACE_INITIALIZED',
      entityType: 'USER',
      entityId: workspace.id,
      reason: 'Company registration and baseline configuration initialized.',
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorType: 'SYSTEM',
      actorName: 'WorkNest Escalation Timer',
      action: 'LEAD_AUTOMATIC_ESCALATED',
      entityType: 'LEAD',
      entityId: lead3.id,
      reason: 'Acknowledgement timeout expired at Level 2. Reassigned to backup representative.',
    },
  });

  console.log('✅ WorkNest Database successfully seeded!');
  console.log('=======================================================');
  console.log(' Demo Accounts Created (Password: Password123!):');
  console.log(' Owner:   owner@worknest.app');
  console.log(' Admin:   admin@worknest.app');
  console.log(' Manager: manager@worknest.app');
  console.log(' Employee Available: hamza@worknest.app');
  console.log(' Employee Busy:      zainab@worknest.app');
  console.log(' Employee On Leave:  usman@worknest.app');
  console.log(' Employee Offline:   ayesha@worknest.app');
  console.log(' Public Lead Form Slug: apex-solar-pk');
  console.log('=======================================================');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
