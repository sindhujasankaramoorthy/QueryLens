import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';

export default function FileUpload({ onFileUpload, isLoading, error }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div>
      <div 
        className={`upload-card ${isDragActive ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".csv,.xlsx,.xls,.json,.txt"
          className="file-input"
        />

        {isLoading ? (
          <div className="loading-box">
            <div className="spinner"></div>
            <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>Parsing and profiling dataset...</p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Detecting schema, inferring data types, and computing empirical statistics.
            </p>
          </div>
        ) : (
          <>
            <div className="upload-icon-wrapper">
              <Upload size={32} />
            </div>
            <h2 className="upload-title">Drop your dataset here or click to browse</h2>
            <p className="upload-desc">
              Upload any tabular dataset in CSV, Excel, or JSON format. Schema and stats will be parsed automatically.
            </p>
            <div className="supported-types">
              <span className="type-tag">.CSV</span>
              <span className="type-tag">.XLSX</span>
              <span className="type-tag">.XLS</span>
              <span className="type-tag">.JSON</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Dataset Parsing Error</strong>
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
