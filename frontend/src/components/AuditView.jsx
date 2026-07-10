import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api';
import Card from './ui/Card';

const COLORS = {
  memory: '#8CA596',     // Sage Green (Afterlife accent-warm)
  escalated: '#E29A76',  // Apricot (Afterlife primary)
  neutral: '#A6B4C4'     // Dusty Blue (Afterlife secondary)
};

export default function AuditView() {
  const [stats, setStats] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statData, decisionData] = await Promise.all([
          api.getStats(),
          api.getDecisions('?page_size=100')
        ]);
        setStats(statData);
        setDecisions(decisionData.decisions?.reverse() || []); 
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = useMemo(() => {
    return decisions.map((d) => ({
      name: `INC-${d.incident_id}`,
      cost: d.cost,
      latency: d.latency_ms
    }));
  }, [decisions]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Memory Match', value: stats.ai_decisions?.memory_hits || 0, color: COLORS.memory },
      { name: 'Escalated (Novel)', value: stats.ai_decisions?.escalations || 0, color: COLORS.escalated },
      { name: 'Direct/Other', value: (stats.ai_decisions?.total_decisions || 0) - ((stats.ai_decisions?.memory_hits || 0) + (stats.ai_decisions?.escalations || 0)), color: COLORS.neutral }
    ].filter(d => d.value > 0);
  }, [stats]);

  if (loading) {
    return <div className="animate-pulse h-64 bg-surface rounded-3xl max-w-5xl mx-auto mt-8 border border-border-light shadow-antigravity"></div>;
  }

  return (
    <div className="max-w-5xl mx-auto py-4">
      <div className="mb-10 border-b border-border-light pb-6">
        <h1 className="text-4xl font-serif text-text-primary tracking-wide mb-2">Audit & Cost Trail</h1>
        <p className="text-text-muted font-light text-sm">Proving institutional memory reduces cost and latency over time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Cost Chart */}
        <Card className="lg:col-span-2 flex flex-col" animateHover={false}>
          <h3 className="font-serif text-2xl text-text-primary tracking-wide mb-8">Cost Per Incident (Trend)</h3>
          <div className="flex-1 min-h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.memory} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={COLORS.memory} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickMargin={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toFixed(4)}`} tickMargin={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-light)', color: 'var(--text-primary)', fontFamily: 'monospace', borderRadius: '16px', boxShadow: 'var(--shadow-val-antigravity)' }}
                    itemStyle={{ color: COLORS.memory, fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="cost" stroke={COLORS.memory} strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted font-medium">No data available</div>
            )}
          </div>
        </Card>

        {/* Resolution Breakdown */}
        <Card className="flex flex-col animateHover" animateHover={true}>
          <h3 className="font-serif text-2xl text-text-primary tracking-wide mb-4">Resolution Path</h3>
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-light)', fontFamily: 'monospace', borderRadius: '16px', boxShadow: 'var(--shadow-val-antigravity)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-text-muted font-medium">No data</div>
            )}
          </div>
          <div className="space-y-3 mt-6 bg-background/50 p-4 rounded-2xl border border-border-light">
            {pieData.map(d => (
              <div key={d.name} className="flex justify-between items-center text-sm font-mono font-medium">
                <span className="flex items-center gap-3"><div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: d.color }}></div> {d.name}</span>
                <span className="text-text-primary font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Dense Audit Log */}
      <Card className="overflow-hidden p-0 shadow-antigravity" animateHover={false}>
        <div className="p-6 border-b border-border-light bg-background/20">
          <h3 className="font-serif text-2xl text-text-primary tracking-wide">Decision Audit Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 border-b border-border-light text-xs uppercase tracking-widest text-text-muted font-mono font-bold">
                <th className="p-5 font-bold">Timestamp</th>
                <th className="p-5 font-bold">Incident</th>
                <th className="p-5 font-bold">Model</th>
                <th className="p-5 font-bold">Tier</th>
                <th className="p-5 font-bold">Cost</th>
                <th className="p-5 font-bold">Latency</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono font-medium">
              {decisions.slice().reverse().map((log) => (
                <tr key={log.id} className="border-b border-border-light/50 hover:bg-background/30 transition-colors group">
                  <td className="p-5 text-text-muted group-hover:text-text-primary transition-colors">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-5 text-text-primary font-bold">INC-{log.incident_id?.toString().padStart(4, '0') || '----'}</td>
                  <td className="p-5 text-text-muted">{log.model_used}</td>
                  <td className="p-5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm border ${log.model_tier === 'fast-path' ? 'bg-accent-warm/10 text-accent-warm border-accent-warm/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                      {log.model_tier}
                    </span>
                  </td>
                  <td className="p-5 text-text-primary bg-background/10">${log.cost.toFixed(5)}</td>
                  <td className="p-5 text-text-primary bg-background/10">{log.latency_ms.toFixed(0)}ms</td>
                </tr>
              ))}
              {decisions.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-text-muted font-sans text-lg">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
