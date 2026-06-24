"""
RAG knowledge base for financial concepts.
Uses ChromaDB on-disk at ./chroma_db/ with OpenAI embeddings.
Cold start: ~30s first run (fetches + embeds). Subsequent: ~0.3s.
"""

import os

from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

URLS = [
    "https://en.wikipedia.org/wiki/Value_at_risk",
    "https://en.wikipedia.org/wiki/Expected_shortfall",
    "https://en.wikipedia.org/wiki/Geometric_Brownian_motion",
    "https://en.wikipedia.org/wiki/Sharpe_ratio",
    "https://en.wikipedia.org/wiki/Maximum_drawdown",
    "https://en.wikipedia.org/wiki/Fat-tailed_distribution",
    "https://en.wikipedia.org/wiki/Volatility_clustering",
    "https://en.wikipedia.org/wiki/Black%E2%80%93Scholes_model",
]

PERSIST_DIRECTORY = "./chroma_db"
COLLECTION_NAME = "financial_knowledge"


def get_or_create_knowledge_base() -> Chroma:
    """
    Load existing ChromaDB if it exists, else fetch URLs, embed, and persist.
    Returns Chroma vectorstore instance.
    """
    embeddings = OpenAIEmbeddings()

    # Check if the chroma_db directory exists and has content
    if os.path.isdir(PERSIST_DIRECTORY) and os.listdir(PERSIST_DIRECTORY):
        vectorstore = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=PERSIST_DIRECTORY,
        )
        return vectorstore

    # Cold start: fetch URLs, split, embed, and persist
    loader = WebBaseLoader(URLS)
    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    splits = text_splitter.split_documents(documents)

    vectorstore = Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=PERSIST_DIRECTORY,
    )

    return vectorstore


def query_knowledge_base(vectorstore: Chroma, query: str, k: int = 3) -> str:
    """
    Query the knowledge base. Returns top-k results as formatted string.
    Format: join docs with '\n\n---\n\n' separator.
    """
    results = vectorstore.similarity_search(query, k=k)
    return "\n\n---\n\n".join(doc.page_content for doc in results)
