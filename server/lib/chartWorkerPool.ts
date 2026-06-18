/**
 * A small pool of long-lived Python chart workers.
 *
 * Replaces the previous one-process-per-render approach: each render no longer
 * pays interpreter boot + matplotlib import (~0.5-1.5s). Workers run
 * `render_chart.py --serve` and exchange newline-delimited JSON over stdio.
 * Each worker handles one request at a time (matplotlib is not reentrant), so
 * request/response stay 1:1 on a worker's pipe. Crashed or timed-out workers
 * are replaced on the next dispatch.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'render_chart.py');

const POOL_SIZE = Math.max(1, Number(process.env.CONVOY_CHART_WORKERS) || 2);
const JOB_TIMEOUT_MS = 20_000;
const PERF = process.env.CONVOY_PERF === '1';

export type ChartResult = { image: string } | { error: string };

interface Job {
  payload: Record<string, unknown>;
  resolve: (result: ChartResult) => void;
  startedAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface Worker {
  proc: ChildProcess;
  current: Job | null;
  buffer: string;
  lastStderr: string;
}

const workers: Worker[] = [];
const queue: Job[] = [];

function spawnWorker(): Worker {
  const proc = spawn('python3', [SCRIPT_PATH, '--serve'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const worker: Worker = { proc, current: null, buffer: '', lastStderr: '' };

  proc.stdout?.on('data', (chunk: Buffer) => {
    worker.buffer += chunk.toString();
    let newline = worker.buffer.indexOf('\n');
    while (newline !== -1) {
      const line = worker.buffer.slice(0, newline);
      worker.buffer = worker.buffer.slice(newline + 1);
      if (line.trim()) handleLine(worker, line);
      newline = worker.buffer.indexOf('\n');
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    worker.lastStderr = chunk.toString().slice(-2000);
  });

  const onDead = () => handleWorkerExit(worker);
  proc.on('exit', onDead);
  proc.on('error', onDead);

  return worker;
}

function handleLine(worker: Worker, line: string): void {
  const job = worker.current;
  if (!job) return; // unexpected output with no pending job; ignore
  let result: ChartResult;
  try {
    result = JSON.parse(line) as ChartResult;
  } catch {
    result = { error: 'Invalid JSON from chart worker' };
  }
  finishJob(worker, result);
}

function handleWorkerExit(worker: Worker): void {
  const idx = workers.indexOf(worker);
  if (idx !== -1) workers.splice(idx, 1);

  if (worker.current) {
    const job = worker.current;
    worker.current = null;
    if (job.timer) clearTimeout(job.timer);
    job.resolve({ error: worker.lastStderr.trim() || 'Chart worker exited unexpectedly' });
  }
  // A replacement is spawned lazily by the next dispatch().
  dispatch();
}

function finishJob(worker: Worker, result: ChartResult): void {
  const job = worker.current;
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  worker.current = null;
  if (PERF) {
    console.log(`[Convoy perf] chart worker render: ${Date.now() - job.startedAt}ms`);
  }
  job.resolve(result);
  dispatch();
}

function assign(worker: Worker, job: Job): void {
  worker.current = job;
  job.timer = setTimeout(() => {
    // The worker is likely wedged mid-render; kill it so a fresh one replaces it.
    worker.proc.kill('SIGKILL');
  }, JOB_TIMEOUT_MS);
  worker.proc.stdin?.write(JSON.stringify(job.payload) + '\n');
}

function dispatch(): void {
  while (queue.length > 0) {
    let worker = workers.find((w) => w.current === null);
    if (!worker) {
      if (workers.length >= POOL_SIZE) break; // all busy; wait for a free worker
      worker = spawnWorker();
      workers.push(worker);
    }
    assign(worker, queue.shift()!);
  }
}

/** Render a chart payload on a pooled worker. Always resolves (errors as { error }). */
export function renderChart(payload: Record<string, unknown>): Promise<ChartResult> {
  return new Promise((resolve) => {
    queue.push({ payload, resolve, startedAt: Date.now() });
    dispatch();
  });
}
