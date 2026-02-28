import type { ComponentType } from 'react';
import type { NodeTypes } from '@xyflow/react';
import type { NodeType, NodeTypeInfo, NodeTypeToData } from '@/types';
import { DataSourceNode } from './data/DataSourceNode';
import { FilterNode } from './data/FilterNode';
import { GroupByNode } from './data/GroupByNode';
import { SortNode } from './data/SortNode';
import { SelectNode } from './data/SelectNode';
import { TransformNode } from './data/TransformNode';
import { ChartNode } from './data/ChartNode';
import { ComputedColumnNode } from './data/ComputedColumnNode';
import { ReshapeNode } from './data/ReshapeNode';
import { AiQueryNode } from './ai/AiQueryNode';
import { AiAdvisorNode } from './ai/AiAdvisorNode';
import { AiCallButton } from './ai/AiCallButton';
import { AiErrorAlert } from './ai/AiErrorAlert';
import { AiSuggestionList } from './ai/AiSuggestionList';
import { NodeCodePreview } from './core/NodeCodePreview';

type NodeComponent = ComponentType<any>;

interface NodeDef<TType extends NodeType> {
  type: TType;
  component: NodeComponent;
  label: string;
  description: string;
  icon: string;
  defaultData: Partial<NodeTypeToData[TType]>;
  inputs: number;
  outputs: number;
}

export const NODE_DEFS: Record<NodeType, NodeDef<NodeType>> = {
  dataSource: {
    type: 'dataSource',
    component: DataSourceNode,
    label: 'Data Source',
    description: 'Load data from CSV or JSON',
    icon: 'table',
    defaultData: { state: 'proposed', label: 'Data Source' },
    inputs: 0,
    outputs: 1,
  },
  filter: {
    type: 'filter',
    component: FilterNode,
    label: 'Filter',
    description: 'Filter rows by condition',
    icon: 'filter',
    defaultData: { state: 'proposed', label: 'Filter', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  groupBy: {
    type: 'groupBy',
    component: GroupByNode,
    label: 'Group By',
    description: 'Aggregate data by column',
    icon: 'layers',
    defaultData: { state: 'proposed', label: 'Group By', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  sort: {
    type: 'sort',
    component: SortNode,
    label: 'Sort',
    description: 'Sort by column',
    icon: 'arrowUpDown',
    defaultData: { state: 'proposed', label: 'Sort', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  select: {
    type: 'select',
    component: SelectNode,
    label: 'Select',
    description: 'Choose specific columns',
    icon: 'columns3',
    defaultData: { state: 'proposed', label: 'Select', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  transform: {
    type: 'transform',
    component: TransformNode,
    label: 'Transform',
    description: 'Custom code transformation',
    icon: 'code2',
    defaultData: { state: 'proposed', label: 'Transform' },
    inputs: 1,
    outputs: 1,
  },
  computedColumn: {
    type: 'computedColumn',
    component: ComputedColumnNode,
    label: 'Computed Column',
    description: 'Add a derived column',
    icon: 'calculator',
    defaultData: { state: 'proposed', label: 'Computed Column', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  reshape: {
    type: 'reshape',
    component: ReshapeNode,
    label: 'Reshape',
    description: 'Unpivot wide → long data',
    icon: 'flipVertical2',
    defaultData: { state: 'proposed', label: 'Reshape', isCodeMode: true },
    inputs: 1,
    outputs: 1,
  },
  chart: {
    type: 'chart',
    component: ChartNode,
    label: 'Chart',
    description: 'Render visualization',
    icon: 'barChart3',
    defaultData: { state: 'proposed', label: 'Chart', isCodeMode: true },
    inputs: 1,
    outputs: 0,
  },
  aiQuery: {
    type: 'aiQuery',
    component: AiQueryNode,
    label: 'Query with AI',
    description: 'Describe changes in natural language; connect nodes as context',
    icon: 'sparkles',
    defaultData: { state: 'confirmed', label: 'Query with AI' },
    inputs: 1,
    outputs: 0,
  },
  aiAdvisor: {
    type: 'aiAdvisor',
    component: AiAdvisorNode,
    label: 'Ask about nodes',
    description: 'Connect nodes and ask a question; get advice or next steps',
    icon: 'messageCircle',
    defaultData: { state: 'confirmed', label: 'Ask about nodes' },
    inputs: 1,
    outputs: 0,
  },
};

export const nodeTypes: NodeTypes = Object.fromEntries(
  Object.entries(NODE_DEFS).map(([type, def]) => [type, def.component])
);

export const nodeTypeInfos: NodeTypeInfo[] = Object.values(NODE_DEFS).map(
  ({ type, label, description, icon, defaultData, inputs, outputs }) => ({
    type,
    label,
    description,
    icon,
    defaultData,
    inputs,
    outputs,
  })
);

export { AiCallButton, AiErrorAlert, AiSuggestionList, NodeCodePreview };
