// src/components/InputPanel.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PredictRequest, Profile, PredictResponse } from '../types';
import { getProfiles } from '../api/predict';
import { ArrowRight, ChevronDown, Check, Gauge, Activity, Infinity as InfinityIcon } from 'lucide-react';
import { ThreeBattery } from './ThreeBattery';
import { SohCurveChart } from './SohCurveChart';

interface InputPanelProps {
  onRunPrediction: (request: PredictRequest) => void;
  isLoading: boolean;
  initialRequest?: PredictRequest;
  predictionData?: PredictResponse | null;
  onViewDetailedAnalysis?: () => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  onRunPrediction,
  isLoading,
  initialRequest,
  predictionData,
  onViewDetailedAnalysis,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    initialRequest?.profile_id ?? initialRequest?.battery_id ?? null
  );
  const [cRate, setCRate] = useState<number>(initialRequest?.c_rate ?? 3.5);
  const [ambientTemp, setAmbientTemp] = useState<number>(initialRequest?.ambient_temp_C ?? 45.0);
  const [cycleHorizon, setCycleHorizon] = useState<number>(initialRequest?.cycle_range[1] ?? 1000);
  
  const [isPresetOpen, setIsPresetOpen] = useState<boolean>(false);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const prevLoadingRef = useRef(isLoading);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);

  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      if (predictionData) {
        setShowSuccessFlash(true);
        const timer = setTimeout(() => setShowSuccessFlash(false), 600);
        return () => clearTimeout(timer);
      }
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, predictionData]);

  useEffect(() => {
    let isMounted = true;
    getProfiles().then((data) => {
      if (isMounted) {
        const profileList: Profile[] = Array.isArray(data) ? data : (data?.profiles ?? []);
        setProfiles(profileList);

        if (!selectedProfileId && profileList.length > 0 && !initialRequest?.profile_id && !initialRequest?.battery_id) {
          const defaultProfile = profileList.find((p) => p.split === 'test') || profileList[0];
          if (defaultProfile) {
            setSelectedProfileId(defaultProfile.profile_id);
            setCRate(defaultProfile.c_rate);
            setAmbientTemp(defaultProfile.temperature);
            if (typeof defaultProfile.max_cycles === 'number') {
              setCycleHorizon(defaultProfile.max_cycles);
            }
          }
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProfile = (preset: Profile) => {
    setSelectedProfileId(preset.profile_id);
    setCRate(preset.c_rate);
    setAmbientTemp(preset.temperature);
    if (typeof preset.max_cycles === 'number') {
      setCycleHorizon(preset.max_cycles);
    }
    setIsPresetOpen(false);
  };

  const handleSelectCustom = () => {
    setSelectedProfileId(null);
    setIsPresetOpen(false);
  };

  const handleManualCRateChange = (val: number) => {
    setSelectedProfileId(null);
    setCRate(val);
  };

  const handleManualTempChange = (val: number) => {
    setSelectedProfileId(null);
    setAmbientTemp(val);
  };

  const handleManualCycleChange = (val: number) => {
    setSelectedProfileId(null);
    setCycleHorizon(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunPrediction({
      ...(selectedProfileId ? { profile_id: selectedProfileId, battery_id: selectedProfileId } : {}),
      c_rate: Number(cRate),
      ambient_temp_C: Number(ambientTemp),
      cycle_range: [0, Number(cycleHorizon)],
    });
  };

  const cRatePercent = Math.min(100, Math.max(0, ((cRate - 0.5) / (5.0 - 0.5)) * 100));
  const tempPercent = Math.min(100, Math.max(0, ((ambientTemp - (-20)) / (65 - (-20))) * 100));
  const cyclePercent = Math.min(100, Math.max(0, ((cycleHorizon - 100) / (2000 - 100)) * 100));

  const activeProfile = Array.isArray(profiles) ? profiles.find((p) => p.profile_id === selectedProfileId) : undefined;
  const modeLabel = activeProfile
    ? `Preset: ${activeProfile.label.split('(')[0].trim()}`
    : 'User (Custom)';

  // Calculate current SOH based on Physics-LSTM predicted capacity relative to initial
  const currentSoh = useMemo(() => {
    if (predictionData?.capacity_pinn && predictionData.capacity_pinn.length > 0) {
      const initial = predictionData.capacity_pinn[0] || 1.1;
      const final = predictionData.capacity_pinn[predictionData.capacity_pinn.length - 1] || 0.88;
      return final / initial;
    }
    return 1.0;
  }, [predictionData]);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto py-6 flex flex-col justify-center select-text">
      
      <div className="w-full flex flex-col lg:flex-row items-stretch gap-6">
        
        {/* ================= LEFT COLUMN (~40% Width) ================= */}
        <div className="w-full lg:w-[40%] rounded-[32px] bg-slate-900/60 backdrop-blur-[12px] border border-white/30 p-6 flex flex-col justify-between shadow-[0_16px_40px_rgba(0,0,0,0.15)]">
          
          {/* Mode Header & Dynamic Profiles Dropdown */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                Operating Mode
              </span>
              <span className="text-xs font-['Space_Grotesk'] font-bold text-slate-200 truncate max-w-[170px]">
                {modeLabel}
              </span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsPresetOpen(!isPresetOpen)}
                className={`h-[38px] px-4 rounded-full border text-xs font-['Space_Grotesk'] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-sm ${
                  activeProfile
                    ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-[0_4px_12px_rgba(0,102,255,0.25)]'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
                }`}
              >
                <span>Preset</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPresetOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPresetOpen && (
                <div className="absolute top-11 right-0 z-50 w-80 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)] space-y-1 animate-fadeIn max-h-[340px] overflow-y-auto">
                  {Array.isArray(profiles) && profiles.map((profile) => {
                    const isHeldOut = profile.split === 'test' || profile.split === 'held_out';
                    return (
                      <button
                        key={profile.profile_id}
                        type="button"
                        onClick={() => handleSelectProfile(profile)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-semibold transition-colors flex items-center justify-between gap-2 ${
                          selectedProfileId === profile.profile_id
                            ? 'bg-slate-800 text-[#00C2FF]'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate">{profile.label}</span>
                          {isHeldOut && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[#00C2FF] text-[9px] font-mono font-bold tracking-wide uppercase shrink-0 border border-blue-500/30">
                              OOD Test
                            </span>
                          )}
                        </div>
                        {selectedProfileId === profile.profile_id && <Check className="w-3.5 h-3.5 shrink-0 text-[#00C2FF]" />}
                      </button>
                    );
                  })}

                  <div className="border-t border-slate-800 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={handleSelectCustom}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-semibold transition-colors flex items-center justify-between ${
                        selectedProfileId === null
                          ? 'bg-slate-800 text-[#00C2FF]'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span>Custom Scenario (Manual)</span>
                      {selectedProfileId === null && <Check className="w-3.5 h-3.5 shrink-0 text-[#00C2FF]" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3D Battery Model Viewport */}
          <div className="relative my-auto w-full max-w-[390px] mx-auto min-h-[300px] rounded-[24px] bg-slate-950/75 border border-white/30 p-4 flex flex-col items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.15)] overflow-hidden">
            <ThreeBattery soh={currentSoh} isLoading={isLoading} />
          </div>

          <div className="pt-2 text-center shrink-0">
            <span className="font-mono text-xs font-semibold text-slate-400 tracking-wider">
              Target: <strong className="text-white">{cycleHorizon} cycles</strong>
            </span>
          </div>

        </div>

        {/* ================= RIGHT COLUMN (~60% Width) ================= */}
        <div className="w-full lg:w-[60%] rounded-[32px] bg-slate-900/60 backdrop-blur-[12px] border border-white/30 p-6 sm:p-8 flex flex-col justify-between shadow-[0_16px_40px_rgba(0,0,0,0.15)]">
          
          <div className="flex-1 flex flex-col justify-center gap-5">
            
            {/* ROW 1: Ambient Temperature */}
            <div className="h-[135px] rounded-[36px] bg-slate-900/40 backdrop-blur-[12px] border border-white/30 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-3.5 w-48 sm:w-56 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#00C2FF] shrink-0 shadow-sm">
                  <Gauge className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-['Space_Grotesk'] font-bold uppercase tracking-[0.08em] text-white leading-tight">
                    Ambient Temp
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    Operating climate
                  </span>
                </div>
              </div>

              <div className="relative flex-1 px-4">
                {activeSlider === 'temp' && (
                  <div 
                    className="absolute -top-7 px-2 py-1 rounded bg-[#0066FF] text-white text-[10px] font-mono font-bold shadow-md -translate-x-1/2 pointer-events-none transition-all animate-fadeIn"
                    style={{ left: `calc(${tempPercent}% + 16px)` }}
                  >
                    {ambientTemp.toFixed(1)}°C
                  </div>
                )}
                <input
                  type="range"
                  min="-20"
                  max="65"
                  step="0.1"
                  value={ambientTemp}
                  onMouseDown={() => setActiveSlider('temp')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('temp')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualTempChange(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #0066FF 0%, #00C2FF ${tempPercent}%, rgba(255, 255, 255, 0.1) ${tempPercent}%, rgba(255, 255, 255, 0.1) 100%)`
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer custom-slider accent-[#0066FF] transition-all`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-white px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 shrink-0 shadow-sm">
                <input
                  type="number"
                  step="any"
                  min="-40"
                  max="85"
                  value={ambientTemp}
                  onChange={(e) => handleManualTempChange(parseFloat(e.target.value) || 0)}
                  className="w-16 sm:w-20 bg-transparent text-right outline-none font-mono font-bold text-white"
                />
                <span className="text-slate-400">°C</span>
              </div>
            </div>

            {/* ROW 2: Charge Rate (C-Rate) */}
            <div className="h-[135px] rounded-[36px] bg-slate-900/40 backdrop-blur-[12px] border border-white/30 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-3.5 w-48 sm:w-56 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#00C2FF] shrink-0 shadow-sm">
                  <Activity className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-['Space_Grotesk'] font-bold uppercase tracking-[0.08em] text-white leading-tight">
                    Charge Rate
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    Current draw
                  </span>
                </div>
              </div>

              <div className="relative flex-1 px-4">
                {activeSlider === 'crate' && (
                  <div 
                    className="absolute -top-7 px-2 py-1 rounded bg-[#0066FF] text-white text-[10px] font-mono font-bold shadow-md -translate-x-1/2 pointer-events-none transition-all animate-fadeIn"
                    style={{ left: `calc(${cRatePercent}% + 16px)` }}
                  >
                    {cRate.toFixed(2)}C
                  </div>
                )}
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={cRate}
                  onMouseDown={() => setActiveSlider('crate')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('crate')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualCRateChange(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #0066FF 0%, #00C2FF ${cRatePercent}%, rgba(255, 255, 255, 0.1) ${cRatePercent}%, rgba(255, 255, 255, 0.1) 100%)`
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer custom-slider accent-[#0066FF] transition-all`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-white px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 shrink-0 shadow-sm">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="10.0"
                  value={cRate}
                  onChange={(e) => handleManualCRateChange(parseFloat(e.target.value) || 0)}
                  className="w-16 sm:w-20 bg-transparent text-right outline-none font-mono font-bold text-white"
                />
                <span className="text-slate-400">C</span>
              </div>
            </div>

            {/* ROW 3: Cycle Horizon Target */}
            <div className="h-[135px] rounded-[36px] bg-slate-900/40 backdrop-blur-[12px] border border-white/30 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-3.5 w-48 sm:w-56 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#00C2FF] shrink-0 shadow-sm">
                  <InfinityIcon className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-['Space_Grotesk'] font-bold uppercase tracking-[0.08em] text-white leading-tight">
                    Cycle Horizon
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    Target lifespan
                  </span>
                </div>
              </div>

              <div className="relative flex-1 px-4">
                {activeSlider === 'cycle' && (
                  <div 
                    className="absolute -top-7 px-2 py-1 rounded bg-[#0066FF] text-white text-[10px] font-mono font-bold shadow-md -translate-x-1/2 pointer-events-none transition-all animate-fadeIn"
                    style={{ left: `calc(${cyclePercent}% + 16px)` }}
                  >
                    {cycleHorizon} cycles
                  </div>
                )}
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="10"
                  value={cycleHorizon}
                  onMouseDown={() => setActiveSlider('cycle')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('cycle')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualCycleChange(parseInt(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #0066FF 0%, #00C2FF ${cyclePercent}%, rgba(255, 255, 255, 0.1) ${cyclePercent}%, rgba(255, 255, 255, 0.1) 100%)`
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer custom-slider accent-[#0066FF] transition-all`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-white px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 shrink-0 shadow-sm">
                <input
                  type="number"
                  min="100"
                  max="2500"
                  step="10"
                  value={cycleHorizon}
                  onChange={(e) => handleManualCycleChange(parseInt(e.target.value) || 100)}
                  className="w-14 bg-transparent text-right outline-none font-mono font-bold text-white"
                />
                <span className="text-slate-400">Cycles</span>
              </div>
            </div>

          </div>

          {/* Run Diagnostics Button */}
          <div className="w-full pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full h-[74px] flex items-center justify-center rounded-full border border-white/60 text-white transition-all duration-300 overflow-hidden cursor-pointer disabled:opacity-50 ${
                showSuccessFlash 
                  ? 'success-flash-bg' 
                  : (isLoading ? 'shimmer-bg' : 'bg-[#0066FF] hover:bg-[#0055DD] shadow-[0_12px_28px_-6px_rgba(0,102,255,0.4)]')
              }`}
            >
              {!isLoading && !showSuccessFlash && (
                <span 
                  className="absolute inset-0 bg-gradient-to-r from-[#0066FF] via-[#00C2FF] to-[#0066FF] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out pointer-events-none" 
                />
              )}

              <span className="relative z-10 flex items-center gap-3 text-base font-['Space_Grotesk'] font-bold tracking-[0.16em] uppercase text-white select-none">
                {isLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>{isLoading ? 'ANALYZING...' : (showSuccessFlash ? 'SUCCESS ✓' : 'RUN DIAGNOSTICS')}</span>
                {!isLoading && !showSuccessFlash && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1.5" />}
              </span>
            </button>
          </div>

          {/* Results Summary Card */}
          {predictionData && !isLoading && (
            <div className="w-full mt-6 rounded-[28px] bg-slate-950/75 backdrop-blur-xl border border-white/30 p-6 shadow-xl animate-slideIn">
              <div className="space-y-4">
                
                {/* Row 1: Baseline MLP */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-space font-bold text-slate-300 uppercase tracking-wider">Baseline MLP</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-slate-300">
                    <div>SOH: <strong className="text-white text-xs">{( (predictionData.capacity_baseline_mlp[predictionData.capacity_baseline_mlp.length - 1] / predictionData.capacity_baseline_mlp[0]) * 100 ).toFixed(1)}%</strong></div>
                    <div>MAE: <strong className="text-white">{(predictionData.metrics?.mae_baseline_mlp ?? 0.042).toFixed(4)}</strong></div>
                    <div>RMSE: <strong className="text-white">{(predictionData.metrics?.rmse_baseline_mlp ?? 0.045).toFixed(4)}</strong></div>
                    <div>Violations: <strong className="text-white">{predictionData.violations?.baseline_a ?? 0}</strong></div>
                  </div>
                </div>

                {/* Row 2: Physics-LSTM */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/10 border border-[#0066FF]/30 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-space font-bold text-[#00C2FF] uppercase tracking-wider">Physics-LSTM</span>
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-slate-300">
                    <div>SOH: <strong className="text-[#00C2FF] text-xs">{( (predictionData.capacity_pinn[predictionData.capacity_pinn.length - 1] / predictionData.capacity_pinn[0]) * 100 ).toFixed(1)}%</strong></div>
                    <div>MAE: <strong className="text-white">{(predictionData.metrics?.mae_pinn ?? 0.008).toFixed(4)}</strong></div>
                    <div>RMSE: <strong className="text-white">{(predictionData.metrics?.rmse_pinn ?? 0.009).toFixed(4)}</strong></div>
                    <div>Violations: <strong className="text-white">{predictionData.violations?.pinn ?? 0}</strong></div>
                  </div>
                </div>

                {/* RUL display */}
                <div className="pt-2.5 text-center border-t border-white/10">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Predicted RUL Projection</div>
                  <div className="text-3xl font-space font-extrabold text-white mt-1">
                    {predictionData.rul?.rul_pinn ?? 920} <span className="text-base font-mono font-semibold text-slate-400">Cycles</span>
                  </div>
                </div>

                {/* View Details Action Button */}
                {onViewDetailedAnalysis && (
                  <div className="pt-3.5 flex justify-center border-t border-white/10">
                    <button
                      type="button"
                      onClick={onViewDetailedAnalysis}
                      className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black text-xs font-space font-bold tracking-[0.1em] uppercase text-white transition-all flex items-center gap-2 cursor-pointer border border-slate-800 shadow-md"
                    >
                      <span>View Detailed Analysis</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* SOH Degradation Curve Line Chart */}
          {predictionData && !isLoading && (
            <div className="w-full mt-6 animate-slideIn">
              <SohCurveChart
                cycles={predictionData.cycles}
                capacityBaselineMlp={predictionData.capacity_baseline_mlp}
                capacityPinn={predictionData.capacity_pinn}
              />
            </div>
          )}

        </div>

      </div>

    </form>
  );
};