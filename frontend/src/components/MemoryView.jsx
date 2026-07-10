import { useState, useEffect } from 'react';
import { api } from '../api';
import Card from './ui/Card';

export default function MemoryView() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const data = await api.getHistory('?is_solved=true');
        setMemories(data.incidents || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-surface rounded-3xl max-w-4xl mx-auto mt-8 border border-border-light shadow-antigravity"></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="mb-12 border-b border-border-light pb-6">
        <h1 className="text-4xl font-serif text-text-primary tracking-wide mb-2">Institutional Memory</h1>
        <p className="text-text-muted font-light text-sm">A map of past incident resolutions actively used by the agent.</p>
      </div>

      {memories.length === 0 ? (
        <Card className="text-center py-24 bg-surface/50 border-dashed" animateHover={false}>
          <p className="text-text-muted font-light text-lg">No memories stored yet.</p>
        </Card>
      ) : (
        <div className="relative border-l-2 border-border-light/60 ml-6 pl-10 space-y-12 pb-12">
          {memories.map((mem) => (
            <div key={mem.id} className="relative group">
              {/* Node connecting dot */}
              <div className="absolute -left-[51px] top-6 w-5 h-5 bg-background border-[4px] border-accent-warm rounded-full shadow-sm group-hover:scale-110 transition-transform" />
              
              <Card className="border-accent-warm/10" animateHover={true}>
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="font-serif text-2xl text-text-primary tracking-wide mb-1">{mem.title}</h3>
                    <p className="text-xs font-mono text-text-muted font-semibold">
                      ID: INC-{mem.id.toString().padStart(4, '0')} • Stored {new Date(mem.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="bg-accent-warm/10 border border-accent-warm/20 text-accent-warm px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider shadow-sm">
                    Stored Memory
                  </span>
                </div>
                
                <div className="bg-background/80 p-5 rounded-2xl border border-border-light font-mono text-sm text-text-primary mb-6 leading-relaxed shadow-sm">
                  {mem.solution || mem.fix_suggestion}
                </div>
                
                {/* Linked Future Incidents */}
                {mem.similar_incidents && mem.similar_incidents.length > 0 && (
                  <div className="border-t border-border-light pt-5 mt-5">
                    <p className="text-xs uppercase tracking-widest text-text-muted font-mono font-bold mb-3">Used to solve:</p>
                    <div className="flex gap-3 flex-wrap">
                      {mem.similar_incidents.map((sim, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-background border border-border-light rounded-xl text-xs font-mono font-semibold text-text-primary shadow-sm hover:border-accent-warm/40 transition-colors cursor-default">
                          INC-{sim.similar_to_id.toString().padStart(4, '0')} <span className="text-accent-warm ml-1">({Math.round(sim.similarity_score * 100)}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
