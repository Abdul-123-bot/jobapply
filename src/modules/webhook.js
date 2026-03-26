// src/modules/webhook.js

const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../config/env');
const { askClaude } = require('./claude');
const { getHistory, addMessage, clearHistory } = require('./memory');
const { saveResume, tailorResume } = require('./resume');

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

/**
 * Detects what the user is trying to do based on their message.
 * This is a simple keyword-based intent detector.
 * In Step 9 we'll upgrade this to use Claude for smarter routing.
 *
 * @param {string} message - the user's message text
 * @returns {string} - the detected intent
 */
function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes('save my resume') || msg.includes('here is my resume') || msg.includes('my resume:')) {
    return 'SAVE_RESUME';
  }
  if (msg.includes('tailor my resume') || msg.includes('tailor resume')) {
    return 'TAILOR_RESUME';
  }
  if (msg.trim() === 'reset') {
    return 'RESET';
  }

  return 'GENERAL'; // falls through to Claude's general conversation
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
    // User sends their resume text with a trigger phrase like
    // "save my resume" or "here is my resume"
    if (intent === 'SAVE_RESUME') {
      // Extract just the resume part — everything after the trigger phrase
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
      await sendMessage(from, '✅ Resume saved! You can now ask me to:\n- "Tailor my resume for [paste job description]"\n- "Write a cover letter for [paste job description]"');
      return;
    }

    // --- TAILOR RESUME ---
    // User pastes a job description and asks for tailoring
    if (intent === 'TAILOR_RESUME') {
      await sendMessage(from, '⏳ Tailoring your resume, give me a moment...');

      // Extract the job description — everything after the trigger phrase
      const jobDescription = body
        .replace(/tailor my resume/i, '')
        .replace(/tailor resume/i, '')
        .trim();

      if (jobDescription.length < 20) {
        await sendMessage(from, 'Please paste the job description after "tailor my resume". Example:\n\n"tailor my resume\n[paste job description here]"');
        return;
      }

      const tailored = await tailorResume(from, jobDescription);
      await sendMessage(from, `✅ Here is your tailored resume:\n\n${tailored}`);
      return;
    }

    // --- GENERAL CONVERSATION ---
    // Falls through to Claude for everything else
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