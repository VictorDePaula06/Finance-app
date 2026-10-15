// O mesmo produto, escrito como cada mercado escreve.
//
// Estes casos vieram do pedido real: "na primeira compra comprei 4
// filezinhos e lá tem um nome respectivo ao mercado, na segunda comprei 5
// filezinhos, porém é outra marca.. Mas precisa constar a mesma coisa."
//
// O que este teste protege em DUAS direções:
//  · juntar o que é o mesmo (marca, peso e abreviação diferentes);
//  · NÃO juntar o que só parece (leite integral e leite condensado).
// A segunda importa mais: juntar demais produz um preço médio que não
// existe, e aí o número que a pessoa usa para decidir está errado.
//
// Rodar: node scripts/teste-produto-canonico.mjs
import { chaveAuto, palavrasDe, baseDaUnidade, formataQtd, resolveChave, chaveDe, consumoDoMes, rotuloDe } from '../src/utils/produtoCanonico.js';

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};
const mesmo = (a, b, nome) => ok(chaveAuto(a) === chaveAuto(b), nome, `"${chaveAuto(a)}" vs "${chaveAuto(b)}"`);
const difere = (a, b, nome) => ok(chaveAuto(a) !== chaveAuto(b), nome, `"${chaveAuto(a)}" vs "${chaveAuto(b)}"`);

console.log('── Junta: mesmo produto, mercados diferentes ──');
mesmo('LEITE INTEGRAL ITALAC 1L', 'LEITE INT PIRACANJUBA 1L', 'leite integral de duas marcas');
mesmo('ARROZ TIO JOAO 5KG', 'ARROZ 5KG', 'arroz com e sem marca');
mesmo('BANANA PRATA KG', 'Banana prata', 'peso solto no fim');
mesmo('FILEZINHO FGO 300G', 'FILE FRANGO 1KG', 'filezinho = file de frango');
mesmo('FILEZINHOS DE FRANGO', 'FILE FGO', 'plural + diminutivo + abreviação');
mesmo('CAFE 500G', 'café 500 g', 'acento e espaço');
mesmo('DETERGENTE YPE 500ML', 'DET LIMPOL 500ML', 'abreviação e marca');
mesmo('FILE DE PEITO', 'PEITO FILE', 'ordem das palavras não importa');
mesmo('OVOS BRANCOS DZ', 'OVO BRANCO', 'plural nos dois');
mesmo('REFRI COCA COLA 2L', 'REFRIGERANTE 2L', 'marca de duas palavras');

console.log('\n── Separa: parecido NÃO é igual ──');
difere('LEITE INTEGRAL 1L', 'LEITE CONDENSADO 395G', 'integral não é condensado');
difere('ARROZ BRANCO', 'ARROZ INTEGRAL', 'branco não é integral');
difere('QUEIJO MUSSARELA', 'QUEIJO PRATO', 'mussarela não é prato');
// "prato" chegou a entrar na lista de marcas por causa de "prato fino", e
// com issó QUEIJO PRATO virava só "queijo". Marca de duas palavras só vale
// junta.
ok(palavrasDe('QUEIJO PRATO').includes('prato'), 'queijo prato não perde o "prato"');
ok(!palavrasDe('ARROZ PRATO FINO 5KG').includes('prato'), 'mas "prato fino" sai como marca');
ok(palavrasDe('PEIXE NAMORADO').includes('namorado'), 'peixe namorado não perde o nome');
difere('SABAO EM PO', 'SABONETE', 'sabão não é sabonete');
difere('FILE DE FRANGO', 'FILE DE PEIXE', 'frango não é peixe');

