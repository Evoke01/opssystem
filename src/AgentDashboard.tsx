import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, BarChart2, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, FileUp, Hash, Loader2, LogOut, Upload, X,
} from 'lucide-react';
import { apiFetch } from './api-client';

function formatValue(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toFixed(digits);
}

function getLocalDateKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value ?? '1970';
  const month = parts.find(p => p.type === 'month')?.value ?? '01';
  const day = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function StatPill({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-indigo-600' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}

function CodesPanel({ reportId }: { reportId: number }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/report-codes?report_id=${reportId}`)
      .then(r => r.json())
      .then(d => { startTransition(() => setCodes(Array.isArray(d) ? d : [])); setLoading(false); })
      .catch(() => setLoading(false));
  }, [reportId]);

  if (loading) return <div className="px-5 py-3 text-xs text-zinc-400">Loading codes…</div>;
  if (!codes.length) return <div className="px-5 py-3 text-xs text-zinc-400 italic">No access codes stored for this report</div>;

  return (
    <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-100">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Access Codes ({codes.length})</p>
      <div className="flex flex-wrap gap-1.5">
        {codes.map(code => (
          <span key={code.id} className="inline-flex items-center gap-1 bg-white border border-zinc-200 text-zinc-600 text-xs font-mono px-2 py-1 rounded-lg">
            <Hash className="w-2.5 h-2.5 text-zinc-300" />{code.code}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportsTable({ payload }: { payload: any }) {
  const reports = Array.isArray(payload?.reports) ? payload.reports : [];
  const summary = payload?.summary ?? {};
  const leaves = Array.isArray(payload?.leaves) ? payload.leaves : [];
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatPill label="Working Days" value={summary.working_days ?? 0} />
        <StatPill label="Submitted Days" value={summary.submitted_days ?? 0} />
        <StatPill label="Leave Days" value={summary.leave_days ?? 0} />
        <StatPill label="Total Sessions" value={summary.total_sessions ?? 0} accent />
        <StatPill label="Avg / Working Day" value={formatValue(summary.session_avg)} />
      </div>

      {leaves.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-2.5">Leave Dates</p>
          <div className="flex flex-wrap gap-2">
            {leaves.map((leave: any) => (
              <span key={leave.id} className="bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-zinc-700">
                {leave.date}{leave.reason ? ` · ${leave.reason}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {!reports.length ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400 text-sm">No reports found for this period</div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="w-8 px-3 py-3"></th>
                  {['Date', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report: any) => {
                  const isOpen = expanded === report.id;
                  return (
                    <React.Fragment key={report.id}>
                      <tr
                        className={`border-b border-zinc-100 cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50' : 'hover:bg-zinc-50'}`}
                        onClick={() => setExpanded(isOpen ? null : report.id)}
                      >
                        <td className="px-3 py-3 text-zinc-300">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800">{report.date}</td>
                        <td className="px-4 py-3 font-mono text-sm text-zinc-700">{report.total_sessions}</td>
                        <td className="px-4 py-3 text-zinc-600">{report.id_retake}</td>
                        <td className="px-4 py-3 text-zinc-600">{report.tech_issue}</td>
                        <td className="px-4 py-3 text-zinc-600">{report.system_issue}</td>
                        <td className="px-4 py-3">
                          {report.requeue_percent === null ? (
                            <span className="text-zinc-300">—</span>
                          ) : (
                            <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${parseFloat(report.requeue_percent) > 10 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {formatValue(report.requeue_percent)}%
                            </span>
                          )}
                        </td>
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
      )}
    </div>
  );
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<'submit' | 'monthly'>('submit');
  const [selectedDate, setSelectedDate] = useState('');
  const [currentDay, setCurrentDay] = useState<any>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyPayload, setMonthlyPayload] = useState<any>({ reports: [], summary: {}, leaves: [] });
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
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
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('ops_user');
    if (!stored) { navigate('/'); return; }
    const parsed = JSON.parse(stored);
    setUser(parsed);
    setSelectedDate(getLocalDateKey(parsed.timezone || 'Asia/Kolkata'));
  }, [navigate]);

  useEffect(() => {
    if (!user || !selectedDate) return;
    setLoadingDay(true);
    apiFetch(`/api/agent/day-report?user_id=${user.id}&date=${selectedDate}`)
      .then(r => r.json()).then(d => { startTransition(() => setCurrentDay(d)); setLoadingDay(false); })
      .catch(() => { setCurrentDay(null); setLoadingDay(false); });
  }, [selectedDate, user]);

  useEffect(() => {
    if (!user || tab !== 'monthly') return;
    setLoadingReports(true);
    apiFetch(`/api/agent/reports?user_id=${user.id}&month=${month}`)
      .then(r => r.json()).then(d => { startTransition(() => setMonthlyPayload(d)); setLoadingReports(false); })
      .catch(() => { setMonthlyPayload({ reports: [], summary: {}, leaves: [] }); setLoadingReports(false); });
  }, [month, tab, user]);

  const localToday = user ? getLocalDateKey(user.timezone || 'Asia/Kolkata') : '';

  const resetBatch = () => {
    setFile(null); setPastedCodes(''); setCodes([]);
    setTotalSessions(null); setIdRetake(0); setTechIssue(0); setSystemIssue(0);
  };

  const handlePasteCodes = (text: string) => {
    const parsed = Array.from(new Set(text.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)));
    setPastedCodes(text); setCodes(parsed);
    setTotalSessions(parsed.length > 0 ? parsed.length : null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiFetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process file');
      setCodes(Array.isArray(data.codes) ? data.codes : []);
      setTotalSessions(Number(data.total_sessions ?? 0) || null);
    } catch (e: any) { setError(e.message); }
    finally { setIsUploading(false); }
  };

  const handleSubmit = async () => {
    if (!user || !selectedDate || totalSessions === null) { setError('Select a date and upload a batch before submitting.'); return; }
    if (selectedDate > localToday) { setError('Future dates are not allowed.'); return; }
    const batchRequeue = idRetake + techIssue + systemIssue;
    if (batchRequeue > totalSessions) { setError('Batch requeues cannot exceed the accepted sessions in this upload.'); return; }
    setIsSubmitting(true); setError(null); setSuccess(null);
    try {
      const response = await apiFetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, date: selectedDate, total_sessions: totalSessions, id_retake: idRetake, tech_issue: techIssue, system_issue: systemIssue, codes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit data');
      setCurrentDay({ exists: true, report: data.report, codes_count: data.codes_count });
      setSuccess(`Saved ${data.accepted_sessions} new sessions. Ignored ${data.duplicate_codes_ignored} duplicates.`);
      resetBatch();
    } catch (e: any) { setError(e.message); }
    finally { setIsSubmitting(false); }
  };

  const logout = () => { sessionStorage.removeItem('ops_user'); navigate('/'); };

  if (!user) return null;

  const tabs = [
    { id: 'submit' as const, label: 'Submit Report', icon: ClipboardList },
    { id: 'monthly' as const, label: 'Monthly Data', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top nav */}
      <div className="bg-white border-b border-zinc-200 px-5 py-0 flex items-center justify-between h-14 sticky top-0 z-10">
        <div className="flex items-center gap-0">
          <div className="flex items-center gap-2.5 mr-6">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg grid grid-cols-2 gap-0.5 p-1 shrink-0">
              <div className="bg-white rounded-[2px]"></div><div className="bg-white rounded-[2px] opacity-40"></div>
              <div className="bg-white rounded-[2px] opacity-40"></div><div className="bg-white rounded-[2px]"></div>
            </div>
          </div>
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 h-14 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-zinc-800 leading-none">{user.name}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Agent</p>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg">
            <LogOut className="w-3.5 h-3.5" />Logout
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-7 px-4">
        {tab === 'submit' ? (
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)}><X className="w-4 h-4 text-red-400" /></button>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
              </div>
            )}

            {/* Date + saved totals */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              <div className="flex items-end gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Report Date</label>
                  <input type="date" value={selectedDate} max={localToday}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <p className="text-xs text-zinc-400 pb-2">You can submit for today or any past date.</p>
              </div>

              {loadingDay ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading saved totals…</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <StatPill label="Saved Sessions" value={currentDay?.report?.total_sessions ?? 0} accent />
                  <StatPill label="Saved Codes" value={currentDay?.codes_count ?? 0} />
                  <StatPill label="ID Retake" value={currentDay?.report?.id_retake ?? 0} />
                  <StatPill label="Tech Transfer" value={currentDay?.report?.tech_issue ?? 0} />
                  <StatPill label="System Issue" value={currentDay?.report?.system_issue ?? 0} />
                </div>
              )}
            </div>

            {/* Batch upload */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-800">New Batch Upload</h3>
                <div className="flex bg-zinc-100 rounded-lg p-0.5">
                  {(['file', 'paste'] as const).map(mode => (
                    <button key={mode} onClick={() => { setInputMode(mode); resetBatch(); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${inputMode === mode ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
                      {mode === 'file' ? 'Upload File' : 'Paste Codes'}
                    </button>
                  ))}
                </div>
              </div>

              {inputMode === 'file' ? (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
                    <FileUp className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 mb-2 transition-colors" />
                    <p className="text-sm text-zinc-400 group-hover:text-indigo-500 transition-colors">
                      <span className="font-medium">Click to upload</span> · CSV or Excel
                    </p>
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls"
                      onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(null); } }} />
                  </label>
                  {file && (
                    <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                          <FileUp className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        <span className="text-sm text-zinc-600 truncate">{file.name}</span>
                      </div>
                      <button onClick={handleUpload} disabled={isUploading || totalSessions !== null}
                        className="ml-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold rounded-lg transition-colors shrink-0">
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Process'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <textarea value={pastedCodes} onChange={e => handlePasteCodes(e.target.value)}
                  placeholder="Paste access codes here, one per line or comma-separated"
                  rows={7}
                  className="w-full border border-zinc-200 rounded-xl p-3.5 text-sm font-mono text-zinc-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-none placeholder-zinc-300 bg-zinc-50" />
              )}

              {totalSessions !== null && (
                <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {totalSessions} unique sessions ready in this batch
                </div>
              )}

              {/* Requeue inputs */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-700 mb-3">Requeue Counts</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['ID Retake', idRetake, setIdRetake],
                    ['Tech Transfer', techIssue, setTechIssue],
                    ['System Issue', systemIssue, setSystemIssue],
                  ].map(([label, value, setter]) => (
                    <div key={String(label)} className="bg-zinc-50 rounded-xl border border-zinc-200 p-3">
                      <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">{label}</label>
                      <input type="number" min="0" value={Number(value)}
                        onChange={e => (setter as React.Dispatch<React.SetStateAction<number>>)(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-white border border-zinc-200 rounded-lg py-2 px-2 text-base font-bold text-zinc-800 text-center focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 font-mono" />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSubmit} disabled={isSubmitting || totalSessions === null}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving batch…</> : <><Upload className="w-4 h-4" />Save Batch To Day</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-zinc-600">Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="border border-zinc-300 rounded-xl py-2 px-3 text-sm text-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            {loadingReports
              ? <div className="flex items-center justify-center py-16 text-zinc-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading reports…</div>
              : <ReportsTable payload={monthlyPayload} />
            }
          </div>
        )}
      </div>
    </div>
  );
}
