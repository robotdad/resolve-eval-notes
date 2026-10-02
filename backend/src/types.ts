export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
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
}
