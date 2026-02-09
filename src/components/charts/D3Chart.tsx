import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export interface D3ChartProps {
  chartType: string;
  data: Record<string, unknown>[];
  xAxis: string;
  yAxis: string;
  colorBy?: string;
  height?: number;
  /** When true, the chart fills 100% of its container */
  responsive?: boolean;
}

export function D3Chart({
  chartType,
  data,
  xAxis,
  yAxis,
  colorBy,
  height: fixedHeight,
  responsive = false,
}: D3ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Track container size with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: containerHeight } = entry.contentRect;
        setDimensions({
          width,
          height: fixedHeight ?? containerHeight,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [fixedHeight]);

  // Tooltip helpers
  const showTooltip = useCallback(
    (event: MouseEvent, content: string) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.offsetX + 12}px`;
      tooltip.style.top = `${event.offsetY - 10}px`;
      tooltip.innerHTML = content;
    },
    []
  );

  const hideTooltip = useCallback(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    tooltip.style.opacity = '0';
  }, []);

  // Main render effect
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;
    if (!xAxis || !yAxis || data.length === 0) return;

    // Clear previous content
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    svg.attr('width', width).attr('height', height);

    if (chartType === 'pie') {
      renderPie(svg, data, xAxis, yAxis, width, height, showTooltip, hideTooltip);
    } else {
      const margin = { top: 16, right: 20, bottom: 70, left: 50 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      if (innerW <= 0 || innerH <= 0) return;

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      switch (chartType) {
        case 'bar':
          renderBar(g, data, xAxis, yAxis, colorBy, innerW, innerH, showTooltip, hideTooltip);
          break;
        case 'line':
          renderLine(g, data, xAxis, yAxis, innerW, innerH, showTooltip, hideTooltip);
          break;
        case 'area':
          renderArea(g, data, xAxis, yAxis, innerW, innerH, svg, showTooltip, hideTooltip);
          break;
        case 'scatter':
          renderScatter(g, data, xAxis, yAxis, innerW, innerH, showTooltip, hideTooltip);
          break;
        default:
          renderBar(g, data, xAxis, yAxis, colorBy, innerW, innerH, showTooltip, hideTooltip);
      }
    }

    // Legend
    renderLegend(svg, chartType, data, xAxis, yAxis, colorBy, width, height);
  }, [data, xAxis, yAxis, chartType, colorBy, dimensions, showTooltip, hideTooltip]);

  const containerStyle: React.CSSProperties = responsive
    ? { width: '100%', height: '100%', position: 'relative' }
    : { width: '100%', height: fixedHeight ?? 280, position: 'relative' };

  return (
    <div ref={containerRef} style={containerStyle}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          padding: '6px 10px',
          fontSize: 12,
          zIndex: 10,
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
      />
    </div>
  );
}

// ─── Axes helpers ────────────────────────────────────────────────────────────

function addXAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleBand<string> | d3.ScaleLinear<number, number>,
  innerH: number,
  label: string
) {
  const axis =
    'bandwidth' in scale
      ? d3.axisBottom(scale as d3.ScaleBand<string>)
      : d3.axisBottom(scale as d3.ScaleLinear<number, number>).ticks(6);

  const axisG = g
    .append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(axis);

  axisG
    .selectAll('text')
    .attr('font-size', '9px')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  axisG.selectAll('line, path').attr('stroke', '#d1d5db');

  // Label
  g.append('text')
    .attr('x', ('bandwidth' in scale ? scale.range()[1] : (scale as d3.ScaleLinear<number, number>).range()[1]) / 2)
    .attr('y', innerH + 58)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#6b7280')
    .text(label);
}

function addYAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleLinear<number, number>,
  innerH: number,
  label: string
) {
  const axisG = g.append('g').call(d3.axisLeft(scale).ticks(5));

  axisG.selectAll('text').attr('font-size', '10px');
  axisG.selectAll('line, path').attr('stroke', '#d1d5db');

  // Grid lines
  g.append('g')
    .attr('class', 'grid')
    .call(
      d3
        .axisLeft(scale)
        .ticks(5)
        .tickSize(-g.node()!.parentElement!.clientWidth + 70)
        .tickFormat(() => '')
    )
    .selectAll('line')
    .attr('stroke', '#f0f0f0')
    .attr('stroke-dasharray', '3 3');
  g.select('.grid path').attr('stroke', 'none');

  // Label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#6b7280')
    .text(label);
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

function renderBar(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  colorBy: string | undefined,
  innerW: number,
  innerH: number,
  showTooltip: (event: MouseEvent, content: string) => void,
  hideTooltip: () => void
) {
  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => String(d[xAxis] ?? '')))
    .range([0, innerW])
    .padding(0.2);

  const yMax = d3.max(data, (d) => Number(d[yAxis]) || 0) ?? 0;
  const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  addXAxis(g, xScale, innerH, xAxis);
  addYAxis(g, yScale, innerH, yAxis);

  // Color scale for colorBy
  const colorGroups = colorBy
    ? [...new Set(data.map((d) => String(d[colorBy] ?? '')))]
    : [];
  const colorScale = d3.scaleOrdinal<string>().domain(colorGroups).range(CHART_COLORS);

  g.selectAll('rect.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(String(d[xAxis] ?? '')) ?? 0)
    .attr('y', (d) => yScale(Number(d[yAxis]) || 0))
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => innerH - yScale(Number(d[yAxis]) || 0))
    .attr('rx', 3)
    .attr('fill', (d) =>
      colorBy && colorGroups.length > 0
        ? colorScale(String(d[colorBy] ?? ''))
        : CHART_COLORS[0]
    )
    .style('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: Record<string, unknown>) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(
        event,
        `<strong>${xAxis}:</strong> ${d[xAxis]}<br/><strong>${yAxis}:</strong> ${d[yAxis]}`
      );
    })
    .on('mousemove', function (event: MouseEvent) {
      const tooltip = (g.node()!.closest('div') as HTMLElement)?.querySelector(
        '[style*="pointer-events: none"]'
      ) as HTMLElement | null;
      if (tooltip) {
        tooltip.style.left = `${event.offsetX + 12}px`;
        tooltip.style.top = `${event.offsetY - 10}px`;
      }
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    });
}

// ─── Line chart ──────────────────────────────────────────────────────────────

function renderLine(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  innerW: number,
  innerH: number,
  showTooltip: (event: MouseEvent, content: string) => void,
  hideTooltip: () => void
) {
  // Determine if x values are numeric
  const allNumericX = data.every((d) => !isNaN(Number(d[xAxis])));

  let xScale: d3.ScaleBand<string> | d3.ScaleLinear<number, number>;
  let getX: (d: Record<string, unknown>) => number;

  if (allNumericX) {
    const xExtent = d3.extent(data, (d) => Number(d[xAxis])) as [number, number];
    const linearX = d3.scaleLinear().domain(xExtent).nice().range([0, innerW]);
    xScale = linearX;
    getX = (d) => linearX(Number(d[xAxis]));
  } else {
    const bandX = d3
      .scaleBand()
      .domain(data.map((d) => String(d[xAxis] ?? '')))
      .range([0, innerW])
      .padding(0.1);
    xScale = bandX;
    getX = (d) => (bandX(String(d[xAxis] ?? '')) ?? 0) + bandX.bandwidth() / 2;
  }

  const yMax = d3.max(data, (d) => Number(d[yAxis]) || 0) ?? 0;
  const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  addXAxis(g, xScale, innerH, xAxis);
  addYAxis(g, yScale, innerH, yAxis);

  // Line
  const line = d3
    .line<Record<string, unknown>>()
    .x((d) => getX(d))
    .y((d) => yScale(Number(d[yAxis]) || 0))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', CHART_COLORS[0])
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  g.selectAll('circle.dot')
    .data(data)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', (d) => getX(d))
    .attr('cy', (d) => yScale(Number(d[yAxis]) || 0))
    .attr('r', 3)
    .attr('fill', CHART_COLORS[0])
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: Record<string, unknown>) {
      d3.select(this).attr('r', 5);
      showTooltip(
        event,
        `<strong>${xAxis}:</strong> ${d[xAxis]}<br/><strong>${yAxis}:</strong> ${d[yAxis]}`
      );
    })
    .on('mouseout', function () {
      d3.select(this).attr('r', 3);
      hideTooltip();
    });
}

// ─── Area chart ──────────────────────────────────────────────────────────────

function renderArea(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  innerW: number,
  innerH: number,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  showTooltip: (event: MouseEvent, content: string) => void,
  hideTooltip: () => void
) {
  const allNumericX = data.every((d) => !isNaN(Number(d[xAxis])));

  let xScale: d3.ScaleBand<string> | d3.ScaleLinear<number, number>;
  let getX: (d: Record<string, unknown>) => number;

  if (allNumericX) {
    const xExtent = d3.extent(data, (d) => Number(d[xAxis])) as [number, number];
    const linearX = d3.scaleLinear().domain(xExtent).nice().range([0, innerW]);
    xScale = linearX;
    getX = (d) => linearX(Number(d[xAxis]));
  } else {
    const bandX = d3
      .scaleBand()
      .domain(data.map((d) => String(d[xAxis] ?? '')))
      .range([0, innerW])
      .padding(0.1);
    xScale = bandX;
    getX = (d) => (bandX(String(d[xAxis] ?? '')) ?? 0) + bandX.bandwidth() / 2;
  }

  const yMax = d3.max(data, (d) => Number(d[yAxis]) || 0) ?? 0;
  const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  addXAxis(g, xScale, innerH, xAxis);
  addYAxis(g, yScale, innerH, yAxis);

  // Gradient
  const gradientId = `area-gradient-${Math.random().toString(36).slice(2, 8)}`;
  const defs = svg.append('defs');
  const gradient = defs
    .append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0')
    .attr('y1', '0')
    .attr('x2', '0')
    .attr('y2', '1');
  gradient.append('stop').attr('offset', '5%').attr('stop-color', CHART_COLORS[0]).attr('stop-opacity', 0.3);
  gradient.append('stop').attr('offset', '95%').attr('stop-color', CHART_COLORS[0]).attr('stop-opacity', 0);

  // Area
  const area = d3
    .area<Record<string, unknown>>()
    .x((d) => getX(d))
    .y0(innerH)
    .y1((d) => yScale(Number(d[yAxis]) || 0))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', `url(#${gradientId})`)
    .attr('d', area);

  // Line on top
  const line = d3
    .line<Record<string, unknown>>()
    .x((d) => getX(d))
    .y((d) => yScale(Number(d[yAxis]) || 0))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', CHART_COLORS[0])
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  g.selectAll('circle.dot')
    .data(data)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', (d) => getX(d))
    .attr('cy', (d) => yScale(Number(d[yAxis]) || 0))
    .attr('r', 3)
    .attr('fill', CHART_COLORS[0])
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: Record<string, unknown>) {
      d3.select(this).attr('r', 5);
      showTooltip(
        event,
        `<strong>${xAxis}:</strong> ${d[xAxis]}<br/><strong>${yAxis}:</strong> ${d[yAxis]}`
      );
    })
    .on('mouseout', function () {
      d3.select(this).attr('r', 3);
      hideTooltip();
    });
}

