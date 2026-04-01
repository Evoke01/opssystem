import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileUp,
  Hash,
  Loader2,
  LogOut,
  Upload,
} from 'lucide-react';
import { apiFetch } from './api-client';

function formatValue(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(digits);
}

function getLocalDateKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {sub ? <p className="text-xs text-gray-400 mt-1">{sub}</p> : null}
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
    return <div className="px-4 py-3 text-xs text-gray-400">Loading codes...</div>;
  }

  if (!codes.length) {
    return <div className="px-4 py-3 text-xs text-gray-400 italic">No access codes stored for this report</div>;
  }

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Access Codes ({codes.length})</p>
      <div className="flex flex-wrap gap-1.5">
        {codes.map((code) => (
          <span key={code.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs font-mono px-2 py-1 rounded-md">
            <Hash className="w-2.5 h-2.5 text-gray-400" />
            {code.code}
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Working Days" value={summary.working_days ?? 0} />
        <SummaryCard label="Submitted Days" value={summary.submitted_days ?? 0} />
        <SummaryCard label="Leave Days" value={summary.leave_days ?? 0} />
        <SummaryCard label="Total Sessions" value={summary.total_sessions ?? 0} />
        <SummaryCard label="Session Avg / Working Day" value={formatValue(summary.session_avg)} />
      </div>

      {leaves.length ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Leave Dates</p>
          <div className="flex flex-wrap gap-2">
            {leaves.map((leave: any) => (
              <span key={leave.id} className="bg-white border border-amber-200 rounded-md px-2.5 py-1 text-xs text-gray-700">
                {leave.date}{leave.reason ? ` - ${leave.reason}` : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!reports.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No reports found for this period</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8"></th>
                  {['Date', 'Sessions', 'ID Retake', 'Tech Transfer', 'System Issue', 'Requeue %'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report: any) => {
                  const isOpen = expanded === report.id;
                  return (
                    <React.Fragment key={report.id}>
                      <tr className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isOpen ? 'bg-blue-50' : ''}`} onClick={() => setExpanded(isOpen ? null : report.id)}>
                        <td className="px-3 py-3 text-gray-400">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{report.date}</td>
                        <td className="px-4 py-3 text-gray-700">{report.total_sessions}</td>
                        <td className="px-4 py-3 text-gray-700">{report.id_retake}</td>
                        <td className="px-4 py-3 text-gray-700">{report.tech_issue}</td>
                        <td className="px-4 py-3 text-gray-700">{report.system_issue}</td>
                        <td className="px-4 py-3 text-gray-700">{report.requeue_percent === null ? '-' : `${formatValue(report.requeue_percent)}%`}</td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-gray-100">
                          <td colSpan={7} className="p-0">
                            <CodesPanel reportId={report.id} />
                          </td>
                        </tr>
                      ) : null}
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
    if (!stored) {
      navigate('/');
      return;
    }

    const parsed = JSON.parse(stored);
    setUser(parsed);
    setSelectedDate(getLocalDateKey(parsed.timezone || 'Asia/Kolkata'));
  }, [navigate]);

  useEffect(() => {
    if (!user || !selectedDate) {
      return;
    }

    setLoadingDay(true);
    apiFetch(`/api/agent/day-report?user_id=${user.id}&date=${selectedDate}`)
      .then((response) => response.json())
      .then((data) => {
        startTransition(() => setCurrentDay(data));
        setLoadingDay(false);
      })
      .catch(() => {
        setCurrentDay(null);
        setLoadingDay(false);
      });
  }, [selectedDate, user]);

  useEffect(() => {
    if (!user || tab !== 'monthly') {
      return;
    }

    setLoadingReports(true);
    apiFetch(`/api/agent/reports?user_id=${user.id}&month=${month}`)
      .then((response) => response.json())
      .then((data) => {
        startTransition(() => setMonthlyPayload(data));
        setLoadingReports(false);
      })
      .catch(() => {
        setMonthlyPayload({ reports: [], summary: {}, leaves: [] });
        setLoadingReports(false);
      });
  }, [month, tab, user]);

  const localToday = user ? getLocalDateKey(user.timezone || 'Asia/Kolkata') : '';

  const resetBatch = () => {
    setFile(null);
    setPastedCodes('');
    setCodes([]);
    setTotalSessions(null);
    setIdRetake(0);
    setTechIssue(0);
    setSystemIssue(0);
  };

  const handlePasteCodes = (text: string) => {
    const parsed = Array.from(new Set(text.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean)));
    setPastedCodes(text);
    setCodes(parsed);
    setTotalSessions(parsed.length > 0 ? parsed.length : null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process file');
      }

      setCodes(Array.isArray(data.codes) ? data.codes : []);
      setTotalSessions(Number(data.total_sessions ?? 0) || null);
    } catch (uploadError: any) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedDate || totalSessions === null) {
      setError('Select a date and upload a batch before submitting.');
      return;
    }

    if (selectedDate > localToday) {
      setError('Future dates are not allowed.');
      return;
    }

    const batchRequeue = idRetake + techIssue + systemIssue;
    if (batchRequeue > totalSessions) {
      setError('Batch requeues cannot exceed the accepted sessions in this upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          date: selectedDate,
          total_sessions: totalSessions,
          id_retake: idRetake,
          tech_issue: techIssue,
          system_issue: systemIssue,
          codes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit data');
      }

      setCurrentDay({
        exists: true,
        report: data.report,
        codes_count: data.codes_count,
      });
      setSuccess(`Saved ${data.accepted_sessions} new sessions. Ignored ${data.duplicate_codes_ignored} duplicates.`);
      resetBatch();
    } catch (submitError: any) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('ops_user');
    navigate('/');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

      <div className="bg-white border-b border-gray-200">
        <div className="flex px-6">
          {[{ id: 'submit', label: 'Submit Report', icon: ClipboardList }, { id: 'monthly', label: 'My Monthly Data', icon: BarChart2 }].map((tabItem) => {
            const Icon = tabItem.icon;
            return (
              <button key={tabItem.id} onClick={() => setTab(tabItem.id as 'submit' | 'monthly')} className={`flex items-center gap-2 py-3.5 px-4 text-sm font-medium border-b-2 transition-colors ${tab === tabItem.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" /> {tabItem.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {tab === 'submit' ? (
          <div className="space-y-6">
            {error ? <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div> : null}
            {success ? <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />{success}</div> : null}

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="grid md:grid-cols-[220px,1fr] gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Date</label>
                  <input type="date" value={selectedDate} max={localToday} onChange={(event) => setSelectedDate(event.target.value)} className="w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <p className="text-sm text-gray-500">You can submit for today or past dates only. Reminders only trigger after your shift ends and only when nothing has been saved for that local day.</p>
              </div>

              {loadingDay ? (
                <div className="text-sm text-gray-400">Loading saved totals...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <SummaryCard label="Saved Sessions" value={currentDay?.report?.total_sessions ?? 0} sub={selectedDate || localToday} />
                  <SummaryCard label="Saved Codes" value={currentDay?.codes_count ?? 0} />
                  <SummaryCard label="ID Retake" value={currentDay?.report?.id_retake ?? 0} />
                  <SummaryCard label="Tech Transfer" value={currentDay?.report?.tech_issue ?? 0} />
                  <SummaryCard label="System Issue" value={currentDay?.report?.system_issue ?? 0} />
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">New Batch Upload</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {(['file', 'paste'] as const).map((mode) => (
                    <button key={mode} onClick={() => { setInputMode(mode); resetBatch(); }} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${inputMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {mode === 'file' ? 'Upload File' : 'Paste Codes'}
                    </button>
                  ))}
                </div>
              </div>

              {inputMode === 'file' ? (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                    <FileUp className="w-7 h-7 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-medium text-blue-600">Click to upload</span> CSV or Excel</p>
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(event) => { if (event.target.files?.[0]) { setFile(event.target.files[0]); setError(null); } }} />
                  </label>
                  {file ? (
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="text-sm text-gray-600 truncate max-w-[240px]">{file.name}</span>
                      <button onClick={handleUpload} disabled={isUploading || totalSessions !== null} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors">
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Process File'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <textarea value={pastedCodes} onChange={(event) => handlePasteCodes(event.target.value)} placeholder={'Paste access codes here, one per line or comma separated'} rows={8} className="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-300" />
              )}

              {totalSessions !== null ? <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">{totalSessions} unique sessions ready in this batch</div> : null}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Batch Requeue Counts</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[['ID Retake', idRetake, setIdRetake], ['Tech Transfer', techIssue, setTechIssue], ['System Issue', systemIssue, setSystemIssue]].map(([label, value, setter]) => (
                    <div key={String(label)}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                      <input type="number" min="0" value={Number(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<number>>)(parseInt(event.target.value, 10) || 0)} className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSubmit} disabled={isSubmitting || totalSessions === null} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving batch...</> : <><Upload className="w-4 h-4" />Save Batch To Day</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Month:</label>
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {loadingReports ? <div className="text-center py-12 text-gray-400 text-sm">Loading reports...</div> : <ReportsTable payload={monthlyPayload} />}
          </div>
        )}
      </div>
    </div>
  );
}
