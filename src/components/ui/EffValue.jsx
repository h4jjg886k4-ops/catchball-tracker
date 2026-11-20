import { useLanguage } from '../../context/LanguageContext';
import { SMALL_SAMPLE_ATTEMPTS, formatEff } from '../../utils/analysisStats';

// Attack efficiency in volleyball notation: "0.312 (10 att)", with ※ under 10 attempts
export default function EffValue({ eff, attempts, showAttempts = true, className = '' }) {
  const { t } = useLanguage();
  if (eff === null || eff === undefined || !attempts) return <span className="text-slate-600">—</span>;
  const small = attempts < SMALL_SAMPLE_ATTEMPTS;
  return (
    <span className={`tabular-nums whitespace-nowrap ${className}`} dir="ltr">
      {formatEff(eff)}
      {showAttempts && <span className="text-slate-500 font-normal"> ({t('attemptsFmt', { n: attempts })})</span>}
      {small && (
        <span className="text-amber-400 ms-0.5" title={t('smallSampleTip')} aria-label={t('smallSampleTip')}>※</span>
      )}
    </span>
  );
}