// ─── Scatter chart ───────────────────────────────────────────────────────────

function renderScatter(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  innerW: number,
  innerH: number,
  showTooltip: (event: MouseEvent, content: string) => void,
  hideTooltip: () => void
) {
  const xExtent = d3.extent(data, (d) => Number(d[xAxis]) || 0) as [number, number];
  const yExtent = d3.extent(data, (d) => Number(d[yAxis]) || 0) as [number, number];

  const xScale = d3.scaleLinear().domain(xExtent).nice().range([0, innerW]);
  const yScale = d3.scaleLinear().domain(yExtent).nice().range([innerH, 0]);

  addXAxis(g, xScale, innerH, xAxis);
  addYAxis(g, yScale, innerH, yAxis);

  g.selectAll('circle.point')
    .data(data)
    .join('circle')
    .attr('class', 'point')
    .attr('cx', (d) => xScale(Number(d[xAxis]) || 0))
    .attr('cy', (d) => yScale(Number(d[yAxis]) || 0))
    .attr('r', 4)
    .attr('fill', CHART_COLORS[0])
    .attr('opacity', 0.7)
    .style('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: Record<string, unknown>) {
      d3.select(this).attr('r', 6).attr('opacity', 1);
      showTooltip(
        event,
        `<strong>${xAxis}:</strong> ${d[xAxis]}<br/><strong>${yAxis}:</strong> ${d[yAxis]}`
      );
    })
    .on('mouseout', function () {
      d3.select(this).attr('r', 4).attr('opacity', 0.7);
      hideTooltip();
    });
}

