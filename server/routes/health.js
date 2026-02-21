import express from 'express';
import { getClient } from '../lib/ai.js';

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!getClient(),
    hasDatawrapperToken: !!process.env.DATAWRAPPER_API_TOKEN,
  });
});

export default router;
