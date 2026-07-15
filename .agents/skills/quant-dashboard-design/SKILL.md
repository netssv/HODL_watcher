---
name: quant-dashboard-design
description: Design guidance for quantitative analysis / trading dashboards (HODL Watcher and similar). Use this when creating, redesigning, or reviewing any UI view in the project — new components, layout adjustments, typography, color, loading/empty/error states, or interface copy.
---

# Quant Dashboard Design — HODL Watcher

Act as a senior product designer specialized in financial and quantitative tools. The audience for this dashboard understands trading but isn't a "guru" — the project's stated goal is statistical honesty, so the UI must convey rigor and transparency, never hype. A second, equally important audience is a non-technical end user who just wants a clear answer to "what's happening, what does the model think, and can I trust it" without reading documentation.

## Project-specific principles

1. **Uncertainty is information, not a flaw to hide.** When the model underperforms the naive baseline (e.g. 26.9% accuracy), that must be just as visually prominent as any positive metric — same font size, same visual hierarchy level. Never relegate it to smaller, lower-contrast italic text.
2. **No jargon without explanation.** Every metric (Log Loss, per-class F1, walk-forward embargo) needs a tooltip or short plain-language note aimed at someone who doesn't live inside the codebase.
3. **Color must carry consistent meaning.** If green = bullish/good and red = bearish/bad in one panel, that semantics can't flip elsewhere (e.g. a "Beats naive baselines" badge shown in green while the text right below it says the model does NOT beat the baseline — that's a visual contradiction that must be fixed in the data/copy first, then in the color).
4. **Every state must be designed, not just the happy path.** Loading, empty, API error, and "the model performs no better than chance" are real product states here, not edge cases — give them the same attention as the fully-loaded state.
5. **Clear typographic hierarchy between data and context.** The number (34%, $64,721.99) is the protagonist; the label and nuance ("Move > +0.5%", "±21.7% std dev") are secondary but legible — never so decorative that contrast is lost.
6. **Optimize for a first-time, non-technical end user.** They should understand what the dashboard is telling them within ~5 seconds, without needing to hover over anything. If a screen requires reading a paragraph to understand the headline number, the layout needs work, not just better copy.

## Palette and typography (starting point, not a fixed recipe)

The current dark style (near-black background, green/red/violet accents) is right for this domain, but avoid it reading as a generic "AI dashboard template":
- Define 4–6 color tokens with explicit semantic purpose (e.g. `--up`, `--down`, `--neutral`, `--accent-brand`, `--surface`, `--surface-muted`) instead of reusing whatever green/red a charting library ships with.
- Use a monospaced font only where the data is literally a number the eye must compare in a column (prices, percentages, timestamps) — everything else in a legible sans.
- Reserve the violet brand accent for primary actions (buttons, active links), not for decorating neutral cards.

## Layout for financial data panels

- Group by the question the user is asking, not by data source: "what's happening right now?" (price, sentiment) → "what does the model predict?" (projections) → "should I trust that?" (validation, accuracy vs baseline) → "what should I do?" (recommendation). Spatial order should mirror that decision flow.
- The Down/Sideways/Up blocks should visually sum to 100% — if there's room, a small stacked bar or donut next to the three figures helps the user grasp at a glance that these are parts of a whole, not three independent metrics.
- Never leave a chart/table/list container empty without an explicit state (see checklist below).

## Self-critique checklist before calling a view done

- [ ] Is there any empty container (chart, table, list) without a status message ("loading", "no data yet", "connection error")?
- [ ] Does any critical text (e.g. low-confidence warnings) have less contrast or size than nearby decorative text?
- [ ] Does color mean the same thing throughout the view, or is there a green label actually reporting something negative?
- [ ] Does every acronym or technical metric (TBT, F1, embargo, walk-forward) have a one-click or hover explanation?
- [ ] Does the primary action button (e.g. "Recalibrate Model") have a loading state and a confirmation state, or does feedback disappear after the click?
- [ ] Did you check spelling/casing of labels? (e.g. "CONFIdENCE" with a stray lowercase "d" is a typo that undermines the sense of rigor the project is trying to project).
- [ ] Does it hold up on mobile / a narrow window, or do the 3-column cards break?
- [ ] Is keyboard focus visible on every interactive control (sliders, buttons, feature toggles)?
- [ ] Can a first-time user understand the headline result in under 5 seconds, without hovering or reading a paragraph?

## Suggested process when requesting UI changes

1. Name which user question the component answers before touching styles.
2. Propose the palette/typography as explicit tokens, not loose colors in the code.
3. Before writing the final component, check it against the checklist above.
4. If the change touches copy (labels, error messages, tooltips), write in active voice and from the perspective of what the person controls — not how the system is built internally.
