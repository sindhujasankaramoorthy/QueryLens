# 🔍 QueryLens

**Ask questions about your data in plain English — get validated, reproducible answers.**

QueryLens is an AI-powered analytics platform that turns natural-language questions into a structured **SVG analytical plan**, validates it, executes it deterministically, and explains the result in plain language.

> *"Show sales by region"* · *"What is the correlation between Sales and Customer_Rating?"* · *"Forecast monthly sales for the next 3 months."*

---

## Table of Contents

- [Why QueryLens?](#-why-querylens)
- [How It Works](#-how-it-works)
- [Features](#-features)
- [Example Queries](#-example-queries)
- [Example Workflow](#-example-workflow)
- [Reliability Approach](#-reliability-approach)
- [Cross-Domain Use](#-cross-domain-use)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Project Structure](#-project-structure)
- [Future Scope](#-future-scope)
- [Author](#-author)

---

## 🚀 Why QueryLens?

Data analysis usually demands SQL, data manipulation, statistics, visualization tools and forecasting know-how. QueryLens removes that barrier.

The key difference: QueryLens **does not simply ask an AI model for an answer**. The AI decides *what* analysis to run; the numbers come from *deterministic computation*.

| Problem | How QueryLens solves it |
|---|---|
| Technical barrier | Ask in plain English, no SQL or code |
| Manual analysis | Correlations, trends, anomalies and forecasts are computed for you |
| Unreliable AI answers | Results are executed deterministically, not generated |
| Lack of transparency | The SVG plan shows the intended operation |
| Visualization difficulty | Charts are produced directly from the query |
| Hard-to-read numbers | AI explanations are grounded in computed results |

---

## 🏗️ How It Works

```text
Natural Language Query
        ↓
Intent Understanding
        ↓
SVG Analytical Plan
        ↓
Plan Validation ──(invalid)──▶ Error Response
        ↓ (valid)
Deterministic Execution
        ↓
Numerical Result
        ├──▶ Visualization
        └──▶ Grounded AI Explanation
```

**Plan validation** blocks problems before execution, such as:

- Invalid columns
- Unsupported operations
- Incorrect analytical combinations
- Unnecessary aggregation
- Invalid numerical operations (e.g. an identifier like `Order_ID` is never summed just because it is numeric)

---

## ✨ Features

### 💬 Natural Language Analytics
Ask questions in plain English, no programming required.

### 🧠 SVG-Based Analytical Planning
Requests are converted into a structured plan, separating *what the AI thinks should happen* from *what the system actually executes*.

### 📊 Supported Analytics

| Category | Details |
|---|---|
| **Descriptive** | Sum, average, min, max, count, grouped aggregation |
| **Correlation** | Pearson correlation, reporting coefficient, direction, strength and rows analyzed |
| **Trend analysis** | Time-based aggregation (e.g. monthly) with trend direction |
| **Anomaly detection** | IQR method: values outside `Q1 − 1.5×IQR` or `Q3 + 1.5×IQR` |
| **Forecasting** | Historical values, forecast values, prediction intervals, horizon |
| **Forecast evaluation** | MAE, RMSE, MAPE |

### 📋 Executive Summary
Generates a high-level dataset summary based on computed evidence, not unsupported statements.

### 💡 Evidence-Based Recommendations
Recommendations are grounded in calculated trends, forecasts and other findings.

---

## 🧪 Example Queries

| Type | Query |
|---|---|
| Basic | `What are the total sales?` · `What is the average customer rating?` |
| Grouping | `Show sales by region.` |
| Filtering | `Show sales for the South region.` |
| Correlation | `What is the correlation between Sales and Customer_Rating?` |
| Trend | `What is the sales trend over time?` |
| Anomalies | `Are there any unusual sales values?` |
| Forecast | `Forecast monthly sales for the next 3 months.` |
| Summary | `Give me an executive summary of the dataset.` |
| Recommendations | `What actions should I take based on the forecast?` |

---

## 🔄 Example Workflow

**Query:** `Show sales by region`

**Generated operation:**
```text
GROUP BY Region
SUM(Sales)
```

**Result:**
```text
Region    Sales
-----------------
South     ...
West      ...
North     ...
East      ...
```

The result is then visualized automatically and explained using the computed values only.

---

## 🔬 Reliability Approach

> **AI decides what analysis to perform. Deterministic computation produces the result.**

```text
AI reasoning + Structured planning + Validation
        + Deterministic computation + Grounded explanation
```

This reduces calculation hallucinations, unsupported conclusions, incorrect aggregation and invalid operations. AI-generated output is never treated as final analytical truth.

---

## 🌐 Cross-Domain Use

The architecture is domain-independent. For example, a medical dataset with `Patient_ID`, `Age`, `Temperature_F`, `SpO2_Percent`, `Heart_Rate_BPM` supports queries like:

```text
Which patients have high temperature and low SpO2?
What is the correlation between Temperature_F and Heart_Rate_BPM?
```

> ⚠️ Medical use cases are for analytical/decision-support demonstrations only, **not** for autonomous diagnosis or treatment.

---

## 🛠️ Tech Stack

- AI / Large Language Model
- Structured SVG analytical planning
- Deterministic data processing
- Statistical analysis & time-series forecasting
- Data visualization

> _TODO: list the exact frontend, backend and library names used in this repository._

---

## ⚙️ Installation

```bash
git clone https://github.com/sindhujasankaramoorthy/QueryLens.git
cd QueryLens
```

Then:

1. Install dependencies for the frontend and backend.
2. Configure the required environment variables.
3. Start the application using the project's development commands.

> _TODO: add exact install/run commands and a `.env` example._

---

## 📂 Project Structure

```text
QueryLens/
├── frontend/
├── backend/
├── README.md
└── ...
```

> _TODO: update to match the final repository structure._

---

## 🔮 Future Scope

- Additional statistical techniques and forecasting models
- Automated dataset quality recommendations
- Domain-specific analytical modules
- Multi-dataset analysis
- Role-based access
- Exportable analytical reports
- More visualization types
- Conversational follow-up questions
- Production deployment

---

## 🎯 Vision

QueryLens aims to make data analysis as simple as asking a question: **"What is happening in my data?"**
