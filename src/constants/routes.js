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
    'resgates':          'resgates',     // sub-aba de Entradas (IncomeTab)
    'contas-fixas':      'fixas',
    'lancamentos':       'gastos',
    'aportes':           'aportes',      // sub-aba de Lançamentos (ExitsTab)
    'cartoes':           'cartoes',
    'analise':                'analise',
    'analise-metas':          'analise_metas',
    'analise-comparativo':    'analise_comparativo',
    // Patrimônio
    'visao':                    'patrimonio',     // /patrimonio/visao
    'monitor-ativos':           'monitor',
    'fluxo-patrimonial':        'fluxo',
    'reserva':                  'reserva',
    'investimentos':            'investimentos',
    'bens-imoveis':             'bens',
    'previdencia':              'previdencia',
    'metas':                    'metas',
    'evolucao':                 'evolucao',
    'independencia-financeira': 'independencia',
    'rebalanceamento':          'rebalanceamento',
    'seguros-protecao':         'seguros',
    // Common
    'ajustes':           'ajustes',
};

// Inverso: id interno → slug (pra navegar)
export const TAB_ID_TO_SLUG = {
    // Gastos
    'visao':           'visao-geral',
    'entradas':        'recebimentos',
    'resgates':        'resgates',
    'fixas':           'contas-fixas',
    'gastos':          'lancamentos',
    'aportes':         'aportes',
    'cartoes':         'cartoes',
    'analise':              'analise',
    'analise_metas':        'analise-metas',
    'analise_comparativo':  'analise-comparativo',
    // Patrimônio
    'patrimonio':      'visao',
    'monitor':         'monitor-ativos',
    'fluxo':           'fluxo-patrimonial',
    'reserva':         'reserva',
    'investimentos':   'investimentos',
    'bens':            'bens-imoveis',
    'previdencia':     'previdencia',
    'metas':           'metas',
    'evolucao':        'evolucao',
    'independencia':   'independencia-financeira',
    'rebalanceamento': 'rebalanceamento',
    'seguros':         'seguros-protecao',
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
    resgates:       'gastos',
    fixas:          'gastos',
    gastos:         'gastos',
    aportes:        'gastos',
    cartoes:        'gastos',
    analise:             'gastos',
    analise_metas:       'gastos',
    analise_comparativo: 'gastos',
    patrimonio:      'patrimonio',
    monitor:         'patrimonio',
    fluxo:           'patrimonio',
    reserva:         'patrimonio',
    investimentos:   'patrimonio',
    bens:            'patrimonio',
    previdencia:     'patrimonio',
    metas:           'patrimonio',
    evolucao:        'patrimonio',
    independencia:   'patrimonio',
    rebalanceamento: 'patrimonio',
    seguros:         'patrimonio',
    ajustes:         'common',
};

// Constrói URL pra módulo/aba
export const buildTabPath = (module, tabId) => {
    if (module === 'hub') return '/inicio';
    const slug = TAB_ID_TO_SLUG[tabId] || tabId;
    return `/${module}/${slug}`;
};
