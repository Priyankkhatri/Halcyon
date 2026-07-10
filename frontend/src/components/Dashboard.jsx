import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { api } from '../api';
import Card from './ui/Card';
import StatusPill from './ui/StatusPill';
import Waveform from './Waveform';
import { Button } from './ui/Button';

export default function Dashboard({ setGlobalState }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [samples, setSamples] = useState([]);
  const [showSimModal, setShowSimModal] = useState(false);

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
    fetchSamples();
  }, []);

  const handleSimulate = async (scenarioName) => {
    setShowSimModal(false);
    setSimulating(true);
    setGlobalState('chaotic');
    
    try {
      await api.loadSample(scenarioName);
      await fetchIncidents();
    } catch (err) {
      console.error(err);
      setGlobalState('calm');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-4">
      <div className="flex justify-between items-end mb-10 border-b border-border-light pb-6">
        <div>
          <h1 className="text-4xl font-serif text-text-primary tracking-wide mb-2">Incident Feed</h1>
          <p className="text-text-muted font-light text-sm">Live view of incoming alerts and resolutions.</p>
        </div>
        <Button
          onClick={() => setShowSimModal(true)}
          disabled={simulating}
          variant="primary"
        >
          {simulating ? 'Simulating...' : 'Simulate Incident'}
        </Button>
      </div>

      {showSimModal && (
        <div className="fixed inset-0 bg-[#0A0E1A]/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-none shadow-antigravity relative overflow-hidden bg-surface animate-in fade-in zoom-in-95 duration-200" animateHover={false}>
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-accent-warm" />
             <h3 className="font-serif text-3xl font-medium tracking-wide mb-3 text-text-primary">Simulate Active Incident</h3>
             <p className="text-sm text-text-muted font-light mb-8 leading-relaxed">Select a sample log scenario to inject into the system. Halcyon will analyze and resolve it in real-time.</p>
             <div className="space-y-3">
                {samples.map(s => (
                  <button 
                    key={s.name}
                    onClick={() => handleSimulate(s.name)}
                    className="w-full text-left p-4 rounded-2xl bg-background border border-border-light hover:border-primary/40 hover:shadow-sm transition-all font-mono text-sm font-medium text-text-primary group"
                  >
                    <span className="group-hover:text-primary transition-colors">{s.name}.log</span>
                  </button>
                ))}
                {samples.length === 0 && <p className="text-sm text-text-muted bg-background p-4 rounded-xl">No sample scenarios found.</p>}
             </div>
             <div className="mt-8 text-right">
                <button onClick={() => setShowSimModal(false)} className="text-sm font-semibold text-text-muted hover:text-text-primary transition-colors">Cancel</button>
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
            <p className="text-text-muted font-light text-lg">No incidents recorded yet.</p>
          </Card>
        ) : (
          incidents.map((inc) => (
            <Link key={inc.id} href={`/incident/${inc.id}`}>
              <a className="block group">
                <Card className="flex items-center justify-between cursor-pointer border border-border-light hover:border-accent-warm/30 transition-all p-6" animateHover={true}>
                  <div className="flex items-center gap-8">
                    {/* Saturated and larger medium size waveform per card */}
                    <div className="flex items-center justify-center bg-background border border-border-light/60 p-2.5 rounded-2xl w-44 h-16 shadow-inner relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
                      <Waveform state={inc.is_solved ? 'calm' : 'chaotic'} size="medium" />
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl text-text-primary mb-1.5 tracking-wide">{inc.title}</h3>
                      <div className="flex items-center gap-4 text-xs font-mono text-text-muted font-medium">
                        <span>ID: INC-{(inc.id).toString().padStart(4, '0')}</span>
                        <span>{new Date(inc.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {inc.is_solved ? (
                      <StatusPill status="memory-match" confidence={Math.round((inc.confidence_score || 0) * 100)} />
                    ) : (
                      <StatusPill status="escalated" />
                    )}
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
