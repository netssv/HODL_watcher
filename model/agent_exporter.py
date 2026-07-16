"""
Module for formatting and exporting model output to the structured JSON schema
consumed by the external strategy-generating LLM agent.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List
import pandas as pd


def export_agent_payload(
    market_df: Any,  # Last row of features DataFrame
    validation_report: Dict[str, Any],
    prediction_probs: Dict[str, float],
    order_book_walls: List[Dict[str, Any]],
    horizon_hours: int,
    model_version: str = "1.0.0",
    news_sentiment_bullish_pct: float | None = None,
    macro_snapshot: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Format predictions, metrics, and snapshots into the Phase 4 JSON Schema.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    
    # Extract latest market values safely
    price = float(market_df.get('close', 0.0))
    rsi_6 = float(market_df.get('rsi_6', 50.0))
    rsi_12 = float(market_df.get('rsi_12', 50.0))
    rsi_24 = float(market_df.get('rsi_24', 50.0))
    
    funding_val = float(market_df.get('funding_rate', 0.0))
    funding_diff = float(market_df.get('funding_rate_diff_7', 0.0))
    funding_trend = "flat"
    if funding_diff > 1e-5:
        funding_trend = "rising"
    elif funding_diff < -1e-5:
        funding_trend = "falling"
        
    ls_val = float(market_df.get('long_short_ratio', 1.0))
    ls_diff = float(market_df.get('long_short_ratio_diff_7', 0.0))
    ls_trend = "flat"
    if ls_diff > 0.05:
        ls_trend = "rising"
    elif ls_diff < -0.05:
        ls_trend = "falling"
        
    fear_greed = int(market_df.get('fear_greed', 50))
    atr = float(market_df.get('atr', price * 0.02))
    regime = float(market_df.get('market_regime', 0))
    ob_imbalance = float(market_df.get('ob_imbalance_10', 0.0))
    
    # Derivatives / on-chain metrics
    liq_upper = float(market_df.get('liquidation_dist_upper', 0.0))
    liq_lower = float(market_df.get('liquidation_dist_lower', 0.0))
    dvol = float(market_df.get('dvol', 0.0))
    skew_25d = float(market_df.get('skew_25d', 0.0))
    put_call = float(market_df.get('put_call_ratio', 0.0))
    exchange_flow = float(market_df.get('exchange_net_flow', 0.0))
    etf_flow = float(market_df.get('etf_net_flow', 0.0))

    # Hyperliquid DEX
    hl_oi = float(market_df.get('hl_open_interest', 0.0))
    hl_fund = float(market_df.get('hl_funding_rate', 0.0))

    # FRED macro (passed in via macro_snapshot dict)
    dxy_val = float((macro_snapshot or {}).get('dxy', 0.0))
    fed_rate_val = float((macro_snapshot or {}).get('fed_rate', 0.0))
    
    # Phase 1 local microstructure indicators
    def _f(k):
        v = market_df.get(k)
        return float(v) if v is not None and not pd.isna(v) else None
    micro_dict = {
        "vwap_24h": _f("vwap_24"),
        "realized_volatility_24h": _f("realized_vol_24"),
        "volume_delta": _f("volume_delta"),
        "cvd_24h": _f("cvd_24"),
        "futures_basis": _f("futures_basis"),
        "iv_rank": _f("iv_rank")
    }

    # Feature disagreement logic
    disagreement = (rsi_6 < 40 and ls_val < 0.9) or (rsi_6 > 60 and ls_val > 1.1) or regime == 0
    
    # Confidence note based on validation performance & regime
    mean_acc, std_acc = validation_report["overall"]["mean_accuracy"], validation_report["overall"]["std_accuracy"]
    baseline_comp = validation_report["overall"]["accuracy_vs_naive_baseline"]
    if baseline_comp == "worse" or mean_acc < 0.4:
        confidence_note = f"CONFIDENCE LOW: Accuracy ({mean_acc:.1%}) underperforms baseline."
    elif disagreement:
        confidence_note = "CONFIDENCE LOW: High feature disagreement or volatile market regime."
    elif std_acc > 0.1:
        confidence_note = f"CONFIDENCE MEDIUM-LOW: High variance ({std_acc:.1%}) across folds."
    else:
        confidence_note = "CONFIDENCE MODERATE: Model consistently beats naive baselines."
        
    # Risk Management Module
    sl_distance, tp_distance = 2 * atr, 3 * atr
    notional_position_size = (price * 0.01) / sl_distance if sl_distance > 0 else 0
    if notional_position_size > 5.0:
        notional_position_size = 5.0
        actual_risk_pct = (sl_distance / price) * 5.0
    else:
        actual_risk_pct = 0.01
    leverage = max(1.0, notional_position_size)
        
    return {
        "meta": {
            "generated_at": now_str,
            "model_version": model_version,
            "horizon_hours": horizon_hours,
            "data_freshness": {"price_last_update": now_str, "funding_last_update": now_str}
        },
        "market_snapshot": {
            "price": price,
            "rsi": {"6": rsi_6, "12": rsi_12, "24": rsi_24},
            "funding_rate": {"value": funding_val, "trend": funding_trend},
            "long_short_ratio": {"value": ls_val, "trend": ls_trend},
            "fear_greed_index": fear_greed,
            "order_book_support_resistance": order_book_walls,
            "liquidation_proximity": {"upper": liq_upper, "lower": liq_lower},
            "deribit_options": {"dvol": dvol, "skew_25d": skew_25d, "put_call_ratio": put_call},
            "onchain": {"exchange_net_flow": exchange_flow, "etf_net_flow": etf_flow},
            "hyperliquid": {"open_interest": hl_oi, "funding_rate": hl_fund},
            "macro": {"dxy": dxy_val, "fed_rate": fed_rate_val},
            "news_sentiment_bullish_pct": news_sentiment_bullish_pct,
            "market_microstructure": micro_dict
        },
        "model_prediction": {
            "direction_probabilities": {
                "up": float(prediction_probs.get("up", 0.0)),
                "down": float(prediction_probs.get("down", 0.0)),
                "sideways": float(prediction_probs.get("sideways", 0.0))
            },
            "confidence_note": confidence_note,
            "feature_importance_top5": validation_report["feature_importances"][:5]
        },
        "validation_summary": {
            "walk_forward_folds": validation_report["metadata"]["n_folds"],
            "mean_accuracy": mean_acc,
            "std_accuracy": std_acc,
            "accuracy_vs_naive_baseline": baseline_comp,
            "class_balance": validation_report["overall"]["class_balance"],
            "trading_metrics": validation_report["overall"].get("trading", {}),
            "folds": validation_report.get("folds", [])
        },
        "risk_management": {
            "position_size_notional_pct": notional_position_size * 100,
            "actual_risk_pct": actual_risk_pct * 100,
            "leverage": leverage,
            "dynamic_sl_pct": (sl_distance / price) * 100 if price > 0 else 0,
            "dynamic_tp_pct": (tp_distance / price) * 100 if price > 0 else 0,
            "market_regime": regime
        },
        "news_context": {
            "instructions_for_agent": (
                "The agent must search for news of the last 24-48 hours regarding: "
                "Bitcoin, Federal Reserve policy / rate decisions, macro economic markers "
                "(CPI, employment rates), and report only factual, source-backed events."
            ),
            "keywords_to_search": ["Bitcoin", "Fed rate decision", "CPI", "Inflation", "US Dollar Index"]
        },
        "disclaimers": [
            "This is not financial advice.",
            f"The prediction model is validated using walk-forward splits showing a mean accuracy of {mean_acc:.1%} with a standard deviation of {std_acc:.1%}.",
            "All market indicators represent past data and cannot guarantee future performance."
        ]
    }

