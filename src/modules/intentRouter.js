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

11. GENERAL
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