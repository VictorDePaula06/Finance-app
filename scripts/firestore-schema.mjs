// Introspecção do Firestore AO VIVO → gera um resumo dos campos por coleção
// e um diagrama (mermaid) em docs/banco-alivia-live.md.
//
// Uso:
//   1) Baixe a chave de serviço (Firebase Console → Configurações → Contas de
//      serviço → Gerar nova chave privada) e salve como serviceAccount.json na raiz.
//   2) node scripts/firestore-schema.mjs
//
// Nada da chave é impresso; ela só é usada para conectar.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = process.env.SA_PATH || './serviceAccount.json';
const SAMPLES = 25;   // documentos amostrados por coleção
const SUBSAMPLE = 8;  // documentos verificados para achar subcoleções

if (!existsSync(KEY)) {
  console.error(`\n❌ Não encontrei a chave em "${KEY}".\n   Baixe em: Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada.\n   Salve como serviceAccount.json na raiz do projeto e rode de novo.\n`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(KEY, 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (v && typeof v === 'object') {
    if (typeof v.toDate === 'function') return 'timestamp';
    if ('_latitude' in v || 'latitude' in v) return 'geopoint';
    if (v.constructor && v.constructor.name === 'DocumentReference') return 'reference';
    return 'map';
  }
  return typeof v; // string | number | boolean
};

async function scanCollection(colRef, path, depth, out) {
  const snap = await colRef.limit(SAMPLES).get();
  if (snap.empty) return;
  const fields = {}; // nome -> Set de tipos
  let count = 0;
  snap.forEach(doc => {
    count++;
    const data = doc.data() || {};
    for (const [k, v] of Object.entries(data)) {
      (fields[k] ||= new Set()).add(typeOf(v));
    }
  });
  out.collections.push({
    path, depth,
    sampled: count,
    fields: Object.entries(fields).map(([name, set]) => ({ name, types: [...set].join(' | ') })).sort((a, b) => a.name.localeCompare(b.name)),
  });

  // Procura subcoleções em alguns documentos.
  const subNames = new Set();
  const docs = snap.docs.slice(0, SUBSAMPLE);
  for (const d of docs) {
    const subs = await d.ref.listCollections();
    for (const s of subs) subNames.add(s.id);
  }
  for (const sub of subNames) {
    const exampleDoc = snap.docs[0];
    await scanCollection(exampleDoc.ref.collection(sub), `${path}/{id}/${sub}`, depth + 1, out);
  }
}

(async () => {
  console.log('🔗 Conectando ao Firestore e lendo a estrutura…');
  const roots = await db.listCollections();
  const out = { collections: [] };
  for (const c of roots) await scanCollection(c, c.id, 0, out);

  // Markdown + mermaid
  let md = `# Banco de dados (Firestore) — estrutura ao vivo\n\n`;
  md += `Gerado em ${new Date().toLocaleString('pt-BR')} a partir dos dados reais (amostra de ${SAMPLES} docs por coleção).\n\n`;
  md += `## Coleções e campos\n\n`;
  for (const col of out.collections) {
    md += `### \`${col.path}\`  _(amostra: ${col.sampled})_\n\n`;
    if (!col.fields.length) { md += `_(sem campos amostrados)_\n\n`; continue; }
    md += `| Campo | Tipo(s) |\n|---|---|\n`;
    for (const f of col.fields) md += `| ${f.name} | ${f.types} |\n`;
    md += `\n`;
  }
  // Diagrama mermaid (uma entidade por coleção)
  md += `## Diagrama\n\n\`\`\`mermaid\nerDiagram\n`;
  const safe = (s) => s.replace(/[^A-Za-z0-9_]/g, '_');
  for (const col of out.collections) {
    md += `  ${safe(col.path)} {\n`;
    for (const f of col.fields.slice(0, 20)) md += `    ${safe(f.types.split(' ')[0])} ${safe(f.name)}\n`;
    md += `  }\n`;
  }
  md += `\`\`\`\n`;

  if (!existsSync('docs')) mkdirSync('docs');
  writeFileSync('docs/banco-alivia-live.md', md, 'utf8');
  console.log(`✅ Pronto! ${out.collections.length} coleções/subcoleções.`);
  console.log(`   Arquivo: docs/banco-alivia-live.md`);
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
