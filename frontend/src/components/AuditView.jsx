import { useState, useEffect, useMemo, Fragment } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Cpu,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react';
import { api } from '../api';

const COLORS = {
  memory: '#2EC4B6',
  escalated: '#E8935B',
  neutral: 'var(--border-strong)'
};

export default function AuditView() {
  const [stats, setStats] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState('cost'); // 'cost' | 'latency'
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

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
      latency: d.latency_ms,
      tier: d.model_tier === 'fast-path' ? 'Fast' : 'Escalated'
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

  const memoryHitsCount = stats?.ai_decisions?.memory_hits || 0;
  
  const downtimeBypassedMins = memoryHitsCount * 18;
  const downtimeSavedText = downtimeBypassedMins >= 60 
    ? `${(downtimeBypassedMins / 60).toFixed(1)} hrs`
    : `${downtimeBypassedMins} mins`;

  const estimatedSavingsDollars = memoryHitsCount * 0.045;

  const toggleRow = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="h-96 bg-surface border border-border-light rounded-xl max-w-5xl mx-auto mt-8 shimmer-bg"></div>;
  }

  const tableDecisions = [...decisions].reverse();

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-6 text-text-primary font-sans">
      
      {/* Page Header */}
      <div className="mb-10 pb-6 border-b border-border-light">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Audit & Cost Trail
        </h1>
        <p className="text-text-muted text-base max-w-3xl">
          Live telemetry verifying how local historical database optimizes incident MTTR and inference expenses.
          Follow the action logs below to audit automated routing.
        </p>
      </div>

      {/* Analytics Cards Grid */}
      <h2 className="text-xl font-semibold tracking-tight mb-4">Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        
        {/* Cumulative cost */}
        <div className="flex flex-col p-5 border border-border-light rounded-xl bg-surface shadow-antigravity hover:shadow-antigravity-hover transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-text-muted">API Cost Incurred</span>
            <DollarSign className="w-4 h-4 text-text-muted" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">
            ${stats?.ai_decisions?.total_cost?.toFixed(5) || '0.00000'}
          </h2>
          <span className="text-xs text-text-muted">Cumulative Fees</span>
        </div>

        {/* Cost saved */}
        <div className="flex flex-col p-5 border border-border-light rounded-xl bg-surface shadow-antigravity hover:shadow-antigravity-hover transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-text-muted">Estimated Savings</span>
            <TrendingUp className="w-4 h-4 text-text-muted" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">
            +${estimatedSavingsDollars.toFixed(3)}
          </h2>
          <span className="text-xs text-text-muted">Bypassed LLM Calls</span>
        </div>

        {/* Downtime Bypassed */}
        <div className="flex flex-col p-5 border border-border-light rounded-xl bg-surface shadow-antigravity hover:shadow-antigravity-hover transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-text-muted">MTTR Saved</span>
            <Clock className="w-4 h-4 text-text-muted" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">
            {downtimeSavedText}
          </h2>
          <span className="text-xs text-text-muted">On-Call Time Bypassed</span>
        </div>

        {/* Hit Rate */}
        <div className="flex flex-col p-5 border border-border-light rounded-xl bg-surface shadow-antigravity hover:shadow-antigravity-hover transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-text-muted">Memory Hit Rate</span>
            <Cpu className="w-4 h-4 text-text-muted" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">
            {stats?.ai_decisions?.memory_hit_rate || '0.0'}%
          </h2>
          <span className="text-xs text-text-muted">Fast Path Resolution</span>
        </div>
      </div>

      {/* Main Charts Row */}
      <h2 className="text-xl font-semibold tracking-tight mb-4">Telemetry Metrics</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 flex flex-col p-6 border border-border-light rounded-xl bg-surface shadow-antigravity">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h3 className="font-semibold text-lg text-text-primary tracking-tight">
              {chartMetric === 'cost' ? 'Inference Cost Trend' : 'Resolution Latency Trend'}
            </h3>
            {/* Chart Tab Toggles */}
            <div className="flex bg-background border border-border-light p-1 rounded-md text-xs font-medium">
              <button 
                onClick={() => setChartMetric('cost')}
                className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${chartMetric === 'cost' ? 'bg-text-primary text-surface shadow-none' : 'text-text-muted hover:text-text-primary font-medium'}`}
              >
                Cost
              </button>
              <button 
                onClick={() => setChartMetric('latency')}
                className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${chartMetric === 'latency' ? 'bg-text-primary text-surface shadow-none' : 'text-text-muted hover:text-text-primary font-medium'}`}
              >
                Latency
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.memory} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={COLORS.memory} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickMargin={12} />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => chartMetric === 'cost' ? `$${val.toFixed(4)}` : `${val.toFixed(0)}ms`} 
                    tickMargin={12} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-light)', color: 'var(--text-primary)', borderRadius: '6px' }}
                    itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }}
                    formatter={(value) => chartMetric === 'cost' ? [`$${value.toFixed(5)}`, 'Cost'] : [`${value.toFixed(0)} ms`, 'Latency']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartMetric === 'cost' ? 'cost' : 'latency'} 
                    stroke={COLORS.memory} 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorCost)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">No telemetry data recorded yet.</div>
            )}
          </div>
        </div>

        {/* Resolution Path Pie Chart */}
        <div className="flex flex-col p-6 border border-border-light rounded-xl bg-surface shadow-antigravity">
          <h3 className="font-semibold text-lg tracking-tight mb-4">Routing Share</h3>
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-light)', borderRadius: '6px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-text-muted text-sm">No share metrics</div>
            )}
          </div>
          <div className="space-y-3 mt-6 p-4 rounded-md border border-border-light bg-background">
            {pieData.map(d => (
              <div key={d.name} className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2 text-text-primary font-medium">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }}></div> 
                  {d.name}
                </span>
                <span className="text-text-primary font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Expandable Table */}
      <h2 className="text-xl font-semibold tracking-tight mb-4">Action Log</h2>
      <div className="border border-border-light rounded-xl bg-surface overflow-hidden shadow-antigravity">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-light text-sm font-medium text-text-muted">
                <th className="p-4 font-medium">Timestamp</th>
                <th className="p-4 font-medium">Incident ID</th>
                <th className="p-4 font-medium">Model Used</th>
                <th className="p-4 font-medium">Tier</th>
                <th className="p-4 font-medium">Cost</th>
                <th className="p-4 font-medium">Latency</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {tableDecisions.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    {/* Main Row */}
                    <tr 
                      onClick={() => toggleRow(log.id)}
                      className={`border-b border-border-light/50 hover:bg-border-light/40 transition-colors cursor-pointer ${isExpanded ? 'bg-border-light/20' : ''}`}
                    >
                      <td className="p-4 text-text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-4 text-text-primary font-medium whitespace-nowrap">
                        INC-{log.incident_id?.toString().padStart(4, '0') || '----'}
                      </td>
                      <td className="p-4 text-text-muted text-xs truncate max-w-[150px] font-mono">{log.model_used}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${log.model_tier === 'fast-path' ? 'bg-text-primary text-surface border-border-light' : 'bg-border-light text-text-primary border-border-light'}`}>
                          {log.model_tier}
                        </span>
                      </td>
                      <td className="p-4 text-text-primary font-medium whitespace-nowrap">${log.cost.toFixed(5)}</td>
                      <td className="p-4 text-text-primary font-medium whitespace-nowrap">{log.latency_ms.toFixed(0)}ms</td>
                      <td className="p-4 text-center text-text-muted">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    
                    {/* Expanded Drawer Row */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <tr key={`${log.id}-expanded`} className="bg-background border-b border-border-light">
                          <td colSpan={7} className="p-0">
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  
                                  {/* Left Panel: Diagnostic suggestions */}
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-text-primary">Suggested Fix</h4>
                                    <div className="relative group">
                                      <pre className="text-xs font-mono text-text-primary font-medium bg-surface border border-border-light p-4 rounded-md leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                        {log.resolution_suggested || 'No suggestion recorded.'}
                                      </pre>
                                      {log.resolution_suggested && (
                                        <button 
                                          onClick={() => copyToClipboard(log.resolution_suggested, `fix-${log.id}`)}
                                          className="absolute top-2 right-2 p-1.5 rounded-md bg-border-light text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Copy code"
                                        >
                                          {copiedId === `fix-${log.id}` ? (
                                            <span className="text-[10px] font-sans">Copied!</span>
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    
                                    {log.escalated && (
                                      <div className="mt-4">
                                        <h4 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
                                          <ShieldAlert className="w-4 h-4 text-text-muted" />
                                          Escalation Telemetry
                                        </h4>
                                        <pre className="text-xs font-mono text-text-primary font-medium bg-surface border border-border-light p-4 rounded-md leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                          {log.escalation_reason || 'Novel trace pattern. Fast path bypassed for reasoning LLM verifier.'}
                                        </pre>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Panel: Hindsight memory hits & executions */}
                                  <div className="space-y-6">
                                    <div>
                                      <h4 className="text-sm font-medium text-text-primary mb-2">Memory Analytics</h4>
                                      <div className="bg-surface border border-border-light rounded-md p-4 text-xs space-y-3 font-mono">
                                        <div className="flex justify-between items-center">
                                          <span className="text-text-muted">Memory Consulted</span>
                                          <span className={log.memory_consulted ? 'text-text-primary' : 'text-text-muted'}>
                                            {log.memory_consulted ? 'true' : 'false'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-text-muted">Memory Hit (Cache)</span>
                                          <span className={log.memory_hit ? 'text-text-primary' : 'text-text-muted'}>
                                            {log.memory_hit ? '"HIT"' : '"MISS"'}
                                          </span>
                                        </div>
                                        {log.memory_hit && (
                                          <>
                                            <div className="flex justify-between items-center">
                                              <span className="text-text-muted">Vector Confidence</span>
                                              <span className="text-text-primary">{(log.memory_match_score * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="border-t border-border-light pt-3 mt-3">
                                              <span className="text-text-muted block mb-2">Matched Past Trace</span>
                                              <div className="relative group">
                                                <pre className="text-xs text-text-muted bg-background border border-border-light p-3 rounded-md max-h-32 overflow-y-auto whitespace-pre-wrap scrollbar-thin">
                                                  {log.memory_match_content}
                                                </pre>
                                                <button 
                                                  onClick={() => copyToClipboard(log.memory_match_content, `trace-${log.id}`)}
                                                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-border-light text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Copy trace"
                                                >
                                                  {copiedId === `trace-${log.id}` ? (
                                                    <span className="text-[10px] font-sans">Copied!</span>
                                                  ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                  )}
                                                </button>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div>
                                      <h4 className="text-sm font-medium text-text-primary mb-2">Route Properties</h4>
                                      <div className="bg-surface border border-border-light rounded-md p-4 text-xs space-y-3 font-mono">
                                        <div className="flex justify-between">
                                          <span className="text-text-muted">Routing Tier</span>
                                          <span className="text-text-primary">"{log.model_tier}"</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-text-muted">Targeted Severity</span>
                                          <span className="text-text-primary">
                                            "{log.severity || 'N/A'}"
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-text-muted">Confidence Index</span>
                                          <span className="text-text-primary">{log.confidence_score ? `${(log.confidence_score * 100).toFixed(0)}%` : '"N/A"'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
              {tableDecisions.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-text-muted text-sm">No audit records logged.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
