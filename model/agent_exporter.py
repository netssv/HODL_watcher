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
    order_book_depth: Dict[str, Any] | None = None,
    liq_heatmap: Dict[str, Any] | None = None,
    data_freshness: Dict[str, str | None] | None = None,
    data_gaps: List[str] | None = None,
    network_snapshot: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Format predictions, metrics, and snapshots into the Phase 4 JSON Schema.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    
    def _f(k, source=market_df):
        v = source.get(k) if source is not None else None
        return float(v) if v is not None and not pd.isna(v) else None

    # Preserve missing provider values as null; defaults imply measurements.
    price = _f('close')
    rsi_6, rsi_12, rsi_24 = _f('rsi_6'), _f('rsi_12'), _f('rsi_24')
    funding_val, funding_diff = _f('funding_rate'), _f('funding_rate_diff_7')
    funding_trend = "flat"
    if funding_diff is not None and funding_diff > 1e-5:
        funding_trend = "rising"
    elif funding_diff is not None and funding_diff < -1e-5:
        funding_trend = "falling"
        
    ls_val, ls_diff = _f('long_short_ratio'), _f('long_short_ratio_diff_7')
    ls_trend = "flat"
    if ls_diff is not None and ls_diff > 0.05:
        ls_trend = "rising"
    elif ls_diff is not None and ls_diff < -0.05:
        ls_trend = "falling"
        
    fear_greed = _f('fear_greed')
    atr = _f('atr')
    regime = _f('market_regime')
    ob_imbalance = _f('ob_imbalance_10')
    
    # Optional provider metrics: preserve missing values instead of presenting zero as data.
    liq_upper, liq_lower = _f('liquidation_dist_upper'), _f('liquidation_dist_lower')
    # Cloud Run may have the heatmap buckets but not the derived feature
    # columns. Keep the estimate visible by deriving proximity from the
    # strongest bucket on each side of the current price.
    if (liq_upper is None or liq_lower is None) and liq_heatmap and price:
        for key, direction in (("short_buckets", "upper"), ("long_buckets", "lower")):
            buckets = liq_heatmap.get(key) or []
            candidates = [
                b for b in buckets
                if b.get("price") is not None and b.get("notionalUSD") is not None
                and ((direction == "upper" and b["price"] > price)
                     or (direction == "lower" and b["price"] < price))
            ]
            if candidates:
                strongest = max(candidates, key=lambda b: float(b.get("notionalUSD", 0)))
                distance = abs(float(strongest["price"]) / price - 1)
                if direction == "upper" and liq_upper is None:
                    liq_upper = distance
                elif direction == "lower" and liq_lower is None:
                    liq_lower = distance
    dvol, skew_25d, put_call = _f('dvol'), _f('skew_25d'), _f('put_call_ratio')
    exchange_flow, volume_proxy = _f('exchange_net_flow'), _f('etf_net_flow')

    # Hyperliquid DEX
    hl_oi = _f('hl_open_interest')
    hl_fund = _f('hl_funding_rate')

    # FRED macro (passed in via macro_snapshot dict)
    dxy_val = _f('dxy', macro_snapshot or {})
    dxy_change = _f('dxy_change_pct', macro_snapshot or {})
    fed_rate_val = _f('fed_rate', macro_snapshot or {})

    def _json_value(value):
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        if hasattr(value, "item"):
            return value.item()
        return value

    feature_snapshot = {
        str(key): _json_value(value) for key, value in market_df.items()
    }
    
    # Phase 1 local microstructure indicators
    micro_dict = {
        "vwap_24h": _f("vwap_24"),
        "realized_volatility_24h": _f("realized_vol_24"),
        "volume_delta": _f("volume_delta"),
        "cvd_24h": _f("cvd_24"),
        "futures_basis": _f("futures_basis"),
        "iv_rank": _f("iv_rank")
    }

    # Feature disagreement logic
    disagreement = (
        (rsi_6 is not None and ls_val is not None and rsi_6 < 40 and ls_val < 0.9)
        or (rsi_6 is not None and ls_val is not None and rsi_6 > 60 and ls_val > 1.1)
        or regime == 0
    )
    
    # Confidence note based on validation performance & regime
    mean_acc, std_acc = validation_report["overall"]["mean_accuracy"], validation_report["overall"]["std_accuracy"]
    baseline_comp = validation_report["overall"]["accuracy_vs_naive_baseline"]
    trading_metrics = validation_report["overall"].get("trading", {})
    mean_sharpe = trading_metrics.get("mean_sharpe")
    if baseline_comp != "better" or mean_acc < 0.4 or (mean_sharpe is not None and mean_sharpe < 0):
        confidence_note = f"CONFIDENCE LOW: Validation has no reliable edge (accuracy {mean_acc:.1%}, baseline {baseline_comp}, mean Sharpe {mean_sharpe if mean_sharpe is not None else 'N/A'})."
    elif disagreement:
        confidence_note = "CONFIDENCE LOW: High feature disagreement or volatile market regime."
    elif std_acc > 0.1:
        confidence_note = f"CONFIDENCE MEDIUM-LOW: High variance ({std_acc:.1%}) across folds."
    else:
        confidence_note = "CONFIDENCE MODERATE: Model consistently beats naive baselines."
        
    # Risk Management Module
    calc_price = price or 0.0
    calc_atr = atr if atr is not None else None
    sl_distance = 2 * calc_atr if calc_atr is not None else None
    tp_distance = 3 * calc_atr if calc_atr is not None else None
    notional_position_size = (calc_price * 0.01) / sl_distance if sl_distance and sl_distance > 0 else None
    if notional_position_size is not None and notional_position_size > 5.0:
        notional_position_size = 5.0
        actual_risk_pct = (sl_distance / calc_price) * 5.0 if calc_price else None
    else:
        actual_risk_pct = 0.01 if notional_position_size is not None else None
    leverage = max(1.0, notional_position_size) if notional_position_size is not None else None

    # Hard safety gate: directional probability must never override a failed
    # validation/reward check. Keep the raw forecast above for auditability,
    # but expose zero executable sizing to downstream strategy agents.
    risk_gate = "allowed"
    if "CONFIDENCE LOW" in confidence_note:
        notional_position_size = 0.0
        actual_risk_pct = 0.0
        leverage = 0.0
        risk_gate = "blocked_low_confidence"
        
    return {
        "meta": {
            "generated_at": now_str,
            "model_version": model_version,
            "horizon_hours": horizon_hours,
            "data_freshness": data_freshness or {"price_last_update": None, "funding_last_update": None}
        },
        "market_snapshot": {
            "price": price,
            "rsi": {"6": rsi_6, "12": rsi_12, "24": rsi_24},
            "funding_rate": {"value": funding_val, "trend": funding_trend},
            "long_short_ratio": {"value": ls_val, "trend": ls_trend},
            "fear_greed_index": fear_greed,
            "feature_snapshot": feature_snapshot,
            "order_book_support_resistance": order_book_walls,
            "order_book_depth": order_book_depth or {},
            "liq_heatmap": liq_heatmap or {},
            "liquidation_proximity": ({"upper": liq_upper, "lower": liq_lower}
                                      if liq_upper is not None and liq_lower is not None else None),
            "deribit_options": {"dvol": dvol, "skew_25d": skew_25d, "put_call_ratio": put_call},
            "onchain": {"exchange_net_flow": exchange_flow, "btc_volume_proxy": volume_proxy},
            "bitcoin_network": network_snapshot or {},
            "hyperliquid": {"open_interest": hl_oi, "funding_rate": hl_fund},
            "macro": {
                "usd_index": dxy_val,
                "usd_index_change_pct": dxy_change,
                "usd_index_source": (macro_snapshot or {}).get("dxy_source"),
                "macro_dxy_source": (macro_snapshot or {}).get("macro_dxy_source"),
                "fed_rate": fed_rate_val,
                "macro_dxy_source": (macro_snapshot or {}).get("macro_dxy_source"),
            },
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
            "validation_status": validation_report["metadata"].get("status"),
            "horizon_periods": validation_report["metadata"].get("horizon_periods"),
            "embargo_periods": validation_report["metadata"].get("embargo_periods"),
            "data_start": validation_report["metadata"].get("data_start"),
            "data_end": validation_report["metadata"].get("data_end"),
            "latest_test_end": validation_report["metadata"].get("latest_test_end"),
            "mean_accuracy": mean_acc,
            "std_accuracy": std_acc,
            "mean_precision": validation_report["overall"].get("mean_precision"),
            "std_precision": validation_report["overall"].get("std_precision"),
            "mean_recall": validation_report["overall"].get("mean_recall"),
            "std_recall": validation_report["overall"].get("std_recall"),
            "mean_f1": validation_report["overall"].get("mean_f1"),
            "std_f1": validation_report["overall"].get("std_f1"),
            "mean_log_loss": validation_report["overall"].get("mean_log_loss"),
            "std_log_loss": validation_report["overall"].get("std_log_loss"),
            "accuracy_vs_naive_baseline": baseline_comp,
            "baselines": validation_report["overall"].get("baselines", {}),
            "class_balance": validation_report["overall"]["class_balance"],
            "trading_metrics": validation_report["overall"].get("trading", {}),
            "folds": validation_report.get("folds", [])
        },
        "risk_management": {
            "position_size_notional_pct": notional_position_size * 100 if notional_position_size is not None else None,
            "actual_risk_pct": actual_risk_pct * 100 if actual_risk_pct is not None else None,
            "leverage": leverage,
            "dynamic_sl_pct": (sl_distance / price) * 100 if sl_distance is not None and price else None,
            "dynamic_tp_pct": (tp_distance / price) * 100 if tp_distance is not None and price else None,
            "market_regime": regime,
            "gate": risk_gate
        },
        "news_context": {
            "instructions_for_agent": (
                "The agent must search for news of the last 24-48 hours regarding: "
                "Bitcoin, Federal Reserve policy / rate decisions, macro economic markers "
                "(CPI, employment rates), and report only factual, source-backed events."
            ),
            "keywords_to_search": ["Bitcoin", "Fed rate decision", "CPI", "Inflation", "US Dollar Index"]
        },
        "data_quality": {
            "gaps": sorted(set(data_gaps or [])),
            "macro_note": "usd_index is ICE DXY (DX-Y.NYB), sourced through Yahoo Finance; quote data may be delayed.",
            "liquidation_note": (
                "Estimated from Binance public open interest; not an exchange-published liquidation feed."
                if liq_heatmap else "Unavailable: no Binance public OI liquidation estimate was returned."
            ),
        },
        "disclaimers": [
            "This is not financial advice.",
            f"The prediction model is validated using walk-forward splits showing a mean accuracy of {mean_acc:.1%} with a standard deviation of {std_acc:.1%}.",
            "All market indicators represent past data and cannot guarantee future performance."
        ]
    }
