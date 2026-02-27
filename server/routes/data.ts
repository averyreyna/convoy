import express from 'express';

const router = express.Router();

router.get('/fetch-csv', async (req, res) => {
  const { url } = req.query as { url?: string };

  if (!url || typeof url !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP/HTTPS URLs are supported');
    }

    const response = await fetch(url, {
      headers: {
        Accept: 'text/csv, text/plain, */*',
        'User-Agent': 'Convoy/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).send(`Remote server returned ${response.status}`);
    }

    const text = await response.text();
    res.type('text/csv').send(text);
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { name?: string };
    console.error('CSV fetch error:', err.message);
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).send('Request timed out');
    }
    res.status(500).send(err.message || 'Failed to fetch URL');
  }
});

export default router;
