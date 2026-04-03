// src/modules/atsDetector.js
// Detects which ATS (Applicant Tracking System) a job apply link belongs to.
// Returns a string key used to route to the correct Playwright handler.

const ATS_PATTERNS = [
  { name: 'greenhouse', patterns: ['boards.greenhouse.io', 'job_app?token=', 'greenhouse.io/job_app'] },
  { name: 'lever',      patterns: ['jobs.lever.co'] },
  { name: 'linkedin',   patterns: ['linkedin.com/jobs', 'linkedin.com/job'] },
  { name: 'indeed',     patterns: ['indeed.com/apply', 'smartapply.indeed.com', 'indeed.com/job'] },
  { name: 'workday',    patterns: ['myworkdayjobs.com', 'wd1.myworkdayjobs.com', 'wd3.myworkdayjobs.com', 'wd5.myworkdayjobs.com'] },
];

/**
 * Detects the ATS from a job application URL.
 *
 * @param {string} url - the apply link
 * @returns {string}   - 'greenhouse' | 'lever' | 'linkedin' | 'indeed' | 'workday' | 'unknown'
 */
function detectATS(url) {
  if (!url) return 'unknown';

  const lower = url.toLowerCase();

  for (const { name, patterns } of ATS_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) {
      return name;
    }
  }

  return 'unknown';
}

module.exports = { detectATS };
