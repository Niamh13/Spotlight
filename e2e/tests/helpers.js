// Shared Playwright helpers for the Spotlight E2E/UI specs.
// Selectors here are pinned to the real app.js/index.html structure - see the
// scenario catalog (Spotlight_Test_Scenarios.docx) for the scenario ids each
// helper supports.

/** @typedef {import('@playwright/test').Page} Page */

const PERSONAS = {
  sarah: 'sarah',
  calvin: 'calvin',
  jamie: 'jamie',
  colette: 'colette',
};

/** Switches the active persona via the bottom-left profile switcher. */
async function switchPersona(page, personaId) {
  await page.locator('#personaBtn').click();
  await page.locator(`#personaMenu [data-persona="${personaId}"]`).click();
  // setPersona() re-fetches quarter state and re-renders; the menu closing
  // is a reasonable signal that render() has been kicked off.
  await page.locator('#personaMenu').waitFor({ state: 'hidden' });
}

/** Navigates to a nav item by its route id (e.g. "submit", "queue", "home"). */
async function goToView(page, routeId) {
  await page.goto(`/#/${routeId}`);
}

/** Fills the submission form (category/coreValue are AwardCategory/CoreValue
 * enum names, e.g. "CUSTOMER_IMPACT" / "DRIVE"). */
async function fillSubmissionForm(page, { nomineeName, nomineeEmail, practice, location,
  category, coreValue, whatText, howText }) {
  await page.locator('#nomineeName').fill(nomineeName);
  await page.locator('#nomineeEmail').fill(nomineeEmail);
  await page.locator('#practice').fill(practice);
  await page.locator('#location').fill(location);
  await page.locator('#category').selectOption(category);
  await page.locator('#coreValue').selectOption(coreValue);
  await page.locator('#whatText').fill(whatText);
  await page.locator('#howText').fill(howText);
}

function uniqueEmail(label) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

module.exports = { PERSONAS, switchPersona, goToView, fillSubmissionForm, uniqueEmail };
