import { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';

interface NoteEditorProps {
  note: Note | null;
  isNew: boolean;
  onSave: (title: string, body: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  error: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function NoteEditor({ note, isNew, onSave, onDelete, onCancel, error, onDirtyChange }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Refs for focus management
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setBody(note.body);
      setIsDirty(false);
    } else if (isNew) {
      setTitle('');
      setBody('');
      setIsDirty(false);
    }
    setShowDeleteConfirm(false);
  }, [note, isNew]);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Browser unload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // Modern browsers show their own message; this string is ignored by most
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Focus the Cancel button when the dialog opens
  useEffect(() => {
    if (showDeleteConfirm && cancelDeleteRef.current) {
      cancelDeleteRef.current.focus();
    }
  }, [showDeleteConfirm]);

  // Focus trap handler for the dialog
  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowDeleteConfirm(false);
      // Restore focus to the Delete button
      deleteButtonRef.current?.focus();
      return;
    }

    if (e.key === 'Tab') {
      const focusableElements = dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute('disabled'))
        : [];

      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    const savedTitle = note?.title ?? '';
    const savedBody = note?.body ?? '';
    setIsDirty(isNew ? (value.length > 0 || body.length > 0) : (value !== savedTitle || body !== savedBody));
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    const savedTitle = note?.title ?? '';
    const savedBody = note?.body ?? '';
    setIsDirty(isNew ? (title.length > 0 || value.length > 0) : (title !== savedTitle || value !== savedBody));
  };

  if (!note && !isNew) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        <p>Select a note or create a new one</p>
      </div>
    );
  }

  const handleSave = () => {
    onSave(title, body);
    // A successful save supplies a new note prop and resets the editor.
    // Keep the draft dirty while the request is pending or if it fails.
  };

  const handleDeleteRequest = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    // Restore focus to the Delete button
    deleteButtonRef.current?.focus();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', height: '100vh', boxSizing: 'border-box', position: 'relative' }}>
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            onKeyDown={handleDialogKeyDown}
            style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}
          >
            <h3 id="delete-dialog-title" style={{ margin: '0 0 12px 0' }}>Delete Note?</h3>
            <p id="delete-dialog-desc" style={{ margin: '0 0 20px 0', color: '#555' }}>
              Are you sure you want to delete &quot;{note?.title}&quot;? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                ref={cancelDeleteRef}
                onClick={handleDeleteCancel}
                data-testid="cancel-delete"
                style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                ref={confirmDeleteRef}
                onClick={handleDeleteConfirm}
                data-testid="confirm-delete"
                style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{isNew ? 'New Note' : 'Edit Note'}</h2>
          {isDirty && (
            <span style={{ fontSize: '12px', color: '#856404', backgroundColor: '#fff3cd', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ffc107' }}>
              Unsaved changes
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isNew && note && (
            <button
              ref={deleteButtonRef}
              onClick={handleDeleteRequest}
              data-testid="delete-button"
              style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onCancel}
            data-testid="cancel-button"
            style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            data-testid="save-button"
            style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Save
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#f8d7da', color: '#842029', padding: '10px', borderRadius: '4px', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Note title (required)"
        data-testid="title-input"
        style={{ fontSize: '20px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #ddd', padding: '8px 0', marginBottom: '16px', outline: 'none', width: '100%' }}
      />

      <textarea
        value={body}
        onChange={(e) => handleBodyChange(e.target.value)}
        placeholder="Write your note here..."
        data-testid="body-input"
        style={{ flex: 1, fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
      />

      {note && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
          Created: {new Date(note.createdAt).toLocaleString()} &bull; Updated: {new Date(note.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
