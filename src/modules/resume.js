// src/modules/resume.js

const { askClaude } = require('./claude');
const supabase = require('../config/supabase');

// Tracks users currently in resume upload mode
// Key: userId, Value: array of text chunks received so far
const pendingUploads = {};

/**
 * Starts resume upload mode for a user.
 */
function startResumeUpload(userId) {
  pendingUploads[userId] = [];
}

/**
 * Returns true if user is currently in resume upload mode.
 */
function isUploadingResume(userId) {
  return !!pendingUploads[userId];
}

/**
 * Appends a chunk of text to the pending resume.
 */
function appendResumeChunk(userId, text) {
  if (pendingUploads[userId]) {
    pendingUploads[userId].push(text);
  }
}

/**
 * Finalizes the resume upload — joins all chunks and saves to Supabase.
 */
async function finalizeResumeUpload(userId) {
  const fullResume = pendingUploads[userId].join('\n');
  delete pendingUploads[userId];
  await saveResume(userId, fullResume);
  return fullResume;
}

/**
 * Cancels an in-progress resume upload.
 */
function cancelResumeUpload(userId) {
  delete pendingUploads[userId];
}

/**
 * Saves a user's resume to Supabase.
 */
async function saveResume(userId, text) {
  console.log('💾 Saving resume for:', userId);

  const { data, error } = await supabase
    .from('resumes')
    .upsert({
      user_id: userId,
      resume_text: text.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select();

  if (error) {
    console.error('❌ Supabase error saving resume:', error.message);
    throw new Error(error.message);
  }

  console.log('✅ Resume saved to Supabase:', data);
}

/**
 * Retrieves a user's resume from Supabase.
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
    return "You haven't saved your resume yet! Send your resume as a PDF or Word file, or say \"upload resume\" to paste it manually.";
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

module.exports = {
  saveResume,
  getResume,
  tailorResume,
  startResumeUpload,
  isUploadingResume,
  appendResumeChunk,
  finalizeResumeUpload,
  cancelResumeUpload,
};