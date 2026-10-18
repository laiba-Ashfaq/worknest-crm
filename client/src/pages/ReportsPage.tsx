import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Users2, Clock, Flame, CreditCard,
  Calendar, CheckCircle2, AlertTriangle, Download,
} from 'lucide-react';

const COLORS = ['#4F9CF9', '#043873', '#FFE492', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const ReportsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'pipeline' | 'team'>('overview');

  const fetchData = async () => {
    try {
      const [metricsRes, leadsRes, membersRes, opportunitiesRes, paymentsRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/leads?limit=200'),
        api.get('/workspaces/members'),
        api.get('/crm/opportunities?limit=200'),
        api.get('/payments?limit=200'),
      ]);

      setMetrics({
        dashboard: metricsRes.data,
        leads: leadsRes.data,
        members: membersRes.data,
        opportunities: opportunitiesRes.data,
        payments: paymentsRes.data,
      });
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whitepace-blue" />
      </div>
    );
  }

  const formatPKR = (n: number) => 'PKR ' + Number(n || 0).toLocaleString();

  // Compute lead status breakdown
  const leads = metrics?.leads || [];
  const statusCounts = leads.reduce((acc: any, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const leadStatusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Compute priority breakdown
  const priorityCounts = leads.reduce((acc: any, l: any) => {
    acc[l.priority] = (acc[l.priority] || 0) + 1;
    return acc;
  }, {});
  const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({ name, value }));

  // Compute source breakdown
  const sourceCounts = leads.reduce((acc: any, l: any) => {
    const source = l.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

  // Member performance
  const members = metrics?.members || [];
  const memberData = members.map((m: any) => ({
    name: m.user.fullName.split(' ')[0],
    openLeads: m.currentOpenLeads || 0,
    maxLeads: m.maxOpenLeads || 10,
    availability: m.availability,
  }));

  // Pipeline opportunities by stage
  const stageBreakdown = metrics?.dashboard?.stageBreakdown || [];

  // Payments breakdown
  const payments = metrics?.payments || [];
  const paymentStatusCounts = payments.reduce((acc: any, p: any) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const paymentData = Object.entries(paymentStatusCounts).map(([name, value]) => ({ name, value }));
  const totalRevenue = payments.filter((p: any) => p.status === 'PAID').reduce((s: number, p: any) => s + p.amount, 0);
  const pendingRevenue = payments.filter((p: any) => p.status === 'PENDING').reduce((s: number, p: any) => s + p.amount, 0);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'leads', label: 'Lead Analytics' },
    { key: 'pipeline', label: 'Pipeline & Revenue' },
    { key: 'team', label: 'Team Performance' },
  ];

  const StatCard: React.FC<{ title: string; value: string | number; subtitle?: string; icon: React.ElementType; color: string }> =
    ({ title, value, subtitle, icon: Icon, color }) => (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start space-x-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-xl font-extrabold text-whitepace-navy mt-0.5 truncate">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-whitepace-navy">Reports & Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Operational insights, team performance, revenue analytics, and lead accountability metrics.
          </p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm">
          <Download className="w-4 h-4" />
          <span>Export Report</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-whitepace-navy shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Leads"
              value={leads.length}
              subtitle={`${leads.filter((l: any) => l.status === 'NEW').length} new awaiting assignment`}
              icon={Flame}
              color="bg-blue-50 text-whitepace-blue"
            />
            <StatCard
              title="Avg. First Response"
              value={metrics?.dashboard?.avgFirstResponseFormatted || '—'}
              subtitle="Time from lead creation to acknowledgement"
              icon={Clock}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Revenue Collected"
              value={formatPKR(totalRevenue)}
              subtitle={`${formatPKR(pendingRevenue)} still pending`}
              icon={CreditCard}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              title="Recovery Queue"
              value={metrics?.dashboard?.recoveryQueueCount || 0}
              subtitle="Leads requiring supervisor intervention"
              icon={AlertTriangle}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Two chart row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pipeline Value by Stage */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-whitepace-navy mb-1">Pipeline Value by Stage</h3>
              <p className="text-xs text-slate-400 mb-4">Open opportunities value breakdown</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="stageName" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(v: any) => [formatPKR(Number(v)), 'Value']}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #E2E8F0' }}
                    />
                    <Bar dataKey="value" fill="#4F9CF9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lead Status Pie */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-whitepace-navy mb-1">Lead Status Distribution</h3>
              <p className="text-xs text-slate-400 mb-4">Current state of all leads in the system</p>
              <div className="h-56 flex items-center justify-center">
                {leadStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={leadStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {leadStatusData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400">No lead data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Analytics Tab */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Leads" value={leads.length} icon={Flame} color="bg-blue-50 text-whitepace-blue" />
            <StatCard title="Acknowledged" value={leads.filter((l: any) => l.status === 'ACKNOWLEDGED').length} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
            <StatCard title="Escalated" value={leads.filter((l: any) => l.status === 'ESCALATED').length} icon={AlertTriangle} color="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Priority */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-whitepace-navy mb-4">Leads by Priority</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="value" fill="#043873" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By Source */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-whitepace-navy mb-4">Lead Sources</h3>
              <div className="h-52">
                {sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400">No source data</div>
                )}
              </div>
            </div>
          </div>

          {/* Escalation metrics */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-whitepace-navy mb-1">Escalation & SLA Metrics</h3>
            <p className="text-xs text-slate-400 mb-5">Accountability performance over the workspace lifecycle</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Avg. First Response', value: metrics?.dashboard?.avgFirstResponseFormatted || '—', color: 'text-whitepace-blue' },
                { label: 'Auto-Escalations (24h)', value: metrics?.dashboard?.escalations24h || 0, color: 'text-amber-600' },
                { label: 'In Recovery Queue', value: metrics?.dashboard?.recoveryQueueCount || 0, color: 'text-rose-600' },
                { label: 'Total Members', value: metrics?.dashboard?.availabilitySummary?.totalMembers || 0, color: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-4">
                  <div className={`text-2xl font-extrabold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline & Revenue Tab */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Open Pipeline" value={formatPKR(metrics?.dashboard?.openPipelineValue || 0)} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
            <StatCard title="Revenue Collected" value={formatPKR(totalRevenue)} icon={CreditCard} color="bg-emerald-50 text-emerald-600" />
            <StatCard title="Pending Payments" value={formatPKR(pendingRevenue)} icon={CreditCard} color="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-whitepace-navy mb-4">Pipeline Stage Performance</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageBreakdown} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis dataKey="stageName" type="category" width={90} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip formatter={(v: any) => [formatPKR(Number(v)), 'Value']} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#4F9CF9" name="Opportunities" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-whitepace-navy mb-4">Payment Status Breakdown</h3>
              <div className="h-60 flex items-center justify-center">
                {paymentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} label>
                        {paymentData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400">No payment data</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Performance Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {(['AVAILABLE', 'BUSY', 'ON_LEAVE', 'OFFLINE'] as const).map((status) => {
              const colors: Record<string, string> = {
                AVAILABLE: 'bg-emerald-50 text-emerald-700',
                BUSY: 'bg-amber-50 text-amber-700',
                ON_LEAVE: 'bg-rose-50 text-rose-700',
                OFFLINE: 'bg-slate-100 text-slate-600',
              };
              const labels: Record<string, string> = {
                AVAILABLE: 'Available', BUSY: 'Busy', ON_LEAVE: 'On Leave', OFFLINE: 'Offline',
              };
              const count = members.filter((m: any) => m.availability === status).length;
              return (
                <div key={status} className={`rounded-2xl p-5 border border-slate-200 ${colors[status]}`}>
                  <div className="text-3xl font-extrabold">{count}</div>
                  <div className="text-xs font-semibold mt-1">{labels[status]}</div>
                </div>
              );
            })}
          </div>

          {/* Member Lead Load */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-whitepace-navy mb-1">Team Lead Load</h3>
            <p className="text-xs text-slate-400 mb-4">Open lead count vs. maximum capacity per representative</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="openLeads" name="Open Leads" fill="#4F9CF9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxLeads" name="Max Capacity" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Member table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-whitepace-navy">Team Roster</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Member</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Availability</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Open Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member: any) => {
                  const availColors: Record<string, string> = {
                    AVAILABLE: 'bg-emerald-100 text-emerald-700',
                    BUSY: 'bg-amber-100 text-amber-700',
                    ON_LEAVE: 'bg-rose-100 text-rose-700',
                    OFFLINE: 'bg-slate-100 text-slate-600',
                  };
                  return (
                    <tr key={member.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-whitepace-navy/10 text-whitepace-navy flex items-center justify-center font-bold text-xs">
                            {member.user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{member.user.fullName}</div>
                            <div className="text-xs text-slate-400">{member.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs font-medium text-slate-600">{member.role?.name || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${availColors[member.availability] || 'bg-slate-100 text-slate-600'}`}>
                          {member.availability?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-semibold text-slate-800">
                        {member.currentOpenLeads} / {member.maxOpenLeads}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
