import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

import {
  buildSummary,
  countWorkingDays,
  isValidDateString,
  isValidMonthString,
  isWorkingDay,
  monthRange,
  normalizeCodes,
  normalizeWeekOffs,
  reportTotals,
  safeTime,
  safeTimeZone,
  ScheduleUser,
  summarizeReports
} from './reporting';

const app = express();
const upload = multer({ dest: '/tmp' });

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://localhost:4173,http://localhost:5173,https://opssystem.pages.dev')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use((req: any, res: any, next: any) => {
  const origin = typeof req.headers.origin === 'string'
    ? req.headers.origin.replace(/\/$/, '')
    : '';

  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

app.use(express.json({ limit: '5mb' }));

function getQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

function defaultUser(user: any): ScheduleUser {
  return {
    ...user,
    id: Number(user.id),
    email: user.email ?? null,
    shift_start: safeTime(user.shift_start, '09:00'),
    shift_end: safeTime(user.shift_end, '18:00'),
    week_offs: normalizeWeekOffs(user.week_offs),
    timezone: safeTimeZone(user.timezone),
  };
}

function serializeReport(report: any) {
  const totals = reportTotals(report);

  return {
    id: Number(report.id),
    user_id: Number(report.user_id),
    date: String(report.date),
    total_sessions: totals.totalSessions,
    id_retake: totals.idRetake,
    tech_issue: totals.techIssue,
    system_issue: totals.systemIssue,
    total_requeue: totals.totalRequeue,
    requeue_percent: totals.requeuePercent,
    created_at: report.created_at ?? null,
    updated_at: report.updated_at ?? null,
  };
}

function emptyReport(userId: number, date: string) {
  return {
    id: null,
    user_id: userId,
    date,
    total_sessions: 0,
    id_retake: 0,
    tech_issue: 0,
    system_issue: 0,
    total_requeue: 0,
    requeue_percent: null,
    created_at: null,
    updated_at: null,
  };
}

function jsonError(res: any, status: number, error: string) {
  return res.status(status).json({ error });
}

async function fetchUserById(userId: number) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
  if (error || !data) {
    return null;
  }

  return defaultUser(data);
}

async function resolveUserFromQuery(req: any) {
  const userIdValue = getQueryString(req.query.user_id);
  if (userIdValue) {
    return fetchUserById(Number(userIdValue));
  }

  const userName = getQueryString(req.query.user_name);
  if (!userName || !supabase) {
    return null;
  }

  const { data, error } = await supabase.from('users').select('*').eq('name', userName).single();
  if (error || !data) {
    return null;
  }

  return defaultUser(data);
}

async function fetchAgentUsers() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from('users').select('*').eq('role', 'agent').order('name');
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map(defaultUser);
}

async function fetchReportByUserDate(userId: number, date: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function fetchCodesForReport(reportId: number) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('access_codes')
    .select('id, code, created_at')
    .eq('report_id', reportId)
    .order('id');

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data;
}

async function fetchLeavesByUserAndRange(userId: number, start: string, endExclusive: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('leave_dates')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date');

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data;
}

async function fetchReportsByUserAndRange(userId: number, start: string, endExclusive: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date', { ascending: false });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map(serializeReport);
}

async function buildUserReportsPayload(user: ScheduleUser, month: string) {
  const { start, end } = monthRange(month);
  const [reports, leaves] = await Promise.all([
    fetchReportsByUserAndRange(user.id, start, end),
    fetchLeavesByUserAndRange(user.id, start, end),
  ]);

  const leaveDates = new Set(leaves.map((leave: any) => String(leave.date)));
  const { workingDays, leaveDays } = countWorkingDays(start, end, user, leaveDates);
  const totals = summarizeReports(reports as any);
  const totalRequeue = totals.idRetake + totals.techIssue + totals.systemIssue;

  return {
    reports,
    summary: buildSummary({
      totalSessions: totals.totalSessions,
      totalRequeue,
      workingDays,
      submittedDays: reports.length,
      leaveDays,
    }),
    leaves,
  };
}

