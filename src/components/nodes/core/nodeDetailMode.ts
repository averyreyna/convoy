export type NodeDetailMode = 'collapsed' | 'full';

// Zoom thresholds for switching between collapsed and full detail.
// A small hysteresis band prevents flicker when the user hovers near the boundary.
const DETAIL_ZOOM_ENTER = 0.9;
const DETAIL_ZOOM_EXIT = 0.8;

export function computeNodeDetailMode(
  zoom: number,
  previous: NodeDetailMode = 'full'
): NodeDetailMode {
  if (previous === 'collapsed') {
    return zoom >= DETAIL_ZOOM_ENTER ? 'full' : 'collapsed';
  }
  // previous === 'full'
  return zoom <= DETAIL_ZOOM_EXIT ? 'collapsed' : 'full';
}

