"""Tests for r_analysis/garch_bridge.py — Rscript is mocked."""
import json
import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock


def _sample_prices(n: int = 250) -> pd.Series:
    rng = np.random.default_rng(42)
    returns = rng.normal(0.0005, 0.015, n)
    prices = 100 * np.exp(np.cumsum(returns))
    return pd.Series(prices)


class TestIsRAvailable:

    def test_returns_true_when_rscript_exits_zero(self):
        from r_analysis.garch_bridge import is_r_available

        mock_result = MagicMock()
        mock_result.returncode = 0
        with patch("r_analysis.garch_bridge.subprocess.run", return_value=mock_result):
            assert is_r_available() is True

    def test_returns_false_when_rscript_exits_nonzero(self):
        from r_analysis.garch_bridge import is_r_available

        mock_result = MagicMock()
        mock_result.returncode = 1
        with patch("r_analysis.garch_bridge.subprocess.run", return_value=mock_result):
            assert is_r_available() is False

    def test_returns_false_when_rscript_not_found(self):
        from r_analysis.garch_bridge import is_r_available

        with patch("r_analysis.garch_bridge.subprocess.run", side_effect=FileNotFoundError):
            assert is_r_available() is False


class TestFitGarchPythonFallback:

    def test_returns_dict_with_required_keys(self):
        from r_analysis.garch_bridge import fit_garch_python_fallback

        result = fit_garch_python_fallback(_sample_prices())
        for key in ("model", "current_vol_annualized", "note", "r_available"):
            assert key in result, f"Missing key: {key}"

    def test_r_available_is_false(self):
        from r_analysis.garch_bridge import fit_garch_python_fallback

        result = fit_garch_python_fallback(_sample_prices())
        assert result["r_available"] is False

    def test_vol_is_positive_finite(self):
        from r_analysis.garch_bridge import fit_garch_python_fallback

        result = fit_garch_python_fallback(_sample_prices())
        vol = result["current_vol_annualized"]
        assert isinstance(vol, float)
        assert vol > 0
        assert np.isfinite(vol)

    def test_model_label_contains_ewma(self):
        from r_analysis.garch_bridge import fit_garch_python_fallback

        result = fit_garch_python_fallback(_sample_prices())
        assert "EWMA" in result["model"]


class TestFitGarch:

    def test_falls_back_when_r_unavailable(self):
        from r_analysis.garch_bridge import fit_garch

        with patch("r_analysis.garch_bridge.is_r_available", return_value=False):
            result = fit_garch(_sample_prices())

        assert result["r_available"] is False
        assert "EWMA" in result["model"]

    def test_r_path_success(self, tmp_path):
        from r_analysis.garch_bridge import fit_garch

        garch_output = {
            "model": "GARCH(1,1)",
            "parameters": {"mu": 0.001, "omega": 0.00001, "alpha1": 0.09, "beta1": 0.89},
            "persistence": 0.98,
            "unconditional_vol_annualized": 0.18,
            "volatility_forecast_10d": [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
            "n_observations": 249,
        }
        json_str = json.dumps(garch_output)

        mock_proc = MagicMock()
        mock_proc.returncode = 0

        def fake_run(cmd, **kwargs):
            # Write output JSON to the path passed as last arg
            out_path = cmd[-1]
            with open(out_path, "w") as f:
                f.write(json_str)
            return mock_proc

        with patch("r_analysis.garch_bridge.is_r_available", return_value=True), \
             patch("r_analysis.garch_bridge.subprocess.run", side_effect=fake_run):
            result = fit_garch(_sample_prices())

        assert result["r_available"] is True
        assert result["model"] == "GARCH(1,1)"
        assert "parameters" in result

    def test_r_path_nonzero_exit_falls_back(self):
        from r_analysis.garch_bridge import fit_garch

        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.stderr = "Error: rugarch not installed"

        with patch("r_analysis.garch_bridge.is_r_available", return_value=True), \
             patch("r_analysis.garch_bridge.subprocess.run", return_value=mock_proc):
            result = fit_garch(_sample_prices())

        assert result["r_available"] is False
        assert "r_error" in result

    def test_r_path_cleans_up_temp_files(self, tmp_path, monkeypatch):
        """Temp CSV and JSON files must be deleted even on success."""
        import os
        import tempfile
        from r_analysis.garch_bridge import fit_garch

        created_files: list[str] = []
        real_ntf = tempfile.NamedTemporaryFile

        def tracking_ntf(**kwargs):
            f = real_ntf(**kwargs)
            created_files.append(f.name)
            return f

        garch_output = {"model": "GARCH(1,1)", "r_available": True}

        mock_proc = MagicMock()
        mock_proc.returncode = 0

        def fake_run(cmd, **kwargs):
            out_path = cmd[-1]
            with open(out_path, "w") as fw:
                fw.write(json.dumps(garch_output))
            return mock_proc

        monkeypatch.setattr(tempfile, "NamedTemporaryFile", tracking_ntf)

        with patch("r_analysis.garch_bridge.is_r_available", return_value=True), \
             patch("r_analysis.garch_bridge.subprocess.run", side_effect=fake_run):
            fit_garch(_sample_prices())

        for path in created_files:
            assert not os.path.exists(path), f"Temp file not cleaned up: {path}"
