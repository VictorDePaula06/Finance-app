// Cores de cartão — MESMAS opções do site (CardsTab): azul, roxo, esmeralda,
// rosa e preto (slate-800). O site salva a classe Tailwind em `card.color`.
// Aqui mapeamos cada uma para um gradiente do cartão, mantendo fidelidade: um
// cartão salvo como preto na web aparece preto no app (antes ficava sempre roxo).

// Ordem e valores idênticos ao site (mantém compatibilidade dos dados).
export const CARD_COLORS = ['bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-rose-600', 'bg-slate-800'];

// Gradiente do visual do cartão por cor. As strings são literais para o Tailwind
// gerar as classes (purge). Fallback = preto/grafite.
const GRADIENTS = {
  'bg-blue-600': 'from-blue-500 via-blue-600 to-blue-800',
  'bg-purple-600': 'from-fuchsia-600 via-purple-700 to-indigo-800',
  'bg-emerald-600': 'from-emerald-500 via-emerald-600 to-teal-800',
  'bg-rose-600': 'from-rose-500 via-rose-600 to-pink-800',
  'bg-slate-800': 'from-slate-700 via-slate-800 to-slate-950',
};

export const cardGradient = (color) => GRADIENTS[color] || GRADIENTS['bg-slate-800'];
