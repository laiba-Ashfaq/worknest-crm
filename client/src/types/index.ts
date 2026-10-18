export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  role?: Role;
  user: User;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  availability: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'OFFLINE';
  availabilityReason?: string;
  maxOpenLeads: number;
  currentOpenLeads: number;
  lastAssignedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  rolePermissions?: { permission: { code: string; name: string } }[];
}

export interface Contact {
  id: string;
  workspaceId: string;
  name: string;
  email?: string;
  phone: string;
  companyId?: string;
  company?: Company;
  leadSource: string;
  tags: string;
  notes?: string;
  consentStatus: 'OPTED_IN' | 'OPTED_OUT';
  assignedMembershipId?: string;
  assignedRep?: WorkspaceMembership;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  _count?: { contacts: number; opportunities: number };
}

export interface Lead {
  id: string;
  workspaceId: string;
  contactId: string;
  contact: Contact;
  title: string;
  source: 'PUBLIC_FORM' | 'WHATSAPP' | 'MANUAL';
  status: 'UNASSIGNED' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED' | 'LOST';
  assignedMembershipId?: string;
  assignedRep?: WorkspaceMembership;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  escalationLevel: number;
  maxEscalationLevel: number;
  assignedAt?: string;
  ackDeadlineAt?: string;
  acknowledgedAt?: string;
  ackMethod?: 'MANUAL' | 'NOTE' | 'MESSAGE' | 'CALL' | 'STAGE_CHANGE' | 'APPOINTMENT';
  timeToFirstResponseSeconds?: number;
  remainingSeconds?: number;
  isOverdue?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  assignmentHistory?: any[];
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  customFields?: CustomField[];
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  requiredFieldNames: string;
  opportunities?: Opportunity[];
}

export interface Opportunity {
  id: string;
  workspaceId: string;
  title: string;
  contactId: string;
  contact: Contact;
  companyId?: string;
  company?: Company;
  pipelineId: string;
  pipeline?: Pipeline;
  stageId: string;
  stage: PipelineStage;
  expectedValue: number;
  currency: string;
  assignedMembershipId?: string;
  assignedRep?: WorkspaceMembership;
  status: 'OPEN' | 'WON' | 'LOST';
  expectedCloseDate?: string;
  customFields: Record<string, any>;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  createdAt: string;
}

export interface CustomField {
  id: string;
  name: string;
  key: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'CHECKBOX';
  options: string[];
  isRequired: boolean;
  order: number;
}

export interface RecoveryQueueItem {
  id: string;
  leadId: string;
  leadTitle: string;
  customerName: string;
  customerPhone: string;
  currentOwner: string;
  currentOwnerId?: string;
  source: string;
  reason: 'OVERDUE_ACK' | 'REPEATED_ESCALATION' | 'IDLE_NO_ACTIVITY' | 'UNASSIGNED_FALLBACK';
  escalationCount: number;
  hoursSinceActivity: number;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  contact: Contact;
  channel: string;
  status: string;
  lastMessageAt: string;
  messages: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderId?: string;
  content: string;
  channel: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
}

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  contactId: string;
  contact: Contact;
  opportunityId?: string;
  opportunity?: Opportunity;
  hostMembershipId: string;
  hostRep: WorkspaceMembership;
  startTime: string;
  endTime: string;
  timezone: string;
  status: 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';
  location?: string;
}

export interface Payment {
  id: string;
  opportunityId?: string;
  opportunity?: Opportunity;
  contactId: string;
  contact: Contact;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  provider: string;
  providerReference?: string;
  checkoutUrl?: string;
  isSandbox: boolean;
  createdAt: string;
}

export interface IntegrationStatus {
  provider: string;
  code: string;
  isConnected: boolean;
  statusLabel: string;
  isSandbox?: boolean;
  lastActivityAt?: string;
  lastError?: string;
  capabilities: string[];
  setupInstructions: string;
}

export interface DashboardMetrics {
  leadsToday: number;
  openPipelineValue: number;
  stageBreakdown: { stageId: string; stageName: string; color: string; count: number; value: number }[];
  avgFirstResponseSeconds: number;
  avgFirstResponseFormatted: string;
  recoveryQueueCount: number;
  escalations24h: number;
  availabilitySummary: {
    available: number;
    busy: number;
    onLeave: number;
    offline: number;
    totalMembers: number;
    roster: { id: string; name: string; availability: string; leads: string }[];
  };
  upcomingAppointmentsCount: number;
  upcomingAppointments: Appointment[];
  collectedThisMonth: number;
  projectedThisMonth: number;
  currency: string;
}

export interface AuditLogItem {
  id: string;
  actorType: 'USER' | 'SYSTEM' | 'WEBHOOK';
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  reason?: string;
  createdAt: string;
}
