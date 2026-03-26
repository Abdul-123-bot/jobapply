// src/modules/resume.js

// This module handles everything resume-related:
// - Storing a user's resume
// - Retrieving it when needed
// - Asking Claude to tailor it to a job description
//
// It is completely self-contained — no Twilio or webhook
// logic lives here. This makes it easy to test independently
// and reuse in future features like cover letter generation.

const { askClaude } = require('./claude');

// In-memory resume storage per user.
// Key: user's WhatsApp number
// Value: their resume text
//
// Example:
// {
//   "whatsapp:+923001234567": "John Doe\nSoftware Engineer\n5 years experience..."
// }
//
// NOTE: Like memory.js, this resets on server restart.
// We'll persist to Supabase in a future step.
const resumes = {};

/**
 * Saves a user's resume text.
 *
 * @param {string} userId - the user's WhatsApp number
 * @param {string} text   - the full resume text
 */
function saveResume(userId, text) {
  resumes[userId] = text.trim();
}

/**
 * Retrieves a user's stored resume.
 *
 * @param {string} userId - the user's WhatsApp number
 * @returns {string|null} - the resume text or null if not saved yet
 */
function getResume(userId) {
  return resumes[userId] || null;
}

/**
 * Uses Claude to tailor the user's stored resume
 * to a specific job description.
 *
 * @param {string} userId         - the user's WhatsApp number
 * @param {string} jobDescription - the job description to tailor for
 * @returns {string}              - Claude's tailored resume or an error message
 */
async function tailorResume(userId, jobDescription) {
  const resume = getResume(userId);

  // Can't tailor if we don't have a resume yet
  if (!resume) {
    return "You haven't saved your resume yet! Send me your resume text and say \"save my resume\" first.";
  }

  // Build a focused prompt just for resume tailoring.
  // This is separate from the main system prompt so Claude
  // gets very specific instructions for this task.
  const messages = [
    {
      role: 'user',
      content: `
You are an expert resume writer. Tailor the resume below to match the job description provided.

Instructions:
- Reorder and reword bullet points to match the job's required skills
- Highlight relevant experience and remove or minimize irrelevant parts
- Keep the same structure and format as the original
- Do not invent experience that isn't in the original resume
- Keep it concise and ATS-friendly (applicant tracking system)

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Return only the tailored resume text, nothing else.
      `.trim(),
    },
  ];

  const tailored = await askClaude(messages);
  return tailored;
}

module.exports = { saveResume, getResume, tailorResume };