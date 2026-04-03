// src/modules/ats/indeed.js
// Handles Indeed Apply (smartapply.indeed.com).
// Requires profile.indeed_email and profile.indeed_pass.

/**
 * @param {import('playwright').Page} page
 * @param {object} job     - pending_jobs row
 * @param {object} profile - user_profile row
 * @param {string} pdfPath - local path to tailored resume PDF
 */
async function apply(page, job, profile, pdfPath) {
  if (!profile.indeed_email || !profile.indeed_pass) {
    return {
      success: false,
      status: 'manual_required',
      notes: 'Indeed credentials not set. Say "set indeed login" to add them.',
    };
  }

  // --- Log in ---
  await page.goto('https://secure.indeed.com/auth', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const emailField = await page.$('input[name="emailAddress"], input[type="email"]');
  if (emailField) {
    await emailField.fill(profile.indeed_email);
    const continueBtn = await page.$('button[type="submit"]');
    if (continueBtn) await continueBtn.click();
    await page.waitForTimeout(2000);
  }

  const passField = await page.$('input[name="password"], input[type="password"]');
  if (passField) {
    await passField.fill(profile.indeed_pass);
    const signInBtn = await page.$('button[type="submit"]');
    if (signInBtn) await signInBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check login
  if (page.url().includes('/auth') || page.url().includes('/signin')) {
    return {
      success: false,
      status: 'login_failed',
      notes: 'Indeed login failed — check your credentials.',
    };
  }

  // --- Go to apply page ---
  await page.goto(job.apply_link, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // --- Step through Indeed apply form ---
  let stepCount = 0;
  const MAX_STEPS = 6;

  while (stepCount < MAX_STEPS) {
    stepCount++;

    // Resume upload step
    const resumeUpload = await page.$('input[type="file"]');
    if (resumeUpload) {
      await resumeUpload.setInputFiles(pdfPath);
      await page.waitForTimeout(1500);
    }

    // Fill phone
    await fillIfExists(page, 'input[name*="phone" i], input[id*="phone" i]', profile.phone);

    // Fill location
    await fillIfExists(page, 'input[name*="city" i], input[id*="city" i]', profile.location);

    // Submit or continue
    const submitBtn = await page.$('button[data-testid="submit-button"], button[aria-label*="submit" i]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(2000);

      const confirmed = await page.$('[data-testid="confirmation"], .ia-BasePage-heading');
      return {
        success: true,
        status: 'applied',
        notes: 'Application submitted via Indeed Apply',
      };
    }

    const nextBtn = await page.$('button[data-testid="continue-button"], button[aria-label*="continue" i]');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1500);
    } else {
      return {
        success: false,
        status: 'manual_required',
        notes: `Indeed Apply stopped at step ${stepCount} — requires manual completion.`,
      };
    }
  }

  return {
    success: false,
    status: 'manual_required',
    notes: 'Indeed Apply exceeded expected steps — requires manual completion.',
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
