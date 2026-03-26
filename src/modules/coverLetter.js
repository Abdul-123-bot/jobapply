// src/modules/coverLetter.js

// This module handles cover letter generation.
// It reuses the resume stored in resume.js and combines
// it with a job description to generate a personalized
// cover letter via Claude.
//
// Notice how this module only does ONE thing — generate
// cover letters. It doesn't know about Twilio or webhooks.
// That's the modular design paying off.

const { askClaude } = require('./claude');
const { getResume } = require('./resume');

/**
 * Generates a personalized cover letter using the user's
 * stored resume and a provided job description.
 *
 * @param {string} userId         - the user's WhatsApp number
 * @param {string} jobDescription - the job description to write for
 * @returns {string}              - the generated cover letter
 */
async function generateCoverLetter(userId, jobDescription) {
  const resume = getResume(userId);

  // Can't write a cover letter without knowing who the user is
  if (!resume) {
    return "You haven't saved your resume yet! Send me your resume text and say \"save my resume\" first.";
  }

  const messages = [
    {
      role: 'user',
      content: `
You are an expert cover letter writer. Write a professional, personalized cover letter based on the resume and job description below.

Instructions:
- Keep it to 3-4 short paragraphs — concise and impactful
- Opening: show genuine interest in the role and company
- Middle: highlight 2-3 most relevant experiences from the resume that match the job
- Closing: confident call to action
- Tone: professional but human, not robotic
- Do NOT use generic filler phrases like "I am writing to express my interest"
- Do not invent experience not present in the resume

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Return only the cover letter text, nothing else.
      `.trim(),
    },
  ];

  const coverLetter = await askClaude(messages);
  return coverLetter;
}

module.exports = { generateCoverLetter };