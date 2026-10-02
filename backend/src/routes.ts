import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getStorageFilePath,
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

export default router;
