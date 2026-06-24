import os
from dotenv import load_dotenv
from langchain.agents import AgentExecutor, create_react_agent
from langchain import hub
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferWindowMemory

from agent.tools import ALL_TOOLS
from agent.prompts import SYSTEM_PROMPT

load_dotenv()

# ---------------------------------------------------------------------------
# LLM selection — priority: Groq (free) → OpenAI (paid fallback)
#
# Groq free tier: 14,400 req/day, no credit card required.
# Sign up: https://console.groq.com → API Keys → Create key
# Add to .env: GROQ_API_KEY=your-key-here
#
# To use OpenAI instead: set OPENAI_API_KEY and remove/unset GROQ_API_KEY.
# ---------------------------------------------------------------------------

def _build_llm():
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            max_tokens=2000,
            api_key=groq_key,
            streaming=True,
        )
    # Fallback to OpenAI
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", temperature=0, max_tokens=2000, streaming=True)


def create_agent() -> AgentExecutor:
    """
    Create and return a LangChain ReAct AgentExecutor.
    Safe to call with @st.cache_resource in Streamlit.
    Uses Groq (free) if GROQ_API_KEY set, else OpenAI.
    """
    llm = _build_llm()

    # Build tool descriptions for the prompt
    tool_descriptions = "\n".join(
        f"{tool.name}: {tool.description}" for tool in ALL_TOOLS
    )
    tool_names = ", ".join(tool.name for tool in ALL_TOOLS)

    # Try pulling the standard ReAct prompt from LangChain Hub
    try:
        base_prompt = hub.pull("hwchase17/react")
        # Prepend the system prompt to the base ReAct template
        # hub prompt uses 'input', 'agent_scratchpad', 'tools', 'tool_names'
        prompt = base_prompt.partial(
            system_prompt=SYSTEM_PROMPT,
        )
    except Exception:
        # Fallback: construct a minimal ReAct prompt manually
        react_template = (
            "{system_prompt}\n\n"
            "You have access to the following tools:\n\n"
            "{tools}\n\n"
            "Use the following format:\n\n"
            "Question: the input question you must answer\n"
            "Thought: you should always think about what to do\n"
            "Action: the action to take, should be one of [{tool_names}]\n"
            "Action Input: the input to the action\n"
            "Observation: the result of the action\n"
            "... (this Thought/Action/Action Input/Observation can repeat N times)\n"
            "Thought: I now know the final answer\n"
            "Final Answer: the final answer to the original input question\n\n"
            "Begin!\n\n"
            "Question: {input}\n"
            "Thought:{agent_scratchpad}"
        )
        from langchain.prompts import PromptTemplate
        prompt = PromptTemplate(
            input_variables=["input", "agent_scratchpad", "tools", "tool_names"],
            partial_variables={"system_prompt": SYSTEM_PROMPT},
            template=react_template,
        )

    memory = ConversationBufferWindowMemory(
        k=10,
        memory_key="chat_history",
        return_messages=True,
    )

    agent = create_react_agent(
        llm=llm,
        tools=ALL_TOOLS,
        prompt=prompt,
    )

    agent_executor = AgentExecutor(
        agent=agent,
        tools=ALL_TOOLS,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=10,
        max_execution_time=120,
    )

    return agent_executor


def run_agent(agent_executor: AgentExecutor, user_input: str) -> str:
    """
    Run the agent with user input. Returns response string.
    On exception, returns error message string (never raises).
    """
    try:
        result = agent_executor.invoke({"input": user_input})
        return result.get("output", str(result))
    except Exception as e:
        return f"Error running agent: {e}"
