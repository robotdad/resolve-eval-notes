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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List all notes |
| POST | `/api/notes` | Create a note (`{title, body}`) |
| GET | `/api/notes/:id` | Get a note by ID |
| PUT | `/api/notes/:id` | Update a note (`{title, body}`) |
| DELETE | `/api/notes/:id` | Delete a note |
| GET | `/api/storage-info` | Get storage file path |

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
            ├── NoteList.tsx  # Sidebar note list
            └── NoteEditor.tsx # Note editing panel
```
