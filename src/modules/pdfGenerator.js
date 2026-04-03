// src/modules/pdfGenerator.js
// Converts plain-text resume into a clean PDF using pdfkit.
// The PDF is written to a temp file path and returned.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Generates a PDF from resume text.
 * Preserves section headers (ALL CAPS lines), bullet points, and spacing.
 *
 * @param {string} resumeText - plain text resume content
 * @param {string} outputPath - absolute path to write the PDF
 * @returns {Promise<void>}
 */
function generateResumePDF(resumeText, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    const lines = resumeText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        doc.moveDown(0.4);
        continue;
      }

      // Section headers: all caps, short lines
      const isHeader = trimmed === trimmed.toUpperCase() && trimmed.length > 2 && trimmed.length < 60;
      // Bullet points
      const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');

      if (isHeader) {
        doc
          .moveDown(0.5)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(trimmed, { underline: false })
          .moveDown(0.2);
      } else if (isBullet) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(trimmed, { indent: 15, lineGap: 2 });
      } else {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(trimmed, { lineGap: 2 });
      }
    }

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/**
 * Returns a temp file path for a user+job combo.
 */
function getTempPdfPath(userId, jobId) {
  const safe = userId.replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(os.tmpdir(), `resume_${safe}_${jobId}.pdf`);
}

module.exports = { generateResumePDF, getTempPdfPath };
