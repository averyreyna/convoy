import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createMockClient,
  createErrorClient,
  SAMPLE_SCHEMA,
  SAMPLE_PIPELINE_CONTEXT,
} from './helpers';

vi.mock('../../server/lib/ai.ts', () => ({
  getClient: vi.fn(),
}));

import app from '../../server/app';
import { getClient } from '../../server/lib/ai';

const mockedGetClient = vi.mocked(getClient);

describe('POST /api/answer-about-nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Validation -----------------------------------------------------------

  it('returns 400 when nodeIds is missing', async () => {
    const res = await request(app)
      .post('/api/answer-about-nodes')
      .send({ question: 'What does this do?' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeIds/i);
  });

  it('returns 400 when question is missing', async () => {
    const res = await request(app)
      .post('/api/answer-about-nodes')
      .send({ nodeIds: ['node-1'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/question/i);
  });

  it('returns 400 when question is empty string', async () => {
    const res = await request(app)
      .post('/api/answer-about-nodes')
      .send({ nodeIds: ['node-1'], question: '   ' });

    expect(res.status).toBe(400);
  });

  // --- No API key ------------------------------------------------------------

  it('returns fallback answer when no API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/answer-about-nodes')
      .send({ nodeIds: ['node-1'], question: 'What does this do?' });

    expect(res.status).toBe(200);
    expect(typeof res.body.answer).toBe('string');
    expect(res.body.answer.length).toBeGreaterThan(0);
  });

  // --- Successful AI response ------------------------------------------------

  it('returns answer from AI response', async () => {
    mockedGetClient.mockReturnValue(
      createMockClient('This filter keeps only US data.')
    );

    const res = await request(app)
      .post('/api/answer-about-nodes')
      .send({
        nodeIds: ['node-1'],
        question: 'What does this filter do?',
        schema: SAMPLE_SCHEMA,
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('This filter keeps only US data.');
  });

  // --- AI error --------------------------------------------------------------

  it('returns 500 when AI throws an error', async () => {
    mockedGetClient.mockReturnValue(
      createErrorClient(new Error('Service unavailable'))
    );

    const res = await request(app)
      .post('/api/answer-about-nodes')
      .send({
        nodeIds: ['node-1'],
        question: 'Why is this failing?',
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/service unavailable/i);
  });
});
