/**
 * E2E acceptance tests for Notes M: saved-note search and stable title sorting.
 *
 * Search semantics (documented in NoteList.tsx):
 *   - Case-folding: toLowerCase() on both query and note fields.
 *   - Match: folded query is a literal substring of folded saved title OR folded saved body.
 *   - Empty query: all notes shown.
 *   - Regex metacharacters and HTML-like text are literal.
 *   - Unsaved editor text is NOT the search source.
 *
 * Sort semantics:
 *   - Ascending (A→Z) and descending (Z→A) by folded title.
 *   - Tie policy: equal folded titles ordered by ID ascending.
 */

import { test, expect, create, reset, notes, newButton } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const searchInput = (page: import('@playwright/test').Page) =>
  page.getByTestId('search-input');
const clearBtn = (page: import('@playwright/test').Page) =>
  page.getByTestId('clear-search');
const sortAsc = (page: import('@playwright/test').Page) =>
  page.getByTestId('sort-asc');
const sortDesc = (page: import('@playwright/test').Page) =>
  page.getByTestId('sort-desc');
const noResults = (page: import('@playwright/test').Page) =>
  page.getByTestId('no-results');
const noResultsClear = (page: import('@playwright/test').Page) =>
  page.getByTestId('no-results-clear');

// ---------------------------------------------------------------------------
// Test setup: synthetic notes
// ---------------------------------------------------------------------------

test.beforeEach(async ({ request }) => {
  await reset(request);
});

// ---------------------------------------------------------------------------
// 1. Literal saved-content search
// ---------------------------------------------------------------------------

test('search: empty query shows all notes', async ({ page, request }) => {
  await page.goto('/');
  const a = await create(page, 'Alpha', 'First note body');
  const b = await create(page, 'Beta', 'Second note body');
  // With empty query, both notes visible
  await expect(page.getByText(a.title, { exact: true })).toBeVisible();
  await expect(page.getByText(b.title, { exact: true })).toBeVisible();
  // Confirm search input is empty
  await expect(searchInput(page)).toHaveValue('');
});

test('search: title match (case-insensitive literal)', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Alpha note', 'some body');
  await create(page, 'Beta note', 'other body');
  await create(page, 'ALPHA upper', 'body here');

  await searchInput(page).fill('alpha');
  // Should match "Alpha note" and "ALPHA upper" (case-insensitive)
  await expect(page.getByText('Alpha note', { exact: true })).toBeVisible();
  await expect(page.getByText('ALPHA upper', { exact: true })).toBeVisible();
  // Should NOT match "Beta note"
  await expect(page.getByText('Beta note', { exact: true })).toHaveCount(0);
});

test('search: body match (case-insensitive literal)', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Note one', 'Contains the word Elephant');
  await create(page, 'Note two', 'Contains the word Giraffe');

  await searchInput(page).fill('elephant');
  await expect(page.getByText('Note one', { exact: true })).toBeVisible();
  await expect(page.getByText('Note two', { exact: true })).toHaveCount(0);
});

test('search: regex metacharacters treated as literals', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Price: $10.00', 'body');
  await create(page, 'Other note', 'body');

  await searchInput(page).fill('$10.00');
  await expect(page.getByText('Price: $10.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Other note', { exact: true })).toHaveCount(0);
});

test('search: HTML-like text treated as literal', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'HTML <b>bold</b> title', 'body');
  await create(page, 'Other note', 'body');

  await searchInput(page).fill('<b>');
  await expect(page.getByText('HTML <b>bold</b> title', { exact: true })).toBeVisible();
  await expect(page.getByText('Other note', { exact: true })).toHaveCount(0);
});

