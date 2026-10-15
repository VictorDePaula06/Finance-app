// ── Transformar a compra do mês na lista do mês ─────────────────────
//
// Marcar "foi a compra do mês" no fim do lançamento evita o pior trabalho
// da tela: digitar a lista inteira de novo. A compra que acabou de ser
// lida JÁ é a lista — é literalmente o que entrou em casa.
//
// A regra escolhida é SOMAR, nunca substituir: quem já tinha itens na lista
// os colocou lá de propósito, e apagar o trabalho de alguém para economizar
// uma linha de código é um mau negócio.
//
// O que dá trabalho de verdade é não duplicar. "FILEZINHO SADIA" e "FILE
// FRANGO PERDIGAO" têm que cair na linha que já existe, e para isso usamos
// a mesma chave canônica do resto do mercado.

import { chaveDe, baseDaUnidade } from './produtoCanonico.js';

/**
 * Decide o que criar e o que somar, sem tocar no banco — assim dá para
 * testar a decisão, que é a parte que erra.
 *
 * @param {Array} itensDaCompra  [{ name, qty, unit }]
 * @param {Array} listaAtual     [{ id, name, qty, unit }] já em market_items
 * @param {Object} mapa          apelidos (junções feitas à mão)
 * @returns {{ criar: Array, somar: Array }}
 */
export function planejaLista(itensDaCompra, listaAtual, mapa) {
    // Agrupa a própria compra primeiro: 4 filezinhos de uma marca e 5 de
    // outra, no MESMO cupom, viram uma linha de 9 — não duas linhas iguais.
    const grupos = new Map();
    for (const it of itensDaCompra || []) {
        const nome = String(it?.name || '').trim();
        const qtd = Number(it?.qty) || 0;
        if (!nome || qtd <= 0) continue;

        const chave = chaveDe(nome, mapa);
        const { base, fator } = baseDaUnidade(it.unit);
        const id = `${chave}|${base}`;        // grandezas diferentes não somam

        if (!grupos.has(id)) {
            grupos.set(id, { chave, base, qtdBase: 0, unit: it.unit || 'un', nome, vezes: 0 });
        }
        const g = grupos.get(id);
        g.qtdBase += qtd * fator;
        g.vezes += 1;
        // Mantém a unidade e o nome da linha mais frequente do grupo.
        if (g.vezes === 1 || String(it.unit) === g.unit) g.unit = it.unit || g.unit;
    }

    // O que já está na lista, pela mesma chave e mesma grandeza.
    const existentes = new Map();
    for (const item of listaAtual || []) {
        const nome = String(item?.name || '').trim();
        if (!nome) continue;
        const id = `${chaveDe(nome, mapa)}|${baseDaUnidade(item.unit).base}`;
        if (!existentes.has(id)) existentes.set(id, item);   // o primeiro ganha
    }

    const criar = [];
    const somar = [];

    for (const [id, g] of grupos) {
        const fator = baseDaUnidade(g.unit).fator || 1;
        const qtd = arredonda(g.qtdBase / fator);
        const atual = existentes.get(id);

        if (atual) {
            const fatorAtual = baseDaUnidade(atual.unit).fator || 1;
            somar.push({
                id: atual.id,
                qty: arredonda((Number(atual.qty) || 0) + g.qtdBase / fatorAtual),
            });
        } else {
            criar.push({ name: g.nome, qty: qtd, unit: g.unit });
        }
    }

    return { criar, somar };
}

// Três casas chegam: 0,125 kg existe, 0,1253 kg não é coisa de mercado.
const arredonda = (n) => Math.round(n * 1000) / 1000;
