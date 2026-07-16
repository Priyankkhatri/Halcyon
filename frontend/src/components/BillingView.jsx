import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import Card from './ui/Card';
import { Button } from './ui/Button';
import { Check, CreditCard, Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BillingView() {
  const { subscription, upgrade, downgrade, limitCount, maxLogs, t } = useApp();
  const [, setLocation] = useLocation();

  const [checkoutActive, setCheckoutActive] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Formatting helpers
  const handleCardNumberChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.substring(0, 16);
    const matches = val.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(' '));
    } else {
      setCardNumber(val);
    }
  };

  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.substring(0, 4);
    if (val.length >= 2) {
      setExpiry(`${val.substring(0, 2)}/${val.substring(2, 4)}`);
    } else {
      setExpiry(val);
    }
  };

  const handleCvcChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setCvc(val.substring(0, 3));
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (!cardNumber || !expiry || !cvc || !cardName) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      upgrade();
      setTimeout(() => {
        setSuccess(false);
        setCheckoutActive(false);
        setLocation('/');
      }, 2500);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="mb-8 border-b border-border-light pb-6 relative">
        <button
          onClick={() => setLocation('/')}
          className="text-text-muted hover:text-text-primary text-xs font-semibold uppercase tracking-widest mb-4 inline-flex items-center transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t('nav.backToFeed')}
        </button>
        <h1 className="text-3xl sm:text-4xl font-sans text-text-primary tracking-wide mb-2 flex items-center gap-3">
          {t('billing.title')}
          {subscription === 'pro' && (
            <span className="text-xs font-mono font-bold tracking-widest bg-surface text-accent-warm border border-border-light px-2.5 py-1 rounded-sm uppercase">
              PRO ACTIVE
            </span>
          )}
        </h1>
        <p className="text-sm text-text-muted font-light max-w-2xl">{t('billing.subtitle')}</p>
      </div>

      <AnimatePresence mode="wait">
        {!checkoutActive ? (
          <motion.div
            key="tiers"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mt-4"
          >
            {/* Free Tier Card */}
            <Card className="flex flex-col justify-between relative overflow-hidden h-full border border-border-light/65" animateHover={subscription === 'pro'}>
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-sans text-2xl text-text-primary mb-1">{t('sidebar.freeTier')}</h3>
                    <div className="text-3xl font-sans font-bold text-text-primary">$0</div>
                  </div>
                  {subscription === 'free' && (
                    <span className="text-[10px] font-mono font-bold tracking-widest bg-surface text-primary border border-border-light px-2 py-0.5 rounded-sm uppercase">
                      {t('billing.currentPlan')}
                    </span>
                  )}
                </div>

                <div className="border-t border-border-light/60 my-4" />

                <ul className="space-y-3.5 text-xs text-text-muted mt-6 mb-8">
                  {t('billing.featuresFree').map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-6 border-t border-border-light/30">
                {subscription === 'free' ? (
                  <div className="w-full text-center py-2.5 rounded-md border border-border-light/60 bg-background/50 font-mono text-xs font-bold text-text-muted uppercase">
                    {t('billing.freeButton')}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={downgrade}
                    className="w-full font-mono text-xs font-bold uppercase tracking-wider"
                  >
                    Downgrade to Free
                  </Button>
                )}

                {subscription === 'free' && (
                  <div className="mt-4 flex items-center justify-between text-[11px] font-mono bg-background border border-border-light/60 p-3 rounded-md">
                    <span className="text-text-muted">{t('billing.remainingLogs')}:</span>
                    <span className="font-bold text-primary">{maxLogs - limitCount} / {maxLogs}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Pro Tier Card */}
            <Card
              className={`flex flex-col justify-between relative overflow-hidden h-full border ${
                subscription === 'pro'
                  ? 'border-accent-warm shadow-glow-teal bg-gradient-to-b from-accent-warm/[0.04] to-transparent'
                  : 'border-border-light/70'
              }`}
              animateHover={subscription !== 'pro'}
            >
              {/* Premium Glow effect */}
              {subscription === 'pro' && (
                <div className="accent-strip-bar rounded-t-xl" />
              )}

              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-sans text-2xl text-text-primary mb-1 flex items-center gap-2">
                      {t('sidebar.proTier')}
                      <Sparkles className="w-4 h-4 text-accent-warm " />
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-sans font-bold text-text-primary">$49</span>
                      <span className="text-xs font-mono text-text-muted">{t('billing.pricingMonthly')}</span>
                    </div>
                  </div>
                  {subscription === 'pro' && (
                    <span className="text-[10px] font-mono font-bold tracking-widest bg-surface text-accent-warm border border-border-light px-2 py-0.5 rounded-sm uppercase">
                      {t('billing.currentPlan')}
                    </span>
                  )}
                </div>

                <div className="border-t border-border-light/60 my-4" />

                <ul className="space-y-3.5 text-xs text-text-muted mt-6 mb-8">
                  {t('billing.featuresPro').map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed text-text-primary">
                      <Check className="w-4 h-4 text-accent-warm shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-6 border-t border-border-light/30">
                {subscription === 'pro' ? (
                  <div className="w-full text-center py-2.5 rounded-md border border-border-light bg-surface font-mono text-xs font-bold text-accent-warm uppercase shadow-none">
                    Active Subscription
                  </div>
                ) : (
                  <Button
                    variant="accent"
                    onClick={() => setCheckoutActive(true)}
                    className="w-full font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.01]"
                  >
                    {t('billing.proButton')}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto mt-4"
          >
            <Card className="p-6 relative overflow-hidden" animateHover={false}>
              <div className="accent-strip-bar rounded-t-xl" />
              
              <h3 className="font-sans text-xl sm:text-2xl text-text-primary mb-6 flex items-center gap-2 border-b border-border-light pb-4">
                <CreditCard className="w-5 h-5 text-accent-warm" />
                {t('billing.checkoutTitle')}
              </h3>

              {/* Glassmorphic Credit Card Widget */}
              <div className="relative w-full h-44 rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-700/60 p-5 text-white font-mono flex flex-col justify-between shadow-antigravity mb-8 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(232,147,91,0.06),transparent)] pointer-events-none" />
                
                {/* Chip and Logo */}
                <div className="flex justify-between items-center">
                  <div className="w-10 h-8 rounded-md bg-amber-400/20 border border-amber-400/40 relative overflow-hidden">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-amber-400/30" />
                    <div className="absolute top-0 left-1/2 w-[1px] h-full bg-amber-400/30" />
                  </div>
                  <div className="text-sm font-bold italic tracking-wide text-slate-400">HALCYON SECURE</div>
                </div>

                {/* Card Number */}
                <div className="text-lg sm:text-xl tracking-[0.2em] my-4 font-semibold text-slate-100 min-h-6">
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>

                {/* Expiry / Cardholder */}
                <div className="flex justify-between items-end text-[10px] sm:text-xs">
                  <div>
                    <div className="text-slate-500 font-bold uppercase tracking-wider text-[8px] mb-0.5">Cardholder</div>
                    <div className="font-medium text-slate-200 tracking-wider uppercase truncate max-w-[180px]">
                      {cardName || 'YOUR NAME'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 font-bold uppercase tracking-wider text-[8px] mb-0.5">Expires</div>
                    <div className="font-medium text-slate-200 tracking-wider">
                      {expiry || 'MM/YY'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted mb-1.5">
                    {t('billing.cardName')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full bg-background border border-border-light rounded-md px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-warm focus:ring-1 focus:ring-accent-warm/40 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted mb-1.5">
                    {t('billing.cardNumber')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="4111 2222 3333 4444"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="w-full bg-background border border-border-light rounded-md px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-warm focus:ring-1 focus:ring-accent-warm/40 font-mono font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted mb-1.5">
                      {t('billing.cardExpiry')}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={handleExpiryChange}
                      className="w-full bg-background border border-border-light rounded-md px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-warm focus:ring-1 focus:ring-accent-warm/40 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted mb-1.5">
                      {t('billing.cardCvc')}
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="•••"
                      value={cvc}
                      onChange={handleCvcChange}
                      className="w-full bg-background border border-border-light rounded-md px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-warm focus:ring-1 focus:ring-accent-warm/40 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCheckoutActive(false)}
                    className="flex-1 font-mono text-xs uppercase font-bold tracking-wider"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="accent"
                    disabled={loading || success}
                    className="flex-1 font-mono text-xs uppercase font-bold tracking-wider relative flex items-center justify-center min-h-[40px]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-[2px] border-white/30 border-t-white animate-spin" />
                    ) : success ? (
                      <CheckCircle2 className="w-5 h-5 text-white " />
                    ) : (
                      'Pay & Upgrade'
                    )}
                  </Button>
                </div>
              </form>

              {/* Success Notification overlay */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#0F172A]/95 flex flex-col items-center justify-center text-center p-6"
                  >
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-16 h-16 rounded-sm bg-surface text-accent-warm flex items-center justify-center border border-border-light mb-4"
                    >
                      <Sparkles className="w-8 h-8" />
                    </motion.div>
                    <h4 className="font-sans text-xl text-slate-100 font-bold mb-2">Upgrade Successful!</h4>
                    <p className="text-xs text-slate-400 font-mono">{t('billing.successMsg')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
