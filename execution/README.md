# Execution contract

Future execution adapters must treat `risk_management.gate` as authoritative:

`allowed` may be considered for sizing; `blocked_low_confidence` means reject the order and size zero, regardless of direction probabilities or displayed sizing.
