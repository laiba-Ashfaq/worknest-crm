import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AuditLogItem } from '../types';
import {
  History,
  Shield,
  Search,
  Filter,
  RefreshCw,
  User,
  Cpu,
  Globe,
} from 'lucide-react';

export const AuditHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    try {
      const params: any = {};
      if (entityFilter) params.entityType = entityFilter;
      if (actionFilter) params.action = actionFilter;

      const res = await api.get('/audit', { params });
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter]);

  const getActorBadge = (type: string, name: string) => {
    if (type === 'SYSTEM') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <Cpu className="w-3 h-3" />
          <span>System Engine</span>
        </span>
      );
    } else if (type === 'WEBHOOK') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
          <Globe className="w-3 h-3" />
          <span>Integration Webhook</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-whitepace-navy border border-blue-200">
        <User className="w-3 h-3" />
        <span>{name}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-whitepace-navy">Append-Only Audit Trail</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-whitepace-blue">
              {logs.length} Events
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of all user actions, automatic lead escalations, availability changes, and integration callbacks.
          </p>
        </div>

        <button
          onClick={() => fetchLogs()}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-600 uppercase tracking-wider">Filter Audit Logs:</span>
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
        >
          <option value="">All Entities</option>
          <option value="LEAD">Leads & Accountability</option>
          <option value="CONTACT">Contacts</option>
          <option value="OPPORTUNITY">Opportunities</option>
          <option value="USER">Users & Availability</option>
          <option value="ROLE">Roles & Permissions</option>
          <option value="PAYMENT">Payments</option>
          <option value="APPOINTMENT">Appointments</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Entity & Target ID</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      {getActorBadge(log.actorType, log.actorName)}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-[11px]">
                      {log.action}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{log.entityType}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                        {log.entityId}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {log.reason || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
