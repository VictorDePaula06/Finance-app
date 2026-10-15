/**
 * Verificar o ID token do Firebase sem o firebase-admin/auth.
 *
 * Por que não usar `getAuth().verifyIdToken()`, que seria o óbvio:
 * firebase-admin/auth puxa jwks-rsa, e o jwks-rsa@4 faz `require('jose')` na
 * primeira linha. O jose@6 é ESM puro, e `require()` de ESM só funciona a
 * partir do Node 22.12. Abaixo disso o módulo nem CARREGA — a função inteira
 * morre antes de rodar uma linha nossa, com ERR_REQUIRE_ESM.
 *
 * Isso já tinha derrubado o leitor de cupom em produção, e derrubava junto
 * (em silêncio) o send-push e o upgrade-subscription, que ninguém tinha
 * testado desde então.
 *
 * Aqui o token é verificado direto com o jose, importado como ESM, contra as
 * chaves públicas do Firebase. Mesma garantia criptográfica, e sem depender
 * da versão do Node que a hospedagem resolver usar.
 *
 * O padrão foi provado antes em create-annual-checkout.js; isto aqui é ele
 * virando um lugar só, para não existir uma quarta cópia.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

// O conjunto de chaves é cacheado pelo jose e revalidado sozinho.
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/**
 * Devolve o payload do token. Lança se a assinatura, o emissor, a audiência
 * ou a validade não conferirem — quem chama trata como 401.
 *
 * @param {string} idToken
 * @param {string} projectId  project_id do service account
 */
export async function verificarIdToken(idToken, projectId) {
    if (!projectId) throw new Error('projectId ausente');
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
    });
    // `sub` é o uid. Token sem sub não identifica ninguém.
    if (!payload.sub) throw new Error('token sem sub');
    return payload;
}
