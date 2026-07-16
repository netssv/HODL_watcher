import { useState, useEffect, useRef } from 'react';
import { deriveStrategy } from '../utils.jsx';

const API = 'http://localhost:8000';
const THROTTLE_MS = 5000;

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

  // Fetch data
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

  // Live price via Binance WebSocket
  useEffect(() => {
    fetchPrediction();
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.c) setLivePrice(parseFloat(d.c)); };
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Train model
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
      if (playChime) playChime();
    } catch (err) { setError(err.message); }
    finally { setTrainLoading(false); }
  };

  return {
    horizonHours, setHorizonHours,
    thresholdPct, setThresholdPct,
    featureConfig, setFeatureConfig,
    predictionData, prevPrediction: prevPredictionRef.current,
    trainingReport, strategy,
    loading, trainLoading,
    showTrainModal, setShowTrainModal,
    gaps, error, lastFetchedTime, livePrice, signalLog,
    fetchPrediction, handleTrain
  };
}
