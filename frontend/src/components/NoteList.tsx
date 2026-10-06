import { useState, type RefObject } from 'react';
import { Note, Tag } from '../types';

interface NoteListProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (note: Note) => void;
  onNew: () => void;
  newButtonRef: RefObject<HTMLButtonElement>;
  /** All available tags (for tag-filter UI) */
  allTags?: Tag[];
  /** Map from noteId to its assigned tags (for rendering chips and filtering) */
  noteTagsMap?: Map<string, Tag[]>;
  /** Called when the active tag filter changes (null = no filter) */
  onTagFilterChange?: (tagId: string | null) => void;
}

/**
 * Search semantics:
 *   - Case-folding: toLowerCase() on both query and note fields (Unicode-safe for BMP characters).
 *   - Match condition: folded query is a literal substring of folded title OR folded body.
 *   - Empty query: all notes are shown (no filtering).
 *   - Regex metacharacters and HTML-like text are treated as literal characters.
 *   - Unsaved editor text is never the search source; only saved note title/body are used.
 *
 * Sort semantics:
 *   - Choices: ascending (A→Z) and descending (Z→A) by title.
 *   - Comparison uses folded title (toLowerCase()).
 *   - Tie policy: equal folded titles are ordered by note ID (lexicographic ascending),
 *     providing a deterministic, stable tie ordering independent of insertion order.
 *   - Sorting changes presentation only; note identity and saved content are unchanged.
 *
 * Tag filter semantics:
 *   - At most ONE tag can be selected at a time (single-tag filter).
 *   - Selecting a tag that is already active DESELECTS it (acts as a toggle).
 *   - Selecting a DIFFERENT tag replaces the prior filter (single active tag).
 *   - Tag filter is applied after text search (composed intersection).
 *   - Selecting no tag shows all notes (no tag filtering).
 *   - When the active filter tag is deleted externally, the filter is cleared immediately.
 *
 * L-01 reproduction:
 *   assign Work to note-a and note-z, Personal to note-m.
 *   Select Work -> note-a and note-z shown.
 *   Then select Personal -> Work is replaced, only note-m shown.
 *
 * L-02 reproduction:
 *   Delete the active filter tag -> filter cleared immediately.
 *   Surviving notes appear without restart.
 */

type SortDirection = 'asc' | 'desc';

function foldTitle(title: string): string {
  return title.toLowerCase();
}

