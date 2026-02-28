import 'dotenv/config';
import express from 'express';
import { getClient } from './lib/ai.ts';
import pipelineRouter from './routes/pipeline.ts';
import explainRouter from './routes/explain.ts';
import importPythonRouter from './routes/import/python.ts';
import dataRouter from './routes/data.ts';
import healthRouter from './routes/health.ts';
import editNodesRouter from './routes/editNodes.ts';
import answerAboutNodesRouter from './routes/answerAboutNodes.ts';
import chartRouter from './routes/chart.ts';

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3001;

app.use('/api', pipelineRouter);
app.use('/api', editNodesRouter);
app.use('/api', answerAboutNodesRouter);
app.use('/api', explainRouter);
app.use('/api', dataRouter);
app.use('/api', healthRouter);
app.use('/api', chartRouter);
app.use('/api/import-from-python', importPythonRouter);

app.listen(PORT, (err?: Error) => {
  if (err) {
    console.error(`Failed to start server on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Convoy API server running on http://localhost:${PORT}`);
  console.log('  POST /api/edit-nodes registered');
  if (!getClient()) {
    console.log(
      'Set ANTHROPIC_API_KEY environment variable to enable AI features.'
    );
  }
});
