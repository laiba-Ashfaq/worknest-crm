import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Contact, Company } from '../types';
import {
  Users2,
  Building,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  MessageSquare,
  FileText,
  X,
  ExternalLink,
  Kanban,
  CheckCircle2,
} from 'lucide-react';

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'contacts' | 'companies'>('contacts');

  // Customer 360 Profile Drawer
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // New Contact / Company modals
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isNewCompanyOpen, setIsNewCompanyOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompanyId, setContactCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');

  const fetchContacts = async () => {
    try {
      const [cRes, compRes] = await Promise.all([
        api.get('/crm/contacts', { params: { search: search || undefined } }),
        api.get('/crm/companies'),
      ]);
      setContacts(cRes.data);
      setCompanies(compRes.data);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search]);

  const loadProfile = async (id: string) => {
    setSelectedContactId(id);
    setProfileLoading(true);
    try {
      const res = await api.get(`/crm/contacts/${id}`);
      setProfileData(res.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/contacts', {
        name: contactName,
        phone: contactPhone,
        email: contactEmail || undefined,
        companyId: contactCompanyId || undefined,
      });
      setIsNewContactOpen(false);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactCompanyId('');
      fetchContacts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create contact.');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crm/companies', {
        name: companyName,
        industry: companyIndustry || undefined,
      });
      setIsNewCompanyOpen(false);
      setCompanyName('');
      setCompanyIndustry('');
      fetchContacts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create company.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-whitepace-navy">Customer Relationship Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-whitepace-blue">
              {contacts.length} Contacts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Unified Customer 360 profiles, Pakistani normalized phone numbers, and company associations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsNewCompanyOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5"
          >
            <Building className="w-4 h-4" />
            <span>Add Company</span>
          </button>
          <button
            onClick={() => setIsNewContactOpen(true)}
            className="px-4 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 border-b sm:border-b-0 border-slate-200 pb-2 sm:pb-0">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeTab === 'contacts'
                ? 'bg-whitepace-navy text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Contacts ({contacts.length})
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeTab === 'companies'
                ? 'bg-whitepace-navy text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Companies ({companies.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue bg-white"
          />
        </div>
      </div>

      {/* Main Table View */}
      {activeTab === 'contacts' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Contact Name</th>
                  <th className="py-3 px-4">Phone Number (+92)</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Opt-Out Consent</th>
                  <th className="py-3 px-4 text-right">Customer 360</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                      {contact.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono font-medium">
                      {contact.phone}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {contact.email || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {contact.company ? (
                        <span className="font-semibold text-slate-800">{contact.company.name}</span>
                      ) : (
                        <span className="text-slate-400">Individual</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          contact.consentStatus === 'OPTED_IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {contact.consentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => loadProfile(contact.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-whitepace-blue hover:bg-blue-100 font-bold text-xs transition inline-flex items-center space-x-1"
                      >
                        <span>View 360°</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Phone / Address</th>
                  <th className="py-3 px-4">Associated Contacts</th>
                  <th className="py-3 px-4">Opportunities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                      {company.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {company.industry || 'General Business'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div>{company.phone || '—'}</div>
                      <div className="text-[11px] text-slate-400">{company.address}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {company._count?.contacts ?? 0}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-whitepace-blue">
                      {company._count?.opportunities ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer 360 Unified Profile Drawer / Modal */}
      {selectedContactId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between custom-scrollbar">
            {profileLoading || !profileData ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whitepace-blue" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-whitepace-navy">{profileData.name}</h2>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                      <span>{profileData.phone}</span>
                      {profileData.email && <span>• {profileData.email}</span>}
                      {profileData.company && <span>• {profileData.company.name}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedContactId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Unified Opportunities */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Kanban className="w-3.5 h-3.5" />
                    <span>Opportunities ({profileData.opportunities?.length || 0})</span>
                  </h3>
                  <div className="space-y-2">
                    {profileData.opportunities?.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-400">No opportunities linked.</div>
                    ) : (
                      profileData.opportunities.map((opp: any) => (
                        <div key={opp.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-800">{opp.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Stage: {opp.stage?.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-whitepace-navy">PKR {Number(opp.expectedValue).toLocaleString()}</div>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">{opp.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Unified Payments */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Payments ({profileData.payments?.length || 0})</span>
                  </h3>
                  <div className="space-y-2">
                    {profileData.payments?.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-400">No payments recorded.</div>
                    ) : (
                      profileData.payments.map((p: any) => (
                        <div key={p.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-800">PKR {Number(p.amount).toLocaleString()}</div>
                            <div className="text-[11px] text-slate-400">{p.provider} • Sandbox</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {p.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Unified Appointments */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Appointments ({profileData.appointments?.length || 0})</span>
                  </h3>
                  <div className="space-y-2">
                    {profileData.appointments?.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-400">No appointments scheduled.</div>
                    ) : (
                      profileData.appointments.map((a: any) => (
                        <div key={a.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm text-xs">
                          <div className="font-bold text-slate-800">{a.title}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {new Date(a.startTime).toLocaleString()} • Host: {a.hostRep?.user?.fullName}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Notes and Context */}
                {profileData.notes && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Contact Notes</span>
                    </h3>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-line">
                      {profileData.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedContactId(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs"
              >
                Close Customer Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Contact Modal */}
      {isNewContactOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Add Contact</h3>
            <p className="text-xs text-slate-500 mb-4">Store phone numbers normalized with +92 format.</p>
            <form onSubmit={handleCreateContact} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Muhammad Farooq"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number (+92)</label>
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="03001234567"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="customer@domain.pk"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Associate Company</label>
                <select
                  value={contactCompanyId}
                  onChange={(e) => setContactCompanyId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">-- No Company (Individual) --</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewContactOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Company Modal */}
      {isNewCompanyOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Add Company</h3>
            <p className="text-xs text-slate-500 mb-4">Create a business entity to link multiple contacts and deals.</p>
            <form onSubmit={handleCreateCompany} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Al-Karam Mills"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Industry</label>
                <input
                  type="text"
                  value={companyIndustry}
                  onChange={(e) => setCompanyIndustry(e.target.value)}
                  placeholder="Textile / Healthcare / Solar"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
