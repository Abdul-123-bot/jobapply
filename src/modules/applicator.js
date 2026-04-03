// src/modules/applicator.js
// Orchestrates the full auto-apply flow for a single job:
//   1. Check user profile is complete
//   2. Get base resume + tailor it via Claude for this job
//   3. Save tailored resume to Supabase (tailored_resumes table)
//   4. Generate a PDF from the tailored text
//   5. Upload PDF to Supabase Storage (resumes bucket)
//   6. Detect which ATS the job uses
//   7. Launch Playwright + route to the correct ATS handler
//   8. Return { success, status, notes, ats, tailoredResumeId }
//
// Supabase tables required:
//   tailored_resumes (
//     id          SERIAL PRIMARY KEY,
//     user_id     TEXT,
//     job_id      INTEGER,
//     resume_text TEXT,
//     pdf_path    TEXT,          -- path in Supabase Storage
//     created_at  TIMESTAMPTZ DEFAULT now()
//   )
//
// Supabase Storage bucket required:
//   resumes   (public or private — private recommended)

const fs = require('fs');
const { chromium } = require('playwright');

const supabase = require('../config/supabase');
const { getProfile, isProfileComplete, getMissingFields } = require('./profile');
const { getResume, tailorResume } = require('./resume');
const { generateResumePDF, getTempPdfPath } = require('./pdfGenerator');
const { detectATS } = require('./atsDetector');

const greenhouse = require('./ats/greenhouse');
const lever      = require('./ats/lever');
const linkedin   = require('./ats/linkedin');
const indeed     = require('./ats/indeed');
const workday    = require('./ats/workday');

const ATS_HANDLERS = { greenhouse, lever, linkedin, indeed, workday };

/**
 * Full auto-apply pipeline for one job.
 *
 * @param {string} userId - WhatsApp number (e.g. whatsapp:+1...)
 * @param {object} job    - row from pending_jobs table
 * @returns {object}      - { success, status, notes, ats, tailoredResumeId }
 */
async function applyToJob(userId, job) {
  // --- 1. Profile check ---
  const profile = await getProfile(userId);
  if (!isProfileComplete(profile)) {
    const missing = getMissingFields(profile);
    return {
      success: false,
      status: 'incomplete_profile',
      notes: `Profile incomplete. Missing: ${missing.join(', ')}. Say "my profile" to see what's needed.`,
    };
  }

  // --- 2. Tailor resume ---
  const baseResume = await getResume(userId);
  if (!baseResume) {
    return {
      success: false,
      status: 'no_resume',
      notes: 'No resume saved. Upload your resume first.',
    };
  }

  let tailoredText;
  try {
    const jobContext = `${job.title} at ${job.company}\n\n${job.description || ''}`;
    tailoredText = await tailorResume(userId, jobContext);
  } catch (err) {
    return { success: false, status: 'tailor_failed', notes: `Resume tailoring failed: ${err.message}` };
  }

  // --- 3. Save tailored resume to Supabase ---
  const { data: savedResume, error: saveErr } = await supabase
    .from('tailored_resumes')
    .insert({ user_id: userId, job_id: job.id, resume_text: tailoredText })
    .select('id')
    .single();

  if (saveErr) {
    console.error('Failed to save tailored resume:', saveErr.message);
  }

  const tailoredResumeId = savedResume?.id || null;

  // --- 4. Generate PDF ---
  const pdfPath = getTempPdfPath(userId, job.id);
  try {
    await generateResumePDF(tailoredText, pdfPath);
  } catch (err) {
    return { success: false, status: 'pdf_failed', notes: `PDF generation failed: ${err.message}` };
  }

  // --- 5. Upload PDF to Supabase Storage ---
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const storagePath = `${userId.replace(/[^a-zA-Z0-9]/g, '_')}/${job.id}_tailored.pdf`;

    await supabase.storage
      .from('resumes')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (tailoredResumeId) {
      await supabase
        .from('tailored_resumes')
        .update({ pdf_path: storagePath })
        .eq('id', tailoredResumeId);
    }
  } catch (err) {
    console.error('PDF upload to Supabase Storage failed (continuing):', err.message);
  }

  // --- 6. Detect ATS ---
  const ats = detectATS(job.apply_link);

  // --- 7. Launch Playwright ---
  let browser;
  let result;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const handler = ATS_HANDLERS[ats];

    if (handler) {
      result = await handler.apply(page, job, profile, pdfPath);
    } else {
      result = {
        success: false,
        status: 'manual_required',
        notes: `Unsupported job site (${new URL(job.apply_link).hostname}). Apply manually: ${job.apply_link}`,
      };
    }
  } catch (err) {
    result = { success: false, status: 'error', notes: `Browser error: ${err.message}` };
  } finally {
    if (browser) await browser.close();
    // Clean up temp PDF
    try { fs.unlinkSync(pdfPath); } catch {}
  }

  return { ...result, ats, tailoredResumeId };
}

module.exports = { applyToJob };
