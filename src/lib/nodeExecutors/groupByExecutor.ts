export interface GroupByConfig {
  groupByColumn?: string;
  aggregateColumn?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}
