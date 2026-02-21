import 'dotenv/config';
import express from 'express';
import { getClient } from './lib/ai.js';
import pipelineRouter from './routes/pipeline.js';
import explainRouter from './routes/explain.js';
import importPythonRouter from './routes/import/python.js';
import importD3Router from './routes/import/d3.js';
import dataRouter from './routes/data.js';
import datawrapperRouter from './routes/datawrapper.js';
import healthRouter from './routes/health.js';
import editNodesRouter from './routes/editNodes.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.use('/api', pipelineRouter);
app.use('/api', explainRouter);
app.use('/api', dataRouter);
app.use('/api', datawrapperRouter);
app.use('/api', healthRouter);
app.use('/api', editNodesRouter);
app.use('/api/import-from-python', importPythonRouter);
app.use('/api/import-from-d3', importD3Router);

app.listen(PORT, () => {
  console.log(`Convoy API server running on http://localhost:${PORT}`);
  if (!getClient()) {
    console.log(
      'Set ANTHROPIC_API_KEY environment variable to enable AI features.'
    );
  }
});
