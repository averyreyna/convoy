import { style, styleVariants } from '@vanilla-extract/css';
import { keyframes } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.7 },
});

const base = style({
  position: 'relative',
  borderRadius: vars.radii.lg,
  background: vars.color.white,
  boxShadow: vars.shadows.md,
  transition: 'box-shadow 0.15s',
  minWidth: '300px',
  maxWidth: '340px',
  selectors: {
    '&:hover': { boxShadow: vars.shadows.lg },
  },
});

export const cardStateVariants = styleVariants({
  proposed: {
  borderWidth: '2px',
  borderStyle: 'dashed',
  borderColor: vars.color.gray[300],
  opacity: 0.6,
  },
  confirmed: {
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: vars.color.gray[200],
  },
  running: {
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: vars.color.blue[400],
  boxShadow: vars.shadows.blue100,
  animation: `${pulse} 1.5s ease-in-out infinite`,
  },
  error: {
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: vars.color.red[400],
  boxShadow: vars.shadows.red100,
  },
});

export const cardSelected = style({
  borderWidth: '2px',
  borderStyle: 'dotted',
  borderColor: vars.color.blue[200],
  background: 'rgba(239, 246, 255, 0.5)',
});

export const cardWide = style({
  minWidth: '520px',
  maxWidth: '580px',
});

export const card = {
  base,
  stateVariants: cardStateVariants,
  selected: cardSelected,
  wide: cardWide,
};
