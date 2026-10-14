// ── Chave de acesso da NFC-e ────────────────────────────────────────
// Os 44 dígitos impressos no rodapé do cupom. Eles não são um número solto:
// cada pedaço diz uma coisa, e o último dígito confere os outros 43.
//
//   cUF    2   código IBGE do estado        33 = RJ
//   AAMM   4   ano e mês da emissão
//   CNPJ  14   de quem emitiu
//   mod    2   modelo: 65 = NFC-e, 55 = NF-e
//   série  3
//   nNF    9   número da nota
//   tpEmis 1
//   cNF    8   código numérico
//   cDV    1   dígito verificador (módulo 11)
//
// O que a chave NÃO diz: os produtos. Item e preço só existem na nota em si,
// no portal da SEFAZ — por isso digitar a chave identifica a compra, mas
// buscar os itens continua dependendo do portal responder.

const UF_POR_CODIGO = {
    11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
    21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
    31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
    41: 'PR', 42: 'SC', 43: 'RS',
    50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

// Portal de consulta por estado. Só entram hosts que o servidor aceita
// (a mesma lista de api/_nfce.js) — de nada adianta montar uma URL que vai
// ser recusada por segurança do outro lado.
//
// Quem não tem portal próprio consulta pelo SVRS, que atende vários estados.
const SVRS = 'https://dfe-portal.svrs.rs.gov.br/NFCE/NFCE-COM?p=';
const PORTAL_POR_UF = {
    RJ: 'http://www4.fazenda.rj.gov.br/consultaNFCe/QRCode?p=',
    SP: 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=',
    MG: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=',
    MT: 'https://www.sefaz.mt.gov.br/nfce/consultanfce?p=',
    RS: 'https://www.sefaz.rs.gov.br/ASP/AAE_ROOT/NFE/SAT-WEB-NFE-NFC_QRCODE_1.asp?p=',
    PR: 'https://nfce.fazenda.pr.gov.br/consulta?p=',
    GO: 'https://nfce.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=',
    BA: 'https://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=',
    CE: 'https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=',
    RN: 'http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=',
    PE: 'http://nfce.sefaz.pe.gov.br/nfce/consulta?p=',
    ES: 'http://www.sefaz.es.gov.br/ConsultaNFCe.aspx?p=',
};

/** Só os dígitos — a pessoa cola com espaço, ponto, o que vier. */
export const digitosDaChave = (texto) => String(texto ?? '').replace(/\D/g, '');

/**
 * Dígito verificador (módulo 11) dos 43 primeiros dígitos.
 *
 * Pesos 2..9 girando da direita para a esquerda. Resto 0 ou 1 vira DV 0 —
 * é a regra do manual, não um atalho: sem ela o DV poderia dar 10 ou 11,
 * que não cabem numa casa.
 */
export const dvDaChave = (dig43) => {
    let soma = 0;
    let peso = 2;
    for (let i = dig43.length - 1; i >= 0; i--) {
        soma += Number(dig43[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto === 0 || resto === 1 ? 0 : 11 - resto;
};

/**
 * Lê a chave e diz tudo que dá para saber sem sair do aparelho.
 *
 * Devolve `{ ok: false, erro }` com um motivo específico — "chave inválida"
 * sozinho não ajuda ninguém a achar o dígito errado entre 44.
 */
export function lerChave(texto) {
    const d = digitosDaChave(texto);

    if (!d) return { ok: false, erro: 'vazia', digitos: 0 };
    if (d.length !== 44) return { ok: false, erro: d.length < 44 ? 'curta' : 'longa', digitos: d.length };

    const cUF = Number(d.slice(0, 2));
    const uf = UF_POR_CODIGO[cUF];
    if (!uf) return { ok: false, erro: 'uf', digitos: 44 };

    if (dvDaChave(d.slice(0, 43)) !== Number(d[43])) return { ok: false, erro: 'dv', digitos: 44 };

    const ano = 2000 + Number(d.slice(2, 4));
    const mes = Number(d.slice(4, 6));
    if (mes < 1 || mes > 12) return { ok: false, erro: 'data', digitos: 44 };

    const modelo = d.slice(20, 22);

    return {
        ok: true,
        chave: d,
        uf,
        cUF,
        ano,
        mes,
        // Só ano e mês: o dia não está na chave. Serve para o formulário já
        // abrir no mês certo, não para carimbar uma data que não existe ali.
        mesEmissao: `${ano}-${String(mes).padStart(2, '0')}`,
        cnpj: d.slice(6, 20),
        modelo,
        ehNfce: modelo === '65',
        serie: Number(d.slice(22, 25)),
        numero: Number(d.slice(25, 34)),
        portal: PORTAL_POR_UF[uf] || SVRS,
    };
}

/** CNPJ com a máscara, para ninguém precisar contar dígito na tela. */
export const formataCnpj = (d) => {
    const s = digitosDaChave(d).padStart(14, '0');
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
};

/** A chave em blocos de 4, que é como ela vem impressa no cupom. */
export const formataChave = (texto) => (digitosDaChave(texto).match(/.{1,4}/g) || []).join(' ');

/**
 * URL de consulta no portal do estado.
 *
 * Importante: o QR impresso leva, além da chave, um hash assinado com um
 * segredo do lojista. Digitando só a chave esse hash não existe, então o
 * portal pode recusar. É por isso que a consulta por chave é uma TENTATIVA —
 * quando ela não volta, a compra segue pelo formulário, já identificada.
 */
export const urlDeConsulta = (info) => (info?.ok ? info.portal + info.chave : null);

export default lerChave;
