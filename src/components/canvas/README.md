# Canvas components

The canvas layer is the orchestration shell around nodes. It is responsible for:

- Rendering the React Flow canvas (`ConvoyCanvas`) and wiring `nodeTypes` / `edgeTypes`.
- Global canvas controls (`CanvasControls`) such as zoom, fit, reset, and export/import.
- Node discovery and layout helpers (`NodePalette`, `SidebarHeader`).
- Pipeline code orchestration (`PipelineCodePanel` and its internal toolbar, cell list, and diff views).
- Import/export and AI-driven pipeline generation (`ImportFromPythonModal`, `PipelinePrompt`, `EditWithAIAssistant`).
- Visual affordances like proposed pipeline banners and preferences.

## Structure

- **core/** — Canvas shell: `ConvoyCanvas`, `CanvasControls`, `NodePalette`, `SidebarHeader`.
- **panels/** — `PipelineCodePanel`, `PreferencesPanel` (code and settings side panels). Pipeline subcomponents live in `panels/PipelineCodePanel/` (`PipelineCodeToolbar`, `PipelineCellList`, `PipelineFullDiff`).
- **modals/** — `PipelinePrompt`, `ImportFromPythonModal`, `ScriptDiffModal`.
- **banners/** — `ProposedPipelineBanner`.
- **ai/** — `EditWithAIAssistant` (used by `PipelineCodePanel`).

All public canvas components are re-exported from `src/components/canvas/index.ts` so callers can import from `@/components/canvas`.

## Guidelines

- Keep **store wiring and side effects** (calls into `canvasStore`, `dataStore`, Python runner, or API clients) in the top-level panel or core components.
- Subcomponents like the pipeline toolbar, cell list, or diff views should be **pure view components** that receive already-prepared props.
- Use design-system primitives from `@/flank` for layout, typography, buttons, banners, and modals instead of ad-hoc styling.
- When adding new canvas functionality, prefer:
  - A panel when it is a persistent side surface (e.g. new inspection/code panes).
  - A modal when it is a focused, transient flow (e.g. prompts, imports, confirmations).
  - A banner for cross-cutting notifications anchored to the canvas (e.g. proposed or pinned state).

