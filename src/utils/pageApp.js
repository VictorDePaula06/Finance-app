import { useEffect } from 'react';

// ── Identidade própria de uma página ────────────────────────────────
// O app é uma página só (SPA): um index.html, um ícone, um manifesto. Uma
// tela que vive sozinha — como a sala de gráficos — quer o próprio ícone na
// aba e o próprio manifesto, para o navegador poder instalá-la como um app
// separado do Alívia principal.
//
// Trocar as tags enquanto a tela está aberta resolve os dois casos, desde
// que o estado anterior volte ao sair: senão o resto do app fica com o
// ícone errado e o manifesto da outra tela.

export function usePageApp({ icon, manifest, title }) {
    useEffect(() => {
        const head = document.head;

        // Guarda os ícones atuais e põe o da página no lugar.
        const anteriores = [...head.querySelectorAll('link[rel~="icon"]')];
        anteriores.forEach(l => l.remove());

        let proprio = null;
        if (icon) {
            proprio = document.createElement('link');
            proprio.rel = 'icon';
            proprio.type = 'image/png';
            proprio.href = icon;
            head.appendChild(proprio);
        }

        // O manifesto é o que o navegador lê para oferecer "instalar".
        // Trocar o href faz o Chromium reler.
        const linkManifesto = head.querySelector('link[rel="manifest"]');
        const manifestoAnterior = linkManifesto?.getAttribute('href') || null;
        if (linkManifesto && manifest) linkManifesto.setAttribute('href', manifest);

        const tituloAnterior = document.title;
        if (title) document.title = title;

        return () => {
            proprio?.remove();
            anteriores.forEach(l => head.appendChild(l));
            if (linkManifesto && manifestoAnterior) linkManifesto.setAttribute('href', manifestoAnterior);
            if (title) document.title = tituloAnterior;
        };
    }, [icon, manifest, title]);
}
