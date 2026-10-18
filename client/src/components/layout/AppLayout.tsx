import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  KanbanSquare,
  AlertTriangle,
  MessageSquare,
  Calendar,
  CreditCard,
  ShieldCheck,
  Cpu,
  History,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Radio,
  Flame,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';

export const AppLayout: React.FC = () => {
  const { user, activeWorkspace, workspaces, myAvailability, updateMyAvailability, logout, switchWorkspace } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isAvailabilityDropdownOpen, setIsAvailabilityDropdownOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      setIsSocketConnected(socket.connected);
      socket.on('connect', () => setIsSocketConnected(true));
      socket.on('disconnect', () => setIsSocketConnected(false));
    }
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Leads & Accountability', path: '/leads', icon: Flame, highlight: true },
    { label: 'Recovery Queue', path: '/recovery', icon: AlertTriangle, warning: true },
    { label: 'Sales Pipeline', path: '/pipeline', icon: KanbanSquare },
    { label: 'Contacts & Companies', path: '/contacts', icon: Users2 },
    { label: 'WhatsApp Inbox', path: '/conversations', icon: MessageSquare },
    { label: 'Appointments', path: '/appointments', icon: Calendar },
    { label: 'Payments (Safepay)', path: '/payments', icon: CreditCard },
    { label: 'Team & Rules', path: '/team', icon: ShieldCheck },
    { label: 'Integrations Hub', path: '/integrations', icon: Cpu },
    { label: 'Audit Trail', path: '/audit', icon: History },
  ];

  const availabilityColors: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    AVAILABLE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Available' },
    BUSY: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Busy' },
    ON_LEAVE: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'On Leave' },
    OFFLINE: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Offline' },
  };

  const currentAvail = availabilityColors[myAvailability] || availabilityColors.AVAILABLE;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } hidden md:flex flex-col bg-whitepace-navy text-white transition-all duration-300 ease-in-out shadow-xl z-30`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center space-x-3 overflow-hidden cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-whitepace-blue flex items-center justify-center font-bold text-white shadow-md flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-tight text-white leading-tight">WorkNest</span>
                <span className="text-[10px] text-white/60 tracking-wider uppercase font-semibold">Business Suite</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group ${
                  isActive
                    ? 'bg-whitepace-blue text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    item.warning && !isActive
                      ? 'text-amber-400'
                      : item.highlight && !isActive
                      ? 'text-cyan-300'
                      : ''
                  }`}
                />
                {sidebarOpen && <span className="ml-3 truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Public Form Quick Link */}
        {sidebarOpen && activeWorkspace && (
          <div className="p-3 mx-3 mb-3 bg-white/5 rounded-xl border border-white/10 text-xs">
            <div className="text-white/60 mb-1">Public Lead Capture Form:</div>
            <a
              href={`/public/lead/${activeWorkspace.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-whitepace-blue hover:underline truncate block font-medium"
            >
              /public/lead/{activeWorkspace.slug}
            </a>
          </div>
        )}

        {/* User Card & Logout */}
        <div className="p-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-whitepace-blue/20 text-whitepace-blue border border-whitepace-blue/40 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate">{user?.fullName}</span>
                <span className="text-xs text-white/50 truncate">{activeWorkspace?.role || 'Member'}</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={logout}
              title="Log out"
              className="p-1.5 rounded-lg text-white/60 hover:text-rose-400 hover:bg-white/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-20 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Workspace Selector */}
            <div className="relative">
              <button
                onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-sm font-semibold text-slate-800 transition"
              >
                <Building2 className="w-4 h-4 text-whitepace-navy" />
                <span className="max-w-[160px] truncate">{activeWorkspace?.name || 'Workspace'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isWorkspaceDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Switch Company Workspace
                  </div>
                  {workspaces.map((ws) => (
                    <button
                      key={ws.workspaceId}
                      onClick={() => {
                        switchWorkspace(ws.workspaceId);
                        setIsWorkspaceDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 ${
                        ws.workspaceId === activeWorkspace?.workspaceId ? 'bg-blue-50 font-semibold text-whitepace-navy' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.workspaceId === activeWorkspace?.workspaceId && (
                        <CheckCircle2 className="w-4 h-4 text-whitepace-blue" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Nav Utilities */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Real-time Socket Indicator */}
            <div
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isSocketConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={isSocketConnected ? 'Live updates active' : 'Connecting to live events...'}
            >
              <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse text-emerald-600' : 'text-amber-500'}`} />
              <span>{isSocketConnected ? 'Live Sync' : 'Reconnecting'}</span>
            </div>

            {/* Quick Availability Status Selector */}
            <div className="relative">
              <button
                onClick={() => setIsAvailabilityDropdownOpen(!isAvailabilityDropdownOpen)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${currentAvail.bg} ${currentAvail.text} border-slate-200 hover:shadow-sm`}
              >
                <span className={`w-2 h-2 rounded-full ${currentAvail.dot}`} />
                <span>{currentAvail.label}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {isAvailabilityDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                  <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    My Working Status
                  </div>
                  {(['AVAILABLE', 'BUSY', 'ON_LEAVE', 'OFFLINE'] as const).map((status) => {
                    const info = availabilityColors[status];
                    return (
                      <button
                        key={status}
                        onClick={async () => {
                          await updateMyAvailability(status);
                          setIsAvailabilityDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center space-x-2 hover:bg-slate-50 ${
                          myAvailability === status ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${info.dot}`} />
                        <span>{info.label}</span>
                        {status === 'ON_LEAVE' && <span className="text-[10px] text-rose-500 ml-auto">Reassigns</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logout on mobile */}
            <button
              onClick={logout}
              className="md:hidden p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Main View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