console.log('\n── Limpeza das palavras ──');
ok(!palavrasDe('ARROZ TIO JOAO 5KG').includes('tiojoao'), 'marca de duas palavras sai');
ok(!palavrasDe('LEITE 1L PCT').includes('pct'), 'embalagem sai');
ok(!palavrasDe('TOMATE 1,5KG').some(p => /\d/.test(p)), 'número some');
ok(palavrasDe('FGO').includes('frango'), 'abreviação vira a palavra inteira');
ok(chaveAuto('SADIA 1KG') !== '', 'nome só de marca e peso não vira chave vazia');

console.log('\n── Unidades: somar o que dá para somar ──');
ok(baseDaUnidade('kg').base === 'g' && baseDaUnidade('kg').fator === 1000, 'kg vira g');
ok(baseDaUnidade('L').base === 'ml' && baseDaUnidade('L').fator === 1000, 'L vira ml');
ok(baseDaUnidade('dz').base === 'un' && baseDaUnidade('dz').fator === 12, 'dúzia vira 12 un');
ok(baseDaUnidade('pct').base === 'pct', 'pacote soma só com pacote');
ok(baseDaUnidade('un').base !== baseDaUnidade('kg').base, 'un e kg não se misturam');

// 300 g + 1 kg = 1,3 kg. O caso que faria "301" se alguém somasse os números.
{
    const total = 300 * baseDaUnidade('g').fator + 1 * baseDaUnidade('kg').fator;
    ok(total === 1300, '300 g + 1 kg = 1300 g');
    ok(formataQtd(1300, 'g').replace(/\s/g, ' ') === '1,3 kg', 'mostra como 1,3 kg', formataQtd(1300, 'g'));
}
ok(formataQtd(9, 'un') === '9 un', 'nove unidades', formataQtd(9, 'un'));
ok(formataQtd(2000, 'ml') === '2 L', 'dois litros', formataQtd(2000, 'ml'));

// O caso do pedido, ponta a ponta: 4 + 5 filezinhos de marcas diferentes.
console.log('\n── O caso do pedido ──');
{
    const a = { name: 'FILEZINHO FGO SADIA 300G', qty: 4, unit: 'un' };
    const b = { name: 'FILE DE FRANGO PERDIGAO 1KG', qty: 5, unit: 'un' };
    ok(chaveAuto(a.name) === chaveAuto(b.name), 'as duas compras caem na mesma linha', chaveAuto(a.name));
    ok(a.qty + b.qty === 9, 'e somam 9');
}

console.log('');
console.log('-- Apelidos: a correcao da pessoa vence --');
{
    // A pessoa disse: "arroz branco" e a mesma coisa que "arroz".
    const mapa = { 'arroz branco': 'arroz' };
    ok(resolveChave('arroz branco', mapa) === 'arroz', 'a seta e seguida');
    ok(chaveDe('ARROZ BRANCO CAMIL 5KG', mapa) === 'arroz', 'e vale para o nome cru do cupom');
    ok(resolveChave('arroz', mapa) === 'arroz', 'quem nao tem seta fica como esta');
    ok(resolveChave('a', { a: 'b', b: 'c' }) === 'c', 'cadeia de setas chega no fim');
    // A -> B -> A travaria o laco; o limite de voltas existe para isso.
    ok(['a', 'b'].includes(resolveChave('a', { a: 'b', b: 'a' })), 'seta circular nao trava');
}

