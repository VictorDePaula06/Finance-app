# -*- coding: utf-8 -*-
"""Gera todos os ícones e logos do app a partir de uma arte só.

A fonte é brand/logo-fonte.png — a arte oficial da marca. Tudo o que
aparece como logo no site, no PWA e no Android sai daqui, para não
existir de novo a situação de ter oito arquivos de logo levemente
diferentes e ninguém saber qual é o certo.

POR QUE LADRILHO, E NÃO LOGO TRANSPARENTE
-----------------------------------------
A arte não é um logo com fundo transparente: é uma imagem COMPOSTA, com
fundo escuro, brilho e arcos próprios. O brilho do logo e o brilho do
fundo são a mesma coisa. Tentei extrair transparência de duas formas
(alfa por luminância e desfazendo a pré-multiplicação) e as duas deixam
um retângulo cinza visível em fundo claro — porque o "fundo" tem
conteúdo real, não é preto chapado.

Então o logo vive no ladrilho dele, como foi desenhado. Funciona em
qualquer fundo, claro ou escuro, e é o que o Android e o iOS já fazem
com todo ícone de app.

O TEXTO NÃO ENTRA NO ÍCONE
--------------------------
A arte traz "ALÍVIA / Finanças" embaixo da marca. No ícone do app isso
não cabe: o ícone adaptativo do Android mostra só os 72dp centrais de
108, e o resto é cortado pela máscara — o texto sairia pela metade. E a
48dp nenhum texto é legível. Então o ícone leva a marca, e o texto
aparece onde há espaço (rodapé, verificação de e-mail).

Rodar: python scripts/gera-icones.py
"""
import json
import os
from PIL import Image, ImageDraw
import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, 'brand', 'logo-fonte.png')

# Caixa da marca dentro da arte, medida: o "A" com as barras e a folha,
# sem os arcos do topo e sem o texto de baixo.
MARCA = (303, 247, 921, 695)


def caminho(*p):
    return os.path.join(RAIZ, *p)


def salvar(img, *p):
    destino = caminho(*p)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    img.save(destino)
    print('  %-52s %s' % (os.path.relpath(destino, RAIZ), img.size))


# ── Peças ───────────────────────────────────────────────────────────

def marca_com_alfa(arte):
    """A marca recortada, com alfa tirado do canal mais forte.

    Pelo canal mais forte e não pela luminância: o logo é verde, e a
    luminância subestima verde escuro — o sombreado 3D viraria buraco.
    O halo que sobra só apareceria em fundo claro, e esta peça só é
    usada sobre fundo escuro.
    """
    x0, y0, x1, y1 = MARCA
    corte = arte.crop((x0 - 8, y0 - 8, x1 + 9, y1 + 9)).convert('RGB')
    a = np.asarray(corte).astype(float)
    alfa = np.clip((a.max(axis=2) - 12) / 52.0, 0, 1)
    return Image.fromarray(np.dstack([a, alfa * 255]).astype(np.uint8), 'RGBA')


