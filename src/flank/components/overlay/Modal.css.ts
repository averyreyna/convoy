import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const modalOverlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(17, 24, 39, 0.3)',
  backdropFilter: 'blur(4px)',
});

export const modalPanel = style({
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '85vh',
  width: '100%',
  maxWidth: '64rem',
  borderRadius: vars.radii.xl,
  border: `1px solid ${vars.color.gray[200]}`,
  background: vars.color.white,
  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
});

export const modalHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  padding: `${vars.space[3]} ${vars.space[4]}`,
  borderBottom: `1px solid ${vars.color.gray[200]}`,
});

export const modalBody = style({
  flex: 1,
  overflow: 'auto',
  minHeight: 0,
});
