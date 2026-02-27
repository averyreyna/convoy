import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const menuPanel = style({
  padding: vars.space[2],
  border: `1px solid ${vars.color.gray[200]}`,
  borderRadius: vars.radii.lg,
  background: vars.color.white,
  boxShadow: vars.shadows.lg,
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  width: '100%',
  padding: `${vars.space[2]} ${vars.space[3]}`,
  fontSize: vars.fontSize.xs,
  fontFamily: vars.fontFamily.sans,
  color: vars.color.gray[700],
  background: 'transparent',
  border: 'none',
  borderRadius: vars.radii.md,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background-color 0.15s',
  selectors: {
    '&:hover': {
      background: vars.color.gray[50],
    },
  },
});

export const menuItemIcon = style({
  flexShrink: 0,
  color: vars.color.gray[400],
});
