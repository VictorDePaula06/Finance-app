// ── Preço ao vivo ───────────────────────────────────────────────────
// A Binance publica cada negócio fechado por WebSocket, sem chave. É tempo
// real de verdade: o preço muda no mesmo instante em que alguém negocia.
//
// Só cripto tem isso de graça. Ação, índice e commodity não têm stream
// público — esses continuam por consulta repetida ao /api/quotes, e o dado
// da fonte já vem com atraso. A tela diz qual é qual em vez de fingir.

// Dois endereços equivalentes. O primeiro é o principal; a porta explícita
// :9443 foi deixada de fora porque abre e fica mudo em algumas redes. Se a
// conexão cair, a reconexão alterna entre eles.
const WS_HOSTS = [
    'wss://stream.binance.com/stream?streams=',
    'wss://data-stream.binance.vision/stream?streams=',
];

// Assina o fluxo de negócios dos tickers e chama onTick a cada preço novo.
// Devolve a função que encerra tudo.
//
// onTick({ ticker, price, t })
export function openTradeStream(tickers, onTick) {
    const list = [...new Set((tickers || []).map(t => String(t).toUpperCase()))].filter(Boolean);
    if (!list.length) return () => { };

    let ws = null;
    let closed = false;
    let retry = 0;
    let timer = null;

    const connect = () => {
        if (closed) return;
        const streams = list.map(t => `${t.toLowerCase()}usdt@trade`).join('/');
        const host = WS_HOSTS[retry % WS_HOSTS.length];
        try {
            ws = new WebSocket(host + streams);
        } catch {
            return schedule();
        }

        ws.onopen = () => { retry = 0; };

        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                const d = msg?.data;
                if (!d || !d.s) return;
                const price = Number(d.p);
                if (!isFinite(price)) return;
                // d.s é "BTCUSDT": tira o par para voltar ao ticker do app.
                onTick({ ticker: d.s.replace(/USDT$/, ''), price, t: d.T || Date.now() });
            } catch { /* quadro malformado: ignora */ }
        };

        ws.onerror = () => { try { ws.close(); } catch { /* já fechado */ } };
        ws.onclose = () => { if (!closed) schedule(); };
    };

    // Reconecta com espera crescente (1s, 2s, 4s… até 30s), para não martelar
    // o servidor quando a rede cai.
    const schedule = () => {
        if (closed) return;
        const wait = Math.min(30000, 1000 * 2 ** retry);
        retry += 1;
        clearTimeout(timer);
        timer = setTimeout(connect, wait);
    };

    connect();

    return () => {
        closed = true;
        clearTimeout(timer);
        try { ws?.close(); } catch { /* já fechado */ }
    };
}

// Praças e horário de funcionamento — usado para saber se o mercado está
// aberto e com que frequência vale a pena consultar a cotação.
const hourIn = (tz) => {
    const p = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
    }).formatToParts(new Date());
    const get = (k) => p.find(x => x.type === k)?.value;
    return { h: +get('hour'), m: +get('minute'), wd: get('weekday') };
};

export function isMarketOpen(group) {
    if (group === 'cripto') return true;                     // 24/7
    const br = group === 'acoes_br' || group === 'fiis';
    const { h, m, wd } = hourIn(br ? 'America/Sao_Paulo' : 'America/New_York');
    if (wd === 'Sat' || wd === 'Sun') return false;
    const mins = h * 60 + m;
    // B3: 10h–17h. NYSE/Nasdaq: 9h30–16h. Índices e commodities seguem os EUA.
    return br ? mins >= 600 && mins < 1020 : mins >= 570 && mins < 960;
}
