import { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from './types';
import { fetchNotes, createNote, updateNote, deleteNote } from './api';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const newNoteButtonRef = useRef<HTMLButtonElement>(null);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNotes();
      setNotes(data);
    } catch {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // Guard: check for unsaved changes before leaving the current editor
  const guardUnsaved = useCallback((): boolean => {
    if (isDirty) {
      return window.confirm(
        'You have unsaved changes. Discard them and continue?'
      );
    }
    return true;
  }, [isDirty]);

  const handleSelectNote = (note: Note) => {
    if (!guardUnsaved()) return;
    setEditorRevision((revision) => revision + 1);
    setSelectedNote(note);
    setIsNewNote(false);
    setError(null);
    setIsDirty(false);
  };

  const handleNewNote = () => {
    if (!guardUnsaved()) return;
    setEditorRevision((revision) => revision + 1);
    setSelectedNote(null);
    setIsNewNote(true);
    setError(null);
    setIsDirty(false);
  };

  const handleSave = async (title: string, body: string) => {
    setError(null);
    try {
      if (isNewNote) {
        const newNote = await createNote(title, body);
        setNotes((prev) => [...prev, newNote]);
        setSelectedNote(newNote);
        setIsNewNote(false);
        setIsDirty(false);
      } else if (selectedNote) {
        const updated = await updateNote(selectedNote.id, title, body);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSelectedNote(updated);
        setIsDirty(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    setError(null);
    try {
      await deleteNote(selectedNote.id);
      setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
      setSelectedNote(null);
      setIsNewNote(false);
      setIsDirty(false);
      newNoteButtonRef.current?.focus();
    } catch {
      setError('Failed to delete note');
    }
  };

  const handleCancel = () => {
    setIsNewNote(false);
    setError(null);
    setIsDirty(false);
    if (isNewNote) {
      setSelectedNote(null);
    } else if (selectedNote) {
      // Revert: re-select the note to reset editor fields
      const current = selectedNote;
      setSelectedNote(null);
      setTimeout(() => setSelectedNote(current), 0);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <NoteList
        notes={notes}
        selectedId={selectedNote?.id ?? null}
        onSelect={handleSelectNote}
        onNew={handleNewNote}
        newButtonRef={newNoteButtonRef}
      />
      <NoteEditor
        key={editorRevision}
        note={selectedNote}
        isNew={isNewNote}
        onSave={(title, body) => { void handleSave(title, body); }}
        onDelete={() => { void handleDelete(); }}
        onCancel={handleCancel}
        error={error}
        onDirtyChange={setIsDirty}
      />
    </div>
  );
}

export default App;
