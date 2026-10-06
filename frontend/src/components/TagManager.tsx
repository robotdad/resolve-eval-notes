import { useState, useRef, useEffect } from 'react';
import { Tag } from '../types';

interface TagManagerProps {
  /** All tags in the system */
  allTags: Tag[];
  /** Tags currently assigned to the note being edited */
  noteTags: Tag[];
  /** Called when a tag is added to the note */
  onAddTag: (tagId: string) => void;
  /** Called when a tag is removed from the note */
  onRemoveTag: (tagId: string) => void;
  /** Called to create a new global tag (returns the created tag, or throws) */
  onCreateTag: (name: string) => Promise<Tag>;
  /** Called to delete a global tag (and all its associations) */
  onDeleteTag: (tagId: string) => void;
  /** Whether the editor is in "new note" mode (tags cannot be assigned before save) */
  isNew: boolean;
}

/**
 * TagManager — inline tag panel for the NoteEditor.
 *
 * Responsibilities:
 *   - Show tags assigned to the current note as removable chips.
 *   - Let the user assign existing tags from a dropdown list.
 *   - Let the user create a new global tag (case-insensitive unique name).
 *   - Let the user delete a global tag (with confirmation, warns about cascade).
 *
 * When `isNew` is true the panel shows a notice that tags can be assigned after saving.
 */
export function TagManager({
  allTags,
  noteTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onDeleteTag,
  isNew,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when delete dialog opens
  useEffect(() => {
    if (tagToDelete && cancelDeleteRef.current) {
      cancelDeleteRef.current.focus();
    }
  }, [tagToDelete]);

  const noteTagIds = new Set(noteTags.map((t) => t.id));
  const unassignedTags = allTags.filter((t) => !noteTagIds.has(t.id));

  const handleAddTag = (tagId: string) => {
    if (!tagId) return;
    onAddTag(tagId);
  };

  const handleRemoveTag = (tagId: string) => {
    onRemoveTag(tagId);
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      setCreateError('Tag name cannot be blank');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const tag = await onCreateTag(name);
      setNewTagName('');
      // Auto-assign the new tag to the note if not in new-note mode
      if (!isNew) {
        onAddTag(tag.id);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTagRequest = (tag: Tag) => {
    setTagToDelete(tag);
  };

  const handleDeleteTagConfirm = () => {
    if (tagToDelete) {
      onDeleteTag(tagToDelete.id);
      setTagToDelete(null);
    }
  };

  const handleDeleteTagCancel = () => {
    setTagToDelete(null);
  };

  if (isNew) {
    return (
      <div
        data-testid="tag-manager"
        style={{
          marginTop: '12px',
          padding: '10px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #dee2e6',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: '#6c757d' }}>
          Save the note first to assign tags.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="tag-manager"
      style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
      }}
    >
      {/* Delete confirmation dialog */}
      {tagToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-tag-dialog-title"
            aria-describedby="delete-tag-dialog-desc"
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
            }}
          >
            <h3 id="delete-tag-dialog-title" style={{ margin: '0 0 12px 0' }}>
              Delete Tag?
            </h3>
            <p id="delete-tag-dialog-desc" style={{ margin: '0 0 20px 0', color: '#555' }}>
              Delete tag &quot;{tagToDelete.name}&quot;? It will be removed from all notes. This
              cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                ref={cancelDeleteRef}
                onClick={handleDeleteTagCancel}
                data-testid="cancel-delete-tag"
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Cancel
              </button>
              <button
                ref={confirmDeleteRef}
                onClick={handleDeleteTagConfirm}
                data-testid="confirm-delete-tag"
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Delete Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>
        Tags
      </div>

      {/* Assigned tags */}
      <div
        data-testid="note-tags"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}
      >
        {noteTags.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#adb5bd' }}>No tags assigned.</span>
        ) : (
          noteTags.map((tag) => (
            <span
              key={tag.id}
              data-testid="tag-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: '#d0ebff',
                color: '#1971c2',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                aria-label={`Remove tag ${tag.name}`}
                data-testid={`remove-tag-${tag.id}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                  color: '#1971c2',
                  fontSize: '14px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* Assign existing tag */}
      {unassignedTags.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <label
            htmlFor="assign-tag-select"
            style={{ fontSize: '12px', color: '#495057', whiteSpace: 'nowrap' }}
          >
            Add tag:
          </label>
          <select
            id="assign-tag-select"
            data-testid="assign-tag-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                handleAddTag(e.target.value);
                e.target.value = '';
              }
            }}
            style={{
              fontSize: '12px',
              padding: '3px 6px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            <option value="" disabled>
              -- select a tag --
            </option>
            {unassignedTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Create new tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <label
          htmlFor="new-tag-input"
          style={{ fontSize: '12px', color: '#495057', whiteSpace: 'nowrap' }}
        >
          New tag:
        </label>
        <input
          id="new-tag-input"
          ref={newTagInputRef}
          type="text"
          value={newTagName}
          onChange={(e) => {
            setNewTagName(e.target.value);
            setCreateError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreateTag();
            }
          }}
          placeholder="Tag name"
          data-testid="new-tag-input"
          style={{
            fontSize: '12px',
            padding: '3px 6px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            flex: 1,
          }}
        />
        <button
          onClick={() => void handleCreateTag()}
          disabled={isCreating}
          data-testid="create-tag-button"
          style={{
            fontSize: '12px',
            padding: '3px 10px',
            cursor: isCreating ? 'default' : 'pointer',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          {isCreating ? 'Creating…' : 'Create'}
        </button>
      </div>
      {createError && (
        <div
          data-testid="create-tag-error"
          style={{ fontSize: '12px', color: '#dc3545', marginBottom: '4px' }}
        >
          {createError}
        </div>
      )}

      {/* Manage (delete) global tags */}
      {allTags.length > 0 && (
        <details style={{ marginTop: '8px' }}>
          <summary
            style={{ fontSize: '12px', color: '#6c757d', cursor: 'pointer', userSelect: 'none' }}
          >
            Manage tags
          </summary>
          <div
            data-testid="manage-tags-list"
            style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            {allTags.map((tag) => (
              <div
                key={tag.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <span>{tag.name}</span>
                <button
                  onClick={() => handleDeleteTagRequest(tag)}
                  aria-label={`Delete tag ${tag.name}`}
                  data-testid={`delete-tag-${tag.id}`}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
