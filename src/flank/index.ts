/**
 * Flank design system public API.
 * Import theme once in main.tsx; components import recipes from here.
 */

export { vars } from './theme/index.css.ts';

// Layout
export { pageBackground } from './components/layout/PageBackground.css.ts';
export { panelSection, panelSectionHeader } from './components/layout/PanelSection.css.ts';
export { divider, dividerVertical } from './components/layout/Divider.css.ts';

// Typography
export {
  headingSm,
  headingBase,
  headingLg,
  caption,
  captionMuted,
  captionMedium,
} from './components/typography/Heading.css.ts';

// Forms
export { button } from './components/forms/Button.css.ts';
export { input } from './components/forms/Input.css.ts';
export { label } from './components/forms/Label.css.ts';
export { checkbox } from './components/forms/Checkbox.css.ts';

// Feedback
export { alert, alertWarning, alertVariants } from './components/feedback/Alert.css.ts';
export { badge } from './components/feedback/Badge.css.ts';
export { spinner, spinnerLg } from './components/feedback/Spinner.css.ts';

// Overlay
export {
  modalOverlay,
  modalPanel,
  modalHeader,
  modalBody,
} from './components/overlay/Modal.css.ts';
export { menuPanel, menuItem, menuItemIcon } from './components/overlay/Menu.css.ts';
export { card } from './components/overlay/Card.css.ts';

// UI primitives
export { iconWell, iconWellMuted } from './components/ui/IconWell.css.ts';
export { mutedBox, mutedBoxRow } from './components/ui/MutedBox.css.ts';
export {
  dropZone,
  dropZoneDefault,
  dropZoneActive,
  dropZoneVariants,
} from './components/ui/DropZone.css.ts';
export {
  segmentControl,
  segmentControlItem,
  segmentControlItemSelected,
} from './components/ui/SegmentControl.css.ts';
export { banner, bannerWarning, bannerSuccess, bannerVariants } from './components/ui/Banner.css.ts';
export { tableContainer, tableHeader } from './components/ui/TableContainer.css.ts';

// Canvas (node / palette)
export { nodeHeader, nodeHeaderTitle, nodeHandle } from './components/canvas/NodeHeader.css.ts';
export {
  notebookScrollArea,
  notebookCellList,
  notebookCell,
  notebookCellFocused,
  notebookCellSelected,
  notebookCellGutter,
  notebookCellPrompt,
  notebookCellContent,
  notebookCellHeader,
} from './components/canvas/NotebookCell.css.ts';
export {
  paletteItem,
  paletteItemIcon,
  paletteItemTitle,
  paletteItemDescription,
} from './components/canvas/PaletteItem.css.ts';
