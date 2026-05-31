import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, Heart, HeartPulse, Home, Car, Package, Plus, Pencil, Trash2, X,
  Loader2, Save, AlertTriangle, CalendarClock, Users, Info,
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const fmt = (v) => Math.abs(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBR = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00'); if (isNaN(d.getTime())) return null;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return Math.ceil((d - t0) / 86400000);
};

const CATEGORIES = [
  { id: 'vida', label: 'Seguro de Vida', icon: HeartPulse, color: '#f43f5e' },
  { id: 'saude', label: 'Saúde', icon: Heart, color: '#10b981' },
  { id: 'imovel', label: 'Seguro de Imóvel', icon: Home, color: '#f97316' },
  { id: 'veiculo', label: 'Seguro de Veículo', icon: Car, color: '#3b82f6' },
  { id: 'outros', label: 'Outros', icon: Package, color: '#8b5cf6' },
];
const CAT_META = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const monthlyPremium = (p) => (p.premiumPeriod === 'anual' ? parseBR(p.premium) / 12 : parseBR(p.premium));

export default function SegurosTab({ manualConfig = {} }) {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme !== 'light';

  const [policies, setPolicies] = useState([]);
  const [assets, setAssets] = useState([]);
  const [hasDependents, setHasDependents] = useState(() => localStorage.getItem('seguros_dependentes') === 'true');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'insurances'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setPolicies(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'tangible_assets'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  const imoveis = assets.filter(a => a.kind === 'imovel');
  const veiculos = assets.filter(a => a.kind === 'veiculo');

  const byCat = (cat) => policies.filter(p => p.category === cat);
  const hasVida = byCat('vida').length > 0;
  const hasSaude = byCat('saude').length > 0;
  const insuredAssetIds = new Set(policies.filter(p => p.linkedAssetId).map(p => p.linkedAssetId));
  const imoveisSemSeguro = imoveis.filter(a => !insuredAssetIds.has(a.id));
  const veiculosSemSeguro = veiculos.filter(a => !insuredAssetIds.has(a.id));

  // ── índice de cobertura ──
  const risks = [];
  risks.push({ key: 'vida', label: 'Seguro de vida', covered: hasVida });
  risks.push({ key: 'saude', label: 'Plano de saúde', covered: hasSaude });
  imoveis.forEach(a => risks.push({ key: `im_${a.id}`, label: `Imóvel: ${a.address || 'sem nome'}`, covered: insuredAssetIds.has(a.id) }));
  veiculos.forEach(a => risks.push({ key: `ve_${a.id}`, label: `Veículo: ${a.model || a.brand || 'sem nome'}`, covered: insuredAssetIds.has(a.id) }));
  const coveredCount = risks.filter(r => r.covered).length;
  const coveragePct = risks.length ? (coveredCount / risks.length) * 100 : 0;
  const level = coveragePct >= 80 ? 'bom' : coveragePct >= 40 ? 'parcial' : 'desprotegido';
  const levelMeta = {
    bom: { label: 'Bem Protegido', color: '#10b981', icon: ShieldCheck },
    parcial: { label: 'Parcialmente Protegido', color: '#eab308', icon: Shield },
    desprotegido: { label: 'Desprotegido', color: '#f43f5e', icon: ShieldAlert },
  }[level];

  // maior risco descoberto (prioridade)
  const biggestGap = useMemo(() => {
    if (!hasVida) return hasDependents
      ? 'Você tem dependentes mas nenhum seguro de vida — é o maior risco descoberto hoje. Proteja quem depende de você.'
      : 'Você ainda não tem seguro de vida. É a proteção mais importante para quem constrói patrimônio.';
    if (imoveisSemSeguro.length > 0) return `Você tem ${imoveisSemSeguro.length} imóvel(is) sem seguro associado — um sinistro pode comprometer boa parte do seu patrimônio.`;
    if (veiculosSemSeguro.length > 0) return `Você tem ${veiculosSemSeguro.length} veículo(s) sem seguro — risco de perda total descoberto.`;
    if (!hasSaude) return 'Você não registrou plano de saúde. Gastos médicos imprevistos podem drenar sua reserva.';
    return 'Seus principais riscos estão cobertos. Mantenha as apólices em dia e revise os valores anualmente.';
  }, [hasVida, hasDependents, imoveisSemSeguro.length, veiculosSemSeguro.length, hasSaude]);

  // prêmio mensal total
  const totalMonthly = policies.reduce((a, p) => a + monthlyPremium(p), 0);

  // adequação do seguro de vida (5–10x renda anual)
  const annualIncome = (parseFloat(manualConfig.income) || 0) * 12;
  const vidaCoverage = byCat('vida').reduce((a, p) => a + parseBR(p.coverageValue), 0);

  const handleDelete = async (id) => { await deleteDoc(doc(db, 'insurances', id)); setDeleteConfirm(null); };
  const toggleDependents = () => { const v = !hasDependents; setHasDependents(v); localStorage.setItem('seguros_dependentes', String(v)); };

  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';
  const LevelIcon = levelMeta.icon;

  const openNew = (cat) => { setEditing({ category: cat }); setShowModal(true); };

  return (
    <div className="max-w-full px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center gap-3 pt-8 pb-1">
        <div className={`p-2 rounded-xl ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Shield className="w-6 h-6 text-rose-500" /></div>
        <h2 className={`text-xl font-medium tracking-wide uppercase ${txt}`}>Seguros & Proteção</h2>
      </div>

      {/* Índice de cobertura */}
      <div className={`p-5 md:p-6 rounded-2xl border ${card}`} style={{ borderColor: `${levelMeta.color}40` }}>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${levelMeta.color}1f` }}>
            <LevelIcon className="w-7 h-7" style={{ color: levelMeta.color }} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Índice de cobertura</p>
            <p className="text-2xl font-black" style={{ color: levelMeta.color }}>{levelMeta.label}</p>
            <p className={`text-[11px] ${sub}`}>{coveredCount} de {risks.length} riscos principais cobertos</p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${coveragePct}%`, background: levelMeta.color }} />
            </div>
            <p className="text-right text-xs font-black mt-1" style={{ color: levelMeta.color }}>{coveragePct.toFixed(0)}%</p>
          </div>
        </div>
        {risks.some(r => !r.covered) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {risks.filter(r => !r.covered).map(r => (
              <span key={r.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400"><AlertTriangle className="w-2.5 h-2.5" />{r.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* Alívia */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Alívia · risco descoberto</span>
          <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{biggestGap}</p>
        </div>
      </div>

      {/* Prêmio mensal total + dependentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`p-5 rounded-2xl border ${card}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prêmios por mês</p>
          <p className={`text-2xl font-black ${txt}`}>R$ {fmt(totalMonthly)}</p>
          <p className={`text-[10px] ${sub}`}>{policies.length} {policies.length === 1 ? 'apólice ativa' : 'apólices ativas'} · ≈ R$ {fmt(totalMonthly * 12)}/ano</p>
        </div>
        <button onClick={toggleDependents} className={`p-5 rounded-2xl border text-left transition-all ${hasDependents ? (isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200') : card}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Tenho dependentes</p>
          <p className={`text-lg font-black ${hasDependents ? 'text-rose-500' : txt}`}>{hasDependents ? 'Sim — proteção de vida é prioridade' : 'Não'}</p>
          <p className={`text-[10px] ${sub}`}>Toque para alternar. Influencia a análise de risco do seguro de vida.</p>
        </button>
      </div>

      {/* Categorias */}
      {CATEGORIES.map(cat => {
        const list = byCat(cat.id);
        const Icon = cat.icon;
        const gapAssets = cat.id === 'imovel' ? imoveisSemSeguro : cat.id === 'veiculo' ? veiculosSemSeguro : [];
        return (
          <div key={cat.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" style={{ color: cat.color }} />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>{cat.label}</h3>
                <span className="text-[10px] font-bold text-slate-400">({list.length})</span>
              </div>
              <button onClick={() => openNew(cat.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95" style={{ background: cat.color }}>
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            {/* Vida: adequação */}
            {cat.id === 'vida' && (hasVida || annualIncome > 0) && (
              <div className={`p-3 rounded-xl border text-[11px] ${inset} ${sub}`}>
                {annualIncome > 0 ? (() => {
                  const min = annualIncome * 5, max = annualIncome * 10;
                  const ok = vidaCoverage >= min;
                  return <span className={ok ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                    {ok ? '✓' : '⚠'} Cobertura ideal: R$ {fmt(min)} a R$ {fmt(max)} (5–10× sua renda anual). Você tem R$ {fmt(vidaCoverage)} segurados.
                  </span>;
                })() : <span>Informe sua renda em Ajustes para avaliar se o valor segurado é adequado (ideal: 5–10× a renda anual).</span>}
              </div>
            )}

            {/* Alertas de lacuna para imóvel/veículo */}
            {gapAssets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {gapAssets.map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">
                    <AlertTriangle className="w-3 h-3" /> Sem seguro: {a.address || a.model || a.brand || 'bem'}
                  </span>
                ))}
              </div>
            )}

            {list.length === 0 ? (
              <button onClick={() => openNew(cat.id)} className={`w-full p-5 rounded-2xl border-2 border-dashed flex flex-col items-center gap-1.5 transition-all ${isDark ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <Plus className="w-5 h-5 text-slate-400" />
                <span className={`text-[11px] font-bold ${sub}`}>Nenhuma apólice de {cat.label.toLowerCase()}</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {list.map(p => (
                  <PolicyCard key={p.id} p={p} assets={assets} isDark={isDark} card={card} txt={txt} sub={sub}
                    onEdit={() => { setEditing(p); setShowModal(true); }} onDelete={() => setDeleteConfirm(p)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className={`text-[11px] flex items-center gap-2 ${sub}`}>
        <Info className="w-3.5 h-3.5 shrink-0" /> Este painel é só um registro de visibilidade — não vende seguros nem integra com corretoras. O objetivo é mostrar lacunas de proteção do seu patrimônio.
      </p>

      {showModal && (
        <PolicyModal isDark={isDark} inset={inset} txt={txt} sub={sub} editing={editing} assets={assets}
          onClose={() => { setShowModal(false); setEditing(null); }} userId={currentUser?.uid} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className={`w-full max-w-sm rounded-3xl border p-6 ${isDark ? 'bg-[#1e2330] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
            <p className={`font-bold text-sm mb-1 ${txt}`}>Excluir apólice?</p>
            <p className={`text-xs mb-5 ${sub}`}>{deleteConfirm.insurer || 'Esta apólice'} será removida.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase bg-rose-500 text-white">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyCard({ p, assets, isDark, card, txt, sub, onEdit, onDelete }) {
  const meta = CAT_META[p.category] || CAT_META.outros;
  const Icon = meta.icon;
  const dleft = daysUntil(p.dueDate);
  const linked = p.linkedAssetId ? assets.find(a => a.id === p.linkedAssetId) : null;
  let alert = null;
  if (dleft != null) {
    if (dleft < 0) alert = { txt: 'Vencido', cls: 'bg-rose-500/15 text-rose-400' };
    else if (dleft <= 30) alert = { txt: `Vence em ${dleft} ${dleft === 1 ? 'dia' : 'dias'}`, cls: 'bg-amber-500/15 text-amber-500' };
  }
  return (
    <div className={`p-4 rounded-2xl border ${card} relative group`}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}1f` }}><Icon className="w-5 h-5" style={{ color: meta.color }} /></span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${txt}`}>{p.insurer || 'Seguradora'}</p>
          <p className={`text-[10px] truncate ${sub}`}>{p.coverageType || meta.label}{linked ? ` · ${linked.address || linked.model || linked.brand}` : ''}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cobertura</p>
          <p className={`text-sm font-black ${txt}`}>R$ {fmt(p.coverageValue)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Prêmio {p.premiumPeriod === 'anual' ? 'anual' : 'mensal'}</p>
          <p className={`text-sm font-black ${txt}`}>R$ {fmt(p.premium)}</p>
        </div>
      </div>
      {p.beneficiary && <p className={`text-[10px] mt-2 ${sub}`}>Beneficiário: <span className="font-bold">{p.beneficiary}</span></p>}
      {p.notes && <p className={`text-[10px] mt-1 italic ${sub}`}>“{p.notes}”</p>}
      <div className={`mt-3 pt-2 border-t flex items-center justify-between ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        <span className={`text-[10px] flex items-center gap-1 ${sub}`}><CalendarClock className="w-3 h-3" /> {p.dueDate ? new Date(p.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem vencimento'}</span>
        {alert && <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${alert.cls}`}>{alert.txt}</span>}
      </div>
    </div>
  );
}

function PolicyModal({ isDark, inset, txt, sub, editing, assets, onClose, userId }) {
  const cat = editing.category;
  const meta = CAT_META[cat] || CAT_META.outros;
  const linkable = cat === 'imovel' ? assets.filter(a => a.kind === 'imovel') : cat === 'veiculo' ? assets.filter(a => a.kind === 'veiculo') : [];
  const [form, setForm] = useState(() => ({
    insurer: editing?.insurer || '',
    coverageValue: editing?.coverageValue != null ? String(editing.coverageValue) : '',
    coverageType: editing?.coverageType || '',
    premium: editing?.premium != null ? String(editing.premium) : '',
    premiumPeriod: editing?.premiumPeriod || 'mensal',
    dueDate: editing?.dueDate || '',
    beneficiary: editing?.beneficiary || '',
    linkedAssetId: editing?.linkedAssetId || '',
    notes: editing?.notes || '',
  }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        userId, category: cat,
        insurer: form.insurer.trim(),
        coverageValue: parseBR(form.coverageValue),
        coverageType: form.coverageType.trim() || null,
        premium: parseBR(form.premium),
        premiumPeriod: form.premiumPeriod,
        dueDate: form.dueDate || null,
        beneficiary: cat === 'vida' ? form.beneficiary.trim() : null,
        linkedAssetId: (cat === 'imovel' || cat === 'veiculo') ? (form.linkedAssetId || null) : null,
        notes: form.notes.trim() || null,
        updatedAt: Date.now(),
      };
      if (editing.id) await updateDoc(doc(db, 'insurances', editing.id), payload);
      else await addDoc(collection(db, 'insurances'), { ...payload, createdAt: new Date().toISOString() });
      onClose();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const field = `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none ${inset} ${txt}`;
  const lbl = `text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${sub}`;
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#1e2330] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 ${isDark ? 'bg-[#1e2330] border-white/5' : 'bg-white border-slate-100'}`}>
          <h3 className={`text-base font-black flex items-center gap-2 ${txt}`}>
            <Icon className="w-5 h-5" style={{ color: meta.color }} /> {editing.id ? 'Editar' : 'Nova'} apólice · {meta.label}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className={lbl}>Seguradora / Operadora</label><input value={form.insurer} onChange={e => setForm(f => ({ ...f, insurer: e.target.value }))} className={field} /></div>

          {cat === 'saude' && (
            <div><label className={lbl}>Tipo de cobertura</label><input value={form.coverageType} onChange={e => setForm(f => ({ ...f, coverageType: e.target.value }))} placeholder="Ex: Apartamento, nacional, com odonto" className={field} /></div>
          )}
          {cat === 'outros' && (
            <div><label className={lbl}>Tipo de seguro</label><input value={form.coverageType} onChange={e => setForm(f => ({ ...f, coverageType: e.target.value }))} placeholder="Ex: Viagem, equipamentos, RC" className={field} /></div>
          )}
          {(cat === 'imovel' || cat === 'veiculo') && (
            <div>
              <label className={lbl}>Vincular ao {cat === 'imovel' ? 'imóvel' : 'veículo'}</label>
              <select value={form.linkedAssetId} onChange={e => setForm(f => ({ ...f, linkedAssetId: e.target.value }))} className={field}>
                <option value="">Não vincular</option>
                {linkable.map(a => <option key={a.id} value={a.id}>{a.address || `${a.brand || ''} ${a.model || ''}`.trim() || 'Bem'}</option>)}
              </select>
              {linkable.length === 0 && <p className="text-[10px] text-amber-500 mt-1">Nenhum {cat === 'imovel' ? 'imóvel' : 'veículo'} cadastrado em Bens & Imóveis.</p>}
            </div>
          )}
          {cat === 'vida' && (
            <div><label className={lbl}>Beneficiário</label><input value={form.beneficiary} onChange={e => setForm(f => ({ ...f, beneficiary: e.target.value }))} className={field} /></div>
          )}

          <div><label className={lbl}>Valor de cobertura (R$)</label><input value={form.coverageValue} onChange={e => setForm(f => ({ ...f, coverageValue: e.target.value }))} inputMode="decimal" className={field} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Prêmio (R$)</label><input value={form.premium} onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} inputMode="decimal" className={field} /></div>
            <div>
              <label className={lbl}>Periodicidade</label>
              <select value={form.premiumPeriod} onChange={e => setForm(f => ({ ...f, premiumPeriod: e.target.value }))} className={field}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          <div><label className={lbl}>Vencimento</label><input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={field} /></div>
          <div><label className={lbl}>Observações</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={field} /></div>
        </div>
        <div className={`flex gap-3 px-6 py-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.insurer.trim()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs uppercase bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
