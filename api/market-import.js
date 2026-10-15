/**
 * Vercel Serverless Function: /api/market-import
 *
 * Porta única para lançar uma compra de mercado. Os dois caminhos da tela
 * entram por aqui:
 *
 *   GET  /api/market-import?url=<URL do QR Code>   → lê a NFC-e no portal da SEFAZ
 *   POST /api/market-import  { image, mime }       → lê a foto do cupom com IA
 *
 * Por que juntos: eram duas funções, `/api/nfce` e `/api/market-photo`. O
 * plano Hobby da Vercel aceita no máximo 12 Serverless Functions por
 * deployment, e a segunda delas era a 13ª — todo deploy desde então falhava,
 * e o site ficou parado na versão anterior sem ninguém perceber.
 *
 * A fusão não é um remendo: as duas respondem à MESMA pergunta ("quais
 * produtos tem neste cupom?"), só mudam a entrada. O método já separa as
 * duas sem ambiguidade, então não precisou inventar parâmetro de modo.
 *
 * As implementações continuam em arquivos próprios (`_nfce.js` e
 * `_marketPhoto.js`) — o `_` faz a Vercel tratá-los como módulo, não como
 * função. Aqui só mora o despachante.
 */

// Carregados sob demanda, não no topo. Dois motivos:
//
// 1. Cada caminho puxa coisas diferentes — o da foto arrasta o firebase-admin
//    inteiro, que a leitura do QR Code não usa para nada. Importando em cima,
//    um GET pagava o custo (e o risco) de carregar tudo.
// 2. Se um dos dois não carregar no servidor, só o caminho dele quebra. Com
//    import estático, qualquer tropeço num deles derrubava a função toda,
//    inclusive o preflight — foi exatamente o que aconteceu no primeiro
//    deploy desta fusão: OPTIONS respondia 500 sem nem chegar ao despachante.
// Ler um PDF de cupom no Gemini leva bem mais que os 10s que a Vercel dá por
// padrão: são várias páginas e dezenas de itens. Sem isto a função era morta
// no meio da leitura, e o que chegava na tela era um 500 sem explicação
// nenhuma — nem nosso JSON, porque o processo nem chegava a responder.
// 60s é o teto do plano Hobby.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
    try {
        return await despachar(req, res);
    } catch (e) {
        // Exceção aqui virava FUNCTION_INVOCATION_FAILED: 500 com corpo que não
        // é JSON, e a tela não tinha o que mostrar além de "http_500". Um erro
        // que não se identifica custa um ciclo inteiro de ida e volta para
        // descobrir o óbvio. Então ele se identifica.
        console.error('[market-import]', e);
        if (res.writableEnded) return;
        return res.status(500).json({
            error: 'crash',
            detail: String(e?.message || e).slice(0, 200),
        });
    }
}

async function despachar(req, res) {
    if (req.method === 'GET') {
        const { lerPorQrCode } = await import('./_nfce.js');
        return lerPorQrCode(req, res);
    }
    if (req.method === 'POST') {
        const { lerPorFoto } = await import('./_marketPhoto.js');
        return lerPorFoto(req, res);
    }

    // OPTIONS cai aqui no preflight do POST; os dois módulos já respondem a
    // ele, mas sem saber qual deles é o alvo, respondemos por ambos.
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'method_not_allowed' });
}
