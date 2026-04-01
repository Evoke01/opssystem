import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { apiFetch } from './api-client';

export default function Login() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('ops_user')) navigate('/agent');
    apiFetch('/api/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTeam) { setMembers([]); setSelectedUser(''); return; }
    apiFetch(`/api/teams/${selectedTeam}/members`)
      .then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : [])).catch(() => {});
    setSelectedUser('');
  }, [selectedTeam]);

  const handleLogin = async () => {
    if (!selectedUser || !password) { setError('Please select your name and enter your password'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(selectedUser), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return; }
      sessionStorage.setItem('ops_user', JSON.stringify(data.user));
      navigate('/agent');
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-96 flex-col justify-between p-10 bg-zinc-900 border-r border-zinc-800/60">
        <div>
          <div className="flex items-center gap-2.5 mb-14">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg grid grid-cols-2 gap-0.5 p-1.5">
              <div className="bg-white rounded-[2px] opacity-90"></div>
              <div className="bg-white rounded-[2px] opacity-40"></div>
              <div className="bg-white rounded-[2px] opacity-40"></div>
              <div className="bg-white rounded-[2px] opacity-90"></div>
            </div>
            <span className="text-white font-semibold text-sm">OpsSystem</span>
          </div>

          <h1 className="text-2xl font-bold text-white leading-snug mb-3">Daily reporting,<br />simplified.</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-10">Upload your session batch, log requeue counts, and keep your team lead in sync — every shift.</p>

          <div className="space-y-5">
            {[
              { n: '01', title: 'Upload your batch', desc: 'CSV or Excel from today\'s shift' },
              { n: '02', title: 'Log requeue counts', desc: 'ID retakes, tech transfers, system issues' },
              { n: '03', title: 'Submit & done', desc: 'TL gets notified automatically at 6 PM' },
            ].map(item => (
              <div key={item.n} className="flex items-start gap-4">
                <span className="text-xs font-mono text-indigo-400 font-medium mt-0.5 w-5 shrink-0">{item.n}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-700">Reports auto-archive at month end</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[340px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg grid grid-cols-2 gap-0.5 p-1">
              <div className="bg-white rounded-[2px]"></div><div className="bg-white rounded-[2px] opacity-40"></div>
              <div className="bg-white rounded-[2px] opacity-40"></div><div className="bg-white rounded-[2px]"></div>
            </div>
            <span className="text-white font-semibold text-sm">OpsSystem</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
          <p className="text-zinc-500 text-sm mb-7">Select your team and agent profile</p>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 mb-5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Team</label>
              <div className="relative">
                <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-3.5 pr-9 text-sm text-white appearance-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                  <option value="">Select a team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            <div className={selectedTeam ? '' : 'opacity-40 pointer-events-none'}>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Your name</label>
              <div className="relative">
                <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} disabled={!selectedTeam}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-3.5 pr-9 text-sm text-white appearance-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                  <option value="">Select your name…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            <div className={selectedUser ? '' : 'opacity-40 pointer-events-none'}>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} disabled={!selectedUser}
                placeholder="••••••••"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            </div>

            <button onClick={handleLogin} disabled={loading || !selectedUser || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all mt-1">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign In →'}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800/80 text-center">
            <button onClick={() => navigate('/admin/login')} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Team Lead? Login here →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
