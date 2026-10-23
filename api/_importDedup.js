/**
 * O que já existe não entra de novo.
 *
 * O PROBLEMA, com o exemplo real: você importa a fatura de outubro, que
 * traz "Celular 3/12" e "Netflix". Em novembro você importa a próxima, que
 * traz "Celular 4/12" e "Netflix" outra vez. Sem verificação:
 *
 *   · a parcela vira um SEGUNDO parcelamento de 12 meses;
 *   · a Netflix vira um gasto novo todo mês — e, se ela já está cadastrada
 *     como assinatura no app, o mês conta DUAS vezes a mesma cobrança;
 *   · reenviar a mesma fatura por engano duplica tudo.
 *
 * O parcelamento já tinha tratamento (casa nome + nº de parcelas + valor).
 * Assinatura e compra repetida não tinham nenhum.
 *
 * Este módulo é só decisão, sem banco: recebe o que veio na fatura e o que
 * já existe, e devolve o que fazer com cada linha. Separado assim porque
 * essa decisão é a parte que erra, e é a parte que dá para testar.
 */

// ── Parcela na descrição da fatura ──────────────────────────────────
// Operadora escreve de várias formas: "MLP *KABUM-PARC10/10",
// "MERCADOLIVRE*MPARC03/04", "PARCELA 3 DE 10", ou só "KABUM 04/04".
export const INST_PATTERNS = [
    // Com marcador: PARC / PARCELA, aceitando uma letra colada antes (MPARC).
    /\b[A-Z]?PARC(?:ELA)?\.?\s*(\d{1,2})\s*(?:\/|-|\s+DE\s+)\s*(\d{1,2})\b/i,
    // Sem marcador: "03/10" no fim da descrição.
    /(?:^|[\s*\-(])(\d{1,2})\s*\/\s*(\d{1,2})\s*\)?\s*$/,
];

/** Devolve { current, total, name } — o nome SEM o trecho da parcela. */
export function parseInstallment(desc) {
    const str = String(desc || '');
    for (const re of INST_PATTERNS) {
        const m = str.match(re);
        if (!m) continue;
        const current = parseInt(m[1], 10);
        const total = parseInt(m[2], 10);
        // Faixa plausível de parcelamento. Fora disso é mais provável ser data
        // ou código da loja, e um falso positivo cobraria meses a mais.
        if (!(total >= 2 && total <= 36 && current >= 1 && current <= total)) continue;
        const name = str.replace(m[0], ' ').replace(/[\s*\-–—/|.]+$/, '').replace(/\s+/g, ' ').trim();
        return { current, total, name: name || str.trim() };
    }
    return null;
}

/**
 * Nome comparável entre a fatura e o cadastro.
 *
 * A operadora escreve "NETFLIX.COM", "NETFLIX *MENSAL", "Netflix.com SP" —
 * e no app está "Netflix". Comparar texto cru nunca casaria. Então tira
 * acento, pontuação, sufixo de site e as palavras que a operadora cola na
 * frente ou atrás sem mudar o estabelecimento.
 */
const RUIDO_OPERADORA = new Set([
    'com', 'br', 'net', 'www', 'ltda', 'me', 'sa', 'eireli',
    'mensal', 'mensalidade', 'assinatura', 'recorrente', 'plano',
    'pagamento', 'compra', 'debito', 'credito',
    'parc', 'mparc', 'parcela',
    'sp', 'rj', 'mg', 'rs', 'pr', 'sc', 'ba', 'df', 'go', 'pe', 'ce',
]);

export function chaveNome(s) {
    const limpo = String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const palavras = limpo.split(' ').filter(p => p && !RUIDO_OPERADORA.has(p) && p.length > 1);
    // Se sobrar nada (o nome inteiro era ruído), volta ao texto limpo: é
    // melhor comparar algo do que comparar vazio e casar tudo com tudo.
    return (palavras.length ? palavras.join(' ') : limpo);
}

/**
 * Os dois nomes são o mesmo estabelecimento?
 *
 * A operadora cola as palavras: no app está "Mercado Livre" e na fatura vem
 * "MERCADOLIVRE". Comparar só a forma com espaços nunca casaria, então a
 * comparação também é feita com tudo junto.
 *
 * A contenção ("mercadolivre" contém "mercado") poderia casar demais — por
 * isso ela só é usada junto com a conferência de VALOR por quem chama.
 * Nome parecido com valor diferente não é considerado o mesmo.
 */
export function casaNome(a, b) {
    const ka = chaveNome(a), kb = chaveNome(b);
    if (!ka || !kb) return false;
    if (ka === kb) return true;
    const ja = ka.replace(/ /g, ''), jb = kb.replace(/ /g, '');
    if (ja === jb) return true;
    // Contenção só quando o menor tem corpo — "me" dentro de "mercado"
    // casaria qualquer coisa com qualquer coisa.
    const [menor, maior] = ja.length <= jb.length ? [ja, jb] : [jb, ja];
    return menor.length >= 5 && maior.includes(menor);
}

/** Dois valores são "o mesmo" dentro da tolerância. */
const mesmoValor = (a, b, tol = 0.02) => {
    const x = Math.abs(Number(a) || 0), y = Math.abs(Number(b) || 0);
    if (x === 0 && y === 0) return true;
    return Math.abs(x - y) / Math.max(x, y, 1) <= tol;
};

