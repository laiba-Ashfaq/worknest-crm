import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { WorkspaceMembership, Role } from '../types';
import {
  Users2,
  ShieldCheck,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

export const TeamPage: React.FC = () => {
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rules, setRules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Assignment rules form state
  const [roundRobin, setRoundRobin] = useState(true);
  const [maxLeads, setMaxLeads] = useState(10);
  const [ackWindow, setAckWindow] = useState(30);
  const [isDemoMode, setIsDemoMode] = useState(true);

  const fetchData = async () => {
    try {
      const [mRes, wsRes] = await Promise.all([
        api.get('/workspaces/members'),
        api.get('/workspaces'),
      ]);

      setMembers(mRes.data);
      setRoles(wsRes.data.roles || []);
      const r = wsRes.data.assignmentRules;
      if (r) {
        setRules(r);
        setRoundRobin(r.roundRobinEnabled);
        setMaxLeads(r.maxOpenLeadsPerRep);
        setAckWindow(r.defaultAckWindowSeconds);
        setIsDemoMode(r.isDemoMode);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateAvailability = async (memberId: string, availability: string) => {
    try {
      await api.put(`/workspaces/members/${memberId}/availability`, {
        availability,
        reason: availability === 'ON_LEAVE' ? 'Annual leave' : undefined,
      });

      setStatusMessage(`Updated availability to ${availability}. If set to On Leave/Offline, unacknowledged leads were automatically reassigned.`);
      fetchData();
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update availability.');
    }
  };

  const handleUpdateRole = async (memberId: string, roleId: string) => {
    try {
      await api.put(`/workspaces/members/${memberId}/role`, { roleId });
      setStatusMessage('Role updated successfully.');
      fetchData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role.');
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/workspaces/assignment-rules', {
        roundRobinEnabled: roundRobin,
        maxOpenLeadsPerRep: Number(maxLeads),
        defaultAckWindowSeconds: Number(ackWindow),
        isDemoMode,
        demoTimerSeconds: Number(ackWindow),
      });

      setStatusMessage('Assignment rules updated. Changes apply to all new incoming leads immediately.');
      fetchData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update assignment rules.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-whitepace-navy">Team Roster & Assignment Rules</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage team availability, role-based capabilities, and the automated lead assignment engine.
        </p>
      </div>

      {/* Success / Alert Banner */}
      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{statusMessage}</span>
        </div>
      )}

      {/* Team Members List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-sm text-whitepace-navy flex items-center space-x-2">
            <Users2 className="w-4 h-4 text-whitepace-blue" />
            <span>Workspace Members ({members.length})</span>
          </h2>
          <span className="text-xs text-slate-500">Essential Safeguard: Owner cannot be removed by Admin</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Current Capacity</th>
                <th className="py-3 px-4">Availability Status</th>
                <th className="py-3 px-4 text-right">Update Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-sm">{m.user.fullName}</div>
                    <div className="text-slate-500 text-[11px]">{m.user.email}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-whitepace-navy border border-blue-200">
                      {m.role?.name || 'Member'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-700">
                    {m.currentOpenLeads} / {m.maxOpenLeads} open leads
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        m.availability === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.availability === 'BUSY'
                          ? 'bg-amber-100 text-amber-800'
                          : m.availability === 'ON_LEAVE'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {m.availability}
                    </span>
                    {m.availabilityReason && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{m.availabilityReason}</div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    <select
                      value={m.availability}
                      onChange={(e) => handleUpdateAvailability(m.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-whitepace-blue"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="BUSY">Busy</option>
                      <option value="ON_LEAVE">On Leave (Reassigns Leads)</option>
                      <option value="OFFLINE">Offline (Reassigns Leads)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Rules Engine Settings */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-2xl">
        <div className="flex items-center space-x-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-whitepace-navy">Automated Assignment & Escalation Engine</h2>
        </div>

        <form onSubmit={handleSaveRules} className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="font-bold text-xs text-slate-800">Round-Robin Intake Distribution</div>
              <div className="text-[11px] text-slate-500">Cycles incoming leads evenly among available representatives</div>
            </div>
            <input
              type="checkbox"
              checked={roundRobin}
              onChange={(e) => setRoundRobin(e.target.checked)}
              className="w-4 h-4 text-whitepace-blue rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Max Open Leads Per Rep</label>
              <input
                type="number"
                min={1}
                value={maxLeads}
                onChange={(e) => setMaxLeads(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Acknowledgement SLA (Seconds)
              </label>
              <input
                type="number"
                min={5}
                value={ackWindow}
                onChange={(e) => setAckWindow(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div>
              <div className="font-bold text-xs text-whitepace-navy">Hackathon Demonstration Fast Timer Mode</div>
              <div className="text-[11px] text-slate-600">Sets timers to seconds so judges can observe live escalation without waiting minutes.</div>
            </div>
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setIsDemoMode(e.target.checked)}
              className="w-4 h-4 text-whitepace-blue rounded"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md transition"
          >
            Save Assignment Policy
          </button>
        </form>
      </div>
    </div>
  );
};
