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

// POST /api/upload
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

// POST /api/submit
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

// GET /api/admin/summary
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

// ALL /api/report
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
      agentRows += `<tr><td>${r.user_id}</td><td>${r.total_sessions}</td><td>${r.id_retake}</td><td>${r.tech_issue}</td><td>${r.system_issue}</td><td>${r.total_sessions > 0 ? ((rq / r.total_sessions) * 100).toFixed(2) : '0.00'}%</td></tr>`;
    }
    const total_requeues = total_id_retake + total_tech_issue + total_system_issue;
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({ from: 'Ops System <onboarding@resend.dev>', to: process.env.TEAM_LEAD_EMAIL!, subject: `Daily Ops Report - ${today}`, html: `<h2>Daily Ops Report - ${today}</h2><p>Sessions: ${total_sessions} | Requeues: ${total_requeues}</p><table>${agentRows}</table>` });
    res.json({ success: true, message: 'Report sent' });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed' }); }
});

export default app;
