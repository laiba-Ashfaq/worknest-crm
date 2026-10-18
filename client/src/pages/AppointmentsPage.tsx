import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Appointment, Contact, WorkspaceMembership } from '../types';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // New Appointment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactId, setContactId] = useState('');
  const [hostMembershipId, setHostMembershipId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const fetchAppointments = async () => {
    try {
      const [appRes, cRes, mRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/crm/contacts'),
        api.get('/workspaces/members'),
      ]);
      setAppointments(appRes.data);
      setContacts(cRes.data);
      setMembers(mRes.data);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictWarning(null);

    try {
      await api.post('/appointments', {
        title,
        description,
        contactId,
        hostMembershipId: hostMembershipId || undefined,
        startTime,
        endTime,
        location,
      });

      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setContactId('');
      setHostMembershipId('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      fetchAppointments();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictWarning(err.response?.data?.error || 'Scheduling conflict detected.');
      } else {
        alert(err.response?.data?.error || 'Failed to schedule appointment.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-whitepace-navy">Client Appointments & Audits</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-whitepace-blue">
              {appointments.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Google Calendar OAuth integration, automatic rep conflict detection, and qualifying response tracking.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md transition flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Appointment</span>
        </button>
      </div>

      {/* Conflict Warning in Modal Banner */}
      {conflictWarning && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{conflictWarning}</span>
          </div>
          <button onClick={() => setConflictWarning(null)} className="text-rose-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Appointments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="font-bold text-slate-700">No scheduled appointments</div>
            <div className="text-xs text-slate-400 mt-0.5">Click "Schedule Appointment" to book a client survey or call.</div>
          </div>
        ) : (
          appointments.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {app.status}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(app.startTime).toLocaleDateString()}
                </span>
              </div>

              <h3 className="font-bold text-base text-whitepace-navy mb-1">{app.title}</h3>
              {app.description && <p className="text-xs text-slate-500 mb-3">{app.description}</p>}

              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-800">{app.contact.name}</span>
                  <span className="text-slate-400">({app.contact.phone})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>
                    {new Date(app.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(app.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (PKT)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-whitepace-blue flex-shrink-0" />
                  <span>Host Rep: <strong className="text-slate-800">{app.hostRep.user.fullName}</strong></span>
                </div>
                {app.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{app.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Schedule Appointment</h3>
            <p className="text-xs text-slate-500 mb-4">
              Booking an appointment automatically records lead response and checks calendar conflicts.
            </p>

            <form onSubmit={handleCreateAppointment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Appointment Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Rooftop Technical Audit"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Customer</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">-- Choose Customer --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Host Representative</label>
                <select
                  value={hostMembershipId}
                  onChange={(e) => setHostMembershipId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">Current User (Default)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.fullName} ({m.availability})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Location / Site Address</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Korangi Industrial Area, Karachi"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
