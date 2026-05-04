import express from 'express';
import { existsSync } from 'fs';
import path from 'path';
import explainRouter from './routes/explain.ts';
import importPythonRouter from './routes/import/python.ts';
import dataRouter from './routes/data.ts';
import healthRouter from './routes/health.ts';
import editNodesRouter from './routes/editNodes.ts';
import answerAboutNodesRouter from './routes/answerAboutNodes.ts';
import chartRouter from './routes/chart.ts';
import cleanDataRouter from './routes/cleanData.ts';
import summarizeDataRouter from './routes/summarizeData.ts';
import diagnoseNodesRouter from './routes/diagnoseNodes.ts';

const app = express();

app.use(express.json());

app.use('/api', editNodesRouter);
app.use('/api', answerAboutNodesRouter);
app.use('/api', explainRouter);
app.use('/api', dataRouter);
app.use('/api', healthRouter);
app.use('/api', chartRouter);
app.use('/api', cleanDataRouter);
app.use('/api', summarizeDataRouter);
app.use('/api', diagnoseNodesRouter);
app.use('/api/import-from-python', importPythonRouter);

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    app.use(express.static(distPath));
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    console.warn(`[server] Production build not found at ${indexPath}.`);
  }
}

export default app;
