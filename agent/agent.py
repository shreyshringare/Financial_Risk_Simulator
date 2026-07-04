import os
from dotenv import load_dotenv
from langchain.agents import AgentExecutor, create_react_agent

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

def build_llm():
    """Create LLM once. Expensive. Call once on startup."""
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            max_tokens=2000,
            api_key=groq_key,
            streaming=True,
            request_timeout=60,
        )
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", temperature=0, max_tokens=2000, streaming=True)


def make_executor(llm) -> AgentExecutor:
    """Create fresh AgentExecutor per request. Cheap — no model loading."""
    tool_descriptions = "\n".join(f"{t.name}: {t.description}" for t in ALL_TOOLS)
    tool_names = ", ".join(t.name for t in ALL_TOOLS)

    from langchain.prompts import PromptTemplate
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
    prompt = PromptTemplate(
        input_variables=["input", "agent_scratchpad", "tools", "tool_names"],
        partial_variables={"system_prompt": SYSTEM_PROMPT},
        template=react_template,
    )
    agent = create_react_agent(llm=llm, tools=ALL_TOOLS, prompt=prompt)
    return AgentExecutor(
        agent=agent,
        tools=ALL_TOOLS,
        verbose=True,
        handle_parsing_errors=(
            "Format error: respond either with 'Action:' + 'Action Input:' to use a tool, "
            "or repeat your complete answer on a line starting with 'Final Answer:'."
        ),
        max_iterations=10,
        max_execution_time=120,
    )


# Keep create_agent() for backward compatibility with tests
def create_agent() -> AgentExecutor:
    return make_executor(build_llm())


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
