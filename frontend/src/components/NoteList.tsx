import { Note } from '../types';

interface NoteListProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (note: Note) => void;
  onNew: () => void;
}

export function NoteList({ notes, selectedId, onSelect, onNew }: NoteListProps) {
  return (
    <div style={{ width: '280px', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Notes</h2>
        <button
          onClick={onNew}
          style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          + New
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notes.length === 0 ? (
          <p style={{ padding: '16px', color: '#666', textAlign: 'center' }}>No notes yet. Create one!</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelect(note)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: selectedId === note.id ? '#e8f0fe' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
                borderLeft: selectedId === note.id ? '3px solid #007bff' : '3px solid transparent',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