async function buildDayReport(userId: number, date: string) {
  const report = await fetchReportByUserDate(userId, date);
  if (!report) {
    return {
      exists: false,
      report: emptyReport(userId, date),
      codes_count: 0,
    };
  }

  const codes = await fetchCodesForReport(Number(report.id));
  return {
    exists: true,
    report: serializeReport(report),
    codes_count: codes.length,
  };
}

async function buildDailySummaryForDate(date: string) {
  const users = await fetchAgentUsers();
  const reportResponse = await supabase!
    .from('daily_reports')
    .select('*')
    .eq('date', date);
  const leaveResponse = await supabase!
    .from('leave_dates')
    .select('*')
    .eq('date', date);

  const reports = Array.isArray(reportResponse.data) ? reportResponse.data : [];
  const leaves = Array.isArray(leaveResponse.data) ? leaveResponse.data : [];
  const reportMap = new Map<number, any>(reports.map((report: any) => [Number(report.user_id), report]));
  const leaveMap = new Map<number, Set<string>>();

  for (const leave of leaves) {
    const userId = Number(leave.user_id);
    const dates = leaveMap.get(userId) ?? new Set<string>();
    dates.add(String(leave.date));
    leaveMap.set(userId, dates);
  }

  let totalSessions = 0;
  let totalIdRetake = 0;
  let totalTechIssue = 0;
  let totalSystemIssue = 0;
  let workingAgentCount = 0;
  let submittedAgentCount = 0;

  const agents = users.map((user) => {
    const leaveDates = leaveMap.get(user.id) ?? new Set<string>();
    const workingDay = isWorkingDay(date, user, leaveDates);
    const report = reportMap.get(user.id);
    const totals = reportTotals(report);
    const submitted = Boolean(report);

    if (workingDay) {
      workingAgentCount += 1;
    }

    if (submitted) {
      submittedAgentCount += 1;
      totalSessions += totals.totalSessions;
      totalIdRetake += totals.idRetake;
      totalTechIssue += totals.techIssue;
      totalSystemIssue += totals.systemIssue;
    }

    return {
      user_id: user.id,
      user_name: user.name,
      email: user.email ?? null,
      submitted,
      working_day: workingDay ? 1 : 0,
      on_leave: leaveDates.has(date),
      is_week_off: !workingDay && !leaveDates.has(date),
      status: !workingDay ? (leaveDates.has(date) ? 'Leave' : 'Week Off') : (submitted ? 'Submitted' : 'Pending'),
      total_sessions: totals.totalSessions,
      id_retake: totals.idRetake,
      tech_issue: totals.techIssue,
      system_issue: totals.systemIssue,
      total_requeue: totals.totalRequeue,
      requeue_percent: totals.requeuePercent,
      session_avg: workingDay ? totals.totalSessions : null,
      report_id: report?.id ?? null,
    };
  });

  const totalRequeue = totalIdRetake + totalTechIssue + totalSystemIssue;
  const issues = [
    { name: 'ID Retake', count: totalIdRetake },
    { name: 'Tech Issue', count: totalTechIssue },
    { name: 'System Issue', count: totalSystemIssue },
  ].sort((left, right) => right.count - left.count);

  return {
    date,
    totals: {
      total_sessions: totalSessions,
      total_requeue: totalRequeue,
      requeue_percent: totalSessions > 0 ? (totalRequeue / totalSessions) * 100 : null,
      top_issue: issues[0]?.count ? issues[0].name : 'None',
      session_avg: workingAgentCount > 0 ? totalSessions / workingAgentCount : null,
      agent_count: users.length,
      working_agent_count: workingAgentCount,
      submitted_agent_count: submittedAgentCount,
    },
    agents: agents.sort((left, right) => (right.requeue_percent ?? -1) - (left.requeue_percent ?? -1)),
  };
}

app.get('/api/health', (_req: any, res: any) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV || 'production' });
});

app.post('/api/login', async (req: any, res: any) => {
  const userId = Number(req.body?.user_id);
  const password = String(req.body?.password ?? '');

  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const user = await fetchUserById(userId);
  if (!user) {
    return jsonError(res, 401, 'User not found');
  }

  if ((user as any).password !== password) {
    return jsonError(res, 401, 'Invalid password');
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      team_id: user.team_id ?? null,
      role: user.role,
      email: user.email ?? null,
      shift_start: user.shift_start,
      shift_end: user.shift_end,
      week_offs: user.week_offs,
      timezone: user.timezone,
    },
  });
});

