import { chromium, errors, Page } from '@playwright/test';
import { test, expect, create, reset, notes, newButton, modal } from './fixtures';

async function discard(page: Page, action: () => Promise<unknown>, accept: boolean) {
  const dialog = page.waitForEvent('dialog');
  const pending = action();
  const prompt = await dialog;
  expect(prompt.type()).toBe('confirm');
  expect(prompt.message()).toBe('You have unsaved changes. Discard them and continue?');
  if (accept) await prompt.accept(); else await prompt.dismiss();
  await pending;
}

test.beforeEach(async ({ request }) => { await reset(request); });

test('baseline CRUD, validation, duplicate identities, save-clears-dirty and editor cancel', async ({ page, request }) => {
  await page.goto('/');
  await newButton(page).click();
  await page.getByTestId('title-input').fill('   ');
  await page.getByTestId('save-button').click();
  await expect(page.getByText('Title must be a non-blank string', { exact: true })).toBeVisible();
  expect(await notes(request)).toEqual([]);
  await discard(page, () => newButton(page).click(), true);
  const first = await create(page, 'Synthetic same title', '');
  const second = await create(page, 'Synthetic same title', 'Distinct body');
  expect(second.id).not.toBe(first.id);
  await page.getByText('(empty)', { exact: true }).click();
  await page.getByTestId('title-input').fill('Updated synthetic');
  await page.getByTestId('body-input').fill('Saved multiline\nbody');
  await page.getByTestId('save-button').click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
  const updated = await notes(request);
  expect(updated[0]).toMatchObject({ id: first.id, title: 'Updated synthetic', body: 'Saved multiline\nbody', createdAt: first.createdAt });
  expect(updated[1]).toEqual(second);
  await page.getByTestId('body-input').fill('cancel this draft');
  await page.getByTestId('cancel-button').click();
  await expect(page.getByTestId('body-input')).toHaveValue('Saved multiline\nbody');
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
  // A clean navigation must not prompt. Catch a regression explicitly.
  const unexpected: string[] = [];
  page.on('dialog', async dialog => { unexpected.push(dialog.message()); await dialog.dismiss(); });
  await newButton(page).click();
  await expect(page.getByTestId('title-input')).toHaveValue('');
  expect(unexpected).toEqual([]);
});

test('new-to-new and same-note discard reset, decline preserves exact draft; unload protection', async ({ page, request }) => {
  await page.goto('/');
  const saved = await create(page, 'Synthetic persisted', 'Original body');
  await newButton(page).click();
  await page.getByTestId('title-input').fill(' new draft ');
  await page.getByTestId('body-input').fill('new draft body\n');
  await discard(page, () => newButton(page).click(), false);
  await expect(page.getByTestId('title-input')).toHaveValue(' new draft ');
  await expect(page.getByTestId('body-input')).toHaveValue('new draft body\n');
  await discard(page, () => newButton(page).click(), true);
  await expect(page.getByTestId('title-input')).toHaveValue('');
  await expect(page.getByTestId('body-input')).toHaveValue('');
  await page.getByText('Synthetic persisted', { exact: true }).click();
  await page.getByTestId('body-input').fill('dirty same-note body');
  await discard(page, () => page.getByText('Synthetic persisted', { exact: true }).click(), false);
  await expect(page.getByTestId('body-input')).toHaveValue('dirty same-note body');
  await discard(page, () => page.getByText('Synthetic persisted', { exact: true }).click(), true);
  await expect(page.getByTestId('body-input')).toHaveValue('Original body');
  const draft = { title: ' unload draft title ', body: 'unload draft\n  exact  ' };
  await page.getByTestId('title-input').fill(draft.title);
  await page.getByTestId('body-input').fill(draft.body);
  const dialogSeen = page.waitForEvent('dialog', { timeout: 2500 });
  // Chromium keeps waiting for load after dismissal. Bound that wait, then
  // discriminate its timeout from arbitrary errors or a completed navigation.
  const reload = page.reload({ timeout: 2500 }).then(() => null, (error: unknown) => error);
  const dialog = await dialogSeen;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  const reloadError = await reload;
  expect(reloadError).toBeInstanceOf(errors.TimeoutError);
  expect(reloadError).toHaveProperty('message', expect.stringContaining('page.reload: Timeout 2500ms exceeded'));
  await expect(page.getByTestId('title-input')).toHaveValue(draft.title);
  await expect(page.getByTestId('body-input')).toHaveValue(draft.body);
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  expect(await notes(request)).toEqual([saved]);
});

for (const mode of ['new', 'existing'] as const) {
  for (const target of ['New', 'other note'] as const) {
    test(`failed save retains ${mode} dirty draft and guards ${target} navigation`, async ({ page, request }) => {
      await page.goto('/');
      const other = await create(page, 'Other synthetic', 'Other body');
      const selected = await create(page, 'Selected synthetic', 'Saved selected body');
      if (mode === 'new') await newButton(page).click();
      const before = await notes(request);
      await page.getByTestId('title-input').fill('Synthetic failed-save title');
      await page.getByTestId('body-input').fill('Failed-save exact body\n ');
      await page.route('**/api/notes**', route => ['POST', 'PUT'].includes(route.request().method())
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic save failure' }) })
        : route.continue());
      await page.getByTestId('save-button').click();
      await expect(page.getByText('Synthetic save failure', { exact: true })).toBeVisible();
      await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
      const navigate = () => target === 'New' ? newButton(page).click() : page.getByText('Other synthetic', { exact: true }).click();
      await discard(page, navigate, false);
      await expect(page.getByTestId('title-input')).toHaveValue('Synthetic failed-save title');
      await expect(page.getByTestId('body-input')).toHaveValue('Failed-save exact body\n ');
      expect(await notes(request)).toEqual(before);
      await discard(page, navigate, true);
      await expect(page.getByTestId('title-input')).toHaveValue(target === 'New' ? '' : other.title);
      await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
      expect(await notes(request)).toEqual([other, selected]);
    });
  }
}

test('full browser + backend Node + frontend restart preserves exact saved data, not unsaved draft', async ({ stack, request }, testInfo) => {
  // No fixture browser: close the actual browser process, not merely its page.
  let browser = await chromium.launch({ chromiumSandbox: true });
  try {
    let page = await browser.newPage({ baseURL: 'http://127.0.0.1:43171' });
    await page.goto('/');
    const keep = await create(page, 'Synthetic restart keep', 'Persistent body\nwith whitespace ');
    await create(page, 'Synthetic restart deleted', 'Should not return');
    await page.getByTestId('delete-button').click();
    await modal(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(newButton(page)).toBeFocused();
    await page.getByText(keep.title, { exact: true }).click();
    await page.getByTestId('body-input').fill('Saved restart update');
    await page.getByTestId('save-button').click();
    await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
    const expected = await notes(request);
    await page.getByTestId('body-input').fill('UNSAVED must not survive');
    await browser.close();
    const restarted = await stack.restart(); // same synthetic disk store; both old processes terminated
    browser = await chromium.launch({ chromiumSandbox: true });
    page = await browser.newPage({ baseURL: 'http://127.0.0.1:43171' });
    await page.goto('/');
    expect(await notes(request)).toEqual(expected);
    await page.getByText(keep.title, { exact: true }).click();
    await expect(page.getByTestId('body-input')).toHaveValue('Saved restart update');
    await expect(page.getByText('Synthetic restart deleted', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
    await testInfo.attach('restart-receipt', { body: JSON.stringify({ restarted, expected }), contentType: 'application/json' });
  } finally { await browser.close(); }
});