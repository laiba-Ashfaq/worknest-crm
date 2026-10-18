import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { RecoveryQueueItem, WorkspaceMembership } from '../types';
import {
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Phone,
  ShieldAlert,
} from 'lucide-react';

export const RecoveryQueuePage: React.FC = () => {
  const [items, setItems] = useState<RecoveryQueueItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RecoveryQueueItem | null>(null);
  const [targetMemberId, setTargetMemberId] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const fetchQueue = async () => {
    try {
      const res = await api.get('/recovery');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to load recovery queue:', err);
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
    fetchQueue();
    fetchMembers();

    const socket = getSocket();
    if (socket) {
      const handleRefresh = () => fetchQueue();
      socket.on('recovery_queue_updated', handleRefresh);
      socket.on('lead_assigned', handleRefresh);
      socket.on('lead_acknowledged', handleRefresh);

      return () => {
        socket.off('recovery_queue_updated', handleRefresh);
        socket.off('lead_assigned', handleRefresh);
        socket.off('lead_acknowledged', handleRefresh);
      };
    }
  }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !targetMemberId) return;

    try {
      await api.post(`/recovery/${selectedItem.id}/reassign`, {
        targetMembershipId: targetMemberId,
        notes: resolutionNote || 'Reassigned from supervisor recovery queue.',
      });

      setSelectedItem(null);
      setTargetMemberId('');
      setResolutionNote('');
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reassign recovery item.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-whitepace-navy">Supervisor Recovery Queue</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {items.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Overdue, repeatedly escalated, or unassigned fallback opportunities requiring management intervention.
          </p>
        </div>

        <button
          onClick={() => fetchQueue()}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Warning Explanation Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Automated Safety Net: </span>
          Leads arrive here when all round-robin escalation tiers expire without a response, when reps are absent, or when team capacity is saturated. Reassigning here restarts accountability.
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Opportunity & Customer</th>
                <th className="py-3 px-4">Current Owner</th>
                <th className="py-3 px-4">Inclusion Reason</th>
                <th className="py-3 px-4">Escalations</th>
                <th className="py-3 px-4">Idle Duration</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-slate-700">Recovery Queue is Empty</div>
                    <div className="text-xs text-slate-400 mt-0.5">All leads are handled within SLA!</div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{item.leadTitle}</div>
                      <div className="text-slate-500 mt-0.5 flex items-center space-x-2">
                        <span className="font-medium text-slate-700">{item.customerName}</span>
                        <span>•</span>
                        <span>{item.customerPhone}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.currentOwner}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {item.reason}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      {item.escalationCount} Tiers Expired
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {item.hoursSinceActivity}h since activity
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="px-3.5 py-1.5 rounded-lg bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-sm transition inline-flex items-center space-x-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Recover & Assign</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recover & Reassign Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Recover Opportunity</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select a designated rep or take personal responsibility for "{selectedItem.leadTitle}".
            </p>
            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Accountable Owner</label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">-- Choose Eligible Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.fullName} ({m.availability} • {m.currentOpenLeads}/{m.maxOpenLeads} open)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Triage Note</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  placeholder="Escalation resolved by supervisor. Reassigned to Senior Consultant for VIP outreach."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold"
                >
                  Resolve & Reassign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
