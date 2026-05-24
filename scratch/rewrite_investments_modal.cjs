const fs = require('fs');

let content = fs.readFileSync('src/components/InvestmentsTab.jsx', 'utf8');

// 1. Alter modal container: max-w-md -> max-w-lg (or explicitly max-w-[500px] if needed, but max-w-lg is what ExitsTab uses)
// And change padding, etc. Let's look for the exact string:
// `<div className={\`w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[3rem] p-8 md:p-10 border animate-in zoom-in-95 duration-300 \${`
let newModalContainer = `<div className={\`w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-[3rem] p-8 md:p-12 border relative animate-in zoom-in-95 duration-300 \${`;

content = content.replace(
    /className=\{\`w-full max-w-md max-h-\[90vh\] overflow-y-auto rounded-\[3rem\] p-8 md:p-10 border animate-in zoom-in-95 duration-300 \$\{/,
    `className={\`w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-[3rem] p-8 md:p-12 border relative animate-in zoom-in-95 duration-300 \${`
);

// 2. Add Close Button and new Header Title like ExitsTab
// Find:
/*
                        <h3 className={`text-2xl font-black mb-1 text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {isEditing ? 'Editar Ativo' : 'Novo Ativo'}
                        </h3>
                        <p className="text-slate-500 text-xs font-bold text-center mb-8 uppercase tracking-widest">
                            {isEditing ? 'Ajuste os dados do seu investimento' : 'Adicione seus investimentos para acompanhar'}
                        </p>
*/
const oldHeader = `<h3 className={\`text-2xl font-black mb-1 text-center \${theme === 'light' ? 'text-slate-800' : 'text-white'}\`}>
                            {isEditing ? 'Editar Ativo' : 'Novo Ativo'}
                        </h3>
                        <p className="text-slate-500 text-xs font-bold text-center mb-8 uppercase tracking-widest">
                            {isEditing ? 'Ajuste os dados do seu investimento' : 'Adicione seus investimentos para acompanhar'}
                        </p>`;

const newHeader = `<button 
                            onClick={() => { setIsAdding(false); setIsEditing(null); }}
                            className={\`absolute top-6 right-6 p-2 rounded-xl transition-colors z-[10] \${
                                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
                            }\`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-6">
                            <button type="button" onClick={() => { setIsAdding(false); setIsEditing(null); }} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                                <ArrowRight className="w-4 h-4 rotate-180" />
                            </button>
                            <h3 className={\`text-xl font-black \${theme === 'light' ? 'text-slate-800' : 'text-white'}\`}>
                                {isEditing ? 'Editar Ativo' : 'Novo Ativo'}
                            </h3>
                        </div>`;

content = content.replace(oldHeader, newHeader);

// 3. Move 'Ativo Dolarizado' to beside the ticker.
// First, find the ticker input block:
/*
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Símbolo/Ticker</label>
                                            <input 
                                                type="text"
                                                required={newAsset.type !== 'imoveis'}
                                                value={newAsset.symbol}
                                                onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value.toUpperCase()})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                }`}
                                                placeholder="Ex: NVDA, BTC, BBAS3"
                                            />
                                        </div>
*/
const oldTickerBlock = `                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Símbolo/Ticker</label>
                                            <input 
                                                type="text"
                                                required={newAsset.type !== 'imoveis'}
                                                value={newAsset.symbol}
                                                onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value.toUpperCase()})}
                                                className={\`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all \${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                }\`}
                                                placeholder="Ex: NVDA, BTC, BBAS3"
                                            />
                                        </div>`;

const newTickerBlock = `                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Símbolo/Ticker</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    required={newAsset.type !== 'imoveis'}
                                                    value={newAsset.symbol}
                                                    onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value.toUpperCase()})}
                                                    className={\`flex-1 w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all \${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                    }\`}
                                                    placeholder="Ex: NVDA, BTC, BBAS3"
                                                />
                                                <label className={\`flex items-center justify-center px-4 rounded-2xl border cursor-pointer transition-all \${newAsset.isUSD ? (theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30') : (theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5')}\`} title="Ativo Dolarizado">
                                                    <input type="checkbox" checked={newAsset.isUSD} onChange={(e) => setNewAsset({...newAsset, isUSD: e.target.checked})} className="sr-only" />
                                                    <span className={\`text-[10px] font-black uppercase tracking-widest \${newAsset.isUSD ? 'text-emerald-500' : 'text-slate-400'}\`}>USD</span>
                                                </label>
                                            </div>
                                        </div>`;

content = content.replace(oldTickerBlock, newTickerBlock);

// 4. Remove the old isUSD checkbox block at the bottom
/*
                            {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) && (
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                                    <input 
                                        type="checkbox"
                                        id="isUSD-add"
                                        checked={newAsset.isUSD}
                                        onChange={(e) => setNewAsset({...newAsset, isUSD: e.target.checked})}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer"
                                    />
                                    <label htmlFor="isUSD-add" className={`text-xs font-bold cursor-pointer ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                        Ativo dolarizado (Preço em USD)
                                    </label>
                                </div>
                            )}
*/
const oldIsUsdBlock = `                            {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) && (
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                                    <input 
                                        type="checkbox"
                                        id="isUSD-add"
                                        checked={newAsset.isUSD}
                                        onChange={(e) => setNewAsset({...newAsset, isUSD: e.target.checked})}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer"
                                    />
                                    <label htmlFor="isUSD-add" className={\`text-xs font-bold cursor-pointer \${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}\`}>
                                        Ativo dolarizado (Preço em USD)
                                    </label>
                                </div>
                            )}`;

content = content.replace(oldIsUsdBlock, '');

// Save changes
fs.writeFileSync('src/components/InvestmentsTab.jsx', content, 'utf8');
console.log("Changes applied successfully.");
