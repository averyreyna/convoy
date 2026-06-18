/**
 * Whether a structured node's config (and optional customCode) is complete
 * enough to execute. Incomplete configs are treated as typed holes in live eval.
 */
export function isConfigComplete(
  nodeType: string,
  config: Record<string, unknown>,
  customCode?: string
): boolean {
  switch (nodeType) {
    case 'filter': {
      const { column, operator, value } = config;
      if (!column || !operator) return false;
      const valueStr =
        value !== undefined && value !== null ? String(value).trim() : '';
      const needValue = ['eq', 'neq', 'gt', 'lt', 'contains', 'startsWith'].includes(
        operator as string
      );
      return !needValue || valueStr !== '';
    }
    case 'groupBy': {
      const { groupByColumn, aggregation } = config;
      return !!(groupByColumn && aggregation);
    }
    case 'sort':
      return !!config.column;
    case 'select': {
      const cols = config.columns as string[] | undefined;
      return Array.isArray(cols) && cols.length > 0;
    }
    case 'transform':
      return !!(
        customCode &&
        typeof customCode === 'string' &&
        customCode.trim() !== ''
      );
    case 'computedColumn': {
      const { newColumnName, expression } = config;
      return !!(
        newColumnName &&
        expression &&
        String(expression).trim() !== ''
      );
    }
    case 'reshape': {
      const { keyColumn, valueColumn, pivotColumns } = config as {
        keyColumn?: string;
        valueColumn?: string;
        pivotColumns?: string[];
      };
      return !!(
        keyColumn &&
        valueColumn &&
        Array.isArray(pivotColumns) &&
        pivotColumns.length > 0
      );
    }
    default:
      return true;
  }
}
