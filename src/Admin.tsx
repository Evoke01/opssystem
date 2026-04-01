import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Calendar, LogOut, Settings, Users, BarChart2, ChevronDown, ChevronRight, Hash, Trash2 } from 'lucide-react';
import { apiFetch } from './api-client';

const WEEKDAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatValue(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(digits);
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub ? <p className="text-xs text-gray-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function CodesPanel({ reportId }: { reportId: number }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/report-codes?report_id=${reportId}`)
      .then((response) => response.json())
      .then((data) => {
        startTransition(() => setCodes(Array.isArray(data) ? data : []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return <div className="px-6 py-3 text-xs text-gray-400">Loading codes...</div>;
  }

  if (!codes.length) {
    return <div className="px-6 py-3 text-xs text-gray-400 italic">No access codes stored for this report</div>;
  }

  return (
    <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
      <p className="text-xs font-semibold text-amber-700 mb-2.5 uppercase tracking-wide">Access Codes</p>
      <div className="flex flex-wrap gap-1.5">
        {codes.map((code) => (
          <span key={code.id} className="inline-flex items-center gap-1 bg-white border border-amber-200 text-gray-800 text-xs font-mono px-2.5 py-1 rounded-md shadow-sm">
            <Hash className="w-2.5 h-2.5 text-gray-300" />
            {code.code}
          </span>
        ))}
      </div>
    </div>
  );
}

function DailySummary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/admin/summary?date=${date}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.error) {
          throw new Error(result.error);
        }

        startTransition(() => setData(result));
        setLoading(false);
      })
      .catch((fetchError: any) => {
        setError(fetchError.message);
        setLoading(false);
      });
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {error ? <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div> : null}
      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Sessions" value={data.totals.total_sessions ?? 0} />
            <StatCard label="Session Avg" value={formatValue(data.totals.session_avg)} sub={`${data.totals.submitted_agent_count ?? 0} submitted / ${data.totals.working_agent_count ?? 0} working`} />
            <StatCard label="Total Requeues" value={data.totals.total_requeue ?? 0} />
            <StatCard label="Requeue Rate" value={data.totals.requeue_percent === null ? '-' : `${formatValue(data.totals.requeue_percent)}%`} />
            <StatCard label="Top Issue" value={data.totals.top_issue ?? 'None'} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Agent', 'Status', 'Working Day', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.agents || []).map((agent: any) => (
                    <tr key={agent.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{agent.user_name}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.status}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.working_day ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.total_sessions}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.id_retake}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.tech_issue}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.system_issue}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.requeue_percent === null ? '-' : `${formatValue(agent.requeue_percent)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MonthlyTeam() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/admin/monthly?month=${month}`)
      .then((response) => response.json())
      .then((result) => {
        startTransition(() => setData(result));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Sessions" value={data.summary?.total_sessions ?? 0} />
            <StatCard label="Working Days" value={data.summary?.working_days ?? 0} />
            <StatCard label="Submitted Days" value={data.summary?.submitted_days ?? 0} />
            <StatCard label="Session Avg / Working Day" value={formatValue(data.summary?.session_avg)} />
            <StatCard label="Requeue Rate" value={data.summary?.requeue_percent === null ? '-' : `${formatValue(data.summary?.requeue_percent)}%`} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Agent', 'Working Days', 'Submitted Days', 'Leave Days', 'Sessions', 'Session Avg', 'Requeues', 'Requeue %'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.agents || []).map((agent: any) => (
                    <tr key={agent.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{agent.user_name}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.working_days}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.submitted_days}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.leave_days}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.total_sessions}</td>
                      <td className="px-4 py-3 text-blue-700 font-semibold">{formatValue(agent.session_avg)}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.total_requeue}</td>
                      <td className="px-4 py-3 text-gray-700">{agent.requeue_percent === null ? '-' : `${formatValue(agent.requeue_percent)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AgentReports({ agents }: { agents: any[] }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payload, setPayload] = useState<any>({ reports: [], summary: {}, leaves: [] });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchReports = async () => {
    if (!selectedAgentId) {
      return;
    }

    setLoading(true);
    const response = await apiFetch(`/api/admin/user-reports?user_id=${selectedAgentId}&month=${month}`);
    const data = await response.json();
    startTransition(() => setPayload(data));
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Agent</label>
          <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]">
            <option value="">-- Choose agent --</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Month</label>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={fetchReports} className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors">View Reports</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Working Days" value={payload.summary?.working_days ?? 0} />
        <StatCard label="Submitted Days" value={payload.summary?.submitted_days ?? 0} />
        <StatCard label="Leave Days" value={payload.summary?.leave_days ?? 0} />
        <StatCard label="Total Sessions" value={payload.summary?.total_sessions ?? 0} />
        <StatCard label="Session Avg / Working Day" value={formatValue(payload.summary?.session_avg)} />
      </div>

      {(payload.leaves || []).length ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Leave Dates</p>
          <div className="flex flex-wrap gap-2">
            {(payload.leaves || []).map((leave: any) => (
              <span key={leave.id} className="bg-white border border-amber-200 rounded-md px-2.5 py-1 text-xs text-gray-700">{leave.date}{leave.reason ? ` - ${leave.reason}` : ''}</span>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : null}
      {(payload.reports || []).length ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 w-8"></th>
                  {['Date', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(payload.reports || []).map((report: any) => {
                  const isOpen = expanded === report.id;
                  return (
                    <React.Fragment key={report.id}>
                      <tr className={`border-b border-gray-100 cursor-pointer ${isOpen ? 'bg-amber-50' : 'hover:bg-gray-50'}`} onClick={() => setExpanded(isOpen ? null : report.id)}>
                        <td className="px-3 py-3 text-gray-400">{isOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-500" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{report.date}</td>
                        <td className="px-4 py-3 text-gray-700">{report.total_sessions}</td>
                        <td className="px-4 py-3 text-gray-700">{report.id_retake}</td>
                        <td className="px-4 py-3 text-gray-700">{report.tech_issue}</td>
                        <td className="px-4 py-3 text-gray-700">{report.system_issue}</td>
                        <td className="px-4 py-3 text-gray-700">{report.requeue_percent === null ? '-' : `${formatValue(report.requeue_percent)}%`}</td>
                      </tr>
                      {isOpen ? <tr className="border-b border-gray-100"><td colSpan={7} className="p-0"><CodesPanel reportId={report.id} /></td></tr> : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No reports found for this agent and month</div>}
    </div>
  );
}

function TeamSettings({ agents, onAgentsChanged }: { agents: any[]; onAgentsChanged: () => void }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [form, setForm] = useState<any>({ email: '', shift_start: '09:00', shift_end: '18:00', timezone: 'Asia/Kolkata', week_offs: ['saturday', 'sunday'] });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!agents.length) {
      return;
    }

    const activeId = selectedAgentId || String(agents[0].id);
    setSelectedAgentId(activeId);
    const current = agents.find((agent) => String(agent.id) === activeId) || agents[0];
    setForm({
      email: current.email || '',
      shift_start: current.shift_start || '09:00',
      shift_end: current.shift_end || '18:00',
      timezone: current.timezone || 'Asia/Kolkata',
      week_offs: Array.isArray(current.week_offs) ? current.week_offs : ['saturday', 'sunday'],
    });
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    apiFetch(`/api/admin/leaves?user_id=${selectedAgentId}&month=${month}`)
      .then((response) => response.json())
      .then((data) => startTransition(() => setLeaves(Array.isArray(data) ? data : [])))
      .catch(() => setLeaves([]));
  }, [month, selectedAgentId]);

  const saveSettings = async () => {
    const response = await apiFetch(`/api/admin/users/${selectedAgentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to save settings');
      return;
    }

    setMessage('Schedule saved');
    onAgentsChanged();
  };

  const addLeave = async () => {
    if (!leaveDate) {
      return;
    }

    const response = await apiFetch('/api/admin/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(selectedAgentId), date: leaveDate, reason: leaveReason }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to add leave');
      return;
    }

    setMessage('Leave added');
    setLeaveDate('');
    setLeaveReason('');
    const refreshed = await apiFetch(`/api/admin/leaves?user_id=${selectedAgentId}&month=${month}`);
    setLeaves(await refreshed.json());
  };

  const removeLeave = async (leaveId: number) => {
    await apiFetch(`/api/admin/leaves/${leaveId}`, { method: 'DELETE' });
    const refreshed = await apiFetch(`/api/admin/leaves?user_id=${selectedAgentId}&month=${month}`);
    setLeaves(await refreshed.json());
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Agent</label>
            <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm">
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Shift Start</label>
            <input type="time" value={form.shift_start} onChange={(event) => setForm({ ...form, shift_start: event.target.value })} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Shift End</label>
            <input type="time" value={form.shift_end} onChange={(event) => setForm({ ...form, shift_end: event.target.value })} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Timezone</label>
            <input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Week Offs</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((day) => (
              <label key={day} className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.week_offs.includes(day)} onChange={() => setForm({
                  ...form,
                  week_offs: form.week_offs.includes(day)
                    ? form.week_offs.filter((value: string) => value !== day)
                    : [...form.week_offs, day],
                })} />
                {day}
              </label>
            ))}
          </div>
        </div>
        <button onClick={saveSettings} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900">Save Team Settings</button>
        {message ? <p className="text-sm text-gray-500">{message}</p> : null}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Leave Month:</label>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm" />
        </div>
        <div className="grid md:grid-cols-[220px,1fr,auto] gap-3">
          <input type="date" value={leaveDate} onChange={(event) => setLeaveDate(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm" />
          <input value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} placeholder="Reason (optional)" className="border border-gray-300 rounded-lg py-2 px-3 text-sm" />
          <button onClick={addLeave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Add Leave</button>
        </div>
        <div className="space-y-2">
          {leaves.map((leave) => (
            <div key={leave.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <span>{leave.date}{leave.reason ? ` - ${leave.reason}` : ''}</span>
              <button onClick={() => removeLeave(leave.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!leaves.length ? <div className="text-sm text-gray-400">No leave dates in this month</div> : null}
        </div>
      </div>
    </div>
  );
}

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
    if (sessionStorage.getItem('ops_admin') !== 'true') {
      navigate('/admin/login');
      return;
    }

    void loadAgents();
  }, [navigate]);

  const logout = () => {
    sessionStorage.removeItem('ops_admin');
    navigate('/admin/login');
  };

  const tabs = [
    { id: 'daily' as const, label: 'Daily Summary', icon: Calendar },
    { id: 'monthly' as const, label: 'Monthly Team', icon: BarChart2 },
    { id: 'agent' as const, label: 'Agent Reports', icon: Users },
    { id: 'settings' as const, label: 'Team Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">TL</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">TL Dashboard</p>
            <p className="text-xs text-gray-400">Daily summary, working days, and team settings</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="flex px-6">
          {tabs.map((tabItem) => {
            const Icon = tabItem.icon;
            return (
              <button key={tabItem.id} onClick={() => setTab(tabItem.id)} className={`flex items-center gap-2 py-3.5 px-4 text-sm font-medium border-b-2 transition-colors ${tab === tabItem.id ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" /> {tabItem.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-8 px-4">
        {tab === 'daily' ? <DailySummary /> : null}
        {tab === 'monthly' ? <MonthlyTeam /> : null}
        {tab === 'agent' ? <AgentReports agents={agents} /> : null}
        {tab === 'settings' ? <TeamSettings agents={agents} onAgentsChanged={loadAgents} /> : null}
      </div>
    </div>
  );
}
