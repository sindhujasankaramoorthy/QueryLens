# QueryLens — Schema-Agnostic AI Data Analyst & Analytics Engine

QueryLens is an intelligent, schema-agnostic data analytics workspace that translates natural language questions into **100% verifiable, deterministic data insights**. Built with pure JavaScript calculations, Gemini AI planning & explanations, and dynamic visualization dashboards.

---

## 🌟 Key Features

- 📊 **Schema-Agnostic Data Profiling (Phase 1)**: Supports CSV, Excel (`.xlsx`, `.xls`), and JSON files. Auto-detects data types, missing values, duplicates, and statistical summaries.
- 🎯 **Verifiable Plan Generation (Phase 2)**: Translates natural language questions into structured, machine-readable JSON analysis contracts validated against actual dataset schema.
- ⚡ **Pure JS Deterministic Engine (Phase 3)**: Computes mathematical answers (sum, avg, median, min, max, group aggregations, top-N, time-series) with zero AI calculation hallucination.
- 📈 **Dynamic Visualizations (Phase 4)**: Automatically generates scalar KPI cards, formatted grouped tables, line charts, bar charts, and scatter plots.
- 🤖 **Grounded AI Explanations (Phase 5)**: Explains mathematical findings in simple natural language, backed by strict grounding verification. Supports multi-turn conversational follow-ups.
- 🔍 **Data Quality Audit & Insights (Phase 6)**: Automatically detects missing value patterns, duplicate rows, constant columns, and IQR statistical outliers.
- 🔗 **Correlation Analysis (Phase 7.1)**: Computes Pearson correlation coefficients ($r$) deterministically with paired observation filtering, zero-variance handling, and scatter plot charts.
- 🌓 **Modern Light & Dark Theme UI**: A hackathon-quality React client with persistent light/dark mode toggling, stepper navigation, and responsive layout.

---

## 🛠️ Architecture Overview

```text
RAW DATASET (CSV / XLSX / JSON)
       │
       ▼
[ Data Profiler & Parser ]
       │
       ▼
[ Natural Language Query Workbench ] ──► [ LLM Planner & Schema Validator ]
                                                     │
                                                     ▼
                                      [ Validated Execution Contract (JSON) ]
                                                     │
                                                     ▼
                                      [ Pure JS Deterministic Engine ]
                                                     │
                                                     ▼
                                      [ Scatter / Bar / Line Visualizations ]
                                                     │
                                                     ▼
                                      [ Grounded AI Explanation Guard ]
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sindhujasankaramoorthy/QueryLens.git
   cd QueryLens
   ```

2. **Install Server Dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies**:
   ```bash
   cd ../client
   npm install
   ```

---

## 💻 Running the Application

1. **Start Backend Server** (Port `5000`):
   ```bash
   cd server
   npm run dev
   ```

2. **Start Frontend Client** (Port `3000`):
   ```bash
   cd client
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`.

---

## 🧪 Running Unit & Integration Tests

QueryLens includes an extensive test suite with **98 automated tests** covering all phases:

```bash
cd server
npm test
```

### Individual Test Suites:
- `npm run test:phase1` — Profiler & Parser Tests
- `npm run test:phase2` — Plan Validator Tests
- `npm run test:phase3` — Deterministic Execution Engine Tests
- `npm run test:phase4` — Visualization Selector Tests
- `npm run test:phase5` — Explainer Grounding Tests
- `npm run test:phase6` — Quality Insights Tests
- `npm run test:phase7` — Correlation Analysis Tests

---

## 📜 License

MIT License. Designed & developed as part of PSA01 Intelligence Engine.
