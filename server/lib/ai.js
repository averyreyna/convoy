import Anthropic from '@anthropic-ai/sdk';

let client;
try {
  client = new Anthropic();
} catch {
  console.warn(
    'Warning: ANTHROPIC_API_KEY not set. AI features will return mock data.'
  );
}

export function getClient() {
  return client;
}
