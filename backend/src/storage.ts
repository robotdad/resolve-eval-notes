import fs from 'fs';
import path from 'path';
import { NotesStore, Note, Tag, NoteTagAssociation } from './types';

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
    return { notes: [], tags: [], noteTagAssociations: [] };
  }
  try {
    const raw = fs.readFileSync(storageFile, 'utf-8');
    const parsed = JSON.parse(raw) as NotesStore;
    // Migrate: ensure tags and associations exist
    if (!parsed.tags) parsed.tags = [];
    if (!parsed.noteTagAssociations) parsed.noteTagAssociations = [];
    return parsed;
  } catch {
    return { notes: [], tags: [], noteTagAssociations: [] };
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
  // Remove all tag associations for this note
  if (store.noteTagAssociations) {
    store.noteTagAssociations = store.noteTagAssociations.filter((a) => a.noteId !== id);
  }
  writeStore(store);
  return true;
}

export function getStorageFilePath(): string {
  return getStorageFile();
}

// ---- Tag normalization ----
// Trim leading/trailing whitespace; comparison is case-insensitive
export function normalizeTagName(name: string): string {
  return name.trim();
}

export function foldTagName(name: string): string {
  return name.trim().toLowerCase();
}

// ---- Tag CRUD ----

export function getAllTags(): Tag[] {
  const store = readStore();
  return store.tags ?? [];
}

export function getTagById(id: string): Tag | undefined {
  const store = readStore();
  return (store.tags ?? []).find((t) => t.id === id);
}

/**
 * Create a tag with a normalized name.
 * Returns null if a tag with the same folded name already exists.
 */
export function createTag(id: string, name: string): Tag | null {
  const store = readStore();
  const tags = store.tags ?? [];
  const folded = foldTagName(name);
  if (folded.length === 0) return null; // blank after trim
  const collision = tags.find((t) => foldTagName(t.name) === folded);
  if (collision) return null;
  const now = new Date().toISOString();
  const tag: Tag = { id, name: normalizeTagName(name), createdAt: now };
  store.tags = [...tags, tag];
  writeStore(store);
  return tag;
}

/**
 * Rename a tag. Allows self-rename (same name, different casing or spacing).
 * Returns null if:
 *   - tag not found
 *   - new name is blank after trim
 *   - new name collides with a DIFFERENT tag (case-insensitive)
 */
export function renameTag(id: string, newName: string): Tag | null {
  const store = readStore();
  const tags = store.tags ?? [];
  const idx = tags.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const normalized = normalizeTagName(newName);
  const folded = foldTagName(newName);
  if (folded.length === 0) return null;
  // Check collision with a DIFFERENT tag
  const collision = tags.find((t) => t.id !== id && foldTagName(t.name) === folded);
  if (collision) return null;
  tags[idx] = { ...tags[idx], name: normalized };
  store.tags = tags;
  writeStore(store);
  return tags[idx];
}

/**
 * Delete a tag and all its associations.
 */
export function deleteTag(id: string): boolean {
  const store = readStore();
  const tags = store.tags ?? [];
  const idx = tags.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  store.tags = tags.filter((t) => t.id !== id);
  store.noteTagAssociations = (store.noteTagAssociations ?? []).filter((a) => a.tagId !== id);
  writeStore(store);
  return true;
}

// ---- Association operations ----

export function getTagsForNote(noteId: string): Tag[] {
  const store = readStore();
  const assocs = (store.noteTagAssociations ?? []).filter((a) => a.noteId === noteId);
  const tags = store.tags ?? [];
  return assocs.map((a) => tags.find((t) => t.id === a.tagId)).filter((t): t is Tag => !!t);
}

export function getNotesForTag(tagId: string): Note[] {
  const store = readStore();
  const assocs = (store.noteTagAssociations ?? []).filter((a) => a.tagId === tagId);
  const notes = store.notes;
  return assocs.map((a) => notes.find((n) => n.id === a.noteId)).filter((n): n is Note => !!n);
}

/**
 * Assign a tag to a note (idempotent — no duplicate pairs).
 * Returns false if note or tag does not exist.
 */
export function assignTagToNote(noteId: string, tagId: string): boolean {
  const store = readStore();
  if (!store.notes.find((n) => n.id === noteId)) return false;
  if (!(store.tags ?? []).find((t) => t.id === tagId)) return false;
  const assocs = store.noteTagAssociations ?? [];
  const exists = assocs.some((a) => a.noteId === noteId && a.tagId === tagId);
  if (!exists) {
    store.noteTagAssociations = [...assocs, { noteId, tagId }];
    writeStore(store);
  }
  return true;
}

/**
 * Unassign a tag from a note. Removes ALL duplicate pairs (defensive).
 * Returns false if no association existed.
 */
export function unassignTagFromNote(noteId: string, tagId: string): boolean {
  const store = readStore();
  const assocs = store.noteTagAssociations ?? [];
  const before = assocs.length;
  store.noteTagAssociations = assocs.filter((a) => !(a.noteId === noteId && a.tagId === tagId));
  if (store.noteTagAssociations.length === before) return false;
  writeStore(store);
  return true;
}

/**
 * Replace all tag associations for a note with the given tagIds.
 * Deduplicates input. Validates all tagIds exist; if any invalid, returns false and makes no change.
 * If tagIds contains duplicates, deduplicates before writing.
 */
export function setTagsForNote(noteId: string, tagIds: string[]): Tag[] | null {
  const store = readStore();
  if (!store.notes.find((n) => n.id === noteId)) return null;
  const tags = store.tags ?? [];
  const dedupedIds = [...new Set(tagIds)];
  // Validate all tagIds
  for (const tid of dedupedIds) {
    if (!tags.find((t) => t.id === tid)) return null;
  }
  // Remove existing associations for this note
  const assocs = (store.noteTagAssociations ?? []).filter((a) => a.noteId !== noteId);
  // Add new associations
  const newAssocs: NoteTagAssociation[] = dedupedIds.map((tid) => ({ noteId, tagId: tid }));
  store.noteTagAssociations = [...assocs, ...newAssocs];
  writeStore(store);
  return dedupedIds.map((tid) => tags.find((t) => t.id === tid)!);
}
