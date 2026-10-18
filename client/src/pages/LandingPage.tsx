import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  MessageSquare,
  CreditCard,
  Building2,
  CheckCircle2,
  Users,
  Kanban,
  FileSpreadsheet,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-whitepace-text font-sans">
      {/* Navigation Bar */}
      <header className="bg-whitepace-navy text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-whitepace-blue flex items-center justify-center font-bold text-white shadow-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight text-white leading-none">WorkNest</span>
              <span className="text-[10px] text-whitepace-yellow font-semibold tracking-wider uppercase">
                Unified Business Management
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-white/80">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#accountability" className="hover:text-white transition">Lead Accountability</a>
            <a href="#integrations" className="hover:text-white transition">Pakistan Integrations</a>
            <a href="/public/lead/apex-solar-pk" className="hover:text-white transition">Public Lead Form</a>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:bg-white/10 transition border border-white/20"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-whitepace-blue hover:bg-whitepace-blueHover text-white shadow-md transition"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-whitepace-navy text-white py-20 lg:py-28 relative overflow-hidden">
        {/* Soft decorative background circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-whitepace-blue/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-12 w-80 h-80 bg-whitepace-yellow/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-whitepace-yellow mb-6">
            <span>⚡ Core Business Promise: Every Lead Has One Accountable Owner</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
            Stop Losing Customers to Ignored Leads.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            The unified platform for growing service businesses. Connect leads from web forms and WhatsApp, automatically assign eligible sales reps, and escalate unattended opportunities before competitors steal your deals.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 rounded-xl font-bold text-base bg-whitepace-blue hover:bg-whitepace-blueHover text-white shadow-lg transition flex items-center space-x-2"
            >
              <span>Launch Live Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="/public/lead/apex-solar-pk"
              className="px-8 py-4 rounded-xl font-bold text-base bg-white/10 hover:bg-white/20 text-white border border-white/30 transition flex items-center space-x-2"
            >
              <span>Test Public Lead Form</span>
            </a>
          </div>

          {/* Quick Demo Accounts Banner for Hackathon Judges */}
          <div className="mt-14 max-w-4xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-left">
            <div className="flex items-center space-x-2 text-whitepace-yellow text-sm font-bold uppercase tracking-wider mb-3">
              <Zap className="w-4 h-4" />
              <span>Instant Judge Demo Roster (Password: Password123!)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div
                onClick={() => navigate('/login')}
                className="bg-white/10 p-3 rounded-xl hover:bg-white/20 cursor-pointer border border-white/10 transition"
              >
                <div className="font-bold text-white">Owner</div>
                <div className="text-white/70 truncate">owner@worknest.app</div>
                <div className="text-[10px] text-emerald-400 mt-1">Full Admin & Auditing</div>
              </div>
              <div
                onClick={() => navigate('/login')}
                className="bg-white/10 p-3 rounded-xl hover:bg-white/20 cursor-pointer border border-white/10 transition"
              >
                <div className="font-bold text-white">Admin</div>
                <div className="text-white/70 truncate">admin@worknest.app</div>
                <div className="text-[10px] text-cyan-300 mt-1">Pipelines & Rules</div>
              </div>
              <div
                onClick={() => navigate('/login')}
                className="bg-white/10 p-3 rounded-xl hover:bg-white/20 cursor-pointer border border-white/10 transition"
              >
                <div className="font-bold text-white">Manager</div>
                <div className="text-white/70 truncate">manager@worknest.app</div>
                <div className="text-[10px] text-amber-300 mt-1">Recovery Queue Triage</div>
              </div>
              <div
                onClick={() => navigate('/login')}
                className="bg-white/10 p-3 rounded-xl hover:bg-white/20 cursor-pointer border border-white/10 transition"
              >
                <div className="font-bold text-white">Sales Rep</div>
                <div className="text-white/70 truncate">hamza@worknest.app</div>
                <div className="text-[10px] text-white/60 mt-1">Countdown & Acknowledge</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="scroll-mt-20 py-20 bg-slate-50 border-t border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-whitepace-navy">
              Unified Platform. Zero Fragmented Data.
            </h2>
            <p className="mt-4 text-slate-600">
              Replace disconnected spreadsheets, messaging apps, and lost emails with one auditable business suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-whitepace-blue flex items-center justify-center mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-whitepace-navy mb-3">
                Lead Escalation Chain
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                When a lead arrives, the assigned rep gets a countdown timer. If unacknowledged, the engine automatically escalates through tiers to backups or the Recovery Queue.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-whitepace-navy mb-3">
                Meta WhatsApp Cloud API
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Integrated two-way WhatsApp messaging for Pakistan and global customers. Inbound messages automatically create contacts and leads with opt-out checks.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-whitepace-navy mb-3">
                Safepay Sandbox Payments
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Create hosted checkout links in PKR, receive authoritative webhooks, and separate collected revenue from pipeline projections without touching credit cards.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6">
                <Kanban className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-whitepace-navy mb-3">
                Customizable Pipelines
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Kanban boards with stage-specific required fields. Prevent moving deals forward until mandatory audit criteria and custom fields are filled.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-whitepace-navy mb-3">
                Multi-Tenant Isolation & Audit
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Strict workspace scoping, RBAC permissions (Owner safeguard, Admin, Manager, Rep), sensitive value masking, and an append-only audit trail.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-whitepace-navy mb-3">
                Absence Reassignment
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                When a sales rep toggles to On Leave or Offline, unacknowledged leads are immediately re-routed to available colleagues without dropping the customer.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="accountability" className="scroll-mt-20 py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center space-x-2 text-sm font-bold text-whitepace-blue uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>Lead Accountability</span>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold text-whitepace-navy">
                Every lead has a clear owner and response path.
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                WorkNest assigns new leads to eligible representatives, tracks response deadlines, and escalates unattended opportunities so no customer is silently lost.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
                <Clock className="w-6 h-6 text-whitepace-blue mb-4" />
                <h3 className="font-bold text-whitepace-navy">Assign</h3>
                <p className="mt-2 text-xs text-slate-600">Route each lead to an available owner.</p>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5">
                <Zap className="w-6 h-6 text-amber-600 mb-4" />
                <h3 className="font-bold text-whitepace-navy">Track</h3>
                <p className="mt-2 text-xs text-slate-600">Monitor acknowledgement deadlines in real time.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                <ArrowRight className="w-6 h-6 text-emerald-600 mb-4" />
                <h3 className="font-bold text-whitepace-navy">Recover</h3>
                <p className="mt-2 text-xs text-slate-600">Escalate unattended leads to backup owners.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="integrations" className="scroll-mt-20 py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-2 text-sm font-bold text-whitepace-blue uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Pakistan Integrations</span>
            </div>
            <h2 className="mt-4 text-3xl font-extrabold text-whitepace-navy">
              Connected tools for local service businesses.
            </h2>
            <p className="mt-4 text-slate-600">
              Bring conversations, payments, calendar scheduling, and email alerts into one auditable workspace.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              { icon: MessageSquare, name: 'WhatsApp Cloud API', detail: 'Inbound lead capture and two-way messaging.' },
              { icon: CreditCard, name: 'Safepay Sandbox', detail: 'Hosted PKR checkout and payment status tracking.' },
              { icon: CheckCircle2, name: 'Google Calendar', detail: 'Appointment authorization and event sync.' },
              { icon: FileSpreadsheet, name: 'SMTP Email', detail: 'Escalation and manager notification alerts.' },
            ].map(({ icon: Icon, name, detail }) => (
              <div key={name} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Icon className="w-7 h-7 text-whitepace-blue mb-4" />
                <h3 className="font-bold text-whitepace-navy">{name}</h3>
                <p className="mt-2 text-sm text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-whitepace-navyDark text-white/60 py-12 text-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-base">WorkNest</span>
            <span>— Unified Business Management Platform</span>
          </div>
          <div>
            <span>Built with React, TypeScript, Node.js, Prisma, and Whitepace Design System.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
