import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const checkbox = style({
  width: '14px',
  height: '14px',
  appearance: 'none',
  WebkitAppearance: 'none',
  border: `1px solid ${vars.color.gray[300]}`,
  borderRadius: vars.radii.sm,
  margin: 0,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
  selectors: {
    '&:focus-visible': {
      outline: 'none',
      borderColor: vars.color.blue[300],
      boxShadow: `0 0 0 1px ${vars.color.blue[100]}`,
    },
    '&:checked': {
      background: vars.color.blue[600],
      borderColor: vars.color.blue[600],
    },
  },
});
