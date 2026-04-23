import { vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Creates a mock Anthropic client with a configurable `messages.create` stub.
 * Pass a `responseText` to control what the mock AI returns.
 */
export function createMockClient(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  } as unknown as Anthropic;
}

/**
 * Creates a mock client whose `messages.create` rejects with the given error.
 */
export function createErrorClient(error: Error) {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(error),
    },
  } as unknown as Anthropic;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

export const SAMPLE_SCHEMA = {
  columns: [
    { name: 'country', type: 'string' },
    { name: 'population', type: 'number' },
    { name: 'gdpPerCapita', type: 'number' },
  ],
};

export const SAMPLE_PIPELINE_CONTEXT = {
  nodes: [
    {
      id: 'node-1',
      type: 'filter',
      data: { column: 'country', operator: 'eq', value: 'US' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'node-2',
      type: 'sort',
      data: { column: 'population', direction: 'desc' },
      position: { x: 200, y: 0 },
    },
  ],
  edges: [{ source: 'node-1', target: 'node-2', id: 'e1' }],
};

export const SAMPLE_ROWS = [
  { country: 'US', population: 331000000, gdpPerCapita: 63000 },
  { country: 'UK', population: 67000000, gdpPerCapita: 42000 },
];
