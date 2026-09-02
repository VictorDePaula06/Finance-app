import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Fonte única do status da integração de WhatsApp.
 *
 * Centraliza a consulta em `wa_users` (antes duplicada dentro da aba de
 * configurações) para que a sidebar e a tela de configuração compartilhem
 * exatamente o mesmo estado — sem duplicar chamada/lógica.
 *
 * Retorna:
 *  - loading   {boolean}  carregando o status
 *  - linked    {Array}    vínculos existentes ([{ phone, ... }])
 *  - connected {boolean}  há ao menos um número vinculado
 *  - number    {string}   número salvo nas preferências (só dígitos ou como digitado)
 *  - error     {string}   mensagem de erro ao verificar o vínculo
 *  - refresh   {function} recarrega o status sob demanda
 *  - setLinked {function} atualização otimista (ex.: após desvincular)
 */
export function useWhatsAppStatus() {
    const { currentUser, userPrefs } = useAuth();
    const uid = currentUser?.uid;

    const [loading, setLoading] = useState(true);
    const [linked, setLinked] = useState([]);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        if (!uid) { setLinked([]); setLoading(false); return; }
        setLoading(true); setError('');
        try {
            const snap = await getDocs(query(collection(db, 'wa_users'), where('uid', '==', uid)));
            setLinked(snap.docs.map(d => ({ phone: d.id, ...d.data() })));
        } catch (e) {
            console.error('[useWhatsAppStatus]', e);
            setError('Não foi possível verificar o vínculo agora.');
        }
        setLoading(false);
    }, [uid]);

    useEffect(() => { refresh(); }, [refresh]);

    return {
        loading,
        linked,
        connected: linked.length > 0,
        number: userPrefs?.whatsapp?.number || '',
        error,
        refresh,
        setLinked,
    };
}

export default useWhatsAppStatus;
