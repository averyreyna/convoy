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
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        fullStdLib: false,
      });
      await p.loadPackage('pandas');
      await p.loadPackage('matplotlib');
      return p;
    })();
  }
  return pyodidePromise;
}

/**
 * Run Python code with input dataframe in scope as `df`.
 * Returns the resulting dataframe (must be named `df` in the Python scope).
 * If input has no rows, returns empty result with same columns without running Python (avoids KeyError when df has no columns).
 */
export async function runPythonWithDataFrame(
  input: DataFrame,
  code: string
): Promise<DataFrame> {
  if (!input.rows.length) {
    return { columns: input.columns, rows: [] };
  }

  console.log('[Convoy runPythonWithDataFrame]', {
    inputRows: input.rows.length,
    inputCols: input.columns.map((c) => c.name),
    codePreview: code.slice(0, 300),
  });

  const pyodide = await getPyodide();
  if (!pyodide) throw new Error('Pyodide not loaded');

  pyodide.globals.set('input_json', JSON.stringify(input));
  pyodide.globals.set('user_code', code);

  const runScript = `
import json
import pandas as pd
data = json.loads(input_json)
columns = [c["name"] for c in data["columns"]]
df = pd.DataFrame(data["rows"], columns=columns)
exec(user_code)
# If user assigned to a variable (e.g. df_top5 = df.head(5)) but did not assign to df, use it
try:
  for _vname in ("df_top5", "df_result", "result", "out"):
    if _vname in dir() and hasattr(eval(_vname), "to_dict"):
      df = eval(_vname)
      break
except Exception:
  pass
cols = [{"name": c, "type": "string"} for c in df.columns]
rows = df.to_dict("records")
_result_ = {"columns": cols, "rows": rows}
_result_
`;

  try {
    const result = await pyodide.runPythonAsync(runScript);
    if (result === undefined || result === null) {
      throw new Error('Python code did not produce a result');
    }

    const output = result.toJs({
      dict_converter: Object.fromEntries,
      create_proxies: false,
    }) as { columns: { name: string; type: string }[]; rows: Record<string, unknown>[] };

    console.log('[Convoy runPythonWithDataFrame] success', {
      outputRows: output.rows.length,
      outputCols: output.columns.map((c) => c.name),
    });

    const columns: Column[] = output.columns.map((c) => ({
      name: c.name,
      type: (c.type === 'number' || c.type === 'boolean' || c.type === 'date' ? c.type : 'string') as Column['type'],
    }));

    return {
      columns,
      rows: output.rows,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log('[Convoy runPythonWithDataFrame] error', { message });
    throw err;
  }
}

/**
 * Run a full pipeline script in Pyodide (no input dataframe).
 * The script must create or modify `df` (e.g. via pd.read_csv, transforms).
 * Used for "Run all" / "Run cell" in the pipeline code panel; the script text
 * is then sent to import-from-Python to propose nodes.
 */
export async function runFullPipelineScript(script: string): Promise<void> {
  const pyodide = await getPyodide();
  if (!pyodide) throw new Error('Pyodide not loaded');

  pyodide.globals.set('user_script', script);

  const runScript = `
import matplotlib
matplotlib.use("Agg")
import pandas as pd
exec(user_script)
`;

  try {
    await pyodide.runPythonAsync(runScript);
  } catch (err: unknown) {
    // Pyodide throws JS errors whose message often contains the full Python traceback
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
    throw new Error(message);
  }
}
