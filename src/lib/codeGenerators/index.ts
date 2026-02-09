/**
 * Code generators that produce D3-idiomatic JavaScript from node configurations.
 *
 * For transformation nodes (filter, groupBy, sort, select, transform), the generated
 * code is runnable: it receives `rows` and `columns` and returns `{ columns, rows }`.
 * The code view shows clean D3-style code using `data` as the variable name.
 *
 * For chart nodes, the code is informational D3.js JavaScript (not executed in-app).
 * For dataSource nodes, the code is informational D3.js JavaScript using d3.csv().
 */

/** All node types use JavaScript syntax in Monaco */
const JS_NODE_TYPES = new Set([
  'filter',
  'groupBy',
  'sort',
  'select',
  'transform',
  'chart',
  'dataSource',
  'computedColumn',
  'reshape',
]);

/**
 * Returns the Monaco editor language for a given node type.
 */
export function getEditorLanguage(nodeType: string): string {
  return JS_NODE_TYPES.has(nodeType) ? 'javascript' : 'javascript';
}

export function generateNodeCode(
  nodeType: string,
  config: Record<string, unknown>
): string {
  switch (nodeType) {
    case 'filter':
      return generateFilterCode(config);
    case 'groupBy':
      return generateGroupByCode(config);
    case 'sort':
      return generateSortCode(config);
    case 'select':
      return generateSelectCode(config);
    case 'transform':
      return generateTransformCode(config);
    case 'chart':
      return generateChartCode(config);
    case 'dataSource':
      return generateDataSourceCode(config);
    case 'computedColumn':
      return generateComputedColumnCode(config);
    case 'reshape':
      return generateReshapeCode(config);
    default:
      return `// Unknown node type: ${nodeType}\n// Configure the node to generate code`;
  }
}

// ─── D3-idiomatic JavaScript generators ──────────────────────────────────────

function generateFilterCode(config: Record<string, unknown>): string {
  const { column, operator, value } = config;

  if (!column || !operator) {
    return `// Filter node — configure column and condition to generate code
return { columns, rows };`;
  }

  const operatorLabels: Record<string, string> = {
    eq: 'equals',
    neq: 'does not equal',
    gt: 'is greater than',
    lt: 'is less than',
    contains: 'contains',
    startsWith: 'starts with',
  };

  const opLabel = operatorLabels[operator as string] || operator;
  const numValue = Number(value);
  const isNumeric = value !== '' && !isNaN(numValue);

  let condition: string;
  switch (operator) {
    case 'eq':
      condition = isNumeric
        ? `+d[${JSON.stringify(column)}] === ${numValue}`
        : `d[${JSON.stringify(column)}] === ${JSON.stringify(value)}`;
      break;
    case 'neq':
      condition = isNumeric
        ? `+d[${JSON.stringify(column)}] !== ${numValue}`
        : `d[${JSON.stringify(column)}] !== ${JSON.stringify(value)}`;
      break;
    case 'gt':
      condition = `+d[${JSON.stringify(column)}] > ${numValue}`;
      break;
    case 'lt':
      condition = `+d[${JSON.stringify(column)}] < ${numValue}`;
      break;
    case 'contains':
      condition = `String(d[${JSON.stringify(column)}] ?? "").toLowerCase().includes(${JSON.stringify(String(value).toLowerCase())})`;
      break;
    case 'startsWith':
      condition = `String(d[${JSON.stringify(column)}] ?? "").toLowerCase().startsWith(${JSON.stringify(String(value).toLowerCase())})`;
      break;
    default:
      condition = 'true';
  }

  return `// Filter: keep rows where "${column}" ${opLabel} ${JSON.stringify(value)}
const filtered = d3.filter(rows, d => ${condition});
return { columns, rows: filtered };`;
}

