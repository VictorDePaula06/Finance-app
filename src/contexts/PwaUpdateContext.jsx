import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PwaUpdateContext = createContext({ needRefresh: false, pendingVersion: '', updateNow: () => {}, dismiss: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export const usePwaUpdate = () => useContext(PwaUpdateContext);

export function PwaUpdateProvider({ children }) {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            if (!r) return;
            // Checa atualização ao registrar, a cada 60s e ao focar a aba.
            r.update().catch(() => {});
            setInterval(() => r.update().catch(() => {}), 60 * 1000);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') r.update().catch(() => {});
            });
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    const [pendingVersion, setPendingVersion] = useState('');

    // Quando há atualização pendente, busca a versão nova publicada (version.json
    // com cache-bust) só para exibir "v X" no aviso. (Sem setState síncrono no effect.)
    useEffect(() => {
        if (!needRefresh) return;
        let active = true;
        fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(data => { if (active && data?.version) setPendingVersion(String(data.version)); })
            .catch(() => {});
        return () => { active = false; };
    }, [needRefresh]);

    const value = {
        needRefresh,
        pendingVersion,
        updateNow: () => updateServiceWorker(true),
        dismiss: () => setNeedRefresh(false),
    };

    return <PwaUpdateContext.Provider value={value}>{children}</PwaUpdateContext.Provider>;
}
