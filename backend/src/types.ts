export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string; // normalized (trimmed) display name
  createdAt: string;
}

export interface NoteTagAssociation {
  noteId: string;
  tagId: string;
}

export interface CreateNoteRequest {
  title: string;
  body: string;
}

export interface UpdateNoteRequest {
  title: string;
  body: string;
}

export interface NotesStore {
  notes: Note[];
  tags?: Tag[];
  noteTagAssociations?: NoteTagAssociation[];
}
