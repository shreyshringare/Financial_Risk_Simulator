import os
import streamlit as st
from dotenv import load_dotenv
from agent.agent import create_agent, run_agent

load_dotenv()

# --- Page config (MUST be first Streamlit call) ---
st.set_page_config(
    page_title="FinSim — Risk Terminal",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ===== ROBINHOOD-INSPIRED DARK THEME =====
THEME_CSS = """
<style>
/* ===== ROBINHOOD-INSPIRED DARK THEME ===== */

/* Hide Streamlit default chrome */
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {visibility: hidden;}

/* Root variables */
:root {
    --bg-primary: #0F0F0F;
    --bg-card: #161616;
    --bg-card-hover: #1E1E1E;
    --bg-sidebar: #111111;
    --accent-green: #00C805;
    --accent-green-dim: #00A304;
    --accent-red: #FF5000;
    --accent-yellow: #F5C542;
    --accent-blue: #2196F3;
    --text-primary: #FFFFFF;
    --text-secondary: #888888;
    --text-muted: #555555;
    --border: #2A2A2A;
    --border-accent: #00C805;
}

/* App background */
.stApp {
    background-color: var(--bg-primary);
    color: var(--text-primary);
}

/* Main content area */
.main .block-container {
    padding-top: 1rem;
    padding-bottom: 2rem;
    max-width: 1200px;
}

/* Sidebar */
[data-testid="stSidebar"] {
    background-color: var(--bg-sidebar) !important;
    border-right: 1px solid var(--border);
}

[data-testid="stSidebar"] * {
    color: var(--text-primary) !important;
}

/* Cards */
.metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 8px;
    transition: border-color 0.2s;
}

.metric-card:hover {
    border-color: var(--accent-green);
}

.metric-card .label {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
}

.metric-card .value {
    color: var(--text-primary);
    font-size: 24px;
    font-weight: 700;
    font-family: 'SF Mono', 'Fira Code', monospace;
}

.metric-card .value.positive { color: var(--accent-green); }
.metric-card .value.negative { color: var(--accent-red); }

.metric-card .change {
    font-size: 13px;
    margin-top: 2px;
}

/* Header brand */
.app-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0 16px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
}

.app-header .logo {
    font-size: 22px;
    font-weight: 800;
    color: var(--accent-green);
    letter-spacing: -0.5px;
}

.app-header .tagline {
    font-size: 13px;
    color: var(--text-secondary);
    margin-left: 4px;
}

/* Section headers */
.section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin: 20px 0 10px 0;
}

/* Chat messages */
[data-testid="stChatMessageContent"] {
    background-color: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    color: var(--text-primary) !important;
}

/* User chat bubble */
[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]) [data-testid="stChatMessageContent"] {
    background-color: #1A2B1A !important;
    border-color: var(--accent-green) !important;
}

/* Chat input */
[data-testid="stChatInput"] textarea {
    background-color: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    color: var(--text-primary) !important;
}

[data-testid="stChatInput"] textarea:focus {
    border-color: var(--accent-green) !important;
    box-shadow: 0 0 0 2px rgba(0, 200, 5, 0.15) !important;
}

/* Buttons */
.stButton > button {
    background-color: var(--accent-green) !important;
    color: #000000 !important;
    font-weight: 700 !important;
    border: none !important;
    border-radius: 20px !important;
    padding: 8px 20px !important;
    transition: background-color 0.2s !important;
}

.stButton > button:hover {
    background-color: var(--accent-green-dim) !important;
}

/* Selectbox */
[data-testid="stSelectbox"] > div {
    background-color: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
    color: var(--text-primary) !important;
}

/* Text inputs */
[data-testid="stTextInput"] input {
    background-color: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
    color: var(--text-primary) !important;
}

[data-testid="stTextInput"] input:focus {
    border-color: var(--accent-green) !important;
}

/* Metrics (st.metric) */
[data-testid="stMetric"] {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
}

[data-testid="stMetricLabel"] {
    color: var(--text-secondary) !important;
    font-size: 11px !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

[data-testid="stMetricValue"] {
    color: var(--text-primary) !important;
    font-family: 'SF Mono', 'Fira Code', monospace !important;
    font-size: 20px !important;
}

/* Dividers */
hr {
    border-color: var(--border) !important;
    margin: 16px 0 !important;
}

/* Subheaders */
h2, h3 {
    color: var(--text-primary) !important;
    font-weight: 700 !important;
}

/* Spinner */
[data-testid="stSpinner"] {
    color: var(--accent-green) !important;
}

/* Success/Warning/Error */
[data-testid="stSuccess"] {
    background-color: rgba(0, 200, 5, 0.1) !important;
    border: 1px solid var(--accent-green) !important;
    border-radius: 8px !important;
    color: var(--accent-green) !important;
}

[data-testid="stWarning"] {
    background-color: rgba(245, 197, 66, 0.1) !important;
    border: 1px solid var(--accent-yellow) !important;
    border-radius: 8px !important;
}

[data-testid="stError"] {
    background-color: rgba(255, 80, 0, 0.1) !important;
    border: 1px solid var(--accent-red) !important;
    border-radius: 8px !important;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

</style>
"""

# Inject CSS theme
st.markdown(THEME_CSS, unsafe_allow_html=True)

# Header
st.markdown("""
<div class="app-header">
    <span class="logo">◆ FinSim</span>
    <span class="tagline">Quantitative Risk Terminal · GPT-4o · Monte Carlo · GARCH · RAG</span>
</div>
""", unsafe_allow_html=True)


@st.cache_resource
def load_agent():
    return create_agent()


# ===== SIDEBAR =====
with st.sidebar:
    st.markdown("### ◆ FinSim")
    st.markdown('<p style="color:#888;font-size:12px;margin-top:-10px">Risk Terminal v2.0</p>', unsafe_allow_html=True)
    st.divider()

    st.markdown('<div class="section-label">Markets Supported</div>', unsafe_allow_html=True)
    st.markdown("""
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        <span style="background:#1A2B1A;color:#00C805;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600">🇺🇸 NYSE/NASDAQ</span>
        <span style="background:#1A2B1A;color:#00C805;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600">🇮🇳 NSE .NS</span>
        <span style="background:#1A2B1A;color:#00C805;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600">🇬🇧 LSE .L</span>
        <span style="background:#1A2B1A;color:#00C805;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600">🇨🇦 TSX .TO</span>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<div class="section-label">Capabilities</div>', unsafe_allow_html=True)
    capabilities = [
        ("📉", "VaR · CVaR · Sharpe · Drawdown"),
        ("🎲", "Monte Carlo GBM (1000 paths)"),
        ("📊", "Portfolio Correlation + VaR"),
        ("⚡", "Stress Testing (5 crises)"),
        ("📈", "GARCH(1,1) Volatility"),
        ("📐", "Markowitz Efficient Frontier"),
        ("📰", "RSS News + Sentiment"),
        ("💾", "Excel & PowerBI Export"),
        ("🌍", "Global Markets"),
    ]
    for icon, text in capabilities:
        st.markdown(
            f'<div style="display:flex;gap:8px;align-items:center;padding:4px 0;font-size:13px">'
            f'<span>{icon}</span><span style="color:#ccc">{text}</span></div>',
            unsafe_allow_html=True
        )

    st.divider()

    st.markdown('<div class="section-label">Quick Queries</div>', unsafe_allow_html=True)
    quick_queries = [
        "What is the VaR for AAPL?",
        "Run Monte Carlo on RELIANCE.NS",
        "Analyze portfolio: AAPL, MSFT, TSLA",
        "2008 crisis stress test on TSLA",
        "Efficient frontier for AAPL, GOOGL, MSFT",
        "Latest news for NVDA",
        "Export AAPL report to Excel",
    ]
    for q in quick_queries:
        if st.button(q, key=f"quick_{q[:20]}", use_container_width=True):
            st.session_state.pending_query = q

    st.divider()
    st.markdown(
        '<p style="color:#555;font-size:10px;text-align:center">⚠️ Educational use only. Not financial advice.</p>',
        unsafe_allow_html=True
    )


# ===== MAIN LAYOUT: two columns =====
main_col, panel_col = st.columns([2.2, 1], gap="medium")

# ===== RIGHT PANEL =====
with panel_col:
    st.markdown('<div class="section-label">Quick Stats</div>', unsafe_allow_html=True)

    st.markdown("""
    <div class="metric-card">
        <div class="label">Tools Available</div>
        <div class="value positive">11</div>
        <div class="change" style="color:#888">LangChain ReAct tools</div>
    </div>
    <div class="metric-card">
        <div class="label">Simulation Engine</div>
        <div class="value" style="font-size:16px;color:#fff">GBM Monte Carlo</div>
        <div class="change" style="color:#888">1,000 paths · 252 days</div>
    </div>
    <div class="metric-card">
        <div class="label">Knowledge Base</div>
        <div class="value" style="font-size:16px;color:#fff">ChromaDB RAG</div>
        <div class="change" style="color:#888">8 financial sources</div>
    </div>
    <div class="metric-card">
        <div class="label">Model</div>
        <div class="value" style="font-size:16px;color:#2196F3">GPT-4o</div>
        <div class="change" style="color:#888">128K context · 2K cap/tool</div>
    </div>
    """, unsafe_allow_html=True)

    st.divider()

    # Export panel
    st.markdown('<div class="section-label">Export</div>', unsafe_allow_html=True)
    export_ticker = st.text_input(
        "Ticker",
        placeholder="AAPL",
        key="export_ticker",
        label_visibility="collapsed"
    )
    exp_col1, exp_col2 = st.columns(2)
    with exp_col1:
        if st.button("Excel", use_container_width=True, key="btn_excel"):
            if export_ticker:
                with st.spinner(""):
                    result = run_agent(
                        st.session_state.agent,
                        f"Export {export_ticker.upper()} risk analysis to Excel"
                    )
                    st.success("Excel ready")
            else:
                st.warning("Enter a ticker first")
    with exp_col2:
        if st.button("PowerBI", use_container_width=True, key="btn_pbi"):
            if export_ticker:
                with st.spinner(""):
                    result = run_agent(
                        st.session_state.agent,
                        f"Export {export_ticker.upper()} data for PowerBI"
                    )
                    st.success("CSV ready")
            else:
                st.warning("Enter a ticker first")

    st.divider()

    # News panel
    st.markdown('<div class="section-label">Market News</div>', unsafe_allow_html=True)
    news_ticker = st.text_input(
        "Ticker",
        placeholder="AAPL",
        key="news_ticker_input",
        label_visibility="collapsed"
    )
    if st.button("Fetch Headlines", use_container_width=True, key="btn_news"):
        if news_ticker:
            with st.spinner(""):
                result = run_agent(
                    st.session_state.agent,
                    f"Get latest financial news and sentiment for {news_ticker.upper()}"
                )
                st.markdown(
                    f'<div style="font-size:12px;color:#ccc;background:#161616;padding:10px;'
                    f'border-radius:8px;border:1px solid #2a2a2a;max-height:300px;overflow-y:auto">'
                    f'{result}</div>',
                    unsafe_allow_html=True
                )
        else:
            st.warning("Enter a ticker first")


# ===== LEFT COLUMN: CHAT =====
with main_col:
    # Initialize session state
    if "messages" not in st.session_state:
        st.session_state.messages = [{
            "role": "assistant",
            "content": (
                "**Welcome to FinSim Risk Terminal**\n\n"
                "I'm your AI quantitative analyst powered by GPT-4o.\n\n"
                "**What I can do:**\n"
                "- 📉 **VaR & CVaR** — 95% confidence loss estimates\n"
                "- 🎲 **Monte Carlo** — 1,000 GBM simulation paths\n"
                "- 📊 **Portfolio** — Correlation matrix, Cholesky VaR\n"
                "- ⚡ **Stress tests** — 2008, COVID, Dot-com, and more\n"
                "- 📈 **GARCH(1,1)** — Time-varying volatility (R/Python)\n"
                "- 📐 **Efficient frontier** — Markowitz optimal weights\n"
                "- 📰 **News** — RSS headlines with sentiment\n"
                "- 💾 **Export** — Excel workbooks, PowerBI datasets\n\n"
                "*Try: \"What's the VaR for AAPL?\" or \"Analyze portfolio: AAPL, MSFT, TSLA\"*"
            )
        }]
        st.session_state.pending_query = None

    # Load agent once
    if "agent" not in st.session_state:
        with st.spinner("Initializing risk engine..."):
            st.session_state.agent = load_agent()

    # Handle quick query button clicks from sidebar
    if "pending_query" in st.session_state and st.session_state.pending_query:
        pending = st.session_state.pending_query
        st.session_state.pending_query = None
        st.session_state.messages.append({"role": "user", "content": pending})
        with st.spinner("Analyzing..."):
            response = run_agent(st.session_state.agent, pending)
        st.session_state.messages.append({"role": "assistant", "content": response})

    # Render chat history
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Chat input
    if prompt := st.chat_input("Ask about any stock, portfolio, or risk metric..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Analyzing..."):
                try:
                    response = run_agent(st.session_state.agent, prompt)
                    st.markdown(response)
                    st.session_state.messages.append({"role": "assistant", "content": response})
                except Exception as e:
                    err = f"Error: {str(e)}"
                    st.error(err)
                    st.session_state.messages.append({"role": "assistant", "content": err})
