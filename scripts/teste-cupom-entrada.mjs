// O que o leitor de cupom aceita subir.
//
// O limite do PDF não é estético: a Vercel corta corpo de requisição em
// ~4,5 MB e base64 infla 33%. Um PDF de 4 MB vira 5,3 MB de corpo e a
// requisição morre no caminho, com um erro que não explica nada. Por isso
// o teto é 3 MB, e por isso isso tem teste.
//
// Rodar: node scripts/teste-cupom-entrada.mjs
import { validarEntrada } from '../api/_marketPhoto.js';

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

// base64 de N bytes ocupa ceil(N/3)*4 caracteres.
const base64De = (bytes) => 'A'.repeat(Math.ceil(bytes / 3) * 4);

// ── Tipos ───────────────────────────────────────────────────────────
ok(validarEntrada(base64De(1000), 'application/pdf') === null, 'PDF é aceito');
ok(validarEntrada(base64De(1000), 'image/jpeg') === null, 'JPEG é aceito');
ok(validarEntrada(base64De(1000), 'image/png') === null, 'PNG é aceito');
ok(validarEntrada(base64De(1000), 'image/webp') === null, 'WEBP é aceito');
ok(validarEntrada(base64De(1000), 'image/heic') === 'bad_mime', 'HEIC é recusado');
ok(validarEntrada(base64De(1000), 'application/zip') === 'bad_mime', 'ZIP é recusado');
ok(validarEntrada(base64De(1000), '') === 'bad_mime', 'sem tipo é recusado');

// ── Ausência ────────────────────────────────────────────────────────
ok(validarEntrada(null, 'application/pdf') === 'missing_image', 'sem arquivo');
ok(validarEntrada('', 'application/pdf') === 'missing_image', 'arquivo vazio');
ok(validarEntrada(123, 'application/pdf') === 'missing_image', 'arquivo que não é texto');

// ── Tamanho: o PDF tem teto menor que a imagem ──────────────────────
const MB = 1024 * 1024;
ok(validarEntrada(base64De(2.9 * MB), 'application/pdf') === null, 'PDF de 2,9 MB passa');
ok(validarEntrada(base64De(3.2 * MB), 'application/pdf') === 'pdf_too_large', 'PDF de 3,2 MB é recusado');
ok(validarEntrada(base64De(4 * MB), 'image/jpeg') === null, 'imagem de 4 MB passa (teto maior)');
ok(validarEntrada(base64De(7 * MB), 'image/jpeg') === 'image_too_large', 'imagem de 7 MB é recusada');

// O motivo precisa dizer QUAL dos dois estourou: a saída é diferente
// (salvar o PDF menor vs. fotografar de novo).
ok(validarEntrada(base64De(5 * MB), 'application/pdf') === 'pdf_too_large', 'PDF grande tem motivo próprio');
ok(validarEntrada(base64De(9 * MB), 'image/png') === 'image_too_large', 'imagem grande tem motivo próprio');

// ── O teto do PDF cabe mesmo no limite da Vercel ────────────────────
{
    const VERCEL = 4.5 * MB;
    const corpo = base64De(3 * MB).length + 64;   // + folga do JSON em volta
    ok(corpo < VERCEL, 'PDF no teto ainda cabe no corpo da requisição',
        `${(corpo / MB).toFixed(2)} MB de 4,5 MB`);
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
