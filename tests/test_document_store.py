"""Tests for rag/document_store.py — ChromaDB and embeddings are mocked."""
import io
import csv
import pytest
from unittest.mock import patch, MagicMock


# ── parse_document ─────────────────────────────────────────────────────────────

class TestParseDocument:

    def test_txt_returns_text(self):
        from rag.document_store import parse_document
        content = b"Hello world\nLine two"
        result = parse_document("notes.txt", content)
        assert "Hello world" in result
        assert "Line two" in result

    def test_md_returns_text(self):
        from rag.document_store import parse_document
        content = b"# Title\n\nSome **markdown** content."
        result = parse_document("readme.md", content)
        assert "Title" in result

    def test_csv_returns_rows(self):
        from rag.document_store import parse_document
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["ticker", "price"])
        writer.writerow(["AAPL", "150.0"])
        content = buf.getvalue().encode()
        result = parse_document("data.csv", content)
        assert "AAPL" in result
        assert "ticker" in result

    def test_pdf_calls_pypdf(self):
        from rag.document_store import parse_document

        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Annual report text"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        with patch("pypdf.PdfReader", return_value=mock_reader):
            result = parse_document("report.pdf", b"%PDF-fake")

        assert "Annual report text" in result

    def test_docx_calls_python_docx(self):
        from rag.document_store import parse_document

        mock_para = MagicMock()
        mock_para.text = "Earnings summary paragraph."
        mock_doc = MagicMock()
        mock_doc.paragraphs = [mock_para]

        with patch("docx.Document", return_value=mock_doc):
            result = parse_document("report.docx", b"PK\x03\x04fake")

        assert "Earnings summary paragraph." in result

    def test_unsupported_extension_raises(self):
        from rag.document_store import parse_document
        with pytest.raises(ValueError, match="Unsupported file type"):
            parse_document("image.png", b"\x89PNG")

    def test_pdf_empty_pages_returns_empty(self):
        from rag.document_store import parse_document

        mock_page = MagicMock()
        mock_page.extract_text.return_value = ""
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        with patch("pypdf.PdfReader", return_value=mock_reader):
            result = parse_document("empty.pdf", b"%PDF")

        assert result == ""


# ── ingest_document ────────────────────────────────────────────────────────────

class TestIngestDocument:

    def _mock_vs(self):
        vs = MagicMock()
        vs.add_documents = MagicMock()
        return vs

    def test_returns_chunk_count(self):
        from rag.document_store import ingest_document

        content = b"This is a test document with enough text to be chunked properly. " * 20

        with patch("rag.document_store._get_vectorstore", return_value=self._mock_vs()), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            count = ingest_document("sess-123", "test.txt", content)

        assert count >= 1

    def test_raises_on_empty_document(self):
        from rag.document_store import ingest_document

        with patch("rag.document_store._get_vectorstore", return_value=self._mock_vs()), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            with pytest.raises(ValueError, match="empty"):
                ingest_document("sess-123", "empty.txt", b"   ")

    def test_chunks_have_session_id_metadata(self):
        from rag.document_store import ingest_document
        from langchain.schema import Document

        content = b"Some financial document content. " * 30
        added_docs: list[Document] = []

        mock_vs = self._mock_vs()
        mock_vs.add_documents.side_effect = lambda docs: added_docs.extend(docs)

        with patch("rag.document_store._get_vectorstore", return_value=mock_vs), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            ingest_document("my-session", "doc.txt", content)

        assert len(added_docs) >= 1
        for doc in added_docs:
            assert doc.metadata["session_id"] == "my-session"
            assert doc.metadata["filename"] == "doc.txt"


# ── query_session_docs ─────────────────────────────────────────────────────────

class TestQuerySessionDocs:

    def test_returns_joined_content(self):
        from rag.document_store import query_session_docs

        doc1 = MagicMock()
        doc1.page_content = "Revenue grew 12% YoY."
        doc2 = MagicMock()
        doc2.page_content = "Operating margin expanded."

        mock_vs = MagicMock()
        mock_vs.similarity_search.return_value = [doc1, doc2]

        with patch("rag.document_store._get_vectorstore", return_value=mock_vs), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            result = query_session_docs("sess-abc", "revenue growth", k=2)

        assert "Revenue grew 12% YoY." in result
        assert "Operating margin expanded." in result
        assert "---" in result

    def test_returns_empty_on_no_results(self):
        from rag.document_store import query_session_docs

        mock_vs = MagicMock()
        mock_vs.similarity_search.return_value = []

        with patch("rag.document_store._get_vectorstore", return_value=mock_vs), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            result = query_session_docs("sess-abc", "anything", k=3)

        assert result == ""

    def test_passes_session_filter(self):
        from rag.document_store import query_session_docs

        mock_vs = MagicMock()
        mock_vs.similarity_search.return_value = []

        with patch("rag.document_store._get_vectorstore", return_value=mock_vs), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            query_session_docs("my-session", "query", k=3)

        call_kwargs = mock_vs.similarity_search.call_args.kwargs
        assert call_kwargs.get("filter") == {"session_id": "my-session"}


# ── session isolation ──────────────────────────────────────────────────────────

class TestSessionIsolation:

    def test_different_sessions_use_different_filters(self):
        from rag.document_store import query_session_docs

        filters_seen = []
        mock_vs = MagicMock()
        def capture(**kwargs):
            filters_seen.append(kwargs.get("filter"))
            return []
        mock_vs.similarity_search.side_effect = lambda q, **kwargs: capture(**kwargs)

        with patch("rag.document_store._get_vectorstore", return_value=mock_vs), \
             patch("rag.document_store._get_embeddings", return_value=MagicMock()):
            query_session_docs("session-A", "q", k=1)
            query_session_docs("session-B", "q", k=1)

        assert filters_seen[0] == {"session_id": "session-A"}
        assert filters_seen[1] == {"session_id": "session-B"}
