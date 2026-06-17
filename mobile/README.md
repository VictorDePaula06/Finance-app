# Alívia — App Mobile (Android)

App mobile dedicado da Alívia. **Projeto isolado** do site: nada aqui altera o web
(que continua na raiz do repositório). A integração será pelo **mesmo Firebase**
(mesmo banco) — milestone 2.

## Como visualizar no PC (rápido, sem instalar nada além do projeto)

```bash
cd mobile
npm install      # só na primeira vez
npm run dev
```

Abra o endereço que aparecer (ex.: http://localhost:5174). No Chrome, aperte **F12**
e clique no ícone de **dispositivo** (Toggle device toolbar) para ver em formato de
celular. Em telas grandes o app já aparece centralizado como um "celular".

## Status

- **Milestone 1 (atual):** layout/identidade no estilo do modelo + barra de abas
  inferior (Geral, Recebimentos, Lançamentos, Análises, Ajustes) + aba **Geral**
  com acesso rápido ao chat da Alívia (com botão de **áudio**). Usa **dados de
  exemplo** só para validar o visual.
- **Próximos:** integrar Firebase (mesmo banco do site, login Google, dados reais),
  construir as demais abas e empacotar com Capacitor para gerar o `.aab` do Android.
