import type { NodeTypes } from '@xyflow/react';
import type { NodeTypeInfo } from '@/types';
import { DataSourceNode } from './DataSourceNode';
import { FilterNode } from './FilterNode';
import { GroupByNode } from './GroupByNode';
import { SortNode } from './SortNode';
import { SelectNode } from './SelectNode';
import { TransformNode } from './TransformNode';
import { ChartNode } from './ChartNode';
import { ComputedColumnNode } from './ComputedColumnNode';
import { ReshapeNode } from './ReshapeNode';
import { AiQueryNode } from './AiQueryNode';
import { AiAdvisorNode } from './AiAdvisorNode';

/**
 * Registry of all custom node types for React Flow.
 */
export const nodeTypes: NodeTypes = {
  dataSource: DataSourceNode,
  filter: FilterNode,
  groupBy: GroupByNode,
  sort: SortNode,
  select: SelectNode,
  transform: TransformNode,
  chart: ChartNode,
  computedColumn: ComputedColumnNode,
  reshape: ReshapeNode,
  aiQuery: AiQueryNode,
  aiAdvisor: AiAdvisorNode,
};

/**
 * Node type metadata used by the NodePalette sidebar.
 */
export const nodeTypeInfos: NodeTypeInfo[] = [
  {
    type: 'dataSource',
    label: 'Data Source',
    description: 'Load data from CSV or JSON',
    icon: 'table',
    defaultData: { state: 'proposed', label: 'Data Source' },
    inputs: 0,
    outputs: 1,
  },
  {
    type: 'filter',
    label: 'Filter',
    description: 'Filter rows by condition',
    icon: 'filter',
    defaultData: { state: 'proposed', label: 'Filter', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'groupBy',
    label: 'Group By',
    description: 'Aggregate data by column',
    icon: 'layers',
    defaultData: { state: 'proposed', label: 'Group By', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'sort',
    label: 'Sort',
    description: 'Sort by column',
    icon: 'arrowUpDown',
    defaultData: { state: 'proposed', label: 'Sort', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'select',
    label: 'Select',
    description: 'Choose specific columns',
    icon: 'columns3',
    defaultData: { state: 'proposed', label: 'Select', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'transform',
    label: 'Transform',
    description: 'Custom code transformation',
    icon: 'code2',
    defaultData: { state: 'proposed', label: 'Transform' },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'computedColumn',
    label: 'Computed Column',
    description: 'Add a derived column',
    icon: 'calculator',
    defaultData: { state: 'proposed', label: 'Computed Column', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'reshape',
    label: 'Reshape',
    description: 'Unpivot wide → long data',
    icon: 'flipVertical2',
    defaultData: { state: 'proposed', label: 'Reshape', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'chart',
    label: 'Chart',
    description: 'Render visualization',
    icon: 'barChart3',
    defaultData: { state: 'proposed', label: 'Chart', isCodeMode: true },
    inputs: 1,
    outputs: 0,
  },
  {
    type: 'aiQuery',
    label: 'Query with AI',
    description: 'Describe changes in natural language; connect nodes as context',
    icon: 'sparkles',
    defaultData: { state: 'confirmed', label: 'Query with AI' },
    inputs: 1,
    outputs: 0,
  },
  {
    type: 'aiAdvisor',
    label: 'Ask about nodes',
    description: 'Connect nodes and ask a question; get advice or next steps',
    icon: 'messageCircle',
    defaultData: { state: 'confirmed', label: 'Ask about nodes' },
    inputs: 1,
    outputs: 0,
  },
];
