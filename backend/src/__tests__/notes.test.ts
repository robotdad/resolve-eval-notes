import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Set up test storage BEFORE importing app (env var controls storage path)
const TEST_DATA_DIR = path.join(__dirname, '..', '..', 'test-data');
const TEST_STORAGE_FILE = path.join(TEST_DATA_DIR, 'notes.json');
process.env.NOTES_DATA_DIR = TEST_DATA_DIR;

// Now import app (after env var is set)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../index').default;

function clearTestStorage(): void {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(TEST_STORAGE_FILE, JSON.stringify({ notes: [] }), 'utf-8');
}

beforeAll(() => {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
});

beforeEach(() => {
  clearTestStorage();
});

afterAll(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
});

describe('Notes API', () => {
  describe('GET /api/notes', () => {
    it('returns empty array when no notes exist', async () => {
      const res = await request(app).get('/api/notes');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all notes', async () => {
      await request(app).post('/api/notes').send({ title: 'Note A', body: 'Body A' });
      await request(app).post('/api/notes').send({ title: 'Note B', body: 'Body B' });

      const res = await request(app).get('/api/notes');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST /api/notes', () => {
    it('creates a note with title and body', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note', body: 'My Body' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'My Note', body: 'My Body' });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('creates a note with empty body', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'Empty Body Note', body: '' });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe('');
    });

    it('rejects blank title (empty string)', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({ title: '', body: 'Some body' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/non-blank/i);
    });

    it('rejects whitespace-only title', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({ title: '   ', body: 'Some body' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/non-blank/i);
    });

    it('allows duplicate titles as distinct notes', async () => {
      const res1 = await request(app)
        .post('/api/notes')
        .send({ title: 'Duplicate', body: 'First' });
      const res2 = await request(app)
        .post('/api/notes')
        .send({ title: 'Duplicate', body: 'Second' });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.id).not.toBe(res2.body.id);

      const listRes = await request(app).get('/api/notes');
      expect(listRes.body).toHaveLength(2);
    });

    it('creates notes with multiline bodies', async () => {
      const multilineBody = 'Line 1\nLine 2\nLine 3';
      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'Multiline', body: multilineBody });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe(multilineBody);
    });
  });

  describe('GET /api/notes/:id', () => {
    it('returns a specific note by ID', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'Test', body: 'Body' });
      const id = createRes.body.id;

      const res = await request(app).get(`/api/notes/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.title).toBe('Test');
      expect(res.body.body).toBe('Body');
    });

    it('returns 404 for non-existent note', async () => {
      const res = await request(app).get('/api/notes/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('updates a note title and body', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'Original', body: 'Original body' });
      const id = createRes.body.id;

      const res = await request(app)
        .put(`/api/notes/${id}`)
        .send({ title: 'Updated', body: 'Updated body' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.title).toBe('Updated');
      expect(res.body.body).toBe('Updated body');
    });

    it('preserves ID when updating', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'Original', body: 'Body' });
      const id = createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/notes/${id}`)
        .send({ title: 'New Title', body: 'New Body' });

      expect(updateRes.body.id).toBe(id);
    });

    it('does not affect other notes when updating', async () => {
      const res1 = await request(app)
        .post('/api/notes')
        .send({ title: 'Note 1', body: 'Body 1' });
      const res2 = await request(app)
        .post('/api/notes')
        .send({ title: 'Note 2', body: 'Body 2' });

      await request(app)
        .put(`/api/notes/${res1.body.id}`)
        .send({ title: 'Note 1 Updated', body: 'Body 1 Updated' });

      const checkRes = await request(app).get(`/api/notes/${res2.body.id}`);
      expect(checkRes.body.title).toBe('Note 2');
      expect(checkRes.body.body).toBe('Body 2');
      expect(checkRes.body.id).toBe(res2.body.id);
    });

    it('rejects blank title on update', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'Original', body: 'Body' });

      const res = await request(app)
        .put(`/api/notes/${createRes.body.id}`)
        .send({ title: '  ', body: 'Body' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent note', async () => {
      const res = await request(app)
        .put('/api/notes/nonexistent-id')
        .send({ title: 'Title', body: 'Body' });

      expect(res.status).toBe(404);
    });

    it('handles duplicate-title notes independently by ID', async () => {
      const res1 = await request(app)
        .post('/api/notes')
        .send({ title: 'Duplicate', body: 'First body' });
      const res2 = await request(app)
        .post('/api/notes')
        .send({ title: 'Duplicate', body: 'Second body' });

      await request(app)
        .put(`/api/notes/${res1.body.id}`)
        .send({ title: 'Duplicate', body: 'First body EDITED' });

      const checkRes = await request(app).get(`/api/notes/${res2.body.id}`);
      expect(checkRes.body.body).toBe('Second body');
      expect(checkRes.body.id).toBe(res2.body.id);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('deletes a note by ID', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'To Delete', body: 'Body' });
      const id = createRes.body.id;

      const deleteRes = await request(app).delete(`/api/notes/${id}`);
      expect(deleteRes.status).toBe(204);

      const getRes = await request(app).get(`/api/notes/${id}`);
      expect(getRes.status).toBe(404);
    });

    it('does not delete other notes', async () => {
      const res1 = await request(app)
        .post('/api/notes')
        .send({ title: 'Keep This', body: 'Body' });
      const res2 = await request(app)
        .post('/api/notes')
        .send({ title: 'Delete This', body: 'Body' });

      await request(app).delete(`/api/notes/${res2.body.id}`);

      const checkRes = await request(app).get(`/api/notes/${res1.body.id}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.title).toBe('Keep This');
    });

    it('returns 404 for non-existent note', async () => {
      const res = await request(app).delete('/api/notes/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('deletes by identity when titles are duplicated', async () => {
      const res1 = await request(app)
        .post('/api/notes')
        .send({ title: 'Duplicate', body: 'First' });
      const res2 = await request(app)
        .post('/api/notes')
        .send({ title: 'Duplicate', body: 'Second' });

      await request(app).delete(`/api/notes/${res1.body.id}`);

      const checkRes = await request(app).get(`/api/notes/${res2.body.id}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.body).toBe('Second');
    });
  });

  describe('Persistence', () => {
    it('persists notes to storage file', async () => {
      await request(app)
        .post('/api/notes')
        .send({ title: 'Persistent Note', body: 'Persistent Body' });

      const stored = JSON.parse(fs.readFileSync(TEST_STORAGE_FILE, 'utf-8'));
      expect(stored.notes).toHaveLength(1);
      expect(stored.notes[0].title).toBe('Persistent Note');
    });
  });

  describe('GET /api/storage-info', () => {
    it('returns storage path', async () => {
      const res = await request(app).get('/api/storage-info');
      expect(res.status).toBe(200);
      expect(res.body.storagePath).toBeDefined();
      expect(typeof res.body.storagePath).toBe('string');
    });
  });
});
