import { useState, useEffect, useRef } from 'react';
import { deriveStrategy } from '../utils.jsx';

const API = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');
const ONLINE_MODE = import.meta.env.VITE_DEPLOYMENT_MODE === 'online';
const THROTTLE_MS = 5000;
const CALIBRATION_CACHE_MS = 6 * 60 * 60 * 1000;
const RECALIBRATION_COOLDOWN_MS = 15 * 60 * 1000;
const HORIZON_SETTINGS = { 4: 0.003, 24: 0.005, 72: 0.01 };

// Give the backend a short warm-up window, then fail visibly instead of
// leaving the refresh control spinning for several minutes.
async function fetchWithRetry(url, retries = 4, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (res.status !== 503) throw new Error(`Server error ${res.status}`);
      // 503 = model still warming up; retry briefly.
    } catch (e) {
      if (timeout) clearTimeout(timeout);
      if (i === retries - 1) throw new Error(e.name === 'AbortError'
        ? 'Backend request timed out. Start it with: .venv/bin/uvicorn api.app:app --reload'
        : 'Backend unreachable. Start it with: .venv/bin/uvicorn api.app:app --reload');
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Model is still warming up. Try again in a moment.');
}



export function usePredictData(playChime) {
  // Config
  const [horizonHours, setHorizonHours]   = useState(24);
  const [thresholdPct, setThresholdPct]   = useState(0.005);
  const [featureConfig, setFeatureConfig] = useState({
    include_derivatives: true, include_sentiment: true, include_macro: true,
  });

  // Data State
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
  const [calibrationCache, setCalibrationCache] = useState({});
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [refreshNotice, setRefreshNotice] = useState('');

  useEffect(() => {
    const update = () => setCooldownRemaining(Math.max(0, cooldownUntil - Date.now()));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  // Fetch data
  const fetchPrediction = async (force = false, refreshSources = force) => {
    if (ONLINE_MODE && force) {
      setRefreshNotice('Simulation: the shared server refreshes market data once per hour. Manual refresh is disabled online.');
      return;
    }
    setRefreshNotice('');
    const now = Date.now();
    if (!force && lastFetchedTime && now - lastFetchedTime < THROTTLE_MS) return;
    setLoading(true); setError(null);
    try {
      // Refresh can also race model warmup; retry temporary 503 responses.
      const onlineForceDisabled = !import.meta.env.DEV;
      const canRefreshSources = refreshSources && !onlineForceDisabled;
      const res = await fetchWithRetry(`${API}/api/predict${canRefreshSources ? `?force_refresh=${Date.now()}` : ''}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
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
      const trainedHorizon = data.payload?.meta?.horizon_hours;
      if (trainedHorizon != null) {
        setCalibrationCache(cache => ({
          ...cache,
          [trainedHorizon]: { payload: data.payload, gaps: data.data_gaps || [], savedAt: Date.now() },
        }));
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const selectHorizon = hours => {
    setHorizonHours(hours);
    setThresholdPct(HORIZON_SETTINGS[hours] ?? 0.005);
    const cached = calibrationCache[hours];
    if (!cached || Date.now() - cached.savedAt > CALIBRATION_CACHE_MS) return false;
    setPredictionData(cached.payload);
    setGaps(cached.gaps);
    setTrainingReport(cached.payload.validation_summary);
    setStrategy(deriveStrategy(cached.payload));
    setLastFetchedTime(cached.savedAt);
    return true;
  };

  // Live price via Binance WebSocket
  useEffect(() => {
    fetchPrediction();
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.c) setLivePrice(parseFloat(d.c)); };
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Train model
  const handleTrain = async () => {
    if (cooldownRemaining > 0 || trainLoading) return;
    if (ONLINE_MODE) {
      setRefreshNotice('Online mode: calibration is simulated. The shared Cloud Run model refreshes on its server schedule; upstream APIs are not refreshed from the browser.');
      return;
    }
    setShowTrainModal(true);
    setTrainLoading(true); setError(null);
    try {
      for (const [index, hours] of [4, 24, 72].entries()) {
        const threshold = HORIZON_SETTINGS[hours];
        setHorizonHours(hours);
        setThresholdPct(threshold);
        const res = await fetch(`${API}/api/train`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ horizon_hours: hours, threshold_pct: threshold, features_config: featureConfig, force_refresh: index === 0 }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || `${hours}h calibration failed`); }
        const data = await res.json();
        setTrainingReport(data.validation_summary);
        setGaps(data.data_gaps || []);
        // Training already fetched fresh sources; avoid clearing/refetching them
        // again just to retrieve the newly trained prediction.
        await fetchPrediction(true, false);
      }
      setCooldownUntil(Date.now() + RECALIBRATION_COOLDOWN_MS);
      if (playChime) playChime();
    } catch (err) { setError(err.message); }
    finally { setTrainLoading(false); }
  };

  return {
    horizonHours, setHorizonHours,
    selectHorizon,
    thresholdPct, setThresholdPct,
    featureConfig, setFeatureConfig,
    predictionData, prevPrediction: prevPredictionRef.current,
    trainingReport, strategy,
    loading, trainLoading,
    cooldownRemaining,
    showTrainModal, setShowTrainModal,
    gaps, error, lastFetchedTime, livePrice, signalLog,
    fetchPrediction, handleTrain
    , onlineMode: ONLINE_MODE, refreshNotice
  };
}
