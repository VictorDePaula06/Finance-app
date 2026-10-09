import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { buildWalletLedger } from '../utils/financialLogic';

// Mês corrente no formato que o ledger espera ("2026-10"), igual ao resto do app.
const monthKeyNow = () => new Date().toISOString().slice(0, 7);

// ── Saldo da conta, para quem só precisa do número ───────────────────
// Mesmo cálculo que o Dashboard, o Extrato e as Contas a pagar já fazem
// (buildWalletLedger sobre as transações) — aqui isolado num hook porque a
// barra superior precisa dele em TODAS as abas, não só no dashboard.
//
// O onSnapshot repetido não custa uma segunda leitura: é a mesma consulta
// que as telas já mantêm aberta, e o SDK serve as duas do mesmo cache.
export function useSaldoConta() {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;

    // O dono dos dados viaja JUNTO com eles. Guardar "carregando" num estado
    // separado obrigaria a chamar setState dentro do efeito a cada troca de
    // usuário — e aí o primeiro quadro mostraria o saldo de quem saiu.
    const [dados, setDados] = useState({ uid: null, tx: [] });

    useEffect(() => {
        if (!uid) return undefined;
        return onSnapshot(
            query(collection(db, 'transactions'), where('userId', '==', uid)),
            (s) => setDados({ uid, tx: s.docs.map(d => ({ id: d.id, ...d.data() })) }),
            () => setDados({ uid, tx: [] }),
        );
    }, [uid]);

    const meus = dados.uid === uid ? dados.tx : null;
    const saldo = useMemo(() => buildWalletLedger(meus || [], monthKeyNow()).finalBalance, [meus]);

    return { saldo, carregando: !!uid && meus === null };
}

export default useSaldoConta;
