import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import Card from './ui/Card';
import { Button } from './ui/Button';
import { Key, User, Shield, AlertTriangle, Loader2, Info } from 'lucide-react';

export default function AuthForm({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let data;
      if (isLogin) {
        data = await api.login(username.trim(), password.trim());
      } else {
        data = await api.signup(username.trim(), password.trim());
      }
      
      // Save auth token & details
      localStorage.setItem('auth-token', data.token);
      localStorage.setItem('username', data.username);
      localStorage.setItem('workspace-id', data.workspace_id.toString());
      
      // Trigger success callback
      onAuthSuccess(data);
    } catch (err) {
      console.error(err);
      setError(
        isLogin 
          ? 'Login failed. Please check your username and password.' 
          : 'Registration failed. Username may already be taken.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-muted flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Decorative neon ambient spotlight backdrop */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[150px] opacity-[0.10] bg-accent-warm" />
        <div className="absolute -bottom-[15%] -right-[10%] w-[45vw] h-[45vw] rounded-full blur-[160px] opacity-[0.08] bg-primary" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 80 }}
        className="w-full max-w-md z-10"
      >
        <Card className="relative overflow-hidden border border-border-light p-6 sm:p-8 shadow-antigravity-hover" animateHover={false}>
          {/* Top accent line */}
          <div className="accent-strip-bar rounded-t-xl" />

          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-background border border-border-light rounded-xl flex items-center justify-center mx-auto mb-4 shadow-antigravity">
              <Shield className="w-6 h-6 text-accent-warm" />
            </div>
            <h2 className="font-sans text-3xl text-text-primary tracking-wide mb-1.5">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-xs text-text-muted font-mono tracking-wide uppercase">
              {isLogin ? 'Access your Halcyon Dashboard' : 'Deploy your intelligent memory cluster'}
            </p>
          </div>

          {/* Form Error Banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-surface border border-border-light text-red-500 text-xs font-mono p-4 rounded-md flex items-start gap-2.5 shadow-none"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sahil"
                  className="w-full bg-background border border-border-light rounded-md p-4 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border-light rounded-md p-4 text-text-primary font-mono text-sm leading-relaxed shadow-none focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Quick Helper Notice */}
            {!isLogin && (
              <div className="bg-background/40 border border-border-light rounded-md p-3 flex items-start gap-2 text-[10px] font-mono leading-relaxed text-text-muted">
                <Info className="w-3.5 h-3.5 text-accent-warm shrink-0 mt-0.5" />
                <span>Signing up automatically configures a new isolated, encrypted telemetry workspace.</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-2 text-xs uppercase font-mono tracking-wider font-bold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> 
                  {isLogin ? 'Authenticating...' : 'Deploying Workspace...'}
                </>
              ) : (
                isLogin ? 'Login & Connect' : 'Register & Setup'
              )}
            </Button>
          </form>

          {/* Toggle login/signup mode */}
          <div className="mt-8 pt-6 border-t border-border-light/40 text-center font-mono text-xs">
            <span className="text-text-muted/80">
              {isLogin ? "First time using Halcyon?" : "Already registered?"}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setUsername('');
                setPassword('');
              }}
              className="ml-1.5 text-accent-warm hover:text-accent-warm/85 hover:underline font-bold transition-all cursor-pointer"
              disabled={loading}
            >
              {isLogin ? 'Create Workspace' : 'Sign in'}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
