import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { apiFetch } from './api-client';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('ops_admin') === 'true') navigate('/admin');
  }, []);

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid password'); setLoading(false); return; }
      sessionStorage.setItem('ops_admin', 'true');
      navigate('/admin');
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      {/* Subtle grid bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div className="relative w-full max-w-[360px]">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-zinc-300" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white">Team Lead Access</h1>
          <p className="text-sm text-zinc-500 mt-1">Enter your admin password to continue</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Admin Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter admin password"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20" />
          </div>

          <button onClick={handleLogin} disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-900 rounded-xl text-sm font-semibold transition-all">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin text-zinc-600" />Signing in…</> : 'Sign In'}
          </button>
        </div>

        <div className="mt-5 text-center">
          <button onClick={() => navigate('/')} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Back to Agent Login
          </button>
        </div>
      </div>
    </div>
  );
}