console.log('');
console.log('-- Consumo do mes --');
{
    const compras = [
        { date: '2026-10-02', store: 'Guanabara', items: [{ name: 'FILEZINHO FGO SADIA 300G', qty: 4, unit: 'un', unitPrice: 12.5 }] },
        { date: '2026-10-20', store: 'Assai', items: [{ name: 'FILE DE FRANGO PERDIGAO 1KG', qty: 5, unit: 'un', unitPrice: 13.9 }] },
        { date: '2026-09-28', store: 'Antigo', items: [{ name: 'FILE FRANGO', qty: 99, unit: 'un', unitPrice: 1 }] },
    ];
    const r = consumoDoMes(compras, '2026-10', {}, {});
    ok(r.length === 1, 'as duas marcas viram UMA linha', r.length + ' linha(s)');

    const f = r[0];
    ok(f.quantidades[0].qtd === 9, 'quantidade somada: 4 + 5 = 9', String(f.quantidades[0].qtd));
    ok(f.gasto === 119.5, 'gasto do mes', String(f.gasto));
    ok(f.vezes === 2, 'comprado 2 vezes');
    ok(f.ultimo.preco === 13.9, 'ultimo preco pago e o mais recente', String(f.ultimo.preco));
    ok(f.ultimo.store === 'Assai', 'e lembra de qual mercado');
    ok(f.nomes.length === 2, 'guarda os dois nomes originais');
    ok(f.quantidades[0].qtd !== 108, 'compra de setembro fica de fora');
}

{
    // Grandezas diferentes nao se somam: 1 kg e 2 un sao duas medidas, e
    // inventar conversao entre elas seria mentira.
    const r = consumoDoMes([{ date: '2026-10-01', items: [
        { name: 'CARNE MOIDA', qty: 1, unit: 'kg', unitPrice: 40 },
        { name: 'CARNE MOIDA', qty: 2, unit: 'un', unitPrice: 20 },
    ] }], '2026-10', {}, {});
    ok(r[0].quantidades.length === 2, 'kg e un aparecem separados');
    ok(r[0].gasto === 80, 'mas o gasto soma os dois', String(r[0].gasto));
}

{
    // 300 g + 1 kg: o caso que viraria "301" se alguem somasse os numeros.
    const r = consumoDoMes([{ date: '2026-10-01', items: [
        { name: 'QUEIJO MUSSARELA', qty: 300, unit: 'g', unitPrice: 0.05 },
        { name: 'QUEIJO MUSSARELA', qty: 1, unit: 'kg', unitPrice: 45 },
    ] }], '2026-10', {}, {});
    ok(r[0].quantidades[0].qtd === 1300, '300 g + 1 kg = 1300 g', String(r[0].quantidades[0].qtd));
    ok(formataQtd(r[0].quantidades[0].qtd, 'g') === '1,3 kg', 'e aparece como 1,3 kg');
}

{
    // Rotulo escolhido a mao ganha do automatico.
    const r = consumoDoMes([{ date: '2026-10-01', items: [{ name: 'FILEZINHO FGO SADIA 300G', qty: 1, unit: 'un', unitPrice: 10 }] }],
        '2026-10', {}, { 'file frango': 'Filezinho' });
    ok(r[0].rotulo === 'Filezinho', 'o nome que a pessoa deu e o que aparece', r[0].rotulo);
}

console.log('');
console.log('');
console.log('-- Nome visivel: do cupom para o humano --');
{
    // A chave ordena em alfabetica para poder comparar; o rotulo NAO pode,
    // senao vira "Integral leite", que nao e nome de nada.
    ok(rotuloDe('LEITE INT ITALAC 1L') === 'Leite integral', 'ordem original, nao alfabetica', rotuloDe('LEITE INT ITALAC 1L'));
    ok(rotuloDe('FILEZINHO FGO SADIA 300G') === 'File frango', 'marca e peso saem', rotuloDe('FILEZINHO FGO SADIA 300G'));
    ok(rotuloDe('ARROZ TIO JOAO 5KG') === 'Arroz', 'marca de duas palavras sai', rotuloDe('ARROZ TIO JOAO 5KG'));
    ok(rotuloDe('DET YPE NEUTRO 500ML') === 'Detergente neutro', 'abreviacao vira palavra', rotuloDe('DET YPE NEUTRO 500ML'));
    // Nome que some inteiro na limpeza devolve o original, nao vazio.
    ok(rotuloDe('SADIA 1KG').length > 0, 'nome so de marca nao vira vazio', rotuloDe('SADIA 1KG'));
    ok(rotuloDe('') === '', 'nome vazio continua vazio');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
