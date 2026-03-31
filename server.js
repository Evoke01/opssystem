import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 🔑 Replace with your keys
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_KEY as string
);

// =====================
// Upload & Count Sessions
// =====================
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const total_sessions = data.length;

    return res.json({ total_sessions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================
// Submit Daily Report
// =====================
app.post("/api/submit", async (req, res) => {
  try {
    const {
      user_id,
      date,
      total_sessions,
      id_retake,
      tech_issue,
      system_issue
    } = req.body;

    if (
      id_retake + tech_issue + system_issue >
      total_sessions
    ) {
      return res.status(400).json({
        error: "Requeue cannot exceed total sessions"
      });
    }

    const { error } = await supabase.from("daily_reports").insert([
      {
        user_id,
        date,
        total_sessions,
        id_retake,
        tech_issue,
        system_issue
      }
    ]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================
// Admin Summary (FIXED)
// =====================
app.get("/api/admin/summary", async (req, res) => {
  try {
    const { date } = req.query;

    const { data: reports, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("date", date);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // ✅ Empty case
    if (!reports || reports.length === 0) {
      return res.json({
        totals: {
          total_sessions: 0,
          total_requeue: 0,
          requeue_percent: 0,
          top_issue: "None"
        },
        agents: []
      });
    }

    let total_sessions = 0;
    let total_id_retake = 0;
    let total_tech_issue = 0;
    let total_system_issue = 0;

    // ✅ Totals
    reports.forEach((report: any) => {
      total_sessions += report.total_sessions || 0;
      total_id_retake += report.id_retake || 0;
      total_tech_issue += report.tech_issue || 0;
      total_system_issue += report.system_issue || 0;
    });

    const total_requeue =
      total_id_retake + total_tech_issue + total_system_issue;

    const requeue_percent =
      total_sessions > 0
        ? (total_requeue / total_sessions) * 100
        : 0;

    // ✅ Agent breakdown
    const agents = reports.map((report: any) => {
      const agentTotalRequeue =
        (report.id_retake || 0) +
        (report.tech_issue || 0) +
        (report.system_issue || 0);

      const agentRequeuePercent =
        report.total_sessions > 0
          ? (agentTotalRequeue / report.total_sessions) * 100
          : 0;

      return {
        user_id: report.user_id,
        total_sessions: report.total_sessions || 0,
        id_retake: report.id_retake || 0,
        tech_issue: report.tech_issue || 0,
        system_issue: report.system_issue || 0,
        requeue_percent: agentRequeuePercent
      };
    });

    // ✅ Top issue
    const issueMap = {
      ID: total_id_retake,
      TECH: total_tech_issue,
      SYSTEM: total_system_issue
    };

    const top_issue = Object.entries(issueMap).sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    return res.json({
      totals: {
        total_sessions,
        total_requeue,
        requeue_percent,
        top_issue
      },
      agents
    });

  } catch (err: any) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default app;
