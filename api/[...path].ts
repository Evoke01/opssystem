import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const app = express();
app.use(express.json());
const upload = multer({ dest: '/tmp' });

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end };
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req: any, res: any) => {
  const { user_id, password } = req.body;
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { data, error } = await supabase.from('users').select('*').eq('id', user_id).single();
  if (error || !data) return res.status(401).json({ error: 'User not found' });
  if (data.password !== password) return res.status(401).json({ error: 'Invalid password' });
  res.json({ success: true, user: { id: data.id, name: data.name, team_id: data.team_id, role: data.role } });
});

app.post('/api/admin/login', (req: any, res: any) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'tl@2024';
  if (password !== adminPassword) return res.status(401).json({ error: 'Invalid password' });
  res.json({ success: true });
});

// ─── TEAMS & MEMBERS ─────────────────────────────────────────────────────────

app.get('/api/teams', async (_req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/teams/:teamId/members', async (req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { data, error } = await supabase
    .from('users').select('id, name')
    .eq('team_id', req.params.teamId)
    .eq('role', 'agent')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── AGENT ───────────────────────────────────────────────────────────────────

app.get('/api/agent/reports', async (req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { user_name, month } = req.query;
  if (!user_name) return res.status(400).json({ error: 'user_name required' });
  let query = supabase.from('daily_reports').select('*').eq('user_id', user_name).order('date', { ascending: false });
  if (month) {
    const { start, end } = monthRange(month as string);
    query = query.gte('date', start).lt('date', end);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ─── UPLOAD & SUBMIT ─────────────────────────────────────────────────────────

app.post('/api/upload', upload.single('file'), (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.csv') {
      let rowCount = 0;
      fs.createReadStream(req.file.path)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', () => { rowCount++; })
        .on('end', () => { fs.unlinkSync(req.file!.path); res.json({ total_sessions: rowCount }); })
        .on('error', () => { fs.unlinkSync(req.file!.path); res.status(500).json({ error: 'Failed to parse CSV' }); });
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(req.file.path);
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      fs.unlinkSync(req.file.path);
      res.json({ total_sessions: data.length });
    } else {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Unsupported file type' });
    }
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

app.post('/api/submit', async (req: any, res: any) => {
  const { user_id, date, total_sessions, id_retake, tech_issue, system_issue } = req.body;
  if (!user_id || !date || total_sessions === undefined || id_retake === undefined || tech_issue === undefined || system_issue === undefined)
    return res.status(400).json({ error: 'Missing required fields' });
  if ((id_retake + tech_issue + system_issue) > total_sessions)
    return res.status(400).json({ error: 'Total requeues cannot exceed total sessions' });
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { error } = await supabase.from('daily_reports').insert([{ user_id, date, total_sessions, id_retake, tech_issue, system_issue }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to save data' }); }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────

app.get('/api/admin/summary', async (req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data: reports, error } = await supabase.from('daily_reports').select('*').eq('date', date);
    if (error) throw error;
    let total_sessions = 0, total_id_retake = 0, total_tech_issue = 0, total_system_issue = 0;
    const agents = (reports || []).map((r: any) => {
      total_sessions += r.total_sessions; total_id_retake += r.id_retake;
      total_tech_issue += r.tech_issue; total_system_issue += r.system_issue;
      const rq = r.id_retake + r.tech_issue + r.system_issue;
      return { user_id: r.user_id, total_sessions: r.total_sessions, id_retake: r.id_retake, tech_issue: r.tech_issue, system_issue: r.system_issue, requeue_percent: r.total_sessions > 0 ? (rq / r.total_sessions) * 100 : 0 };
    });
    const total_requeue = total_id_retake + total_tech_issue + total_system_issue;
    const issues = [{ name: 'ID Retake', count: total_id_retake }, { name: 'Tech Issue', count: total_tech_issue }, { name: 'System Issue', count: total_system_issue }].sort((a, b) => b.count - a.count);
    agents.sort((a: any, b: any) => b.requeue_percent - a.requeue_percent);
    res.json({ totals: { total_sessions, total_requeue, requeue_percent: total_sessions > 0 ? (total_requeue / total_sessions) * 100 : 0, top_issue: issues[0].count > 0 ? issues[0].name : 'None' }, agents });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to fetch summary' }); }
});

app.get('/api/admin/monthly', async (req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);
  const { data: reports, error } = await supabase.from('daily_reports').select('*').gte('date', start).lt('date', end);
  if (error) return res.status(500).json({ error: error.message });
  const byUser: Record<string, any> = {};
  for (const r of reports || []) {
    if (!byUser[r.user_id]) byUser[r.user_id] = { user_id: r.user_id, total_sessions: 0, id_retake: 0, tech_issue: 0, system_issue: 0, days: 0 };
    byUser[r.user_id].total_sessions += r.total_sessions;
    byUser[r.user_id].id_retake += r.id_retake;
    byUser[r.user_id].tech_issue += r.tech_issue;
    byUser[r.user_id].system_issue += r.system_issue;
    byUser[r.user_id].days++;
  }
  const agents = Object.values(byUser).map((a: any) => ({
    ...a,
    total_requeue: a.id_retake + a.tech_issue + a.system_issue,
    requeue_percent: a.total_sessions > 0 ? ((a.id_retake + a.tech_issue + a.system_issue) / a.total_sessions * 100).toFixed(2) : '0.00'
  })).sort((a: any, b: any) => parseFloat(b.requeue_percent) - parseFloat(a.requeue_percent));
  res.json({ month, agents });
});

app.get('/api/admin/agents', async (_req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { data, error } = await supabase.from('users').select('id, name, team_id').eq('role', 'agent').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/admin/user-reports', async (req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { user_name, month } = req.query;
  if (!user_name) return res.status(400).json({ error: 'user_name required' });
  let query = supabase.from('daily_reports').select('*').eq('user_id', user_name).order('date', { ascending: false });
  if (month) {
    const { start, end } = monthRange(month as string);
    query = query.gte('date', start).lt('date', end);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.all('/api/report', async (_req: any, res: any) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: reports, error } = await supabase.from('daily_reports').select('*').eq('date', today);
    if (error) throw error;
    if (!reports || reports.length === 0) return res.json({ success: true, message: 'No reports today' });
    let total_sessions = 0, total_id_retake = 0, total_tech_issue = 0, total_system_issue = 0, agentRows = '';
    for (const r of reports) {
      total_sessions += r.total_sessions; total_id_retake += r.id_retake;
      total_tech_issue += r.tech_issue; total_system_issue += r.system_issue;
      const rq = r.id_retake + r.tech_issue + r.system_issue;
      agentRows += `<tr><td style="border:1px solid #ddd;padding:8px">${r.user_id}</td><td style="border:1px solid #ddd;padding:8px">${r.total_sessions}</td><td style="border:1px solid #ddd;padding:8px">${r.id_retake}</td><td style="border:1px solid #ddd;padding:8px">${r.tech_issue}</td><td style="border:1px solid #ddd;padding:8px">${r.system_issue}</td><td style="border:1px solid #ddd;padding:8px">${r.total_sessions > 0 ? ((rq / r.total_sessions) * 100).toFixed(2) : '0.00'}%</td></tr>`;
    }
    const total_requeues = total_id_retake + total_tech_issue + total_system_issue;
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({ from: 'Ops System <onboarding@resend.dev>', to: process.env.TEAM_LEAD_EMAIL!, subject: `Daily Ops Report - ${today}`, html: `<h2>Daily Ops Report - ${today}</h2><p><b>Sessions:</b> ${total_sessions} | <b>Requeues:</b> ${total_requeues} | <b>Rate:</b> ${total_sessions > 0 ? ((total_requeues / total_sessions) * 100).toFixed(2) : 0}%</p><table style="border-collapse:collapse;width:100%"><thead><tr><th style="border:1px solid #ddd;padding:8px;background:#f2f2f2">Agent</th><th style="border:1px solid #ddd;padding:8px;background:#f2f2f2">Sessions</th><th style="border:1px solid #ddd;padding:8px;background:#f2f2f2">ID Retake</th><th style="border:1px solid #ddd;padding:8px;background:#f2f2f2">Tech Transfer</th><th style="border:1px solid #ddd;padding:8px;background:#f2f2f2">System Issue</th><th style="border:1px solid #ddd;padding:8px;background:#f2f2f2">Requeue %</th></tr></thead><tbody>${agentRows}</tbody></table>` });
    res.json({ success: true, message: 'Report sent' });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed' }); }
});

export default app;
