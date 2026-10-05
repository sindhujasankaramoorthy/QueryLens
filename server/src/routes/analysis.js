const express = require('express');
const { generateAnalysisPlan } = require('../services/llmPlanner');
const { validateAnalysisPlan } = require('../services/planValidator');
const { executeAnalysisPlan } = require('../services/analysisEngine');
const { determineVisualization } = require('../services/chartSelector');
const { generateExplanation } = require('../services/llmExplainer');

const router = express.Router();

/**
 * POST /api/analysis/execute
 * Takes natural language question (or plan), dataset schema, dataset rows, and optional context.
 * Generates plan, validates plan, executes plan deterministically, computes visualization & AI explanation.
 */
router.post('/execute', async (req, res) => {
  try {
    const { question, plan: customPlan, columns, rows, context } = req.body;

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Dataset columns schema is required.' });
    }

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Dataset rows array is required for execution.' });
    }

    let validationResult;
    if (customPlan) {
      validationResult = validateAnalysisPlan(customPlan, columns);
    } else {
      if (!question || typeof question !== 'string' || question.trim() === '') {
        return res.status(400).json({ error: 'Please provide a non-empty question or plan.' });
      }
      validationResult = await generateAnalysisPlan(question.trim(), columns, { context });
    }

    if (!validationResult.isValid || validationResult.status !== 'validated') {
      const unvalidatedEvidence = {
        question: question ? question.trim() : null,
        status: validationResult.status,
        reason: validationResult.reason,
        clarificationQuestion: validationResult.clarificationQuestion
      };
      const explanation = await generateExplanation(unvalidatedEvidence);

      return res.status(200).json({
        success: true,
        question: question ? question.trim() : null,
        validation: validationResult,
        execution: null,
        explanation
      });
    }

    // Phase 3: Deterministic execution
    const executionResult = executeAnalysisPlan(validationResult.plan, rows);

    if (executionResult.status === 'cannot_answer') {
      const unvalidatedEvidence = {
        question: question ? question.trim() : null,
        status: 'cannot_answer',
        reason: executionResult.reason
      };
      const explanation = await generateExplanation(unvalidatedEvidence);

      return res.status(200).json({
        success: true,
        question: question ? question.trim() : null,
        validation: { status: 'cannot_answer', reason: executionResult.reason },
        execution: executionResult,
        explanation
      });
    }

    // Phase 4: Automatic Visualization Selection
    const visualization = determineVisualization(executionResult, validationResult.plan);

    // Phase 5: Evidence-Grounded AI Explanation
    const evidence = {
      question: question ? question.trim() : null,
      status: 'validated',
      plan: validationResult.plan,
      result: executionResult.result,
      metadata: executionResult.metadata,
      operation: executionResult.operation
    };

    const explanation = await generateExplanation(evidence);

    return res.status(200).json({
      success: true,
      question: question ? question.trim() : null,
      validation: validationResult,
      execution: executionResult,
      visualization,
      explanation
    });
  } catch (err) {
    console.error('Execution Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during analysis execution.'
    });
  }
});

/**
 * POST /api/analysis/chat
 * Handles multi-turn conversational follow-ups.
 */
router.post('/chat', async (req, res) => {
  try {
    const { question, context, columns, rows } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Please provide a non-empty question.' });
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Dataset columns schema is required.' });
    }

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Dataset rows array is required for execution.' });
    }

    const validationResult = await generateAnalysisPlan(question.trim(), columns, { context });

    if (!validationResult.isValid || validationResult.status !== 'validated') {
      const unvalidatedEvidence = {
        question: question.trim(),
        status: validationResult.status,
        reason: validationResult.reason,
        clarificationQuestion: validationResult.clarificationQuestion
      };
      const explanation = await generateExplanation(unvalidatedEvidence);

      return res.status(200).json({
        success: true,
        question: question.trim(),
        validation: validationResult,
        execution: null,
        explanation
      });
    }

    const executionResult = executeAnalysisPlan(validationResult.plan, rows);
    const visualization = determineVisualization(executionResult, validationResult.plan);

    const evidence = {
      question: question.trim(),
      status: 'validated',
      plan: validationResult.plan,
      result: executionResult.result,
      metadata: executionResult.metadata,
      operation: executionResult.operation
    };

    const explanation = await generateExplanation(evidence);

    return res.status(200).json({
      success: true,
      question: question.trim(),
      validation: validationResult,
      execution: executionResult,
      visualization,
      explanation
    });
  } catch (err) {
    console.error('Chat Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during chat follow-up execution.'
    });
  }
});

/**
 * POST /api/analysis/plan
 */
router.post('/plan', async (req, res) => {
  try {
    const { question, columns, context } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Please provide a non-empty natural language question.' });
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Please provide dataset column schema metadata.' });
    }

    const validationResult = await generateAnalysisPlan(question.trim(), columns, { context });

    return res.status(200).json({
      success: true,
      question: question.trim(),
      ...validationResult
    });
  } catch (err) {
    console.error('Error generating analysis plan:', err);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while generating the analysis plan.'
    });
  }
});

/**
 * POST /api/analysis/suggested-questions
 */
router.post('/suggested-questions', (req, res) => {
  try {
    const { columns } = req.body;
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: 'Columns schema is required.' });
    }

    const numericCols = columns.filter(c => c.type === 'integer' || c.type === 'float');
    const catCols = columns.filter(c => c.type === 'categorical' || c.type === 'text');
    const dateCols = columns.filter(c => c.type === 'date' || c.type === 'datetime');

    const suggestions = [];

    if (catCols.length > 0 && numericCols.length > 0) {
      suggestions.push(`Which ${catCols[0].name} has the highest total ${numericCols[0].name}?`);
    }

    if (numericCols.length > 0) {
      suggestions.push(`What is the average ${numericCols[0].name}?`);
      if (numericCols.length > 1) {
        suggestions.push(`What is the maximum ${numericCols[1].name}?`);
      }
    }

    if (catCols.length > 0 && numericCols.length > 0) {
      suggestions.push(`Show top 5 ${catCols[0].name} by ${numericCols[0].name}.`);
    }

    if (dateCols.length > 0 && numericCols.length > 0) {
      suggestions.push(`Show monthly ${numericCols[0].name} over time.`);
    }

    if (suggestions.length === 0) {
      suggestions.push('How many records are in this dataset?');
      suggestions.push('Describe the overall dataset summary.');
    }

    return res.json({ success: true, suggestions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analysis/insights
 * Phase 6 Endpoint: Generates deterministic dataset insights, IQR outliers, and AI evidence synthesis.
 */
router.post('/insights', async (req, res) => {
  try {
    const { rows, columns } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Dataset rows array is required.' });
    }

    const { generateDatasetInsights, generateInsightExplanation } = require('../services/insightEngine');
    const insightResult = generateDatasetInsights(rows, columns);
    const explanation = await generateInsightExplanation(insightResult.insights);

    return res.json({
      success: true,
      rowCount: insightResult.rowCount,
      columnCount: insightResult.columnCount,
      insights: insightResult.insights,
      explanation
    });
  } catch (err) {
    console.error('Insights Route Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate dataset insights.' });
  }
});

module.exports = router;
