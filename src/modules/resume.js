// src/modules/resume.js

const { askClaude } = require('./claude');
const supabase = require('../config/supabase');

/**
 * Saves a user's resume to Supabase.
 * Uses upsert so it creates or updates in one operation.
 */
async function saveResume(userId, text) {
  await supabase
    .from('resumes')
    .upsert({
      user_id: userId,
      resume_text: text.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

/**
 * Retrieves a user's resume from Supabase.
 * Returns null if no resume saved yet.
 */
async function getResume(userId) {
  const { data, error } = await supabase
    .from('resumes')
    .select('resume_text')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.resume_text;
}

/**
 * Tailors the user's stored resume to a job description.
 */
async function tailorResume(userId, jobDescription) {
  const resume = await getResume(userId);

  if (!resume) {
    return "You haven't saved your resume yet! Send your resume text and say \"save my resume\" first.";
  }

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
- Keep it concise and ATS-friendly

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Return only the tailored resume text, nothing else.
      `.trim(),
    },
  ];

  return await askClaude(messages);
}

module.exports = { saveResume, getResume, tailorResume };