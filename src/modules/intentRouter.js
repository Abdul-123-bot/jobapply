// src/modules/intentRouter.js

// This module replaces the keyword-based detectIntent() function.
// Instead of checking for exact phrases, we send the user's message
// to Claude with a routing prompt and ask it to return a structured
// JSON object with the intent and any extracted data.
//
// This means users can speak naturally — Claude figures out what
// they mean and extracts the relevant info in one step.

const { askClaude } = require('./claude');

// The routing prompt tells Claude exactly what intents exist
// and what data to extract for each one.
// It must instruct Claude to return ONLY JSON — no extra text.
const ROUTING_PROMPT = `
You are an intent classifier for a WhatsApp job application assistant.

Given a user message, return ONLY a JSON object (no explanation, no markdown, no extra text) with:
- "intent": one of the intents listed below
- "data": an object with extracted information relevant to that intent

Available intents and their data fields:

1. START_RESUME_UPLOAD
   - User wants to upload or save their resume
   - data: {}

2. FINISH_RESUME_UPLOAD
   - User says they are done uploading their resume (e.g. "done", "that's all", "finished")
   - data: {}

3. CANCEL_RESUME_UPLOAD
   - User wants to cancel the resume upload
   - data: {}

4. TAILOR_RESUME
   - User wants their resume tailored to a job description
   - data: { "jobDescription": "the full job description text" }

5. COVER_LETTER
   - User wants a cover letter written for a job
   - data: { "jobDescription": "the full job description text" }

6. JOB_SEARCH
   - User wants to find or search for job listings
   - data: { "query": "extracted search query e.g. React developer Austin TX" }

7. ADD_APPLICATION
   - User says they applied to a job
   - data: { "company": "company name", "role": "job title", "link": "url if mentioned or empty string" }

8. UPDATE_STATUS
   - User wants to update the status of a job application
   - Valid statuses: applied, interviewing, offer, rejected, withdrawn
   - data: { "company": "company name", "status": "new status" }

9. VIEW_APPLICATIONS
   - User wants to see their tracked applications
   - data: {}

10. RESET
    - User wants to reset or clear the conversation
    - data: {}

11. SET_JOB_TITLE
    - User wants to set or update their preferred job title for auto search
    - data: { "jobTitle": "the job title they specified" }

12. SET_LOCATION
    - User wants to set or update their preferred job search location
    - data: { "location": "the location they specified" }

13. SET_KEYWORDS
    - User wants to set additional search keywords (e.g. "remote", "startup", "React")
    - data: { "keywords": "the keywords they specified" }

14. START_AUTO_SEARCH
    - User wants to enable the automatic hourly job search
    - data: {}

15. STOP_AUTO_SEARCH
    - User wants to disable the automatic hourly job search
    - data: {}

16. VIEW_PREFERENCES
    - User wants to see their current auto search preferences
    - data: {}

17. SEARCH_NOW
    - User wants to trigger an immediate job search using their saved preferences
    - data: {}

18. APPLY_JOB
    - User wants to mark a job card as applied (e.g. "apply JOB-007", "I'll apply to JOB-012")
    - data: { "jobId": "JOB-007" }

19. SKIP_JOB
    - User wants to dismiss/skip a job card (e.g. "skip JOB-003", "not interested in JOB-003")
    - data: { "jobId": "JOB-003" }

20. VIEW_PENDING
    - User wants to see their list of pending job cards awaiting a decision
    - data: {}

21. GENERAL
    - Message doesn't match any of the above
    - data: {}

Examples:
User: "I just heard back from Stripe, they want to do an interview!"
Response: {"intent":"UPDATE_STATUS","data":{"company":"Stripe","status":"interviewing"}}

User: "find me frontend jobs in New York"
Response: {"intent":"JOB_SEARCH","data":{"query":"frontend developer New York"}}

User: "write a cover letter for this: We are looking for a React engineer..."
Response: {"intent":"COVER_LETTER","data":{"jobDescription":"We are looking for a React engineer..."}}

User: "I applied to Amazon for a software engineer role"
Response: {"intent":"ADD_APPLICATION","data":{"company":"Amazon","role":"software engineer","link":""}}

User: "what jobs are available in bangalore for node developers"
Response: {"intent":"JOB_SEARCH","data":{"query":"Node.js developer Bangalore"}}

User: "Google rejected me :("
Response: {"intent":"UPDATE_STATUS","data":{"company":"Google","status":"rejected"}}

User: "set my job title to Senior React Developer"
Response: {"intent":"SET_JOB_TITLE","data":{"jobTitle":"Senior React Developer"}}

User: "I'm looking in Austin Texas"
Response: {"intent":"SET_LOCATION","data":{"location":"Austin, TX"}}

User: "start auto search"
Response: {"intent":"START_AUTO_SEARCH","data":{}}

User: "apply JOB-007"
Response: {"intent":"APPLY_JOB","data":{"jobId":"JOB-007"}}

User: "skip JOB-003"
Response: {"intent":"SKIP_JOB","data":{"jobId":"JOB-003"}}

User: "show my pending jobs"
Response: {"intent":"VIEW_PENDING","data":{}}

Return ONLY the JSON object. No explanation. No markdown. No backticks.
`;

/**
 * Uses Claude to classify the user's intent and extract
 * relevant data from their message in one step.
 *
 * @param {string} message - the user's raw WhatsApp message
 * @returns {object}       - { intent: string, data: object }
 */
async function detectIntent(message) {
  try {
    const response = await askClaude([
      {
        role: 'user',
        content: `${ROUTING_PROMPT}\n\nUser message: "${message}"`,
      },
    ]);

    // Strip any accidental markdown backticks just in case
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    console.log(`🎯 Intent detected: ${parsed.intent}`, parsed.data);
    return parsed;

  } catch (error) {
    // If Claude returns something we can't parse, fall back to GENERAL
    console.error('❌ Intent detection failed:', error.message);
    return { intent: 'GENERAL', data: {} };
  }
}

module.exports = { detectIntent };