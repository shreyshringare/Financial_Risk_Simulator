import numpy as np
import pytest
from simulation.stress_test import run_stress_test, get_available_scenarios, SCENARIOS


def test_scenarios_available():
    scenarios = get_available_scenarios()

    assert isinstance(scenarios, list)
    assert len(scenarios) == 5

    for item in scenarios:
        assert "name" in item
        assert "description" in item
        assert "shock" in item
        # All shock values must be negative
        assert item["shock"] < 0

    # List must be sorted by shock ascending (most negative first)
    shocks = [item["shock"] for item in scenarios]
    assert shocks == sorted(shocks)


def test_stress_test_worsens_var():
    # Roughly flat paths around 100 with mild random walk
    paths = np.random.lognormal(0, 0.01, size=(500, 252)) * 100

    result = run_stress_test(paths, "2008_financial_crisis")

    assert isinstance(result, dict)

    required_keys = {
        "scenario_name",
        "description",
        "shock_applied",
        "baseline_var_95",
        "stressed_var_95",
        "baseline_mean_return",
        "stressed_mean_return",
        "worst_case_loss",
        "pct_paths_total_loss",
    }
    assert required_keys.issubset(result.keys())

    # Stress must make VaR worse (more negative or lower)
    assert result["stressed_var_95"] < result["baseline_var_95"]

    # Correct shock applied for 2008 financial crisis scenario
    assert result["shock_applied"] == -0.55


def test_invalid_scenario_raises():
    with pytest.raises(ValueError):
        run_stress_test(np.ones((100, 252)), "nonexistent_scenario_xyz")
