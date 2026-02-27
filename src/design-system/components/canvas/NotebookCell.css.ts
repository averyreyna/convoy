import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

/** Scrollable area that holds notebook cells; "paper" background. */
export const notebookScrollArea = style({
  flex: 1,
  overflow: 'auto',
  background: vars.color.gray[50],
  padding: vars.space[3],
});

/** Vertical list of cells with gap. */
export const notebookCellList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
});

/** Single cell: two-column row (gutter + content). */
export const notebookCell = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  background: vars.color.white,
  border: `1px solid ${vars.color.gray[200]}`,
  borderRadius: vars.radii.lg,
  borderLeftWidth: '4px',
  borderLeftColor: vars.color.gray[200],
  transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
  overflow: 'hidden',
});

/** Left border accent when cell is focused. */
export const notebookCellFocused = style({
  borderLeftColor: vars.color.blue[400],
  boxShadow: vars.shadows.blue100,
});

/** Stronger accent when cell is both focused and selected. */
export const notebookCellSelected = style({
  borderLeftColor: vars.color.blue[500],
  background: vars.color.blue[50],
  boxShadow: vars.shadows.blue100,
});

/** Left gutter column: execution prompt + optional run. */
export const notebookCellGutter = style({
  width: '3.5rem',
  minWidth: '3.5rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  justifyContent: 'flex-start',
  paddingTop: vars.space[2],
  paddingRight: vars.space[1],
  paddingBottom: vars.space[2],
  paddingLeft: vars.space[1],
  borderRight: `1px solid ${vars.color.gray[100]}`,
  background: vars.color.gray[50],
  gap: vars.space[1],
});

/** "In [n]:" prompt text in gutter. */
export const notebookCellPrompt = style({
  fontFamily: vars.fontFamily.mono,
  fontSize: vars.fontSize['10px'],
  color: vars.color.gray[500],
  lineHeight: 1.4,
});

/** Right column: header + editor + diff. */
export const notebookCellContent = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
});

/** Cell header row (label + optional run in content area if not in gutter). */
export const notebookCellHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${vars.space[1]} ${vars.space[2]}`,
  borderBottom: `1px solid ${vars.color.gray[100]}`,
});
