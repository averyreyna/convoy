/**
 * In-browser Python execution via Pyodide.
 * Loads Pyodide once, runs user/generated Python code with pandas, returns DataFrame result.
 */

import { loadPyodide } from 'pyodide';
import type { DataFrame, Column } from '@/types';

type PyodideInstance = Awaited<ReturnType<typeof loadPyodide>>;
let pyodidePromise: Promise<PyodideInstance> | null = null;

function getPyodide(): Promise<PyodideInstance> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const p = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
        fullStdLib: false,
      });
      await p.loadPackage('pandas');
      return p;
    })();
  }
  return pyodidePromise;
}

/**
 * Run Python code with input dataframe in scope as `df`.
 * Returns the resulting dataframe (must be named `df` in the Python scope).
 */
export async function runPythonWithDataFrame(
  input: DataFrame,
  code: string
): Promise<DataFrame> {
  const pyodide = await getPyodide();
  if (!pyodide) throw new Error('Pyodide not loaded');

  pyodide.globals.set('input_json', JSON.stringify(input));
  pyodide.globals.set('user_code', code);

  const runScript = `
import json
import pandas as pd
from js import input_json, user_code
data = json.loads(input_json)
df = pd.DataFrame(data["rows"])
exec(user_code)
cols = [{"name": c, "type": "string"} for c in df.columns]
rows = df.to_dict("records")
{"columns": cols, "rows": rows}
`;

  const result = await pyodide.runPythonAsync(runScript);
  if (!result) {
    throw new Error('Python code did not produce a result');
  }

  const output = result.toJs({
    dict_converter: Object.fromEntries,
    create_proxies: false,
  }) as { columns: { name: string; type: string }[]; rows: Record<string, unknown>[] };

  const columns: Column[] = output.columns.map((c) => ({
    name: c.name,
    type: (c.type === 'number' || c.type === 'boolean' || c.type === 'date' ? c.type : 'string') as Column['type'],
  }));

  return {
    columns,
    rows: output.rows,
  };
}
