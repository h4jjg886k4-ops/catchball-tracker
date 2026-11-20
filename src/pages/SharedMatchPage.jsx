import { useEffect, useState } from 'react';
import { Loader2, LinkIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { loadSharedMatchFS } from '../utils/firestore';
import StatsPage from './StatsPage';

// Public, no-login view of a shared match: /share/:token
export default function SharedMatchPage({ token }) {
  const { t } = useLanguage();
  const [match, setMatch]   = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | invalid

  useEffect(() => {
    let cancelled = false;
    loadSharedMatchFS(token)
      .then(m => {
        if (cancelled) return;
        setMatch(m);
        setStatus(m ? 'ready' : 'invalid');
      })
      .catch(err => {
        console.error('[share] load failed:', err);
        if (!cancelled) setStatus('invalid');
      });
    return () => { cancelled = true; };
  }, [token]);

  const footer = (
    <div className="py-4 text-center text-slate-500 text-xs bg-slate-900 border-t border-slate-800">
      {t('sharedFooter')} <span className="font-bold text-slate-300">CatchCoach</span>
    </div>
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="animate-spin text-blue-400" />
        <p className="text-slate-400 text-sm">{t('sharedLoading')}</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <LinkIcon size={40} className="text-slate-600" />
          <p className="text-slate-300 font-semibold">{t('shareInvalid')}</p>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex-1"><StatsPage sharedMatch={match} /></div>
      {footer}
    </div>
  );
}
