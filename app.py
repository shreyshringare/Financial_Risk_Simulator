import os
import streamlit as st
from dotenv import load_dotenv
from agent.agent import create_agent, run_agent

load_dotenv()

st.set_page_config(
    page_title="Financial Risk Simulator",
    page_icon="📈",
    layout="wide"
)

@st.cache_resource
def load_agent():
    return create_agent()

# Sidebar
with st.sidebar:
    st.title("Financial Risk Simulator")
    st.markdown("**Powered by GPT-4o + LangChain + ChromaDB RAG**")

    st.markdown("### Supported Markets")
    st.markdown("""
- 🇺🇸 **US:** AAPL, MSFT, TSLA
- 🇮🇳 **NSE India:** RELIANCE.NS, TCS.NS
- 🇬🇧 **LSE:** HSBA.L, BP.L
- 🇨🇦 **TSX:** SHOP.TO, RY.TO
""")

    st.markdown("### Example Questions")
    st.markdown("""
- "What is the VaR for AAPL?"
- "Compare risk metrics for RELIANCE.NS"
- "Explain what CVaR means"
- "Run Monte Carlo simulation for TSLA for 180 days"
- "Analyze portfolio correlation for AAPL, MSFT, TSLA"
- "Run 2008 financial crisis stress test on RELIANCE.NS"
- "Export AAPL risk report to Excel"
- "Export TSLA data for PowerBI"
- "Get latest news and sentiment for AAPL"
- "Compute efficient frontier for AAPL, MSFT, GOOGL"
- "What are today's top market movers?"
""")

    st.markdown("### Capabilities")
    st.markdown("""
- Portfolio correlation & multi-ticker VaR
- Historical stress testing (2008, COVID, Dot-com, more)
- GARCH(1,1) volatility modeling
- Export: Excel reports & PowerBI datasets
- 📰 **Financial news**: RSS feed with sentiment analysis
- 📐 **Efficient frontier**: Markowitz optimal portfolio weights
""")

    st.divider()
    st.caption("⚠️ For educational purposes only. Not financial advice.")

# Main area
st.title("📊 Financial Risk Simulator")
st.caption("Monte Carlo · VaR · CVaR · Sharpe · Max Drawdown · Natural Language Interface")

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": (
                "Welcome! I'm your AI financial risk analyst powered by GPT-4o.\n\n"
                "I can help you with:\n"
                "- 📉 **Value at Risk (VaR)** and **CVaR** analysis\n"
                "- 🎲 **Monte Carlo simulations** (up to 1000 paths)\n"
                "- 📊 **Sharpe ratio** and **max drawdown**\n"
                "- 🌍 **Global markets**: US, NSE India (.NS), LSE (.L), TSX (.TO)\n"
                "- 📚 **Concept explanations** via RAG knowledge base\n"
                "- 📊 **Portfolio analysis**: correlation matrix, portfolio VaR\n"
                "- ⚡ **Stress testing**: 5 historical crisis scenarios\n"
                "- 📈 **GARCH modeling**: time-varying volatility estimation\n"
                "- 💾 **Export**: Excel reports & PowerBI datasets\n"
                "- 📰 **Financial news**: RSS headlines + bullish/bearish sentiment\n"
                "- 📐 **Efficient frontier**: Markowitz optimal weights\n\n"
                'Ask me anything like: *"What\'s the VaR for AAPL?"* or *"Run a Monte Carlo sim for RELIANCE.NS"*'
            ),
        }
    ]

# Load agent
agent_executor = load_agent()

# Render existing messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Chat input
if prompt := st.chat_input("Ask about any stock risk..."):
    # Append and display user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Get assistant response
    with st.chat_message("assistant"):
        with st.spinner("Analyzing..."):
            try:
                response = run_agent(agent_executor, prompt)
                st.markdown(response)
                st.session_state.messages.append({"role": "assistant", "content": response})
            except Exception as e:
                error_msg = f"An error occurred while processing your request: {str(e)}"
                st.error(error_msg)
                st.session_state.messages.append({"role": "assistant", "content": error_msg})

st.divider()
st.subheader("Quick Export")
col1, col2, col3 = st.columns(3)

with col1:
    export_ticker = st.text_input("Ticker for export", placeholder="AAPL", key="export_ticker")

with col2:
    if st.button("Export Excel Report", use_container_width=True):
        if export_ticker:
            with st.spinner("Generating Excel report..."):
                result = run_agent(agent_executor, f"Export {export_ticker.upper()} risk analysis report to Excel")
                st.success(result)
        else:
            st.warning("Enter a ticker first")

with col3:
    if st.button("Export PowerBI Data", use_container_width=True):
        if export_ticker:
            with st.spinner("Exporting PowerBI datasets..."):
                result = run_agent(agent_executor, f"Export {export_ticker.upper()} data for PowerBI")
                st.success(result)
        else:
            st.warning("Enter a ticker first")

st.divider()
st.subheader("📰 Market News")
news_col1, news_col2 = st.columns([2, 1])
with news_col1:
    news_ticker = st.text_input("Ticker for news", placeholder="AAPL", key="news_ticker")
with news_col2:
    news_source = st.selectbox("Source", ["Stock News", "Market Headlines"], key="news_source")

if st.button("Fetch News", use_container_width=False):
    if news_ticker:
        with st.spinner("Fetching news..."):
            if news_source == "Stock News":
                query = f"Get latest financial news and sentiment for {news_ticker.upper()}"
            else:
                query = "Get latest market headlines and top stories"
            result = run_agent(agent_executor, query)
            st.markdown(result)
    else:
        st.warning("Enter a ticker first")
