import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

// ── "Ainda não cadastrei nada" ──────────────────────────────────────
// Sem entrada fixa, sem despesa fixa e sem cartão, o app não tem com o que
// trabalhar: o Dashboard fica zerado, Contas a pagar e a receber ficam
// vazias, e a pessoa costuma achar que é o app que não funciona.
//
// Este hook responde se é esse o caso, para o botão de Cadastros poder
// avisar com um ponto de alerta. Assim que QUALQUER coisa for cadastrada o
// aviso some sozinho — ninguém precisa dispensá-lo.
//
// Enquanto as três consultas não voltarem, `pendente` é false: um alerta
// que pisca no carregamento e some é pior que nenhum alerta.
export function useCadastroPendente() {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;
    const [estado, setEstado] = useState({ uid: null, incomes: null, expenses: null, cards: null });

    useEffect(() => {
        if (!uid) return undefined;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const conta = (campo) => (s) => setEstado(e => ({ ...(e.uid === uid ? e : {}), uid, [campo]: s.size }));
        const paradas = [
            onSnapshot(q('fixed_incomes'), conta('incomes'), () => {}),
            onSnapshot(q('fixed_expenses'), conta('expenses'), () => {}),
            onSnapshot(q('cards'), conta('cards'), () => {}),
        ];
        return () => paradas.forEach(p => p());
    }, [uid]);

    const meu = estado.uid === uid;
    const carregado = meu && estado.incomes !== null && estado.expenses !== null && estado.cards !== null;
    return { pendente: carregado && estado.incomes + estado.expenses + estado.cards === 0 };
}

export default useCadastroPendente;
