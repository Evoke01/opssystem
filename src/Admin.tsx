import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogOut, Users, Calendar, BarChart2 } from 'lucide-react';

function StatCard({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AgentTable({ agents, cols }: { agents: any[]; cols: { key: string; label: string }[] }) {
  if (agents.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">No data found</div>
  );
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {cols.map(c => <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agents.map((a, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3 ${c.key === 'user_id' ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {c.key === 'requeue_percent'
                      ? <span className={`font-semibold ${parseFloat(a[c.key]) > 10 ? 'text-red-600' : 'text-emerald-600'}`}>{typeof a[c.key] === 'number' ? a[c.key].toFixed(1) : a[c.key]}%</span>
                      : a[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 1: Daily Summary ────────────────────────────────────────────────────
function DailySummary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchSummary(); }, [date]);

  const fetchSummary = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/summary?date=${date}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>}
      {data && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Sessions" value={data.totals.total_sessions} />
            <StatCard label="Total Requeues" value={data.totals.total_requeue} />
            <StatCard label="Requeue Rate" value={`${data.totals.requeue_percent.toFixed(1)}%`} />
            <StatCard label="Top Issue" value={data.totals.top_issue} />
          </div>
          <AgentTable agents={data.agents} cols={[
            { key: 'user_id', label: 'Agent' },
            { key: 'total_sessions', label: 'Sessions' },
            { key: 'id_retake', label: 'ID Retake' },
            { key: 'tech_issue', label: 'Tech Transfer' },
            { key: 'system_issue', label: 'System Issue' },
            { key: 'requeue_percent', label: 'Requeue %' },
          ]} />
        </>
      )}
    </div>
  );
}

// ─── TAB 2: Monthly Team ─────────────────────────────────────────────────────
function MonthlyTeam() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchMonthly(); }, [month]);

  const fetchMonthly = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/monthly?month=${month}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const totals = data?.agents?.reduce((a: any, r: any) => ({
    s: a.s + r.total_sessions, rq: a.rq + r.total_requeue, days: a.days + r.days
  }), { s: 0, rq: 0, days: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>}
      {data && !loading && (
        <>
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Sessions" value={totals.s} />
              <StatCard label="Total Requeues" value={totals.rq} />
              <StatCard label="Team Requeue Rate" value={totals.s > 0 ? `${(totals.rq / totals.s * 100).toFixed(1)}%` : '0%'} />
              <StatCard label="Active Agents" value={data.agents.length} sub={`${totals.days} total report days`} />
            </div>
          )}
          <AgentTable agents={data.agents} cols={[
            { key: 'user_id', label: 'Agent' },
            { key: 'days', label: 'Days Active' },
            { key: 'total_sessions', label: 'Sessions' },
            { key: 'id_retake', label: 'ID Retake' },
            { key: 'tech_issue', label: 'Tech Transfer' },
            { key: 'system_issue', label: 'System Issue' },
            { key: 'total_requeue', label: 'Requeues' },
            { key: 'requeue_percent', label: 'Requeue %' },
          ]} />
        </>
      )}
    </div>
  );
}

// ─── TAB 3: Agent Reports ────────────────────────────────────────────────────
function AgentReports() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [month, setMonth] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agents').then(r => r.json()).then(d => setAgents(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const fetchReports = async () => {
    if (!selectedAgent) { setError('Please select an agent'); return; }
    setLoading(true); setError(null); setSearched(true);
    const params = new URLSearchParams({ user_name: selectedAgent });
    if (month) params.append('month', month);
    try {
      const res = await fetch(`/api/admin/user-reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReports(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const totals = reports.reduce((a, r) => ({
    s: a.s + r.total_sessions, ir: a.ir + r.id_retake, ti: a.ti + r.tech_issue, si: a.si + r.system_issue
  }), { s: 0, ir: 0, ti: 0, si: 0 });
  const totalRq = totals.ir + totals.ti + totals.si;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Agent</label>
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]">
            <option value="">-- Choose agent --</option>
            {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Month (optional)</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={fetchReports}
          className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors">
          View Reports
        </button>
        {month && <button onClick={() => setMonth('')} className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600">Clear month</button>}
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>}

      {searched && !loading && reports.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">No reports found for this agent</div>
      )}

      {reports.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Sessions" value={totals.s} sub={`${reports.length} days`} />
            <StatCard label="Total Requeues" value={totalRq} />
            <StatCard label="Requeue Rate" value={totals.s > 0 ? `${(totalRq / totals.s * 100).toFixed(1)}%` : '0%'} />
            <StatCard label="Top Issue"
              value={[['ID Retake', totals.ir], ['Tech Transfer', totals.ti], ['System Issue', totals.si]].sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.map((r: any) => {
                    const rq = r.id_retake + r.tech_issue + r.system_issue;
                    const pct = r.total_sessions > 0 ? (rq / r.total_sessions * 100) : 0;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{r.date}</td>
                        <td className="px-4 py-3 text-gray-700">{r.total_sessions}</td>
                        <td className="px-4 py-3 text-gray-700">{r.id_retake}</td>
                        <td className="px-4 py-3 text-gray-700">{r.tech_issue}</td>
                        <td className="px-4 py-3 text-gray-700">{r.system_issue}</td>
                        <td className="px-4 py-3"><span className={`font-semibold ${pct > 10 ? 'text-red-600' : 'text-emerald-600'}`}>{pct.toFixed(1)}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-blue-50 border-t-2 border-blue-100 font-bold">
                  <tr>
                    <td className="px-4 py-3">Total ({reports.length} days)</td>
                    <td className="px-4 py-3">{totals.s}</td>
                    <td className="px-4 py-3">{totals.ir}</td>
                    <td className="px-4 py-3">{totals.ti}</td>
                    <td className="px-4 py-3">{totals.si}</td>
                    <td className="px-4 py-3"><span className={totals.s > 0 && (totalRq / totals.s * 100) > 10 ? 'text-red-600' : 'text-emerald-600'}>{totals.s > 0 ? (totalRq / totals.s * 100).toFixed(1) : '0.0'}%</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'daily' | 'monthly' | 'agent'>('daily');

  useEffect(() => {
    if (sessionStorage.getItem('ops_admin') !== 'true') navigate('/admin/login');
  }, []);

  const logout = () => { sessionStorage.removeItem('ops_admin'); navigate('/admin/login'); };

  const tabs = [
    { id: 'daily' as const, label: 'Daily Summary', icon: Calendar },
    { id: 'monthly' as const, label: 'Monthly Team', icon: BarChart2 },
    { id: 'agent' as const, label: 'Agent Reports', icon: Users },
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
            <p className="text-xs text-gray-400">Daily summary and agent performance</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="flex px-6">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 py-3.5 px-4 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-8 px-4">
        {tab === 'daily' && <DailySummary />}
        {tab === 'monthly' && <MonthlyTeam />}
        {tab === 'agent' && <AgentReports />}
      </div>
    </div>
  );
}
