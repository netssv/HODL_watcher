from typing import Dict, Any, Tuple, List
from data_ingestion import (
    binance_spot, binance_futures, okx, kraken, bybit, fear_greed, fred_macro,
    coinalyze, deribit, onchain_metrics, mempool_onchain, etf_flows, news_currents,
    news_newsapi, news_gnews, news_coindesk, hyperliquid, dxy
)
def fetch_all_sources(limit: int = 500, interval: str = "1h", force_refresh: bool = False) -> Tuple[Dict[str, Any], List[str]]:
    """Helper that fetches datasets from all modules and flags gaps."""
    import pandas as pd
    if force_refresh:
        from data_ingestion.cache_utils import clear_response_cache
        clear_response_cache()
    data_gaps = []

    def _fields_populated(data, fields, positive_fields=()):
        if data is None or getattr(data, "empty", True):
            return False
        if any(field not in data or data[field].dropna().empty for field in fields):
            return False
        return all((data[field].dropna() > 0).any() for field in positive_fields)

    def _paginate(fetch_fn, total_limit, max_page=1000):
        """Fetch up to total_limit by walking backwards in pages."""
        if total_limit <= max_page:
            return fetch_fn(limit=total_limit)
        pages = []
        end_time = None
        remaining = total_limit
        while remaining > 0:
            page_limit = min(remaining, max_page)
            try:
                kwargs = dict(limit=page_limit)
                if end_time is not None:
                    kwargs['end_time'] = end_time
                page = fetch_fn(**kwargs)
            except Exception:
                break
            if page is None or page.empty:
                break
            pages.append(page)
            remaining -= len(page)
            earliest_ms = int(page.index.min().timestamp() * 1000) - 1
            end_time = earliest_ms
            if len(page) < page_limit:
                break
        if not pages:
            return pd.DataFrame()
        combined = pd.concat(pages).sort_index()
        combined = combined[~combined.index.duplicated(keep='last')]
        return combined
    try:
        spot_df = _paginate(
            lambda **kw: binance_spot.get_klines(symbol="BTCUSDT", interval=interval, **kw),
            limit,
            max_page=1000
        )
        if spot_df.empty:
            raise RuntimeError("Empty response returned")
    except Exception as e:
        data_gaps.append(f"binance_spot: {str(e)}; trying OKX fallback")
        try:
            spot_df = okx.get_klines(symbol="BTCUSDT", interval=interval, limit=min(limit, 100))
            if spot_df.empty:
                raise RuntimeError("Empty response returned")
            data_gaps.append("spot_source: okx_fallback")
        except Exception as okx_error:
            data_gaps.append(f"okx_spot: {str(okx_error)}; trying Kraken fallback")
            try:
                spot_df = kraken.get_klines(symbol="BTCUSDT", interval=interval, limit=limit)
                if spot_df.empty:
                    raise RuntimeError("Empty response returned")
                data_gaps.append("spot_source: kraken_fallback")
            except Exception as kraken_error:
                data_gaps.append(f"kraken_spot: {str(kraken_error)}; trying Bybit fallback")
                try:
                    spot_df = bybit.get_klines(symbol="BTCUSDT", interval=interval, limit=limit)
                    if spot_df.empty:
                        raise RuntimeError("Empty response returned")
                    data_gaps.append("spot_source: bybit_fallback")
                except Exception as bybit_error:
                    spot_df = None
                    data_gaps.append(f"bybit_spot: {str(bybit_error)}")
    futures_df = None
    funding_df = None
    long_short_df = None
    try:
        futures_df = _paginate(
            lambda **kw: binance_futures.get_klines(symbol="BTCUSDT", interval=interval, **kw),
            limit,
            max_page=1000
        )
    except Exception as e:
        data_gaps.append(f"binance_futures_klines: {str(e)}")
    try:
        funding_df = _paginate(
            lambda **kw: binance_futures.get_funding_rate(symbol="BTCUSDT", **kw),
            limit,
            max_page=1000
        )
    except Exception as e:
        data_gaps.append(f"binance_futures_funding: {str(e)}")
    try:
        long_short_df = _paginate(
            lambda **kw: binance_futures.get_long_short_ratio(symbol="BTCUSDT", period=interval, **kw),
            limit,
            max_page=500
        )
    except Exception as e:
        data_gaps.append(f"binance_futures_long_short: {str(e)}")
    fear_greed_df = None
    try:
        fear_greed_df = fear_greed.get_fear_greed_index(limit=min(limit, 1000))
    except Exception as e:
        data_gaps.append(f"fear_greed: {str(e)}")
    macro_dfs = {}
    from data_ingestion.config import FRED_API_KEY
    if not FRED_API_KEY:
        data_gaps.append("fred: missing_key")
    for name, fetch_fn in [("cpi", fred_macro.get_cpi), ("fed_funds", fred_macro.get_fed_funds_rate)]:
        try:
            m_df = fetch_fn(limit=100)
            if not m_df.empty:
                macro_dfs[name] = m_df
        except Exception as e:
            data_gaps.append(f"fred_macro_{name}: {str(e)}")
    try:
        dxy_df = dxy.get_dxy()
        if not dxy_df.empty:
            macro_dfs["dxy"] = dxy_df
    except Exception as e:
        data_gaps.append(f"dxy: {str(e)}")
    order_book_df = None
    try:
        order_book_df = binance_spot.get_order_book(symbol="BTCUSDT", limit=100)
    except Exception as e:
        data_gaps.append(f"binance_order_book: {str(e)}")
    futures_depth_dict = None
    try:
        futures_depth_dict = binance_futures.get_orderbook_depth(symbol="BTCUSDT", limit=100)
    except Exception as e:
        data_gaps.append(f"binance_futures_depth: {str(e)}")
    liq_heatmap_dict = None
    try:
        liq_heatmap_dict = binance_futures.get_liq_heatmap_data(symbol="BTCUSDT")
        if not liq_heatmap_dict:
            liq_heatmap_dict = bybit.get_liq_heatmap_data(symbol="BTCUSDT")
            if liq_heatmap_dict:
                data_gaps.append("liq_heatmap: bybit_public_fallback")
        if not liq_heatmap_dict:
            data_gaps.append("liq_heatmap: unavailable_from_binance_or_bybit_public_data")
        if not liq_heatmap_dict or not all(
            pd.notna(liq_heatmap_dict.get(k)) for k in ("upper", "lower")
        ):
            data_gaps.append("liquidation_proximity: unavailable")
    except Exception as e:
        data_gaps.append(f"liq_heatmap: {str(e)}")

    coinalyze_df, deribit_df, onchain_df, etf_df = None, None, None, None
    try:
        coinalyze_df = coinalyze.get_coinalyze_data()
        if coinalyze_df.empty:
            data_gaps.append("open_interest: unavailable")
        elif coinalyze_df.attrs.get("source") == "binance_futures":
            data_gaps.append("coinalyze: binance_public_fallback")
    except Exception as e:
        data_gaps.append(f"coinalyze: {str(e)}")
    try:
        deribit_df = deribit.get_options_data()
        if deribit_df.empty:
            data_gaps.append("deribit: unavailable")
        else:
            for field in ("skew_25d", "put_call_ratio"):
                if not _fields_populated(deribit_df, (field,)):
                    data_gaps.append(f"deribit: {field} unavailable")
    except Exception as e:
        data_gaps.append(f"deribit: {str(e)}")
    try:
        onchain_df = onchain_metrics.get_onchain_data()
        if onchain_df.empty:
            data_gaps.append("onchain_exchange_flows: unavailable")
    except Exception as e:
        data_gaps.append(f"onchain: {str(e)}")
    network_snapshot = {}
    try:
        network_snapshot = {"mempool": mempool_onchain.get_mempool_stats(), "fees": mempool_onchain.get_recommended_fees()}
    except Exception as e:
        data_gaps.append(f"bitcoin_network: {str(e)}")
    try:
        etf_df = etf_flows.get_etf_flows()
        src = etf_df.attrs.get("source", "unknown")
        if src == "coingecko_proxy":
            data_gaps.append("btc_volume_proxy: coingecko")
        elif src == "etf_empty":
            data_gaps.append("btc_volume_proxy: unavailable")
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

    from data_ingestion.config import CURRENTS_API_KEY, NEWSAPI_KEY, GNEWS_API_KEY
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
                news_df = raw[["title", "url", "source", "sentiment"]]
                data_gaps.append("news: newsapi_fallback")
        except Exception as e:
            data_gaps.append(f"newsapi: {str(e)}")

    if (news_df is None or news_df.empty) and GNEWS_API_KEY:
        try:
            news_df = news_gnews.search_news(query="Bitcoin OR BTC OR crypto", max_results=15)
            if news_df is not None and not news_df.empty:
                news_df["sentiment"] = news_df["title"].apply(_tag_sentiment)
                data_gaps.append("news: gnews_fallback")
        except Exception as e:
            data_gaps.append(f"gnews: {str(e)}")

    try:
        coindesk_df = news_coindesk.get_news(limit=20)
        if coindesk_df is not None and not coindesk_df.empty:
            coindesk_df["sentiment"] = coindesk_df["title"].apply(_tag_sentiment)
            news_df = coindesk_df if news_df is None or news_df.empty else pd.concat([news_df, coindesk_df])
            news_df = news_df[~news_df["url"].duplicated(keep="first")].sort_index().tail(30)
            data_gaps.append("news: coindesk_rss")
    except Exception as e:
        data_gaps.append(f"coindesk_rss: {str(e)}")

    if news_df is None or news_df.empty:
        data_gaps.append("currents_news: missing_key")

    hyperliquid_df = None
    try:
        hyperliquid_df = hyperliquid.get_hyperliquid_data()
        required_hl = (
            "hl_funding_rate", "hl_oracle_price", "hl_mark_price", "hl_open_interest"
        )
        if not _fields_populated(
            hyperliquid_df,
            required_hl,
            positive_fields=("hl_oracle_price", "hl_mark_price", "hl_open_interest"),
        ):
            data_gaps.append("hyperliquid: required fields unavailable")
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
        "network_snapshot": network_snapshot,
        "futures_depth_dict": futures_depth_dict,
        "liq_heatmap_dict": liq_heatmap_dict,
    }
    return sources, data_gaps
