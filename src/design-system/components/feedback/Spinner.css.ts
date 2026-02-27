import { style } from '@vanilla-extract/css';
import { keyframes } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

export const spinner = style({
  width: '16px',
  height: '16px',
  border: `2px solid ${vars.color.gray[200]}`,
  borderTopColor: vars.color.blue[500],
  borderRadius: vars.radii.full,
  animation: `${spin} 0.8s linear infinite`,
});

export const spinnerLg = style({
  width: '20px',
  height: '20px',
  border: `2px solid ${vars.color.gray[200]}`,
  borderTopColor: vars.color.blue[500],
  borderRadius: vars.radii.full,
  animation: `${spin} 0.8s linear infinite`,
});
