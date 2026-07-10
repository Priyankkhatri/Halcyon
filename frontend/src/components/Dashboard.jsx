import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { api } from '../api';
import Card from './ui/Card';
import StatusPill from './ui/StatusPill';
import Waveform from './Waveform';
import { Button } from './ui/Button';
import { useApp } from '../context/AppContext';
import TrustMeter from './ui/TrustMeter';

export default function Dashboard({ setGlobalState }) {
  const { t, hasLimitReached, incrementLimit } = useApp();
  const [, setLocation] = useLocation();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [samples, setSamples] = useState([]);
  const [showSimModal, setShowSimModal] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [stats, setStats] = useState(null);

  const fetchIncidents = async () => {
    try {
      const data = await api.getHistory();
      const list = data.incidents || [];
      setIncidents(list);
      // Toggle global state to chaotic if any incident is unsolved
      const hasActive = list.some(inc => !inc.is_solved);
      setGlobalState(hasActive ? 'chaotic' : 'calm');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSamples = async () => {
    try {
      const data = await api.listSamples();
      setSamples(data.scenarios || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchStats();
    fetchSamples();
  }, []);

  const handleSimulate = async (scenarioName) => {
    if (hasLimitReached()) {
      setShowSimModal(false);
      setLocation('/billing');
      return;
    }

    setShowSimModal(false);
    setSimulating(true);
    setGlobalState('chaotic');
    
    try {
      await api.loadSample(scenarioName);
      incrementLimit();
      await fetchIncidents();
      await fetchStats();
    } catch (err) {
      console.error(err);
      setGlobalState('calm');
    } finally {
      setSimulating(false);
    }
  };

  const handleFileUpload = async (e) => {
    if (hasLimitReached()) {
      setShowSimModal(false);
      setLocation('/billing');
      return;
    }

    const file = e.target.files[0];
    if (!file) return;
    
    setShowSimModal(false);
    setSimulating(true);
    setGlobalState('chaotic');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const logContent = event.target.result;
      const alertTitle = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      
      try {
        await api.submitIncident({
          alert_title: alertTitle,
          log_content: logContent,
          sensitive: sensitive
        });
        incrementLimit();
        await fetchIncidents();
        await fetchStats();
      } catch (err) {
        console.error("Failed to submit custom log:", err);
        setGlobalState('calm');
      } finally {
        setSimulating(false);
      }
    };
    reader.onerror = () => {
      console.error("Error reading file");
      setSimulating(false);
      setGlobalState('calm');
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 sm:mb-10 border-b border-border-light pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-text-primary tracking-wide mb-2">{t('dashboard.feedTitle')}</h1>
          <p className="text-text-muted font-light text-sm">{t('dashboard.feedSub')}</p>
        </div>
        <Button
          onClick={() => setShowSimModal(true)}
          disabled={simulating}
          variant="primary"
          className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider font-bold"
        >
          {simulating ? t('dashboard.runningAnalysis') : t('dashboard.simulateBtn')}
        </Button>
      </div>

      {/* Dynamic Saving Rollup Banner */}
      {stats && stats.ai_decisions?.memory_hits > 0 && (
        <div className="mb-8 bg-gradient-to-r from-accent-warm/15 via-[#2EC4B6]/10 to-transparent border border-border-light p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2EC4B6] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2EC4B6]"></span>
            </span>
            <div>
              <h4 className="font-serif text-base text-text-primary font-bold">Halcyon Cognitive Performance</h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Cognitive auto-routing and Hindsight memory matching bypasses manual resolution stages.
              </p>
            </div>
          </div>
          <div className="flex gap-4 sm:gap-6 font-mono shrink-0">
            <div className="text-center sm:text-right border-r border-border-light pr-4 sm:pr-6">
              <span className="text-[9px] uppercase tracking-wider text-text-muted block">Total Saved</span>
              <span className="text-lg font-bold text-[#2EC4B6]">
                ${(stats.ai_decisions.memory_hits * 0.045).toFixed(2)}
              </span>
            </div>
            <div className="text-center sm:text-right">
              <span className="text-[9px] uppercase tracking-wider text-text-muted block">MTTR Bypassed</span>
              <span className="text-lg font-bold text-[#2EC4B6]">
                {stats.ai_decisions.memory_hits * 18 >= 60
                  ? `${((stats.ai_decisions.memory_hits * 18) / 60).toFixed(1)} hours`
                  : `${stats.ai_decisions.memory_hits * 18} mins`}
              </span>
            </div>
          </div>
        </div>
      )}

      {showSimModal && (
        <div className="fixed inset-0 bg-[#0A0E1A]/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-none shadow-antigravity relative overflow-hidden bg-surface animate-in fade-in zoom-in-95 duration-200" animateHover={false}>
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-accent-warm" />
             <h3 className="font-serif text-3xl font-medium tracking-wide mb-3 text-text-primary">{t('dashboard.simModalTitle')}</h3>
             <p className="text-sm text-text-muted font-light mb-6 leading-relaxed">{t('dashboard.simModalSub')}</p>
             <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {samples.map(s => (
                  <button 
                    key={s.name}
                    onClick={() => handleSimulate(s.name)}
                    className="w-full text-left p-3.5 rounded-2xl bg-background border border-border-light hover:border-primary/40 hover:shadow-sm transition-all font-mono text-sm font-medium text-text-primary group cursor-pointer"
                  >
                    <span className="group-hover:text-primary transition-colors">{s.name}.log</span>
                  </button>
                ))}
                {samples.length === 0 && <p className="text-sm text-text-muted bg-background p-4 rounded-xl">No sample scenarios found.</p>}
             </div>
             
             {/* Divider */}
             <div className="relative my-5">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                   <div className="w-full border-t border-border-light/60" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                   <span className="bg-surface px-3 text-text-muted">{t('dashboard.uploadBtn')}</span>
                </div>
             </div>

             {/* PII Proxy Toggle */}
             <div className="flex items-center gap-3.5 mb-4 px-1">
               <input
                 type="checkbox"
                 id="sensitive-toggle"
                 checked={sensitive}
                 onChange={(e) => setSensitive(e.target.checked)}
                 className="w-4 h-4 text-accent-warm bg-background border-border-light rounded focus:ring-accent-warm/40 focus:ring-offset-background cursor-pointer"
               />
               <label htmlFor="sensitive-toggle" className="font-mono text-xs text-text-muted cursor-pointer hover:text-text-primary select-none">
                 {t('dashboard.sensitiveToggle')}
               </label>
             </div>

             {/* File Upload Button / Input */}
             <div>
                <label className="flex flex-col items-center justify-center border border-dashed border-border-light hover:border-primary/50 rounded-2xl p-5 cursor-pointer hover:bg-background/20 transition-all group">
                   <svg className="w-6 h-6 text-text-muted group-hover:text-primary transition-colors mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                   </svg>
                   <span className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">Select .log / .txt file</span>
                   <span className="text-[10px] text-text-muted mt-0.5">Parsed and analyzed in real-time</span>
                   <input 
                      type="file" 
                      accept=".log,.txt,.out,.err" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                   />
                </label>
             </div>

             <div className="mt-6 text-right">
                <button onClick={() => setShowSimModal(false)} className="text-sm font-semibold text-text-muted hover:text-text-primary transition-colors cursor-pointer">{t('dashboard.close')}</button>
             </div>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
             {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-surface rounded-3xl border border-border-light" />
             ))}
          </div>
        ) : incidents.length === 0 ? (
          <Card className="text-center py-24 bg-surface/50 border-dashed" animateHover={false}>
            <p className="text-text-muted font-light text-lg">{t('dashboard.emptyState')}</p>
          </Card>
        ) : (
          incidents.map((inc) => (
            <Link key={inc.id} href={`/incident/${inc.id}`}>
              <a className="block group">
                <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between cursor-pointer border border-border-light hover:border-accent-warm/30 transition-all p-4 sm:p-6 gap-4 sm:gap-6" animateHover={true}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 w-full sm:w-auto">
                    {/* Saturated and larger medium size waveform per card */}
                    <div className="flex items-center justify-center bg-background border border-border-light/60 p-2.5 rounded-2xl w-full sm:w-44 h-16 shadow-inner relative overflow-hidden flex-shrink-0">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
                      <Waveform state={inc.is_solved ? 'calm' : 'chaotic'} size="medium" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-xl sm:text-2xl text-text-primary mb-1.5 tracking-wide truncate">{inc.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-text-muted font-medium">
                        <span>ID: INC-{(inc.id).toString().padStart(4, '0')}</span>
                        <span>•</span>
                        <span>{new Date(inc.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="self-end sm:self-auto flex-shrink-0 flex flex-col items-end gap-2.5">
                    {inc.is_solved ? (
                      <StatusPill status="memory-match" confidence={Math.round((inc.confidence_score || 0) * 100)} />
                    ) : (
                      <StatusPill status="escalated" />
                    )}
                    <TrustMeter
                      confidence={Math.round((inc.confidence_score || 0) * 100)}
                      matchCount={inc.similar_incidents?.length || 0}
                      state={(inc.similar_incidents?.length > 0) ? 'memory-match' : 'escalated'}
                    />
                  </div>
                </Card>
              </a>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
