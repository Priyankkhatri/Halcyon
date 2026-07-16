import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import Card from './ui/Card';
import { Button } from './ui/Button';
import { Key, Folder, User, CheckCircle2, AlertTriangle, Loader2, PlayCircle, Eye, EyeOff } from 'lucide-react';

export default function GithubOnboarding({ onConnectionSuccess }) {
  const [token, setToken] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [showToken, setShowToken] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [mockLoading, setMockLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!token || !repoOwner || !repoName) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.connectGithub({
        token: token.trim(),
        repo_owner: repoOwner.trim(),
        repo_name: repoName.trim()
      });
      
      setSuccess(true);
      setTimeout(() => {
        onConnectionSuccess(data);
      }, 1200);
    } catch (err) {
      console.error(err);
      setError('Connection failed. Verify your Personal Access Token (classic with repo scope) and repository name.');
    } finally {
      setLoading(false);
    }
  };

  const handleMockConnect = async () => {
    setMockLoading(true);
    setError(null);
    try {
      const data = await api.connectGithub({
        token: 'dummy',
        repo_owner: 'dummy',
        repo_name: 'dummy'
      });
      
      setSuccess(true);
      setTimeout(() => {
        onConnectionSuccess(data);
      }, 1200);
    } catch (err) {
      console.error(err);
      setError('Mock connection failed.');
    } finally {
      setMockLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-muted flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Interactive neon spotlight ambient background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] -right-[10%] w-[50vw] h-[50vw] rounded-full blur-[150px] opacity-[0.10] bg-accent-warm" />
        <div className="absolute -bottom-[15%] -left-[10%] w-[45vw] h-[45vw] rounded-full blur-[160px] opacity-[0.08] bg-secondary" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 85 }}
        className="w-full max-w-lg z-10"
      >
        <Card className="relative overflow-hidden border border-border-light p-6 sm:p-8 shadow-antigravity-hover" animateHover={false}>
          {/* Top accent strip */}
          <div className="accent-strip-bar rounded-t-xl" />

          {/* Success Banner */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-background/95  z-30 flex flex-col items-center justify-center text-center p-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: 360 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-16 h-16 bg-surface rounded-sm flex items-center justify-center mb-4 border border-border-light"
                >
                  <CheckCircle2 className="w-8 h-8 text-accent-warm" />
                </motion.div>
                <h3 className="font-sans text-2xl text-text-primary font-bold mb-2">Verification Successful</h3>
                <p className="text-xs font-mono text-text-muted max-w-xs leading-relaxed uppercase tracking-wider">
                  Telemetry pipeline synchronized. Opening dashboard feed...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="font-sans text-3xl text-text-primary tracking-wide mb-2">Connect GitHub</h2>
            <p className="text-xs text-text-muted font-mono leading-relaxed max-w-sm mx-auto uppercase tracking-wide">
              Configure telemetry pipelines to correlate system crash logs with recent source code changes.
            </p>
          </div>

          {/* Setup Guide */}
          <div className="bg-background/45 border border-border-light rounded-md p-4 text-[11px] font-mono leading-relaxed text-text-muted space-y-2 mb-6 shadow-inner">
            <strong className="block text-text-primary uppercase tracking-wider text-[10px]">Setup Checklist</strong>
            <p>1. Create a Classic Token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-accent-warm hover:underline font-bold transition-colors">github.com/settings/tokens</a>.</p>
            <p>2. Select the <strong>repo</strong> scope (gives read rights to fetch repository commits).</p>
            <p>3. Input the credentials below to initiate automated correlation.</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-surface border border-border-light text-red-500 text-xs font-mono p-4 rounded-md flex items-start gap-2.5 shadow-none">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleConnect} className="space-y-5">
            <div className="space-y-4">
              
              {/* Token Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Personal Access Token (PAT)
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-background border border-border-light rounded-md p-4 pr-12 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                    required
                    disabled={loading || mockLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors focus:outline-none cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Repo Owner and Name Grid */}
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
                    disabled={loading || mockLoading}
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
                    disabled={loading || mockLoading}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-border-light/40">
              <Button
                type="submit"
                variant="primary"
                className="w-full py-3.5 text-xs font-mono font-bold uppercase tracking-wider"
                disabled={loading || mockLoading || !token || !repoOwner || !repoName}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Connection...
                  </>
                ) : (
                  'Verify & Connect Repository'
                )}
              </Button>
              
              <Button
                type="button"
                onClick={handleMockConnect}
                variant="outline"
                className="w-full py-3 bg-surface hover:bg-surface/85 border border-border-light text-text-muted hover:text-text-primary text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                disabled={loading || mockLoading}
              >
                {mockLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <PlayCircle className="w-3.5 h-3.5 text-accent-warm" /> Skip & Use Mock Data
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
