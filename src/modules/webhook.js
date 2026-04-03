// src/modules/webhook.js

const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../config/env');
const { askClaude } = require('./claude');
const { getHistory, addMessage, clearHistory } = require('./memory');
const { saveResume, tailorResume } = require('./resume');
const { generateCoverLetter } = require('./coverLetter');
const { searchJobs, formatJobsForWhatsApp } = require('./jobSearch');
const { addApplication, updateStatus, formatApplications, VALID_STATUSES } = require('./tracker'); // NEW

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

  // NEW intents for tracker
  if (msg.startsWith('applied to ')) {
    return 'ADD_APPLICATION';
  }
  if (msg.startsWith('update ') && VALID_STATUSES.some(s => msg.includes(s))) {
    return 'UPDATE_STATUS';
  }
  if (msg.includes('my applications') || msg.includes('application status') || msg.includes('show applications')) {
    return 'VIEW_APPLICATIONS';
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
        await sendMessage(from, 'Please send your full resume text after the trigger phrase.');
        return;
      }

      saveResume(from, resumeText);
      await sendMessage(from, '✅ Resume saved!');
      return;
    }

    // --- TAILOR RESUME ---
    if (intent === 'TAILOR_RESUME') {
      await sendMessage(from, '⏳ Tailoring your resume...');
      const jobDescription = body.replace(/tailor my resume/i, '').replace(/tailor resume/i, '').trim();
      const tailored = await tailorResume(from, jobDescription);
      await sendMessage(from, `✅ Tailored resume:\n\n${tailored}`);
      return;
    }

    // --- COVER LETTER ---
    if (intent === 'COVER_LETTER') {
      await sendMessage(from, '⏳ Writing your cover letter...');
      const jobDescription = body.replace(/write me a cover letter/i, '').replace(/cover letter/i, '').trim();
      const letter = await generateCoverLetter(from, jobDescription);
      await sendMessage(from, `✅ Cover letter:\n\n${letter}`);
      return;
    }

    // --- JOB SEARCH ---
    if (intent === 'JOB_SEARCH') {
      await sendMessage(from, '🔍 Searching for jobs...');
      const query = body
        .replace(/find me jobs/i, '')
        .replace(/find jobs/i, '')
        .replace(/search jobs/i, '')
        .replace(/job listings/i, '')
        .replace(/looking for jobs/i, '')
        .replace(/job openings/i, '')
        .trim();
      const jobs = await searchJobs(query);
      const formatted = formatJobsForWhatsApp(jobs);
      await sendMessage(from, `✅ Top jobs for *${query}*:\n\n${formatted}`);
      return;
    }

    // --- ADD APPLICATION --- NEW
    // Format: "applied to [Company] [Role] [Link(optional)]"
    // Example: "applied to Google Senior React Engineer careers.google.com"
    if (intent === 'ADD_APPLICATION') {
      // Remove the trigger phrase
      const parts = body.replace(/applied to /i, '').trim().split(' ');

      // First word is company, last word is link if it looks like a URL
      // everything in between is the role
      const hasLink = parts[parts.length - 1].includes('.');
      const company = parts[0];
      const link = hasLink ? parts[parts.length - 1] : '';
      const roleWords = hasLink ? parts.slice(1, -1) : parts.slice(1);
      const role = roleWords.join(' ') || 'Not specified';

      const app = addApplication(from, company, role, link);
      await sendMessage(
        from,
        `✅ Application saved!\n\n🏢 *${app.company}*\n💼 ${app.role}\n📊 Status: ${app.status}\n📅 Date: ${app.date}\n\nSay "my applications" to see all your tracked jobs.`
      );
      return;
    }

    // --- UPDATE STATUS --- NEW
    // Format: "update [Company] to [status]"
    // Example: "update Google to interviewing"
    if (intent === 'UPDATE_STATUS') {
      const msg = body.toLowerCase();

      // Extract company — between "update " and " to"
      const companyMatch = body.match(/update (.+?) to/i);
      if (!companyMatch) {
        await sendMessage(from, 'Please use this format:\n"update [Company] to [status]"\n\nValid statuses: Applied, Interviewing, Offer, Rejected, Withdrawn');
        return;
      }

      const company = companyMatch[1].trim();
      const newStatus = VALID_STATUSES.find(s => msg.includes(s));

      if (!newStatus) {
        await sendMessage(from, `Valid statuses are:\n${VALID_STATUSES.join(', ')}`);
        return;
      }

      const updated = updateStatus(from, company, newStatus);

      if (!updated) {
        await sendMessage(from, `Couldn't find an application for *${company}*. Check your applications with "my applications".`);
        return;
      }

      await sendMessage(from, `✅ Updated *${updated.company}* status to *${updated.status}*!`);
      return;
    }

    // --- VIEW APPLICATIONS --- NEW
    if (intent === 'VIEW_APPLICATIONS') {
      const summary = formatApplications(from);
      await sendMessage(from, summary);
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