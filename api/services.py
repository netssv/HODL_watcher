from typing import Dict, Any, Tuple, List
from data_ingestion import (
    binance_spot, binance_futures, fear_greed, fred_macro,
    coinalyze, deribit, onchain_metrics, etf_flows, news_currents,
    news_newsapi, hyperliquid
)

def fetch_all_sources(limit: int = 500, interval: str = "1h") -> Tuple[Dict[str, Any], List[str]]:
    """Helper that fetches datasets from all modules and flags gaps."""
    data_gaps = []
    
    # 1. Binance Spot
    try:
        spot_df = binance_spot.get_klines(symbol="BTCUSDT", interval=interval, limit=limit)
        if spot_df.empty:
            data_gaps.append("binance_spot: Empty response returned")
    except Exception as e:
        spot_df = None
        data_gaps.append(f"binance_spot: {str(e)}")
        
    # 2. Binance Futures
    futures_df = None
    funding_df = None
    long_short_df = None
    try:
        futures_df = binance_futures.get_klines(symbol="BTCUSDT", interval=interval, limit=limit)
    except Exception as e:
        data_gaps.append(f"binance_futures_klines: {str(e)}")
        
    try:
        funding_df = binance_futures.get_funding_rate(symbol="BTCUSDT", limit=limit)
    except Exception as e:
        data_gaps.append(f"binance_futures_funding: {str(e)}")
        
    try:
        long_short_df = binance_futures.get_long_short_ratio(symbol="BTCUSDT", period=interval, limit=limit)
    except Exception as e:
        data_gaps.append(f"binance_futures_long_short: {str(e)}")

    # 3. Fear & Greed
    fear_greed_df = None
    try:
        fear_greed_df = fear_greed.get_fear_greed_index(limit=limit)
    except Exception as e:
        data_gaps.append(f"fear_greed: {str(e)}")

    # 4. FRED Macro
    macro_dfs = {}
    from data_ingestion.config import FRED_API_KEY, COINALYZE_API_KEY, CURRENTS_API_KEY
    if not FRED_API_KEY:
        data_gaps.append("fred: missing_key")
    for name, fetch_fn in [("cpi", fred_macro.get_cpi), ("dxy", fred_macro.get_dxy), ("fed_funds", fred_macro.get_fed_funds_rate)]:
        try:
            m_df = fetch_fn(limit=100)
            if not m_df.empty:
                macro_dfs[name] = m_df
        except Exception as e:
            data_gaps.append(f"fred_macro_{name}: {str(e)}")
            
    # 5. Order Book
    order_book_df = None
    try:
        order_book_df = binance_spot.get_order_book(symbol="BTCUSDT", limit=100)
    except Exception as e:
        data_gaps.append(f"binance_order_book: {str(e)}")

    # 6. Coinalyze, Deribit, Onchain, ETF
    coinalyze_df, deribit_df, onchain_df, etf_df = None, None, None, None
    if not COINALYZE_API_KEY:
        data_gaps.append("coinalyze: missing_key")
    try:
        coinalyze_df = coinalyze.get_coinalyze_data()
    except Exception as e:
        data_gaps.append(f"coinalyze: {str(e)}")
        
    try:
        deribit_df = deribit.get_options_data()
    except Exception as e:
        data_gaps.append(f"deribit: {str(e)}")
        
    from data_ingestion.config import ETHERSCAN_API_KEY
    if not ETHERSCAN_API_KEY:
        data_gaps.append("onchain: missing_key")
    try:
        onchain_df = onchain_metrics.get_onchain_data()
    except Exception as e:
        data_gaps.append(f"onchain: {str(e)}")
        
    data_gaps.append("etf_flows: mock_data")
    try:
        etf_df = etf_flows.get_etf_flows()
        src = etf_df.attrs.get("source", "unknown")
        if src == "coingecko_proxy":
            # Remove the pre-added mock_data tag and replace with proxy tag
            data_gaps.remove("etf_flows: mock_data")
            data_gaps.append("etf_flows: coingecko_proxy")
        elif src == "etf_empty":
            data_gaps.remove("etf_flows: mock_data")
    except Exception as e:
        data_gaps.append(f"etf_flows: {str(e)}")


    news_df = None
    _BULL_WORDS = {"rally", "surge", "gain", "bullish", "rise", "up", "high",
                   "record", "breakout", "buy", "positive", "growth", "inflow",
                   "adoption", "approve", "etf", "institutional"}
    _BEAR_WORDS = {"crash", "drop", "fall", "bearish", "sell", "low", "loss",
                   "ban", "hack", "fraud", "outflow", "liquidat", "fear",
                   "negative", "decline", "plunge", "dump"}

    def _tag_sentiment(title: str) -> str:
        t = title.lower()
        bull = sum(1 for w in _BULL_WORDS if w in t)
        bear = sum(1 for w in _BEAR_WORDS if w in t)
        return "positive" if bull > bear else "negative" if bear > bull else "neutral"

    from data_ingestion.config import CURRENTS_API_KEY, NEWSAPI_KEY
    if CURRENTS_API_KEY:
        try:
            news_df = news_currents.get_news(currencies="BTC", limit=15)
            if news_df is not None and not news_df.empty:
                data_gaps.append("news: currents_api")
        except Exception as e:
            data_gaps.append(f"currents_news: {str(e)}")

    if (news_df is None or news_df.empty) and NEWSAPI_KEY:
        try:
            import pandas as pd
            raw = news_newsapi.search_news(query="Bitcoin OR BTC OR crypto", page_size=15)
            if raw is not None and not raw.empty:
                raw["sentiment"] = raw["title"].apply(_tag_sentiment)
                # align columns to match currents schema
                news_df = raw[["title", "url", "source", "sentiment"]]
                data_gaps.append("news: newsapi_fallback")
        except Exception as e:
            data_gaps.append(f"newsapi: {str(e)}")

    if news_df is None or news_df.empty:
        data_gaps.append("currents_news: missing_key")

    hyperliquid_df = None
    try:
        hyperliquid_df = hyperliquid.get_hyperliquid_data()
    except Exception as e:
        data_gaps.append(f"hyperliquid: {str(e)}")

    sources = {
        "spot_df": spot_df,
        "futures_df": futures_df,
        "funding_df": funding_df,
        "long_short_df": long_short_df,
        "fear_greed_df": fear_greed_df,
        "macro_dfs": macro_dfs,
        "order_book_df": order_book_df,
        "coinalyze_df": coinalyze_df,
        "deribit_df": deribit_df,
        "onchain_df": onchain_df,
        "etf_df": etf_df,
        "news_df": news_df,
        "hyperliquid_df": hyperliquid_df,
    }
    
    return sources, data_gaps
