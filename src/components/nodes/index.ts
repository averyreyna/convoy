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
    defaultData: { state: 'proposed', label: 'Filter' },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'groupBy',
    label: 'Group By',
    description: 'Aggregate data by column',
    icon: 'layers',
    defaultData: { state: 'proposed', label: 'Group By' },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'sort',
    label: 'Sort',
    description: 'Sort by column',
    icon: 'arrowUpDown',
    defaultData: { state: 'proposed', label: 'Sort' },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'select',
    label: 'Select',
    description: 'Choose specific columns',
    icon: 'columns3',
    defaultData: { state: 'proposed', label: 'Select' },
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
    defaultData: { state: 'proposed', label: 'Computed Column' },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'reshape',
    label: 'Reshape',
    description: 'Unpivot wide → long data',
    icon: 'flipVertical2',
    defaultData: { state: 'proposed', label: 'Reshape' },
    inputs: 1,
    outputs: 1,
  },
  {
    type: 'chart',
    label: 'Chart',
    description: 'Render visualization',
    icon: 'barChart3',
    defaultData: { state: 'proposed', label: 'Chart' },
    inputs: 1,
    outputs: 0,
  },
];
