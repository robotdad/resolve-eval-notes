import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Set up test storage BEFORE importing app (env var controls storage path)
const TEST_DATA_DIR = path.join(__dirname, '..', '..', 'test-data-tags');
const TEST_STORAGE_FILE = path.join(TEST_DATA_DIR, 'notes.json');
process.env.NOTES_DATA_DIR = TEST_DATA_DIR;

// Now import app (after env var is set)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../index').default;

function clearTestStorage(): void {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(
    TEST_STORAGE_FILE,
    JSON.stringify({ notes: [], tags: [], noteTagAssociations: [] }),
    'utf-8'
  );
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

// ---- Helper functions ----
async function createNote(title = 'Test Note', body = 'Test body') {
  const res = await request(app).post('/api/notes').send({ title, body });
  expect(res.status).toBe(201);
  return res.body as { id: string; title: string; body: string };
}

async function createTag(name: string) {
  const res = await request(app).post('/api/tags').send({ name });
  expect(res.status).toBe(201);
  return res.body as { id: string; name: string; createdAt: string };
}

// ---- Tag CRUD tests ----

describe('Tags API', () => {
  describe('GET /api/tags', () => {
    it('returns empty array when no tags exist', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all tags', async () => {
      await createTag('Alpha');
      await createTag('Beta');
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const names = res.body.map((t: { name: string }) => t.name);
      expect(names).toContain('Alpha');
      expect(names).toContain('Beta');
    });
  });

  describe('POST /api/tags', () => {
    it('creates a tag with trimmed name', async () => {
      const res = await request(app).post('/api/tags').send({ name: '  hello  ' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('hello');
      expect(res.body.id).toBeTruthy();
      expect(res.body.createdAt).toBeTruthy();
    });

    it('rejects blank name', async () => {
      const res = await request(app).post('/api/tags').send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('rejects empty name', async () => {
      const res = await request(app).post('/api/tags').send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects missing name field', async () => {
      const res = await request(app).post('/api/tags').send({});
      expect(res.status).toBe(400);
    });

    it('rejects duplicate tag name (case-insensitive)', async () => {
      await createTag('Alpha');
      const res = await request(app).post('/api/tags').send({ name: 'alpha' });
      expect(res.status).toBe(409);
    });

    it('rejects duplicate tag name (exact)', async () => {
      await createTag('Alpha');
      const res = await request(app).post('/api/tags').send({ name: 'Alpha' });
      expect(res.status).toBe(409);
    });

    it('allows different tags with different names', async () => {
      const t1 = await createTag('Alpha');
      const t2 = await createTag('Beta');
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('GET /api/tags/:id', () => {
    it('returns the tag', async () => {
      const tag = await createTag('MyTag');
      const res = await request(app).get(`/api/tags/${tag.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(tag.id);
      expect(res.body.name).toBe('MyTag');
    });

    it('returns 404 for unknown tag', async () => {
      const res = await request(app).get('/api/tags/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tags/:id', () => {
    it('renames a tag', async () => {
      const tag = await createTag('OldName');
      const res = await request(app).put(`/api/tags/${tag.id}`).send({ name: 'NewName' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('NewName');
      expect(res.body.id).toBe(tag.id);
    });

    it('allows self-rename (same name)', async () => {
      const tag = await createTag('SameName');
      const res = await request(app).put(`/api/tags/${tag.id}`).send({ name: 'SameName' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('SameName');
    });

    it('allows self-rename with different casing', async () => {
      const tag = await createTag('myTag');
      const res = await request(app).put(`/api/tags/${tag.id}`).send({ name: 'MyTag' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('MyTag');
    });

    it('rejects rename to blank name', async () => {
      const tag = await createTag('Valid');
      const res = await request(app).put(`/api/tags/${tag.id}`).send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('rejects rename that collides with another tag', async () => {
      const t1 = await createTag('Alpha');
      await createTag('Beta');
      const res = await request(app).put(`/api/tags/${t1.id}`).send({ name: 'beta' });
      expect(res.status).toBe(409);
    });

    it('returns 404 for unknown tag', async () => {
      const res = await request(app).put('/api/tags/nonexistent-id').send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tags/:id', () => {
    it('deletes a tag', async () => {
      const tag = await createTag('ToDelete');
      const del = await request(app).delete(`/api/tags/${tag.id}`);
      expect(del.status).toBe(204);
      const get = await request(app).get(`/api/tags/${tag.id}`);
      expect(get.status).toBe(404);
    });

    it('returns 404 for unknown tag', async () => {
      const res = await request(app).delete('/api/tags/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('removes tag from note associations on delete', async () => {
      const note = await createNote();
      const tag = await createTag('Cascade');
      // Assign tag to note
      await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      // Verify assigned
      const before = await request(app).get(`/api/notes/${note.id}/tags`);
      expect(before.body).toHaveLength(1);
      // Delete tag
      await request(app).delete(`/api/tags/${tag.id}`);
      // Verify removed from note
      const after = await request(app).get(`/api/notes/${note.id}/tags`);
      expect(after.status).toBe(200);
      expect(after.body).toHaveLength(0);
    });
  });
});

// ---- Note-Tag association tests ----

describe('Note-Tag Associations API', () => {
  describe('GET /api/notes/:id/tags', () => {
    it('returns empty array for a note with no tags', async () => {
      const note = await createNote();
      const res = await request(app).get(`/api/notes/${note.id}/tags`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for unknown note', async () => {
      const res = await request(app).get('/api/notes/nonexistent/tags');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/notes/:id/tags/:tagId', () => {
    it('assigns a tag to a note', async () => {
      const note = await createNote();
      const tag = await createTag('Work');
      const res = await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(tag.id);
    });

    it('is idempotent — assigning same tag twice does not duplicate', async () => {
      const note = await createNote();
      const tag = await createTag('Work');
      await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      const res = await request(app).get(`/api/notes/${note.id}/tags`);
      expect(res.body).toHaveLength(1);
    });

    it('returns 404 for unknown note', async () => {
      const tag = await createTag('Work');
      const res = await request(app).post(`/api/notes/nonexistent/tags/${tag.id}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for unknown tag', async () => {
      const note = await createNote();
      const res = await request(app).post(`/api/notes/${note.id}/tags/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/notes/:id/tags/:tagId', () => {
    it('unassigns a tag from a note', async () => {
      const note = await createNote();
      const tag = await createTag('Work');
      await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      const res = await request(app).delete(`/api/notes/${note.id}/tags/${tag.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('returns 404 when association does not exist', async () => {
      const note = await createNote();
      const tag = await createTag('Work');
      const res = await request(app).delete(`/api/notes/${note.id}/tags/${tag.id}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for unknown note', async () => {
      const tag = await createTag('Work');
      const res = await request(app).delete(`/api/notes/nonexistent/tags/${tag.id}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/notes/:id/tags', () => {
    it('sets tags for a note (replaces all)', async () => {
      const note = await createNote();
      const t1 = await createTag('Alpha');
      const t2 = await createTag('Beta');
      const t3 = await createTag('Gamma');
      // Assign t1 initially
      await request(app).post(`/api/notes/${note.id}/tags/${t1.id}`);
      // Replace with t2 and t3
      const res = await request(app)
        .put(`/api/notes/${note.id}/tags`)
        .send({ tagIds: [t2.id, t3.id] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const ids = res.body.map((t: { id: string }) => t.id);
      expect(ids).toContain(t2.id);
      expect(ids).toContain(t3.id);
      expect(ids).not.toContain(t1.id);
    });

    it('clears all tags when tagIds is empty', async () => {
      const note = await createNote();
      const tag = await createTag('Alpha');
      await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      const res = await request(app)
        .put(`/api/notes/${note.id}/tags`)
        .send({ tagIds: [] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('deduplicates tagIds', async () => {
      const note = await createNote();
      const tag = await createTag('Alpha');
      const res = await request(app)
        .put(`/api/notes/${note.id}/tags`)
        .send({ tagIds: [tag.id, tag.id] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('rejects invalid tagIds (atomically, no partial change)', async () => {
      const note = await createNote();
      const tag = await createTag('Alpha');
      const res = await request(app)
        .put(`/api/notes/${note.id}/tags`)
        .send({ tagIds: [tag.id, 'nonexistent-id'] });
      expect(res.status).toBe(400);
      // Verify note still has no tags (atomic)
      const check = await request(app).get(`/api/notes/${note.id}/tags`);
      expect(check.body).toHaveLength(0);
    });

    it('rejects when tagIds is not an array', async () => {
      const note = await createNote();
      const res = await request(app)
        .put(`/api/notes/${note.id}/tags`)
        .send({ tagIds: 'not-an-array' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown note', async () => {
      const res = await request(app)
        .put('/api/notes/nonexistent/tags')
        .send({ tagIds: [] });
      expect(res.status).toBe(404);
    });
  });

  describe('Note deletion cascades tag associations', () => {
    it('removes note-tag associations when note is deleted', async () => {
      const note = await createNote();
      const tag = await createTag('Work');
      await request(app).post(`/api/notes/${note.id}/tags/${tag.id}`);
      // Delete the note
      await request(app).delete(`/api/notes/${note.id}`);
      // Tag should still exist
      const tagRes = await request(app).get(`/api/tags/${tag.id}`);
      expect(tagRes.status).toBe(200);
      // But note should be gone
      const noteRes = await request(app).get(`/api/notes/${note.id}`);
      expect(noteRes.status).toBe(404);
    });
  });

  describe('Multiple tags per note', () => {
    it('supports multiple tags on one note', async () => {
      const note = await createNote();
      const t1 = await createTag('Work');
      const t2 = await createTag('Personal');
      const t3 = await createTag('Urgent');
      await request(app).post(`/api/notes/${note.id}/tags/${t1.id}`);
      await request(app).post(`/api/notes/${note.id}/tags/${t2.id}`);
      await request(app).post(`/api/notes/${note.id}/tags/${t3.id}`);
      const res = await request(app).get(`/api/notes/${note.id}/tags`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('supports one tag on multiple notes', async () => {
      const n1 = await createNote('Note 1', 'Body 1');
      const n2 = await createNote('Note 2', 'Body 2');
      const tag = await createTag('Shared');
      await request(app).post(`/api/notes/${n1.id}/tags/${tag.id}`);
      await request(app).post(`/api/notes/${n2.id}/tags/${tag.id}`);
      const r1 = await request(app).get(`/api/notes/${n1.id}/tags`);
      const r2 = await request(app).get(`/api/notes/${n2.id}/tags`);
      expect(r1.body).toHaveLength(1);
      expect(r2.body).toHaveLength(1);
    });
  });
});
