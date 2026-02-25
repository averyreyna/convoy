/**
 * Sample datasets and loader for the entry flow.
 * Used when user picks "Use sample" on the entry screen so we can create
 * a DataSource node and load data before opening the pipeline prompt.
 */

import Papa from 'papaparse';
import type { Column, DataFrame } from '@/types';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDataStore } from '@/stores/dataStore';

function inferColumnType(value: unknown): Column['type'] {
  if (value === null || value === undefined || value === '') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(Date.parse(str))) return 'date';
  return 'string';
}

export const SAMPLE_DATASETS = [
  {
    id: 'gapminder',
    label: 'Gapminder',
    description: '120 rows — country, GDP, life expectancy over time',
    path: '/data/gapminder.csv',
    hint: 'Try: Filter → GroupBy → Sort → Bar chart',
  },
  {
    id: 'energy',
    label: 'Energy Production',
    description: '40 rows — wide format, energy sources by country',
    path: '/data/energy-production.csv',
    hint: 'Try: Reshape (unpivot) → GroupBy → Area chart',
  },
  {
    id: 'nyc311',
    label: 'NYC 311 Complaints',
    description: '150 rows — complaint types, boroughs, resolution times',
    path: '/data/nyc-311-complaints.csv',
    hint: 'Try: Filter "Noise" → GroupBy borough → Bar chart',
  },
] as const;

export type SampleDataset = (typeof SAMPLE_DATASETS)[number];

/**
 * Create a DataSource node and load the given sample CSV into it.
 * Calls addNode, then fetch + parse, then setNodeData, setNodeOutput, updateNode.
 */
export async function loadSampleIntoDataSource(
  nodeId: string,
  sample: SampleDataset
): Promise<void> {
  const addNode = useCanvasStore.getState().addNode;
  const updateNode = useCanvasStore.getState().updateNode;
  const setNodeData = useDataStore.getState().setNodeData;
  const setNodeOutput = useDataStore.getState().setNodeOutput;

  const fileName = sample.path.split('/').pop() || `${sample.id}.csv`;

  addNode({
    id: nodeId,
    type: 'dataSource',
    position: { x: 120, y: 120 },
    data: {
      state: 'proposed',
      label: 'Data Source',
      fileName,
    },
  });

  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';
  const url = base + (sample.path.startsWith('/') ? sample.path : `/${sample.path}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load sample: ${res.status} ${res.statusText}`);
  const csvText = await res.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(results.errors[0]?.message || 'Failed to parse CSV'));
          return;
        }

        const validRows = (results.data as Record<string, unknown>[]).filter(
          (row) =>
            Object.values(row).some(
              (v) => v !== null && v !== undefined && v !== ''
            )
        );

        if (validRows.length === 0) {
          reject(new Error('No data rows found'));
          return;
        }

        const firstRow = validRows[0] || {};
        const columns: Column[] = Object.keys(firstRow).map((name) => ({
          name,
          type: inferColumnType(firstRow[name]),
        }));

        setNodeData(nodeId, {
          rows: validRows,
          columns,
          fileName,
          rowCount: validRows.length,
        });

        const output: DataFrame = { columns, rows: validRows };
        setNodeOutput(nodeId, output);

        updateNode(nodeId, {
          fileName,
          rowCount: validRows.length,
          columns,
          state: 'confirmed',
          error: undefined,
        });

        resolve();
      },
      error: (err: Error) => reject(err),
    });
  });
}
