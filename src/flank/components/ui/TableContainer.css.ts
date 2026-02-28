import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const tableContainer = style({
  border: `1px solid ${vars.color.gray[200]}`,
  borderRadius: vars.radii.md,
  overflow: 'auto',
  fontSize: vars.fontSize['10px'],
  fontFamily: vars.fontFamily.sans,
});

export const tableHeader = style({
  position: 'sticky',
  top: 0,
  background: vars.color.gray[50],
  fontWeight: vars.fontWeight.medium,
  padding: `${vars.space[1]} ${vars.space[2]}`,
  color: vars.color.gray[500],
});