def fundo_da_arte(arte, n):
    """O fundo escuro da arte, refeito no tamanho pedido.

    Refeito e não recortado: um recorte quadrado em volta da marca pega
    o texto junto, porque na arte o texto fica logo abaixo dela.
    """
    oa = np.asarray(arte.convert('RGB')).astype(float)
    base = oa[140:230, 50:260].reshape(-1, 3).mean(axis=0)
    centro = oa[560:660, 560:660].reshape(-1, 3).mean(axis=0) * 0.22

    yy, xx = np.mgrid[0:n, 0:n]
    r = np.sqrt((xx - n / 2) ** 2 + (yy - n * 0.46) ** 2) / (n * 0.62)
    t = np.clip(1 - r, 0, 1) ** 1.6
    img = np.zeros((n, n, 3))
    for c in range(3):
        img[:, :, c] = base[c] + (centro[c] - base[c]) * t
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def ladrilho(arte, n=1024, ocupacao=0.74):
    """Marca centrada no fundo da arte. É o ícone, em quadrado."""
    tile = fundo_da_arte(arte, n)
    m = marca_com_alfa(arte)
    larg = int(n * ocupacao)
    alt = int(m.size[1] * larg / m.size[0])
    m = m.resize((larg, alt), Image.LANCZOS)
    tile.alpha_composite(m, ((n - larg) // 2, (n - alt) // 2))
    return tile


def arredondar(img, frac=0.22):
    n = img.size[0]
    msk = Image.new('L', (n, n), 0)
    ImageDraw.Draw(msk).rounded_rectangle((0, 0, n - 1, n - 1), radius=int(n * frac), fill=255)
    out = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    out.paste(img.convert('RGBA'), (0, 0), msk)
    return out


def cor_de_fundo(tile):
    """A cor do canto do ladrilho — é ela que vai atrás do ícone adaptativo."""
    a = np.asarray(tile.convert('RGB'))
    n = a.shape[0]
    cantos = np.concatenate([a[:n // 10, :n // 10].reshape(-1, 3),
                             a[-n // 10:, -n // 10:].reshape(-1, 3)])
    r, g, b = cantos.mean(axis=0).astype(int)
    return '#%02X%02X%02X' % (r, g, b)


def main():
    arte = Image.open(FONTE).convert('RGBA')
    tile = ladrilho(arte)
    redondo = arredondar(tile)

    print('Logos do app (marca, em ladrilho):')
    for destino in ['src/assets/logo.png', 'src/assets/logo-mark.png', 'src/assets/logo-mercado.png']:
        salvar(redondo.resize((512, 512), Image.LANCZOS), destino)

    # A arte inteira, com o nome. Para os lugares que mostram o logo
    # SOZINHO, sem "Alívia" escrito ao lado — rodapé e verificação de
    # e-mail. Sem isto, o nome da marca sumiria desses dois.
    print('Logo com o nome:')
    salvar(arredondar(arte.resize((768, 768), Image.LANCZOS), 0.10), 'src/assets/logo-lockup.png')

    print('Ícones do PWA e do site:')
    quadrado = tile.convert('RGB')
    for n, destino in [(512, 'public/icon-512.png'), (192, 'public/icon-192.png'),
                       (512, 'public/icon.png'), (180, 'public/apple-touch-icon.png')]:
        salvar(quadrado.resize((n, n), Image.LANCZOS), destino)

    # Maskable: o sistema pode cortar até 20% de cada lado, então a marca
    # entra menor para caber na zona segura.
    seguro = ladrilho(arte, 1024, ocupacao=0.56).convert('RGB')
    for n, destino in [(512, 'public/icon-maskable-512.png'), (192, 'public/icon-maskable-192.png')]:
        salvar(seguro.resize((n, n), Image.LANCZOS), destino)

    ico = caminho('public', 'favicon.ico')
    quadrado.resize((256, 256), Image.LANCZOS).save(
        ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('  %-52s multi-tamanho' % 'public/favicon.ico')

    # ── Android ─────────────────────────────────────────────────────
    # O ícone adaptativo tem 108dp de tela e só os 72dp centrais
    # aparecem. A marca ocupa 56% para sobrar margem em qualquer máscara.
    print('Android:')
    DPI = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    m = marca_com_alfa(arte)
    for pasta, fator in DPI.items():
        n = int(108 * fator)
        frente = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        larg = int(n * 0.56)
        alt = int(m.size[1] * larg / m.size[0])
        frente.alpha_composite(m.resize((larg, alt), Image.LANCZOS), ((n - larg) // 2, (n - alt) // 2))
        salvar(frente, 'mobile/resources/android/mipmap-%s' % pasta, 'ic_launcher_foreground.png')

        leg = int(48 * fator)
        salvar(quadrado.resize((leg, leg), Image.LANCZOS).convert('RGBA'),
               'mobile/resources/android/mipmap-%s' % pasta, 'ic_launcher.png')
        redonda = Image.new('RGBA', (leg, leg), (0, 0, 0, 0))
        msk = Image.new('L', (leg, leg), 0)
        ImageDraw.Draw(msk).ellipse((0, 0, leg - 1, leg - 1), fill=255)
        redonda.paste(quadrado.resize((leg, leg), Image.LANCZOS).convert('RGBA'), (0, 0), msk)
        salvar(redonda, 'mobile/resources/android/mipmap-%s' % pasta, 'ic_launcher_round.png')

    cor = cor_de_fundo(tile)
    with open(caminho('mobile', 'resources', 'android', 'cor-de-fundo.txt'), 'w') as f:
        f.write(cor + '\n')
    print('  fundo do ícone adaptativo: %s (canto do ladrilho)' % cor)

    # Amostra do brilho do logo, para o checador de contraste conferir que
    # ele aparece sobre o fundo escolhido.
    #
    # Por PERCENTIL DE BRILHO, e não pelas cores mais frequentes: esta arte
    # tem sombreado 3D, então as cores mais comuns são verdes escuros e
    # contrastam mal — mas o ícone lê bem, porque quem desenha a forma são
    # os brilhos. Medir a cor mais frequente reprovaria um ícone bom.
    frente = marca_com_alfa(arte)
    fa = np.asarray(frente).astype(float)
    rgb = fa[:, :, :3][fa[:, :, 3] > 200]
    lum = 0.2126 * rgb[:, 0] + 0.7152 * rgb[:, 1] + 0.0722 * rgb[:, 2]
    amostra = {'fundo': cor}
    for p in (50, 75, 90):
        i = int(np.argmin(np.abs(lum - np.percentile(lum, p))))
        amostra['p%d' % p] = '#%02x%02x%02x' % tuple(int(v) for v in rgb[i])
    with open(caminho('brand', 'logo-amostra.json'), 'w') as f:
        json.dump(amostra, f, indent=2)
        f.write('\n')
    print('  amostra do logo: %s' % amostra)


if __name__ == '__main__':
    main()