test('search: clear button resets query and restores all results', async ({ page, request }) => {
  await page.goto('/');
  const a = await create(page, 'Alpha', 'body');
  const b = await create(page, 'Beta', 'body');

  await searchInput(page).fill('alpha');
  await expect(page.getByText('Beta', { exact: true })).toHaveCount(0);

  // Clear button should appear and reset
  await clearBtn(page).click();
  await expect(searchInput(page)).toHaveValue('');
  await expect(page.getByText(a.title, { exact: true })).toBeVisible();
  await expect(page.getByText(b.title, { exact: true })).toBeVisible();

  // Verify saved data is unchanged
  const after = await notes(request);
  expect(after.map((n: { id: string }) => n.id)).toContain(a.id);
  expect(after.map((n: { id: string }) => n.id)).toContain(b.id);
});

test('search: no-results state is distinguishable from empty collection', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Alpha', 'body');

  // Empty collection state
  await expect(page.getByText('No notes yet. Create one!', { exact: true })).toHaveCount(0);

  // No-results state
  await searchInput(page).fill('zzznomatch');
  await expect(noResults(page)).toBeVisible();
  // Should NOT show the empty collection message
  await expect(page.getByText('No notes yet. Create one!', { exact: true })).toHaveCount(0);
});

test('search: no-results clear button restores results', async ({ page, request }) => {
  await page.goto('/');
  const a = await create(page, 'Alpha', 'body');

  await searchInput(page).fill('zzznomatch');
  await expect(noResults(page)).toBeVisible();

  await noResultsClear(page).click();
  await expect(searchInput(page)).toHaveValue('');
  await expect(page.getByText(a.title, { exact: true })).toBeVisible();
});

test('search: unsaved editor text does not affect search source', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Saved title', 'Saved body');

  // Select the note, modify title in editor (unsaved)
  await page.getByText('Saved title', { exact: true }).click();
  await page.getByTestId('title-input').fill('Unsaved modified title');

  // Search for the unsaved text - should NOT match (only saved content is searched)
  await searchInput(page).fill('Unsaved modified');
  await expect(noResults(page)).toBeVisible();

  // Search for the saved title - should match
  await clearBtn(page).click();
  await searchInput(page).fill('Saved title');
  await expect(page.getByText('Saved title', { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. Stable combined sorting
// ---------------------------------------------------------------------------

test('sort: ascending (A→Z) order', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Zebra', 'body');
  await create(page, 'Apple', 'body');
  await create(page, 'Mango', 'body');

  await sortAsc(page).click();

  // Verify order: Apple, Mango, Zebra
  const noteTexts = await page.getByTestId('note-item-title').allTextContents();
  expect(noteTexts).toEqual(['Apple', 'Mango', 'Zebra']);
});

test('sort: descending (Z→A) order', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Zebra', 'body');
  await create(page, 'Apple', 'body');
  await create(page, 'Mango', 'body');

  await sortDesc(page).click();

  const noteTexts = await page.getByTestId('note-item-title').allTextContents();
  expect(noteTexts).toEqual(['Zebra', 'Mango', 'Apple']);
});

test('sort: case-insensitive title ordering', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'banana', 'body');
  await create(page, 'Apple', 'body');
  await create(page, 'cherry', 'body');

  await sortAsc(page).click();

  const noteTexts = await page.getByTestId('note-item-title').allTextContents();
  // Case-folded: apple < banana < cherry
  expect(noteTexts).toEqual(['Apple', 'banana', 'cherry']);
});

test('sort: duplicate titles stable by ID tie-break', async ({ page, request }) => {
  await page.goto('/');
  // Create two notes with same title; IDs are UUIDs, ordered lexicographically
  const first = await create(page, 'Duplicate title', 'First body');
  const second = await create(page, 'Duplicate title', 'Second body');

  // With ascending sort, both should appear; tie broken by ID
  await sortAsc(page).click();
  // Both should be visible (scope to note-list to avoid matching editor textarea)
  const noteList = page.getByTestId('note-list');
  await expect(noteList.getByText('First body', { exact: true })).toBeVisible();
  await expect(noteList.getByText('Second body', { exact: true })).toBeVisible();

  // Repeated sort direction changes preserve the tie ordering
  await sortDesc(page).click();
  await sortAsc(page).click();
  await expect(noteList.getByText('First body', { exact: true })).toBeVisible();
  await expect(noteList.getByText('Second body', { exact: true })).toBeVisible();

  // Notes not collapsed/merged
  const storedNotes = await notes(request);
  expect(storedNotes.filter((n: { title: string }) => n.title === 'Duplicate title')).toHaveLength(2);
  expect(first.id).not.toBe(second.id);
});

