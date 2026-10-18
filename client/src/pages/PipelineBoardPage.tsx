import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Pipeline, PipelineStage, Opportunity, Contact } from '../types';
import {
  KanbanSquare,
  Plus,
  DollarSign,
  User,
  Building,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoveRight,
  TrendingUp,
} from 'lucide-react';

export const PipelineBoardPage: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // New Opportunity Modal
  const [isNewOppOpen, setIsNewOppOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContactId, setNewContactId] = useState('');
  const [newValue, setNewValue] = useState<number>(0);
  const [newStageId, setNewStageId] = useState('');

  // Stage validation error modal
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [pipeRes, oppRes, contactRes] = await Promise.all([
        api.get('/crm/pipelines'),
        api.get('/crm/opportunities'),
        api.get('/crm/contacts'),
      ]);

      setPipelines(pipeRes.data);
      if (pipeRes.data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(pipeRes.data[0].id);
      }
      setOpportunities(oppRes.data);
      setContacts(contactRes.data);
    } catch (err) {
      console.error('Failed to load pipeline board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];

  const handleMoveStage = async (opportunityId: string, targetStageId: string) => {
    setValidationError(null);
    try {
      await api.put(`/crm/opportunities/${opportunityId}/stage`, { stageId: targetStageId });
      fetchData();
    } catch (err: any) {
      setValidationError(err.response?.data?.error || 'Stage validation failed.');
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContactId || !newStageId) return;

    try {
      await api.post('/crm/opportunities', {
        title: newTitle,
        contactId: newContactId,
        pipelineId: activePipeline.id,
        stageId: newStageId,
        expectedValue: Number(newValue) || 0,
        currency: 'PKR',
      });

      setIsNewOppOpen(false);
      setNewTitle('');
      setNewContactId('');
      setNewValue(0);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create opportunity.');
    }
  };

  const formatPKR = (amount: number) => {
    return 'PKR ' + Number(amount || 0).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-whitepace-navy">Sales Pipeline Board</h1>
            {activePipeline && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-whitepace-blue">
                {activePipeline.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track deals across pipeline milestones with stage-specific required field enforcement.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {pipelines.length > 1 && (
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              if (activePipeline?.stages?.[0]) {
                setNewStageId(activePipeline.stages[0].id);
              }
              setIsNewOppOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Opportunity</span>
          </button>
        </div>
      </div>

      {/* Validation Error Alert Banner */}
      {validationError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-rose-600 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Kanban Board Columns */}
      <div className="flex space-x-4 overflow-x-auto pb-6 custom-scrollbar min-h-[500px]">
        {activePipeline?.stages?.map((stage, idx) => {
          const stageOpps = opportunities.filter((o) => o.stageId === stage.id);
          const stageTotal = stageOpps.reduce((sum, o) => sum + (o.expectedValue || 0), 0);

          return (
            <div
              key={stage.id}
              className="w-80 flex-shrink-0 bg-slate-100/70 rounded-2xl p-4 border border-slate-200 flex flex-col"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="font-extrabold text-xs text-whitepace-navy uppercase tracking-wider">
                    {stage.name}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {stageOpps.length}
                </span>
              </div>

              <div className="text-[11px] font-semibold text-slate-500 mb-3">
                Total: <span className="text-slate-800">{formatPKR(stageTotal)}</span>
              </div>

              {/* Opportunity Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[550px] pr-1 custom-scrollbar">
                {stageOpps.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
                    No deals in this stage
                  </div>
                ) : (
                  stageOpps.map((opp) => (
                    <div
                      key={opp.id}
                      className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition"
                    >
                      <div className="font-bold text-sm text-slate-900 mb-1">{opp.title}</div>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-500 mb-3">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate">{opp.contact.name}</span>
                      </div>

                      {/* Expected Value & Payment Status */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="font-extrabold text-sm text-whitepace-navy">
                          {formatPKR(opp.expectedValue)}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            opp.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opp.paymentStatus}
                        </span>
                      </div>

                      {/* Quick Stage Movement Selector */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Move Stage:</span>
                        <select
                          value={opp.stageId}
                          onChange={(e) => handleMoveStage(opp.id, e.target.value)}
                          className="text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-whitepace-blue"
                        >
                          {activePipeline.stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Opportunity Modal */}
      {isNewOppOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-whitepace-navy mb-1">Create Opportunity</h3>
            <p className="text-xs text-slate-500 mb-4">Add a new deal into {activePipeline.name}.</p>
            <form onSubmit={handleCreateOpportunity} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Deal Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. 100kW Solar Installation - Mill A"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Contact</label>
                <select
                  value={newContactId}
                  onChange={(e) => setNewContactId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expected Value (PKR)</label>
                <input
                  type="number"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(Number(e.target.value))}
                  placeholder="2500000"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Starting Stage</label>
                <select
                  value={newStageId}
                  onChange={(e) => setNewStageId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-whitepace-blue"
                >
                  {activePipeline?.stages?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewOppOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-whitepace-blue hover:bg-whitepace-blueHover text-white text-xs font-bold shadow-md"
                >
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
