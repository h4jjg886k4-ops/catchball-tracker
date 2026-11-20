import { useState } from 'react';
import { X, Copy, Check, Link2, Link2Off, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { enableShareFS, disableShareFS } from '../../utils/firestore';

function shareUrl(token) {
  return `${window.location.origin}/share/${token}`;
}

// Inline panel under the stats header: create / copy / disable a read-only link
export default function SharePanel({ match, onClose }) {
  const { dispatch } = useMatch();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);
  const [copied, setCopied] = useState(false);

  const token   = match.shareToken ?? null;
  const enabled = match.shareEnabled === true && !!token;

  async function handleEnable() {
    if (!user || busy) return;
    setBusy(true); setError(null);
    try {
      const nextToken = token ?? uuidv4();   // re-enabling keeps the same link
      await enableShareFS(user.uid, match.id, nextToken, !token);
      dispatch({ type: 'SET_MATCH_SHARE', matchId: match.id, shareToken: nextToken, shareEnabled: true });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!user || busy) return;
    setBusy(true); setError(null);
    try {
      await disableShareFS(user.uid, match.id);
      dispatch({ type: 'SET_MATCH_SHARE', matchId: match.id, shareToken: token, shareEnabled: false });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const url = shareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS): select the field so the user can copy
      document.getElementById('share-link-input')?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="absolute top-full left-0 right-0 z-20 bg-slate-800 border border-blue-700/60 shadow-2xl p-4 mx-3 mt-1 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="text-white font-semibold text-sm flex items-center gap-1.5">
          <Link2 size={15} className="text-blue-400" /> {t('shareTitle')}
        </div>
        <button className="text-slate-400 hover:text-white" onClick={onClose}><X size={18} /></button>
      </div>
      <p className="text-slate-400 text-xs mb-3">{t('shareHint')}</p>

      {token && (
        <div className="flex items-center gap-2 mb-3">
          <input
            id="share-link-input"
            readOnly
            dir="ltr"
            value={shareUrl(token)}
            onFocus={e => e.target.select()}
            className={`flex-1 min-w-0 bg-slate-900 border rounded-lg px-3 py-2 text-xs font-mono ${
              enabled ? 'border-slate-600 text-slate-200' : 'border-slate-700 text-slate-600 line-through'
            }`}
          />
          <button
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ${
              !enabled ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : copied ? 'bg-green-700 text-white' : 'bg-blue-700 hover:bg-blue-600 text-white'
            }`}
            onClick={handleCopy}
            disabled={!enabled}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t('copied') : t('copyLink')}
          </button>
        </div>
      )}

      {token && !enabled && (
        <div className="text-amber-400 text-xs mb-3">{t('shareDisabledNote')}</div>
      )}
      {error && <div className="text-red-400 text-xs mb-3 break-words">{t('shareError', { msg: error })}</div>}

      {enabled ? (
        <button
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-700 hover:bg-red-900/60 border border-slate-600 text-slate-200 text-sm font-semibold transition-colors"
          onClick={handleDisable}
          disabled={busy}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2Off size={14} />} {t('disableShare')}
        </button>
      ) : (
        <button
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
          onClick={handleEnable}
          disabled={busy}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {token ? t('enableShareAgain') : t('createShareLink')}
        </button>
      )}
    </div>
  );
}
