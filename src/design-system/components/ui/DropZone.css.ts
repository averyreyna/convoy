import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const base = style({
  borderWidth: '2px',
  borderStyle: 'dashed',
  borderRadius: vars.radii.md,
  padding: vars.space[4],
  transition: 'border-color 0.15s, background-color 0.15s',
});

export const dropZoneVariants = styleVariants({
  default: {
    borderColor: vars.color.gray[200],
  },
  active: {
    borderColor: vars.color.blue[400],
    background: vars.color.blue[50],
  },
});

export const dropZone = {
  base,
  variants: dropZoneVariants,
};

export const dropZoneDefault = style([base, dropZoneVariants.default]);
export const dropZoneActive = style([base, dropZoneVariants.active]);
