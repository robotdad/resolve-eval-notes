# resolve-eval-notes
Resolve Smart Tool evaluation: TypeScript notes app, developed through hosted handoffs and PR delivery


## Caller-integrated evaluation baseline

This baseline combines recovered application source with two caller fixes for unsaved-draft handling and caller packaging. It is not evidence of successful hosted Goal PR delivery.

This is a disposable local evaluation app, not a production deployment. Do not use personal or sensitive data. The backend currently listens on unspecified interfaces, permits cross-origin requests, and exposes its storage path through an API endpoint. Run only in a suitably isolated local environment; publication does not authorize network exposure. Dependency advisories and delete-dialog keyboard/focus limitations remain known residuals.

## Application instructions

# Notes App

A simple, locally-runnable notes application with a React + TypeScript frontend and a Node.js backend with persistent local storage.

## Features

- Create, read, update, and delete notes
- Notes have stable unique IDs, plain-text titles and bodies
- Non-blank title required; body may be empty
- Duplicate titles allowed as distinct notes (identified by ID)
- **Explicit Save** button — notes are not saved automatically
- **Unsaved-change protection** — warns before switching notes or creating new ones with unsaved edits
- **Confirmed deletion** — requires confirmation before deleting a note
- **Persistent backend storage** — stored in `backend/data/notes.json` on the server, independent of browser data
- **Tags** — create, assign, and filter notes by tags (see below)

## Storage Location

Notes are stored at: `backend/data/notes.json` (relative to the project root).

This is server-side storage. Notes survive browser clearing, private browsing, and any browser-local data changes.

## Prerequisites

- Node.js 18+ and npm

## Installation

```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

## Running Locally

### Backend (Port 3001)

```bash
cd backend
npm run build
npm start
```

Or for development with ts-node:
```bash
cd backend
npm run dev
```

### Frontend (Port 3000)

```bash
cd frontend
npm start
```

Open your browser at: **http://localhost:3000**

The frontend proxies `/api` requests to the backend at `http://localhost:3001`.

## Running Tests

```bash
cd backend
npm test
```

Tests use a temporary `backend/test-data/` directory that is cleaned up automatically.

### Caller-repaired browser harness (qualification required)

From the repository root, on Linux with a supported sandbox-enabled Playwright
Chromium already installed:

```bash
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run test:backend
npm run test:harness
npm run test:e2e
```

The browser harness uses the existing `@playwright/test` 1.63 dependency, requires
`chromiumSandbox: true`, and must stop if the host refuses sandboxed launch.
Do not disable the sandbox to obtain a pass. Dependency installation alone does
not install a browser or qualify the runtime.

`e2e/fixtures.ts` owns both test servers. The frontend's actual `start` script
uses `test-support/vite.config.mjs` on **127.0.0.1:43171**, proxying to the
test-only backend launcher on **127.0.0.1:43172**. Both ports must be free;
there is no reuse of existing servers. Each worker gets a fresh synthetic
temporary `NOTES_DATA_DIR`, removed on teardown. The restart test closes the
browser process and both servers, then starts fresh processes using the same
temporary disk store. These launchers are harness isolation, **not fixes to
the application's ordinary bind, CORS or storage-path behavior**.

The tests cover named accessible dialog lookup and Chromium accessibility-tree
exposure, initial Cancel focus, forward/reverse Tab containment, Escape/Cancel
draft preservation, background pointer blocking, selected-ID deletion and New
focus (including the last note), plus CRUD, validation, dirty/save/discard guards
and full restart persistence. This is not universal assistive-technology or
cross-browser coverage. A discovered/typechecked test is not a runtime pass.

Set `E2E_EVIDENCE_DIR` for server lifecycle logs and `E2E_REPORT` for the JSON
test report; Playwright failure screenshots/traces use `test-results/` by default.
Use only synthetic data. The caller repair and its qualification are distinct
from the failed hosted S execution and its missing feature PR.

## Tags

Tags are global, named labels that can be assigned to notes.

### Tag rules
- **Unique names** — tag names are case-insensitively unique (e.g. "Work" and "work" are the same tag).
- **Trimmed** — leading/trailing whitespace is stripped on creation.
- **Non-blank** — a blank name (or whitespace-only) is rejected.
- **Cascade delete** — deleting a tag removes it from all notes.

### Using tags
- Open a note and use the **Tags** panel on the right to assign or remove tags.
- Create a new global tag from the "New tag" input; it is auto-assigned to the current note.
- Filter the note list by clicking a tag pill in the sidebar. Only one tag may be active at a time; clicking another tag replaces the current filter. Click the active tag again to clear the filter.
- Manage (delete) global tags from the "Manage tags" section in the Tags panel.

## API Endpoints

### Notes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List all notes |
| POST | `/api/notes` | Create a note (`{title, body}`) |
| GET | `/api/notes/:id` | Get a note by ID |
| PUT | `/api/notes/:id` | Update a note (`{title, body}`) |
| DELETE | `/api/notes/:id` | Delete a note (cascades tag associations) |
| GET | `/api/storage-info` | Get storage file path |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create a tag (`{name}`) |
| GET | `/api/tags/:id` | Get a tag by ID |
| PUT | `/api/tags/:id` | Rename a tag (`{name}`) |
| DELETE | `/api/tags/:id` | Delete a tag (cascades associations) |

### Note-Tag Associations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes/:id/tags` | Get tags for a note |
| POST | `/api/notes/:id/tags/:tagId` | Assign a tag to a note (idempotent) |
| DELETE | `/api/notes/:id/tags/:tagId` | Unassign a tag from a note |
| PUT | `/api/notes/:id/tags` | Replace all tags for a note (`{tagIds: string[]}`) |

## Persistence Behavior

- All notes are persisted to `backend/data/notes.json` on every write operation
- Stopping and restarting the backend server preserves all notes
- Notes are available to any browser that connects to the backend (not tied to browser storage)
- The storage file is plain JSON and can be inspected directly

## Unsaved-Change Protection

- An "Unsaved changes" badge appears in the editor when there are unsaved edits
- Switching to another note or creating a new note while there are unsaved changes shows a browser confirmation dialog
- Canceling the dialog returns you to the dirty editor with contents intact
- Confirming discards the unsaved changes and proceeds
- Closing or reloading the browser tab while there are unsaved changes triggers a browser-native unload warning (browser behavior varies; most modern browsers show a generic "Leave site?" dialog)

## Deletion Confirmation

- Clicking "Delete" shows a confirmation dialog with the note title
- Canceling leaves the note unchanged
- Confirming permanently deletes the note from backend storage
- Deletion is permanent and survives server restart

## Architecture

```
notes-app/
├── backend/           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── index.ts   # Express app entry point
│   │   ├── routes.ts  # API route handlers
│   │   ├── storage.ts # File-based persistent storage
│   │   └── types.ts   # TypeScript interfaces
│   ├── src/__tests__/ # Jest + Supertest API tests
│   └── data/          # notes.json (created at runtime)
└── frontend/          # React + TypeScript + Vite
    └── src/
        ├── App.tsx          # Main app with state management
        ├── api.ts           # Backend API client
        ├── types.ts         # Shared TypeScript types
        └── components/
            ├── NoteList.tsx   # Sidebar note list (with tag filter)
            ├── NoteEditor.tsx # Note editing panel
            └── TagManager.tsx # Tag assignment and management panel
```
