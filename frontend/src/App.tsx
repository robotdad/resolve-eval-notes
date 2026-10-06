import { useState, useEffect, useCallback, useRef } from 'react';
import { Note, Tag } from './types';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  fetchTags,
  createTag as apiCreateTag,
  deleteTag as apiDeleteTag,
  fetchTagsForNote,
  setTagsForNote as apiSetTagsForNote,
} from './api';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { TagManager } from './components/TagManager';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const newNoteButtonRef = useRef<HTMLButtonElement>(null);

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  // Map from noteId -> Tag[] (loaded on demand, refreshed on changes)
  const [noteTagsMap, setNoteTagsMap] = useState<Map<string, Tag[]>>(new Map());
  // Tags for the currently selected note
  const [currentNoteTags, setCurrentNoteTags] = useState<Tag[]>([]);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const [notesData, tagsData] = await Promise.all([fetchNotes(), fetchTags()]);
      setNotes(notesData);
      setAllTags(tagsData);
      // Load all note-tag associations for sidebar display
      if (notesData.length > 0) {
        const entries = await Promise.all(
          notesData.map(async (note) => {
            const tags = await fetchTagsForNote(note.id);
            return [note.id, tags] as [string, Tag[]];
          })
        );
        setNoteTagsMap(new Map(entries));
      }
    } catch {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // When selected note changes, sync its tags into currentNoteTags
  useEffect(() => {
    if (selectedNote && !isNewNote) {
      const tags = noteTagsMap.get(selectedNote.id) ?? [];
      setCurrentNoteTags(tags);
    } else {
      setCurrentNoteTags([]);
    }
  }, [selectedNote, isNewNote, noteTagsMap]);

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
        // New note starts with no tags
        setNoteTagsMap((prev) => new Map(prev).set(newNote.id, []));
        setCurrentNoteTags([]);
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
      setNoteTagsMap((prev) => {
        const next = new Map(prev);
        next.delete(selectedNote.id);
        return next;
      });
      setSelectedNote(null);
      setIsNewNote(false);
      setIsDirty(false);
      setCurrentNoteTags([]);
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

  // ---- Tag management handlers ----

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const tag = await apiCreateTag(name);
    setAllTags((prev) => [...prev, tag]);
    return tag;
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await apiDeleteTag(tagId);
      setAllTags((prev) => prev.filter((t) => t.id !== tagId));
      // Remove from all notes in the map
      setNoteTagsMap((prev) => {
        const next = new Map<string, Tag[]>();
        for (const [nid, tags] of prev.entries()) {
          next.set(nid, tags.filter((t) => t.id !== tagId));
        }
        return next;
      });
      setCurrentNoteTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      setError('Failed to delete tag');
    }
  };

  const handleAddTagToNote = async (tagId: string) => {
    if (!selectedNote || isNewNote) return;
    try {
      const newTagIds = [...new Set([...currentNoteTags.map((t) => t.id), tagId])];
      const updatedTags = await apiSetTagsForNote(selectedNote.id, newTagIds);
      setCurrentNoteTags(updatedTags);
      setNoteTagsMap((prev) => new Map(prev).set(selectedNote.id, updatedTags));
    } catch {
      setError('Failed to add tag to note');
    }
  };

  const handleRemoveTagFromNote = async (tagId: string) => {
    if (!selectedNote || isNewNote) return;
    try {
      const newTagIds = currentNoteTags.map((t) => t.id).filter((id) => id !== tagId);
      const updatedTags = await apiSetTagsForNote(selectedNote.id, newTagIds);
      setCurrentNoteTags(updatedTags);
      setNoteTagsMap((prev) => new Map(prev).set(selectedNote.id, updatedTags));
    } catch {
      setError('Failed to remove tag from note');
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
        allTags={allTags}
        noteTagsMap={noteTagsMap}
      />
      <NoteEditor
        key={editorRevision}
        note={selectedNote}
        isNew={isNewNote}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={handleCancel}
        onDirtyChange={setIsDirty}
        error={error}
      />
      {/* Tag manager panel — only shown when a note is selected or being created */}
      {(selectedNote || isNewNote) && (
        <div
          style={{
            width: '240px',
            borderLeft: '1px solid #ddd',
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          <TagManager
            allTags={allTags}
            noteTags={currentNoteTags}
            onAddTag={(tagId) => void handleAddTagToNote(tagId)}
            onRemoveTag={(tagId) => void handleRemoveTagFromNote(tagId)}
            onCreateTag={handleCreateTag}
            onDeleteTag={(tagId) => void handleDeleteTag(tagId)}
            isNew={isNewNote}
          />
        </div>
      )}
    </div>
  );
}

export default App;
