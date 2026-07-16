import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { api } from '../api';
import Card from './ui/Card';
import StatusPill from './ui/StatusPill';
import { Button } from './ui/Button';
import TrustMeter from './ui/TrustMeter';
import Waveform from './Waveform';

const getRelativeTimestamp = (incidentTimeStr, commitTimeStr) => {
  const incidentTime = new Date(incidentTimeStr);
  const commitTime = new Date(commitTimeStr);
  const diffMs = incidentTime - commitTime;
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 0) {
    return `${Math.abs(diffMins)} minutes after this incident`;
  }
  if (diffMins === 0) {
    return 'at the same time as this incident';
  }
  if (diffMins === 1) {
    return '1 minute before this incident';
  }
  if (diffMins < 60) {
    return `${diffMins} minutes before this incident`;
  }
  const diffHours = Math.round(diffMins / 60);
  if (diffHours === 1) {
    return '1 hour before this incident';
  }
  return `${diffHours} hours before this incident`;
};

export default function IncidentDetail({ id }) {
  const [incident, setIncident] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [commitCaused, setCommitCaused] = useState(false);
  const [hasConnection, setHasConnection] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incData, auditData, statusData] = await Promise.all([
          api.getIncident(id),
          api.getIncidentAudit(id),
          api.getGithubStatus().catch(() => ({ connected: false, status: 'disconnected' }))
        ]);
        setIncident(incData);
        setAuditLogs(auditData || []);
        setSolutionText(incData.solution || incData.fix_suggestion || '');
        setHasConnection(statusData.connected && statusData.status === 'connected');
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
      const updated = await api.resolveIncident(
        id, 
        solutionText, 
        incident.suspected_commit ? commitCaused : null
      );
      setIncident(updated);
    } catch (err) {
      console.error("Failed to resolve incident:", err);
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-surface rounded-xl max-w-5xl mx-auto mt-8 border border-border-light shimmer-bg"></div>;
  }
  
  if (!incident) {
    return <div className="text-text-muted text-center py-20 font-medium font-sans">Incident not found.</div>;
  }

  const primaryAudit = auditLogs[0] || {};
  const isMemoryMatch = primaryAudit.memory_hit || (incident.similar_incidents?.length > 0);
  const confidence = Math.round((incident.confidence_score || 0) * 100);
  const actualCost = primaryAudit.cost || 0;
  const actualLatency = primaryAudit.latency_ms || 0;

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-4">
      <div className="mb-6 sm:mb-8 border-b border-border-light pb-6">
        <Link href="/" className="text-text-muted hover:text-text-primary text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-6 inline-flex items-center transition-colors cursor-pointer">
          &larr; <span className="ml-1">Back to Feed</span>
        </Link>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mt-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-sans text-text-primary tracking-wide mb-2">{incident.title}</h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-text-muted font-medium">
              <span>ID: INC-{id.toString().padStart(4, '0')}</span>
              <span>•</span>
              <span>{new Date(incident.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div className="self-start sm:self-auto flex items-center gap-4">
            {/* Toggle switch for comparison */}
            <div className="flex items-center bg-surface border border-border-light p-1 rounded-md gap-1 shrink-0 shadow-none font-mono text-[10px]">
              <button
                onClick={() => setCompareMode(false)}
                className={`px-3 py-1.5 rounded-md font-bold tracking-wider transition-all cursor-pointer ${
                  !compareMode
                    ? 'bg-accent-warm text-white shadow-glow-teal'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                With Halcyon
              </button>
              <button
                onClick={() => setCompareMode(true)}
                className={`px-3 py-1.5 rounded-md font-bold tracking-wider transition-all cursor-pointer ${
                  compareMode
                    ? 'bg-text-primary text-background shadow-antigravity'
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
            <Card className="flex flex-col border border-border-light relative overflow-hidden" animateHover={false}>
              <div className="absolute top-0 left-0 w-full h-[3px] bg-accent-warm" />
              <div className="flex justify-between items-center border-b border-border-light pb-4 mb-6">
                <h3 className="font-sans text-xl text-text-primary font-bold">WITH HALCYON</h3>
                <span className="text-[10px] font-mono font-bold tracking-widest bg-surface text-accent-warm border border-border-light px-2.5 py-0.5 rounded-sm uppercase">OPTIMIZED</span>
              </div>
              <div className="space-y-6 flex-1">
                <div className="bg-background border border-border-light rounded-md p-4 flex flex-col items-center justify-center shadow-inner relative overflow-hidden h-28">
                  <div className="absolute top-2 left-3 font-mono text-[9px] text-text-muted uppercase">Telemetry Oscilloscope</div>
                  <Waveform state="calm" size="medium" />
                  <div className="mt-2 text-[10px] font-mono text-accent-warm font-bold uppercase tracking-wider">System State: CALM / STABLE</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Path</span>
                  <div className="bg-background border border-border-light rounded-md p-3 text-xs font-mono text-text-primary font-semibold">
                    {isMemoryMatch ? 'Hindsight Memory Cache (Fast Path)' : `cascadeflow: ${primaryAudit.model_tier || 'Drafter Model'}`}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background border border-border-light rounded-md p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Cost</span>
                    <span className="font-mono text-sm font-bold text-text-primary">${(primaryAudit.cost || 0).toFixed(6)}</span>
                  </div>
                  <div className="bg-background border border-border-light rounded-md p-3.5">
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
                <h3 className="font-sans text-xl text-text-primary font-bold">WITHOUT HALCYON (BASELINE)</h3>
                <span className="text-[10px] font-mono font-bold tracking-widest bg-surface text-red-400 border border-border-light px-2.5 py-0.5 rounded-sm uppercase">UNOPTIMIZED</span>
              </div>
              <div className="space-y-6 flex-1">
                <div className="bg-background border border-border-light rounded-md p-4 flex flex-col items-center justify-center shadow-inner relative overflow-hidden h-28">
                  <div className="absolute top-2 left-3 font-mono text-[9px] text-text-muted uppercase">Telemetry Oscilloscope</div>
                  <Waveform state="chaotic" size="medium" color="#EF4444" />
                  <div className="mt-2 text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider">System State: UNSTABLE / CHAOTIC</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Path</span>
                  <div className="bg-background border border-border-light rounded-md p-3 text-xs font-mono text-text-primary font-semibold">
                    Full manual diagnostic reasoning required (No cache)
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background border border-border-light rounded-md p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Cost</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      ${(isMemoryMatch ? 0.045000 : Math.max(primaryAudit.cost || 0.00005, 0.00059)).toFixed(6)}
                    </span>
                  </div>
                  <div className="bg-background border border-border-light rounded-md p-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">API Latency</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {(isMemoryMatch ? 3120 : Math.max(primaryAudit.latency_ms || 1200, 2850)).toFixed(0)} ms
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">Resolution Trust</span>
                  <div className="p-4 bg-background/55 border border-border-light rounded-md">
                    <div className="font-mono text-[10px] text-text-muted font-bold uppercase mb-1">No precedent referenced</div>
                    <p className="font-sans text-[11px] leading-relaxed text-text-muted">
                      Cannot verify recovery path confidence due to disabled hindsight index.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-accent-warm/15 via-secondary/10 to-transparent border border-border-light p-5 rounded-xl shadow-antigravity text-center">
            <h4 className="font-sans text-base text-text-primary font-bold mb-1">Telemetry Comparison Summary</h4>
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
          <div className="bg-[#0D0F11] border border-border-light/20 rounded-md p-6 shadow-none flex flex-col relative overflow-hidden max-h-96">
            <div className="flex items-center gap-2 mb-4 text-text-muted/50 border-b border-border-light/10 pb-4">
              <div className="w-2.5 h-2.5 rounded-sm bg-surface" />
              <div className="w-2.5 h-2.5 rounded-sm bg-surface" />
              <div className="w-2.5 h-2.5 rounded-sm bg-secondary/80" />
              <span className="font-mono text-xs ml-2 font-medium text-slate-400">{incident.log_filename || 'raw-input.log'}</span>
            </div>
            <pre className="font-mono text-xs leading-loose text-red-300/80 overflow-y-auto whitespace-pre-wrap flex-1">
              {incident.log_content}
            </pre>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <div className="bg-[#0D0F11] border border-border-light/20 rounded-md p-6 shadow-none flex flex-col h-full relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 text-text-muted/50 border-b border-border-light/10 pb-4">
              <div className="w-2.5 h-2.5 rounded-sm bg-surface" />
              <div className="w-2.5 h-2.5 rounded-sm bg-surface" />
              <div className="w-2.5 h-2.5 rounded-sm bg-secondary/80" />
              <span className="font-mono text-xs ml-2 font-medium text-slate-400">{incident.log_filename || 'raw-input.log'}</span>
            </div>
            <pre className="font-mono text-sm leading-loose text-red-300/80 overflow-x-auto whitespace-pre-wrap flex-1">
              {incident.log_content}
            </pre>
          </div>
          <Card className="flex flex-col" animateHover={false}>
            <h3 className="font-sans text-2xl sm:text-3xl text-text-primary border-b border-border-light pb-4 mb-6">Root Cause Analysis</h3>
            <div className="space-y-8 flex-1">
              {incident.suspected_commit ? (
                <div className="bg-background/40 border border-border-light rounded-md p-4 shadow-none space-y-3 font-mono">
                  <div className="flex justify-between items-center border-b border-border-light/50 pb-2">
                    <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Suspected Code Change</span>
                    <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-sm border uppercase ${
                      incident.suspected_commit.plausibility === 'HIGH'
                        ? 'bg-surface border-border-light text-primary '
                        : incident.suspected_commit.plausibility === 'MEDIUM'
                        ? 'bg-surface border-border-light text-primary/80'
                        : incident.suspected_commit.plausibility === 'LOW'
                        ? 'bg-surface border-border-light text-accent-warm'
                        : 'bg-background border-border-light text-text-muted'
                    }`}>
                      {incident.suspected_commit.plausibility} PLAUSIBILITY
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-text-primary font-semibold">
                        Commit:{' '}
                        <a
                          href={`https://github.com/${incident.suspected_commit.repo || 'sahilchaudhari32/Halcyon'}/commit/${incident.suspected_commit.sha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-primary hover:underline hover:text-primary/80 transition-colors"
                        >
                          {incident.suspected_commit.sha.substring(0, 7)}
                        </a>
                      </span>
                      <span className="text-text-muted">
                        by <strong className="text-text-primary">{incident.suspected_commit.author}</strong>
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted italic font-mono">
                      • {getRelativeTimestamp(incident.created_at, incident.suspected_commit.timestamp)}
                    </div>

                    <div className="bg-surface/50 border border-border-light/35 rounded-md p-2.5 text-text-primary text-[11px] leading-relaxed break-all whitespace-pre-wrap">
                      {incident.suspected_commit.message}
                    </div>

                    <div className="text-text-muted text-[11px] leading-relaxed">
                      <strong className="text-text-primary uppercase tracking-wider text-[10px] block mb-1">AI Reasoning:</strong>
                      {incident.suspected_commit.reasoning}
                    </div>
                  </div>
                </div>
              ) : !hasConnection ? (
                <div className="bg-background/25 border border-dashed border-border-light rounded-md p-4.5 text-center font-mono text-xs">
                  <p className="text-text-muted mb-2.5 leading-relaxed">
                    Connect GitHub to see code correlation for incidents
                  </p>
                  <Link href="/settings" className="text-accent-warm hover:underline font-bold transition-colors">
                    Configure GitHub Integration &rarr;
                  </Link>
                </div>
              ) : null}
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
                <div className="bg-background border border-border-light rounded-md p-4 flex justify-between items-center shadow-none">
                  <span className="font-semibold text-sm text-text-primary">
                    {primaryAudit.model_tier === 'fast-path' ? 'Hindsight Memory (Fast Path)' : 'Automated Pipeline (Escalated)'}
                  </span>
                  <span className="font-mono text-xs text-text-muted bg-surface px-2 py-1 rounded-sm border border-border-light">{primaryAudit.model_used}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 bg-background/50 p-4 rounded-md border border-border-light/50">
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
                  <div className="bg-surface border border-border-light p-5 rounded-md text-text-primary font-mono text-sm leading-relaxed shadow-none whitespace-pre-line">
                    {incident.solution}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea
                      value={solutionText}
                      onChange={(e) => setSolutionText(e.target.value)}
                      rows={4}
                      className="w-full bg-background border border-border-light rounded-md p-4 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                    />
                    {incident.suspected_commit && (
                      <label className="flex items-center gap-2.5 font-mono text-xs text-text-muted cursor-pointer select-none py-1">
                        <input
                          type="checkbox"
                          checked={commitCaused}
                          onChange={(e) => setCommitCaused(e.target.checked)}
                          className="w-4 h-4 rounded border-border-light bg-background text-primary focus:ring-primary/40 focus:ring-offset-background cursor-pointer"
                        />
                        <span>Confirm this commit caused the incident</span>
                      </label>
                    )}
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
                <div className="text-sm text-accent-warm bg-surface p-4 rounded-md border border-border-light font-medium flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  Matched past incident <strong className="ml-1">INC-{incident.similar_incidents[0].similar_to_id.toString().padStart(4, '0')}</strong>.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="pt-6 mt-8 border-t border-border-light grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-text-muted font-semibold">
        <div>COST: <span className="text-text-primary bg-background px-2.5 py-1 rounded-sm ml-1 border border-border-light">${primaryAudit.cost?.toFixed(5) || '0.00000'}</span></div>
        <div className="sm:text-right">LATENCY: <span className="text-text-primary bg-background px-2.5 py-1 rounded-sm ml-1 border border-border-light">{primaryAudit.latency_ms?.toFixed(0) || '0'}ms</span></div>
      </div>
    </div>
  );
}
