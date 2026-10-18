import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { IntegrationStatus } from '../types';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  CreditCard,
  Calendar,
  Mail,
  Zap,
  History,
  ShieldCheck,
} from 'lucide-react';

export const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    try {
      const [intRes, logRes] = await Promise.all([
        api.get('/integrations'),
        api.get('/integrations/logs'),
      ]);
      setIntegrations(intRes.data);
      setLogs(logRes.data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const getProviderIcon = (code: string) => {
    switch (code) {
      case 'WHATSAPP':
        return <MessageSquare className="w-6 h-6 text-emerald-600" />;
      case 'SAFEPAY':
      case 'JAZZCASH':
      case 'EASYPAISA':
        return <CreditCard className="w-6 h-6 text-whitepace-blue" />;
      case 'GOOGLE_CALENDAR':
        return <Calendar className="w-6 h-6 text-indigo-600" />;
      case 'SMTP':
        return <Mail className="w-6 h-6 text-amber-600" />;
      default:
        return <Cpu className="w-6 h-6 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-whitepace-navy">Central Integrations Hub</h1>
        <p className="text-xs text-slate-500 mt-1">
          Authorized external service adapters for Pakistan and international communication, payments, and calendar scheduling.
        </p>
      </div>

      {/* Strict Compliance Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-whitepace-blue flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Strict Hackathon Compliance: </span>
          WorkNest strictly integrates localized providers (Meta WhatsApp Cloud API, Safepay Sandbox in PKR, Google Calendar OAuth, and SMTP). No Stripe, Twilio, or Telegram are used.
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((item) => (
          <div
            key={item.code}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {getProviderIcon(item.code)}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                    item.isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : item.statusLabel.includes('Future')
                      ? 'bg-slate-50 text-slate-500 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {item.statusLabel}
                </span>
              </div>

              <h3 className="font-bold text-base text-whitepace-navy mb-2">{item.provider}</h3>

              <div className="space-y-1.5 mb-4">
                {item.capabilities.map((cap, i) => (
                  <div key={i} className="flex items-center space-x-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="truncate">{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                {item.setupInstructions}
              </div>
              {item.code === 'GOOGLE_CALENDAR' && !item.isConnected && (
                <button
                  onClick={() => {
                    window.location.href = '/api/integrations/google-calendar/connect';
                  }}
                  className="mt-3 w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Connect Google Calendar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Integration Synchronization & Webhook Event Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="font-bold text-sm text-whitepace-navy flex items-center space-x-2">
            <History className="w-4 h-4 text-whitepace-blue" />
            <span>Synchronization & Inbound Webhook Event Log ({logs.length})</span>
          </div>
          <span className="text-xs text-slate-400">Append-only audit trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Provider Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No integration events logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{log.provider}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.direction === 'INBOUND' ? 'bg-cyan-50 text-cyan-700' : 'bg-purple-50 text-purple-700'}`}>
                        {log.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{log.eventType}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{log.providerReference || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
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