// ─── Pie chart ───────────────────────────────────────────────────────────────

function renderPie(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  width: number,
  height: number,
  showTooltip: (event: MouseEvent, content: string) => void,
  hideTooltip: () => void
) {
  const radius = Math.min(width, height) / 2 - 40;
  if (radius <= 0) return;

  const g = svg
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const pieData = data.slice(0, 12);
  const total = d3.sum(pieData, (d) => Number(d[yAxis]) || 0);

  const pie = d3
    .pie<Record<string, unknown>>()
    .value((d) => Number(d[yAxis]) || 0)
    .sort(null);

  const arc = d3
    .arc<d3.PieArcDatum<Record<string, unknown>>>()
    .innerRadius(0)
    .outerRadius(radius);

  const labelArc = d3
    .arc<d3.PieArcDatum<Record<string, unknown>>>()
    .innerRadius(radius * 0.65)
    .outerRadius(radius * 0.65);

  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(pieData.map((d) => String(d[xAxis] ?? '')))
    .range(CHART_COLORS);

  const slices = g
    .selectAll('path.slice')
    .data(pie(pieData))
    .join('path')
    .attr('class', 'slice')
    .attr('d', arc)
    .attr('fill', (d) => colorScale(String(d.data[xAxis] ?? '')))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer');

  slices
    .on('mouseover', function (event: MouseEvent, d: d3.PieArcDatum<Record<string, unknown>>) {
      d3.select(this).attr('opacity', 0.8);
      const pct = total > 0 ? ((Number(d.data[yAxis]) / total) * 100).toFixed(1) : '0';
      showTooltip(
        event,
        `<strong>${d.data[xAxis]}</strong><br/>${yAxis}: ${d.data[yAxis]} (${pct}%)`
      );
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    });

  // Labels
  g.selectAll('text.label')
    .data(pie(pieData))
    .join('text')
    .attr('class', 'label')
    .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .attr('fill', '#374151')
    .text((d) => {
      const pct = total > 0 ? ((Number(d.data[yAxis]) / total) * 100).toFixed(0) : '0';
      const angle = d.endAngle - d.startAngle;
      return angle > 0.3 ? `${pct}%` : '';
    });
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function renderLegend(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  chartType: string,
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  colorBy: string | undefined,
  width: number,
  height: number
) {
  if (chartType === 'pie') {
    // Pie legend: show category names
    const pieData = data.slice(0, 12);
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(pieData.map((d) => String(d[xAxis] ?? '')))
      .range(CHART_COLORS);

    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('font-size', '10px');

    const items = pieData.map((d) => String(d[xAxis] ?? ''));
    const itemWidth = 90;
    const cols = Math.max(1, Math.floor(width / itemWidth));
    const startX = (width - Math.min(items.length, cols) * itemWidth) / 2;

    items.forEach((label, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * itemWidth;
      const y = height - 18 + row * 16;

      legend
        .append('rect')
        .attr('x', x)
        .attr('y', y - 8)
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', colorScale(label));

      legend
        .append('text')
        .attr('x', x + 14)
        .attr('y', y)
        .attr('fill', '#6b7280')
        .text(label.length > 10 ? label.slice(0, 10) + '…' : label);
    });
  } else if (colorBy) {
    // Color-by legend for bar charts etc.
    const groups = [...new Set(data.map((d) => String(d[colorBy] ?? '')))];
    const colorScale = d3.scaleOrdinal<string>().domain(groups).range(CHART_COLORS);

    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('font-size', '10px');

    let xPos = width / 2 - (groups.length * 80) / 2;
    groups.forEach((label) => {
      legend
        .append('rect')
        .attr('x', xPos)
        .attr('y', 4)
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', colorScale(label));

      legend
        .append('text')
        .attr('x', xPos + 14)
        .attr('y', 13)
        .attr('fill', '#6b7280')
        .text(label);

      xPos += 80;
    });
  } else {
    // Simple single-series legend
    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('font-size', '10px');

    const labelText = yAxis;
    const textWidth = labelText.length * 6 + 20;
    const lx = (width - textWidth) / 2;

    legend
      .append('rect')
      .attr('x', lx)
      .attr('y', 4)
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('fill', CHART_COLORS[0]);

    legend
      .append('text')
      .attr('x', lx + 14)
      .attr('y', 13)
      .attr('fill', '#6b7280')
      .text(labelText);
  }
}

