import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const panelSection = style({
  padding: vars.space[3],
  borderBottom: `1px solid ${vars.color.gray[100]}`,
  background: 'transparent',
});

export const panelSectionHeader = style({
  padding: vars.space[3],
  background: 'transparent',
});
