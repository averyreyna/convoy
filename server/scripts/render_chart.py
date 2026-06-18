#!/usr/bin/env python3
"""
Render a chart with matplotlib. Used by the Convoy server for in-app chart preview.

Two modes:
  * one-shot (default): reads a single JSON payload from stdin, writes one JSON
    result to stdout, exits. Kept for direct/CLI use and backward compatibility.
  * worker (`--serve`): a long-lived process that reads newline-delimited JSON
    requests from stdin and writes newline-delimited JSON responses to stdout,
    one per line. matplotlib is imported once at startup, so each render avoids
    interpreter + library cold-start. JSON encoding escapes embedded newlines
    (e.g. inside SVG), so line framing is safe in both directions.

Payload: { "chartType", "xAxis", "yAxis", "colorBy?", "data": [...], "width", "height", "format": "png"|"svg" }
Result:  { "image": "<base64 or SVG string>" } or { "error": "..." }
"""
import json
import sys
import base64
import io
import contextlib

# non-interactive backend for server use
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

CHART_COLORS = [
    '#3b82f6',  # blue.500
    '#10b981',  # emerald.500
    '#f59e0b',  # amber.500
    '#ef4444',  # red.500
    '#2563eb',  # blue.600
    '#059669',  # emerald.600
    '#d97706',  # amber.600
    '#dc2626',  # red.600
]


def get_num(d, key):
    v = d.get(key)
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def get_str(d, key):
    v = d.get(key)
    if v is None:
        return ''
    return str(v)


