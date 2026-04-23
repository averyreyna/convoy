import 'dotenv/config';
import app from './app.ts';
import { getClient } from './lib/ai.ts';

const PORT = process.env.PORT || 3001;

app.listen(PORT, (err?: Error) => {
  if (err) {
    console.error(`Failed to start server on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Convoy API server running on http://localhost:${PORT}`);
  console.log('  POST /api/edit-nodes registered');
  if (!getClient()) {
    console.log(
      'Set ANTHROPIC_API_KEY environment variable to enable AI features.'
    );
  }
});
