# Developer & Agent Guidelines

## Tech Stack Overview
- **UI Framework**: React 19 + TypeScript
- **State & Canvas Management**: React Flow v11 (unified bundle-resolved state)
- **Styling**: Tailwind CSS CDN
- **API integrations**: Node-side proxying and browser-side client setup for external SDK calls.

## Component Architecture Notes
1. **Core Canvas & Layout**:
   - `App.tsx` controls the main `ReactFlowProvider` and general state hook bounds.
   - Component custom event dispatch model is utilized to bypass deep React-state props drilling from modular custom node components.
2. **Table Display Nodes**:
   - `/components/TableNode.tsx` renders custom nodes in the React Flow viewport.
   - Inputs are set container-independent inside React Flow dragging boundaries by using the `.nodrag` layout class to avoid cursor-hijack on field focus.

## Runtime Issues & Resolutions
- **React Version Duplicity**: Always let Vite compile and resolve package exports from local `node_modules` recursively. Never append browser-level HTML `importmap` scripts to avoid duplicate loaded packages with unmatched React runtime symbols.
