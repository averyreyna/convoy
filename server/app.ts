import express from 'express';
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

export default app;
