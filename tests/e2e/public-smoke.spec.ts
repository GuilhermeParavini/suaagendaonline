import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type JsIssue = {
  kind: 'pageerror' | 'console';
  text: string;
  url?: string;
};

const MAIN_ROUTES = ['/', '/termos', '/privacidade', '/login', '/cadastro', '/esqueci-senha'] as const;
function shouldIgnoreConsole(message: ConsoleMessage): boolean {
  const type = message.type();
  const text = message.text();

  if (!['error', 'assert'].includes(type)) return true;
  if (/favicon/i.test(text)) return true;
  if (/Failed to load resource: the server responded with a status of 404/i.test(text) && /favicon/i.test(text)) return true;
  if (/chrome-extension:|extension:/i.test(text)) return true;
  if (/ERR_BLOCKED_BY_CLIENT/i.test(text)) return true;
  if (/Non-Error promise rejection captured/i.test(text)) return true;

  return false;
}

function attachJsCollectors(page: Page, issues: JsIssue[]) {
  page.on('pageerror', (error) => {
    issues.push({ kind: 'pageerror', text: error.message });
  });
  page.on('console', (message) => {
    if (!shouldIgnoreConsole(message)) {
      issues.push({
        kind: 'console',
        text: `[${message.type()}] ${message.text()}`,
        url: message.location().url || undefined,
      });
    }
  });
}

async function gotoAndAssertOk(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `No response for ${path}`).not.toBeNull();
  expect(response!.status(), `Unexpected HTTP status for ${path}`).toBeLessThan(400);
}

async function expectNoCriticalJsIssues(issues: JsIssue[], route: string) {
  expect.soft(issues, `Critical JS issues detected on ${route}: ${JSON.stringify(issues, null, 2)}`).toEqual([]);
}

test.describe('Public smoke read-only', () => {
  test('PS01 - Home', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/');
    await expect(page).toHaveTitle(/Agenda4U|Sua Agenda Online/i);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoCriticalJsIssues(issues, '/');
  });

  test('PS02 - Termos', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/termos');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: /termos de uso/i })).toBeVisible();
    await expectNoCriticalJsIssues(issues, '/termos');
  });

  test('PS03 - Privacidade', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/privacidade');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: /privacidade/i })).toBeVisible();
    await expectNoCriticalJsIssues(issues, '/privacidade');
  });

  test('PS04 - Login', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/login');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar|acessar/i })).toBeVisible();
    await expectNoCriticalJsIssues(issues, '/login');
  });

  test('PS05 - Cadastro', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/cadastro');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /cadastro|criar|começar|gratis|grátis/i }).first()).toBeVisible();
    await expectNoCriticalJsIssues(issues, '/cadastro');
  });

  test('PS06 - Recuperação de senha', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/esqueci-senha');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByText(/senha|e-mail|email/i).first()).toBeVisible();
    await expectNoCriticalJsIssues(issues, '/esqueci-senha');
  });

  test('PS07 - Manifest PWA', async ({ request, baseURL }) => {
    const response = await request.get(new URL('/manifest.json', baseURL).toString());
    expect(response.status()).toBeLessThan(400);
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: expect.any(String),
      short_name: expect.any(String),
      display: expect.any(String),
      icons: expect.any(Array),
    });
    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('PS08 - Service Worker', async ({ request, baseURL }) => {
    const response = await request.get(new URL('/sw.js', baseURL).toString());
    expect(response.status()).toBeLessThan(400);
    const body = await response.text();
    expect(body).toContain('Service Worker');
  });

  test('PS09 - Assets principais', async ({ request, baseURL }) => {
    for (const asset of ['/icon-192.png', '/icon-512.png', '/icon.svg']) {
      const response = await request.get(new URL(asset, baseURL).toString());
      expect(response.status(), `Asset failed: ${asset}`).toBeLessThan(400);
    }
  });

  test('PS10 - Navegação pública básica', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    await gotoAndAssertOk(page, '/');
    await page.locator('footer').getByRole('link', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: /termos/i }).click();
    await expect(page).toHaveURL(/\/termos$/);
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: /privacidade/i }).click();
    await expect(page).toHaveURL(/\/privacidade$/);
    await expectNoCriticalJsIssues(issues, 'public navigation');
  });

  test('PS11 - Erros JavaScript críticos', async ({ page }) => {
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    for (const route of MAIN_ROUTES) {
      await gotoAndAssertOk(page, route);
    }

    await expectNoCriticalJsIssues(issues, 'public routes bundle');
  });

  test('PS12 - Responsividade básica', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const issues: JsIssue[] = [];
    attachJsCollectors(page, issues);

    for (const route of ['/', '/login', '/cadastro']) {
      await gotoAndAssertOk(page, route);
      await expect(page.locator('main, form').first()).toBeVisible();
    }

    await expectNoCriticalJsIssues(issues, 'mobile public routes');
    await context.close();
  });
});
