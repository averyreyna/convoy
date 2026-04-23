import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createMockClient,
  createErrorClient,
  SAMPLE_SCHEMA,
  SAMPLE_ROWS,
} from './helpers';

vi.mock('../../server/lib/ai.ts', () => ({
  getClient: vi.fn(),
}));

import app from '../../server/app';
import { getClient } from '../../server/lib/ai';

const mockedGetClient = vi.mocked(getClient);

describe('POST /api/summarize-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Validation -----------------------------------------------------------

  it('returns 400 when schema is missing', async () => {
    const res = await request(app)
      .post('/api/summarize-data')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/schema/i);
  });

  it('returns 400 when schema columns is empty', async () => {
    const res = await request(app)
      .post('/api/summarize-data')
      .send({ schema: { columns: [] } });

    expect(res.status).toBe(400);
  });

  // --- No API key ------------------------------------------------------------

  it('returns 503 when no API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/summarize-data')
      .send({ schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(503);
  });

  // --- Successful AI response ------------------------------------------------

  it('returns title and summary from AI response', async () => {
    const aiResponse = JSON.stringify({
      title: 'Country GDP Overview',
      summary: 'This dataset contains country-level GDP and population data.',
    });

    mockedGetClient.mockReturnValue(createMockClient(aiResponse));

    const res = await request(app)
      .post('/api/summarize-data')
      .send({
        schema: SAMPLE_SCHEMA,
        sampleRows: SAMPLE_ROWS,
        prompt: 'focus on GDP',
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.summary).toBe('string');
    expect(res.body.summary.length).toBeGreaterThan(0);
    expect(typeof res.body.title).toBe('string');
  });

  it('returns 500 when AI returns no JSON', async () => {
    mockedGetClient.mockReturnValue(
      createMockClient('Here is a summary of your data...')
    );

    const res = await request(app)
      .post('/api/summarize-data')
      .send({ schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(500);
  });

  // --- AI error --------------------------------------------------------------

  it('returns 500 when AI throws an error', async () => {
    mockedGetClient.mockReturnValue(
      createErrorClient(new Error('API quota exceeded'))
    );

    const res = await request(app)
      .post('/api/summarize-data')
      .send({ schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/quota/i);
  });
});
