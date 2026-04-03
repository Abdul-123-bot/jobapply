// src/modules/docParser.js

// This module downloads a document attachment from WhatsApp
// (via Twilio's media URL) and extracts the text from it.
// Supports PDF and Word (.docx) files.
//
// How it works:
// 1. Twilio receives the document and stores it temporarily
// 2. Twilio gives us a media URL in the webhook payload
// 3. We download the file using that URL + Twilio credentials
// 4. We extract text depending on file type

const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = require('../config/env');

/**
 * Downloads a file from Twilio's media URL.
 * Twilio requires Basic Auth to access media files.
 *
 * @param {string} mediaUrl - the Twilio media URL
 * @returns {Buffer}        - the raw file bytes
 */
async function downloadMedia(mediaUrl) {
  const credentials = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.statusText}`);
  }

  return await response.buffer();
}

/**
 * Extracts text from a PDF buffer.
 *
 * @param {Buffer} buffer - raw PDF file bytes
 * @returns {string}      - extracted text
 */
async function extractFromPdf(buffer) {
  const result = await pdfParse(buffer);
  return result.text.trim();
}

/**
 * Extracts text from a Word (.docx) buffer.
 *
 * @param {Buffer} buffer - raw docx file bytes
 * @returns {string}      - extracted text
 */
async function extractFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

/**
 * Main function — downloads and extracts text from a WhatsApp document.
 *
 * @param {string} mediaUrl      - Twilio media URL from webhook payload
 * @param {string} mediaType     - MIME type e.g. "application/pdf"
 * @returns {string}             - extracted resume text
 */
async function extractTextFromDocument(mediaUrl, mediaType) {
  console.log(`📄 Downloading document: ${mediaType}`);

  const buffer = await downloadMedia(mediaUrl);

  if (mediaType === 'application/pdf') {
    return await extractFromPdf(buffer);
  }

  if (
    mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mediaType === 'application/msword'
  ) {
    return await extractFromDocx(buffer);
  }

  throw new Error(`Unsupported file type: ${mediaType}. Please send a PDF or Word document.`);
}

module.exports = { extractTextFromDocument };