"""On-chain source deliberately disabled until real exchange-flow data is available."""

import pandas as pd


def get_onchain_data() -> pd.DataFrame:
    """Return no rows rather than inventing exchange flows from a WBTC snapshot.

    Free mempool.space data is available elsewhere in ``mempool_onchain`` but does
    not provide Bitcoin exchange net flows, SSR, or whale transaction counts.
    """
    return pd.DataFrame()
