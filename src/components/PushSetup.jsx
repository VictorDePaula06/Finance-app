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
        if (!base64String) return new Uint8Array(0);
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
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                setStatus('denied');
                return;
            }

            if (!publicKey) {
                setStatus('error');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

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

    const unsubscribeUser = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                // Opcional: remover do Firestore se necessário, mas por agora apenas local
                setStatus('idle');
            }
        } catch (error) {
            console.error('Erro ao desativar notificações:', error);
        }
    };

    const [isVisible, setIsVisible] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(localStorage.getItem('push-prompt-hidden') === 'true');

    useEffect(() => {
        // Verifica se já está inscrito ao carregar
        const checkSubscription = async () => {
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) setStatus('granted');
            }
        };
        checkSubscription();
    }, []);

    if (status === 'denied') return null;

    if (status === 'granted') return (
        <button 
            onClick={unsubscribeUser}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-500/20 hover:bg-rose-500/20 hover:text-rose-600 hover:border-rose-500/30 transition-all group"
            title="Desativar Notificações"
        >
            <CheckCircle2 className="w-4 h-4 group-hover:hidden text-emerald-500" />
            <BellOff className="w-4 h-4 hidden group-hover:block text-rose-500" />
            <span className="hidden md:inline">Ativado</span>
        </button>
    );

    if (status === 'error') return (
        <button 
            onClick={subscribeUser}
            className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-600 rounded-xl text-[10px] font-bold border border-rose-500/20 hover:bg-rose-500/20 transition-all"
            title="Erro ao ativar. Clique para tentar novamente. Verifique o console."
        >
            <BellOff className="w-4 h-4 text-rose-500" />
            <span className="hidden md:inline">Erro Alerta</span>
        </button>
    );

    return (
        <button 
            onClick={subscribeUser}
            disabled={status === 'asking'}
            title="Ativar Notificações"
            className={`p-2 rounded-xl transition-all flex items-center gap-2 group ${
                status === 'asking' ? 'bg-amber-100 text-amber-500 animate-pulse' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20'
            }`}
        >
            <Bell className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-tight hidden md:inline-block">Alertas</span>
        </button>
    );
}
