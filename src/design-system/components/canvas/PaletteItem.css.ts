import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const paletteItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2.5],
  width: '100%',
  padding: `${vars.space[2.5]} ${vars.space[3]}`,
  textAlign: 'left',
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.gray[700],
  background: vars.color.white,
  border: `1px solid ${vars.color.gray[100]}`,
  borderRadius: vars.radii.lg,
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
  selectors: {
    '&:hover': {
      borderColor: vars.color.blue[200],
      background: 'rgba(239, 246, 255, 0.5)',
      boxShadow: vars.shadows.sm,
    },
  },
});

export const paletteItemIcon = style({
  flexShrink: 0,
  color: vars.color.gray[400],
  selectors: {
    [`${paletteItem}:hover &`]: { color: vars.color.blue[500] },
  },
});

export const paletteItemTitle = style({
  fontSize: vars.fontSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.gray[700],
  selectors: {
    [`${paletteItem}:hover &`]: { color: vars.color.gray[900] },
  },
});

export const paletteItemDescription = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: vars.fontSize['10px'],
  color: vars.color.gray[400],
});
