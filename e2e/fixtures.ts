import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import { createStack } from '../test-support/stack.cjs';

type Stack = Awaited<ReturnType<typeof createStack>>;
export const test = base.extend<{}, { stack: Stack }>({
  stack: [async ({}, use) => {
    const stack = await createStack();
    try { await stack.start(); await use(stack); }
    finally { await stack.dispose(); }
  }, { scope: 'worker', auto: true }],
});
export { expect };
export const newButton = (page: Page) => page.getByRole('button', { name: '+ New', exact: true });
export const modal = (page: Page) => page.getByRole('alertdialog', { name: 'Delete Note?', exact: true });
export async function notes(request: APIRequestContext) {
  const response = await request.get('/api/notes');
  expect(response.ok()).toBeTruthy();
  return response.json();
}
export async function reset(request: APIRequestContext) {
  for (const note of await notes(request)) {
    expect((await request.delete(`/api/notes/${note.id}`)).ok()).toBeTruthy();
  }
}
export async function create(page: Page, title: string, body: string) {
  await newButton(page).click();
  await page.getByTestId('title-input').fill(title);
  await page.getByTestId('body-input').fill(body);
  const saved = page.waitForResponse(response => response.url().endsWith('/api/notes') && response.request().method() === 'POST');
  await page.getByTestId('save-button').click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
  return response.json();
}