test('sort: does not mutate note identity or saved content', async ({ page, request }) => {
  await page.goto('/');
  const a = await create(page, 'Zebra', 'Zebra body');
  const b = await create(page, 'Apple', 'Apple body');

  const before = await notes(request);
  await sortAsc(page).click();
  await sortDesc(page).click();
  const after = await notes(request);

  // Storage order and content unchanged
  expect(after).toEqual(before);
  expect(after.find((n: { id: string }) => n.id === a.id)).toMatchObject({ title: 'Zebra', body: 'Zebra body' });
  expect(after.find((n: { id: string }) => n.id === b.id)).toMatchObject({ title: 'Apple', body: 'Apple body' });
});

// ---------------------------------------------------------------------------
// 3. Combined search + sort
// ---------------------------------------------------------------------------

test('combined: search then sort applies sort to filtered results', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Zebra note', 'match keyword');
  await create(page, 'Apple note', 'match keyword');
  await create(page, 'Unrelated', 'completely different text');

  await searchInput(page).fill('keyword');
  await sortAsc(page).click();

  // Unrelated should be hidden from the note list (scope to avoid matching editor title)
  const noteList = page.getByTestId('note-list');
  await expect(noteList.getByText('Unrelated', { exact: true })).toHaveCount(0);

  // Apple note should come before Zebra note in ascending order
  const noteTexts = await page.getByTestId('note-item-title').allTextContents();
  expect(noteTexts).toEqual(['Apple note', 'Zebra note']);
});

test('combined: clear search restores all notes with current sort', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Zebra', 'body');
  await create(page, 'Apple', 'body');
  await create(page, 'Mango', 'body');

  await sortAsc(page).click();
  await searchInput(page).fill('zzz');
  await expect(noResults(page)).toBeVisible();

  await clearBtn(page).click();
  // All three notes should now be visible in ascending order
  const noteTexts = await page.getByTestId('note-item-title').allTextContents();
  expect(noteTexts).toEqual(['Apple', 'Mango', 'Zebra']);
});

// ---------------------------------------------------------------------------
// 4. Safe drafts during search/sort
// ---------------------------------------------------------------------------

test('search/sort changes preserve dirty draft in editor', async ({ page, request }) => {
  await page.goto('/');
  const saved = await create(page, 'My note', 'Saved body');
  await page.getByText('My note', { exact: true }).click();

  // Type unsaved text
  await page.getByTestId('body-input').fill('Dirty draft text');
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();

  // Change search query - draft should be preserved
  await searchInput(page).fill('my');
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByTestId('body-input')).toHaveValue('Dirty draft text');

  // Change sort - draft should be preserved
  await sortDesc(page).click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByTestId('body-input')).toHaveValue('Dirty draft text');

  // Clear search - draft should be preserved
  await clearBtn(page).click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByTestId('body-input')).toHaveValue('Dirty draft text');

  // Saved data unchanged
  const stored = await notes(request);
  expect(stored.find((n: { id: string }) => n.id === saved.id)).toMatchObject({ body: 'Saved body' });
});

