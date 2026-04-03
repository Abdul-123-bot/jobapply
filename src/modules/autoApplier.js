// src/modules/autoApplier.js
// Runs an hourly cron job for each active user:
//   1. Searches for jobs based on their saved preferences
//   2. Filters out already-seen jobs
//   3. Sends each new job as a full WhatsApp card with a JOB-XXX ID
//   4. User replies "apply JOB-XXX" or "skip JOB-XXX" to action it
//
// Supabase table required:
//   pending_jobs (
//     id          SERIAL PRIMARY KEY,
//     user_id     TEXT,
//     job_key     TEXT,          -- MD5 hash of applyLink, for deduplication
//     title       TEXT,
//     company     TEXT,
//     location    TEXT,
//     type        TEXT,
//     remote      TEXT,
//     salary      TEXT,
//     description TEXT,
//     requirements TEXT,
//     apply_link  TEXT,
//     posted      TEXT,
//     status      TEXT DEFAULT 'pending',  -- pending | applied | skipped
//     sent_at     TIMESTAMPTZ,
//     actioned_at TIMESTAMPTZ
//   )
//   UNIQUE constraint on (user_id, job_key)

const cron = require('node-cron');
const crypto = require('crypto');
const { searchJobs } = require('./jobSearch');
const { getActiveUsers } = require('./preferences');
const { sendMessage } = require('./messenger');
const supabase = require('../config/supabase');

function makeJobKey(applyLink) {
  return crypto.createHash('md5').update(applyLink).digest('hex').slice(0, 12);
}

function formatJobCard(job, jobId) {
  const salaryLine = job.salary ? `💰 ${job.salary}\n` : '';
  const descPreview = job.description.slice(0, 500) + (job.description.length > 500 ? '...' : '');
  const reqSection = job.requirements
    ? `\n✅ *Requirements:*\n${job.requirements.split('\n').map(r => `• ${r}`).join('\n')}\n`
    : '';

  return [
    `🆔 *${jobId}*`,
    `📌 *${job.title}*`,
    `🏢 ${job.company}`,
    `📍 ${job.location} | ${job.remote}`,
    `💼 ${job.type}`,
    salaryLine ? salaryLine.trim() : null,
    `📅 Posted: ${job.posted}`,
    ``,
    `📋 *About the role:*`,
    descPreview,
    reqSection ? reqSection.trim() : null,
    ``,
    `🔗 ${job.applyLink}`,
    ``,
    `Reply *"apply ${jobId}"* to track as applied`,
    `Reply *"skip ${jobId}"* to dismiss`,
  ].filter(line => line !== null).join('\n');
}

async function runAutoSearch(userId, prefs) {
  const query = [prefs.job_title, prefs.location, prefs.keywords]
    .filter(Boolean)
    .join(' ');

  if (!query.trim()) {
    console.log(`⚠️  No preferences set for ${userId}, skipping`);
    return;
  }

  console.log(`🔍 Searching jobs for ${userId}: "${query}"`);

  let jobs;
  try {
    jobs = await searchJobs(query, 5);
  } catch (err) {
    console.error(`❌ Job search failed for ${userId}:`, err.message);
    return;
  }

  if (jobs.length === 0) {
    console.log(`No jobs found for ${userId}`);
    return;
  }

  let newCount = 0;

  for (const job of jobs) {
    const jobKey = makeJobKey(job.applyLink);

    // Skip if already sent to this user
    const { data: existing } = await supabase
      .from('pending_jobs')
      .select('id')
      .eq('user_id', userId)
      .eq('job_key', jobKey)
      .maybeSingle();

    if (existing) continue;

    // Save to pending_jobs
    const { data: inserted, error } = await supabase
      .from('pending_jobs')
      .insert({
        user_id: userId,
        job_key: jobKey,
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        remote: job.remote,
        salary: job.salary || null,
        description: job.description,
        requirements: job.requirements || null,
        apply_link: job.applyLink,
        posted: job.posted,
        status: 'pending',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to save pending job:', error.message);
      continue;
    }

    const jobId = `JOB-${String(inserted.id).padStart(3, '0')}`;
    const card = formatJobCard(job, jobId);

    try {
      await sendMessage(userId, card);
      newCount++;
    } catch (err) {
      console.error(`❌ Failed to send card to ${userId}:`, err.message);
    }
  }

  if (newCount > 0) {
    console.log(`✅ Sent ${newCount} new job(s) to ${userId}`);
  } else {
    console.log(`No new jobs to send to ${userId}`);
  }
}

function startCronJob() {
  console.log('⏰ Auto job search cron started (runs every hour)');

  cron.schedule('0 * * * *', async () => {
    console.log(`\n🤖 [${new Date().toISOString()}] Running hourly job search...`);

    let activeUsers;
    try {
      activeUsers = await getActiveUsers();
    } catch (err) {
      console.error('❌ Failed to fetch active users:', err.message);
      return;
    }

    console.log(`Found ${activeUsers.length} active user(s)`);

    for (const prefs of activeUsers) {
      await runAutoSearch(prefs.user_id, prefs);
    }
  });
}

module.exports = { startCronJob, runAutoSearch };