def build_response(payload):
    """Render a chart from a payload dict and return a result dict.

    Returns {"image": ...} on success or {"error": ...} on any failure. Never
    prints or exits, so it is safe to call repeatedly from the worker loop.
    """
    chart_type = (payload.get("chartType") or "bar").lower()
    x_axis = payload.get("xAxis") or ""
    y_axis = payload.get("yAxis") or ""
    color_by = payload.get("colorBy")
    data = payload.get("data")
    width = int(payload.get("width") or 800)
    height = int(payload.get("height") or 500)
    fmt = (payload.get("format") or "png").lower()
    if fmt not in ("png", "svg"):
        fmt = "png"

    if not x_axis or not y_axis:
        return {"error": "Missing xAxis or yAxis"}
    if not data or not isinstance(data, list):
        return {"error": "Missing or invalid data"}

    # Extract column arrays from list of dicts
    try:
        x_vals = [get_str(d, x_axis) if not isinstance(d.get(x_axis), (int, float)) else d.get(x_axis) for d in data]
        y_vals = [get_num(d, y_axis) for d in data]
    except Exception as e:
        return {"error": f"Data extraction failed: {e}"}

    if not y_vals:
        return {"error": "No valid y values"}

    # Figure size in inches (matplotlib uses ~100 dpi by default for display)
    dpi = 100
    fig_w = width / dpi
    fig_h = height / dpi
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=dpi)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    if chart_type == 'pie':
        # Limit for readability
        pie_data = list(zip(x_vals, y_vals))[:12]
        labels = [str(p[0]) for p in pie_data]
        sizes = [p[1] for p in pie_data]
        colors = CHART_COLORS[:len(pie_data)]
        ax.pie(sizes, labels=labels, autopct='%1.1f%%', colors=colors, startangle=90)
        ax.axis('equal')
    elif chart_type == 'bar':
        if color_by:
            groups = {}
            for i, d in enumerate(data):
                key = get_str(d, color_by)
                if key not in groups:
                    groups[key] = ([], [])
                groups[key][0].append(get_str(d, x_axis) if i < len(x_vals) else '')
                groups[key][1].append(get_num(d, y_axis))
            x_cats = list(x_vals)
            n_groups = len(groups)
            width_bar = 0.8 / max(n_groups, 1)
            for j, (label, (xs, ys)) in enumerate(groups.items()):
                pos = [i + j * width_bar for i in range(len(xs))]
                ax.bar(pos, ys, width=width_bar, label=label, color=CHART_COLORS[j % len(CHART_COLORS)])
            ax.set_xticks([i + (n_groups - 1) * width_bar / 2 for i in range(len(x_cats))])
            ax.set_xticklabels(x_cats[:len(ax.get_xticks())] if len(x_cats) >= len(ax.get_xticks()) else x_cats, rotation=45, ha='right')
            ax.legend()
        else:
            x_cats = [str(x) for x in x_vals]
            ax.bar(range(len(x_cats)), y_vals, color=CHART_COLORS[0])
            ax.set_xticks(range(len(x_cats)))
            ax.set_xticklabels(x_cats, rotation=45, ha='right')
        ax.set_xlabel(x_axis)
        ax.set_ylabel(y_axis)
    elif chart_type == 'line':
        x_numeric = []
        for i, x in enumerate(x_vals):
            if isinstance(x, (int, float)):
                x_numeric.append(float(x))
            elif isinstance(x, str) and x.strip():
                try:
                    x_numeric.append(float(x))
                except (ValueError, TypeError):
                    x_numeric.append(i)
            else:
                x_numeric.append(i)
        if all(isinstance(x, str) for x in x_vals):
            x_numeric = list(range(len(x_vals)))
        ax.plot(x_numeric, y_vals, color=CHART_COLORS[0], linewidth=2)
        ax.set_xlabel(x_axis)
        ax.set_ylabel(y_axis)
        if all(isinstance(x, str) for x in x_vals) and x_vals:
            ax.set_xticks(range(len(x_vals)))
            ax.set_xticklabels(x_vals, rotation=45, ha='right')
    elif chart_type == 'area':
        x_numeric = list(range(len(y_vals)))
        ax.fill_between(x_numeric, y_vals, alpha=0.3, color=CHART_COLORS[0])
        ax.plot(x_numeric, y_vals, color=CHART_COLORS[0], linewidth=2)
        ax.set_xlabel(x_axis)
        ax.set_ylabel(y_axis)
    elif chart_type == 'scatter':
        x_nums = [get_num(d, x_axis) for d in data]
        ax.scatter(x_nums, y_vals, color=CHART_COLORS[0], alpha=0.7)
        ax.set_xlabel(x_axis)
        ax.set_ylabel(y_axis)
    else:
        # default bar
        x_cats = [str(x) for x in x_vals]
        ax.bar(range(len(x_cats)), y_vals, color=CHART_COLORS[0])
        ax.set_xticks(range(len(x_cats)))
        ax.set_xticklabels(x_cats, rotation=45, ha='right')
        ax.set_xlabel(x_axis)
        ax.set_ylabel(y_axis)

    plt.tight_layout()

    try:
        buf = io.BytesIO()
        if fmt == 'svg':
            fig.savefig(buf, format='svg', bbox_inches='tight', facecolor='white')
            return {"image": buf.getvalue().decode('utf-8')}
        fig.savefig(buf, format='png', bbox_inches='tight', facecolor='white', dpi=dpi)
        b64 = base64.b64encode(buf.getvalue()).decode('ascii')
        return {"image": f"data:image/png;base64,{b64}"}
    finally:
        # Always release the figure so a long-lived worker doesn't leak memory.
        plt.close(fig)


def respond(payload):
    """Render and return a result dict, converting any unexpected error to a result."""
    try:
        return build_response(payload)
    except Exception as e:  # defensive: keep the worker alive on bad input
        return {"error": f"Render failed: {e}"}


def main():
    """One-shot mode: a single payload on stdin, a single result on stdout."""
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        return
    print(json.dumps(respond(payload)))


def serve():
    """Worker mode: newline-delimited JSON requests in, results out, one per line."""
    # Responses go to the real stdout; guard rendering so any stray library
    # output to stdout cannot corrupt the line-framed protocol.
    out = sys.stdout
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            with contextlib.redirect_stdout(sys.stderr):
                result = respond(payload)
        except json.JSONDecodeError as e:
            result = {"error": f"Invalid JSON: {e}"}
        out.write(json.dumps(result))
        out.write("\n")
        out.flush()


if __name__ == '__main__':
    if '--serve' in sys.argv[1:]:
        serve()
    else:
        main()