app.post('/api/admin/login', (req: any, res: any) => {
  const password = String(req.body?.password ?? '');
  if (password !== (process.env.ADMIN_PASSWORD || 'tl@2024')) {
    return jsonError(res, 401, 'Invalid password');
  }

  return res.json({ success: true });
});

app.get('/api/teams', async (_req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) {
    return jsonError(res, 500, error.message);
  }

  return res.json(Array.isArray(data) ? data : []);
});

app.get('/api/teams/:teamId/members', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('team_id', Number(req.params.teamId))
    .eq('role', 'agent')
    .order('name');

  if (error) {
    return jsonError(res, 500, error.message);
  }

  return res.json(Array.isArray(data) ? data : []);
});

app.post('/api/upload', upload.single('file'), (req: any, res: any) => {
  if (!req.file) {
    return jsonError(res, 400, 'No file uploaded');
  }

  try {
    const extension = path.extname(req.file.originalname).toLowerCase();

    if (extension === '.csv') {
      const codes: string[] = [];

      fs.createReadStream(req.file.path)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', (row: any) => {
          const value = Object.values(row)[0] as string;
          if (value) {
            codes.push(String(value).trim());
          }
        })
        .on('end', () => {
          fs.unlinkSync(req.file.path);
          const normalized = normalizeCodes(codes);
          res.json({ total_sessions: normalized.length, codes: normalized });
        })
        .on('error', () => {
          fs.unlinkSync(req.file.path);
          jsonError(res, 500, 'Failed to parse CSV');
        });
      return;
    }

    if (extension === '.xlsx' || extension === '.xls') {
      const workbook = xlsx.readFile(req.file.path);
      const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const codes = normalizeCodes(rows.map((row: any) => Object.values(row)[0]));
      fs.unlinkSync(req.file.path);
      return res.json({ total_sessions: codes.length, codes });
    }

    fs.unlinkSync(req.file.path);
    return jsonError(res, 400, 'Unsupported file type');
  } catch {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return jsonError(res, 500, 'Failed to process file');
  }
});

app.get('/api/agent/day-report', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const userId = Number(getQueryString(req.query.user_id));
  const date = getQueryString(req.query.date);

  if (!userId || !isValidDateString(date)) {
    return jsonError(res, 400, 'user_id and date are required');
  }

  return res.json(await buildDayReport(userId, date));
});

