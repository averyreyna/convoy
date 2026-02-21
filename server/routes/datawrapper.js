import express from 'express';

const router = express.Router();

const DW_API_BASE = 'https://api.datawrapper.de/v3';

const CONVOY_TO_DW_CHART_TYPE = {
  bar: 'd3-bars',
  line: 'd3-lines',
  area: 'd3-areas',
  scatter: 'd3-scatter-plot',
  pie: 'd3-pies',
};

router.get('/datawrapper/status', (_req, res) => {
  const hasToken = !!process.env.DATAWRAPPER_API_TOKEN;
  res.json({ configured: hasToken });
});

router.post('/datawrapper/export', async (req, res) => {
  const { title, chartType, csvData, metadata, publish } = req.body;
  const DW_TOKEN = process.env.DATAWRAPPER_API_TOKEN;

  if (!DW_TOKEN) {
    return res.status(400).json({
      error: 'DATAWRAPPER_API_TOKEN is not configured. Add it to your .env file.',
    });
  }

  if (!csvData) {
    return res.status(400).json({ error: 'Missing csvData in request body' });
  }

  const dwChartType =
    CONVOY_TO_DW_CHART_TYPE[chartType] || chartType || 'd3-bars';

  const jsonHeaders = {
    Authorization: `Bearer ${DW_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    const createRes = await fetch(`${DW_API_BASE}/charts`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        title: title || 'Convoy Export',
        type: dwChartType,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create chart: ${createRes.status} — ${err}`);
    }

    const chart = await createRes.json();
    const chartId = chart.id;
    console.log(`Datawrapper: created chart ${chartId}`);

    const dataRes = await fetch(`${DW_API_BASE}/charts/${chartId}/data`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${DW_TOKEN}`,
        'Content-Type': 'text/csv',
      },
      body: csvData,
    });

    if (!dataRes.ok) {
      const err = await dataRes.text();
      throw new Error(`Failed to upload data: ${dataRes.status} — ${err}`);
    }
    console.log(`Datawrapper: uploaded data to chart ${chartId}`);

    if (metadata && Object.keys(metadata).length > 0) {
      const patchRes = await fetch(`${DW_API_BASE}/charts/${chartId}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ metadata }),
      });

      if (!patchRes.ok) {
        console.warn(
          `Datawrapper: metadata patch failed (${patchRes.status}), continuing`
        );
      } else {
        console.log(`Datawrapper: configured metadata for chart ${chartId}`);
      }
    }

    let publicUrl = null;
    if (publish) {
      const pubRes = await fetch(`${DW_API_BASE}/charts/${chartId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${DW_TOKEN}` },
      });

      if (pubRes.ok) {
        const pubData = await pubRes.json();
        publicUrl = pubData.data?.[0]?.publicUrl || `https://datawrapper.dwcdn.net/${chartId}/`;
        console.log(`Datawrapper: published chart ${chartId}`);
      } else {
        console.warn(`Datawrapper: publish failed (${pubRes.status}), chart still accessible in editor`);
      }
    }

    res.json({
      chartId,
      editUrl: `https://app.datawrapper.de/chart/${chartId}/visualize`,
      publicUrl,
    });
  } catch (error) {
    console.error('Datawrapper export error:', error);
    res.status(500).json({ error: error.message || 'Datawrapper export failed' });
  }
});

export default router;
