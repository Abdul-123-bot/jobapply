// src/modules/webhook.js

const { sendMessage } = require('./messenger');
const { askClaude } = require('./claude');
const { getHistory, addMessage, clearHistory } = require('./memory');
const { saveResume, tailorResume, startResumeUpload, isUploadingResume, appendResumeChunk, finalizeResumeUpload, cancelResumeUpload } = require('./resume');
const { generateCoverLetter } = require('./coverLetter');
const { searchJobs, formatJobsForWhatsApp } = require('./jobSearch');
const { addApplication, updateStatus, formatApplications } = require('./tracker');
const { detectIntent } = require('./intentRouter');
const { extractTextFromDocument } = require('./docParser');
const { getPreferences, setPreference } = require('./preferences');
const { runAutoSearch } = require('./autoApplier');
const { getProfile, setProfileField, isProfileComplete, getMissingFields } = require('./profile');
const { applyToJob } = require('./applicator');
const supabase = require('../config/supabase');

function parseIncomingMessage(req) {
  const from = req.body.From;
  const body = req.body.Body || '';
  const numMedia = parseInt(req.body.NumMedia || '0');
  const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null;
  const mediaType = numMedia > 0 ? req.body.MediaContentType0 : null;
  return { from, body, mediaUrl, mediaType };
}

