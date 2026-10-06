import { useState, type RefObject } from 'react';
import { Note } from '../types';

interface NoteListProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (note: Note) => void;
  onNew: () => void;
  newButtonRef: RefObject<HTMLButtonElement>;
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

export function NoteList({ notes, selectedId, onSelect, onNew, newButtonRef }: NoteListProps) {
  const [query, setQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Apply filter then sort
  const filtered = filterNotes(notes, query);
  const displayed = sortNotes(filtered, sortDirection);

  const handleClear = () => {
    setQuery('');
  };

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
      </div>

      {/* Note list */}
      <div data-testid="note-list" style={{ overflowY: 'auto', flex: 1 }}>
        {isEmpty ? (
          <p style={{ padding: '16px', color: '#666', textAlign: 'center' }}>No notes yet. Create one!</p>
        ) : noResults ? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ color: '#666', marginBottom: '8px' }} data-testid="no-results">
              No notes match &ldquo;{query}&rdquo;.
            </p>
            <button
              onClick={handleClear}
              aria-label="Clear search to show all notes"
              data-testid="no-results-clear"
              style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Clear search
            </button>
          </div>
        ) : (
          displayed.map((note) => (
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
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                {new Date(note.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
