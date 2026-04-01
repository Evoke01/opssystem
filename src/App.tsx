import React, { useState } from 'react';
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2, Mail, X } from 'lucide-react';
import { apiFetch } from './api-client';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState('');
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [idRetake, setIdRetake] = useState<number>(0);
  const [techIssue, setTechIssue] = useState<number>(0);
  const [systemIssue, setSystemIssue] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { setFile(e.target.files[0]); setError(null); }
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first.'); return; }
    setIsUploading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiFetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload file');
      setTotalSessions(data.total_sessions);
    } catch (err: any) { setError(err.message); }
    finally { setIsUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) { setError('Agent ID is required'); return; }
    if (totalSessions === null) { setError('Please upload a file first'); return; }
    const totalRequeue = idRetake + techIssue + systemIssue;
    if (totalRequeue > totalSessions) { setError(`Total requeues (${totalRequeue}) cannot exceed total sessions (${totalSessions})`); return; }
    setIsSubmitting(true); setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiFetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, date: today, total_sessions: totalSessions, id_retake: idRetake, tech_issue: techIssue, system_issue: systemIssue }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit data');
      setSuccess(true); setFile(null); setTotalSessions(null); setIdRetake(0); setTechIssue(0); setSystemIssue(0);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true); setError(null); setEmailSuccess(false);
    try {
      const response = await apiFetch('/api/report', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send email');
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 5000);
    } catch (err: any) { setError(err.message); }
    finally { setIsSendingEmail(false); }
  };

  const inputCls = "w-full border border-zinc-300 rounded-xl py-2 px-3.5 text-sm text-zinc-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg grid grid-cols-2 gap-0.5 p-1.5">
              <div className="bg-white rounded-[2px]"></div><div className="bg-white rounded-[2px] opacity-40"></div>
              <div className="bg-white rounded-[2px] opacity-40"></div><div className="bg-white rounded-[2px]"></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Daily Ops Report</h2>
          <p className="text-sm text-zinc-400 mt-1">Submit your daily session data</p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />Report submitted successfully!
          </div>
        )}
        {emailSuccess && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />Email report sent successfully!
          </div>
        )}

        {/* Step 1 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">1</span>
            <h3 className="text-sm font-semibold text-zinc-700">Upload Session File</h3>
          </div>
          <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/20 transition-all group">
            <FileUp className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 mb-2 transition-colors" />
            <p className="text-sm text-zinc-400"><span className="font-medium text-indigo-500">Click to upload</span> CSV or Excel</p>
            <input id="dropzone-file" type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
          </label>
          {file && (
            <div className="mt-3 flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl p-3">
              <span className="text-sm text-zinc-600 truncate max-w-[200px]">{file.name}</span>
              <button onClick={handleUpload} disabled={isUploading || totalSessions !== null}
                className="ml-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold rounded-lg transition-colors">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Process'}
              </button>
            </div>
          )}
          {totalSessions !== null && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4" />{totalSessions} sessions found
            </div>
          )}
        </div>

        {/* Step 2 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">2</span>
            <h3 className="text-sm font-semibold text-zinc-700">Enter Requeue Details</h3>
          </div>
          <div>
            <label htmlFor="userId" className="block text-xs font-medium text-zinc-500 mb-1.5">Agent ID / Name</label>
            <input type="text" id="userId" required value={userId} onChange={e => setUserId(e.target.value)} className={inputCls} placeholder="e.g. AGENT-001" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['ID Retake', idRetake, setIdRetake], ['Tech Transfer', techIssue, setTechIssue], ['System Issue', systemIssue, setSystemIssue]].map(([label, value, setter]) => (
              <div key={String(label)} className="bg-zinc-50 rounded-xl border border-zinc-200 p-3">
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">{label}</label>
                <input type="number" min="0" required value={Number(value)}
                  onChange={e => (setter as React.Dispatch<React.SetStateAction<number>>)(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-zinc-200 rounded-lg py-1.5 text-base font-bold text-zinc-800 text-center focus:outline-none focus:border-indigo-400 font-mono" />
              </div>
            ))}
          </div>
          <button type="submit" disabled={isSubmitting || totalSessions === null}
            className="w-full flex justify-center items-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : <><Upload className="w-4 h-4" />Submit Daily Report</>}
          </button>
        </form>

        {/* Step 3 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">3</span>
            <h3 className="text-sm font-semibold text-zinc-700">Send Daily Summary</h3>
          </div>
          <p className="text-xs text-zinc-400 mb-4">Manually trigger the aggregate email report. Also runs automatically at 6 PM.</p>
          <button onClick={handleSendEmail} disabled={isSendingEmail}
            className="w-full flex justify-center items-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all">
            {isSendingEmail ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Mail className="w-4 h-4" />Send Email Report</>}
          </button>
        </div>
      </div>
    </div>
  );
}