async function handleIncomingMessage(req, res) {
  res.sendStatus(200);

  const { from, body, mediaUrl, mediaType } = parseIncomingMessage(req);
  console.log(`📩 Message from ${from}: ${body}`);

  try {

    // --- DOCUMENT UPLOAD ---
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

    // --- SET JOB TITLE ---
    if (intent === 'SET_JOB_TITLE') {
      if (!data.jobTitle) {
        await sendMessage(from, 'What job title should I search for? Example:\n"set my job title to Senior React Developer"');
        return;
      }
      await setPreference(from, 'job_title', data.jobTitle);
      await sendMessage(from, `✅ Job title set to: *${data.jobTitle}*\n\nAlso set your location:\n"I'm looking in Austin TX"`);
      return;
    }

    // --- SET LOCATION ---
    if (intent === 'SET_LOCATION') {
      if (!data.location) {
        await sendMessage(from, 'What location should I search in?');
        return;
      }
      await setPreference(from, 'location', data.location);
      await sendMessage(from, `✅ Location set to: *${data.location}*`);
      return;
    }

    // --- SET KEYWORDS ---
    if (intent === 'SET_KEYWORDS') {
      if (!data.keywords) {
        await sendMessage(from, 'What keywords should I include? Example:\n"set keywords remote, TypeScript, startup"');
        return;
      }
      await setPreference(from, 'keywords', data.keywords);
      await sendMessage(from, `✅ Keywords set to: *${data.keywords}*`);
      return;
    }

    // --- START AUTO SEARCH ---
    if (intent === 'START_AUTO_SEARCH') {
      const prefs = await getPreferences(from);
      if (!prefs || !prefs.job_title) {
        await sendMessage(from, '⚠️ Set your job title first:\n"set my job title to React Developer"\n\nOptionally also set location and keywords.');
        return;
      }
      await setPreference(from, 'active', true);
      await sendMessage(
        from,
        `✅ Auto job search *enabled!*\n\n🔍 Searching every hour for: *${prefs.job_title}*${prefs.location ? ` in *${prefs.location}*` : ''}\n\nI'll send you job cards as I find new ones.\nReply *"apply JOB-XXX"* or *"skip JOB-XXX"* for each one.\n\nSay *"search now"* to run an immediate search.`
      );
      return;
    }

    // --- STOP AUTO SEARCH ---
    if (intent === 'STOP_AUTO_SEARCH') {
      await setPreference(from, 'active', false);
      await sendMessage(from, '⏹ Auto job search *disabled*. Say "start auto search" to turn it back on.');
      return;
    }

    // --- VIEW PREFERENCES ---
    if (intent === 'VIEW_PREFERENCES') {
      const prefs = await getPreferences(from);
      if (!prefs) {
        await sendMessage(from, 'No preferences set yet.\n\nTry:\n"set my job title to React Developer"\n"I\'m looking in Austin TX"\n"set keywords remote, startup"');
        return;
      }
      await sendMessage(
        from,
        `⚙️ *Your Preferences*\n\n💼 Job title: ${prefs.job_title || 'not set'}\n📍 Location: ${prefs.location || 'not set'}\n🔑 Keywords: ${prefs.keywords || 'not set'}\n🤖 Auto search: ${prefs.active ? '✅ On' : '⏹ Off'}`
      );
      return;
    }

    // --- SEARCH NOW ---
    if (intent === 'SEARCH_NOW') {
      const prefs = await getPreferences(from);
      if (!prefs || !prefs.job_title) {
        await sendMessage(from, '⚠️ Set your job title first:\n"set my job title to React Developer"');
        return;
      }
      await sendMessage(from, '🔍 Running job search now...');
      await runAutoSearch(from, prefs);
      return;
    }

    // --- APPLY JOB ---
    if (intent === 'APPLY_JOB') {
      if (!data.jobId) {
        await sendMessage(from, 'Which job? Example: "apply JOB-007"');
        return;
      }
      const numericId = parseInt(data.jobId.replace(/JOB-/i, ''), 10);

      const { data: job, error } = await supabase
        .from('pending_jobs')
        .select('*')
        .eq('id', numericId)
        .eq('user_id', from)
        .single();

      if (error || !job) {
        await sendMessage(from, `❌ Couldn't find *${data.jobId}*. Say "pending jobs" to see your list.`);
        return;
      }

      // Check profile is set up before attempting
      const profile = await getProfile(from);
      if (!isProfileComplete(profile)) {
        const missing = getMissingFields(profile);
        await sendMessage(from, `⚠️ Your profile is incomplete. Please set:\n${missing.map(f => `• ${f}`).join('\n')}\n\nExample: "my email is you@example.com"`);
        return;
      }

      await sendMessage(from, `⏳ Applying to *${job.title}* at *${job.company}*...\n\nI'm tailoring your resume and filling out the form. This may take up to a minute.`);

      // Run full apply pipeline (async — res already sent 200)
      const result = await applyToJob(from, job);

      // Update pending_jobs with outcome
      await supabase
        .from('pending_jobs')
        .update({
          status: result.success ? 'applied' : result.status,
          actioned_at: new Date().toISOString(),
        })
        .eq('id', numericId);

      if (result.success) {
        // Add to application tracker
        await addApplication(from, job.company, job.title, job.apply_link);
        await sendMessage(
          from,
          `✅ *Application submitted!*\n\n🏢 ${job.company}\n💼 ${job.title}\n🤖 ATS: ${result.ats}\n\n${result.notes}\n\nAdded to your tracker. Say "my applications" to see all.`
        );
      } else if (result.status === 'manual_required') {
        // Store in DB for reference, notify user
        await supabase
          .from('pending_jobs')
          .update({ status: 'manual_required' })
          .eq('id', numericId);
        await sendMessage(
          from,
          `⚠️ *Manual application required*\n\n🏢 ${job.company}\n💼 ${job.title}\n\n${result.notes}`
        );
      } else {
        await sendMessage(
          from,
          `❌ *Application failed*\n\n🏢 ${job.company}\n💼 ${job.title}\n\nReason: ${result.notes}`
        );
      }
      return;
    }

    // --- SKIP JOB ---
    if (intent === 'SKIP_JOB') {
      if (!data.jobId) {
        await sendMessage(from, 'Which job? Example: "skip JOB-003"');
        return;
      }
      const numericId = parseInt(data.jobId.replace(/JOB-/i, ''), 10);

      const { error } = await supabase
        .from('pending_jobs')
        .update({ status: 'skipped', actioned_at: new Date().toISOString() })
        .eq('id', numericId)
        .eq('user_id', from);

      if (error) {
        await sendMessage(from, `❌ Couldn't find *${data.jobId}*.`);
        return;
      }

      await sendMessage(from, `↩️ Skipped *${data.jobId}*.`);
      return;
    }

    // --- VIEW PENDING ---
    if (intent === 'VIEW_PENDING') {
      const { data: pending } = await supabase
        .from('pending_jobs')
        .select('id, title, company, sent_at')
        .eq('user_id', from)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false })
        .limit(10);

      if (!pending || pending.length === 0) {
        await sendMessage(from, 'No pending jobs right now.\n\nSay *"search now"* or *"start auto search"* to find new ones.');
        return;
      }

      const list = pending
        .map(j => `🆔 *JOB-${String(j.id).padStart(3, '0')}*\n  ${j.title} @ ${j.company}`)
        .join('\n\n');

      await sendMessage(from, `📋 *Pending Jobs (${pending.length})*\n\n${list}\n\nReply *"apply JOB-XXX"* or *"skip JOB-XXX"*`);
      return;
    }

    // --- SET PROFILE ---
    if (intent === 'SET_PROFILE') {
      if (!data.field || !data.value) {
        await sendMessage(from, 'What info would you like to set? Example:\n"my name is Abdul Kareem"\n"my email is you@example.com"\n"my phone is +1-555-0000"');
        return;
      }

      // Handle credentials separately — split "email:x|password:y"
      if (data.field === 'linkedin_creds') {
        const parts = Object.fromEntries(data.value.split('|').map(p => p.split(':')));
        if (parts.email) await setProfileField(from, 'linkedin_email', parts.email.trim());
        if (parts.password) await setProfileField(from, 'linkedin_pass', parts.password.trim());
        await sendMessage(from, '✅ LinkedIn credentials saved.');
        return;
      }

      if (data.field === 'indeed_creds') {
        const parts = Object.fromEntries(data.value.split('|').map(p => p.split(':')));
        if (parts.email) await setProfileField(from, 'indeed_email', parts.email.trim());
        if (parts.password) await setProfileField(from, 'indeed_pass', parts.password.trim());
        await sendMessage(from, '✅ Indeed credentials saved.');
        return;
      }

      await setProfileField(from, data.field, data.value);
      await sendMessage(from, `✅ Saved *${data.field.replace(/_/g, ' ')}*: ${data.value}`);

      // Prompt for missing fields
      const updated = await getProfile(from);
      if (!isProfileComplete(updated)) {
        const missing = getMissingFields(updated);
        await sendMessage(from, `Still needed for auto-apply:\n${missing.map(f => `• ${f.replace(/_/g, ' ')}`).join('\n')}`);
      } else {
        await sendMessage(from, '🎉 Profile complete! Auto-apply is ready to go.');
      }
      return;
    }

    // --- VIEW PROFILE ---
    if (intent === 'VIEW_PROFILE') {
      const profile = await getProfile(from);
      if (!profile) {
        await sendMessage(from, '📋 No profile set yet.\n\nSay things like:\n"my name is Abdul Kareem"\n"my email is you@example.com"\n"my phone is +1-555-0000"\n"I\'m based in Austin TX"\n"I have OPT EAD work authorization"');
        return;
      }
      const complete = isProfileComplete(profile);
      const missing = getMissingFields(profile);
      await sendMessage(
        from,
        `👤 *Your Profile*\n\n` +
        `🙋 Name: ${profile.full_name || 'not set'}\n` +
        `📧 Email: ${profile.email || 'not set'}\n` +
        `📱 Phone: ${profile.phone || 'not set'}\n` +
        `📍 Location: ${profile.location || 'not set'}\n` +
        `🛂 Work auth: ${profile.work_auth || 'not set'}\n` +
        `🔗 LinkedIn: ${profile.linkedin_url || 'not set'}\n` +
        `🌐 Portfolio: ${profile.portfolio_url || 'not set'}\n` +
        `🔑 LinkedIn login: ${profile.linkedin_email ? '✅ set' : 'not set'}\n` +
        `🔑 Indeed login: ${profile.indeed_email ? '✅ set' : 'not set'}\n\n` +
        (complete ? '✅ Profile complete — auto-apply is ready!' : `⚠️ Missing: ${missing.join(', ')}`)
      );
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
  parseIncomingMessage,
};
