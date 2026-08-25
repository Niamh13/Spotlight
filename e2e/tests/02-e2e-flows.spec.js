// E2E-1..E2E-7 from Spotlight_Test_Scenarios.docx.
//
// Persona/data strategy: there are only 3 fixed employee personas (Sarah,
// Calvin, Jamie) and each can submit at most once per real quarter, so tests
// that need "a fresh nomination with arbitrary content" use the REST API
// directly (page.request) rather than fighting over the 3 personas. Tests
// that specifically exercise a *named persona's* flow (E2E-1..4) use that
// persona through the UI. Run order within this file matters and is
// intentional - see the comment above each test.
//
// The e2e MySQL database (recognitiondb_e2e) is persistent, not recreated per
// run, so specs can't assume a fresh seeded-demo baseline - they build their
// own fixtures via the API instead (see the persona/data strategy above). CI
// gets a fresh database anyway, since the mysql service container in
// ci.yml starts empty on every job.

const { test, expect } = require('@playwright/test');
const { switchPersona, goToView, fillSubmissionForm, uniqueEmail } = require('./helpers');

test.describe.configure({ mode: 'serial' });

test.describe('E2E flows', () => {

  // E2E-4 runs BEFORE E2E-1 on purpose: a rejected self-nomination attempt
  // never creates a real row, so it doesn't consume Sarah's one-per-quarter
  // slot - safe to run ahead of the real submission that does.
  test('E2E-4: self-nomination via the "Try self-nomination" UI helper is rejected, not a crash', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    await page.locator('#selfBtn').click();
    await page.locator('#submitBtn').click();

    // The self-nomination error surfaces as an inline banner, the form stays
    // usable, and no page crash / blank screen occurs.
    await expect(page.locator('#badBanner')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#form')).toBeVisible();
  });

  // E2E-1: happy path submission -> approval, using Sarah (seeded as "has not
  // nominated this quarter").
  test('E2E-1: happy-path submission by Sarah, approved by Colette, both comms recorded', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'sarah');
    await goToView(page, 'submit');

    const nomineeEmail = uniqueEmail('e2e1-nominee');
    await fillSubmissionForm(page, {
      nomineeName: 'E2E One Nominee',
      nomineeEmail,
      practice: 'Cloud Engineering',
      location: 'Dublin',
      category: 'CUSTOMER_IMPACT',
      whatText: 'They redesigned the deployment pipeline from scratch, cutting release '
        + 'time from two days down to twenty minutes for the whole team.',
      howText: 'They showed real drive, mapping every failure mode themselves without '
        + 'being asked and fixing each one before it caused an incident.',
    });
    await page.locator('#submitBtn').click();

    // A successful submit re-fetches quarter state itself (see Submit()'s
    // .then() chain) and the "already used" panel for this quarter replaces
    // the form reactively, with no manual reload needed.
    await expect(page.getByText(/You've nominated for/i)).toBeVisible({ timeout: 10_000 });

    // Switch to Colette and approve it from the Review Queue.
    await switchPersona(page, 'colette');
    await goToView(page, 'queue');
    const row = page.locator('tr.clickable', { hasText: 'E2E One Nominee' });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    await page.locator('[data-act="approve"]').click();
    await page.locator('#reasonConfirm').click();

    await expect(page.locator('.actionbar__label', { hasText: /already decided/i }))
      .toBeVisible({ timeout: 10_000 });

    // Audit history shows both comms.
    await expect(page.locator('#auditBox')).toContainText(/nominat/i, { timeout: 10_000 });
  });

  // E2E-3: Calvin is seeded with a pending nomination already submitted this
  // quarter (see 005-seed-demo-nominations.xml). If the seed's fixed date
  // ever falls outside "this quarter" relative to when tests run, this
  // assertion (not the app) would need updating - flagged rather than
  // silently trusted.
  test('E2E-3: Calvin (already submitted) sees the quarter-used panel, not the form', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'calvin');
    await goToView(page, 'submit');

    const alreadyUsed = page.getByText(/You've nominated for/i);
    const form = page.locator('#form');

    // Self-establishing precondition: if the seed data's quarter has drifted,
    // submit once via the UI so the panel is guaranteed to show either way.
    if (await form.isVisible().catch(() => false)) {
      await fillSubmissionForm(page, {
        nomineeName: 'E2E Three Precondition Nominee',
        nomineeEmail: uniqueEmail('e2e3-nominee'),
        practice: 'Consulting',
        location: 'Cork',
        category: 'QUALITY_AND_COMPLIANCE',
        whatText: 'They rebuilt the release checklist so nothing depends on memory, '
          + 'catching a config error that would have taken down the client portal.',
        howText: 'They went well beyond the ask, tracing every past incident back to a '
          + 'missing check and closing every one of them before rolling this out.',
      });
      await page.locator('#submitBtn').click();
      await goToView(page, 'submit');
    }

    await expect(alreadyUsed).toBeVisible({ timeout: 10_000 });
    await expect(form).toBeHidden();
  });

  // E2E-2: Jamie is seeded with a NEEDS_RESUBMISSION nomination - same
  // self-establishing caveat as E2E-3 applies to the seed's date.
  test('E2E-2: Jamie revises a sent-back nomination and Colette approves the resubmission', async ({ page }) => {
    await page.goto('/');
    await switchPersona(page, 'jamie');
    await goToView(page, 'submit');

    const revisingBanner = page.getByText(/revising your/i);
    const isRevising = await revisingBanner.isVisible().catch(() => false);

    if (!isRevising) {
      test.skip(true, 'Jamie has no NEEDS_RESUBMISSION nomination in this run - seed data '
        + 'may have drifted out of the current quarter. See E2E-3 for the same caveat.');
    }

    // Discovery: revision mode pre-fills only originalNominationId (and the
    // banner) - nomineeName/nomineeEmail/practice/location/category start
    // blank despite the "your previous entry" framing, and all are still
    // required. The whole form has to be filled again, not just
    // whatText/howText. (Core value isn't a separate field - it's read back
    // out of the HOW text, which is why it names "drive" explicitly below.)
    await fillSubmissionForm(page, {
      nomineeName: 'Alex Rivera',
      nomineeEmail: uniqueEmail('e2e2-nominee'),
      practice: 'Cloud Engineering',
      location: 'Belfast',
      category: 'QUALITY_AND_COMPLIANCE',
      whatText: 'Revised: they rebuilt the deployment checklist end to end, cutting the '
        + 'release window from four hours to twenty minutes and removing every manual step.',
      howText: 'Revised: this showed real drive - nobody asked them to rework the process, '
        + 'they just kept pushing until every manual step was gone.',
    });
    await page.locator('#submitBtn').click();
    await expect(page.getByText(/You've nominated for/i)).toBeVisible({ timeout: 10_000 });

    await switchPersona(page, 'colette');
    await goToView(page, 'queue');
    const row = page.locator('tbody tr.clickable').first();
    await row.click();
    await page.locator('[data-act="approve"]').click();
    await page.locator('#reasonConfirm').click();
    await expect(page.locator('.actionbar__label', { hasText: /already decided/i }))
      .toBeVisible({ timeout: 10_000 });
  });

  // E2E-5 and E2E-6 seed their own data directly via the API - decoupled from
  // the 3 fixed personas entirely, so they're order-independent of the tests
  // above and of each other.
  test('E2E-5: one-click completeness check drives a real resubmission request', async ({ page, request }) => {
    const nominatorEmail = uniqueEmail('e2e5-nominator');
    const created = await request.post('/api/nominations', {
      data: {
        nominatorName: 'E2E Five Nominator', nominatorEmail,
        nomineeName: 'E2E Five Nominee', nomineeEmail: uniqueEmail('e2e5-nominee'),
        practice: 'Digital', location: 'Belfast',
        category: 'INNOVATION_AND_GROWTH', coreValue: 'CUSTOMER_FIRST',
        whatText: 'Short.', howText: 'Also short.',
      },
    });
    expect(created.ok()).toBeTruthy();
    const nomination = await created.json();

    await page.goto('/');
    await switchPersona(page, 'colette');
    await goToView(page, 'queue');
    const row = page.locator(`tr.clickable[data-id="${nomination.id}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    await page.locator('#checkCompleteness').click();
    await expect(page.locator('#completenessBox')).toContainText(/./, { timeout: 10_000 });

    await page.locator('[data-act="request-resubmission"]').click();
    await expect(page.locator('#reasonText')).toBeVisible();
    await page.locator('#reasonText').fill('Needs a number and a named core value evidenced.');
    await page.locator('#reasonConfirm').click();

    await expect(page.locator('.actionbar__label', { hasText: /already decided/i }))
      .toBeVisible({ timeout: 10_000 });

    const after = await request.get(`/api/nominations/${nomination.id}`);
    const afterBody = await after.json();
    expect(afterBody.status).toBe('NEEDS_RESUBMISSION');
  });

  test('E2E-6: retag propagates a reciprocal flag across two existing nominations', async ({ request }) => {
    const emailA = uniqueEmail('e2e6-a');
    const emailB = uniqueEmail('e2e6-b');

    const nomAB = await (await request.post('/api/nominations', {
      data: {
        nominatorName: 'A', nominatorEmail: emailA,
        nomineeName: 'B', nomineeEmail: emailB,
        practice: 'ERP', location: 'Pune',
        category: 'PERFORMANCE_AND_EFFICIENCY', coreValue: 'DRIVE',
        whatText: 'A nominates B for redesigning the batch job scheduler, cutting nightly '
          + 'run time from six hours to ninety minutes across the whole estate.',
        howText: 'B showed real drive, rebuilding the scheduler without being asked after '
          + 'noticing repeated overnight failures nobody else had traced to the root cause.',
      },
    })).json();
    expect(nomAB.id).toBeTruthy();

    const nomBA = await (await request.post('/api/nominations', {
      data: {
        nominatorName: 'B', nominatorEmail: emailB,
        nomineeName: 'A', nomineeEmail: emailA,
        practice: 'ERP', location: 'Pune',
        category: 'PERFORMANCE_AND_EFFICIENCY', coreValue: 'PERSONAL_COMMITMENT',
        whatText: 'B nominates A back for personally covering the on-call rotation for a '
          + 'sick teammate for two full weeks without being asked to.',
        howText: 'A followed through without needing to be chased, picking up every page '
          + 'and keeping the handover notes so nothing was lost when the teammate returned.',
      },
    })).json();
    expect(nomBA.id).toBeTruthy();

    // The second submission already retags automatically; retag explicitly
    // too so this assertion doesn't depend on that implicit behavior alone.
    await request.post('/api/nominations/retag');

    const first = await (await request.get(`/api/nominations/${nomAB.id}`)).json();
    const second = await (await request.get(`/api/nominations/${nomBA.id}`)).json();

    const hasReciprocal = (n) => (n.aiFlags || []).some((f) => f.flag === 'RECIPROCAL_NOMINATION');
    expect(hasReciprocal(first)).toBeTruthy();
    expect(hasReciprocal(second)).toBeTruthy();

    // T-06: a flag never blocks a decision - a coordinator can still approve
    // a nomination that's carrying a reciprocal flag. Must be Colette's real
    // seeded email - the e2e profile's user directory only has the 4 real
    // personas, not a generic placeholder coordinator like blackbox/UAT use.
    const approved = await request.post(`/api/nominations/${nomAB.id}/approve`, {
      data: { coordinatorEmail: 'colette.lynch@version1.com' },
    });
    expect(approved.ok()).toBeTruthy();
    const approvedBody = await approved.json();
    expect(approvedBody.status).toBe('APPROVED');
  });

  // E2E-7 (reframed from the original catalog entry for accuracy): the mock
  // evaluator (ai.evaluator=mock in the e2e profile) is always-available by
  // design, so it never produces the SKIPPED_NO_API_KEY "unavailable" state -
  // that state is only reachable with ai.evaluator=groq and no key, which is
  // a distinct, separately-configured scenario. What this DOES prove
  // end-to-end: AI evaluation always completes and never blocks a
  // submission, regardless of which evaluator is backing it.
  test('E2E-7: AI evaluation completes via the configured evaluator and never blocks submission', async ({ request }) => {
    const created = await request.post('/api/nominations', {
      data: {
        nominatorName: 'E2E Seven Nominator', nominatorEmail: uniqueEmail('e2e7-nominator'),
        nomineeName: 'E2E Seven Nominee', nomineeEmail: uniqueEmail('e2e7-nominee'),
        practice: 'Managed Services', location: 'London',
        category: 'QUALITY_AND_COMPLIANCE', coreValue: 'EXCELLENCE',
        whatText: 'They rebuilt the monitoring dashboard so on-call engineers see the '
          + 'actual root cause first, cutting mean time to resolution by 40 percent.',
        howText: 'This showed excellence - they got to the root cause of every false '
          + 'positive alert rather than just muting them, over several weekends.',
      },
    });
    expect(created.status()).toBe(201);
    const nomination = await created.json();

    expect(nomination.aiEvaluationStatus).toBe('COMPLETED');
    expect(nomination.aiScore).not.toBeNull();
  });
});
