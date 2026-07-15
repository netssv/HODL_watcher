import React, { useState, useEffect } from 'react';
import useSound from 'use-sound';

import { deriveStrategy } from './utils.jsx';
import { AppHeader, GuideBanner, ErrorBanner } from './components/Header.jsx';
import SetupCard, { ApiPipelineCard, MarketSnapshotCard } from './components/Sidebar.jsx';
import { ProjectionsPanel, StrategyCard, ValidationChart } from './components/ContentPanels.jsx';

const API = 'http://localhost:8000';
const THROTTLE_MS = 5000;

export default function App() {
  const [playClick] = useSound('/click.wav');
  const [playChime] = useSound('/chime.wav');

  // Config
  const [horizonHours, setHorizonHours]   = useState(24);
  const [thresholdPct, setThresholdPct]   = useState(0.005);
  const [featureConfig, setFeatureConfig] = useState({
    include_derivatives: true, include_sentiment: true, include_macro: true,
  });

  // UI
  const [isSimpleMode, setIsSimpleMode]       = useState(true);
  const [showExplainers, setShowExplainers]   = useState(false);
  const [showEmbargoTooltip, setShowEmbargoTooltip] = useState(false);

  // Data
  const [predictionData, setPredictionData]   = useState(null);
  const [trainingReport, setTrainingReport]   = useState(null);
  const [strategy, setStrategy]               = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [trainLoading, setTrainLoading]       = useState(false);
  const [gaps, setGaps]                       = useState([]);
  const [error, setError]                     = useState(null);
  const [lastFetchedTime, setLastFetchedTime] = useState(null);
  const [livePrice, setLivePrice]             = useState(null);

  // Live price via Binance WebSocket — zero API quota cost
  useEffect(() => {
    fetchPrediction();
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.c) setLivePrice(parseFloat(d.c)); };
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPrediction = async (force = false) => {
    const now = Date.now();
    if (!force && lastFetchedTime && now - lastFetchedTime < THROTTLE_MS) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/predict`);
      if (!res.ok) throw new Error('Backend unreachable. Start uvicorn.');
      const data = await res.json();
      setPredictionData(data.payload);
      setGaps(data.data_gaps || []);
      setLastFetchedTime(now);
      if (data.payload?.validation_summary) setTrainingReport(data.payload.validation_summary);
      setStrategy(deriveStrategy(data.payload));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleTrain = async () => {
    setTrainLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/train`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon_hours: horizonHours, threshold_pct: thresholdPct, features_config: featureConfig }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Training failed'); }
      const data = await res.json();
      setTrainingReport(data.validation_summary);
      setGaps(data.data_gaps || []);
      fetchPrediction(true);
      playChime();
    } catch (err) { setError(err.message); }
    finally { setTrainLoading(false); }
  };

  return (
    <div className={isSimpleMode ? 'simple-mode' : ''}>
      <div className="container">
        <AppHeader
          livePrice={livePrice} isSimpleMode={isSimpleMode} setIsSimpleMode={setIsSimpleMode}
          showExplainers={showExplainers} setShowExplainers={setShowExplainers}
          loading={loading} fetchPrediction={fetchPrediction} playClick={playClick}
        />
        <ErrorBanner error={error} />
        {showExplainers && (
          <GuideBanner
            isSimpleMode={isSimpleMode}
            showEmbargoTooltip={showEmbargoTooltip}
            setShowEmbargoTooltip={setShowEmbargoTooltip}
          />
        )}
        <main className="main-layout">
          <div className="sidebar">
            <SetupCard
              isSimpleMode={isSimpleMode} horizonHours={horizonHours} setHorizonHours={setHorizonHours}
              thresholdPct={thresholdPct} setThresholdPct={setThresholdPct}
              featureConfig={featureConfig} setFeatureConfig={setFeatureConfig}
              trainLoading={trainLoading} handleTrain={handleTrain} playClick={playClick}
            />
            {!isSimpleMode && <ApiPipelineCard gaps={gaps} error={error} />}
            <MarketSnapshotCard
              predictionData={predictionData} livePrice={livePrice}
              lastFetchedTime={lastFetchedTime} isSimpleMode={isSimpleMode}
            />
          </div>
          <div className="content-area">
            <ProjectionsPanel
              predictionData={predictionData} isSimpleMode={isSimpleMode} thresholdPct={thresholdPct}
            />
            <StrategyCard strategy={strategy} />
            {!isSimpleMode && <ValidationChart trainingReport={trainingReport} />}
            {predictionData && (
              <footer className="footer-text"><p>{predictionData.disclaimers?.[0]}</p></footer>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
