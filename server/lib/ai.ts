import Anthropic from '@anthropic-ai/sdk';

const hasKey = Boolean(
  typeof process !== 'undefined' && process.env && process.env.ANTHROPIC_API_KEY
);
if (hasKey) {
  const key = process.env.ANTHROPIC_API_KEY;
  const mask = key && key.length > 12 ? `${key.slice(0, 10)}...${key.slice(-4)}` : '(set)';
  console.log('[ai] ANTHROPIC_API_KEY is set', mask);
} else {
  console.warn('[ai] ANTHROPIC_API_KEY is not set — AI features will return empty/mock data.');
}

let client: Anthropic | undefined;
try {
  client = new Anthropic();
} catch (err) {
  console.warn(
    '[ai] Anthropic client failed to initialize:',
    err instanceof Error ? err.message : err
  );
}

export function getClient(): Anthropic | undefined {
  return client;
}
