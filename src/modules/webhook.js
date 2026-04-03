// src/modules/webhook.js

const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../config/env');
const { askClaude } = require('./claude');
const { getHistory, addMessage, clearHistory } = require('./memory');
const { saveResume, tailorResume, startResumeUpload, isUploadingResume, appendResumeChunk, finalizeResumeUpload, cancelResumeUpload } = require('./resume');
const { generateCoverLetter } = require('./coverLetter');
const { searchJobs, formatJobsForWhatsApp } = require('./jobSearch');
const { addApplication, updateStatus, formatApplications, VALID_STATUSES } = require('./tracker');
const { detectIntent } = require('./intentRouter');
const { extractTextFromDocument } = require('./docParser');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function parseIncomingMessage(req) {
  const from = req.body.From;
  const body = req.body.Body || '';
  const numMedia = parseInt(req.body.NumMedia || '0');
  const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null;
  const mediaType = numMedia > 0 ? req.body.MediaContentType0 : null;
  return { from, body, mediaUrl, mediaType };
}

async function sendMessage(to, text) {
  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

async function handleIncomingMessage(req, res) {
  res.sendStatus(200);

  const { from, body, mediaUrl, mediaType } = parseIncomingMessage(req);
  console.log(`📩 Message from ${from}: ${body}`);

  try {

    // --- DOCUMENT UPLOAD ---
    // Handle file attachments before intent detection
    if (mediaUrl && mediaType) {
      console.log(`📎 Document received: ${mediaType}`);

      const isSupportedDoc = (
        mediaType === 'application/pdf' ||
        mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mediaType === 'application/msword'
      );

      if (!isSupportedDoc) {
        await sendMessage(from, '❌ Unsupported file type. Please send your resume as a PDF or Word (.docx) file.');
        return;
      }

      await sendMessage(from, '📄 Document received! Extracting text...');
      const resumeText = await extractTextFromDocument(mediaUrl, mediaType);

      if (!resumeText || resumeText.length < 50) {
        await sendMessage(from, '❌ Could not extract text from your document. Make sure it\'s not a scanned image PDF.');
        return;
      }

      await saveResume(from, resumeText);
      await sendMessage(from, `✅ Resume saved! (${resumeText.length} characters)\n\nYou can now:\n- "Tailor my resume for this role: [paste JD]"\n- "Write me a cover letter for: [paste JD]"`);
      return;
    }

    // --- RESUME UPLOAD MODE ---
    // If user is mid-upload, handle chunks before intent detection
    if (isUploadingResume(from)) {
      const { intent } = await detectIntent(body);

      if (intent === 'FINISH_RESUME_UPLOAD') {
        const fullResume = await finalizeResumeUpload(from);
        await sendMessage(from, `✅ Resume saved! (${fullResume.length} characters)\n\nYou can now:\n- "Tailor my resume for this role: [paste JD]"\n- "Write me a cover letter for: [paste JD]"`);
        return;
      }

      if (intent === 'CANCEL_RESUME_UPLOAD') {
        cancelResumeUpload(from);
        await sendMessage(from, '❌ Resume upload cancelled.');
        return;
      }

      appendResumeChunk(from, body);
      await sendMessage(from, '📝 Chunk received! Send more or say "done" when finished.');
      return;
    }

    // --- SMART INTENT DETECTION ---
    // Claude classifies the message and extracts data
    const { intent, data } = await detectIntent(body);

    // --- RESET ---
    if (intent === 'RESET') {
      await clearHistory(from);
      await sendMessage(from, 'Conversation reset! How can I help you? 👋');
      return;
    }

    // --- START RESUME UPLOAD ---
    if (intent === 'START_RESUME_UPLOAD') {
      startResumeUpload(from);
      await sendMessage(from, '📋 Resume upload started!\n\nSend your resume in as many messages as you need.\nSay *"done"* when finished.\nSay *"cancel"* to abort.\n\nOr just send a PDF or Word file directly!');
      return;
    }

    // --- TAILOR RESUME ---
    if (intent === 'TAILOR_RESUME') {
      if (!data.jobDescription) {
        await sendMessage(from, 'Please include the job description. Example:\n"Tailor my resume for this role: [paste JD here]"');
        return;
      }
      await sendMessage(from, '⏳ Tailoring your resume...');
      const tailored = await tailorResume(from, data.jobDescription);
      await sendMessage(from, `✅ Tailored resume:\n\n${tailored}`);
      return;
    }

    // --- COVER LETTER ---
    if (intent === 'COVER_LETTER') {
      if (!data.jobDescription) {
        await sendMessage(from, 'Please include the job description. Example:\n"Write a cover letter for: [paste JD here]"');
        return;
      }
      await sendMessage(from, '⏳ Writing your cover letter...');
      const letter = await generateCoverLetter(from, data.jobDescription);
      await sendMessage(from, `✅ Cover letter:\n\n${letter}`);
      return;
    }

    // --- JOB SEARCH ---
    if (intent === 'JOB_SEARCH') {
      if (!data.query) {
        await sendMessage(from, 'What kind of jobs are you looking for? Example:\n"Find me React developer jobs in Austin TX"');
        return;
      }
      await sendMessage(from, `🔍 Searching for *${data.query}*...`);
      const jobs = await searchJobs(data.query);
      const formatted = formatJobsForWhatsApp(jobs);
      await sendMessage(from, `✅ Top jobs for *${data.query}*:\n\n${formatted}`);
      return;
    }

    // --- ADD APPLICATION ---
    if (intent === 'ADD_APPLICATION') {
      if (!data.company) {
        await sendMessage(from, 'Please mention the company name. Example:\n"I applied to Google for a React Engineer role"');
        return;
      }
      const app = await addApplication(from, data.company, data.role || 'Not specified', data.link || '');
      await sendMessage(from, `✅ Application saved!\n\n🏢 *${app.company}*\n💼 ${app.role}\n📊 Status: ${app.status}\n📅 Date: ${app.date}\n\nSay "my applications" to see all tracked jobs.`);
      return;
    }

    // --- UPDATE STATUS ---
    if (intent === 'UPDATE_STATUS') {
      if (!data.company || !data.status) {
        await sendMessage(from, 'Please mention the company and new status.\nExample: "Google rejected me" or "I got an offer from Meta"');
        return;
      }
      const updated = await updateStatus(from, data.company, data.status);
      if (!updated) {
        await sendMessage(from, `Couldn't find an application for *${data.company}*. Check your applications with "my applications".`);
        return;
      }
      await sendMessage(from, `✅ Updated *${updated.company}* to *${updated.status}*!`);
      return;
    }

    // --- VIEW APPLICATIONS ---
    if (intent === 'VIEW_APPLICATIONS') {
      const summary = await formatApplications(from);
      await sendMessage(from, summary);
      return;
    }

    // --- GENERAL CONVERSATION ---
    await addMessage(from, 'user', body);
    const history = await getHistory(from);
    const reply = await askClaude(history);
    await addMessage(from, 'assistant', reply);
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