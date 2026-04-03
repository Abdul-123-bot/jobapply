// src/modules/ats/greenhouse.js
// Handles job applications on Greenhouse (boards.greenhouse.io).
// Greenhouse has a fairly standardized single-page form.

/**
 * @param {import('playwright').Page} page
 * @param {object} job     - pending_jobs row
 * @param {object} profile - user_profile row
 * @param {string} pdfPath - local path to tailored resume PDF
 */
async function apply(page, job, profile, pdfPath) {
  await page.goto(job.apply_link, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // --- Name ---
  await fillIfExists(page, '#first_name, [name="job_application[first_name]"]', profile.first_name);
  await fillIfExists(page, '#last_name, [name="job_application[last_name]"]', profile.last_name);

  // --- Contact ---
  await fillIfExists(page, '#email, [name="job_application[email]"]', profile.email);
  await fillIfExists(page, '#phone, [name="job_application[phone]"]', profile.phone);

  // --- Location ---
  await fillIfExists(page, '[name="job_application[location]"], #job_application_location', profile.location);

  // --- Resume upload ---
  const resumeInput = await page.$('input[type="file"][id*="resume"], input[type="file"][name*="resume"]');
  if (resumeInput) {
    await resumeInput.setInputFiles(pdfPath);
    await page.waitForTimeout(1500);
  }

  // --- LinkedIn URL ---
  if (profile.linkedin_url) {
    await fillIfExists(page, 'input[name*="linkedin" i], input[placeholder*="linkedin" i]', profile.linkedin_url);
  }

  // --- Portfolio / Website ---
  if (profile.portfolio_url) {
    await fillIfExists(page, 'input[name*="website" i], input[name*="portfolio" i], input[placeholder*="website" i]', profile.portfolio_url);
  }

  // --- Submit ---
  const submitBtn = await page.$('[data-submit="true"], input[type="submit"], button[type="submit"]');
  if (!submitBtn) throw new Error('Submit button not found');

  await submitBtn.click();
  await page.waitForTimeout(3000);

  // Check for success confirmation
  const success = await page.$('.success, #confirmation, [class*="success"], [class*="confirm"]');
  return {
    success: !!success,
    status: success ? 'applied' : 'submitted_unconfirmed',
    notes: success ? 'Application submitted via Greenhouse' : 'Submitted but could not confirm — check your email',
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
