import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Show with a slight delay for better UX
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-auto md:max-w-sm z-[1000] animate-in slide-in-from-bottom-8 fade-in duration-500">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative">
        <button 
          onClick={handleAccept}
          className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4 mb-4 mt-2">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-white font-bold mb-1">Nós usamos cookies</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Utilizamos cookies essenciais para garantir que você tenha a melhor experiência na nossa plataforma.
            </p>
          </div>
        </div>
        <button 
          onClick={handleAccept}
          className="w-full py-3 bg-white/5 hover:bg-emerald-500 hover:text-white text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        >
          Entendi e Aceito
        </button>
      </div>
    </div>
  );
}
