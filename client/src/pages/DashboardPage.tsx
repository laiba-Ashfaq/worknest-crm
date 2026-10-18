import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { DashboardMetrics } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import {
  Flame,
  TrendingUp,
  Clock,
  AlertTriangle,
  History,
  Users2,
  Calendar,
  CreditCard,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/dashboard/metrics');
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    const socket = getSocket();
    if (socket) {
      const handleRefresh = () => fetchMetrics();
      socket.on('lead_received', handleRefresh);
      socket.on('lead_assigned', handleRefresh);
      socket.on('lead_acknowledged', handleRefresh);
      socket.on('recovery_queue_updated', handleRefresh);
      socket.on('payment_updated', handleRefresh);
      socket.on('member_availability_updated', handleRefresh);

      return () => {
        socket.off('lead_received', handleRefresh);
        socket.off('lead_assigned', handleRefresh);
        socket.off('lead_acknowledged', handleRefresh);
        socket.off('recovery_queue_updated', handleRefresh);
        socket.off('payment_updated', handleRefresh);
        socket.off('member_availability_updated', handleRefresh);
      };
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whitepace-blue" />
      </div>
    );
  }

  const formatPKR = (amount: number) => {
    return 'PKR ' + Number(amount || 0).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-whitepace-navy">Operational Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time business performance, lead accountability metrics, and team availability.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/leads')}
            className="px-4 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
          >
            <Flame className="w-4 h-4" />
            <span>Open Leads Feed</span>
          </button>
        </div>
      </div>

      {/* 8 Live Operational Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. New Leads Received Today */}
        <MetricCard
          title="New Leads Today"
          value={metrics?.leadsToday ?? 0}
          subtitle="Real-time intake from web & WhatsApp"
          icon={Flame}
          iconBg="bg-blue-50"
          iconColor="text-whitepace-blue"
          badge="+Live"
          badgeColor="bg-blue-50 text-blue-700 border-blue-200"
          onClick={() => navigate('/leads')}
        />

        {/* 2. Open Pipeline Value */}
        <MetricCard
          title="Open Pipeline Value"
          value={formatPKR(metrics?.openPipelineValue ?? 0)}
          subtitle="Active opportunities before close"
          icon={TrendingUp}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          onClick={() => navigate('/pipeline')}
        />

        {/* 3. Average Time to First Response */}
        <MetricCard
          title="Avg Time to First Response"
          value={metrics?.avgFirstResponseFormatted || '0s'}
          subtitle="Assignment to first qualifying action"
          icon={Clock}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          badge="SLA Tracked"
          badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
          onClick={() => navigate('/leads')}
        />

        {/* 4. Recovery Queue Leads */}
        <MetricCard
          title="Recovery Queue"
          value={metrics?.recoveryQueueCount ?? 0}
          subtitle="Overdue or repeatedly escalated"
          icon={AlertTriangle}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          badge={metrics?.recoveryQueueCount ? 'Attention Needed' : 'Queue Clear'}
          badgeColor={
            metrics?.recoveryQueueCount
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }
          onClick={() => navigate('/recovery')}
        />

        {/* 5. Automatic Escalations (24h) */}
        <MetricCard
          title="Escalations (24h)"
          value={metrics?.escalations24h ?? 0}
          subtitle="Expired acknowledgement windows"
          icon={History}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          onClick={() => navigate('/leads?status=ESCALATED')}
        />

        {/* 6. Employee Availability */}
        <MetricCard
          title="Team Available"
          value={`${metrics?.availabilitySummary.available ?? 0}/${metrics?.availabilitySummary.totalMembers ?? 0}`}
          subtitle={`${metrics?.availabilitySummary.busy ?? 0} busy, ${metrics?.availabilitySummary.onLeave ?? 0} on leave`}
          icon={Users2}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
          onClick={() => navigate('/team')}
        />

        {/* 7. Upcoming Appointments */}
        <MetricCard
          title="Upcoming Appointments"
          value={metrics?.upcomingAppointmentsCount ?? 0}
          subtitle="Synced client audits & surveys"
          icon={Calendar}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          onClick={() => navigate('/appointments')}
        />

        {/* 8. Payments Received This Month */}
        <MetricCard
          title="Collected This Month"
          value={formatPKR(metrics?.collectedThisMonth ?? 0)}
          subtitle={`Projected: ${formatPKR(metrics?.projectedThisMonth ?? 0)}`}
          icon={CreditCard}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          badge="Safepay Sandbox"
          badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
          onClick={() => navigate('/payments')}
        />
      </div>

      {/* Middle Row: Pipeline Stages Chart & Availability Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Distribution Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-whitepace-navy">Pipeline Value by Stage</h2>
              <p className="text-xs text-slate-500">Breakdown of opportunities across sales milestones</p>
            </div>
            <button
              onClick={() => navigate('/pipeline')}
              className="text-xs font-semibold text-whitepace-blue hover:underline flex items-center space-x-1"
            >
              <span>View Board</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64">
            {metrics?.stageBreakdown && metrics.stageBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.stageBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="stageName" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(value: any) => [formatPKR(Number(value)), 'Value']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#4F9CF9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                No active stages found.
              </div>
            )}
          </div>
        </div>

        {/* Team Availability Roster Widget */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-whitepace-navy">Team Availability</h2>
              <p className="text-xs text-slate-500">Live roster & capacity limits</p>
            </div>
            <button
              onClick={() => navigate('/team')}
              className="text-xs font-semibold text-whitepace-blue hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-64 custom-scrollbar pr-1">
            {metrics?.availabilitySummary.roster.map((member) => {
              const statusMap: Record<string, { label: string; dot: string }> = {
                AVAILABLE: { label: 'Available', dot: 'bg-emerald-500' },
                BUSY: { label: 'Busy', dot: 'bg-amber-500' },
                ON_LEAVE: { label: 'On Leave', dot: 'bg-rose-500' },
                OFFLINE: { label: 'Offline', dot: 'bg-slate-400' },
              };
              const s = statusMap[member.availability] || statusMap.AVAILABLE;

              return (
                <div key={member.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`} />
                    <span className="font-semibold text-slate-800 truncate">{member.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-[11px] text-slate-400">{member.leads} leads</span>
                    <span className="font-medium text-slate-600">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Alert Banner: Recovery Queue */}
      {(metrics?.recoveryQueueCount ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-amber-900 text-sm">
                {metrics?.recoveryQueueCount} lead(s) require immediate supervisor intervention
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Leads have passed their acknowledgement deadlines or escalated through multiple tiers without response.
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/recovery')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition flex-shrink-0"
          >
            Open Recovery Queue
          </button>
        </div>
      )}
    </div>
  );
};
