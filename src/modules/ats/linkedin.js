// src/modules/ats/linkedin.js
// Handles LinkedIn Easy Apply.
// Requires profile.linkedin_email and profile.linkedin_pass.
// Easy Apply is a multi-step wizard — we handle the common steps
// and bail out with manual_required if we hit an unknown step.

/**
 * @param {import('playwright').Page} page
 * @param {object} job     - pending_jobs row
 * @param {object} profile - user_profile row
 * @param {string} pdfPath - local path to tailored resume PDF
 */
async function apply(page, job, profile, pdfPath) {
  if (!profile.linkedin_email || !profile.linkedin_pass) {
    return {
      success: false,
      status: 'manual_required',
      notes: 'LinkedIn credentials not set. Say "set linkedin login" to add them.',
    };
  }

  // --- Log in ---
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#username', profile.linkedin_email);
  await page.fill('#password', profile.linkedin_pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Check if login succeeded
  if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
    return {
      success: false,
      status: 'login_failed',
      notes: 'LinkedIn login failed — check your credentials or complete 2FA manually.',
    };
  }

  // --- Go to job page ---
  await page.goto(job.apply_link, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // --- Click Easy Apply button ---
  const easyApplyBtn = await page.$('button.jobs-apply-button, [data-control-name="jobdetails_topcard_inapply"]');
  if (!easyApplyBtn) {
    return {
      success: false,
      status: 'manual_required',
      notes: 'No Easy Apply button found — this job requires applying on the company site.',
    };
  }
  await easyApplyBtn.click();
  await page.waitForTimeout(2000);

  // --- Step through the wizard ---
  let stepCount = 0;
  const MAX_STEPS = 8;

  while (stepCount < MAX_STEPS) {
    stepCount++;

    // Check if modal is still open
    const modal = await page.$('.jobs-easy-apply-modal, [data-test-modal]');
    if (!modal) break;

    // Check for submit button (final step)
    const submitBtn = await page.$('button[aria-label="Submit application"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      return {
        success: true,
        status: 'applied',
        notes: 'Application submitted via LinkedIn Easy Apply',
      };
    }

    // Fill phone if present
    const phoneField = await page.$('input[id*="phoneNumber"], input[name*="phone"]');
    if (phoneField && profile.phone) {
      await phoneField.fill('');
      await phoneField.fill(profile.phone);
    }

    // Handle resume upload if prompted
    const resumeUpload = await page.$('input[type="file"]');
    if (resumeUpload) {
      await resumeUpload.setInputFiles(pdfPath);
      await page.waitForTimeout(1500);
    }

    // Handle yes/no work auth questions
    const followUpFields = await page.$$('fieldset');
    for (const field of followUpFields) {
      const label = await field.textContent();
      if (label && (label.toLowerCase().includes('authorized') || label.toLowerCase().includes('sponsor'))) {
        const yesRadio = await field.$('input[type="radio"]');
        if (yesRadio) await yesRadio.click();
      }
    }

    // Next step
    const nextBtn = await page.$('button[aria-label="Continue to next step"], button[aria-label="Next"]');
    const reviewBtn = await page.$('button[aria-label="Review your application"]');

    if (reviewBtn) {
      await reviewBtn.click();
    } else if (nextBtn) {
      await nextBtn.click();
    } else {
      // Unknown step — bail
      await page.keyboard.press('Escape');
      return {
        success: false,
        status: 'manual_required',
        notes: `LinkedIn Easy Apply stopped at step ${stepCount} — requires manual completion.`,
      };
    }

    await page.waitForTimeout(1500);
  }

  return {
    success: false,
    status: 'manual_required',
    notes: 'LinkedIn Easy Apply exceeded expected steps — requires manual completion.',
  };
}

module.exports = { apply };
