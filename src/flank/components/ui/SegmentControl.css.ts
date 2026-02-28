import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const segmentControl = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  border: `1px solid ${vars.color.gray[200]}`,
  borderRadius: vars.radii.md,
  padding: vars.space[0.5],
  background: vars.color.gray[50],
});

export const segmentControlItem = style({
  padding: `${vars.space[1]} ${vars.space[2]}`,
  fontSize: vars.fontSize['10px'],
  fontWeight: vars.fontWeight.medium,
  fontFamily: vars.fontFamily.sans,
  color: vars.color.gray[500],
  background: 'transparent',
  border: 'none',
  borderRadius: vars.radii.sm,
  cursor: 'pointer',
  transition: 'color 0.15s, background-color 0.15s, box-shadow 0.15s',
});

export const segmentControlItemSelected = style({
  background: vars.color.white,
  color: vars.color.gray[700],
  boxShadow: vars.shadows.sm,
});
