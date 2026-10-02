import fs from 'fs';
import path from 'path';
import { NotesStore, Note } from './types';

// Storage location: backend/data/notes.json (relative to backend directory)
// This is the source of truth, independent of browser data
// Can be overridden via NOTES_DATA_DIR environment variable (used in tests)
function getDataDir(): string {
  return process.env.NOTES_DATA_DIR || path.join(__dirname, '..', 'data');
}

function getStorageFile(): string {
  return path.join(getDataDir(), 'notes.json');
}

function ensureDataDir(): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readStore(): NotesStore {
  ensureDataDir();
  const storageFile = getStorageFile();
  if (!fs.existsSync(storageFile)) {
    return { notes: [] };
  }
  try {
    const raw = fs.readFileSync(storageFile, 'utf-8');
    return JSON.parse(raw) as NotesStore;
  } catch {
    return { notes: [] };
  }
}

export function writeStore(store: NotesStore): void {
  ensureDataDir();
  fs.writeFileSync(getStorageFile(), JSON.stringify(store, null, 2), 'utf-8');
}

export function getAllNotes(): Note[] {
  const store = readStore();
  return store.notes;
}

export function getNoteById(id: string): Note | undefined {
  const store = readStore();
  return store.notes.find((n) => n.id === id);
}

export function createNote(id: string, title: string, body: string): Note {
  const store = readStore();
  const now = new Date().toISOString();
  const note: Note = { id, title, body, createdAt: now, updatedAt: now };
  store.notes.push(note);
  writeStore(store);
  return note;
}

export function updateNote(id: string, title: string, body: string): Note | null {
  const store = readStore();
  const idx = store.notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  store.notes[idx] = { ...store.notes[idx], title, body, updatedAt: now };
  writeStore(store);
  return store.notes[idx];
}

export function deleteNote(id: string): boolean {
  const store = readStore();
  const idx = store.notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  store.notes.splice(idx, 1);
  writeStore(store);
  return true;
}

export function getStorageFilePath(): string {
  return getStorageFile();
}
