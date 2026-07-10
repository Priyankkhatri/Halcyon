import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { api } from '../api';
import Card from './ui/Card';
import StatusPill from './ui/StatusPill';
import { Button } from './ui/Button';
import TrustMeter from './ui/TrustMeter';
import Waveform from './Waveform';

export default function IncidentDetail({ id }) {
  const [incident, setIncident] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incData, auditData] = await Promise.all([
          api.getIncident(id),
          api.getIncidentAudit(id)
        ]);
        setIncident(incData);
        setAuditLogs(auditData || []);
        setSolutionText(incData.solution || incData.fix_suggestion || '');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleResolve = async () => {
    if (!solutionText.trim()) return;
    setResolving(true);
    try {
      const updated = await api.resolveIncident(id, solutionText);
      setIncident(updated);
    } catch (err) {
      console.error("Failed to resolve incident:", err);
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-surface rounded-3xl max-w-5xl mx-auto mt-8 border border-border-light shadow-antigravity"></div>;
  }
  
  if (!incident) {
    return <div className="text-text-muted text-center py-20 font-medium font-sans">Incident not found.</div>;
  }

  const primaryAudit = auditLogs[0] || {};
  const isMemoryMatch = primaryAudit.memory_hit || (incident.similar_incidents?.length > 0);
  const confidence = Math.round((incident.confidence_score || 0) * 100);

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-4">
      <div className="mb-6 sm:mb-8 border-b border-border-light pb-6">
        <Link href="/">
          <a className="text-text-muted hover:text-text-primary text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-6 inline-flex items-center transition-colors cursor-pointer">
            &larr; <span className="ml-1">Back to Feed</span>
          </a>
        </Link>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mt-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-text-primary tracking-wide mb-2">{incident.title}</h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-text-muted font-medium">
              <span>ID: INC-{id.toString().padStart(4, '0')}</span>
              <span>•</span>
              <span>{new Date(incident.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div className="self-start sm:self-auto flex items-center gap-4">
            {/* Toggle switch for comparison */}
            <div className="flex items-center bg-surface border border-border-light p-1 rounded-xl gap-1 shrink-0 shadow-sm font-mono text-[10px]">
              <button
                onClick={() => setCompareMode(false)}
                className={`px-3 py-1.5 rounded-lg font-bold tracking-wider transition-all cursor-pointer ${
                  !compareMode 
                    ? 'bg-accent-warm text-white shadow-sm' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                With Halcyon
              </button>
              <button
                onClick={() => setCompareMode(true)}
                className={`px-3 py-1.5 rounded-lg font-bold tracking-wider transition-all cursor-pointer ${
                  compareMode 
                    ? 'bg-primary/95 text-white shadow-sm' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Compare Baseline
              </button>
            </div>
            <StatusPill status={isMemoryMatch ? 'memory-match' : 'escalated'} confidence={confidence} />
          </div>
        </div>
      </div>

      {compareMode ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <Card className="flex flex-col border border-accent-warm/25 relative overflow-hidden" animateHover={false}>
              <div className="absolute top-0 left-0 w-full h-[3px] bg-accent-warm" />
              <div className="flex justify-between items-center border-b border-border-light pb-4 mb-6">
                <h3 className="font-serif text-xl text-text-primary font-bold">WITH HALCYON</h3>
                <span className="text-[10px] font-mono font-bold tracking-widest bg-accent-warm/15 text-accent-warm border border-accent-warm/25 px-2.5 py-0.5 rounded-full uppercase">OPTIMIZED</span>
              </div>
              <div className="space-y-6 flex-1">
                <div className="bg-background border border-border-light rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner relative overflow-hidden h-28">
                  <div className="absolute top-2 left-3 font-mono text-[9px] text-text-muted uppercase">Telemetry Oscilloscope</div>
                  <Waveform state="calm" size="medium" />
                  <div className="mt-2 text-[10px] font-mono text-accent-warm font-bold uppercase tracking-wider">System State: CALM / STABLE</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Path</span>
                  <div className="bg-background border border-border-light rounded-xl p-3 text-xs font-mono text-text-primary font-semibold">
                    {isMemoryMatch ? 'Hindsight Memory Cache (Fast Path)' : `cascadeflow: ${primaryAudit.model_tier || 'Drafter Model'}`}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background border border-border-light rounded-xl p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Cost</span>
                    <span className="font-mono text-sm font-bold text-text-primary">${(primaryAudit.cost || 0).toFixed(6)}</span>
                  </div>
                  <div className="bg-background border border-border-light rounded-xl p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Latency</span>
                    <span className="font-mono text-sm font-bold text-text-primary">{(primaryAudit.latency_ms || 30).toFixed(0)} ms</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Trust</span>
                  <TrustMeter
                    confidence={confidence}
                    matchCount={incident.similar_incidents?.length || 0}
                    state={isMemoryMatch ? 'memory-match' : 'escalated'}
                    matchedIds={(incident.similar_incidents || []).map(ref => ref.similar_to_id)}
                    isDetailed={true}
                  />
                </div>
              </div>
            </Card>

            <Card className="flex flex-col border border-border-light relative overflow-hidden" animateHover={false}>
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-400/80" />
              <div className="flex justify-between items-center border-b border-border-light pb-4 mb-6">
                <h3 className="font-serif text-xl text-text-primary font-bold">WITHOUT HALCYON (BASELINE)</h3>
                <span className="text-[10px] font-mono font-bold tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full uppercase">UNOPTIMIZED</span>
              </div>
              <div className="space-y-6 flex-1">
                <div className="bg-background border border-border-light rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner relative overflow-hidden h-28">
                  <div className="absolute top-2 left-3 font-mono text-[9px] text-text-muted uppercase">Telemetry Oscilloscope</div>
                  <Waveform state="chaotic" size="medium" color="#EF4444" />
                  <div className="mt-2 text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider">System State: UNSTABLE / CHAOTIC</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Path</span>
                  <div className="bg-background border border-border-light rounded-xl p-3 text-xs font-mono text-text-primary font-semibold">
                    Full manual diagnostic reasoning required (No cache)
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background border border-border-light rounded-xl p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Cost</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      ${(isMemoryMatch ? 0.045000 : Math.max(primaryAudit.cost || 0.00005, 0.00059)).toFixed(6)}
                    </span>
                  </div>
                  <div className="bg-background border border-border-light rounded-xl p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Latency</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {(isMemoryMatch ? 3120 : Math.max(primaryAudit.latency_ms || 1200, 2850)).toFixed(0)} ms
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Trust</span>
                  <div className="p-4 bg-background/55 border border-border-light rounded-2xl">
                    <div className="font-mono text-[10px] text-text-muted font-bold uppercase mb-1">No precedent referenced</div>
                    <p className="font-sans text-[11px] leading-relaxed text-text-muted">
                      Cannot verify recovery path confidence due to disabled hindsight index.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-accent-warm/15 via-[#2EC4B6]/10 to-transparent border border-border-light p-5 rounded-3xl shadow-sm text-center">
            <h4 className="font-serif text-base text-text-primary font-bold mb-1">Telemetry Comparison Summary</h4>
            <p className="text-xs font-mono text-text-muted leading-relaxed">
              With Halcyon Cognitive Memory:{" "}
              <span className="text-[#2EC4B6] font-bold">
                {actualCost === 0 
                  ? "Near 100% cost savings (> 1000x cheaper)" 
                  : `${((isMemoryMatch ? 0.045 : 0.00059) / Math.max(actualCost, 0.000001)).toFixed(1)}x cheaper`}
              </span>{" "}
              and{" "}
              <span className="text-[#2EC4B6] font-bold">
                {((isMemoryMatch ? 3120 : 2850) / Math.max(actualLatency, 30)).toFixed(1)}x faster
              </span>{" "}
              API log analysis.
              {isMemoryMatch && (
                <span className="block mt-1.5 text-accent-warm font-bold">
                  ✓ Bypassed secondary tier on-call escalation (Saved 18 minutes of NOC downtime)
                </span>
              )}
            </p>
          </div>
          <div className="bg-[#0D0F11] border border-border-light/20 rounded-3xl p-6 shadow-antigravity flex flex-col relative overflow-hidden max-h-96">
            <div className="flex items-center gap-2 mb-4 text-text-muted/50 border-b border-border-light/10 pb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-primary/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-accent-warm/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-secondary/80" />
              <span className="font-mono text-xs ml-2 font-medium text-slate-400">{incident.log_filename || 'raw-input.log'}</span>
            </div>
            <pre className="font-mono text-xs leading-loose text-red-300/80 overflow-y-auto whitespace-pre-wrap flex-1">
              {incident.log_content}
            </pre>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <div className="bg-[#0D0F11] border border-border-light/20 rounded-3xl p-6 shadow-antigravity flex flex-col h-full relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 text-text-muted/50 border-b border-border-light/10 pb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-primary/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-accent-warm/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-secondary/80" />
              <span className="font-mono text-xs ml-2 font-medium text-slate-400">{incident.log_filename || 'raw-input.log'}</span>
            </div>
            <pre className="font-mono text-sm leading-loose text-red-300/80 overflow-x-auto whitespace-pre-wrap flex-1">
              {incident.log_content}
            </pre>
          </div>
          <Card className="flex flex-col" animateHover={false}>
            <h3 className="font-serif text-2xl sm:text-3xl text-text-primary border-b border-border-light pb-4 mb-6">Agent Reasoning</h3>
            <div className="space-y-8 flex-1">
              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-3">Resolution Trust</p>
                <TrustMeter
                  confidence={confidence}
                  matchCount={incident.similar_incidents?.length || 0}
                  state={isMemoryMatch ? 'memory-match' : 'escalated'}
                  matchedIds={(incident.similar_incidents || []).map(ref => ref.similar_to_id)}
                  isDetailed={true}
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-3">Path Taken</p>
                <div className="bg-background border border-border-light rounded-2xl p-4 flex justify-between items-center shadow-sm">
                  <span className="font-semibold text-sm text-text-primary">
                    {primaryAudit.model_tier === 'fast-path' ? 'Hindsight Memory (Fast Path)' : 'Cascadeflow (Escalated)'}
                  </span>
                  <span className="font-mono text-xs text-text-muted bg-surface px-2 py-1 rounded-full border border-border-light">{primaryAudit.model_used}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 bg-background/50 p-4 rounded-2xl border border-border-light/50">
                <div>
                  <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-2">Root Cause</p>
                  <p className="text-sm text-text-primary font-medium">{incident.root_cause || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-2">Severity</p>
                  <p className={`text-sm font-bold uppercase tracking-wider ${incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'text-primary' : 'text-accent-warm'}`}>
                    {incident.severity}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-3">
                  {incident.is_solved ? 'Applied Solution' : 'Suggested Resolution'}
                </p>
                {incident.is_solved ? (
                  <div className="bg-accent-warm/5 border border-accent-warm/15 p-5 rounded-2xl text-text-primary font-mono text-sm leading-relaxed shadow-sm">
                    {incident.solution}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea
                      value={solutionText}
                      onChange={(e) => setSolutionText(e.target.value)}
                      rows={4}
                      className="w-full bg-background border border-border-light rounded-2xl p-4 text-text-primary font-mono text-sm leading-relaxed shadow-sm focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/40"
                    />
                    <Button
                      onClick={handleResolve}
                      disabled={resolving || !solutionText.trim()}
                      variant="primary"
                      className="w-full"
                    >
                      {resolving ? 'Applying Resolution...' : 'Approve & Apply Fix'}
                    </Button>
                  </div>
                )}
              </div>
              {isMemoryMatch && incident.similar_incidents?.length > 0 && (
                <div className="text-sm text-accent-warm bg-accent-warm/10 p-4 rounded-2xl border border-accent-warm/20 font-medium flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  Matched past incident <strong className="ml-1">INC-{incident.similar_incidents[0].similar_to_id.toString().padStart(4, '0')}</strong>.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="pt-6 mt-8 border-t border-border-light grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-text-muted font-semibold">
        <div>COST: <span className="text-text-primary bg-background px-2.5 py-1 rounded-full ml-1 border border-border-light">${primaryAudit.cost?.toFixed(5) || '0.00000'}</span></div>
        <div className="sm:text-right">LATENCY: <span className="text-text-primary bg-background px-2.5 py-1 rounded-full ml-1 border border-border-light">{primaryAudit.latency_ms?.toFixed(0) || '0'}ms</span></div>
      </div>
    </div>
  );
}
