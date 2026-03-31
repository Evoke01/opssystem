import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2, LogOut, ClipboardList, BarChart2, ChevronDown, ChevronRight, Hash } from 'lucide-react';

function CodesPanel({ reportId }: { reportId: number }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/report-codes?report_id=${reportId}`)
      .then(r => r.json())
      .then(d => { setCodes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [reportId]);

  if (loading) return <div className="px-4 py-3 text-xs text-gray-400">Loading codes...</div>;
  if (codes.length === 0) return <div className="px-4 py-3 text-xs text-gray-400 italic">No access codes stored for this report</div>;

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Access Codes ({codes.length})</p>
      <div className="flex flex-wrap gap-1.5">
        {codes.map(c => (
          <span key={c.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs font-mono px-2 py-1 rounded-md">
            <Hash className="w-2.5 h-2.5 text-gray-400" />{c.code}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportsTable({ reports }: { reports: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (reports.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No reports found for this period</div>
  );

  const totals = reports.reduce((a, r) => ({
    s: a.s + r.total_sessions, ir: a.ir + r.id_retake, ti: a.ti + r.tech_issue, si: a.si + r.system_issue
  }), { s: 0, ir: 0, ti: 0, si: 0 });
  const totalRq = totals.ir + totals.ti + totals.si;
  const sessionAvg = reports.length > 0 ? (totals.s / reports.length) : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions', value: totals.s },
          { label: 'Session Avg / Day', value: sessionAvg.toFixed(1) },
          { label: 'Total Requeues', value: totalRq },
          { label: 'Requeue Rate', value: `${totals.s > 0 ? (totalRq / totals.s * 100).toFixed(1) : '0.0'}%` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8"></th>
                {['Date', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => {
                const rq = r.id_retake + r.tech_issue + r.system_issue;
                const pct = r.total_sessions > 0 ? (rq / r.total_sessions * 100) : 0;
                const isOpen = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isOpen ? 'bg-blue-50' : ''}`}
                      onClick={() => setExpanded(isOpen ? null : r.id)}>
                      <td className="px-3 py-3 text-gray-400">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.date}</td>
                      <td className="px-4 py-3 text-gray-700">{r.total_sessions}</td>
                      <td className="px-4 py-3 text-gray-700">{r.id_retake}</td>
                      <td className="px-4 py-3 text-gray-700">{r.tech_issue}</td>
                      <td className="px-4 py-3 text-gray-700">{r.system_issue}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${pct > 10 ? 'text-red-600' : 'text-emerald-600'}`}>{pct.toFixed(1)}%</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-gray-100">
                        <td colSpan={7} className="p-0">
                          <CodesPanel reportId={r.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-blue-50 border-t-2 border-blue-100">
              <tr>
                <td className="px-3 py-3"></td>
                <td className="px-4 py-3 font-bold text-gray-900">Total ({reports.length} days)</td>
                <td className="px-4 py-3 font-bold">{totals.s}</td>
                <td className="px-4 py-3 font-bold">{totals.ir}</td>
                <td className="px-4 py-3 font-bold">{totals.ti}</td>
                <td className="px-4 py-3 font-bold">{totals.si}</td>
                <td className="px-4 py-3 font-bold">
                  <span className={totals.s > 0 && (totalRq / totals.s * 100) > 10 ? 'text-red-600' : 'text-emerald-600'}>
                    {totals.s > 0 ? (totalRq / totals.s * 100).toFixed(1) : '0.0'}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<'submit' | 'monthly'>('submit');

  // Submit state
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedCodes, setPastedCodes] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [idRetake, setIdRetake] = useState(0);
  const [techIssue, setTechIssue] = useState(0);
  const [systemIssue, setSystemIssue] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Monthly state
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('ops_user');
    if (!stored) { navigate('/'); return; }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (user && tab === 'monthly') fetchMonthly();
  }, [user, tab, month]);

  const fetchMonthly = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/agent/reports?user_name=${encodeURIComponent(user.name)}&month=${month}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch { setReports([]); }
    setLoadingReports(false);
  };

  const handlePasteCodes = (text: string) => {
    setPastedCodes(text);
    const parsed = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setCodes(parsed);
    setTotalSessions(parsed.length > 0 ? parsed.length : null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTotalSessions(data.total_sessions);
      setCodes(data.codes || []);
    } catch (e: any) { setError(e.message); }
    setIsUploading(false);
  };

  const resetInput = () => {
    setFile(null); setTotalSessions(null); setCodes([]); setPastedCodes(''); setError(null);
  };

  const handleSubmit = async () => {
    if (!user || totalSessions === null) return;
    const totalRequeue = idRetake + techIssue + systemIssue;
    if (totalRequeue > totalSessions) { setError('Total requeues cannot exceed total sessions'); return; }
    setIsSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.name,
          date: new Date().toISOString().split('T')[0],
          total_sessions: totalSessions,
          id_retake: idRetake, tech_issue: techIssue, system_issue: systemIssue,
          codes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
      resetInput(); setIdRetake(0); setTechIssue(0); setSystemIssue(0); setInputMode('file');
      setTimeout(() => setSuccess(false), 5000);
    } catch (e: any) { setError(e.message); }
    setIsSubmitting(false);
  };

  const logout = () => { sessionStorage.removeItem('ops_user'); navigate('/'); };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Ops</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-400">Agent Dashboard</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex px-6">
          {([
            { id: 'submit', label: 'Submit Report', icon: ClipboardList },
            { id: 'monthly', label: 'My Monthly Data', icon: BarChart2 },
          ] as const).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 py-3.5 px-4 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-8 px-4">
        {tab === 'submit' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6 shadow-sm">
            {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
            {success && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4 flex-shrink-0" />Report submitted successfully!</div>}

            {/* Step 1: Session Input */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">1. Session Input</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {(['file', 'paste'] as const).map(m => (
                    <button key={m} onClick={() => { setInputMode(m); resetInput(); }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${inputMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {m === 'file' ? '📁 Upload File' : '📋 Paste Codes'}
                    </button>
                  ))}
                </div>
              </div>

              {inputMode === 'file' ? (
                <>
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                    <FileUp className="w-7 h-7 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-medium text-blue-600">Click to upload</span> CSV or Excel</p>
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls"
                      onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setTotalSessions(null); setCodes([]); setError(null); } }} />
                  </label>
                  {file && (
                    <div className="mt-3 flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="text-sm text-gray-600 truncate max-w-[200px]">{file.name}</span>
                      <button onClick={handleUpload} disabled={isUploading || totalSessions !== null}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors">
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Process File'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <textarea
                    value={pastedCodes}
                    onChange={e => handlePasteCodes(e.target.value)}
                    placeholder={"Paste access codes here — one per line or comma separated:\nABC123\nDEF456\nGHI789..."}
                    rows={8}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-300"
                  />
                  {codes.length > 0 && (
                    <p className="mt-1.5 text-xs text-gray-400 text-right">{codes.length} codes detected</p>
                  )}
                </div>
              )}

              {totalSessions !== null && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {totalSessions} sessions {codes.length > 0 ? `(${codes.length} codes stored)` : ''}
                </div>
              )}
            </div>

            {/* Step 2: Requeues */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">2. Enter Requeue Counts</h3>
              <div className="grid grid-cols-3 gap-4">
                {([['ID Retake', idRetake, setIdRetake], ['Tech Transfer', techIssue, setTechIssue], ['System Issue', systemIssue, setSystemIssue]] as any[]).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                    <input type="number" min="0" value={val}
                      onChange={e => setter(parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                ))}
              </div>
              {totalSessions !== null && (
                <p className="mt-2 text-xs text-gray-400 text-right">
                  Total requeue: {idRetake + techIssue + systemIssue} / {totalSessions}
                </p>
              )}
            </div>

            <button onClick={handleSubmit} disabled={isSubmitting || totalSessions === null}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><Upload className="w-4 h-4" />Submit Daily Report</>}
            </button>
          </div>
        )}

        {tab === 'monthly' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Month:</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {loadingReports
              ? <div className="text-center py-12 text-gray-400 text-sm">Loading reports...</div>
              : <ReportsTable reports={reports} />
            }
          </div>
        )}
      </div>
    </div>
  );
}
