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
export default async function handler(req, res) {
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
