import pandas as pd

from model.inference import fit_final_model, predict_probabilities


def test_probabilities_come_from_the_fitted_model():
    df = pd.DataFrame({
        "open": [1, 2, 3, 4, 5, 6], "high": [1, 2, 3, 4, 5, 6],
        "low": [1, 2, 3, 4, 5, 6], "close": [1, 2, 3, 4, 5, 6],
        "volume": [1] * 6, "rsi_6": [10, 20, 30, 70, 80, 90],
    })
    model, names = fit_final_model(df, pd.Series([-1, -1, 0, 0, 1, 1]))
    probabilities = predict_probabilities(model, names, df.iloc[-1].to_dict())
    assert set(probabilities) == {"down", "sideways", "up"}
    assert abs(sum(probabilities.values()) - 1) < 1e-9
