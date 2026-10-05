/**
 * Deterministic Data Quality & Evidence-Based Insight Engine for PSA01 (Phase 6)
 * Calculates dataset quality metrics, numerical IQR outliers, and distribution insights deterministically.
 * Strict principle: RAW DATA -> DETERMINISTIC ANALYSIS -> STRUCTURED EVIDENCE -> AI EXPLANATION.
 * Schema-Agnostic: No hardcoded dataset column assumptions.
 */

const https = require('https');
const { isMissingValue } = require('./profiler');
const { verifyAndSanitizeExplanation } = require('./llmExplainer');

function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return NaN;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  return NaN;
}

/**
 * Calculates IQR (Interquartile Range) statistics and detects outliers deterministically
 */
function calculateIQRStats(numbers) {
  if (!numbers || numbers.length === 0) return null;

  const count = numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[count - 1];

  const sum = numbers.reduce((acc, c) => acc + c, 0);
  const mean = sum / count;

  // Median (Q2)
  let median;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  // Quartile 1 (25th percentile) and Quartile 3 (75th percentile)
  const getPercentile = (arr, p) => {
    if (arr.length === 1) return arr[0];
    const index = (arr.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  };

  const q1 = getPercentile(sorted, 0.25);
  const q3 = getPercentile(sorted, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Outlier identification
  const outliers = sorted.filter(v => v < lowerBound || v > upperBound);
  const outlierCount = outliers.length;
  const outlierPercentage = Number(((outlierCount / count) * 100).toFixed(2));

  // Extract distinct sample outliers (up to 5)
  const sampleOutliers = Array.from(new Set(outliers)).slice(0, 5);

  return {
    count,
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    q1: Number(q1.toFixed(4)),
    q3: Number(q3.toFixed(4)),
    iqr: Number(iqr.toFixed(4)),
    lowerBound: Number(lowerBound.toFixed(4)),
    upperBound: Number(upperBound.toFixed(4)),
    outlierCount,
    outlierPercentage,
    sampleOutliers
  };
}

/**
 * Generate all Phase 6 deterministic insights & evidence contracts
 */
function generateDatasetInsights(rows, columns) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return {
      success: true,
      rowCount: 0,
      columnCount: 0,
      insights: []
    };
  }

  const normalizedColumns = Array.isArray(columns)
    ? columns
    : (rows.length > 0 ? Object.keys(rows[0]) : []);

  const rowCount = rows.length;
  const columnCount = normalizedColumns.length;
  const insights = [];

  // 1. DUPLICATE ROWS CHECK
  const seenRows = new Set();
  let duplicateCount = 0;
  rows.forEach(row => {
    const key = normalizedColumns.map(col => {
      const v = row[col];
      return isMissingValue(v) ? '' : String(v).trim();
    }).join('||');
    if (seenRows.has(key)) duplicateCount++;
    else seenRows.add(key);
  });

  const duplicatePercentage = Number(((duplicateCount / rowCount) * 100).toFixed(2));
  if (duplicateCount > 0) {
    const severity = duplicatePercentage > 15 ? 'high' : duplicatePercentage > 5 ? 'moderate' : 'low';
    insights.push({
      id: 'insight_duplicate_rows',
      insightType: 'duplicates',
      severity,
      column: null,
      title: 'Duplicate Rows Detected',
      observation: `Dataset contains ${duplicateCount} duplicate row(s) (${duplicatePercentage}% of dataset).`,
      whyItMatters: 'Duplicate rows can inflate counts and skew statistical metrics if not accounted for.',
      evidence: {
        rowCount,
        duplicateCount,
        duplicatePercentage
      },
      confidence: 'high',
      limitations: ['Original dataset rows are preserved without modification.']
    });
  }

  // 2. COLUMN-BY-COLUMN QUALITY, OUTLIER & DISTRIBUTION ANALYSIS
  normalizedColumns.forEach(col => {
    const colName = typeof col === 'object' && col !== null ? col.name : String(col);
    if (!colName) return;
    let missingCount = 0;
    const validValues = [];
    const validNumbers = [];

    rows.forEach(row => {
      const val = row[colName];
      if (isMissingValue(val)) {
        missingCount++;
      } else {
        validValues.push(val);
        const num = parseNumber(val);
        if (!isNaN(num)) validNumbers.push(num);
      }
    });

    const nonMissingCount = validValues.length;
    const missingPercentage = Number(((missingCount / rowCount) * 100).toFixed(2));

    // A. MISSING VALUES INSIGHT
    if (missingCount > 0) {
      const severity = missingPercentage >= 50 ? 'high' : missingPercentage >= 15 ? 'moderate' : 'low';
      insights.push({
        id: `insight_missing_${colName}`,
        insightType: 'missing_values',
        severity,
        column: colName,
        title: `Missing Values in '${colName}'`,
        observation: `'${colName}' contains ${missingCount} missing value(s) out of ${rowCount} rows (${missingPercentage}%).`,
        whyItMatters: `Analytical operations requiring '${colName}' will ignore missing entries in deterministic calculations.`,
        evidence: {
          rowCount,
          missingCount,
          nonMissingCount,
          missingPercentage
        },
        confidence: 'high',
        limitations: ['Missing entries are automatically excluded during aggregate operations.']
      });
    }

    // B. EMPTY OR CONSTANT COLUMN INSIGHT
    const uniqueValuesSet = new Set(validValues.map(v => String(v).trim()));
    if (missingCount === rowCount) {
      insights.push({
        id: `insight_empty_${colName}`,
        insightType: 'quality_warning',
        severity: 'high',
        column: colName,
        title: `Completely Empty Column '${colName}'`,
        observation: `Column '${colName}' is completely empty across all ${rowCount} rows.`,
        whyItMatters: `Column '${colName}' cannot be used for grouping or statistical calculations.`,
        evidence: { rowCount, missingCount, missingPercentage: 100 },
        confidence: 'high',
        limitations: []
      });
    } else if (uniqueValuesSet.size === 1 && rowCount > 1) {
      insights.push({
        id: `insight_constant_${colName}`,
        insightType: 'low_variation',
        severity: 'info',
        column: colName,
        title: `Constant Value in '${colName}'`,
        observation: `Column '${colName}' contains the constant value '${Array.from(uniqueValuesSet)[0]}' across all valid records.`,
        whyItMatters: 'Constant columns provide no variance for comparative grouping or trend analysis.',
        evidence: { rowCount, uniqueCount: 1, constantValue: Array.from(uniqueValuesSet)[0] },
        confidence: 'high',
        limitations: []
      });
    }

    // C. NUMERICAL OUTLIER ANALYSIS (IQR METHOD)
    const isIdentifierCol = (
      (typeof col === 'object' && col?.semanticType === 'identifier') ||
      colName.toLowerCase() === 'id' ||
      colName.toLowerCase().endsWith('_id') ||
      colName.toLowerCase().endsWith('-id') ||
      colName.toLowerCase().startsWith('id_') ||
      colName.toLowerCase().includes('order_id') ||
      colName.toLowerCase().includes('customer_id') ||
      colName.toLowerCase().includes('user_id') ||
      colName.toLowerCase().includes('product_id') ||
      colName.toLowerCase().includes('code') ||
      colName === '#'
    );

    const numericPercentage = validNumbers.length / Math.max(1, validValues.length);
    if (!isIdentifierCol && numericPercentage >= 0.8 && validNumbers.length >= 4) {
      const iqrStats = calculateIQRStats(validNumbers);

      if (iqrStats && iqrStats.outlierCount > 0) {
        const severity = iqrStats.outlierPercentage > 15 ? 'high' : iqrStats.outlierPercentage > 5 ? 'moderate' : 'low';
        insights.push({
          id: `insight_outliers_${colName}`,
          insightType: 'outliers',
          severity,
          column: colName,
          title: `Statistical Outliers in '${colName}'`,
          observation: `Column '${colName}' contains ${iqrStats.outlierCount} statistical outlier(s) (${iqrStats.outlierPercentage}%) outside the IQR bound [${iqrStats.lowerBound}, ${iqrStats.upperBound}].`,
          whyItMatters: `Column '${colName}' contains ${iqrStats.outlierCount} statistical outliers according to the IQR method. These values are statistically unusual data points and are not automatically considered data errors.`,
          evidence: {
            rowCount,
            column: colName,
            outlierCount: iqrStats.outlierCount,
            outlierPercentage: iqrStats.outlierPercentage,
            lowerBound: iqrStats.lowerBound,
            upperBound: iqrStats.upperBound,
            q1: iqrStats.q1,
            q3: iqrStats.q3,
            iqr: iqrStats.iqr,
            min: iqrStats.min,
            max: iqrStats.max,
            sampleOutliers: iqrStats.sampleOutliers
          },
          confidence: 'high',
          limitations: ['An outlier represents an unusual data point, not automatically a data quality error.']
        });
      }

      // Large range check
      if (iqrStats && iqrStats.max - iqrStats.min > iqrStats.median * 10 && iqrStats.min > 0) {
        insights.push({
          id: `insight_range_${colName}`,
          insightType: 'numerical_distribution',
          severity: 'info',
          column: colName,
          title: `Wide Range in '${colName}'`,
          observation: `'${colName}' exhibits a wide numerical range from ${iqrStats.min} to ${iqrStats.max} (median: ${iqrStats.median}).`,
          whyItMatters: 'Wide numerical ranges suggest high variance across recorded items.',
          evidence: { column: colName, min: iqrStats.min, max: iqrStats.max, median: iqrStats.median, std: iqrStats.std },
          confidence: 'high',
          limitations: []
        });
      }
    }

    // D. CATEGORICAL DISTRIBUTION, TIE & DOMINANCE ANALYSIS
    if (validValues.length > 0 && (numericPercentage < 0.8 || uniqueValuesSet.size <= 30)) {
      const countsMap = new Map();
      validValues.forEach(v => {
        const k = String(v).trim();
        countsMap.set(k, (countsMap.get(k) || 0) + 1);
      });

      const totalValidCat = validValues.length;
      const sortedCats = Array.from(countsMap.entries()).sort((a, b) => b[1] - a[1]);

      if (sortedCats.length > 1) {
        const topCount = sortedCats[0][1];
        const tiedTop = sortedCats.filter(entry => entry[1] === topCount);
        const topPct = Number(((topCount / totalValidCat) * 100).toFixed(2));

        if (tiedTop.length > 1) {
          // Tie detected between top categories
          const catNames = tiedTop.map(e => `'${e[0]}'`).join(' and ');
          const isEvenSplit = (tiedTop.length * topCount === totalValidCat);
          const observationText = isEvenSplit
            ? `Categories ${catNames} are equally represented, with ${topCount} records each (${topPct}%).`
            : `Categories ${catNames} are tied as the most frequent categories, with ${topCount} records each (${topPct}%).`;

          insights.push({
            id: `insight_tied_${colName}`,
            insightType: 'category_distribution',
            severity: 'info',
            column: colName,
            title: `Tied Categories in '${colName}'`,
            observation: observationText,
            whyItMatters: `Multiple categories have equal representation of ${topCount} records each.`,
            evidence: {
              column: colName,
              totalValid: totalValidCat,
              uniqueCount: countsMap.size,
              tiedCategories: tiedTop.map(e => e[0]),
              countPerTiedCategory: topCount,
              percentagePerTiedCategory: topPct
            },
            confidence: 'high',
            limitations: ['Equal frequency reflects sample distribution.']
          });
        } else {
          // Single top category (no tie)
          const secondCount = sortedCats[1][1];
          if (topPct >= 65) {
            insights.push({
              id: `insight_dominant_${colName}`,
              insightType: 'dominant_category',
              severity: 'info',
              column: colName,
              title: `Dominant Category in '${colName}'`,
              observation: `'${sortedCats[0][0]}' represents ${topPct}% of valid '${colName}' records (${topCount}/${totalValidCat}) and is the dominant category.`,
              whyItMatters: `Data is concentrated in category '${sortedCats[0][0]}'.`,
              evidence: {
                column: colName,
                totalValid: totalValidCat,
                uniqueCount: countsMap.size,
                dominantCategory: sortedCats[0][0],
                dominantCount: topCount,
                dominantPercentage: topPct
              },
              confidence: 'high',
              limitations: ['Category concentration reflects sample representation.']
            });
          } else if (topPct >= 35 && topCount > secondCount * 1.3) {
            insights.push({
              id: `insight_frequent_${colName}`,
              insightType: 'category_distribution',
              severity: 'info',
              column: colName,
              title: `Most Frequent Category in '${colName}'`,
              observation: `'${sortedCats[0][0]}' is the most frequent category, accounting for ${topPct}% of records (${topCount}/${totalValidCat}).`,
              whyItMatters: `Category '${sortedCats[0][0]}' appears most frequently in '${colName}'.`,
              evidence: {
                column: colName,
                totalValid: totalValidCat,
                uniqueCount: countsMap.size,
                mostFrequentCategory: sortedCats[0][0],
                mostFrequentCount: topCount,
                mostFrequentPercentage: topPct
              },
              confidence: 'high',
              limitations: []
            });
          }
        }
      }
    }
  });

  // 3. INSIGHT PRIORITIZATION
  const severityWeight = { high: 4, moderate: 3, low: 2, info: 1 };
  insights.sort((a, b) => {
    const weightDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    if (weightDiff !== 0) return weightDiff;
    const aPct = a.evidence?.missingPercentage || a.evidence?.outlierPercentage || a.evidence?.dominantPercentage || 0;
    const bPct = b.evidence?.missingPercentage || b.evidence?.outlierPercentage || b.evidence?.dominantPercentage || 0;
    return bPct - aPct;
  });

  return {
    success: true,
    rowCount,
    columnCount,
    insights
  };
}

