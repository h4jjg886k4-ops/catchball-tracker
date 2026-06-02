import React, { useState } from 'react';
import { Trophy, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// ── Auth error messages ───────────────────────────────────────────────────────
function friendlyError(code, t) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return t('authErrInvalidCredential');
    case 'auth/email-already-in-use':
      return t('authErrEmailInUse');
    case 'auth/weak-password':
      return t('authErrWeakPassword');
    case 'auth/invalid-email':
      return t('authErrInvalidEmail');
    case 'auth/popup-closed-by-user':
      return null; // user cancelled — no error to show
    case 'auth/popup-blocked':
      return t('authErrPopupBlocked');
    default:
      return t('authErrGeneric');
  }
}

export default function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle, signInApple } = useAuth();
  const { t } = useLanguage();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpEmail(email.trim(), password);
      } else {
        await signInEmail(email.trim(), password);
      }
    } catch (err) {
      const msg = friendlyError(err.code, t);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInGoogle();
    } catch (err) {
      const msg = friendlyError(err.code, t);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    setError('');
    setLoading(true);
    try {
      await signInApple();
    } catch (err) {
      const msg = friendlyError(err.code, t);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.82), rgba(0,0,0,0.82)), url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-blue-700 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/60">
          <Trophy size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">CatchCoach</h1>
        <p className="text-slate-400 text-sm mt-1">{t('appTagline')}</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-slate-800/90 rounded-3xl border border-slate-700 p-6 shadow-2xl backdrop-blur-sm">

        {/* Tab toggle */}
        <div className="flex bg-slate-700 rounded-xl p-1 mb-6 gap-1">
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isSignUp ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
            onClick={() => { setIsSignUp(false); setError(''); }}
          >
            {t('login')}
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isSignUp ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
            onClick={() => { setIsSignUp(true); setError(''); }}
          >
            {t('signUp')}
          </button>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3 mb-5">
          <button
            className="btn-3d btn-3d-slate w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-3"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" className="flex-shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.3 1.2 8.5 3.1l6.3-6.3C34.9 2.9 29.8 0 24 0 14.9 0 7 5.4 3.2 13.3l7.3 5.7C12.3 13 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.8 24.6c0-1.7-.2-3.3-.4-4.9H24v9.3h12.8c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.3z"/>
              <path fill="#FBBC05" d="M10.5 28.9A14.7 14.7 0 0 1 9.5 24c0-1.7.3-3.4.8-4.9L3 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.5l8-5.6z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.2 1.5-5 2.4-8.5 2.4-6.3 0-11.6-4.2-13.5-10l-7.3 5.7C7 42.6 14.9 48 24 48z"/>
            </svg>
            {t('continueWithGoogle')}
          </button>

          <button
            className="btn-3d w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-3"
            style={{ background: 'linear-gradient(to bottom,#2d2d2d,#1a1a1a)', boxShadow: '0 6px 0 #000, inset 0 1px 0 rgba(255,255,255,0.1)', color: '#fff', border: '1px solid #333' }}
            onClick={handleApple}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="flex-shrink-0">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11"/>
            </svg>
            {t('continueWithApple')}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-600" />
          <span className="text-slate-500 text-xs uppercase tracking-wider">{t('orEmail')}</span>
          <div className="flex-1 h-px bg-slate-600" />
        </div>

        {/* Email / Password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="email"
              placeholder={t('email')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder={t('password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-9 pr-10 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              onClick={() => setShowPass(v => !v)}
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-3d btn-3d-blue w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : isSignUp ? t('signUp') : t('login')
            }
          </button>
        </form>
      </div>

      <p className="text-slate-500 text-xs mt-6 text-center">
        {isSignUp ? t('alreadyHaveAccount') : t('noAccount')}{' '}
        <button
          className="text-blue-400 hover:text-blue-300 font-semibold underline"
          onClick={() => { setIsSignUp(v => !v); setError(''); }}
        >
          {isSignUp ? t('login') : t('signUp')}
        </button>
      </p>
    </div>
  );
}
