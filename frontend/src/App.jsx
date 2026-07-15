import React, { useState, useEffect, useRef } from 'react';
import useSound from 'use-sound';

import { deriveStrategy } from './utils.jsx';
import { AppHeader, GuideBanner, ErrorBanner } from './components/Header.jsx';
import SetupCard, { ApiPipelineCard, MarketSnapshotCard, SignalLogCard } from './components/Sidebar.jsx';
import { ProjectionsPanel, StrategyCard, RiskManagementCard, ValidationChart, LLMPayloadCard, NewsSentimentCard } from './components/ContentPanels.jsx';
import CandlestickChart from './components/CandlestickChart.jsx';
import TrainModal from './components/TrainModal.jsx';
import WidgetGrid from './components/WidgetGrid.jsx';
import { useSidebarCollapse } from './hooks/useSidebarCollapse.js';
import { useWidgetLayout } from './hooks/useWidgetLayout.js';
import { LayoutDashboard } from 'lucide-react';

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
  const [sidebarHidden, setSidebarHidden]     = useState(false);
  const [showEmbargoTooltip, setShowEmbargoTooltip] = useState(false);

  // Data
  const [predictionData, setPredictionData]   = useState(null);
  const [trainingReport, setTrainingReport]   = useState(null);
  const [strategy, setStrategy]               = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [trainLoading, setTrainLoading]       = useState(false);
  const [showTrainModal, setShowTrainModal]   = useState(false);
  const [gaps, setGaps]                       = useState([]);
  const [error, setError]                     = useState(null);
  const [lastFetchedTime, setLastFetchedTime] = useState(null);
  const [livePrice, setLivePrice]             = useState(null);
  const prevPredictionRef                     = useRef(null);
  const [signalLog, setSignalLog]             = useState([]);
  const [sidebarCollapsed, toggleSidebar]     = useSidebarCollapse();
  
  const { 
    hiddenWidgets, minimizedWidgets, maximizedWidget, 
    hideWidget, restoreWidget, minimizeWidget, toggleMaximize, resetLayout 
  } = useWidgetLayout();

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
      
      if (prevPredictionRef.current && data.payload) {
        const prev = prevPredictionRef.current;
        const curr = data.payload;
        const logs = [];
        const prevAcc = prev.validation_summary?.mean_accuracy || 0;
        const currAcc = curr.validation_summary?.mean_accuracy || 0;
        if (Math.abs(currAcc - prevAcc) > 0.001) logs.push(`Accuracy ${(prevAcc*100).toFixed(1)}% → ${(currAcc*100).toFixed(1)}%`);
        const prevDown = prev.model_prediction?.direction_probabilities?.down || 0;
        const currDown = curr.model_prediction?.direction_probabilities?.down || 0;
        if (Math.abs(currDown - prevDown) > 0.005) logs.push(`DOWN% ${(prevDown*100).toFixed(0)} → ${(currDown*100).toFixed(0)}`);
        const prevUp = prev.model_prediction?.direction_probabilities?.up || 0;
        const currUp = curr.model_prediction?.direction_probabilities?.up || 0;
        if (Math.abs(currUp - prevUp) > 0.005) logs.push(`UP% ${(prevUp*100).toFixed(0)} → ${(currUp*100).toFixed(0)}`);
        if (logs.length > 0) setSignalLog(old => [{ time: Date.now(), messages: logs }, ...old].slice(0, 10));
      }
      
      prevPredictionRef.current = data.payload;
      setPredictionData(data.payload);
      setGaps(data.data_gaps || []);
      setLastFetchedTime(now);
      if (data.payload?.validation_summary) setTrainingReport(data.payload.validation_summary);
      setStrategy(deriveStrategy(data.payload));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleTrain = async () => {
    setShowTrainModal(true);
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
    <div>
      <TrainModal
        visible={showTrainModal}
        trainLoading={trainLoading}
        error={error}
        onHide={() => setShowTrainModal(false)}
      />
      <div className="container">
        <AppHeader
          livePrice={livePrice} isSimpleMode={isSimpleMode} setIsSimpleMode={setIsSimpleMode}
          showExplainers={showExplainers} setShowExplainers={setShowExplainers}
          sidebarHidden={sidebarHidden} setSidebarHidden={setSidebarHidden}
          loading={loading} fetchPrediction={fetchPrediction} playClick={playClick}
        />
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.75rem', marginBottom: '0.5rem', zIndex: 10 }}>
          <button onClick={resetLayout} className="btn btn-secondary" title="Reset layout to default">
            <LayoutDashboard size={14} /> Reset Layout
          </button>
        </div>

        <ErrorBanner error={error} />
        {showExplainers && (
          <GuideBanner
            isSimpleMode={isSimpleMode}
            showEmbargoTooltip={showEmbargoTooltip}
            setShowEmbargoTooltip={setShowEmbargoTooltip}
          />
        )}
        <main className={`main-layout ${sidebarCollapsed && !sidebarHidden ? 'sidebar-collapsed' : ''}`} style={sidebarHidden ? { gridTemplateColumns: '0px 1fr' } : {}}>
          <div className="sidebar" style={{ display: sidebarHidden ? 'none' : 'flex' }}>
            <SetupCard
              isSimpleMode={isSimpleMode} horizonHours={horizonHours} setHorizonHours={setHorizonHours}
              thresholdPct={thresholdPct} setThresholdPct={setThresholdPct}
              featureConfig={featureConfig} setFeatureConfig={setFeatureConfig}
              trainLoading={trainLoading} handleTrain={handleTrain} playClick={playClick}
              collapsed={sidebarCollapsed} toggleCollapse={toggleSidebar}
              hiddenWidgets={hiddenWidgets} minimizedWidgets={minimizedWidgets} restoreWidget={restoreWidget}
            />
            <div style={{ display: sidebarCollapsed ? 'none' : 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {!isSimpleMode && <ApiPipelineCard gaps={gaps} error={error} />}
              {!isSimpleMode && <SignalLogCard log={signalLog} />}
            </div>
            <MarketSnapshotCard
              predictionData={predictionData} prevPredictionData={prevPredictionRef.current} livePrice={livePrice}
              lastFetchedTime={lastFetchedTime} isSimpleMode={isSimpleMode}
              collapsed={sidebarCollapsed}
            />
          </div>
          <div className="content-area" style={{ overflow: 'hidden' }}>
            <WidgetGrid
              hiddenWidgets={hiddenWidgets}
              minimizedWidgets={minimizedWidgets}
              maximizedWidget={maximizedWidget}
              hideWidget={hideWidget}
              minimizeWidget={minimizeWidget}
              toggleMaximize={toggleMaximize}
              restoreWidget={restoreWidget}
            >
              <div key="chart" id="chart" title="Chart">
                {predictionData && (
                  <CandlestickChart 
                    isSimpleMode={isSimpleMode} 
                    predictionData={predictionData} 
                    thresholdPct={thresholdPct} 
                    globalLivePrice={livePrice} 
                  />
                )}
              </div>
              
              {!isSimpleMode && predictionData?.news && predictionData.news.length > 0 && (
                <div key="news" id="news" title="News & Sentiment">
                  <NewsSentimentCard news={predictionData.news} />
                </div>
              )}
              
              <div key="projections" id="projections" title="Directional Projections">
                <ProjectionsPanel
                  predictionData={predictionData} 
                  prevPredictionData={prevPredictionRef.current}
                  isSimpleMode={isSimpleMode} 
                  thresholdPct={thresholdPct} 
                />
              </div>
              
              <div key="strategy" id="strategy" title="Strategy">
                <StrategyCard strategy={strategy} />
              </div>
              
              {!isSimpleMode && (
                <div key="risk" id="risk" title="Risk Management">
                  <RiskManagementCard riskParams={predictionData?.risk_management} />
                </div>
              )}
              
              {!isSimpleMode && (
                <div key="llm" id="llm" title="LLM Agent Payload">
                  <LLMPayloadCard payload={predictionData} />
                </div>
              )}
              
              {!isSimpleMode && (
                <div key="validation" id="validation" title="Walk-Forward Validation Trend">
                  <ValidationChart trainingReport={trainingReport} />
                </div>
              )}
            </WidgetGrid>
            
            {predictionData && (
              <footer className="footer-text" style={{ marginTop: '1rem', padding: '0 1rem' }}>
                <p>{predictionData.disclaimers?.[0]}</p>
              </footer>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
