// src/modules/ats/lever.js
// Handles job applications on Lever (jobs.lever.co).
// Lever has a clean, standardized single-page form.

/**
 * @param {import('playwright').Page} page
 * @param {object} job     - pending_jobs row
 * @param {object} profile - user_profile row
 * @param {string} pdfPath - local path to tailored resume PDF
 */
async function apply(page, job, profile, pdfPath) {
  await page.goto(job.apply_link, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // --- Name ---
  await fillIfExists(page, 'input[name="name"]', `${profile.first_name} ${profile.last_name}`);

  // --- Contact ---
  await fillIfExists(page, 'input[name="email"]', profile.email);
  await fillIfExists(page, 'input[name="phone"]', profile.phone);

  // --- Current company / org (leave blank or use placeholder) ---
  await fillIfExists(page, 'input[name="org"]', profile.location);

  // --- Resume upload ---
  const resumeInput = await page.$('input[type="file"]');
  if (resumeInput) {
    await resumeInput.setInputFiles(pdfPath);
    await page.waitForTimeout(1500);
  }

  // --- URLs ---
  if (profile.linkedin_url) {
    await fillIfExists(page, 'input[name="urls[LinkedIn]"]', profile.linkedin_url);
  }
  if (profile.portfolio_url) {
    await fillIfExists(page, 'input[name="urls[Portfolio]"]', profile.portfolio_url);
    await fillIfExists(page, 'input[name="urls[GitHub]"]', profile.portfolio_url);
  }

  // --- Submit ---
  const submitBtn = await page.$('button[type="submit"], .template-btn-submit');
  if (!submitBtn) throw new Error('Submit button not found');

  await submitBtn.click();
  await page.waitForTimeout(3000);

  // Lever redirects to a thank-you page on success
  const url = page.url();
  const success = url.includes('thanks') || url.includes('confirmation') || url.includes('success');

  return {
    success,
    status: success ? 'applied' : 'submitted_unconfirmed',
    notes: success ? 'Application submitted via Lever' : 'Submitted but could not confirm — check your email',
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
