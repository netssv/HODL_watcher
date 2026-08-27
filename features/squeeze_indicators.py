"""
Short Squeeze & Liquidation Cluster Analytics Engine.

Calculates the Squeeze Probability Score, Volatility Coiling,
and Liquidation Magnet levels to detect early explosive breakouts.
"""

from typing import Dict, Any, Optional
import numpy as np


def compute_squeeze_probability(
    funding_rate: Optional[float] = None,
    long_short_ratio: Optional[float] = None,
    realized_vol_24: Optional[float] = None,
    price: float = 65000.0,
    liq_clusters: Optional[list] = None
) -> Dict[str, Any]:
    """
    Computes a synthetic Squeeze Probability Score (0-100%) and market pressure status.
    
    A high squeeze score occurs when:
    1. Funding Rate is deeply negative or unusually low (crowded shorts).
    2. Long/Short ratio is depressed (< 1.0) while price holds key support.
    3. Volatility is compressed (coiled spring).
    4. Heavy liquidation clusters sit just above the current market price.
    """
    fr = funding_rate if funding_rate is not None else 0.0001
    lsr = long_short_ratio if long_short_ratio is not None else 1.0
    vol = realized_vol_24 if realized_vol_24 is not None else 0.02

    # 1. Funding Component (0 - 35 pts)
    # Baseline neutral is +0.01% (0.0001). Negative funding adds heavy squeeze score.
    if fr < 0:
        funding_score = min(35.0, 20.0 + abs(fr) * 30000.0)
    elif fr < 0.00005:
        funding_score = 15.0
    else:
        funding_score = max(0.0, 10.0 - (fr - 0.0001) * 20000.0)

    # 2. Long/Short Sentiment Component (0 - 25 pts)
    # If LSR < 1.0 (more short accounts), squeeze potential is elevated.
    if lsr < 0.85:
        lsr_score = 25.0
    elif lsr < 1.0:
        lsr_score = 18.0
    elif lsr < 1.3:
        lsr_score = 10.0
    else:
        lsr_score = 3.0  # Overcrowded longs (long squeeze risk instead)

    # 3. Volatility Compression Component (0 - 20 pts)
    # Low realized volatility (< 1.5% daily) indicates compression.
    if vol < 0.015:
        vol_score = 20.0
    elif vol < 0.03:
        vol_score = 14.0
    else:
        vol_score = 6.0

    # 4. Liquidation Magnet Component (0 - 20 pts)
    # Find closest upper short liquidation pool
    upper_magnet_price = round(price * 1.045, 2)  # Default +4.5% upper pool
    liq_score = 12.0

    if liq_clusters and isinstance(liq_clusters, list):
        upper_pools = [
            c for c in liq_clusters
            if isinstance(c, dict) and c.get("price", 0) > price
        ]
        if upper_pools:
            closest = min(upper_pools, key=lambda x: x.get("price", float("inf")))
            upper_magnet_price = round(float(closest.get("price", upper_magnet_price)), 2)
            dist_pct = (upper_magnet_price - price) / price * 100.0
            if dist_pct <= 5.0:
                liq_score = 20.0
            elif dist_pct <= 10.0:
                liq_score = 15.0

    total_score = min(100.0, max(0.0, funding_score + lsr_score + vol_score + liq_score))
    total_score = round(total_score, 1)

    # Classification
    if total_score >= 80.0:
        status = "imminent_short_squeeze"
        level = "EXTREME"
        desc = "Massive short overcrowding with compressed volatility. Explosive upside breakout risk."
    elif total_score >= 65.0:
        status = "high_squeeze_probability"
        level = "HIGH"
        desc = "Significant short buildup against supportive order flow. Upper liquidation magnet active."
    elif total_score >= 40.0:
        status = "moderate"
        level = "MODERATE"
        desc = "Balanced derivatives exposure without critical liquidation pressure."
    else:
        status = "low_squeeze_risk"
        level = "LOW"
        desc = "No short squeeze conditions detected. Long positions or spot volume dominating."

    return {
        "squeeze_probability_score": total_score,
        "status": status,
        "alert_level": level,
        "description": desc,
        "upper_liquidation_magnet_usd": upper_magnet_price,
        "metrics_breakdown": {
            "funding_component": round(funding_score, 1),
            "lsr_component": round(lsr_score, 1),
            "volatility_compression": round(vol_score, 1),
            "liquidation_proximity": round(liq_score, 1)
        }
    }
