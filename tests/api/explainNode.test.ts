import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createMockClient, createErrorClient } from './helpers';

vi.mock('../../server/lib/ai.ts', () => ({
  getClient: vi.fn(),
}));

import app from '../../server/app';
import { getClient } from '../../server/lib/ai';

const mockedGetClient = vi.mocked(getClient);

describe('POST /api/explain-node', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Validation -----------------------------------------------------------

  it('returns 400 when nodeType is missing', async () => {
    const res = await request(app)
      .post('/api/explain-node')
      .send({ config: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeType/i);
  });

  // --- No API key (mock fallback) -------------------------------------------

  it('returns mock explanation when no API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/explain-node')
      .send({
        nodeType: 'filter',
        config: { column: 'country', operator: 'eq', value: 'US' },
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.explanation).toBe('string');
    expect(res.body.explanation).toMatch(/country/i);
  });

  it('returns mock explanation for groupBy without API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/explain-node')
      .send({
        nodeType: 'groupBy',
        config: {
          groupByColumn: 'country',
          aggregateColumn: 'population',
          aggregation: 'sum',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation).toMatch(/group/i);
  });

  // --- Successful AI response ------------------------------------------------

  it('returns AI-generated explanation', async () => {
    mockedGetClient.mockReturnValue(
      createMockClient('This step filters your data to show only entries from the US.')
    );

    const res = await request(app)
      .post('/api/explain-node')
      .send({
        nodeType: 'filter',
        config: { column: 'country', operator: 'eq', value: 'US' },
        inputRowCount: 100,
        outputRowCount: 25,
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.explanation).toBe('string');
    expect(res.body.explanation.length).toBeGreaterThan(0);
  });

  // --- AI error (falls back to mock) ----------------------------------------

  it('falls back to mock explanation when AI errors', async () => {
    mockedGetClient.mockReturnValue(
      createErrorClient(new Error('Internal error'))
    );

    const res = await request(app)
      .post('/api/explain-node')
      .send({
        nodeType: 'sort',
        config: { column: 'population', direction: 'desc' },
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.explanation).toBe('string');
    expect(res.body.explanation).toMatch(/population/i);
  });
});
