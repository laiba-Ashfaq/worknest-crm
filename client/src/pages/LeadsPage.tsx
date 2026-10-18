import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Lead, WorkspaceMembership } from '../types';
import {
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Plus,
  Search,
  Filter,
  MessageSquare,
  FileText,
  Phone,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals state
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [targetMemberId, setTargetMemberId] = useState('');

  // New lead form state
  const [newTitle, setNewTitle] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newAssignee, setNewAssignee] = useState('');

  const fetchLeads = async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/leads', { params });
      setLeads(res.data);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await api.get('/workspaces/members');
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchMembers();

    // Real-time local countdown timer tick every second!
    const timerInterval = setInterval(() => {
      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.remainingSeconds !== undefined && lead.remainingSeconds > 0) {
            return {
              ...lead,
              remainingSeconds: lead.remainingSeconds - 1,
              isOverdue: lead.remainingSeconds - 1 <= 0,
            };
          }
          return lead;
        })
      );
    }, 1000);

    const socket = getSocket();
    if (socket) {
      const handleEvent = () => fetchLeads();
      socket.on('lead_received', handleEvent);
      socket.on('lead_assigned', handleEvent);
      socket.on('lead_acknowledged', handleEvent);
      socket.on('recovery_queue_updated', handleEvent);

      return () => {
        clearInterval(timerInterval);
        socket.off('lead_received', handleEvent);
        socket.off('lead_assigned', handleEvent);
        socket.off('lead_acknowledged', handleEvent);
        socket.off('recovery_queue_updated', handleEvent);
      };
    }

    return () => clearInterval(timerInterval);
  }, [statusFilter, search]);

  const handleAcknowledge = async (leadId: string) => {
    try {
      await api.post(`/leads/${leadId}/acknowledge`);
      fetchLeads();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to acknowledge lead.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !noteText) return;

    try {
      await api.post(`/leads/${selectedLead.id}/notes`, { note: noteText });
      setIsNoteOpen(false);
      setNoteText('');
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add note.');
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !targetMemberId) return;

    try {
      await api.post(`/leads/${selectedLead.id}/reassign`, {
        newMembershipId: targetMemberId,
      });
      setIsReassignOpen(false);
      setTargetMemberId('');
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reassign lead.');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Create or ensure contact
      const contactRes = await api.post('/crm/contacts', {
        name: newName,
        phone: newPhone,
        email: newEmail,
      });

      // 2. Create lead
      await api.post('/leads', {
        contactId: contactRes.data.id,
        title: newTitle,
        priority: newPriority,
        assignToMembershipId: newAssignee || undefined,
      });

      setIsNewLeadOpen(false);
      setNewTitle('');
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewAssignee('');
      fetchLeads();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create lead.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-whitepace-navy">Lead Accountability Feed</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-whitepace-blue">
              {leads.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Every lead has exactly one accountable owner. Unattended leads automatically escalate.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchLeads()}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsNewLeadOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Lead</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads, names, phones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
          >
            <option value="">All Statuses</option>
            <option value="ASSIGNED">Assigned (Awaiting Response)</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="ESCALATED">Escalated</option>
            <option value="RESOLVED">Resolved</option>
            <option value="UNASSIGNED">Unassigned / In Recovery</option>
          </select>
        </div>
      </div>

      {/* Leads List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Lead & Contact</th>
                <th className="py-3 px-4">Accountable Owner</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">SLA Countdown</th>
                <th className="py-3 px-4">Status & Escalation</th>
                <th className="py-3 px-4 text-right">Accountability Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isAssigned = lead.status === 'ASSIGNED' || lead.status === 'ESCALATED';
                  const remaining = lead.remainingSeconds ?? 0;
                  const isOverdue = lead.isOverdue || (isAssigned && remaining <= 0);

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Lead Title & Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm hover:text-whitepace-blue cursor-pointer">
                          {lead.title}
                        </div>
                        <div className="text-slate-500 mt-0.5 flex items-center space-x-2">
                          <span className="font-medium text-slate-700">{lead.contact.name}</span>
                          <span>•</span>
                          <span>{lead.contact.phone}</span>
                        </div>
                      </td>

                      {/* Current Owner */}
                      <td className="py-3.5 px-4">
                        {lead.assignedRep ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-whitepace-blue border border-blue-200 flex items-center justify-center font-bold text-xs">
                              {lead.assignedRep.user.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{lead.assignedRep.user.fullName}</div>
                              <div className="text-[10px] text-slate-400 capitalize">
                                {lead.assignedRep.availability.toLowerCase()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Unassigned Fallback</span>
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {lead.source}
                        </span>
                      </td>

                      {/* SLA Countdown Timer */}
                      <td className="py-3.5 px-4">
                        {isAssigned ? (
                          <div
                            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full font-bold text-xs border ${
                              isOverdue
                                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                : remaining < 15
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-blue-50 text-whitepace-blue border-blue-200'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{isOverdue ? 'Overdue - Escalating' : `⏱ ${remaining}s left`}</span>
                          </div>
                        ) : lead.status === 'ACKNOWLEDGED' ? (
                          <div className="text-emerald-700 font-medium flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Responded in {lead.timeToFirstResponseSeconds ?? 0}s</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status & Escalations */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              lead.status === 'ACKNOWLEDGED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lead.status === 'ASSIGNED'
                                ? 'bg-blue-100 text-blue-800'
                                : lead.status === 'ESCALATED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {lead.status}
                          </span>
                          {lead.escalationLevel > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Lvl {lead.escalationLevel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {isAssigned && (
                          <button
                            onClick={() => handleAcknowledge(lead.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition inline-flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Acknowledge</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsNoteOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs transition inline-flex items-center space-x-1"
                          title="Add Note (Qualifying action for acknowledgement)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Note</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsReassignOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs transition inline-flex items-center space-x-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Reassign</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Modal */}
      {isNoteOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Add Note to Lead</h3>
            <p className="text-xs text-slate-500 mb-4">
              Adding a qualification note acts as an immediate response acknowledgement!
            </p>
            <form onSubmit={handleAddNote} className="space-y-4">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                required
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                placeholder="Call conducted. Client requested quote for 15kW installation..."
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNoteOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold"
                >
                  Save Note & Acknowledge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {isReassignOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Manual Reassignment</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select an available colleague to take immediate accountability of "{selectedLead.title}".
            </p>
            <form onSubmit={handleReassign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Colleague</label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">-- Choose Team Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.fullName} ({m.availability} • {m.currentOpenLeads}/{m.maxOpenLeads} leads)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsReassignOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold"
                >
                  Reassign Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {isNewLeadOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Create Lead Manually</h3>
            <p className="text-xs text-slate-500 mb-4">
              Directly capture a phone inquiry or walk-in customer into the assignment engine.
            </p>
            <form onSubmit={handleCreateLead} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inquiry / Opportunity Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. 50kW Hospital Backup Inverter"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Muhammad Ali"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone (+92)</label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="03001234567"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="customer@domain.pk"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assignee</label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">Auto Round-Robin (Recommended)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.fullName} ({m.availability})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewLeadOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md"
                >
                  Create & Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
