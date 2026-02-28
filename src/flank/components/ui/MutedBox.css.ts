import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const mutedBox = style({
  background: vars.color.gray[50],
  padding: `${vars.space[1]} ${vars.space[2]}`,
  borderRadius: vars.radii.md,
  fontSize: vars.fontSize.xs,
  color: vars.color.gray[600],
  fontFamily: vars.fontFamily.sans,
});

export const mutedBoxRow = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: vars.space[2],
});
