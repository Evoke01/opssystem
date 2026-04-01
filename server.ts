import express from 'express';
import path from 'path';
import multer from 'multer';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import cron from 'node-cron';
import fs from 'fs';
import xlsx from 'xlsx';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://localhost:4173,http://localhost:5173')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = typeof req.headers.origin === 'string'
    ? req.headers.origin.replace(/\/$/, '')
    : '';

  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});
app.use(express.json());

const upload = multer({ dest: '/tmp' });

// Database setup
let supabase: any;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Database features will not work until configured.');
}

async function setupDb() {
  // Kept for backwards compatibility if called elsewhere
}

// API Routes

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rowCount = 0;

    if (ext === '.csv') {
      fs.createReadStream(req.file.path)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', () => {
          rowCount++;
        })
        .on('end', () => {
          if (req.file) fs.unlinkSync(req.file.path);
          res.json({ total_sessions: rowCount });
        })
        .on('error', (err) => {
          if (req.file) fs.unlinkSync(req.file.path);
          res.status(500).json({ error: 'Failed to parse CSV file' });
        });
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      rowCount = data.length;
      
      if (req.file) fs.unlinkSync(req.file.path);
      res.json({ total_sessions: rowCount });
    } else {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Unsupported file type. Please upload CSV or Excel.' });
    }
  } catch (error) {
    console.error('File processing error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

app.post('/api/submit', async (req, res) => {
  const { user_id, date, total_sessions, id_retake, tech_issue, system_issue } = req.body;

  if (!user_id || !date || total_sessions === undefined || id_retake === undefined || tech_issue === undefined || system_issue === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const total_requeue = id_retake + tech_issue + system_issue;
  if (total_requeue > total_sessions) {
    return res.status(400).json({ error: 'Total requeues cannot exceed total sessions' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { error } = await supabase
      .from('daily_reports')
      .insert([
        { 
          user_id, 
          date, 
          total_sessions, 
          id_retake, 
          tech_issue, 
          system_issue 
        }
      ]);

    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.get('/api/admin/summary', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    const { data: reports, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('date', date);

    if (error) throw error;

    let total_sessions = 0;
    let total_id_retake = 0;
    let total_tech_issue = 0;
    let total_system_issue = 0;

    const agents = reports.map((report: any) => {
      total_sessions += report.total_sessions;
      total_id_retake += report.id_retake;
      total_tech_issue += report.tech_issue;
      total_system_issue += report.system_issue;

      const agentTotalRequeue = report.id_retake + report.tech_issue + report.system_issue;
      const agentRequeuePercent = report.total_sessions > 0 
        ? (agentTotalRequeue / report.total_sessions) * 100 
        : 0;

      return {
        user_id: report.user_id,
        total_sessions: report.total_sessions,
        id_retake: report.id_retake,
        tech_issue: report.tech_issue,
        system_issue: report.system_issue,
        requeue_percent: agentRequeuePercent
      };
    });

    const total_requeue = total_id_retake + total_tech_issue + total_system_issue;
    const requeue_percent = total_sessions > 0 ? (total_requeue / total_sessions) * 100 : 0;

    let top_issue = 'None';
    const issues = [
      { name: 'ID Retake', count: total_id_retake },
      { name: 'Tech Issue', count: total_tech_issue },
      { name: 'System Issue', count: total_system_issue }
    ];
    issues.sort((a, b) => b.count - a.count);
    if (issues[0].count > 0) {
      top_issue = issues[0].name;
    }

    // Sort agents by requeue percent descending
    agents.sort((a: any, b: any) => b.requeue_percent - a.requeue_percent);

    res.json({
      totals: {
        total_sessions,
        total_requeue,
        requeue_percent,
        top_issue
      },
      agents
    });
  } catch (error: any) {
    console.error('Summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch summary' });
  }
});

app.all('/api/report', async (req, res) => {
  try {
    await generateAndSendReport();
    res.json({ success: true, message: 'Report generated and sent' });
  } catch (error: any) {
    console.error('Report error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

async function generateAndSendReport() {
  if (!supabase) {
    console.log('Database not configured. Skipping report generation.');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  const { data: reports, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('date', today);

  if (error) {
    console.error('Failed to fetch reports:', error);
    throw new Error('Failed to fetch reports from database');
  }

  if (!reports || reports.length === 0) {
    console.log('No reports submitted today. Skipping email.');
    return;
  }

  let total_sessions = 0;
  let total_id_retake = 0;
  let total_tech_issue = 0;
  let total_system_issue = 0;

  let agentBreakdown = '';

  for (const report of reports) {
    total_sessions += report.total_sessions;
    total_id_retake += report.id_retake;
    total_tech_issue += report.tech_issue;
    total_system_issue += report.system_issue;

    const agentTotalRequeue = report.id_retake + report.tech_issue + report.system_issue;
    const agentRequeuePercent = report.total_sessions > 0 
      ? ((agentTotalRequeue / report.total_sessions) * 100).toFixed(2) 
      : '0.00';

    agentBreakdown += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${report.user_id}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${report.total_sessions}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${report.id_retake}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${report.tech_issue}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${report.system_issue}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${agentRequeuePercent}%</td>
      </tr>
    `;
  }

  const total_requeues = total_id_retake + total_tech_issue + total_system_issue;
  const requeue_percent = total_sessions > 0 
    ? ((total_requeues / total_sessions) * 100).toFixed(2) 
    : '0.00';

  const htmlContent = `
    <h2>Daily Ops Report - ${today}</h2>
    <h3>Aggregate Summary</h3>
    <ul>
      <li><strong>Total Sessions:</strong> ${total_sessions}</li>
      <li><strong>Total Requeues:</strong> ${total_requeues}</li>
      <li><strong>Requeue %:</strong> ${requeue_percent}%</li>
    </ul>
    <h4>Requeue Breakdown</h4>
    <ul>
      <li><strong>ID Retake:</strong> ${total_id_retake}</li>
      <li><strong>Technical Transfer:</strong> ${total_tech_issue}</li>
      <li><strong>System Issue:</strong> ${total_system_issue}</li>
    </ul>
    
    <h3>Agent Breakdown</h3>
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Agent ID</th>
          <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Sessions</th>
          <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">ID Retake</th>
          <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Tech Issue</th>
          <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">System Issue</th>
          <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Requeue %</th>
        </tr>
      </thead>
      <tbody>
        ${agentBreakdown}
      </tbody>
    </table>
  `;

  const resendApiKey = process.env.RESEND_API_KEY;
  const teamLeadEmail = process.env.TEAM_LEAD_EMAIL;

  if (!resendApiKey || !teamLeadEmail) {
    console.log('Email not sent. Missing RESEND_API_KEY or TEAM_LEAD_EMAIL.');
    console.log('Report Content:', htmlContent);
    throw new Error('Missing RESEND_API_KEY or TEAM_LEAD_EMAIL environment variables. Please configure them on the backend host.');
  }

  const resend = new Resend(resendApiKey);
  try {
    await resend.emails.send({
      from: 'Ops System <onboarding@resend.dev>',
      to: teamLeadEmail,
      subject: `Daily Ops Report - ${today}`,
      html: htmlContent
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send email via Resend API');
  }
}

// Schedule daily report at 18:00 (6 PM)
if (!process.env.VERCEL) {
  cron.schedule('0 18 * * *', async () => {
    console.log('Running daily report cron job');
    try {
      await generateAndSendReport();
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  });
}

async function startServer() {
  await setupDb();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
