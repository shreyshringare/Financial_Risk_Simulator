# Financial Risk Simulator  *(Work in Progress)*

A Python-based simulation tool to model stock price behavior using Monte Carlo methods and assess investment risk through quantitative metrics such as Value at Risk (VaR) and Conditional Value at Risk (CVaR).

---

##  Overview

This project serves as a foundational tool for exploring probabilistic forecasting and financial risk analytics. It leverages historical market data to simulate future asset paths and estimate potential downside risks, enabling informed decision-making in uncertain market conditions.

---

## Current Capabilities

-  **Historical Data Ingestion** via [`yfinance`](https://pypi.org/project/yfinance/)
-  **Monte Carlo Simulations** of future stock prices (Geometric Brownian Motion)
-  **Visualizations** of simulated price paths
-  **Risk Estimation**:
  - Value at Risk (VaR)
  - Conditional Value at Risk (CVaR)

---

## Tech Stack

- **Language**: Python 3.10+
- **Libraries**: `pandas`, `numpy`, `matplotlib`, `yfinance`
- **Environment**: CLI-based (Jupyter & Streamlit support coming soon)

---

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/<your-username>/Financial_Risk_Simulator.git
cd Financial_Risk_Simulator
pip install -r requirements.txt
python main.py