function sortNotes(notes: Note[], direction: SortDirection): Note[] {
  return [...notes].sort((a, b) => {
    const fa = foldTitle(a.title);
    const fb = foldTitle(b.title);
    if (fa < fb) return direction === 'asc' ? -1 : 1;
    if (fa > fb) return direction === 'asc' ? 1 : -1;
    // Tie policy: order by ID ascending (deterministic)
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function filterNotes(notes: Note[], query: string): Note[] {
  if (query === '') return notes;
  const folded = query.toLowerCase();
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(folded) ||
      n.body.toLowerCase().includes(folded)
  );
}

function filterByTag(
  notes: Note[],
  activeTagId: string | null,
  noteTagsMap: Map<string, Tag[]>
): Note[] {
  if (!activeTagId) return notes;
  return notes.filter((n) => {
    const noteTags = noteTagsMap.get(n.id) ?? [];
    return noteTags.some((t) => t.id === activeTagId);
  });
}

export function NoteList({
  notes,
  selectedId,
  onSelect,
  onNew,
  newButtonRef,
  allTags = [],
  noteTagsMap = new Map(),
  onTagFilterChange,
}: NoteListProps) {
  const [query, setQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Single active tag filter (null = no filter)
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  // If the active tag was deleted externally, clear the filter
  const activeTagExists = activeTagId ? allTags.some((t) => t.id === activeTagId) : true;
  const effectiveTagId = activeTagExists ? activeTagId : null;

  // Apply text filter, then single-tag filter, then sort
  const textFiltered = filterNotes(notes, query);
  const tagFiltered = filterByTag(textFiltered, effectiveTagId, noteTagsMap);
  const displayed = sortNotes(tagFiltered, sortDirection);

  const handleClear = () => {
    setQuery('');
  };

  const handleClearTagFilter = () => {
    setActiveTagId(null);
    onTagFilterChange?.(null);
  };

  const toggleTagFilter = (tagId: string) => {
    const next = activeTagId === tagId ? null : tagId;
    setActiveTagId(next);
    onTagFilterChange?.(next);
  };

  const hasTagFilter = !!effectiveTagId;
  const isEmpty = notes.length === 0;
  const noResults = !isEmpty && displayed.length === 0;

  return (
    <div style={{ width: '280px', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Notes</h2>
        <button
          ref={newButtonRef}
          onClick={onNew}
          style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          + New
        </button>
      </div>

      {/* Search control */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label htmlFor="note-search" style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>
            Search:
          </label>
          <input
            id="note-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes by title or body"
            data-testid="search-input"
            style={{ flex: 1, fontSize: '13px', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', minWidth: 0 }}
          />
          {query !== '' && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              data-testid="clear-search"
              style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#555' }}>Sort:</span>
          <button
            onClick={() => setSortDirection('asc')}
            aria-label="Sort ascending (A to Z)"
            aria-pressed={sortDirection === 'asc'}
            data-testid="sort-asc"
            style={{
              padding: '3px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: sortDirection === 'asc' ? '#007bff' : '#e9ecef',
              color: sortDirection === 'asc' ? 'white' : '#333',
              border: '1px solid ' + (sortDirection === 'asc' ? '#007bff' : '#ced4da'),
              borderRadius: '4px',
            }}
          >
            A→Z
          </button>
          <button
            onClick={() => setSortDirection('desc')}
            aria-label="Sort descending (Z to A)"
            aria-pressed={sortDirection === 'desc'}
            data-testid="sort-desc"
            style={{
              padding: '3px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: sortDirection === 'desc' ? '#007bff' : '#e9ecef',
              color: sortDirection === 'desc' ? 'white' : '#333',
              border: '1px solid ' + (sortDirection === 'desc' ? '#007bff' : '#ced4da'),
              borderRadius: '4px',
            }}
          >
            Z→A
          </button>
        </div>

        {/* Tag filter — single-select, clicking active tag deselects, clicking different tag replaces */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#555' }}>Filter by tag:</span>
              {hasTagFilter && (
                <button
                  onClick={handleClearTagFilter}
                  aria-label="Clear tag filter"
                  data-testid="clear-tag-filter"
                  style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Clear
                </button>
              )}
            </div>
            <div
              data-testid="tag-filter-list"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
            >
              {allTags.map((tag) => {
                const active = effectiveTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    aria-pressed={active}
                    aria-label={`Filter by tag: ${tag.name}`}
                    data-testid={`tag-filter-${tag.id}`}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      backgroundColor: active ? '#1971c2' : '#d0ebff',
                      color: active ? 'white' : '#1971c2',
                      border: '1px solid ' + (active ? '#1971c2' : '#74c0fc'),
                      borderRadius: '12px',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Note list */}
      <div data-testid="note-list" style={{ overflowY: 'auto', flex: 1 }}>
        {isEmpty ? (
          <p style={{ padding: '16px', color: '#666', textAlign: 'center' }}>No notes yet. Create one!</p>
        ) : noResults ? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ color: '#666', marginBottom: '8px' }} data-testid="no-results">
              No notes match{query ? ` "${query}"` : ''}{hasTagFilter ? ' with selected tag' : ''}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
              {query && (
                <button
                  onClick={handleClear}
                  aria-label="Clear search to show all notes"
                  data-testid="no-results-clear"
                  style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Clear search
                </button>
              )}
              {hasTagFilter && (
                <button
                  onClick={handleClearTagFilter}
                  aria-label="Clear tag filter to show more notes"
                  data-testid="no-results-clear-tags"
                  style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Clear tag filter
                </button>
              )}
            </div>
          </div>
        ) : (
          displayed.map((note) => {
            const tags = noteTagsMap.get(note.id) ?? [];
            return (
              <div
                key={note.id}
                data-testid="note-item"
                onClick={() => onSelect(note)}
                role="button"
                tabIndex={0}
                aria-label={`Select note: ${note.title}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(note); } }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: selectedId === note.id ? '#e8f0fe' : 'transparent',
                  borderBottom: '1px solid #f0f0f0',
                  borderLeft: selectedId === note.id ? '3px solid #007bff' : '3px solid transparent',
                }}
              >
                <div data-testid="note-item-title" style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.title}
                </div>
                <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.body || '(empty)'}
                </div>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                    {tags.map((t) => (
                      <span
                        key={t.id}
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          backgroundColor: '#d0ebff',
                          color: '#1971c2',
                          borderRadius: '10px',
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
