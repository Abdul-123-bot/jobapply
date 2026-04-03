// src/modules/ats/workday.js
// Handles Workday (myworkdayjobs.com).
// Workday is the most complex ATS — multi-step, account required.
// We handle the basic fields and flag for manual if it gets too deep.

/**
 * @param {import('playwright').Page} page
 * @param {object} job     - pending_jobs row
 * @param {object} profile - user_profile row
 * @param {string} pdfPath - local path to tailored resume PDF
 */
async function apply(page, job, profile, pdfPath) {
  await page.goto(job.apply_link, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // --- Click Apply button ---
  const applyBtn = await page.$('a[data-automation-id="applyButton"], button[data-automation-id="applyButton"]');
  if (!applyBtn) {
    return {
      success: false,
      status: 'manual_required',
      notes: 'Could not find Workday Apply button.',
    };
  }
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Workday often requires creating an account or logging in
  // Check if we're on a sign-in / create account page
  const createAccountBtn = await page.$('[data-automation-id="createAccountLink"], [data-automation-id="createAccount"]');
  const signInField = await page.$('[data-automation-id="email"]');

  if (createAccountBtn || signInField) {
    return {
      success: false,
      status: 'manual_required',
      notes: 'Workday requires creating an account — please apply manually at: ' + job.apply_link,
    };
  }

  // --- Try to fill basic fields if we got past login ---
  await fillIfExists(page, '[data-automation-id="legalNameSection_firstName"]', profile.first_name);
  await fillIfExists(page, '[data-automation-id="legalNameSection_lastName"]', profile.last_name);
  await fillIfExists(page, '[data-automation-id="email"]', profile.email);
  await fillIfExists(page, '[data-automation-id="phone-number"]', profile.phone);

  // Resume upload
  const resumeUpload = await page.$('input[type="file"]');
  if (resumeUpload) {
    await resumeUpload.setInputFiles(pdfPath);
    await page.waitForTimeout(2000);
  }

  // Workday typically has too many custom steps to fully automate
  // Return manual_required after filling what we can
  return {
    success: false,
    status: 'manual_required',
    notes: 'Workday form partially filled (name, email, phone, resume). Please complete and submit manually: ' + job.apply_link,
  };
}

async function fillIfExists(page, selector, value) {
  if (!value) return;
  try {
    const el = await page.$(selector);
    if (el) {
      await el.fill('');
      await el.fill(value);
    }
  } catch {}
}

module.exports = { apply };
