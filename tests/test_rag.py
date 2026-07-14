"""Tests for rag/knowledge_base.py — ChromaDB and embeddings are mocked."""
import pytest
from unittest.mock import patch, MagicMock


def _mock_chroma_class(docs=None):
    instance = MagicMock()
    instance.similarity_search.return_value = docs or []
    return instance


class TestGetOrCreateKnowledgeBase:

    def test_loads_existing_when_dir_present(self, tmp_path):
        from rag import knowledge_base as kb

        # Create a non-empty directory to simulate existing DB
        (tmp_path / "dummy.bin").write_bytes(b"x")

        mock_embeddings = MagicMock()
        mock_vs = MagicMock()

        with patch.object(kb, "PERSIST_DIRECTORY", str(tmp_path)), \
             patch("rag.knowledge_base.HuggingFaceEmbeddings", return_value=mock_embeddings), \
             patch("rag.knowledge_base.Chroma", return_value=mock_vs) as mock_chroma:
            result = kb.get_or_create_knowledge_base()

        # Should call Chroma() constructor (load path), not Chroma.from_documents
        mock_chroma.assert_called_once()
        assert result is mock_vs

    def test_cold_start_when_dir_empty(self, tmp_path):
        from rag import knowledge_base as kb

        mock_embeddings = MagicMock()
        mock_vs = MagicMock()
        mock_doc = MagicMock()
        mock_loader = MagicMock()
        mock_loader.load.return_value = [mock_doc]
        mock_splitter = MagicMock()
        mock_splitter.split_documents.return_value = [mock_doc]

        with patch.object(kb, "PERSIST_DIRECTORY", str(tmp_path)), \
             patch("rag.knowledge_base.HuggingFaceEmbeddings", return_value=mock_embeddings), \
             patch("rag.knowledge_base.WebBaseLoader", return_value=mock_loader), \
             patch("rag.knowledge_base.RecursiveCharacterTextSplitter", return_value=mock_splitter), \
             patch("rag.knowledge_base.Chroma") as mock_chroma_cls:
            mock_chroma_cls.from_documents.return_value = mock_vs
            result = kb.get_or_create_knowledge_base()

        mock_chroma_cls.from_documents.assert_called_once()
        assert result is mock_vs


class TestQueryKnowledgeBase:

    def test_returns_joined_page_content(self):
        from rag.knowledge_base import query_knowledge_base

        doc1 = MagicMock()
        doc1.page_content = "VaR measures tail risk."
        doc2 = MagicMock()
        doc2.page_content = "CVaR is the expected shortfall."

        mock_vs = MagicMock()
        mock_vs.similarity_search.return_value = [doc1, doc2]

        result = query_knowledge_base(mock_vs, "what is VaR", k=2)

        assert "VaR measures tail risk." in result
        assert "CVaR is the expected shortfall." in result
        assert "---" in result  # separator

    def test_calls_similarity_search_with_correct_k(self):
        from rag.knowledge_base import query_knowledge_base

        mock_vs = MagicMock()
        mock_vs.similarity_search.return_value = []

        query_knowledge_base(mock_vs, "sharpe ratio", k=5)

        mock_vs.similarity_search.assert_called_once_with("sharpe ratio", k=5)

    def test_empty_results_returns_empty_string(self):
        from rag.knowledge_base import query_knowledge_base

        mock_vs = MagicMock()
        mock_vs.similarity_search.return_value = []

        result = query_knowledge_base(mock_vs, "query", k=3)
        assert result == ""
