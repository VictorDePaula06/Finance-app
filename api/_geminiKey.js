/**
 * A chave do Gemini, uma fonte só.
 *
 * Existiam duas: o WhatsApp lia `admin_configs/whatsapp.geminiKey` no
 * Firestore (a que o dev configura no painel), e o leitor de cupom lia só a
 * variável de ambiente. Quem configurasse a chave pelo painel ficava com o
 * WhatsApp funcionando e o cupom dizendo que não tem chave — dois recursos
 * que a pessoa pensa como "a IA da Alívia" se comportando diferente.
 *
 * Aqui é o único lugar que decide de onde a chave vem. Firestore primeiro,
 * ambiente como reserva, cache por processo para não bater no Firestore a
 * cada requisição.
 */

let cache = { key: null, at: 0 };
const TTL = 60000;

const limpa = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : null;

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<string|null>}
 */
export async function getGeminiKey(db) {
    const agora = Date.now();
    if (cache.key && (agora - cache.at) < TTL) return cache.key;

    let k = null;
    if (db) {
        try {
            const snap = await db.collection('admin_configs').doc('whatsapp').get();
            k = limpa(snap.data()?.geminiKey);
        } catch (e) {
            // Firestore fora do ar não pode derrubar quem tem a env var.
            console.error('getGeminiKey (firestore):', e);
        }
    }
    if (!k) k = limpa(process.env.GEMINI_API_KEY);
    if (k) cache = { key: k, at: agora };
    return k;
}
