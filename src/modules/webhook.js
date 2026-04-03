// src/modules/webhook.js

const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../config/env');
const { askClaude } = require('./claude');
const { getHistory, addMessage, clearHistory } = require('./memory');
const { saveResume, tailorResume } = require('./resume');
const { generateCoverLetter } = require('./coverLetter');
const { searchJobs, formatJobsForWhatsApp } = require('./jobSearch'); // NEW

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function parseIncomingMessage(req) {
  const from = req.body.From;
  const body = req.body.Body;
  return { from, body };
}

async function sendMessage(to, text) {
  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes('save my resume') || msg.includes('here is my resume') || msg.includes('my resume:')) {
    return 'SAVE_RESUME';
  }
  if (msg.includes('tailor my resume') || msg.includes('tailor resume')) {
    return 'TAILOR_RESUME';
  }
  if (msg.includes('cover letter')) {
    return 'COVER_LETTER';
  }

  // Broader job search detection
  if (
    msg.includes('find jobs') ||
    msg.includes('find me jobs') ||
    msg.includes('search jobs') ||
    msg.includes('job listings') ||
    msg.includes('looking for jobs') ||
    msg.includes('jobs in') ||
    msg.includes('jobs for') ||
    msg.includes('developer jobs') ||
    msg.includes('engineer jobs') ||
    msg.includes('job openings')
  ) {
    return 'JOB_SEARCH';
  }

  if (msg.trim() === 'reset') {
    return 'RESET';
  }

  return 'GENERAL';
}

async function handleIncomingMessage(req, res) {
  res.sendStatus(200);

  const { from, body } = parseIncomingMessage(req);
  console.log(`📩 Message from ${from}: ${body}`);

  try {
    const intent = detectIntent(body);
    console.log(`🎯 Detected intent: ${intent}`);

    // --- RESET ---
    if (intent === 'RESET') {
      clearHistory(from);
      await sendMessage(from, 'Conversation reset! How can I help you? 👋');
      return;
    }

    // --- SAVE RESUME ---
    if (intent === 'SAVE_RESUME') {
      const resumeText = body
        .replace(/save my resume/i, '')
        .replace(/here is my resume/i, '')
        .replace(/my resume:/i, '')
        .trim();

      if (resumeText.length < 50) {
        await sendMessage(from, 'Please send your full resume text after the trigger phrase. Example:\n\n"save my resume\n[paste your resume here]"');
        return;
      }

      saveResume(from, resumeText);
      await sendMessage(from, '✅ Resume saved! You can now ask me to:\n- "Tailor my resume for [paste job description]"\n- "Write a cover letter for [paste job description]"\n- "Find jobs React developer Austin TX"');
      return;
    }

    // --- TAILOR RESUME ---
    if (intent === 'TAILOR_RESUME') {
      await sendMessage(from, '⏳ Tailoring your resume, give me a moment...');

      const jobDescription = body
        .replace(/tailor my resume/i, '')
        .replace(/tailor resume/i, '')
        .trim();

      if (jobDescription.length < 20) {
        await sendMessage(from, 'Please paste the job description after "tailor my resume".');
        return;
      }

      const tailored = await tailorResume(from, jobDescription);
      await sendMessage(from, `✅ Here is your tailored resume:\n\n${tailored}`);
      return;
    }

    // --- COVER LETTER ---
    if (intent === 'COVER_LETTER') {
      await sendMessage(from, '⏳ Writing your cover letter, give me a moment...');

      const jobDescription = body
        .replace(/write me a cover letter/i, '')
        .replace(/cover letter/i, '')
        .trim();

      if (jobDescription.length < 20) {
        await sendMessage(from, 'Please paste the job description after "cover letter".');
        return;
      }

      const letter = await generateCoverLetter(from, jobDescription);
      await sendMessage(from, `✅ Here is your cover letter:\n\n${letter}`);
      return;
    }

    // --- JOB SEARCH --- NEW
    // --- JOB SEARCH ---
if (intent === 'JOB_SEARCH') {
  await sendMessage(from, '🔍 Searching for jobs, give me a moment...');

  const query = body
    .replace(/find me jobs/i, '')
    .replace(/find jobs/i, '')
    .replace(/search jobs/i, '')
    .replace(/job listings/i, '')
    .replace(/looking for jobs/i, '')
    .replace(/job openings/i, '')
    .trim();

  if (query.length < 2) {
    await sendMessage(from, 'Please tell me what jobs to search for. Example:\n\n"find jobs React developer Austin TX"');
    return;
  }

  const jobs = await searchJobs(query);
  const formatted = formatJobsForWhatsApp(jobs);
  await sendMessage(from, `✅ Here are the top jobs for *${query}*:\n\n${formatted}`);
  return;
}

    // --- GENERAL CONVERSATION ---
    addMessage(from, 'user', body);
    const history = getHistory(from);
    const reply = await askClaude(history);
    addMessage(from, 'assistant', reply);
    await sendMessage(from, reply);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await sendMessage(from, 'Sorry, something went wrong. Please try again.');
  }
}

module.exports = {
  handleIncomingMessage,
  sendMessage,
  parseIncomingMessage,
};