/**
 * Deterministic Fallback AI Insight Explanation Generator
 */
function generateDeterministicInsightExplanation(insights) {
  if (!insights || insights.length === 0) {
    return 'Dataset analysis revealed clean data quality with no critical missing values, outliers, or duplicate rows.';
  }

  const lines = ['Data Quality & Statistical Insights Summary:'];
  insights.forEach((ins, idx) => {
    lines.push(`${idx + 1}. [${ins.severity.toUpperCase()}] ${ins.observation} ${ins.whyItMatters}`);
  });

  return lines.join('\n');
}

/**
 * AI Explainer Layer for Phase 6 Insights with Evidence Grounding Guard
 */
async function generateInsightExplanation(insightsPayload, options = {}) {
  const insights = Array.isArray(insightsPayload)
    ? insightsPayload
    : (insightsPayload?.insights || []);

  if (insights.length === 0) {
    return 'Dataset analysis revealed clean data quality with no critical missing values, outliers, or duplicate rows.';
  }

  const apiKey = options.forceFallback ? null : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateDeterministicInsightExplanation(insights);
  }

  try {
    const prompt = `You are PSA01, an evidence-grounded AI data analyst.
Examine the following structured Phase 6 dataset insights and summarize them clearly for the user.

CRITICAL RULES:
1. ONLY refer to numbers, counts, percentages, and values that are explicitly provided in the evidence array below.
2. DO NOT calculate new figures, invent unstated business causes, or claim outliers are data errors.
3. Keep your response professional, objective, and neutral.

STRUCTURED INSIGHTS EVIDENCE:
${JSON.stringify(insights, null, 2)}

Provide a concise, 2-3 paragraph synthesis explaining what these data quality observations mean and cautioning user on analytical impact.`;

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });

    const responseText = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed.candidates?.[0]?.content?.parts?.[0]?.text || '');
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Gemini API error ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    // Run Evidence Grounding Sanitizer
    const evidenceObj = { insights };
    return verifyAndSanitizeExplanation(responseText, evidenceObj);
  } catch (err) {
    console.warn(`Insight AI explainer fallback used: ${err.message}`);
    return generateDeterministicInsightExplanation(insights);
  }
}

module.exports = {
  calculateIQRStats,
  generateDatasetInsights,
  generateInsightExplanation,
  generateDeterministicInsightExplanation
};
