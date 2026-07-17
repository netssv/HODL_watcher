import React, { useState } from 'react';
import useSound from 'use-sound';

import { AppHeader, GuideBanner, ErrorBanner } from './components/Header.jsx';
import SetupCard, { ApiPipelineCard, MarketSnapshotCard, SignalLogCard } from './components/Sidebar.jsx';
import { ProjectionsPanel, StrategyCard, RiskManagementCard, ValidationChart, LLMPayloadCard, NewsSentimentCard } from './components/ContentPanels.jsx';
import CandlestickChart from './components/CandlestickChart.jsx';
import { AdvancedIndicators } from './components/AdvancedIndicators.jsx';
import TrainModal from './components/TrainModal.jsx';
import WidgetGrid from './components/WidgetGrid.jsx';
import { useSidebarCollapse } from './hooks/useSidebarCollapse.js';
import { useWidgetLayout } from './hooks/useWidgetLayout.js';
import { usePredictData } from './hooks/usePredictData.js';
import { LayoutDashboard } from 'lucide-react';

export default function App() {
  const [playClick] = useSound('/click.wav');
  const [playChime] = useSound('/chime.wav');

  // UI State
  const [isSimpleMode, setIsSimpleMode]       = useState(false);
  const [showExplainers, setShowExplainers]   = useState(false);
  const [sidebarHidden, setSidebarHidden]     = useState(false);
  const [showEmbargoTooltip, setShowEmbargoTooltip] = useState(false);

  // Prediction Custom Hook
  const {
    horizonHours, setHorizonHours,
    thresholdPct, setThresholdPct,
    featureConfig, setFeatureConfig,
    predictionData, prevPrediction,
    trainingReport, strategy,
    loading, trainLoading,
    showTrainModal, setShowTrainModal,
    gaps, error, lastFetchedTime, livePrice, signalLog,
    fetchPrediction, handleTrain
  } = usePredictData(playChime);

  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapse();
  
  const { 
    hiddenWidgets, minimizedWidgets, maximizedWidget, 
    hideWidget, restoreWidget, minimizeWidget, toggleMaximize, resetLayout 
  } = useWidgetLayout();

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
          predictionData={predictionData}
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
              predictionData={predictionData} prevPredictionData={prevPrediction} livePrice={livePrice}
              lastFetchedTime={lastFetchedTime} isSimpleMode={isSimpleMode}
              collapsed={sidebarCollapsed}
            />
            {!sidebarCollapsed && (
              <ProjectionsPanel
                predictionData={predictionData}
                prevPredictionData={prevPrediction}
                isSimpleMode={isSimpleMode}
                thresholdPct={thresholdPct}
              />
            )}
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
              
              {!isSimpleMode && predictionData && (
                <div key="indicators" id="indicators" title="Advanced Quantitative Indicators">
                  <AdvancedIndicators snapshot={predictionData.market_snapshot} />
                </div>
              )}
              
              {!isSimpleMode && predictionData?.news && predictionData.news.length > 0 && (
                <div key="news" id="news" title="News & Sentiment">
                  <NewsSentimentCard news={predictionData.news} />
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
              <footer
                className="footer-text"
                style={{
                  marginTop: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  textAlign: 'center',
                  maxWidth: '72ch',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                <p style={{ margin: 0 }}>{predictionData.disclaimers?.[0]}</p>
              </footer>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
