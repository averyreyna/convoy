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

describe('POST /api/clean-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Validation -----------------------------------------------------------

  it('returns 400 when instruction is missing', async () => {
    const res = await request(app)
      .post('/api/clean-data')
      .send({ schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/instruction/i);
  });

  it('returns 400 when schema is missing', async () => {
    const res = await request(app)
      .post('/api/clean-data')
      .send({ instruction: 'Remove empty rows' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/schema/i);
  });

  // --- No API key ------------------------------------------------------------

  it('returns 503 when no API key', async () => {
    mockedGetClient.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/clean-data')
      .send({ instruction: 'Remove empty rows', schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(503);
  });

  // --- Successful AI response ------------------------------------------------

  it('returns code from AI response', async () => {
    const aiResponse = JSON.stringify({
      code: 'df = df.dropna()',
    });

    mockedGetClient.mockReturnValue(createMockClient(aiResponse));

    const res = await request(app)
      .post('/api/clean-data')
      .send({
        instruction: 'Remove empty rows',
        schema: SAMPLE_SCHEMA,
        sampleRows: SAMPLE_ROWS,
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.code).toBe('string');
    expect(res.body.code).toBe('df = df.dropna()');
  });

  it('returns 500 when AI returns no JSON', async () => {
    mockedGetClient.mockReturnValue(
      createMockClient('I cannot parse that request.')
    );

    const res = await request(app)
      .post('/api/clean-data')
      .send({ instruction: 'Do something', schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(500);
  });

  // --- AI error --------------------------------------------------------------

  it('returns 500 when AI throws an error', async () => {
    mockedGetClient.mockReturnValue(
      createErrorClient(new Error('Timeout'))
    );

    const res = await request(app)
      .post('/api/clean-data')
      .send({ instruction: 'Remove empty rows', schema: SAMPLE_SCHEMA });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/timeout/i);
  });
});
