const express = require('express');
const cors = require('cors');
const datasetsRouter = require('./routes/datasets');
const analysisRouter = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/datasets', datasetsRouter);
app.use('/api/analysis', analysisRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PSA01 API Server' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`PSA01 Server running on port ${PORT}`);
});

module.exports = app;
