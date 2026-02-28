# Nodes

Node components in this folder render Convoy’s React Flow nodes and wire them to the canvas and data stores.

## Folder layout

- `core/` – shared primitives used by many node types:
  - `BaseNode` – shared chrome, handles, header, and state badges.
  - `DataPreview` – collapsible table preview for node outputs.
  - `CodeView` – shared code editor/toggle for nodes with code.
  - `NodeCodePreview` – small, read-only code preview block.
  - `ExplanationPopover` – AI explanation popover for supported nodes.
  - `ChartPreviewModal` – full-screen chart preview/export.
- `data/` – data-manipulation and charting nodes:
  - `DataSourceNode`, `FilterNode`, `GroupByNode`, `SortNode`, `SelectNode`,
    `TransformNode`, `ComputedColumnNode`, `ReshapeNode`, `ChartNode`.
- `ai/` – AI-specific nodes and helpers:
  - `AiQueryNode`, `AiAdvisorNode`, `AiCallButton`, `AiErrorAlert`, `AiSuggestionList`.
  - These compose `core` primitives and the helpers in `src/lib/aiNodes.ts`.

`src/components/nodes/index.ts` exposes `NODE_DEFS`, `nodeTypes`, and `nodeTypeInfos`
so most callers can import from `@/components/nodes` without knowing the folder layout.

## BaseNode

`BaseNode` (in `core/`) provides the shared chrome for all nodes:

- Card layout and selected state
- Input/output handles
- Header with icon, title, and state badges
- Optional AI explanation trigger based on `nodeType` and `nodeConfig`

Individual nodes pass their configuration and children to `BaseNode` rather than duplicating layout.

## Data typing

Node `data` shapes are defined in `src/types` as `XNodeData` interfaces (e.g. `FilterNodeData`, `ChartNodeData`, `AiQueryNodeData`).

- `BaseNodeData` captures shared fields like `state`, `label`, and `customCode`.
- `NodeTypeToData` maps React Flow `type` strings (e.g. `'filter'`, `'chart'`, `'aiQuery'`) to their data interfaces.
- `ConvoyNodeData` is the union of all node data types.

When authoring node components, prefer `NodeProps & { data: XNodeData }` so `data`
is strongly typed inside the component.

## Hooks

Shared hooks in `nodes/hooks.ts` encapsulate common canvas wiring:

- `useNodeContext(nodeId)` – IDs of upstream nodes connected to `nodeId`.
- `useDataSourceSchema()` – schema from the first confirmed `dataSource` node.
- `usePipelineContext()` – `{ nodes, edges }` in the shape expected by AI routes.
- `useNodeUpdate<TData>(nodeId)` – typed wrapper around `canvasStore.updateNode`.

Prefer these hooks over duplicating store access logic inside each node.

## Node registry

`nodes/index.ts` defines a single `NODE_DEFS` configuration:

- `type` – React Flow node type string.
- `component` – React component for the node.
- `label`, `description`, `icon` – palette metadata.
- `defaultData` – typed defaults for the node’s `data`.
- `inputs`, `outputs` – handle counts.

From `NODE_DEFS` we derive:

- `nodeTypes` – mapping from type string to component for React Flow.
- `nodeTypeInfos` – metadata for the NodePalette.

To add a new node type, create the component and its `XNodeData` type, then add an entry to `NODE_DEFS`.

## AI nodes and code preview

AI-related helpers live in `src/lib/aiNodes.ts` and small UI components under `nodes/ai`:

- `AiCallButton` – primary button with built‑in loading state.
- `AiErrorAlert` – standardized error presentation.
- `AiSuggestionList` – renders AI-suggested nodes with `NodeCodePreview`.

`AiQueryNode` and `AiAdvisorNode` use these helpers so that AI calls and UI patterns stay consistent.

