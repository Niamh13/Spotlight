// UI-1..UI-10 from Spotlight_Test_Scenarios.docx.
//
// These focus on the interface layer itself, not business-flow correctness
// (that's e2e-flows.spec.js). Where a scenario is inherently visual (UI-4
// contrast, UI-9 responsive layout) and would really need screenshot-diffing
// to verify properly, the assertion here is a structural proxy instead - the
// comment on each such test says so explicitly rather than overclaiming
// coverage.
//
// Uses Sarah/Calvin/Jamie only for read-only navigation checks, never for a
// real submission, so this file has no persona-quarter-state dependency on
// e2e-flows.spec.js and can run before, after, or interleaved with it.

const { test, expect } = require('@playwright/test');
const { switchPersona, goToView, uniqueEmail } = require('./helpers');

test.describe('UI / GUI', () => {

  test('UI-1a (BUG, pinned as regression): submitting a fully empty form shows a generic '
    + '"Bad Request" banner instead of the field-level validation the help text promises', async ({ page }) => {
    // Root cause (confirmed directly against the API, not just the UI): the
    // <select> elements for category/coreValue default to value="", and the
    // client sends that empty string as-is. Jackson fails to deserialize ""
    // into the AwardCategory/CoreValue enum *before* @Valid ever runs, so the
    // request throws HttpMessageNotReadableException - an exception
    // GlobalExceptionHandler does not catch. It falls through to Spring
    // Boot's default error page: {"error":"Bad Request",...}, with no
    // per-field messages at all. The submit page's own "Validation" help
    // text says "Anything missed is flagged against the field when you
    // submit" - that promise is broken for the single most basic case: a
    // fully empty submit. This test pins the CURRENT (buggy) behavior so a
    // fix shows up here as a welcome failure, not a silent regression.
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const form = page.locator('#form');
    test.skip(!(await form.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run - see e2e-flows.spec.js for the same caveat.');

    await page.locator('#submitBtn').click();

    await expect(page.locator('#badBanner')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#badText')).toHaveText(/bad request/i);
    // The bug: no field gets an inline message, contradicting the promise
    // above the form.
    await expect(page.locator('[data-field="nomineeName"] .err')).toBeEmpty();
  });

  test('UI-1b: when category/coreValue ARE selected, missing string fields DO get inline '
    + 'per-field messages - isolating the bug in UI-1a to the enum-blank-string case', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const form = page.locator('#form');
    test.skip(!(await form.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run.');

    // Select a real category so Jackson deserialization succeeds; leave
    // every string field blank so @Valid's field-message map path runs.
    await page.locator('#category').selectOption('CUSTOMER_IMPACT');
    await page.locator('#submitBtn').click();

    const nomineeNameError = page.locator('[data-field="nomineeName"] .err');
    await expect(nomineeNameError).not.toBeEmpty({ timeout: 5_000 });
    const whatTextError = page.locator('[data-field="whatText"] .err');
    await expect(whatTextError).not.toBeEmpty();
  });

  test('UI-2: "Fill sample" populates every field validly, "Clear" wipes them all', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const form = page.locator('#form');
    test.skip(!(await form.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run.');

    await page.locator('#sampleBtn').click();
    await expect(page.locator('#nomineeName')).not.toHaveValue('');
    await expect(page.locator('#whatText')).not.toHaveValue('');
    await expect(page.locator('#category')).not.toHaveValue('');

    await page.locator('#clearBtn').click();
    await expect(page.locator('#nomineeName')).toHaveValue('');
    await expect(page.locator('#whatText')).toHaveValue('');
  });

  test('UI-3: theme choice persists across a reload', async ({ page }) => {
    await page.goto('/');

    const options = page.locator('#themeControl button, #themeControl [role="radio"], #themeControl input');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);

    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme')
      || document.body.getAttribute('data-theme'));

    for (let i = 0; i < count; i++) {
      await options.nth(i).click().catch(() => {});
      const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme')
        || document.body.getAttribute('data-theme'));
      if (after !== before) break;
    }

    const chosen = await page.evaluate(() => document.documentElement.getAttribute('data-theme')
      || document.body.getAttribute('data-theme'));

    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme')
      || document.body.getAttribute('data-theme'));

    expect(afterReload).toBe(chosen);
  });

  test('UI-4 (structural proxy): greyscale toggle applies and persists a state change', async ({ page }) => {
    // A full check ("no color-only information loss") needs visual/contrast
    // tooling this suite doesn't have. This proves the toggle itself works
    // and survives reload, which is the mechanical precondition for that
    // larger claim - it does not itself verify contrast or colorblind safety.
    await page.goto('/');
    const toggle = page.locator('#greyscaleToggle');
    const wasChecked = await toggle.isChecked();

    await toggle.click();
    await expect(toggle).toHaveJSProperty('checked', !wasChecked);

    await page.reload();
    await expect(toggle).toHaveJSProperty('checked', !wasChecked);
  });

  test('UI-5: switching persona changes visible nav items per role', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'sarah'); // EMPLOYEE
    await expect(page.locator('#nav a[href="#/queue"]')).toHaveCount(0);
    await expect(page.locator('#nav a[href="#/submit"]')).toHaveCount(1);

    await switchPersona(page, 'colette'); // COORDINATOR
    await expect(page.locator('#nav a[href="#/queue"]')).toHaveCount(1);
    await expect(page.locator('#nav a[href="#/dashboard"]')).toHaveCount(1);
  });

  test('UI-6: Review Queue badge count updates immediately after an approve, no page reload', async ({ page, request }) => {
    const created = await (await request.post('/api/nominations', {
      data: {
        nominatorName: 'UI Six Nominator', nominatorEmail: uniqueEmail('ui6-nominator'),
        nomineeName: 'UI Six Nominee', nomineeEmail: uniqueEmail('ui6-nominee'),
        practice: 'Consulting', location: 'Bengaluru',
        category: 'COLLABORATION_AND_ENGAGEMENT', coreValue: 'CUSTOMER_FIRST',
        whatText: 'They coordinated a joint fix across three teams during a client '
          + 'incident, cutting time to resolution from four hours to forty minutes.',
        howText: 'They put the client first, staying on the call past midnight and '
          + 'chasing every team themselves rather than waiting to be looped in.',
      },
    })).json();

    await page.goto('/');
    await switchPersona(page, 'colette');
    await goToView(page, 'queue');

    const badge = page.locator('#nav a[href="#/queue"] .badge-count');
    await expect(badge).toBeVisible({ timeout: 10_000 });
    const before = Number(await badge.textContent());

    const row = page.locator(`tr.clickable[data-id="${created.id}"]`);
    await row.click();
    await page.locator('[data-act="approve"]').click();
    await page.locator('#reasonConfirm').click();
    await expect(page.locator('.actionbar__label', { hasText: /already decided/i }))
      .toBeVisible({ timeout: 10_000 });

    // Same page, no reload() call - the badge must reflect the new count from
    // the SPA's own re-render.
    await expect(async () => {
      const after = Number(await badge.textContent());
      expect(after).toBe(before - 1);
    }).toPass({ timeout: 10_000 });
  });

  test('UI-7: placeholder screens (Praises Wall, Reports) are honestly labeled', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'colette');

    await goToView(page, 'praises');
    await expect(page.getByText(/built yet/i).first())
      .toBeVisible({ timeout: 10_000 });

    await goToView(page, 'reports');
    await expect(page.getByText(/built yet/i)).toBeVisible({ timeout: 10_000 });
  });

  test('UI-8: originalNominationId field is hidden on a fresh submission', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const form = page.locator('#form');
    test.skip(!(await form.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run.');

    await expect(page.locator('#resubWrap')).toBeHidden();
  });

  test('UI-9 (structural proxy): nav remains present and usable at mobile viewport width', async ({ page }) => {
    // A full check needs visual regression tooling; this confirms the nav and
    // primary content region are still present and in the DOM (not just
    // collapsed into nothing) at a small width, not that the layout looks
    // good - that judgment call is left to a human/screenshot review.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await switchPersona(page, 'sarah');

    await expect(page.locator('#nav')).toBeAttached();
    await expect(page.locator('#view')).toBeVisible();
    await expect(page.locator('#nav a[href="#/submit"]')).toBeAttached();
  });

  test('UI-10: category picker hint text swaps live when the selection changes', async ({ page }) => {
    // There is no core-value picker any more - the form asks for the value in
    // prose in the HOW text, and the server detects it from there (see
    // CoreValue.detectIn()) rather than from a dropdown with its own hint/
    // placeholder pair. This test now only covers the category hint, which
    // still lives on the form as a live-swapping <select>.
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const form = page.locator('#form');
    test.skip(!(await form.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run.');

    const categoryHint = page.locator('#categoryHint');
    const defaultHint = await categoryHint.textContent();

    await page.locator('#category').selectOption('INNOVATION_AND_GROWTH');
    const firstChoiceHint = await categoryHint.textContent();
    expect(firstChoiceHint).not.toBe(defaultHint);
    // AwardCategory.INNOVATION_AND_GROWTH's real examples text (server-owned,
    // see AwardCategory.java) - not a paraphrase.
    expect(firstChoiceHint).toContain('New ideas implemented');

    await page.locator('#category').selectOption('QUALITY_AND_COMPLIANCE');
    const secondChoiceHint = await categoryHint.textContent();
    expect(secondChoiceHint).not.toBe(firstChoiceHint);
  });

  test('T-26: full WHAT/HOW text is already visible in the same render as the Approve/Reject buttons '
    + '- a coordinator never has to act before the content has loaded', async ({ page, request }) => {
    const whatText = 'This exact sentence must be fully visible before any decision button is usable, '
      + 'padded so it is unambiguous in the DOM: the release pipeline was rebuilt end to end.';
    const created = await (await request.post('/api/nominations', {
      data: {
        nominatorName: 'UI TwentySix Nominator', nominatorEmail: uniqueEmail('ui26-nominator'),
        nomineeName: 'UI TwentySix Nominee', nomineeEmail: uniqueEmail('ui26-nominee'),
        practice: 'Digital', location: 'Dublin',
        category: 'INNOVATION_AND_GROWTH', coreValue: 'EXCELLENCE',
        whatText,
        howText: 'They showed excellence by documenting every step so the next release was even faster.',
      },
    })).json();

    await page.goto('/');
    await switchPersona(page, 'colette');
    await goToView(page, 'queue');
    const row = page.locator(`tr.clickable[data-id="${created.id}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    // Both assertions target the same render pass - the detail panel writes
    // its whole innerHTML (prose + action bar) in one go, so if this ever
    // regresses into a progressive/lazy render, this test is what catches
    // Approve becoming clickable before the WHAT text has actually arrived.
    await expect(page.locator('#detail')).toContainText(whatText, { timeout: 10_000 });
    await expect(page.locator('[data-act="approve"]')).toBeVisible();
    await expect(page.locator('[data-act="reject"]')).toBeVisible();
  });

  test('T-41 (BUG, pinned as regression): reloading mid-form silently discards everything typed, with no '
    + 'draft preserved and no warning that it was lost', async ({ page }) => {
    // The manual test plan's expected result is "either the draft is
    // preserved, or the user is clearly told the draft was lost - no
    // ambiguous blank form". Checked directly in app.js: localStorage is used
    // for persona/theme/greyscale/quarter-seen, never for form field values,
    // and the only "Save draft" buttons in the app (Praises Wall / Reports
    // placeholders) are hard-disabled stubs. So today a mid-form reload just
    // silently produces the same blank form as a fresh visit - indistinguishable
    // from "nothing was ever typed". Pinning the current (gap) behavior so a
    // fix (either real draft persistence or a visible warning) shows up here
    // as a welcome failure, matching this suite's UI-1a convention.
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const form = page.locator('#form');
    test.skip(!(await form.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run.');

    const nomineeName = 'Draft Loss Regression Nominee';
    await page.locator('#nomineeName').fill(nomineeName);
    await page.locator('#whatText').fill('Some in-progress text that should not silently vanish on reload.');

    await page.reload();

    const formAfterReload = page.locator('#form');
    test.skip(!(await formAfterReload.isVisible().catch(() => false)),
      'Sarah has no available quarter slot in this run.');

    // The bug: the field is blank again, and there's no message anywhere on
    // the page telling the user their draft was lost.
    await expect(page.locator('#nomineeName')).toHaveValue('');
    await expect(page.getByText(/draft|unsaved/i)).toHaveCount(0);
  });

  test('T-43: WHAT text containing a <script> tag renders as visible plain text, never as a live element', async ({ page, request }) => {
    const malicious = "Delivered under budget. <script>window.__xss=true;</script> Great work overall.";
    const created = await (await request.post('/api/nominations', {
      data: {
        nominatorName: 'UI FortyThree Nominator', nominatorEmail: uniqueEmail('ui43-nominator'),
        nomineeName: 'UI FortyThree Nominee', nomineeEmail: uniqueEmail('ui43-nominee'),
        practice: 'Digital', location: 'Dublin',
        category: 'QUALITY_AND_COMPLIANCE', coreValue: 'EXCELLENCE',
        whatText: malicious,
        howText: 'They showed excellence by catching every edge case before release, including this one.',
      },
    })).json();

    await page.goto('/');
    await switchPersona(page, 'colette');
    await goToView(page, 'queue');
    const row = page.locator(`tr.clickable[data-id="${created.id}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    // Rendered as visible text, not executed as a script element.
    await expect(page.locator('#detail')).toContainText('<script>window.__xss=true;</script>', { timeout: 10_000 });
    const executed = await page.evaluate(() => window.__xss);
    expect(executed).toBeUndefined();
  });
});
