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

describe('POST /api/edit-nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Validation -----------------------------------------------------------

  it('returns 400 when nodeIds is missing', async () => {
    const res = await request(app)
      .post('/api/edit-nodes')
      .send({ prompt: 'filter by country' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeIds/i);
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/edit-nodes')
      .send({ nodeIds: ['node-1'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/i);
  });

  it('returns 400 when nodeIds is empty', async () => {
    const res = await request(app)
      .post('/api/edit-nodes')
      .send({ nodeIds: [], prompt: 'do something' });

    expect(res.status).toBe(400);
  });

  // --- No API key ------------------------------------------------------------

  it('returns empty suggestedPipeline when no API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/edit-nodes')
      .send({ nodeIds: ['node-1'], prompt: 'filter by country' });

    expect(res.status).toBe(200);
    expect(res.body.suggestedPipeline).toEqual({ nodes: [] });
  });

  // --- Successful AI response ------------------------------------------------

  it('returns parsed suggestedPipeline from AI response', async () => {
    const aiResponse = JSON.stringify({
      suggestedPipeline: {
        nodes: [
          {
            type: 'filter',
            config: { column: 'country', operator: 'eq', value: 'US' },
            label: 'Filter to US',
          },
        ],
      },
      explanation: 'Filtered to US rows',
    });

    mockedGetClient.mockReturnValue(createMockClient(aiResponse));

    const res = await request(app)
      .post('/api/edit-nodes')
      .send({
        nodeIds: ['node-1'],
        prompt: 'filter to US',
        schema: SAMPLE_SCHEMA,
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(200);
    expect(res.body.suggestedPipeline).toBeDefined();
    expect(Array.isArray(res.body.suggestedPipeline.nodes)).toBe(true);
    expect(res.body.suggestedPipeline.nodes.length).toBeGreaterThan(0);

    const node = res.body.suggestedPipeline.nodes[0];
    expect(node.type).toBe('filter');
    expect(node.config).toBeDefined();
    expect(res.body.explanation).toBe('Filtered to US rows');
  });

  it('returns empty nodes when AI returns no valid JSON', async () => {
    mockedGetClient.mockReturnValue(
      createMockClient('Sorry, I cannot help with that.')
    );

    const res = await request(app)
      .post('/api/edit-nodes')
      .send({
        nodeIds: ['node-1'],
        prompt: 'do something weird',
        schema: SAMPLE_SCHEMA,
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(200);
    expect(res.body.suggestedPipeline).toEqual({ nodes: [] });
  });

  // --- AI error --------------------------------------------------------------

  it('returns 500 when AI throws an error', async () => {
    mockedGetClient.mockReturnValue(
      createErrorClient(new Error('Rate limit exceeded'))
    );

    const res = await request(app)
      .post('/api/edit-nodes')
      .send({
        nodeIds: ['node-1'],
        prompt: 'filter to US',
        schema: SAMPLE_SCHEMA,
        pipelineContext: SAMPLE_PIPELINE_CONTEXT,
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/rate limit/i);
  });
});
