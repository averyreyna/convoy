import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const iconWell = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: vars.space[8],
  height: vars.space[8],
  borderRadius: vars.radii.lg,
  background: vars.color.blue[50],
  color: vars.color.blue[500],
});

export const iconWellMuted = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: vars.space[8],
  height: vars.space[8],
  borderRadius: vars.radii.lg,
  background: vars.color.gray[50],
  color: vars.color.gray[500],
});
