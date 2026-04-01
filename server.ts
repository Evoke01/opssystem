import express from 'express';
import path from 'path';
import cron from 'node-cron';

import app from './api/[...path]';

const PORT = Number(process.env.PORT || 3000);
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production';

async function triggerDailyReport() {
  const response = await fetch(`http://127.0.0.1:${PORT}/api/cron/reminders`, {
    method: 'GET',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Report trigger failed: ${response.status} ${body}`);
  }
}

if (!isVercel) {
  cron.schedule('*/15 * * * *', () => {
    console.log('Running reminder cron job');
    void triggerDailyReport().catch((error) => {
      console.error('Cron job failed:', error);
    });
  });
}

async function startServer() {
  if (!isProduction && !isVercel) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }

      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!isVercel) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

void startServer();

export default app;