function generateGroupByCode(config: Record<string, unknown>): string {
  const { groupByColumn, aggregateColumn, aggregation } = config;

  if (!groupByColumn || !aggregation) {
    return `// Group By node — configure grouping to generate code
return { columns, rows };`;
  }

  const aggCol = aggregateColumn || groupByColumn;
  const resultColName =
    aggregation === 'count' ? 'count' : `${aggregation}_${aggCol}`;

  const aggLabels: Record<string, string> = {
    count: 'count',
    sum: 'sum',
    avg: 'average',
    min: 'minimum',
    max: 'maximum',
  };
  const aggLabel = aggLabels[aggregation as string] || aggregation;

  let rollupFn: string;
  switch (aggregation) {
    case 'count':
      rollupFn = `v => v.length`;
      break;
    case 'sum':
      rollupFn = `v => d3.sum(v, d => +d[${JSON.stringify(aggCol)}])`;
      break;
    case 'avg':
      rollupFn = `v => d3.mean(v, d => +d[${JSON.stringify(aggCol)}])`;
      break;
    case 'min':
      rollupFn = `v => d3.min(v, d => +d[${JSON.stringify(aggCol)}])`;
      break;
    case 'max':
      rollupFn = `v => d3.max(v, d => +d[${JSON.stringify(aggCol)}])`;
      break;
    default:
      rollupFn = `v => v.length`;
  }

  return `// Group by "${groupByColumn}" and calculate ${aggLabel} of "${aggCol}"
const grouped = d3.flatRollup(rows, ${rollupFn}, d => d[${JSON.stringify(groupByColumn)}]);
const outRows = grouped.map(([key, val]) => ({ ${JSON.stringify(groupByColumn).slice(1, -1)}: key, ${JSON.stringify(resultColName).slice(1, -1)}: val }));
const outCols = [
  { name: ${JSON.stringify(groupByColumn)}, type: "string" },
  { name: ${JSON.stringify(resultColName)}, type: "number" }
];
return { columns: outCols, rows: outRows };`;
}

function generateSortCode(config: Record<string, unknown>): string {
  const { column, direction } = config;

  if (!column) {
    return `// Sort node — select a column to generate code
return { columns, rows };`;
  }

  const ascending = direction !== 'desc';
  const dirLabel = ascending ? 'ascending' : 'descending';
  const compareFn = ascending ? 'd3.ascending' : 'd3.descending';

  return `// Sort by "${column}" in ${dirLabel} order
const sorted = d3.sort(rows, (a, b) => ${compareFn}(a[${JSON.stringify(column)}], b[${JSON.stringify(column)}]));
return { columns, rows: sorted };`;
}

