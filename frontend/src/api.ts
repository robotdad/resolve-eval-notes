import { Note } from './types';

const API_BASE = '/api';

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch(`${API_BASE}/notes`);
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
}

export async function fetchNote(id: string): Promise<Note> {
  const res = await fetch(`${API_BASE}/notes/${id}`);
  if (!res.ok) throw new Error('Failed to fetch note');
  return res.json();
}

export async function createNote(title: string, body: string): Promise<Note> {
  const res = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create note');
  }
  return res.json();
}

export async function updateNote(id: string, title: string, body: string): Promise<Note> {
  const res = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update note');
  }
  return res.json();
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete note');
}
