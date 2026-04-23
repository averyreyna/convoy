import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createMockClient,
  createErrorClient,
  SAMPLE_SCHEMA,
  SAMPLE_PIPELINE_CONTEXT,
  SAMPLE_ROWS,
} from './helpers';

vi.mock('../../server/lib/ai.ts', () => ({
  getClient: vi.fn(),
}));

import app from '../../server/app';
import { getClient } from '../../server/lib/ai';

const mockedGetClient = vi.mocked(getClient);

describe('POST /api/diagnose-nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Validation -----------------------------------------------------------

  it('returns 400 when nodeIds is missing', async () => {
    const res = await request(app)
      .post('/api/diagnose-nodes')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeIds/i);
  });

  it('returns 400 when nodeIds is empty', async () => {
    const res = await request(app)
      .post('/api/diagnose-nodes')
      .send({ nodeIds: [] });

    expect(res.status).toBe(400);
  });

  // --- No API key ------------------------------------------------------------

  it('returns 503 when no API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/diagnose-nodes')
      .send({ nodeIds: ['node-1'] });

    expect(res.status).toBe(503);
  });

  // --- Successful AI response ------------------------------------------------

  it('returns diagnosis from AI response', async () => {
    mockedGetClient.mockReturnValue(
      createMockClient('The filter node is removing all rows because no data matches "US".')
    );

    const res = await request(app)
      .post('/api/diagnose-nodes')
      .send({
        nodeIds: ['node-1'],
        question: 'Why is the output empty?',
        schema: SAMPLE_SCHEMA,
        sampleRows: SAMPLE_ROWS,
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.diagnosis).toBe('string');
    expect(res.body.diagnosis.length).toBeGreaterThan(0);
  });

  // --- AI error --------------------------------------------------------------

  it('returns 500 when AI throws an error', async () => {
    mockedGetClient.mockReturnValue(
      createErrorClient(new Error('Connection reset'))
    );

    const res = await request(app)
      .post('/api/diagnose-nodes')
      .send({
        nodeIds: ['node-1'],
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/connection reset/i);
  });
});