/** Chave de identidade de um lançamento já gravado. */
const chaveLancamento = (descricao, valor, data) =>
    `${chaveNome(descricao)}|${Math.abs(Number(valor) || 0).toFixed(2)}|${String(data || '').slice(0, 10)}`;

/**
 * Decide o destino de cada linha da importação.
 *
 * @param {object} e
 * @param {Array}  e.items      linhas extraídas: { description, amount, date, type, category }
 * @param {boolean} e.usaParcelas  ler "3/12" como parcelamento (fatura, e a pessoa não disse "à vista")
 * @param {Array}  e.assinaturas  assinaturas JÁ cadastradas no cartão: { id, name, value }
 * @param {Array}  e.parcelas     parcelamentos JÁ cadastrados no cartão:
 *                                { id, name, value, totalInstallments, currentInstallment }
 * @param {Array}  e.lancados     transações JÁ gravadas: { description, amount, date }
 *
 * @returns {{novos: Array, parcelaNova: Array, parcelaAvanca: Array,
 *            assinaturaRepetida: Array, duplicados: Array}}
 */
export function classificarImportacao({ items = [], usaParcelas = false, assinaturas = [], parcelas = [], lancados = [] }) {
    // O que já existe. São listas curtas (ninguém tem centenas de
    // assinaturas), então percorrer é mais simples — e mais correto — do que
    // indexar por chave exata: a operadora escreve o nome de um jeito e o
    // app de outro, e a chave exata nunca casaria.
    const parcelasAbertas = parcelas.map(p => ({ ...p }));
    const jaGravado = new Set(lancados.map(t => chaveLancamento(t.description, t.amount, t.date)));

    /**
     * Acha o cadastro que corresponde a esta linha: nome parecido E valor
     * dentro da tolerância.
     *
     * Os dois critérios juntos, nunca um só. Mesma loja e mesmo número de
     * parcelas podem ser DUAS compras diferentes — o valor é o que separa.
     * E nome parecido sozinho casaria "Mercado" com "Mercado Livre".
     *
     * A tolerância de 2% existe porque a última parcela às vezes fecha com
     * centavos de diferença do resto.
     */
    const acharCadastro = (lista, nome, valor, filtro = () => true) => {
        let melhor = null, menor = Infinity;
        for (const c of lista) {
            if (!filtro(c)) continue;
            if (!casaNome(c.name, nome)) continue;
            const dif = Math.abs(Math.abs(Number(c.value) || 0) - valor) / (valor || 1);
            if (dif <= 0.02 && dif < menor) { menor = dif; melhor = c; }
        }
        return melhor;
    };

    const out = { novos: [], parcelaNova: [], parcelaAvanca: [], assinaturaRepetida: [], duplicados: [] };
    // Dentro da MESMA importação a fatura pode repetir a linha (PDF com a
    // compra listada duas vezes). O que já foi decidido nesta rodada também
    // conta como existente.
    const vistosAgora = new Set();

    for (const it of items) {
        const valor = Math.abs(Number(it.amount) || 0);
        const inst = usaParcelas && it.type === 'expense' ? parseInstallment(it.description) : null;

        if (inst) {
            // O número total de parcelas tem de bater: "KABUM 3/12" e
            // "KABUM 2/10" são compras diferentes na mesma loja.
            const atual = acharCadastro(parcelasAbertas, inst.name, valor,
                (c) => Number(c.totalInstallments) === inst.total);
            if (atual) {
                // Só avança. Reimportar a MESMA fatura não pode andar com a
                // parcela, senão a dívida encolhe sem ninguém ter pago.
                if ((Number(atual.currentInstallment) || 1) < inst.current) {
                    out.parcelaAvanca.push({ it, inst, atual });
                    atual.currentInstallment = inst.current;
                } else {
                    out.duplicados.push({ it, motivo: 'parcela_ja_nesta_altura' });
                }
            } else {
                out.parcelaNova.push({ it, inst });
                // Entra na lista para que uma segunda linha igual, na MESMA
                // fatura, não crie um terceiro parcelamento.
                parcelasAbertas.push({
                    id: null, name: inst.name, value: valor,
                    totalInstallments: inst.total, currentInstallment: inst.current,
                });
            }
            continue;
        }

        // Assinatura já cadastrada: a cobrança do mês já é contabilizada pelo
        // cadastro. Lançar a linha da fatura por cima contaria duas vezes a
        // mesma Netflix — uma pelo cadastro, outra pela fatura.
        if (it.type === 'expense') {
            const assin = acharCadastro(assinaturas, it.description, valor);
            if (assin) { out.assinaturaRepetida.push({ it, assinatura: assin }); continue; }
        }

        // Mesma compra já gravada (reenvio do arquivo, ou sobreposição entre
        // a fatura deste mês e a do mês passado).
        const k = chaveLancamento(it.description, valor, it.date);
        if (jaGravado.has(k) || vistosAgora.has(k)) {
            out.duplicados.push({ it, motivo: 'lancamento_ja_existe' });
            continue;
        }
        vistosAgora.add(k);
        out.novos.push(it);
    }

    return out;
}

/** Quantos itens foram barrados — para o resumo e para a mensagem final. */
export const totalIgnorado = (c) =>
    c.duplicados.length + c.assinaturaRepetida.length;
