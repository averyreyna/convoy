import express from 'express';
import { getClient } from '../lib/ai.ts';

const router = express.Router();

interface HealthResponse {
  status: string;
  hasApiKey: boolean;
}

router.get('/health', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    hasApiKey: !!getClient(),
  };
  res.json(body);
});

export default router;
