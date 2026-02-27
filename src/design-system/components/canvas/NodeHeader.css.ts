import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const nodeHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  padding: `${vars.space[2]} ${vars.space[3]}`,
  borderBottom: `1px solid ${vars.color.gray[100]}`,
});

export const nodeHeaderTitle = style({
  fontSize: vars.fontSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.gray[800],
});

/** React Flow node handle (target/source) — use with Handle component className. */
export const nodeHandle = style({
  width: '0.75rem',
  height: '0.75rem',
  borderRadius: vars.radii.full,
  border: `2px solid ${vars.color.white}`,
  background: vars.color.blue[500],
});
