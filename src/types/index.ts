// Node states
export type NodeState = 'proposed' | 'confirmed' | 'running' | 'error';

// Data types
export interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}

export interface DataFrame {
  columns: Column[];
  rows: Record<string, unknown>[];
}

// Base node data
export interface BaseNodeData {
  state: NodeState;
  label: string;
  isCodeMode?: boolean;
  customCode?: string;
  error?: string;
}

// Specific node data types
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
}

export interface SelectNodeData extends BaseNodeData {
  columns?: string[];
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

// Union type for all node data
export type ConvoyNodeData =
  | DataSourceNodeData
  | FilterNodeData
  | GroupByNodeData
  | SortNodeData
  | SelectNodeData
  | ChartNodeData
  | ComputedColumnNodeData
  | ReshapeNodeData;

// Pipeline from AI
export interface ProposedPipeline {
  nodes: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  explanation: string;
}

// Node type metadata for the palette
export interface NodeTypeInfo {
  type: string;
  label: string;
  description: string;
  icon: string;
  defaultData: Partial<ConvoyNodeData>;
  inputs: number;
  outputs: number;
}
