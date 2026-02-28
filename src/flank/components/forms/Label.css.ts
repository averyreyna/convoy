import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const label = style({
  display: 'block',
  marginBottom: vars.space[1],
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize['10px'],
  fontWeight: vars.fontWeight.medium,
  letterSpacing: vars.letterSpacing.wide,
  textTransform: 'uppercase',
  color: vars.color.gray[400],
});
