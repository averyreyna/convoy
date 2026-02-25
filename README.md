# Convoy

Convoy is a canvas-based data visualization tool that helps you build and run data pipelines through an interactive node graph. You connect data sources to filter, transform, group, and chart nodes, with optional AI-assisted pipeline suggestions powered by Anthropic. The tool supports exporting pipelines to JavaScript (D3.js) or Python, and can publish charts to Datawrapper when configured.

![](convoy.gif)

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or later)
- npm (v9 or later)

## Local Development

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/convoy.git
   cd convoy
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create a `.env` file in the root directory and add your Anthropic API key (optional: add Datawrapper token for chart export):**

   ```bash
   ANTHROPIC_API_KEY=your_api_key_here
   DATAWRAPPER_API_TOKEN=your_datawrapper_token_here
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

5. **Open http://localhost:5173 in your browser to see the application.**

## Phase 4: Light preferences

Click the **gear icon** in the sidebar header to open **Settings**:

- **Show code by default in nodes** — New nodes (from palette, proposed pipeline, or import) open in code view instead of simple view when enabled. Existing nodes are unchanged.
- **Default script language** — Python or JavaScript; used when opening the Code changes diff viewer with no baseline and for future “Copy as Python/JS” if added.
- **Suggest next steps** — Optional; reserved for future use.

Preferences are stored in `localStorage` under `convoy.preferences` and survive refresh.

## Available Scripts

- `npm run dev` - Start the development server (Vite + API server)
- `npm run dev:client` - Start only the Vite dev server
- `npm run dev:server` - Start only the API server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check for code issues
