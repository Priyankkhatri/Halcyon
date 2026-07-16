import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { api } from '../api';
import Card from './ui/Card';
import StatusPill from './ui/StatusPill';
import Waveform from './Waveform';
import { Button } from './ui/Button';
import { useApp } from '../context/AppContext';
import TrustMeter from './ui/TrustMeter';
import { Cpu, DollarSign, AlertTriangle, ShieldCheck } from 'lucide-react';

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

    const interval = setInterval(() => {
      fetchIncidents();
      fetchStats();
    }, 8000);

    return () => clearInterval(interval);
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

  const handleResetDb = async () => {
    if (!window.confirm("Are you sure you want to clear all incidents and reset the database?")) return;
    try {
      setLoading(true);
      await api.resetDatabase();
      await fetchIncidents();
      await fetchStats();
    } catch (err) {
      console.error("Failed to reset database:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 sm:mb-10 border-b border-border-light pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-sans text-text-primary tracking-wide mb-2">{t('dashboard.feedTitle')}</h1>
          <p className="text-text-muted font-light text-sm">{t('dashboard.feedSub')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={handleResetDb}
            variant="secondary"
            className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider font-bold border border-border-light hover:bg-surface/50 text-text-muted hover:text-text-primary"
          >
            Reset Database
          </Button>
          <Button
            onClick={() => setShowSimModal(true)}
            disabled={simulating}
            variant="accent"
            className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider font-bold"
          >
            {simulating ? t('dashboard.runningAnalysis') : t('dashboard.simulateBtn')}
          </Button>
        </div>
      </div>

      {/* NOC Telemetry Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Card 1: Active Incidents */}
          <Card className="flex flex-col p-5 border border-border-light" animateHover={false}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-text-muted">Active Incidents</span>
              <AlertTriangle className={`w-4 h-4 ${stats.open_incidents > 0 ? 'text-primary' : 'text-text-muted'}`} />
            </div>
            <h2 className="text-3xl font-sans text-text-primary font-bold tracking-tight mb-1">
              {stats.open_incidents}
            </h2>
            <span className="text-[11px] font-sans text-text-muted uppercase">
              {stats.solved_incidents} of {stats.total_incidents} resolved
            </span>
          </Card>

          {/* Card 2: Resolution Rate */}
          <Card className="flex flex-col p-5 border border-border-light" animateHover={false}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-text-muted">Resolution Rate</span>
              <ShieldCheck className="w-4 h-4 text-text-muted" />
            </div>
            <h2 className="text-3xl font-sans text-text-primary font-bold tracking-tight mb-1">
              {stats.resolution_rate}%
            </h2>
            <span className="text-[11px] font-sans text-text-muted uppercase">Incidents auto-resolved</span>
          </Card>

          {/* Card 3: Memory Hit Rate */}
          <Card className="flex flex-col p-5 border border-border-light" animateHover={false}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-text-muted">Known Issues Matched</span>
              <Cpu className="w-4 h-4 text-text-muted" />
            </div>
            <h2 className="text-3xl font-sans text-text-primary font-bold tracking-tight mb-1">
              {stats.ai_decisions?.memory_hit_rate || '0.0'}%
            </h2>
            <span className="text-[11px] font-sans text-text-muted uppercase">
              {stats.ai_decisions?.memory_hits || 0} historical incident matches
            </span>
          </Card>

          {/* Card 4: Compute Savings */}
          <Card className="flex flex-col p-5 border border-border-light" animateHover={false}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-text-muted">Resolution Cost Saved</span>
              <DollarSign className="w-4 h-4 text-text-muted" />
            </div>
            <h2 className="text-3xl font-sans text-text-primary font-bold tracking-tight mb-1">
              ${((stats.ai_decisions?.memory_hits || 0) * 0.045).toFixed(2)}
            </h2>
            <span className="text-[11px] font-sans text-text-muted uppercase">
              {stats.ai_decisions?.memory_hits * 18 >= 60
                ? `${((stats.ai_decisions.memory_hits * 18) / 60).toFixed(1)} hours MTTR saved`
                : `${(stats.ai_decisions?.memory_hits || 0) * 18} mins MTTR saved`}
            </span>
          </Card>
        </div>
      )}

      {showSimModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border border-border-light shadow-antigravity-hover relative overflow-hidden bg-surface animate-in fade-in zoom-in-95 duration-200" animateHover={false}>
             <div className="accent-strip-bar rounded-t-xl" />
             <h3 className="font-sans text-3xl font-medium tracking-wide mb-3 text-text-primary">{t('dashboard.simModalTitle')}</h3>
             <p className="text-sm text-text-muted font-light mb-6 leading-relaxed">{t('dashboard.simModalSub')}</p>
             <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {samples.map(s => (
                  <button 
                    key={s.name}
                    onClick={() => handleSimulate(s.name)}
                    className="w-full text-left p-3.5 rounded-md bg-background border border-border-light hover:border-border-light hover:bg-border-light/10 transition-all font-mono text-sm font-medium text-text-primary group cursor-pointer"
                  >
                    <span className="group-hover:text-primary transition-colors">{s.name}.log</span>
                  </button>
                ))}
                {samples.length === 0 && <p className="text-sm text-text-muted bg-background p-4 rounded-md">No sample scenarios found.</p>}
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
                <label className="flex flex-col items-center justify-center border border-dashed border-border-light hover:border-border-light rounded-md p-5 cursor-pointer hover:bg-background/20 transition-all group">
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
          <div className="space-y-4">
             {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-surface rounded-xl border border-border-light shimmer-bg" />
             ))}
          </div>
        ) : incidents.length === 0 ? (
          <Card className="text-center py-24 bg-surface/50 border-dashed" animateHover={false}>
            <p className="text-text-muted font-light text-lg">{t('dashboard.emptyState')}</p>
          </Card>
        ) : (
          incidents.map((inc) => (
            <Link key={inc.id} href={`/incident/${inc.id}`} className="block group">
              <Card className={`flex flex-col sm:flex-row sm:items-center sm:justify-between cursor-pointer border transition-all p-4 sm:p-6 gap-4 sm:gap-6 ${inc.is_solved ? 'border-border-light hover:border-accent-warm/50' : 'border-border-light hover:border-primary/50'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 w-full sm:flex-1 sm:min-w-0">
                  {/* Saturated and larger medium size waveform per card */}
                  <div className="flex items-center justify-center bg-background border border-border-light/60 p-2.5 rounded-md w-full sm:w-44 h-16 shadow-inner relative overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
                    <Waveform state={inc.is_solved ? 'calm' : 'chaotic'} size="medium" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-sans text-xl sm:text-2xl text-text-primary mb-1.5 tracking-wide truncate">{inc.title}</h3>
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
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
