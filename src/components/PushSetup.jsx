import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';

export default function PushSetup() {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState('idle'); // idle, asking, granted, denied, error

    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const subscribeUser = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('error');
            return;
        }

        setStatus('asking');
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Pede permissão nativa
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setStatus('denied');
                return;
            }

            // Cria a assinatura de push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // Salva no Firestore do Usuário
            if (currentUser) {
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    pushSubscriptions: arrayUnion(JSON.stringify(subscription))
                });
            }

            setStatus('granted');
        } catch (error) {
            console.error('Erro ao assinar notificações:', error);
            setStatus('error');
        }
    };

    const [isVisible, setIsVisible] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(localStorage.getItem('push-prompt-hidden') === 'true');

    useEffect(() => {
        // Se já deu permissão, esconde depois de 3 segundos
        if (status === 'granted') {
            const timer = setTimeout(() => setIsVisible(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const handleDismiss = (e) => {
        e.stopPropagation();
        setIsVisible(false);
        localStorage.setItem('push-prompt-hidden', 'true');
        setHasInteracted(true);
    };

    if (hasInteracted && status !== 'granted') return null;
    if (!isVisible) return null;

    if (status === 'granted') return (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-500 text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 text-xs font-bold ring-1 ring-white/20">
                <CheckCircle2 className="w-4 h-4" /> Notificações Ativas
            </div>
        </div>
    );

    if (status === 'denied') return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 group">
            <button 
                onClick={subscribeUser}
                disabled={status === 'asking'}
                className="bg-white/80 backdrop-blur-md border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-xl hover:bg-white transition-all active:scale-95 pr-10"
            >
                <div className={`p-2 rounded-xl transition-colors ${status === 'asking' ? 'bg-amber-100 text-amber-500 animate-pulse' : 'bg-[#5CCEEA]/10 text-[#5CCEEA] group-hover:bg-[#5CCEEA] group-hover:text-white'}`}>
                    {status === 'asking' ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-tight leading-none mb-1">Alertas Reais</p>
                    <p className="text-[9px] text-slate-500 leading-none">Receber notificações</p>
                </div>
            </button>
            <button 
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                title="Fechar"
            >
                <BellOff className="w-3 h-3" />
            </button>
        </div>
    );
}