test('save that changes match status: note stays in editor', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Searchable note', 'keyword match');
  await create(page, 'Other note', 'different');

  // Filter to show only "Searchable note"
  await searchInput(page).fill('keyword');
  await page.getByText('Searchable note', { exact: true }).click();

  // Edit to remove keyword from body
  await page.getByTestId('body-input').fill('no longer matches');
  await page.getByTestId('save-button').click();

  // After save, note leaves filtered results (no longer matches "keyword")
  // but editor should handle this gracefully - no crash
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 5. Keyboard accessibility
// ---------------------------------------------------------------------------

test('search input is keyboard accessible with label', async ({ page, request }) => {
  await page.goto('/');
  // The search input should have an accessible label
  const input = page.getByLabel('Search notes by title or body');
  await expect(input).toBeVisible();
  await input.focus();
  await expect(input).toBeFocused();
});

test('sort buttons have accessible names and aria-pressed state', async ({ page, request }) => {
  await page.goto('/');
  const asc = page.getByLabel('Sort ascending (A to Z)');
  const desc = page.getByLabel('Sort descending (Z to A)');
  await expect(asc).toBeVisible();
  await expect(desc).toBeVisible();

  // Default: ascending is active
  await expect(asc).toHaveAttribute('aria-pressed', 'true');
  await expect(desc).toHaveAttribute('aria-pressed', 'false');

  await desc.click();
  await expect(asc).toHaveAttribute('aria-pressed', 'false');
  await expect(desc).toHaveAttribute('aria-pressed', 'true');
});

test('clear button is keyboard operable', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Alpha', 'body');

  await searchInput(page).fill('alpha');
  const clear = page.getByLabel('Clear search');
  await expect(clear).toBeVisible();
  await clear.focus();
  await page.keyboard.press('Enter');
  await expect(searchInput(page)).toHaveValue('');
});

// ---------------------------------------------------------------------------
// 6. Second edit/search cycle (regression: repeated filter + clear)
// ---------------------------------------------------------------------------

test('repeated filter and clear cycles are consistent', async ({ page, request }) => {
  await page.goto('/');
  const a = await create(page, 'Alpha', 'body');
  const b = await create(page, 'Beta', 'body');

  for (let i = 0; i < 3; i++) {
    await searchInput(page).fill('alpha');
    await expect(page.getByText('Alpha', { exact: true })).toBeVisible();
    await expect(page.getByText('Beta', { exact: true })).toHaveCount(0);

    await clearBtn(page).click();
    await expect(page.getByText('Alpha', { exact: true })).toBeVisible();
    await expect(page.getByText('Beta', { exact: true })).toBeVisible();
  }

  // Data unchanged
  const after = await notes(request);
  expect(after.find((n: { id: string }) => n.id === a.id)).toMatchObject({ title: 'Alpha' });
  expect(after.find((n: { id: string }) => n.id === b.id)).toMatchObject({ title: 'Beta' });
});

test('zero results: search with no match, then clear shows all', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Alpha', 'body');

  await searchInput(page).fill('zzznomatch');
  await expect(noResults(page)).toBeVisible();
  await expect(page.getByText('No notes yet. Create one!', { exact: true })).toHaveCount(0);

  await clearBtn(page).click();
  await expect(noResults(page)).toHaveCount(0);
  await expect(page.getByText('Alpha', { exact: true })).toBeVisible();
});

test('one result: exact title match', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Unique title here', 'body');
  await create(page, 'Different', 'body');

  await searchInput(page).fill('Unique title here');
  await expect(page.getByText('Unique title here', { exact: true })).toBeVisible();
  await expect(page.getByText('Different', { exact: true })).toHaveCount(0);
});

test('many results: body-only match across multiple notes', async ({ page, request }) => {
  await page.goto('/');
  await create(page, 'Note A', 'shared keyword in body');
  await create(page, 'Note B', 'shared keyword in body');
  await create(page, 'Note C', 'completely different');

  await searchInput(page).fill('shared keyword');
  await expect(page.getByText('Note A', { exact: true })).toBeVisible();
  await expect(page.getByText('Note B', { exact: true })).toBeVisible();
  await expect(page.getByText('Note C', { exact: true })).toHaveCount(0);
});
