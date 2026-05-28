/**
 * Mapeamento entre IDs internos (usados no state) e slugs amigáveis
 * (usados na URL). Fonte única de verdade para a estrutura de rotas
 * da área logada.
 *
 * Estrutura:
 *   /inicio              → Hub (escolha de módulo)
 *   /gastos/:tab         → Módulo Controle de Gastos
 *   /patrimonio/:tab     → Módulo Construção de Patrimônio
 *   /ajustes             → Settings
 *   /admin/:section?     → AdminPanel
 */

// Slug por aba (URL) → id interno (state)
export const TAB_SLUG_TO_ID = {
    // Gastos
    'visao-geral':       'visao',
    'recebimentos':      'entradas',
    'contas-fixas':      'fixas',
    'lancamentos':       'gastos',
    'cartoes':           'cartoes',
    'analise':           'analise',
    // Patrimônio
    'visao':             'patrimonio',     // /patrimonio/visao
    'reserva':           'reserva',
    'investimentos':     'investimentos',
    'metas':             'metas',
    'evolucao':          'evolucao',
    // Common
    'ajustes':           'ajustes',
};

// Inverso: id interno → slug (pra navegar)
export const TAB_ID_TO_SLUG = {
    // Gastos
    'visao':           'visao-geral',
    'entradas':        'recebimentos',
    'fixas':           'contas-fixas',
    'gastos':          'lancamentos',
    'cartoes':         'cartoes',
    'analise':         'analise',
    // Patrimônio
    'patrimonio':      'visao',
    'reserva':         'reserva',
    'investimentos':   'investimentos',
    'metas':           'metas',
    'evolucao':        'evolucao',
    // Common
    'ajustes':         'ajustes',
};

// Aba default por módulo
export const DEFAULT_TAB_BY_MODULE = {
    gastos:     'visao',
    patrimonio: 'patrimonio',
};

// Em qual módulo cada aba existe
export const TAB_TO_MODULE = {
    visao:          'gastos',
    entradas:       'gastos',
    fixas:          'gastos',
    gastos:         'gastos',
    cartoes:        'gastos',
    analise:        'gastos',
    patrimonio:     'patrimonio',
    reserva:        'patrimonio',
    investimentos:  'patrimonio',
    metas:          'patrimonio',
    evolucao:       'patrimonio',
    ajustes:        'common',
};

// Constrói URL pra módulo/aba
export const buildTabPath = (module, tabId) => {
    if (module === 'hub') return '/inicio';
    const slug = TAB_ID_TO_SLUG[tabId] || tabId;
    return `/${module}/${slug}`;
};