app.post('/api/submit', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const userId = Number(req.body?.user_id);
  const date = String(req.body?.date ?? '').trim();
  const batchIdRetake = Number(req.body?.id_retake ?? 0);
  const batchTechIssue = Number(req.body?.tech_issue ?? 0);
  const batchSystemIssue = Number(req.body?.system_issue ?? 0);
  const inputCodes = normalizeCodes(req.body?.codes);
  const requestedSessions = Number(req.body?.total_sessions ?? inputCodes.length);

  if (!userId || !isValidDateString(date)) {
    return jsonError(res, 400, 'Missing required fields');
  }

  const user = await fetchUserById(userId);
  if (!user) {
    return jsonError(res, 404, 'User not found');
  }

  const localToday =(new Date(), user.timezone ?? 'Asia/Kolkata').dateKey;
  if (date > localToday) {
    return jsonError(res, 400, 'Future dates are not allowed');
  }

  const report = await fetchReportByUserDate(userId, date);
  const existingCodes = report ? await fetchCodesForReport(Number(report.id)) : [];
  const existingCodeSet = new Set(existingCodes.map((entry: any) => String(entry.code).trim()));
  const acceptedCodes = inputCodes.filter((code) => !existingCodeSet.has(code));
  const duplicateCodesIgnored = inputCodes.length - acceptedCodes.length;
  const acceptedSessions = inputCodes.length > 0 ? acceptedCodes.length : requestedSessions;
  const batchTotalRequeue = batchIdRetake + batchTechIssue + batchSystemIssue;

  if (acceptedSessions <= 0) {
    return jsonError(res, 400, 'No new sessions were found for this date');
  }

  if (batchTotalRequeue > acceptedSessions) {
    return jsonError(res, 400, 'Batch requeues cannot exceed the accepted sessions in this upload');
  }

  let updatedReport: any = null;

  if (!report) {
    const { data, error } = await supabase
      .from('daily_reports')
      .insert([{
        user_id: userId,
        date,
        total_sessions: acceptedSessions,
        id_retake: batchIdRetake,
        tech_issue: batchTechIssue,
        system_issue: batchSystemIssue,
        updated_at: new Date().toISOString(),
      }])
      .select('*')
      .single();

    if (error || !data) {
      return jsonError(res, 500, error?.message || 'Failed to save data');
    }

    updatedReport = data;
  } else {
    const { data, error } = await supabase
      .from('daily_reports')
      .update({
        total_sessions: Number(report.total_sessions ?? 0) + acceptedSessions,
        id_retake: Number(report.id_retake ?? 0) + batchIdRetake,
        tech_issue: Number(report.tech_issue ?? 0) + batchTechIssue,
        system_issue: Number(report.system_issue ?? 0) + batchSystemIssue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', Number(report.id))
      .select('*')
      .single();

    if (error || !data) {
      return jsonError(res, 500, error?.message || 'Failed to update data');
    }

    updatedReport = data;
  }

  if (acceptedCodes.length > 0) {
    const codeRows = acceptedCodes.map((code) => ({ report_id: Number(updatedReport.id), code }));
    const { error } = await supabase.from('access_codes').insert(codeRows);
    if (error) {
      return jsonError(res, 500, error.message);
    }
  }

  return res.json({
    success: true,
    report: serializeReport(updatedReport),
    accepted_sessions: acceptedSessions,
    duplicate_codes_ignored: duplicateCodesIgnored,
    codes_count: existingCodes.length + acceptedCodes.length,
  });
});

app.get('/api/report-codes', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const reportId = Number(getQueryString(req.query.report_id));
  if (!reportId) {
    return jsonError(res, 400, 'report_id required');
  }

  return res.json(await fetchCodesForReport(reportId));
});

app.get('/api/agent/reports', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const user = await resolveUserFromQuery(req);
  const month = getQueryString(req.query.month) || new Date().toISOString().slice(0, 7);

  if (!user) {
    return jsonError(res, 400, 'user_id required');
  }

  if (!isValidMonthString(month)) {
    return jsonError(res, 400, 'month must be YYYY-MM');
  }

  return res.json(await buildUserReportsPayload(user, month));
});

app.get('/api/admin/summary', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const requestedDate = getQueryString(req.query.date) || new Date().toISOString().slice(0, 10);
  if (!isValidDateString(requestedDate)) {
    return jsonError(res, 400, 'date must be YYYY-MM-DD');
  }

  return res.json(await buildDailySummaryForDate(requestedDate));
});

