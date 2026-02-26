/**
 * Computed column execution is done in Python via codeGenerators + pythonRunner.
 * This file only exports the config type for the node.
 */
export interface ComputedColumnConfig {
  newColumnName?: string;
  expression?: string;
}
