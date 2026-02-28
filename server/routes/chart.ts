import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import express, { Request, Response } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 50;

interface ChartCacheEntry {
  image: string;
  timestamp: number;
}

const chartCache = new Map<string, ChartCacheEntry>();

function cacheKey(payload: {
  chartType: string;
  xAxis: string;
  yAxis: string;
  colorBy?: string;
  data: unknown[];
  width?: number;
  height?: number;
  format?: string;
}): string {
  const str = JSON.stringify({
    chartType: payload.chartType,
    xAxis: payload.xAxis,
    yAxis: payload.yAxis,
    colorBy: payload.colorBy ?? '',
    data: payload.data,
    width: payload.width,
    height: payload.height,
    format: payload.format,
  });
  return createHash('sha256').update(str).digest('hex');
}

function evictCacheIfNeeded(): void {
  if (chartCache.size <= CACHE_MAX_SIZE) return;
  const entries = [...chartCache.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );
  const toRemove = entries.length - CACHE_MAX_SIZE;
  for (let i = 0; i < toRemove; i++) {
    chartCache.delete(entries[i][0]);
  }
}

function runRenderChart(payload: Record<string, unknown>): Promise<{ image: string } | { error: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'render_chart.py');
    const proc = spawn('python3', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk;
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk;
    });
    const input = JSON.stringify(payload);
    proc.stdin?.write(input, (err) => {
      if (err) {
        proc.kill();
        resolve({ error: (err as Error).message });
        return;
      }
      proc.stdin?.end();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ error: stderr || `Python script exited with code ${code}` });
        return;
      }
      try {
        const result = JSON.parse(stdout) as { image?: string; error?: string };
        if (result.error) {
          resolve({ error: result.error });
          return;
        }
        if (typeof result.image === 'string') {
          resolve({ image: result.image });
          return;
        }
        resolve({ error: 'Invalid response from chart script' });
      } catch {
        resolve({ error: 'Invalid JSON from chart script' });
      }
    });
    proc.on('error', (err) => {
      resolve({ error: (err as Error).message });
    });
  });
}

interface RenderChartBody {
  chartType?: string;
  xAxis?: string;
  yAxis?: string;
  colorBy?: string;
  data?: unknown[];
  width?: number;
  height?: number;
  format?: string;
}

router.post('/render-chart', async (req: Request, res: Response) => {
  const body = req.body as RenderChartBody;
  const chartType = body.chartType ?? 'bar';
  const xAxis = body.xAxis ?? '';
  const yAxis = body.yAxis ?? '';
  const data = Array.isArray(body.data) ? body.data : [];
  const width = typeof body.width === 'number' ? body.width : 800;
  const height = typeof body.height === 'number' ? body.height : 500;
  const format = body.format === 'svg' ? 'svg' : 'png';

  if (!xAxis || !yAxis) {
    return res.status(400).json({ error: 'Missing xAxis or yAxis' });
  }
  if (data.length === 0) {
    return res.status(400).json({ error: 'Missing or empty data' });
  }

  const payload = {
    chartType,
    xAxis,
    yAxis,
    colorBy: body.colorBy,
    data,
    width,
    height,
    format,
  };

  const key = cacheKey(payload);
  const cached = chartCache.get(key);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ image: cached.image });
  }

  const result = await runRenderChart(payload);
  if ('error' in result) {
    return res.status(502).json({ error: result.error });
  }
  chartCache.set(key, { image: result.image, timestamp: now });
  evictCacheIfNeeded();
  return res.json({ image: result.image });
});

export default router;