function generateSelectCode(config: Record<string, unknown>): string {
  const { columns: selectedColumns } = config as { columns?: string[] };

  if (!selectedColumns || selectedColumns.length === 0) {
    return `// Select Columns node — choose columns to keep
return { columns, rows };`;
  }

  // Use clean destructuring syntax
  const destructured = selectedColumns.map((c) => {
    // If the column name is a valid JS identifier, use it directly
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(c)) return c;
    // Otherwise use computed property with alias
    return `${JSON.stringify(c)}: ${c.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
  });
  const aliases = selectedColumns.map((c) => {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(c)) return c;
    return c.replace(/[^a-zA-Z0-9_$]/g, '_');
  });

  // Check if all columns are simple identifiers for a cleaner output
  const allSimple = selectedColumns.every((c) =>
    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(c)
  );

  if (allSimple) {
    return `// Keep only: ${selectedColumns.join(', ')}
const result = rows.map(({ ${selectedColumns.join(', ')} }) => ({ ${selectedColumns.join(', ')} }));
const outCols = columns.filter(c => [${selectedColumns.map((c) => JSON.stringify(c)).join(', ')}].includes(c.name));
return { columns: outCols, rows: result };`;
  }

  return `// Keep only: ${selectedColumns.join(', ')}
const keep = [${selectedColumns.map((c) => JSON.stringify(c)).join(', ')}];
const result = rows.map(d => {
  const out = {};
  for (const k of keep) out[k] = d[k];
  return out;
});
const outCols = columns.filter(c => keep.includes(c.name));
return { columns: outCols, rows: result };`;
}

function generateTransformCode(config: Record<string, unknown>): string {
  const { customCode } = config;
  if (customCode && typeof customCode === 'string') {
    return customCode;
  }
  return `// The input data is available as 'rows' (array of objects)
// and 'columns' (array of {name, type}).
// Return { columns, rows } with your transformed data.

return { columns, rows };`;
}

function generateComputedColumnCode(config: Record<string, unknown>): string {
  const { newColumnName, expression } = config;

  if (!newColumnName || !expression) {
    return `// Computed Column — configure a name and expression
return { columns, rows };`;
  }

  return `// Add computed column "${newColumnName}"
const result = rows.map(d => ({ ...d, ${JSON.stringify(newColumnName).slice(1, -1)}: ${expression} }));
const outCols = [...columns, { name: ${JSON.stringify(newColumnName)}, type: "number" }];
return { columns: outCols, rows: result };`;
}

function generateReshapeCode(config: Record<string, unknown>): string {
  const { keyColumn, valueColumn, pivotColumns } = config as {
    keyColumn?: string;
    valueColumn?: string;
    pivotColumns?: string[];
  };

  if (!keyColumn || !valueColumn || !pivotColumns || pivotColumns.length === 0) {
    return `// Reshape — configure columns to unpivot (wide → long)
return { columns, rows };`;
  }

  return `// Reshape: unpivot ${pivotColumns.join(', ')} into "${keyColumn}" / "${valueColumn}"
const keep = columns.filter(c => ![${pivotColumns.map((c) => JSON.stringify(c)).join(', ')}].includes(c.name)).map(c => c.name);
const result = rows.flatMap(d => {
  const base = {};
  for (const k of keep) base[k] = d[k];
  return [${pivotColumns.map((c) => JSON.stringify(c)).join(', ')}].map(col => ({
    ...base,
    ${JSON.stringify(keyColumn).slice(1, -1)}: col,
    ${JSON.stringify(valueColumn).slice(1, -1)}: d[col]
  }));
});
const outCols = [
  ...columns.filter(c => keep.includes(c.name)),
  { name: ${JSON.stringify(keyColumn)}, type: "string" },
  { name: ${JSON.stringify(valueColumn)}, type: "number" }
];
return { columns: outCols, rows: result };`;
}

// ─── D3.js chart code generator (informational JavaScript) ──────────────────

function generateChartCode(config: Record<string, unknown>): string {
  const { chartType, xAxis, yAxis } = config;

  if (!xAxis || !yAxis) {
    return `// Chart node — configure axes to generate D3.js code`;
  }

  const type = (chartType as string) || 'bar';

  const typeLabels: Record<string, string> = {
    bar: 'bar',
    line: 'line',
    area: 'area',
    scatter: 'scatter',
    pie: 'pie',
  };
  const label = typeLabels[type] || 'bar';

  // Common SVG setup — no require(), assumes d3 is available
  const header = `// Create a ${label} chart of "${yAxis}" by "${xAxis}" using D3.js
const width = 800;
const height = 500;
const margin = { top: 20, right: 30, bottom: 60, left: 60 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

const svg = d3.select("#chart")
  .append("svg")
  .attr("width", width)
  .attr("height", height);
`;

  switch (type) {
    case 'bar':
      return `${header}
const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleBand()
  .domain(data.map(d => d["${xAxis}"]))
  .range([0, innerW])
  .padding(0.2);

const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => +d["${yAxis}"])])
  .nice()
  .range([innerH, 0]);

g.append("g")
  .attr("transform", \`translate(0,\${innerH})\`)
  .call(d3.axisBottom(x))
  .selectAll("text")
  .attr("transform", "rotate(-45)")
  .style("text-anchor", "end");

g.append("g").call(d3.axisLeft(y));

g.selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", d => x(d["${xAxis}"]))
  .attr("y", d => y(+d["${yAxis}"]))
  .attr("width", x.bandwidth())
  .attr("height", d => innerH - y(+d["${yAxis}"]))
  .attr("fill", "#3b82f6")
  .attr("rx", 3);`;

    case 'line':
      return `${header}
const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleBand()
  .domain(data.map(d => d["${xAxis}"]))
  .range([0, innerW])
  .padding(0.1);

const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => +d["${yAxis}"])])
  .nice()
  .range([innerH, 0]);

g.append("g")
  .attr("transform", \`translate(0,\${innerH})\`)
  .call(d3.axisBottom(x))
  .selectAll("text")
  .attr("transform", "rotate(-45)")
  .style("text-anchor", "end");

g.append("g").call(d3.axisLeft(y));

const line = d3.line()
  .x(d => x(d["${xAxis}"]) + x.bandwidth() / 2)
  .y(d => y(+d["${yAxis}"]))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", "none")
  .attr("stroke", "#3b82f6")
  .attr("stroke-width", 2)
  .attr("d", line);

g.selectAll("circle")
  .data(data)
  .join("circle")
  .attr("cx", d => x(d["${xAxis}"]) + x.bandwidth() / 2)
  .attr("cy", d => y(+d["${yAxis}"]))
  .attr("r", 3)
  .attr("fill", "#3b82f6");`;

    case 'area':
      return `${header}
const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleBand()
  .domain(data.map(d => d["${xAxis}"]))
  .range([0, innerW])
  .padding(0.1);

const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => +d["${yAxis}"])])
  .nice()
  .range([innerH, 0]);

g.append("g")
  .attr("transform", \`translate(0,\${innerH})\`)
  .call(d3.axisBottom(x))
  .selectAll("text")
  .attr("transform", "rotate(-45)")
  .style("text-anchor", "end");

g.append("g").call(d3.axisLeft(y));

// Gradient fill
const defs = svg.append("defs");
const gradient = defs.append("linearGradient")
  .attr("id", "areaGradient")
  .attr("x1", "0").attr("y1", "0")
  .attr("x2", "0").attr("y2", "1");
gradient.append("stop").attr("offset", "5%")
  .attr("stop-color", "#3b82f6").attr("stop-opacity", 0.3);
gradient.append("stop").attr("offset", "95%")
  .attr("stop-color", "#3b82f6").attr("stop-opacity", 0);

const area = d3.area()
  .x(d => x(d["${xAxis}"]) + x.bandwidth() / 2)
  .y0(innerH)
  .y1(d => y(+d["${yAxis}"]))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", "url(#areaGradient)")
  .attr("d", area);

const line = d3.line()
  .x(d => x(d["${xAxis}"]) + x.bandwidth() / 2)
  .y(d => y(+d["${yAxis}"]))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", "none")
  .attr("stroke", "#3b82f6")
  .attr("stroke-width", 2)
  .attr("d", line);`;

    case 'scatter':
      return `${header}
const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain(d3.extent(data, d => +d["${xAxis}"]))
  .nice()
  .range([0, innerW]);

const y = d3.scaleLinear()
  .domain(d3.extent(data, d => +d["${yAxis}"]))
  .nice()
  .range([innerH, 0]);

g.append("g")
  .attr("transform", \`translate(0,\${innerH})\`)
  .call(d3.axisBottom(x));

g.append("g").call(d3.axisLeft(y));

g.selectAll("circle")
  .data(data)
  .join("circle")
  .attr("cx", d => x(+d["${xAxis}"]))
  .attr("cy", d => y(+d["${yAxis}"]))
  .attr("r", 4)
  .attr("fill", "#3b82f6")
  .attr("opacity", 0.7);`;

    case 'pie':
      return `// Create a pie chart of "${yAxis}" by "${xAxis}" using D3.js
const width = 500;
const height = 500;
const radius = Math.min(width, height) / 2 - 40;

const svg = d3.select("#chart")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .append("g")
  .attr("transform", \`translate(\${width / 2},\${height / 2})\`);

const color = d3.scaleOrdinal()
  .domain(data.map(d => d["${xAxis}"]))
  .range(d3.schemeTableau10);

const pie = d3.pie()
  .value(d => +d["${yAxis}"])
  .sort(null);

const arc = d3.arc()
  .innerRadius(0)
  .outerRadius(radius);

const labelArc = d3.arc()
  .innerRadius(radius * 0.65)
  .outerRadius(radius * 0.65);

svg.selectAll("path")
  .data(pie(data))
  .join("path")
  .attr("d", arc)
  .attr("fill", d => color(d.data["${xAxis}"]))
  .attr("stroke", "#fff")
  .attr("stroke-width", 2);

svg.selectAll("text")
  .data(pie(data))
  .join("text")
  .attr("transform", d => \`translate(\${labelArc.centroid(d)})\`)
  .attr("text-anchor", "middle")
  .attr("font-size", "11px")
  .text(d => d.data["${xAxis}"]);`;

    default:
      return `${header}
// Unsupported chart type: "${type}"
// Configure a valid chart type (bar, line, area, scatter, pie)`;
  }
}

function generateDataSourceCode(config: Record<string, unknown>): string {
  const { fileName } = config;

  if (!fileName) {
    return `// Data Source — upload a CSV file to generate code
const data = await d3.csv("your-file.csv", d3.autoType);`;
  }

  return `// Load data from "${fileName}"
const data = await d3.csv(${JSON.stringify(fileName)}, d3.autoType);`;
}
