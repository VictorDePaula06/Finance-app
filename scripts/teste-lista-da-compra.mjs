// Marcar "compra do mês" não pode estragar a lista que já existe.
//
// A decisão foi SOMAR, não substituir. Então o que este teste protege é:
// nada do que já estava lá some, e nada vira linha duplicada só porque o
// mercado escreveu o nome de outro jeito.
//
// Rodar: node scripts/teste-lista-da-compra.mjs
import { planejaLista } from '../src/utils/listaDaCompra.js';

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

console.log('-- Lista vazia: tudo entra --');
{
    const { criar, somar } = planejaLista(
        [{ name: 'ARROZ TIO JOAO 5KG', qty: 1, unit: 'un' }, { name: 'LEITE INT 1L', qty: 6, unit: 'un' }],
        [], {});
    ok(criar.length === 2, 'dois produtos novos', criar.length + '');
    ok(somar.length === 0, 'nada para somar');
}

console.log('');
console.log('-- O mesmo produto no MESMO cupom vira uma linha --');
{
    // Exatamente o caso do pedido, só que dentro de uma compra só.
    const { criar } = planejaLista([
        { name: 'FILEZINHO FGO SADIA 300G', qty: 4, unit: 'un' },
        { name: 'FILE DE FRANGO PERDIGAO 1KG', qty: 5, unit: 'un' },
    ], [], {});
    ok(criar.length === 1, 'uma linha, não duas', criar.length + ' linha(s)');
    ok(criar[0].qty === 9, 'com 4 + 5 = 9', String(criar[0]?.qty));
}

console.log('');
console.log('-- Produto que JÁ está na lista soma, não duplica --');
{
    const lista = [{ id: 'x1', name: 'File de frango', qty: 2, unit: 'un' }];
    const { criar, somar } = planejaLista(
        [{ name: 'FILE DE FRANGO PERDIGAO 1KG', qty: 5, unit: 'un' }], lista, {});
    ok(criar.length === 0, 'não cria linha nova');
    ok(somar.length === 1 && somar[0].id === 'x1', 'soma na linha que existe');
    ok(somar[0].qty === 7, '2 que já tinha + 5 da compra = 7', String(somar[0]?.qty));
}

console.log('');
console.log('-- O limite do automático, escrito às claras --');
{
    // "Filezinho" sozinho vira a chave "file"; "FILE DE FRANGO" vira
    // "file frango". O automático NÃO junta os dois — e isso é de propósito:
    // juntar por palavra contida faria "file de peixe" virar frango também.
    //
    // Este teste existe para que a limitação seja uma decisão registrada, e
    // não uma surpresa. A saída é a junção à mão, testada logo abaixo.
    const lista = [{ id: 'x1', name: 'Filezinho', qty: 2, unit: 'un' }];
    const semApelido = planejaLista([{ name: 'FILE DE FRANGO PERDIGAO 1KG', qty: 5, unit: 'un' }], lista, {});
    ok(semApelido.criar.length === 1, 'sem apelido, vira linha separada');

    // E com a junção feita uma vez, nunca mais.
    const comApelido = planejaLista(
        [{ name: 'FILE DE FRANGO PERDIGAO 1KG', qty: 5, unit: 'un' }], lista, { 'file frango': 'file' });
    ok(comApelido.criar.length === 0, 'com apelido, não duplica mais');
    ok(comApelido.somar[0]?.qty === 7, 'e soma: 2 + 5 = 7', String(comApelido.somar[0]?.qty));
}

console.log('');
console.log('-- O que a pessoa montou à mão não se perde --');
{
    const lista = [
        { id: 'a', name: 'Papel higiênico', qty: 1, unit: 'pct' },
        { id: 'b', name: 'Fermento', qty: 2, unit: 'un' },
    ];
    const { criar, somar } = planejaLista([{ name: 'ARROZ 5KG', qty: 1, unit: 'un' }], lista, {});
    ok(criar.length === 1 && criar[0].name.includes('ARROZ'), 'o arroz entra');
    ok(somar.length === 0, 'e os dois itens à mão ficam intocados');
}

console.log('');
console.log('-- Peso: 300 g + 1 kg somam de verdade --');
{
    const lista = [{ id: 'q', name: 'QUEIJO MUSSARELA', qty: 300, unit: 'g' }];
    const { somar } = planejaLista([{ name: 'QUEIJO MUSSARELA FATIADO 1KG', qty: 1, unit: 'kg' }], lista, {});
    ok(somar.length === 1, 'cai na linha do queijo');
    ok(somar[0].qty === 1300, 'em gramas: 300 + 1000 = 1300', String(somar[0]?.qty));
}

console.log('');
console.log('-- Grandezas que não se convertem ficam separadas --');
{
    // 2 un de carne e 1 kg de carne são medidas diferentes. Somar daria um
    // número que não quer dizer nada.
    const lista = [{ id: 'c', name: 'CARNE MOIDA', qty: 2, unit: 'un' }];
    const { criar, somar } = planejaLista([{ name: 'CARNE MOIDA', qty: 1, unit: 'kg' }], lista, {});
    ok(somar.length === 0, 'não soma un com kg');
    ok(criar.length === 1 && criar[0].unit === 'kg', 'cria a linha em kg', JSON.stringify(criar[0]));
}

console.log('');
console.log('-- Apelidos valem aqui também --');
{
    const mapa = { 'arroz branco': 'arroz' };
    const lista = [{ id: 'r', name: 'Arroz', qty: 1, unit: 'un' }];
    const { criar, somar } = planejaLista([{ name: 'ARROZ BRANCO CAMIL 5KG', qty: 2, unit: 'un' }], lista, mapa);
    ok(criar.length === 0, 'a junção feita à mão é respeitada');
    ok(somar[0]?.qty === 3, 'e soma na linha certa', String(somar[0]?.qty));
}

console.log('');
console.log('-- Lixo não entra --');
{
    const { criar } = planejaLista([
        { name: '', qty: 5, unit: 'un' },
        { name: 'VALIDO', qty: 0, unit: 'un' },
        { name: 'TAMBEM VALIDO', qty: -3, unit: 'un' },
    ], [], {});
    ok(criar.length === 0, 'nome vazio e quantidade não positiva são ignorados', criar.length + '');
}

console.log('');
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exit(falhas ? 1 : 0);
