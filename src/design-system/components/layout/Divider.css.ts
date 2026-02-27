import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const divider = style({
  borderTop: `1px solid ${vars.color.gray[200]}`,
});

export const dividerVertical = style({
  width: '1px',
  background: vars.color.gray[200],
  alignSelf: 'stretch',
  minHeight: 0,
});
