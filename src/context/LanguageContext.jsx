import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { translations } from '../i18n/translations';
import { useAuth } from './AuthContext';
import { saveSettingsFS, loadSettingsFS } from '../utils/firestore';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState('en');
  const prevUserRef = useRef(null);

  // Load language from Firestore when user logs in
  useEffect(() => {
    if (!user) {
      prevUserRef.current = null;
      return;
    }
    if (user.uid === prevUserRef.current) return;
    prevUserRef.current = user.uid;

    loadSettingsFS(user.uid).then(settings => {
      if (settings?.language) setLangState(settings.language);
    }).catch(console.error);
  }, [user]);

  // Apply direction to DOM
  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(newLang) {
    setLangState(newLang);
    if (user) {
      saveSettingsFS(user.uid, { language: newLang }).catch(console.error);
    }
  }

  function t(key, vars = {}) {
    const str = translations[key]?.[lang] ?? translations[key]?.en ?? key;
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL: lang === 'he' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
