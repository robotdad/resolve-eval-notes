import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getStorageFilePath,
  getAllTags,
  getTagById,
  createTag,
  renameTag,
  deleteTag,
  getTagsForNote,
  assignTagToNote,
  unassignTagFromNote,
  setTagsForNote,
  foldTagName,
  normalizeTagName,
} from './storage';
import { CreateNoteRequest, UpdateNoteRequest } from './types';

const router = Router();

// GET /api/notes - list all notes
router.get('/notes', (_req: Request, res: Response) => {
  const notes = getAllNotes();
  res.json(notes);
});

// GET /api/notes/:id - get a single note
router.get('/notes/:id', (req: Request, res: Response) => {
  const note = getNoteById(req.params.id);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json(note);
});

// POST /api/notes - create a note
router.post('/notes', (req: Request, res: Response) => {
  const { title, body } = req.body as CreateNoteRequest;

  // Validate: title must be non-blank (not empty or whitespace-only)
  if (typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Title must be a non-blank string' });
    return;
  }

  // Body may be empty string
  if (typeof body !== 'string') {
    res.status(400).json({ error: 'Body must be a string' });
    return;
  }

  const id = uuidv4();
  const note = createNote(id, title, body);
  res.status(201).json(note);
});

// PUT /api/notes/:id - update a note
router.put('/notes/:id', (req: Request, res: Response) => {
  const { title, body } = req.body as UpdateNoteRequest;

  // Validate: title must be non-blank
  if (typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Title must be a non-blank string' });
    return;
  }

  if (typeof body !== 'string') {
    res.status(400).json({ error: 'Body must be a string' });
    return;
  }

  const note = updateNote(req.params.id, title, body);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json(note);
});

// DELETE /api/notes/:id - delete a note
router.delete('/notes/:id', (req: Request, res: Response) => {
  const deleted = deleteNote(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.status(204).send();
});

// GET /api/storage-info - return storage location
router.get('/storage-info', (_req: Request, res: Response) => {
  res.json({ storagePath: getStorageFilePath() });
});

// ---- Tag endpoints ----

// GET /api/tags - list all tags
router.get('/tags', (_req: Request, res: Response) => {
  const tags = getAllTags();
  res.json(tags);
});

// POST /api/tags - create a tag
// Body: { name: string }
// Policy: trim whitespace, reject blank, reject case-insensitive duplicate
router.post('/tags', (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  if (typeof name !== 'string') {
    res.status(400).json({ error: 'Tag name must be a string' });
    return;
  }
  const normalized = normalizeTagName(name);
  if (normalized.length === 0) {
    res.status(400).json({ error: 'Tag name must be non-blank after trimming' });
    return;
  }
  // Check for duplicate (case-insensitive)
  const existing = getAllTags().find((t) => foldTagName(t.name) === foldTagName(name));
  if (existing) {
    res.status(409).json({ error: 'A tag with this name already exists', existing });
    return;
  }
  const id = uuidv4();
  const tag = createTag(id, name);
  if (!tag) {
    res.status(409).json({ error: 'A tag with this name already exists' });
    return;
  }
  res.status(201).json(tag);
});

// GET /api/tags/:id - get a single tag
router.get('/tags/:id', (req: Request, res: Response) => {
  const tag = getTagById(req.params.id);
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json(tag);
});

// PUT /api/tags/:id - rename a tag
// Body: { name: string }
router.put('/tags/:id', (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  if (typeof name !== 'string') {
    res.status(400).json({ error: 'Tag name must be a string' });
    return;
  }
  const normalized = normalizeTagName(name);
  if (normalized.length === 0) {
    res.status(400).json({ error: 'Tag name must be non-blank after trimming' });
    return;
  }
  const tag = renameTag(req.params.id, name);
  if (tag === null) {
    // Could be not found or collision
    const existing = getTagById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Tag not found' });
    } else {
      res.status(409).json({ error: 'A tag with this name already exists' });
    }
    return;
  }
  res.json(tag);
});

// DELETE /api/tags/:id - delete a tag (and all its associations)
router.delete('/tags/:id', (req: Request, res: Response) => {
  const deleted = deleteTag(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.status(204).send();
});

// ---- Note-Tag association endpoints ----

// GET /api/notes/:id/tags - get tags for a note
router.get('/notes/:id/tags', (req: Request, res: Response) => {
  const note = getNoteById(req.params.id);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  const tags = getTagsForNote(req.params.id);
  res.json(tags);
});

// POST /api/notes/:id/tags/:tagId - assign a tag to a note
router.post('/notes/:id/tags/:tagId', (req: Request, res: Response) => {
  const { id: noteId, tagId } = req.params;
  const note = getNoteById(noteId);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  const tag = getTagById(tagId);
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  assignTagToNote(noteId, tagId);
  const tags = getTagsForNote(noteId);
  res.status(200).json(tags);
});

// DELETE /api/notes/:id/tags/:tagId - unassign a tag from a note
router.delete('/notes/:id/tags/:tagId', (req: Request, res: Response) => {
  const { id: noteId, tagId } = req.params;
  const note = getNoteById(noteId);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  const tag = getTagById(tagId);
  if (!tag) {
    // Tag doesn't exist - treat as 404 (already gone)
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  const removed = unassignTagFromNote(noteId, tagId);
  if (!removed) {
    res.status(404).json({ error: 'Association not found' });
    return;
  }
  const tags = getTagsForNote(noteId);
  res.status(200).json(tags);
});

// PUT /api/notes/:id/tags - replace all tags for a note
// Body: { tagIds: string[] }
// Deduplicates input; rejects if any tagId is invalid (atomically, no partial change)
router.put('/notes/:id/tags', (req: Request, res: Response) => {
  const noteId = req.params.id;
  const { tagIds } = req.body as { tagIds: string[] };
  if (!Array.isArray(tagIds)) {
    res.status(400).json({ error: 'tagIds must be an array' });
    return;
  }
  if (!tagIds.every((id) => typeof id === 'string')) {
    res.status(400).json({ error: 'All tagIds must be strings' });
    return;
  }
  const note = getNoteById(noteId);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  const result = setTagsForNote(noteId, tagIds);
  if (result === null) {
    res.status(400).json({ error: 'One or more tagIds are invalid' });
    return;
  }
  res.json(result);
});

export default router;
