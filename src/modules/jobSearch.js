// src/modules/jobSearch.js

// This module handles job searching.
// It calls the JSearch API to find real job listings
// and formats them into WhatsApp-friendly messages.
//
// It is completely isolated — no Twilio, no Claude, no resume logic.
// Just: search query in → formatted job listings out.

const fetch = require('node-fetch');
const { RAPIDAPI_KEY } = require('../config/env');

/**
 * Searches for jobs using the JSearch API.
 *
 * @param {string} query    - the search query e.g. "React developer Austin TX"
 * @param {number} numJobs  - how many jobs to return (default 3)
 * @returns {Array}         - array of job objects
 */
function formatSalary(job) {
  if (!job.job_min_salary && !job.job_max_salary) return null;
  const currency = job.job_salary_currency || 'USD';
  const period = job.job_salary_period ? `/${job.job_salary_period.toLowerCase()}` : '/yr';
  const min = job.job_min_salary ? `$${Math.round(job.job_min_salary / 1000)}k` : null;
  const max = job.job_max_salary ? `$${Math.round(job.job_max_salary / 1000)}k` : null;
  if (min && max) return `${min} - ${max} ${currency}${period}`;
  return `${min || max} ${currency}${period}`;
}

async function searchJobs(query, numJobs = 3) {
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1&page=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });

  const data = await response.json();

  // JSearch returns a `data` array of job listings
  if (!data.data || data.data.length === 0) {
    return [];
  }

  // Return only the fields we care about, trimmed to numJobs
  return data.data.slice(0, numJobs).map((job, index) => ({
    index: index + 1,
    title: job.job_title,
    company: job.employer_name,
    location: job.job_city
      ? `${job.job_city}, ${job.job_state || job.job_country}`
      : job.job_country,
    type: job.job_employment_type || 'Full-time',
    remote: job.job_is_remote ? '🌐 Remote' : '🏢 On-site',
    posted: job.job_posted_at_datetime_utc
      ? new Date(job.job_posted_at_datetime_utc).toDateString()
      : 'Unknown',
    applyLink: job.job_apply_link,
    salary: formatSalary(job),
    description: job.job_description || 'No description available',
    requirements: (job.job_highlights?.Qualifications || []).slice(0, 5).join('\n'),
  }));
}

/**
 * Formats job listings into a readable WhatsApp message.
 *
 * @param {Array} jobs - array of job objects from searchJobs()
 * @returns {string}   - formatted message string
 */
function formatJobsForWhatsApp(jobs) {
  if (jobs.length === 0) {
    return 'No jobs found for that search. Try a different role or location.';
  }

  return jobs
    .map(
      (job) => `
*${job.index}. ${job.title}*
🏢 ${job.company}
📍 ${job.location} | ${job.remote}
💼 ${job.type}${job.salary ? `\n💰 ${job.salary}` : ''}
📅 Posted: ${job.posted}
🔗 Apply: ${job.applyLink}
      `.trim()
    )
    .join('\n\n---\n\n');
}

module.exports = { searchJobs, formatJobsForWhatsApp };