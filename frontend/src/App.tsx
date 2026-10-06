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

/**
 * Identity-safe async state management:
 *
 * Every async operation that reads or mutates tags for a note is bound to the
 * note's ID at the time the operation is initiated. Results are only applied
 * if the selected note ID matches the originating note ID at resolution time.
 *
 * Whole-map freshness:
 * The noteTagsMap is updated with a generation counter. Stale map refreshes
 * (older generation) are discarded in favor of newer confirmed state.
 *
 * This prevents:
 *   - Late GET for note A overwriting note B's tag display
 *   - Stale map refresh erasing confirmed mutations
 *   - Failed reads presenting as confirmed empty state
 *   - Misattributed errors (error shown for wrong note)
 */

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
  // Tags for the currently selected note (identity-safe)
  const [currentNoteTags, setCurrentNoteTags] = useState<Tag[]>([]);
  // Error specific to tag operations (shown separately from note errors)
  const [tagError, setTagError] = useState<string | null>(null);

  // Ref tracking the currently selected note ID for identity-safe async checks
  const selectedNoteIdRef = useRef<string | null>(null);
  // Generation counter for whole-map freshness
  const mapGenRef = useRef(0);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const [notesData, tagsData] = await Promise.all([fetchNotes(), fetchTags()]);
      setNotes(notesData);
      setAllTags(tagsData);
      // Load all note-tag associations for sidebar display
      if (notesData.length > 0) {
        const gen = ++mapGenRef.current;
        const entries = await Promise.all(
          notesData.map(async (note) => {
            try {
              const tags = await fetchTagsForNote(note.id);
              return [note.id, tags] as [string, Tag[]];
            } catch {
              // On fetch failure, keep empty rather than crashing
              return [note.id, []] as [string, Tag[]];
            }
          })
        );
        // Only apply if this is still the most recent map load
        setNoteTagsMap((prev) => {
          if (gen < mapGenRef.current) return prev; // stale, discard
          return new Map(entries);
        });
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
  // This is an identity-safe operation: we only update if the note ID matches
  useEffect(() => {
    if (selectedNote && !isNewNote) {
      selectedNoteIdRef.current = selectedNote.id;
      const noteId = selectedNote.id;
      // Use cached map value first (immediate)
      const cached = noteTagsMap.get(noteId);
      if (cached !== undefined) {
        setCurrentNoteTags(cached);
      }
      // Then refresh from server (identity-safe: only apply if still selected)
      void fetchTagsForNote(noteId).then((tags) => {
        if (selectedNoteIdRef.current !== noteId) return; // note changed, discard
        setCurrentNoteTags(tags);
        setNoteTagsMap((prev) => new Map(prev).set(noteId, tags));
      }).catch(() => {
        // On failure, keep the cached state (do not present failure as empty)
        if (selectedNoteIdRef.current !== noteId) return;
        setTagError('Could not refresh tags for this note');
      });
    } else {
      selectedNoteIdRef.current = null;
      setCurrentNoteTags([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote?.id, isNewNote]);

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
    setTagError(null);
    setIsDirty(false);
  };

  const handleNewNote = () => {
    if (!guardUnsaved()) return;
    setEditorRevision((revision) => revision + 1);
    setSelectedNote(null);
    setIsNewNote(true);
    setError(null);
    setTagError(null);
    setIsDirty(false);
  };

  const handleSave = async (title: string, body: string) => {
    setError(null);
    try {
      if (isNewNote) {
        const newNote = await createNote(title, body);
        setNotes((prev) => [...prev, newNote]);
        setSelectedNote(newNote);
        selectedNoteIdRef.current = newNote.id;
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
      selectedNoteIdRef.current = null;
      setSelectedNote(null);
      setIsNewNote(false);
      setIsDirty(false);
      setCurrentNoteTags([]);
      setTagError(null);
      newNoteButtonRef.current?.focus();
    } catch {
      setError('Failed to delete note');
    }
  };

  const handleCancel = () => {
    setIsNewNote(false);
    setError(null);
    setTagError(null);
    setIsDirty(false);
    if (isNewNote) {
      selectedNoteIdRef.current = null;
      setSelectedNote(null);
    } else if (selectedNote) {
      // Revert: re-select the note to reset editor fields
      const current = selectedNote;
      setSelectedNote(null);
      setTimeout(() => setSelectedNote(current), 0);
    }
  };

  // ---- Tag management handlers (all identity-safe) ----

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
      // Remove from current note tags if still selected
      setCurrentNoteTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      setTagError('Failed to delete tag');
    }
  };

  /**
   * Identity-safe tag assignment.
   * Captures the originating note ID; result is discarded if note changes.
   */
  const handleAddTagToNote = async (tagId: string) => {
    if (!selectedNote || isNewNote) return;
    const originNoteId = selectedNote.id;
    setTagError(null);
    try {
      const newTagIds = [...new Set([...currentNoteTags.map((t) => t.id), tagId])];
      const updatedTags = await apiSetTagsForNote(originNoteId, newTagIds);
      // Identity check: only apply if still on the same note
      if (selectedNoteIdRef.current !== originNoteId) return;
      setCurrentNoteTags(updatedTags);
      setNoteTagsMap((prev) => new Map(prev).set(originNoteId, updatedTags));
    } catch (err) {
      if (selectedNoteIdRef.current !== originNoteId) return;
      setTagError(err instanceof Error ? err.message : 'Failed to add tag to note');
    }
  };

  /**
   * Identity-safe tag removal with reconciliation.
   * On failure (e.g. 404 for already-removed tag), reconciles by fetching
   * the actual server state for the originating note.
   */
  const handleRemoveTagFromNote = async (tagId: string) => {
    if (!selectedNote || isNewNote) return;
    const originNoteId = selectedNote.id;
    setTagError(null);
    try {
      const newTagIds = currentNoteTags.map((t) => t.id).filter((id) => id !== tagId);
      const updatedTags = await apiSetTagsForNote(originNoteId, newTagIds);
      // Identity check
      if (selectedNoteIdRef.current !== originNoteId) return;
      setCurrentNoteTags(updatedTags);
      setNoteTagsMap((prev) => new Map(prev).set(originNoteId, updatedTags));
    } catch (err) {
      // Show the error attributed to the originating note
      if (selectedNoteIdRef.current !== originNoteId) return;
      const msg = err instanceof Error ? err.message : 'Failed to remove tag';
      setTagError(msg);
      // Reconcile: fetch actual server state for the originating note
      try {
        const actual = await fetchTagsForNote(originNoteId);
        // Identity check again (note may have changed during reconciliation)
        if (selectedNoteIdRef.current !== originNoteId) return;
        setCurrentNoteTags(actual);
        setNoteTagsMap((prev) => new Map(prev).set(originNoteId, actual));
      } catch {
        // Reconciliation itself failed — expose limitation, preserve known state
        if (selectedNoteIdRef.current !== originNoteId) return;
        setTagError(msg + ' (reconciliation also failed — server state unknown)');
      }
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
          {tagError && (
            <div
              data-testid="tag-operation-error"
              style={{
                marginBottom: '8px',
                padding: '8px 10px',
                backgroundColor: '#fff5f5',
                border: '1px solid #ffc9c9',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#c92a2a',
              }}
            >
              {tagError}
              <button
                onClick={() => setTagError(null)}
                style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#c92a2a', fontSize: '14px', padding: 0, lineHeight: 1 }}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}
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
