const express = require('express');
const multer = require('multer');
const { parseDataset } = require('../services/parser');
const { profileDataset } = require('../services/profiler');
const { generateDatasetInsights } = require('../services/insightEngine');

const router = express.Router();

// Memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json', '.txt'];
    const lowerName = file.originalname.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => lowerName.endsWith(ext));
    if (hasValidExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Supported extensions: ${allowedExtensions.join(', ')}`));
    }
  }
});

/**
 * POST /api/datasets/profile
 * Uploads dataset file, parses schema, performs profiling, returns JSON profile.
 */
router.post('/profile', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds maximum limit of 50MB.' });
        }
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please provide a dataset file.' });
    }

    try {
      // Step 1: Parse dataset safely
      const parsedData = parseDataset(req.file.buffer, req.file.originalname);

      // Step 2: Profile dataset
      const profileResult = profileDataset(parsedData);

      // Step 3: Phase 6 Deterministic Insights
      const insightResult = generateDatasetInsights(parsedData.rows, profileResult.columns.map(c => c.name));

      // Return structured profile response
      return res.status(200).json({
        success: true,
        rows: parsedData.rows,
        insights: insightResult.insights,
        ...profileResult
      });
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: parseError.message || 'Failed to process and profile dataset.'
      });
    }
  });
});

module.exports = router;
