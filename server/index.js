import 'dotenv/config';
import express from 'express';
import { getClient } from './lib/ai.js';
import pipelineRouter from './routes/pipeline.js';
import explainRouter from './routes/explain.js';
import importPythonRouter from './routes/import/python.js';
import dataRouter from './routes/data.js';
import healthRouter from './routes/health.js';
import { editNodesHandler } from './routes/editNodes.js';

const app = express();

// CORS: allow dev client (e.g. localhost:5173) to call API directly
app.use((req, res, next) => {
  const origin = req.get('origin');
  const allowOrigin =
    origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
      ? origin
      : 'http://localhost:5173';
  res.set('Access-Control-Allow-Origin', allowOrigin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3001;

app.use('/api', pipelineRouter);
app.use('/api', explainRouter);
app.use('/api', dataRouter);
app.use('/api', healthRouter);
app.post('/api/edit-nodes', editNodesHandler);
app.use('/api/import-from-python', importPythonRouter);

app.listen(PORT, () => {
  console.log(`Convoy API server running on http://localhost:${PORT}`);
  console.log('  POST /api/edit-nodes registered');
  if (!getClient()) {
    console.log(
      'Set ANTHROPIC_API_KEY environment variable to enable AI features.'
    );
  }
});
