export type NodeState = 'proposed' | 'confirmed' | 'running' | 'error';

export interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}

export interface DataFrame {
  columns: Column[];
  rows: Record<string, unknown>[];
}

export interface BaseNodeData {
  state: NodeState;
  label: string;
  isCodeMode?: boolean;
  customCode?: string;
  error?: string;
}

export interface DataSourceNodeData extends BaseNodeData {
  fileName?: string;
  rowCount?: number;
  columns?: Column[];
}

export interface FilterNodeData extends BaseNodeData {
  column?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'startsWith';
  value?: string;
  inputRowCount?: number;
  outputRowCount?: number;
}

export interface GroupByNodeData extends BaseNodeData {
  groupByColumn?: string;
  aggregateColumn?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  inputRowCount?: number;
  outputRowCount?: number;
}

export interface SortNodeData extends BaseNodeData {
  column?: string;
  direction?: 'asc' | 'desc';
  inputRowCount?: number;
  outputRowCount?: number;
}

export interface SelectNodeData extends BaseNodeData {
  columns?: string[];
  inputRowCount?: number;
  outputRowCount?: number;
}

export interface ChartNodeData extends BaseNodeData {
  chartType?: 'bar' | 'line' | 'area' | 'scatter' | 'pie';
  xAxis?: string;
  yAxis?: string;
  colorBy?: string;
}

export interface ComputedColumnNodeData extends BaseNodeData {
  newColumnName?: string;
  expression?: string;
  inputRowCount?: number;
  outputRowCount?: number;
}

export interface ReshapeNodeData extends BaseNodeData {
  keyColumn?: string;
  valueColumn?: string;
  pivotColumns?: string[];
  inputRowCount?: number;
  outputRowCount?: number;
}

export interface AiAdvisorNodeData extends BaseNodeData {
  question?: string;
  answer?: string;
}

export type ConvoyNodeData =
  | DataSourceNodeData
  | FilterNodeData
  | GroupByNodeData
  | SortNodeData
  | SelectNodeData
  | ChartNodeData
  | ComputedColumnNodeData
  | ReshapeNodeData
  | AiAdvisorNodeData;

export interface ProposedPipeline {
  nodes: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  explanation: string;
}

export interface ImportFromPythonResponse {
  pipeline: ProposedPipeline;
  method?: 'ast' | 'llm';
}

export interface NodeTypeInfo {
  type: string;
  label: string;
  description: string;
  icon: string;
  defaultData: Partial<ConvoyNodeData>;
  inputs: number;
  outputs: number;
}

// Edit-nodes API (shared with server)
export interface EditNodesSchema {
  columns: Array<{ name: string; type: string }>;
}

export interface EditNodesPipelineContext {
  nodes: Array<{
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

export interface EditNodesRequestBody {
  nodeIds: string[];
  prompt: string;
  schema?: EditNodesSchema;
  pipelineContext?: EditNodesPipelineContext;
}

/** A single node in an AI-suggested pipeline fragment (replaces selection). */
export interface SuggestedPipelineNode {
  type: string;
  config?: Record<string, unknown>;
  customCode?: string;
  label?: string;
}

export interface EditNodesResponse {
  /** @deprecated Use suggestedPipeline. Per-node patches keyed by existing node ID. */
  updates?: Record<string, { config?: Record<string, unknown>; customCode?: string }>;
  /** Ordered list of nodes that replace the selection; edges are implicit (chain). */
  suggestedPipeline?: { nodes: SuggestedPipelineNode[] };
  explanation?: string;
}

/** Response from POST /api/answer-about-nodes (advice about connected nodes). */
export interface AnswerAboutNodesResponse {
  answer: string;
}
