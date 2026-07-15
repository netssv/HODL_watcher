"""
Unit tests for model.agent_exporter module.
"""

from model.agent_exporter import export_agent_payload


def test_agent_payload_schema_compliance():
    # Mock validation report
    validation_report = {
        "metadata": {"n_folds": 10},
        "overall": {
            "mean_accuracy": 0.55,
            "std_accuracy": 0.04,
            "accuracy_vs_naive_baseline": "better",
            "class_balance": {"up": 100, "down": 90, "sideways": 200}
        },
        "feature_importances": [
            {"feature": "rsi_6", "importance": 0.3},
            {"feature": "rsi_12", "importance": 0.2},
            {"feature": "fear_greed", "importance": 0.15},
            {"feature": "funding_rate", "importance": 0.1},
            {"feature": "macro_cpi", "importance": 0.08},
            {"feature": "bb_upper", "importance": 0.05}
        ]
    }
    
    # Mock last market row features
    market_df = {
        "close": 52000.0,
        "rsi_6": 65.0,
        "rsi_12": 58.0,
        "rsi_24": 52.0,
        "funding_rate": 0.0001,
        "funding_rate_diff_7": 0.00002,
        "long_short_ratio": 1.2,
        "long_short_ratio_diff_7": 0.01,
        "fear_greed": 60
    }
    
    prediction_probs = {"up": 0.45, "down": 0.30, "sideways": 0.25}
    order_book_walls = [{"price": 51500.0, "strength": "high"}]
    
    payload = export_agent_payload(
        market_df=market_df,
        validation_report=validation_report,
        prediction_probs=prediction_probs,
        order_book_walls=order_book_walls,
        horizon_hours=24
    )
    
    # Verify non-negotiable fields from honest-metrics-reporter
    assert "meta" in payload
    assert "market_snapshot" in payload
    assert "model_prediction" in payload
    assert "validation_summary" in payload
    assert "news_context" in payload
    assert "disclaimers" in payload
    
    # Check predictions
    pred = payload["model_prediction"]
    assert "direction_probabilities" in pred
    assert pred["direction_probabilities"]["up"] == 0.45
    assert "confidence_note" in pred
    assert len(pred["feature_importance_top5"]) == 5
    
    # Check validation summary
    val = payload["validation_summary"]
    assert val["walk_forward_folds"] == 10
    assert val["mean_accuracy"] == 0.55
    assert val["std_accuracy"] == 0.04
    assert val["accuracy_vs_naive_baseline"] == "better"
    
    # Verify disclaimers is non-empty
    assert len(payload["disclaimers"]) > 0
    assert any("not financial advice" in d.lower() for d in payload["disclaimers"])
