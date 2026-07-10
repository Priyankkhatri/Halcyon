import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { api } from '../api';
import Card from './ui/Card';
import StatusPill from './ui/StatusPill';
import { Button } from './ui/Button';

export default function IncidentDetail({ id }) {
  const [incident, setIncident] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [solutionText, setSolutionText] = useState('');

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
    <div className="max-w-5xl mx-auto py-4">
      <div className="mb-8 border-b border-border-light pb-6">
        <Link href="/">
          <a className="text-text-muted hover:text-text-primary text-xs font-semibold uppercase tracking-widest mb-6 inline-flex items-center transition-colors">
            &larr; <span className="ml-1">Back to Feed</span>
          </a>
        </Link>
        <div className="flex justify-between items-start mt-2">
          <div>
            <h1 className="text-4xl font-serif text-text-primary tracking-wide mb-2">{incident.title}</h1>
            <div className="flex items-center gap-4 text-xs font-mono text-text-muted font-medium">
              <span>ID: INC-{id.toString().padStart(4, '0')}</span>
              <span>{new Date(incident.created_at).toLocaleString()}</span>
            </div>
          </div>
          <StatusPill status={isMemoryMatch ? 'memory-match' : 'escalated'} confidence={confidence} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Raw Log Output (Dark Terminal for contrast) */}
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

        {/* Agent Reasoning */}
        <Card className="flex flex-col" animateHover={false}>
          <h3 className="font-serif text-3xl text-text-primary border-b border-border-light pb-4 mb-6">Agent Reasoning</h3>
          
          <div className="space-y-8 flex-1">
            {/* Path Taken */}
            <div>
              <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-3">Path Taken</p>
              <div className="bg-background border border-border-light rounded-2xl p-4 flex justify-between items-center shadow-sm">
                <span className="font-semibold text-sm text-text-primary">
                  {primaryAudit.model_tier === 'fast-path' ? 'Hindsight Memory (Fast Path)' : 'Cascadeflow (Escalated)'}
                </span>
                <span className="font-mono text-xs text-text-muted bg-surface px-2 py-1 rounded-full border border-border-light">{primaryAudit.model_used}</span>
              </div>
            </div>

            {/* Diagnostics */}
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

            {/* Suggested Resolution / Solution */}
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
            
            {/* Memory Link */}
            {isMemoryMatch && incident.similar_incidents?.length > 0 && (
              <div className="text-sm text-accent-warm bg-accent-warm/10 p-4 rounded-2xl border border-accent-warm/20 font-medium flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                Matched past incident <strong className="ml-1">INC-{incident.similar_incidents[0].similar_to_id.toString().padStart(4, '0')}</strong>.
              </div>
            )}
          </div>
          
          {/* Metrics Footer */}
          <div className="pt-6 mt-8 border-t border-border-light grid grid-cols-2 text-xs font-mono text-text-muted font-semibold">
             <div>COST: <span className="text-text-primary bg-background px-2.5 py-1 rounded-full ml-1 border border-border-light">${primaryAudit.cost?.toFixed(5) || '0.00000'}</span></div>
             <div className="text-right">LATENCY: <span className="text-text-primary bg-background px-2.5 py-1 rounded-full ml-1 border border-border-light">{primaryAudit.latency_ms?.toFixed(0) || '0'}ms</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
