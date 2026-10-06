import { test, expect, create, reset, notes, modal, newButton } from './fixtures';

// Synthetic notes only; selectors target the actual app, not invented test IDs.
test.beforeEach(async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await create(page, 'Synthetic duplicate', 'Selected body');
});

test('1. accessible named modal and description, without aria-hidden correction', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', message => { if (/aria-hidden|blocked.*aria/i.test(message.text())) warnings.push(message.text()); });
  await page.getByTestId('delete-button').click();
  const dialog = modal(page); // Default role lookup MUST work; no includeHidden shortcut.
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName('Delete Note?');
  await expect(dialog).toHaveAccessibleDescription('Are you sure you want to delete "Synthetic duplicate"? This cannot be undone.');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate(element => element.closest('[aria-hidden="true"]'))).toBeNull();
  const session = await page.context().newCDPSession(page);
  const { nodes } = await session.send('Accessibility.getFullAXTree');
  expect(nodes.some(node => !node.ignored && node.role?.value === 'alertdialog' && node.name?.value === 'Delete Note?')).toBeTruthy();
  await session.detach();
  expect(warnings).toEqual([]);
});

test('2. Cancel receives initial keyboard focus', async ({ page }) => {
  await page.getByTestId('delete-button').focus();
  await page.keyboard.press('Enter');
  await expect(modal(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
});

test('3/4. repeated forward and reverse Tab containment plus genuine background pointer blocking', async ({ page, request }) => {
  const before = await notes(request);
  const background = await newButton(page).boundingBox();
  expect(background).not.toBeNull();
  await page.getByTestId('delete-button').click();
  const cancel = modal(page).getByRole('button', { name: 'Cancel', exact: true });
  const confirm = modal(page).getByRole('button', { name: 'Delete', exact: true });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab'); await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab'); await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(confirm).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(cancel).toBeFocused();
  }
  await page.mouse.click(background!.x + background!.width / 2, background!.y + background!.height / 2);
  await expect(modal(page)).toBeVisible();
  await expect(page.getByTestId('title-input')).toHaveValue('Synthetic duplicate');
  expect(await notes(request)).toEqual(before);
});

for (const exit of ['Escape', 'Cancel'] as const) {
  test(`5/6. ${exit} preserves exact dirty draft and restores trigger without mutation`, async ({ page, request }) => {
    const before = await notes(request);
    const title = '  synthetic dirty title  ';
    const body = 'Unsaved synthetic body\n  whitespace preserved  ';
    await page.getByTestId('title-input').fill(title);
    await page.getByTestId('body-input').fill(body);
    await page.getByTestId('delete-button').click();
    if (exit === 'Escape') await page.keyboard.press('Escape');
    else await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByTestId('delete-button')).toBeFocused();
    await expect(page.getByTestId('title-input')).toHaveValue(title);
    await expect(page.getByTestId('body-input')).toHaveValue(body);
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    expect(await notes(request)).toEqual(before);
  });
}

test('6. keyboard confirmation deletes only selected duplicate; New receives focus, including last note', async ({ page, request }) => {
  const survivor = (await notes(request))[0];
  const target = await create(page, 'Synthetic duplicate', 'Target duplicate');
  const unrelated = await create(page, 'Unrelated synthetic', 'Leave this unchanged');
  await page.getByText('Target duplicate', { exact: true }).click();
  await page.getByTestId('body-input').fill('Unsaved target text');
  await page.getByTestId('delete-button').click();
  await page.keyboard.press('Tab');
  await expect(modal(page).getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(modal(page)).toHaveCount(0);
  await expect(newButton(page)).toBeFocused();
  expect((await notes(request)).map((note: { id: string }) => note.id)).not.toContain(target.id);
  expect(await notes(request)).toEqual([survivor, unrelated]);
  for (const remaining of [unrelated, survivor]) {
    await page.getByText(remaining.body, { exact: true }).click();
    await page.getByTestId('delete-button').click();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(newButton(page)).toBeFocused();
  }
  expect(await notes(request)).toEqual([]);
  await expect(page.getByText('No notes yet. Create one!', { exact: true })).toBeVisible();
});