app.get('/api/admin/monthly', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const month = getQueryString(req.query.month) || new Date().toISOString().slice(0, 7);
  if (!isValidMonthString(month)) {
    return jsonError(res, 400, 'month must be YYYY-MM');
  }

  const { start, end } = monthRange(month);
  const [users, reportsResponse, leavesResponse] = await Promise.all([
    fetchAgentUsers(),
    supabase.from('daily_reports').select('*').gte('date', start).lt('date', end),
    supabase.from('leave_dates').select('*').gte('date', start).lt('date', end),
  ]);

  const reports = Array.isArray(reportsResponse.data) ? reportsResponse.data : [];
  const leaves = Array.isArray(leavesResponse.data) ? leavesResponse.data : [];
  const reportsByUser = new Map<number, any[]>();
  const leavesByUser = new Map<number, any[]>();

  for (const report of reports) {
    const userId = Number(report.user_id);
    const entries = reportsByUser.get(userId) ?? [];
    entries.push(report);
    reportsByUser.set(userId, entries);
  }

  for (const leave of leaves) {
    const userId = Number(leave.user_id);
    const entries = leavesByUser.get(userId) ?? [];
    entries.push(leave);
    leavesByUser.set(userId, entries);
  }

  let teamSessions = 0;
  let teamRequeue = 0;
  let teamWorkingDays = 0;
  let teamSubmittedDays = 0;

  const agents = users.map((user) => {
    const userReports = (reportsByUser.get(user.id) ?? []).map(serializeReport);
    const userLeaves = leavesByUser.get(user.id) ?? [];
    const leaveDates = new Set(userLeaves.map((leave: any) => String(leave.date)));
    const { workingDays, leaveDays, weekOffDays } = countWorkingDays(start, end, user, leaveDates);
    const totals = summarizeReports(userReports as any);
    const totalRequeue = totals.idRetake + totals.techIssue + totals.systemIssue;

    teamSessions += totals.totalSessions;
    teamRequeue += totalRequeue;
    teamWorkingDays += workingDays;
    teamSubmittedDays += userReports.length;

    return {
      user_id: user.id,
      user_name: user.name,
      email: user.email ?? null,
      timezone: user.timezone,
      shift_start: user.shift_start,
      shift_end: user.shift_end,
      week_offs: user.week_offs,
      working_days: workingDays,
      submitted_days: userReports.length,
      leave_days: leaveDays,
      week_off_days: weekOffDays,
      total_sessions: totals.totalSessions,
      id_retake: totals.idRetake,
      tech_issue: totals.techIssue,
      system_issue: totals.systemIssue,
      total_requeue: totalRequeue,
      requeue_percent: totals.totalSessions > 0 ? (totalRequeue / totals.totalSessions) * 100 : null,
      session_avg: workingDays > 0 ? totals.totalSessions / workingDays : null,
    };
  }).sort((left, right) => (right.requeue_percent ?? -1) - (left.requeue_percent ?? -1));

  return res.json({
    month,
    summary: {
      total_sessions: teamSessions,
      total_requeue: teamRequeue,
      requeue_percent: teamSessions > 0 ? (teamRequeue / teamSessions) * 100 : null,
      working_days: teamWorkingDays,
      submitted_days: teamSubmittedDays,
      session_avg: teamWorkingDays > 0 ? teamSessions / teamWorkingDays : null,
      agent_count: users.length,
    },
    agents,
  });
});

app.get('/api/admin/agents', async (_req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  return res.json(await fetchAgentUsers());
});

app.get('/api/admin/user-reports', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const user = await resolveUserFromQuery(req);
  const month = getQueryString(req.query.month) || new Date().toISOString().slice(0, 7);

  if (!user) {
    return jsonError(res, 400, 'user_id required');
  }

  if (!isValidMonthString(month)) {
    return jsonError(res, 400, 'month must be YYYY-MM');
  }

  return res.json(await buildUserReportsPayload(user, month));
});

app.get('/api/admin/leaves', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const userId = Number(getQueryString(req.query.user_id));
  const month = getQueryString(req.query.month) || new Date().toISOString().slice(0, 7);

  if (!userId || !isValidMonthString(month)) {
    return jsonError(res, 400, 'user_id and month are required');
  }

  const { start, end } = monthRange(month);
  return res.json(await fetchLeavesByUserAndRange(userId, start, end));
});

app.post('/api/admin/leaves', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const userId = Number(req.body?.user_id);
  const date = String(req.body?.date ?? '').trim();
  const reason = String(req.body?.reason ?? '').trim() || null;

  if (!userId || !isValidDateString(date)) {
    return jsonError(res, 400, 'user_id and valid date are required');
  }

  const { data, error } = await supabase
    .from('leave_dates')
    .insert([{ user_id: userId, date, reason }])
    .select('*')
    .single();

  if (error || !data) {
    return jsonError(res, 500, error?.message || 'Failed to create leave');
  }

  return res.json({ success: true, leave: data });
});

app.delete('/api/admin/leaves/:id', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const leaveId = Number(req.params.id);
  if (!leaveId) {
    return jsonError(res, 400, 'leave id required');
  }

  const { error } = await supabase.from('leave_dates').delete().eq('id', leaveId);
  if (error) {
    return jsonError(res, 500, error.message);
  }

  return res.json({ success: true });
});

