import React, { useState, useEffect } from 'react';
import { api } from '../api';
import Card from './ui/Card';
import { Button } from './ui/Button';
import { Key, Folder, User, CheckCircle2, AlertTriangle, Loader2, LogOut, RefreshCw } from 'lucide-react';

const GithubIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    style={props.style || { width: '2rem', height: '2rem' }}
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export default function SettingsView() {
  const [status, setStatus] = useState({
    connected: false,
    repo_owner: null,
    repo_name: null,
    status: null, // connected / invalid / disconnected
    connected_at: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form Fields
  const [token, setToken] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGithubStatus();
      setStatus(data);
      if (!data.connected || data.status === 'invalid') {
        setShowForm(true);
      } else {
        setShowForm(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch integration status.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!token || !repoOwner || !repoName) {
      setError('All fields are required.');
      return;
    }
    
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await api.connectGithub({
        token: token.trim(),
        repo_owner: repoOwner.trim(),
        repo_name: repoName.trim()
      });
      setStatus(result);
      setSuccessMsg('GitHub repository connected successfully.');
      setToken('');
      setRepoOwner('');
      setRepoName('');
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check your Personal Access Token and repository path.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect the GitHub integration?')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.disconnectGithub();
      setStatus({
        connected: false,
        repo_owner: null,
        repo_name: null,
        status: null,
        connected_at: null
      });
      setToken('');
      setRepoOwner('');
      setRepoName('');
      setShowForm(true);
      setSuccessMsg('GitHub integration disconnected.');
    } catch (err) {
      console.error(err);
      setError('Failed to disconnect integration.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconnect = () => {
    setShowForm(true);
    setRepoOwner(status.repo_owner || '');
    setRepoName(status.repo_name || '');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-2 sm:py-4">
        <div className="mb-8 border-b border-border-light pb-6">
          <div className="h-9 w-48 bg-surface rounded-md shimmer-bg mb-2"></div>
          <div className="h-4 w-80 bg-surface rounded-md shimmer-bg"></div>
        </div>
        <div className="h-64 bg-surface rounded-xl border border-border-light shimmer-bg"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-4">
      {/* Page Header */}
      <div className="mb-8 border-b border-border-light pb-6">
        <h1 className="text-3xl sm:text-4xl font-sans text-text-primary tracking-wide mb-2">Integrations</h1>
        <p className="text-text-muted font-light text-sm">Configure workspace connections and telemetry correlation pipelines.</p>
      </div>

      <div className="space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="bg-surface border border-border-light text-red-500 text-xs font-mono p-4 rounded-md flex items-start gap-2.5 shadow-none">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-surface border border-border-light text-accent-warm text-xs font-mono p-4 rounded-md flex items-start gap-2.5 shadow-none">
            <CheckCircle2 className="w-4.5 h-4.5 text-accent-warm shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* GitHub Connection Card */}
        <Card className="overflow-hidden relative" animateHover={false}>
          {/* Top colored status indicator strip */}
          <div className={`absolute top-0 left-0 w-full h-[4px] ${
            status.connected && status.status === 'connected'
              ? 'bg-accent-warm' 
              : status.status === 'invalid'
              ? 'bg-primary'
              : 'bg-text-muted/30'
          }`} />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border-light/60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-background border border-border-light rounded-md">
                <GithubIcon className="w-8 h-8 text-text-primary" />
              </div>
              <div>
                <h3 className="font-sans text-xl sm:text-2xl text-text-primary font-bold mb-1">GitHub Integration</h3>
                <p className="text-xs text-text-muted font-mono leading-relaxed">
                  Correlate incoming telemetry crash logs with recent repository deployments.
                </p>
              </div>
            </div>

            {/* Connection Status Badge */}
            <div className="flex items-center gap-3">
              {status.connected && status.status === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface border border-accent-warm/40 text-[10px] font-mono font-bold uppercase tracking-wider text-accent-warm shadow-antigravity">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-warm shadow-glow-teal animate-pulse-glow" />
                  Connected
                </span>
              ) : status.status === 'invalid' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface border border-primary/40 text-[10px] font-mono font-bold uppercase tracking-wider text-primary shadow-antigravity">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-glow-amber" />
                  Needs Renewal
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-background border border-border-light text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted shadow-antigravity">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50" />
                  Disconnected
                </span>
              )}
            </div>
          </div>

          {/* Invalid Token State Banner */}
          {status.status === 'invalid' && !showForm && (
            <div className="my-6 bg-surface border border-border-light text-primary text-xs font-mono p-4 rounded-md flex items-center justify-between gap-4 shadow-none">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                <div>
                  <strong className="block text-[11px] uppercase tracking-wider mb-0.5">Connection Invalid</strong>
                  <span className="text-text-muted">The token has expired or is no longer authorized.</span>
                </div>
              </div>
              <Button onClick={handleReconnect} variant="secondary" className="bg-surface hover:bg-surface text-primary border-border-light hover:border-border-light shrink-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reconnect
              </Button>
            </div>
          )}

          {/* Active Connection Info */}
          {status.connected && (
            <div className="py-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background border border-border-light rounded-md p-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">Target Repository</span>
                  <span className="font-mono text-sm font-bold text-text-primary break-all">
                    {status.repo_owner}/{status.repo_name}
                  </span>
                </div>
                <div className="bg-background border border-border-light rounded-md p-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block mb-1">Connected At</span>
                  <span className="font-mono text-sm font-bold text-text-primary">
                    {status.connected_at ? new Date(status.connected_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {!showForm && (
                <div className="flex justify-between items-center pt-4 border-t border-border-light/40">
                  <Button onClick={handleReconnect} variant="outline">
                    Update Connection
                  </Button>
                  <Button onClick={handleDisconnect} variant="secondary" className="hover:bg-surface hover:text-red-500 hover:border-border-light" disabled={actionLoading}>
                    <LogOut className="w-3.5 h-3.5" /> Disconnect
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Connection / Edit Form */}
          {showForm && (
            <form onSubmit={handleConnect} className="mt-6 space-y-5">
              <div className="bg-background/40 border border-border-light rounded-md p-4 text-xs font-mono text-text-muted space-y-2">
                <p className="font-semibold text-text-primary uppercase tracking-wider text-[10px]">Setup Guide</p>
                <p>1. Generate a Personal Access Token on GitHub with <strong>repo</strong> read access.</p>
                <p>
                  2. Create a classic token at{' '}
                  <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-accent-warm hover:underline font-bold transition-colors">
                    github.com/settings/tokens
                  </a>.
                </p>
                <p>3. Enter the repository details below to verify and configure NOC deployment correlation.</p>
              </div>

              <div className="space-y-4">
                {/* Token Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> Personal Access Token (Write-Only)
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-background border border-border-light rounded-md p-4 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Repo Owner */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Repository Owner
                    </label>
                    <input
                      type="text"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      placeholder="e.g. sahilchaudhari32"
                      className="w-full bg-background border border-border-light rounded-md p-4 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                      required
                    />
                  </div>

                  {/* Repo Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5" /> Repository Name
                    </label>
                    <input
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="e.g. Halcyon"
                      className="w-full bg-background border border-border-light rounded-md p-4 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border-light/40">
                {status.connected && (
                  <Button type="button" onClick={() => setShowForm(false)} variant="outline" disabled={actionLoading}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={actionLoading || !token || !repoOwner || !repoName}>
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Connection...
                    </>
                  ) : (
                    'Verify & Save Connection'
                  )}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
