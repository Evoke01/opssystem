import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Calendar, LogOut, Settings, Users, BarChart2,
  ChevronDown, ChevronRight, Hash, Trash2, Loader2, TrendingUp, X,
} from 'lucide-react';
import { apiFetch } from './api-client';

const WEEKDAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatValue(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toFixed(digits);
}

function StatCard({ label, value, sub, highlight = false }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-indigo-600 border-indigo-700' : 'bg-white border-zinc-200'}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${highlight ? 'text-indigo-200' : 'text-zinc-400'}`}>{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-zinc-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${highlight ? 'text-indigo-200' : 'text-zinc-400'}`}>{sub}</p>}
    </div>
  );
}

function Badge({ value, type }: { value: number | null; type?: 'rate' }) {
  if (value === null || value === undefined) return <span className="text-zinc-300">—</span>;
  if (type === 'rate') {
    const v = parseFloat(String(value));
    const color = v > 10 ? 'bg-red-50 text-red-600' : v > 5 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600';
    return <span className={`font-mono text-xs px-2 py-0.5 rounded-full font-semibold ${color}`}>{formatValue(value)}%</span>;
  }
  return <span className="font-mono text-sm text-zinc-700">{String(value)}</span>;
}

function CodesPanel({ reportId }: { reportId: number }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/report-codes?report_id=${reportId}`)
      .then(r => r.json()).then(d => { startTransition(() => setCodes(Array.isArray(d) ? d : [])); setLoading(false); })
      .catch(() => setLoading(false));
  }, [reportId]);

  if (loading) return <div className="px-5 py-3 text-xs text-zinc-400">Loading codes…</div>;
  if (!codes.length) return <div className="px-5 py-3 text-xs text-zinc-400 italic">No access codes stored</div>;

  return (
    <div className="px-5 py-4 bg-amber-50 border-t border-amber-100">
      <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-3">Access Codes ({codes.length})</p>
      <div className="flex flex-wrap gap-1.5">
        {codes.map(code => (
          <span key={code.id} className="inline-flex items-center gap-1 bg-white border border-amber-200 text-zinc-700 text-xs font-mono px-2.5 py-1 rounded-lg">
            <Hash className="w-2.5 h-2.5 text-zinc-300" />{code.code}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Daily Summary ──────────────────────────────────────────────────────────────
function DailySummary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    apiFetch(`/api/admin/summary?date=${date}`)
      .then(r => r.json()).then(result => {
        if (result.error) throw new Error(result.error);
        startTransition(() => setData(result));
        setLoading(false);
      }).catch((e: any) => { setError(e.message); setLoading(false); });
  }, [date]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-500">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-zinc-400 gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Sessions" value={data.totals.total_sessions ?? 0} highlight />
            <StatCard label="Session Avg" value={formatValue(data.totals.session_avg)}
              sub={`${data.totals.submitted_agent_count ?? 0} / ${data.totals.working_agent_count ?? 0} submitted`} />
            <StatCard label="Total Requeues" value={data.totals.total_requeue ?? 0} />
            <StatCard label="Requeue Rate" value={data.totals.requeue_percent === null ? '—' : `${formatValue(data.totals.requeue_percent)}%`} />
            <StatCard label="Top Issue" value={data.totals.top_issue ?? 'None'} />
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {['Agent', 'Status', 'Working Day', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(data.agents || []).map((agent: any) => (
                    <tr key={agent.user_id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-800">{agent.user_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agent.status === 'submitted' ? 'bg-emerald-50 text-emerald-600' : agent.status === 'on leave' ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'}`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{agent.working_day ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-800">{agent.total_sessions ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.id_retake ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.tech_issue ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.system_issue ?? '—'}</td>
                      <td className="px-4 py-3"><Badge value={agent.requeue_percent} type="rate" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Monthly Team ──────────────────────────────────────────────────────────────
function MonthlyTeam() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/admin/monthly?month=${month}`)
      .then(r => r.json()).then(result => { startTransition(() => setData(result)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-500">Month</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-zinc-400 gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Sessions" value={data.summary?.total_sessions ?? 0} highlight />
            <StatCard label="Working Days" value={data.summary?.working_days ?? 0} />
            <StatCard label="Submitted Days" value={data.summary?.submitted_days ?? 0} />
            <StatCard label="Session Avg / Day" value={formatValue(data.summary?.session_avg)} />
            <StatCard label="Requeue Rate" value={data.summary?.requeue_percent === null ? '—' : `${formatValue(data.summary?.requeue_percent)}%`} />
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {['Agent', 'Working Days', 'Submitted', 'Leave', 'Sessions', 'Avg / Day', 'Requeues', 'Requeue %'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(data.agents || []).map((agent: any) => (
                    <tr key={agent.user_id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-800">{agent.user_name}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.working_days}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.submitted_days}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.leave_days}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-800">{agent.total_sessions}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-indigo-600">{formatValue(agent.session_avg)}</td>
                      <td className="px-4 py-3 text-zinc-600">{agent.total_requeue}</td>
                      <td className="px-4 py-3"><Badge value={agent.requeue_percent} type="rate" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Agent Reports ─────────────────────────────────────────────────────────────
function AgentReports({ agents }: { agents: any[] }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payload, setPayload] = useState<any>({ reports: [], summary: {}, leaves: [] });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchReports = async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    const response = await apiFetch(`/api/admin/user-reports?user_id=${selectedAgentId}&month=${month}`);
    const data = await response.json();
    startTransition(() => setPayload(data));
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Agent</label>
          <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}
            className="border border-zinc-300 rounded-xl py-2 px-3 text-sm bg-white text-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 min-w-[200px]">
            <option value="">Select agent…</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        </div>
        <button onClick={fetchReports}
          className="px-5 py-2 bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-colors">
          View Reports
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Working Days" value={payload.summary?.working_days ?? 0} />
        <StatCard label="Submitted Days" value={payload.summary?.submitted_days ?? 0} />
        <StatCard label="Leave Days" value={payload.summary?.leave_days ?? 0} />
        <StatCard label="Total Sessions" value={payload.summary?.total_sessions ?? 0} highlight />
        <StatCard label="Avg / Working Day" value={formatValue(payload.summary?.session_avg)} />
      </div>

      {(payload.leaves || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-2.5">Leave Dates</p>
          <div className="flex flex-wrap gap-2">
            {(payload.leaves || []).map((leave: any) => (
              <span key={leave.id} className="bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-zinc-700">
                {leave.date}{leave.reason ? ` · ${leave.reason}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-zinc-400 gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}

      {(payload.reports || []).length > 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="w-8 px-3 py-3"></th>
                  {['Date', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(payload.reports || []).map((report: any) => {
                  const isOpen = expanded === report.id;
                  return (
                    <React.Fragment key={report.id}>
                      <tr className={`border-b border-zinc-100 cursor-pointer transition-colors ${isOpen ? 'bg-amber-50' : 'hover:bg-zinc-50'}`}
                        onClick={() => setExpanded(isOpen ? null : report.id)}>
                        <td className="px-3 py-3 text-zinc-300">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-500" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800">{report.date}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-zinc-800">{report.total_sessions}</td>
                        <td className="px-4 py-3 text-zinc-600">{report.id_retake}</td>
                        <td className="px-4 py-3 text-zinc-600">{report.tech_issue}</td>
                        <td className="px-4 py-3 text-zinc-600">{report.system_issue}</td>
                        <td className="px-4 py-3"><Badge value={report.requeue_percent} type="rate" /></td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-zinc-100">
                          <td colSpan={7} className="p-0"><CodesPanel reportId={report.id} /></td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400 text-sm">
          {selectedAgentId ? 'No reports found for this agent and month' : 'Select an agent and click View Reports'}
        </div>
      )}
    </div>
  );
}

// ── Team Settings ─────────────────────────────────────────────────────────────
function TeamSettings({ agents, onAgentsChanged }: { agents: any[]; onAgentsChanged: () => void }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [form, setForm] = useState<any>({ email: '', shift_start: '09:00', shift_end: '18:00', timezone: 'Asia/Kolkata', week_offs: ['saturday', 'sunday'] });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!agents.length) return;
    const activeId = selectedAgentId || String(agents[0].id);
    setSelectedAgentId(activeId);
    const current = agents.find(a => String(a.id) === activeId) || agents[0];
    setForm({ email: current.email || '', shift_start: current.shift_start || '09:00', shift_end: current.shift_end || '18:00', timezone: current.timezone || 'Asia/Kolkata', week_offs: Array.isArray(current.week_offs) ? current.week_offs : ['saturday', 'sunday'] });
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) return;
    apiFetch(`/api/admin/leaves?user_id=${selectedAgentId}&month=${month}`)
      .then(r => r.json()).then(d => startTransition(() => setLeaves(Array.isArray(d) ? d : [])))
      .catch(() => setLeaves([]));
  }, [month, selectedAgentId]);

  const saveSettings = async () => {
    const response = await apiFetch(`/api/admin/users/${selectedAgentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await response.json();
    setMessage({ text: response.ok ? 'Schedule saved successfully' : (data.error || 'Failed to save'), ok: response.ok });
    if (response.ok) onAgentsChanged();
  };

  const addLeave = async () => {
    if (!leaveDate) return;
    const response = await apiFetch('/api/admin/leaves', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(selectedAgentId), date: leaveDate, reason: leaveReason }),
    });
    const data = await response.json();
    setMessage({ text: response.ok ? 'Leave added' : (data.error || 'Failed'), ok: response.ok });
    if (response.ok) {
      setLeaveDate(''); setLeaveReason('');
      const refreshed = await apiFetch(`/api/admin/leaves?user_id=${selectedAgentId}&month=${month}`);
      setLeaves(await refreshed.json());
    }
  };

  const removeLeave = async (leaveId: number) => {
    await apiFetch(`/api/admin/leaves/${leaveId}`, { method: 'DELETE' });
    const refreshed = await apiFetch(`/api/admin/leaves?user_id=${selectedAgentId}&month=${month}`);
    setLeaves(await refreshed.json());
  };

  const inputCls = "w-full border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="space-y-4">
      {/* Schedule settings */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h3 className="font-semibold text-zinc-800">Agent Schedule</h3>

        {message && (
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {message.ok ? <span>✓</span> : <AlertCircle className="w-4 h-4" />}{message.text}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Agent</label>
            <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)} className={inputCls}>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="agent@example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Shift Start</label>
            <input type="time" value={form.shift_start} onChange={e => setForm({ ...form, shift_start: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Shift End</label>
            <input type="time" value={form.shift_end} onChange={e => setForm({ ...form, shift_end: e.target.value })} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Timezone</label>
            <input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} className={inputCls} placeholder="Asia/Kolkata" />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-400 mb-2.5">Week Offs</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map(day => {
              const checked = form.week_offs.includes(day);
              return (
                <button key={day} type="button"
                  onClick={() => setForm({ ...form, week_offs: checked ? form.week_offs.filter((v: string) => v !== day) : [...form.week_offs, day] })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border ${checked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={saveSettings} className="px-5 py-2 bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-colors">
          Save Schedule
        </button>
      </div>

      {/* Leave management */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-800">Leave Management</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400">Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-zinc-300 rounded-lg py-1.5 px-2.5 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div className="grid sm:grid-cols-[180px,1fr,auto] gap-2.5">
          <input type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)}
            className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500" />
          <input value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Reason (optional)"
            className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-700 placeholder-zinc-300 focus:outline-none focus:border-indigo-500" />
          <button onClick={addLeave} disabled={!leaveDate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-semibold transition-colors">
            Add Leave
          </button>
        </div>

        <div className="space-y-2">
          {leaves.map(leave => (
            <div key={leave.id} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5">
              <span className="text-sm text-zinc-700">{leave.date}{leave.reason ? <span className="text-zinc-400 ml-2">· {leave.reason}</span> : ''}</span>
              <button onClick={() => removeLeave(leave.id)} className="text-zinc-300 hover:text-red-500 transition-colors ml-3">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {!leaves.length && <p className="text-sm text-zinc-400 py-1">No leave dates recorded for this month</p>}
        </div>
      </div>
    </div>
  );
}

// ── Admin Shell ───────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'daily' | 'monthly' | 'agent' | 'settings'>('daily');
  const [agents, setAgents] = useState<any[]>([]);

  const loadAgents = async () => {
    const response = await apiFetch('/api/admin/agents');
    const data = await response.json();
    startTransition(() => setAgents(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    if (sessionStorage.getItem('ops_admin') !== 'true') { navigate('/admin/login'); return; }
    void loadAgents();
  }, [navigate]);

  const logout = () => { sessionStorage.removeItem('ops_admin'); navigate('/admin/login'); };

  const tabs = [
    { id: 'daily' as const, label: 'Daily Summary', icon: Calendar },
    { id: 'monthly' as const, label: 'Monthly Team', icon: TrendingUp },
    { id: 'agent' as const, label: 'Agent Reports', icon: Users },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 px-5 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-0">
          <div className="flex items-center gap-2.5 mr-5">
            <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-[10px] tracking-wider">TL</span>
            </div>
          </div>
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 h-14 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg">
          <LogOut className="w-3.5 h-3.5" />Logout
        </button>
      </div>

      <div className="max-w-6xl mx-auto py-7 px-4">
        {tab === 'daily' && <DailySummary />}
        {tab === 'monthly' && <MonthlyTeam />}
        {tab === 'agent' && <AgentReports agents={agents} />}
        {tab === 'settings' && <TeamSettings agents={agents} onAgentsChanged={loadAgents} />}
      </div>
    </div>
  );
}