app.patch('/api/admin/users/:id', async (req: any, res: any) => {
  if (!supabase) {
    return jsonError(res, 500, 'Database not configured');
  }

  const userId = Number(req.params.id);
  if (!userId) {
    return jsonError(res, 400, 'user id required');
  }

  const email = String(req.body?.email ?? '').trim() || null;
  const shiftStart = safeTime(req.body?.shift_start, '09:00');
  const shiftEnd = safeTime(req.body?.shift_end, '18:00');
  const timezone = safeTimeZone(String(req.body?.timezone ?? 'Asia/Kolkata').trim());
  const weekOffs = normalizeWeekOffs(req.body?.week_offs);

  const { data, error } = await supabase
    .from('users')
    .update({
      email,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      timezone,
      week_offs: weekOffs,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) {
    return jsonError(res, 500, error?.message || 'Failed to update user');
  }

  return res.json({ success: true, user: defaultUser(data) });
});

});

app.all('/api/report', async (req: any, res: any) => {
  try {
    if (!supabase) {
      console.error('Database not configured. Daily report skipped.');
      return jsonError(res, 500, 'Database not configured');
    }

    const date = getQueryString(req.query.date) || new Date().toISOString().slice(0, 10);
    if (!isValidDateString(date)) {
      return jsonError(res, 400, 'date must be YYYY-MM-DD');
    }

    const summary = await buildDailySummaryForDate(date);
    if (!summary.agents.some((agent) => agent.submitted)) {
      return res.json({ success: true, message: 'No reports submitted for this date' });
    }

    if (!process.env.TEAM_LEAD_EMAIL) {
      console.log(`TEAM_LEAD_EMAIL not configured. Daily summary generated for ${date}.`);
      return res.json({ success: true, message: 'Summary generated without email delivery', summary });
    }

    if (!resend) {
      console.log(`Resend not configured. Daily summary generated for ${date}.`);
      return res.json({ success: true, message: 'Summary generated without email delivery', summary });
    }

    const rows = summary.agents
      .filter((agent) => agent.submitted)
      .map((agent) => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px">${agent.user_name}</td>
          <td style="border:1px solid #ddd;padding:8px">${agent.total_sessions}</td>
          <td style="border:1px solid #ddd;padding:8px">${agent.id_retake}</td>
          <td style="border:1px solid #ddd;padding:8px">${agent.tech_issue}</td>
          <td style="border:1px solid #ddd;padding:8px">${agent.system_issue}</td>
          <td style="border:1px solid #ddd;padding:8px">${agent.requeue_percent === null ? '-' : `${agent.requeue_percent.toFixed(2)}%`}</td>
        </tr>
      `)
      .join('');

    await resend.emails.send({
      from: 'Ops System <onboarding@resend.dev>',
      to: process.env.TEAM_LEAD_EMAIL,
      subject: `Daily Ops Summary - ${date}`,
      html: `
        <h2>Daily Ops Summary - ${date}</h2>
        <p>
          <b>Sessions:</b> ${summary.totals.total_sessions}
          | <b>Working Agents:</b> ${summary.totals.working_agent_count}
          | <b>Submitted:</b> ${summary.totals.submitted_agent_count}
          | <b>Session Avg:</b> ${summary.totals.session_avg === null ? '-' : summary.totals.session_avg.toFixed(1)}
          | <b>Requeues:</b> ${summary.totals.total_requeue}
        </p>
        <table style="border-collapse:collapse;width:100%">
          <thead>
            <tr style="background:#f2f2f2">
              <th style="border:1px solid #ddd;padding:8px">Agent</th>
              <th style="border:1px solid #ddd;padding:8px">Sessions</th>
              <th style="border:1px solid #ddd;padding:8px">ID Retake</th>
              <th style="border:1px solid #ddd;padding:8px">Tech Transfer</th>
              <th style="border:1px solid #ddd;padding:8px">System Issue</th>
              <th style="border:1px solid #ddd;padding:8px">Requeue %</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `,
    });

    return res.json({ success: true, message: 'Report sent', summary });
  } catch (error: any) {
    return jsonError(res, 500, error?.message || 'Failed to send report');
  }
});

export default app;
