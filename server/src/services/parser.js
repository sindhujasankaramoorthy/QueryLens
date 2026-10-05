const Papa = require('papaparse');
const XLSX = require('xlsx');
const path = require('path');

/**
 * Parses uploaded dataset buffer based on extension/mime type into array of row objects.
 * Supports CSV, XLSX, XLS, and JSON.
 * Returns normalized object: { fileName, fileSize, fileType, rows, columns }
 */
function parseDataset(buffer, originalname) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }

  const ext = path.extname(originalname).toLowerCase();
  const fileName = originalname;
  const fileSize = buffer.length;

  let rows = [];
  let fileType = 'unknown';

  if (ext === '.csv' || ext === '.txt') {
    fileType = 'csv';
    const content = buffer.toString('utf-8');
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false // keep original values as raw strings or parsed explicitly in profiler
    });

    if (parsed.errors && parsed.errors.length > 0) {
      // Filter critical errors
      const fatalErrors = parsed.errors.filter(e => e.type === 'Delimiter' || e.code === 'UndetectableDelimiter');
      if (fatalErrors.length > 0) {
        throw new Error(`Failed to parse CSV file: ${fatalErrors[0].message}`);
      }
    }

    rows = parsed.data || [];
  } else if (ext === '.xlsx' || ext === '.xls') {
    fileType = ext === '.xlsx' ? 'xlsx' : 'xls';
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel file contains no worksheets.');
      }
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    } catch (err) {
      throw new Error(`Failed to parse Excel file: ${err.message}`);
    }
  } else if (ext === '.json') {
    fileType = 'json';
    try {
      const content = buffer.toString('utf-8');
      const jsonContent = JSON.parse(content);
      
      if (Array.isArray(jsonContent)) {
        rows = jsonContent;
      } else if (typeof jsonContent === 'object' && jsonContent !== null) {
        // Find first array property if it's an object wrapping an array
        const arrayProp = Object.values(jsonContent).find(v => Array.isArray(v));
        if (arrayProp) {
          rows = arrayProp;
        } else {
          rows = [jsonContent];
        }
      } else {
        throw new Error('JSON file must contain an array of objects or an object wrapping records.');
      }
    } catch (err) {
      throw new Error(`Failed to parse JSON file: ${err.message}`);
    }
  } else {
    throw new Error(`Unsupported file type '${ext}'. Please upload CSV, XLSX, XLS, or JSON files.`);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Dataset contains no data rows.');
  }

  // Extract unique column headers from all rows
  const columnsSet = new Set();
  rows.forEach(row => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach(key => columnsSet.add(key));
    }
  });

  const columns = Array.from(columnsSet);

  if (columns.length === 0) {
    throw new Error('Dataset contains no valid column headers.');
  }

  return {
    fileName,
    fileSize,
    fileType,
    rows,
    columns
  };
}

module.exports = {
  parseDataset
};
