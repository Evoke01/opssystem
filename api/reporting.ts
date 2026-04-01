export const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

export type ScheduleUser = {
  id: number;
  name: string;
  email?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  week_offs?: string[] | null;
  timezone?: string | null;
  role?: string;
  team_id?: number | null;
  created_at?: string | null;
};

export type ReportRow = {
  id: number;
  user_id: number;
  date: string;
  total_sessions: number;
  id_retake: number;
  tech_issue: number;
  system_issue: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LeaveRow = {
  id: number;
  user_id: number;
  date: string;
  reason?: string | null;
  created_at?: string | null;
};

type SummaryInput = {
  totalSessions: number;
  totalRequeue: number;
  workingDays: number;
  submittedDays: number;
  leaveDays: number;
};

function getPart(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function safeTimeZone(timeZone?: string | null) {
  const fallback = 'Asia/Kolkata';

  if (!timeZone) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return fallback;
  }
}

export function normalizeWeekOffs(value: unknown) {
  if (!Array.isArray(value)) {
    return ['saturday', 'sunday'];
  }

  const normalized = value
    .map((entry) => String(entry).trim().toLowerCase())
    .filter((entry): entry is WeekdayName => WEEKDAY_NAMES.includes(entry as WeekdayName));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['saturday', 'sunday'];
}

export function safeTime(value: unknown, fallback: string) {
  const text = String(value ?? '').trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    return text.slice(0, 5);
  }

  return fallback;
}

export function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidMonthString(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;

  return { start, end };
}

export function dateKeyWeekday(dateKey: string): WeekdayName {
  return WEEKDAY_NAMES[parseDateKey(dateKey).getUTCDay()];
}

export function eachDate(start: string, endExclusive: string) {
  const dates: string[] = [];
  let cursor = start;

  while (cursor < endExclusive) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function zonedNowInfo(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(now);

  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const hour = getPart(parts, 'hour');
  const minute = getPart(parts, 'minute');
  const weekday = getPart(parts, 'weekday').toLowerCase() as WeekdayName;

  return {
    dateKey: `${year}-${month}-${day}`,
    weekday,
    time: `${hour}:${minute}`,
    minutes: Number(hour) * 60 + Number(minute),
  };
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function reportTotals(report: Partial<ReportRow> | null | undefined) {
  const totalSessions = Number(report?.total_sessions ?? 0);
  const idRetake = Number(report?.id_retake ?? 0);
  const techIssue = Number(report?.tech_issue ?? 0);
  const systemIssue = Number(report?.system_issue ?? 0);
  const totalRequeue = idRetake + techIssue + systemIssue;

  return {
    totalSessions,
    idRetake,
    techIssue,
    systemIssue,
    totalRequeue,
    requeuePercent: totalSessions > 0 ? (totalRequeue / totalSessions) * 100 : null,
  };
}

export function summarizeReports(reports: ReportRow[]) {
  return reports.reduce(
    (totals, report) => {
      totals.totalSessions += Number(report.total_sessions ?? 0);
      totals.idRetake += Number(report.id_retake ?? 0);
      totals.techIssue += Number(report.tech_issue ?? 0);
      totals.systemIssue += Number(report.system_issue ?? 0);
      return totals;
    },
    { totalSessions: 0, idRetake: 0, techIssue: 0, systemIssue: 0 },
  );
}

export function isWorkingDay(dateKey: string, user: ScheduleUser, leaveDates: Set<string>) {
  const weekOffs = new Set(normalizeWeekOffs(user.week_offs));
  const weekday = dateKeyWeekday(dateKey);

  return !weekOffs.has(weekday) && !leaveDates.has(dateKey);
}

export function countWorkingDays(start: string, endExclusive: string, user: ScheduleUser, leaveDates: Set<string>) {
  let workingDays = 0;
  let leaveDays = 0;
  let weekOffDays = 0;

  for (const dateKey of eachDate(start, endExclusive)) {
    const weekday = dateKeyWeekday(dateKey);
    const isLeaveDay = leaveDates.has(dateKey);
    const isWeekOff = normalizeWeekOffs(user.week_offs).includes(weekday);

    if (isLeaveDay) {
      leaveDays += 1;
    }

    if (isWeekOff) {
      weekOffDays += 1;
    }

    if (!isLeaveDay && !isWeekOff) {
      workingDays += 1;
    }
  }

  return { workingDays, leaveDays, weekOffDays };
}

export function buildSummary(input: SummaryInput) {
  return {
    working_days: input.workingDays,
    submitted_days: input.submittedDays,
    leave_days: input.leaveDays,
    total_sessions: input.totalSessions,
    total_requeue: input.totalRequeue,
    requeue_percent: input.totalSessions > 0 ? (input.totalRequeue / input.totalSessions) * 100 : null,
    session_avg: input.workingDays > 0 ? input.totalSessions / input.workingDays : null,
  };
}

export function normalizeCodes(codes: unknown) {
  if (!Array.isArray(codes)) {
    return [];
  }

  const unique = new Set<string>();

  for (const code of codes) {
    const value = String(code ?? '').trim();
    if (value) {
      unique.add(value);
    }
  }

  return Array.from(unique);
}
