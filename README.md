# 🔍 QueryLens

**AI-powered natural language data analytics with validated execution.**

QueryLens lets users analyze datasets by asking questions in **plain English** instead of writing SQL or code. Each request is converted into a structured **SVG analytical plan**, validated before execution, computed deterministically, visualized, and explained using the actual results.

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

### Core Principle

> **The AI decides what analysis to perform; deterministic computation produces the result.**

This separates AI reasoning from numerical computation and helps keep analytical results verifiable.

---

## ✨ Features

* 🗣️ **Natural Language Analytics** — analyze datasets without writing SQL or code
* 🧩 **SVG Analytical Planning** — converts user requests into structured analytical operations
* 🛡️ **Plan Validation** — validates columns, operations, data types, and analytical logic before execution
* ⚡ **Deterministic Execution** — calculations are performed on the actual dataset
* 📊 **Automatic Visualization** — generates visual output appropriate to the analysis
* 🧠 **Grounded AI Explanations** — explanations are based on computed results
* 🔎 **Semantic Data Understanding** — distinguishes identifiers, measures, categorical fields, and date/time fields
* 🚨 **Error Handling** — detects invalid or unsupported analytical requests

---

## 📊 Supported Analytics

| Category                  | Details                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| **Descriptive Analytics** | Sum, average, minimum, maximum, count, grouped aggregation                 |
| **Correlation**           | Pearson correlation, direction, strength, and rows analyzed                |
| **Trend Analysis**        | Time-based aggregation and trend direction                                 |
| **Anomaly Detection**     | IQR-based outlier detection                                                |
| **Forecasting**           | Historical values, forecast values, prediction intervals, forecast horizon |
| **Forecast Evaluation**   | MAE, RMSE, MAPE                                                            |
| **Executive Summary**     | Dataset-level summary based on computed evidence                           |
| **Recommendations**       | Evidence-based actions from trends, forecasts, and findings                |

---

## 🔬 Reliability Architecture

QueryLens follows a controlled analytical pipeline:

```text
AI Reasoning
     ↓
Structured SVG Planning
     ↓
Plan Validation
     ↓
Deterministic Computation
     ↓
Verified Result
     ↓
Grounded Explanation
```

This helps reduce:

* Calculation hallucinations
* Unsupported conclusions
* Incorrect aggregation
* Invalid operations
* Unverified AI-generated results

**AI output is not treated as the final analytical truth.**

---

## 🌐 Domain Independence

QueryLens is designed to work across different types of tabular datasets rather than being restricted to a single domain.

For example, the same architecture can analyze:

* 📈 Business and sales data
* 🏥 Medical datasets
* 📦 Inventory data
* 👥 Customer data
* 📊 Other structured datasets

A medical dataset could support analytical queries such as:

```text
Which patients have high temperature and low SpO2?
```

or:

```text
What is the correlation between Temperature_F and Heart_Rate_BPM?
```

> ⚠️ Medical functionality is intended for analytical and decision-support demonstrations only. It is not intended for autonomous diagnosis or treatment.

---

## 💡 Example Queries

### Sales

```text
Show sales by region.
```

```text
What is the correlation between Sales and Customer_Rating?
```

```text
What is the sales trend over time?
```

```text
Forecast monthly sales for the next 3 months.
```

### Data Quality

```text
Are there any unusual sales values?
```

### Business Intelligence

```text
Give me an executive summary of the dataset.
```

```text
What actions should I take based on the forecast?
```

---

## 🧠 Why QueryLens?

Traditional data analysis often requires users to combine:

```text
SQL
+
Data Processing
+
Statistics
+
Visualization
+
Data Interpretation
```

QueryLens brings these steps together behind a natural-language interface while keeping the actual analytical execution **structured and verifiable**.

The goal is not simply to generate an AI answer.

The goal is to turn:

> **"Ask a question about your data."**

into:

> **"Generate → Validate → Compute → Visualize → Explain."**

---

## 🛠️ Tech Stack

* **AI / Large Language Model**
* **Structured SVG analytical planning**
* **Deterministic data processing**
* **Statistical analysis**
* **Time-series forecasting**
* **Data visualization**
* **Natural-language query processing**

---

## ⚙️ Installation

```bash
git clone https://github.com/sindhujasankaramoorthy/QueryLens.git

cd QueryLens
```

Install the required frontend and backend dependencies, configure the required environment variables, and start the application.

> Refer to the project configuration for the required environment variables and startup commands.

---

## 📂 Project Structure

```text
QueryLens/
├── frontend/
├── backend/
├── README.md
└── ...
```
