import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import {
  Home, Car, Plus, Pencil, Trash2, X, Loader2, TrendingUp, TrendingDown, Building2, MapPin,
  Calendar, RefreshCw, Info, Save, Layers,
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const fmt = (v) => Math.abs(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBR = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const PROPERTY_TYPES = [
  { id: 'apartamento', label: 'Apartamento' },
  { id: 'casa', label: 'Casa' },
  { id: 'terreno', label: 'Terreno' },
  { id: 'sala_comercial', label: 'Sala Comercial' },
];
const DEFAULT_APPRECIATION = 8; // % a.a. estimado (FipeZAP médio nacional) quando não há avaliação manual
const FIPE_DIRECT = 'https://parallelum.com.br/fipe/api/v1/carros';

// Busca na FIPE via proxy serverless (/api/fipe) e, se falhar, direto no parallelum.
async function fipeGet(path) {
  try {
    const r = await fetch(`/api/fipe?p=${encodeURIComponent(path)}`);
    if (r.ok) return await r.json();
    throw new Error(`proxy ${r.status}`);
  } catch {
    const r2 = await fetch(`${FIPE_DIRECT}/${path}`);
    if (!r2.ok) throw new Error(`fipe ${r2.status}`);
    return r2.json();
  }
}

const yearsBetween = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
};
const tenureLabel = (dateStr) => {
  const y = yearsBetween(dateStr);
  if (y < 1) return `${Math.round(y * 12)} ${Math.round(y * 12) === 1 ? 'mês' : 'meses'}`;
  const yi = Math.floor(y); const m = Math.round((y - yi) * 12);
  return m > 0 ? `${yi}a ${m}m` : `${yi} ${yi === 1 ? 'ano' : 'anos'}`;
};

// Valor atual estimado de um bem
function computeCurrent(asset) {
  if (asset.manualCurrentValue != null && asset.manualCurrentValue !== '') return parseBR(asset.manualCurrentValue);
  if (asset.kind === 'veiculo') return parseBR(asset.fipeValue || asset.acquisitionValue);
  // imóvel: valorização composta sobre o valor de aquisição
  const rate = (parseFloat(asset.appreciationRate) || DEFAULT_APPRECIATION) / 100;
  const y = yearsBetween(asset.acquisitionDate);
  return parseBR(asset.acquisitionValue) * Math.pow(1 + rate, y);
}

// Série de evolução do valor (mensal) entre aquisição e hoje
function valueSeries(asset) {
  const acq = parseBR(asset.acquisitionValue);
  const cur = computeCurrent(asset);
  const months = Math.max(2, Math.min(60, Math.round(yearsBetween(asset.acquisitionDate) * 12)));
  const pts = [];
  for (let i = 0; i <= months; i++) {
    const t = months === 0 ? 1 : i / months;
    // imóvel: composto; veículo: interpolação linear acq→fipe
    let v;
    if (asset.kind === 'imovel' && asset.manualCurrentValue == null) {
      const rate = (parseFloat(asset.appreciationRate) || DEFAULT_APPRECIATION) / 100;
      v = acq * Math.pow(1 + rate, (yearsBetween(asset.acquisitionDate)) * t);
    } else {
      v = acq + (cur - acq) * t;
    }
    pts.push({ i, v });
  }
  return pts;
}

export default function BensImoveisTab() {
  const { theme } = useTheme();
  const { currentUser, planLevel } = useAuth();
  // Limite de bens vale para Gratuito e Standard (Premium é ilimitado).
  const isLimited = planLevel === 'free' || planLevel === 'standard';
  const FREE_BENS_LIMIT = 2;
  const isDark = theme !== 'light';

  const [assets, setAssets] = useState([]);
  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'tangible_assets'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setJars(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  const imoveis = assets.filter(a => a.kind === 'imovel');
  const veiculos = assets.filter(a => a.kind === 'veiculo');

  const bensTotal = useMemo(() => assets.reduce((a, x) => a + computeCurrent(x), 0), [assets]);
  const acqTotal = useMemo(() => assets.reduce((a, x) => a + parseBR(x.acquisitionValue), 0), [assets]);
  const variacao = bensTotal - acqTotal;
  const variacaoPct = acqTotal > 0 ? (variacao / acqTotal) * 100 : 0;

  // patrimônio total aproximado (para o peso) = reservas + investimentos + bens
  const otherPatrimony = useMemo(() => {
    const jarsT = jars.reduce((a, j) => a + (parseFloat(j.balance) || 0), 0);
    const invT = investments.reduce((a, inv) => {
      const usdM = inv.isUSD ? 5 : 1;
      const price = inv.manualCurrentPrice || inv.purchasePrice || 0;
      if (inv.type === 'renda_fixa') return a + (inv.manualCurrentPrice || inv.totalApplied || (inv.quantity * inv.purchasePrice) || 0);
      return a + (inv.quantity || 0) * price * usdM;
    }, 0);
    return jarsT + invT;
  }, [jars, investments]);
  const patrimonioTotal = otherPatrimony + bensTotal;
  const peso = patrimonioTotal > 0 ? (bensTotal / patrimonioTotal) * 100 : 0;

  const lastUpdate = useMemo(() => {
    const dates = assets.map(a => a.lastValuationAt).filter(Boolean).sort();
    return dates.length ? new Date(dates[dates.length - 1]) : null;
  }, [assets]);

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'tangible_assets', id));
    // Desvincula este bem dos seguros que apontavam para ele (evita linkedAssetId órfão).
    try {
      const snap = await getDocs(query(collection(db, 'insurances'), where('userId', '==', currentUser.uid)));
      await Promise.all(snap.docs
        .filter(d => d.data().linkedAssetId === id)
        .map(d => updateDoc(doc(db, 'insurances', d.id), { linkedAssetId: null })));
    } catch (e) { console.warn('Falha ao desvincular seguro do bem:', e); }
    setDeleteConfirm(null);
  };

  const card = 'pat-card';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';

  const [limitMsg, setLimitMsg] = useState(null);
  const openNew = (kind) => {
    if (isLimited && assets.length >= FREE_BENS_LIMIT) {
      setLimitMsg(`Você atingiu o limite de ${FREE_BENS_LIMIT} bens do seu plano (${planLevel === 'standard' ? 'Standard' : 'Gratuito'}). Faça upgrade para o Premium e cadastre quantos bens quiser.`);
      return;
    }
    setEditing({ kind }); setShowModal(true);
  };

  return (
    <div className="max-w-full px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Título */}
      <div className="flex items-center justify-between pt-8 pb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}><Home className="w-6 h-6 text-orange-500" /></div>
          <h2 className={`text-xl font-medium tracking-wide uppercase ${txt}`}>Bens & Imóveis</h2>
        </div>
        {lastUpdate && <span className={`text-[10px] ${sub} flex items-center gap-1.5`}><RefreshCw className="w-3 h-3" /> Atualizado em {lastUpdate.toLocaleDateString('pt-BR')}</span>}
      </div>

      {/* Resumo topo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-5 rounded-2xl border ${card}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patrimônio tangível</p>
          <p className={`text-2xl font-black ${txt}`}>R$ {fmt(bensTotal)}</p>
          <p className={`text-[10px] ${sub}`}>{assets.length} {assets.length === 1 ? 'bem cadastrado' : 'bens cadastrados'}</p>
        </div>
        <div className={`p-5 rounded-2xl border ${card}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Variação desde a aquisição</p>
          <p className={`text-2xl font-black ${variacao >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{variacao >= 0 ? '+' : '-'}R$ {fmt(variacao)}</p>
          <p className={`text-[10px] font-bold ${variacao >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{variacaoPct >= 0 ? '+' : ''}{variacaoPct.toFixed(1)}% · custo R$ {fmt(acqTotal)}</p>
        </div>
        <div className={`p-5 rounded-2xl border ${card}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peso no patrimônio total</p>
          <p className="text-2xl font-black text-blue-500">{peso.toFixed(1)}%</p>
          <div className={`w-full h-1.5 rounded-full overflow-hidden mt-2 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, peso)}%` }} />
          </div>
        </div>
      </div>

      {/* Seção Imóveis */}
      <Section title="Imóveis" icon={Building2} color="orange" onAdd={() => openNew('imovel')} isDark={isDark} txt={txt}>
        {imoveis.length === 0 ? (
          <EmptyState isDark={isDark} sub={sub} label="Nenhum imóvel cadastrado" onAdd={() => openNew('imovel')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {imoveis.map(a => <AssetCard key={a.id} asset={a} isDark={isDark} card={card} txt={txt} sub={sub} onEdit={() => { setEditing(a); setShowModal(true); }} onDelete={() => setDeleteConfirm(a)} />)}
          </div>
        )}
      </Section>

      {/* Seção Veículos */}
      <Section title="Veículos" icon={Car} color="blue" onAdd={() => openNew('veiculo')} isDark={isDark} txt={txt}>
        {veiculos.length === 0 ? (
          <EmptyState isDark={isDark} sub={sub} label="Nenhum veículo cadastrado" onAdd={() => openNew('veiculo')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {veiculos.map(a => <AssetCard key={a.id} asset={a} isDark={isDark} card={card} txt={txt} sub={sub} onEdit={() => { setEditing(a); setShowModal(true); }} onDelete={() => setDeleteConfirm(a)} />)}
          </div>
        )}
      </Section>

      <p className={`text-[11px] flex items-center gap-2 ${sub}`}>
        <Info className="w-3.5 h-3.5 shrink-0" /> Bens tangíveis somam ao patrimônio total consolidado, mas ficam separados dos ativos financeiros. Imóveis usam valorização estimada (FipeZAP médio) e veículos consultam a Tabela FIPE.
      </p>

      {showModal && (
        <AssetModal
          isDark={isDark} inset={inset} txt={txt} sub={sub} editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          userId={currentUser?.uid}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className={`w-full max-w-sm rounded-3xl border p-6 ${isDark ? 'bg-[#1e2330] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
            <p className={`font-bold text-sm mb-1 ${txt}`}>Excluir {deleteConfirm.kind === 'imovel' ? 'imóvel' : 'veículo'}?</p>
            <p className={`text-xs mb-5 ${sub}`}>{deleteConfirm.name || deleteConfirm.address || 'Este bem'} será removido do seu patrimônio.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase bg-rose-500 text-white">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {limitMsg && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setLimitMsg(null)}>
          <div className={`w-full max-w-sm rounded-3xl border p-6 text-center ${isDark ? 'bg-[#1e2330] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4"><Info className="w-7 h-7 text-amber-500" /></div>
            <p className={`font-bold text-sm mb-2 ${txt}`}>Limite do Plano Gratuito</p>
            <p className={`text-xs mb-5 ${sub}`}>{limitMsg}</p>
            <button onClick={() => setLimitMsg(null)} className="w-full py-2.5 rounded-xl font-bold text-xs uppercase bg-emerald-500 text-white">Entendi</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, color, onAdd, txt, children }) {
  const accent = color === 'orange' ? 'text-orange-500' : 'text-blue-500';
  const btn = color === 'orange' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600';
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {React.createElement(icon, { className: `w-5 h-5 ${accent}` })}
          <h3 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>{title}</h3>
        </div>
        <button onClick={onAdd} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${btn}`}>
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ isDark, sub, label, onAdd }) {
  return (
    <button onClick={onAdd} className={`w-full p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${isDark ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'}`}>
      <Plus className="w-6 h-6 text-slate-400" />
      <span className={`text-xs font-bold ${sub}`}>{label}</span>
    </button>
  );
}

function AssetCard({ asset, isDark, card, txt, sub, onEdit, onDelete }) {
  const acq = parseBR(asset.acquisitionValue);
  const cur = computeCurrent(asset);
  const diff = cur - acq;
  const pct = acq > 0 ? (diff / acq) * 100 : 0;
  const series = useMemo(() => valueSeries(asset), [asset]);
  const Icon = asset.kind === 'imovel' ? Home : Car;
  const title = asset.kind === 'imovel'
    ? (PROPERTY_TYPES.find(t => t.id === asset.propertyType)?.label || 'Imóvel')
    : `${asset.brand || ''} ${asset.model || ''}`.trim() || 'Veículo';
  const subtitle = asset.kind === 'imovel' ? asset.address : [asset.version, asset.year].filter(Boolean).join(' · ');

  return (
    <div className={`p-4 rounded-2xl border ${card} relative group`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${asset.kind === 'imovel' ? (isDark ? 'bg-orange-500/10' : 'bg-orange-50') : (isDark ? 'bg-blue-500/10' : 'bg-blue-50')}`}>
          <Icon className={`w-5 h-5 ${asset.kind === 'imovel' ? 'text-orange-500' : 'text-blue-500'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${txt}`}>{title}</p>
          {subtitle && <p className={`text-[10px] truncate flex items-center gap-1 ${sub}`}><MapPin className="w-2.5 h-2.5 shrink-0" />{subtitle}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="h-14 my-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip formatter={(v) => [`R$ ${fmt(v)}`, 'Valor']} labelFormatter={() => ''} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 10, fontSize: 11 }} />
            <Line type="monotone" dataKey="v" stroke={diff >= 0 ? '#10b981' : '#f43f5e'} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Aquisição</p>
          <p className={`text-sm font-black ${txt}`}>R$ {fmt(acq)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{asset.kind === 'veiculo' ? 'FIPE atual' : 'Atual estimado'}</p>
          <p className={`text-sm font-black ${txt}`}>R$ {fmt(cur)}</p>
        </div>
      </div>
      <div className={`mt-3 pt-3 border-t flex items-center justify-between ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        <span className={`inline-flex items-center gap-1 text-xs font-black ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {diff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {diff >= 0 ? '+' : '-'}R$ {fmt(diff)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
        </span>
        <span className={`text-[10px] flex items-center gap-1 ${sub}`}><Calendar className="w-3 h-3" /> {tenureLabel(asset.acquisitionDate)}</span>
      </div>
    </div>
  );
}

function AssetModal({ isDark, inset, txt, sub, editing, onClose, userId }) {
  const isVeiculo = editing?.kind === 'veiculo';
  const [form, setForm] = useState(() => ({
    propertyType: editing?.propertyType || 'apartamento',
    address: editing?.address || '',
    brand: editing?.brand || '', model: editing?.model || '', year: editing?.year || '', version: editing?.version || '',
    fipeCode: editing?.fipeCode || '',
    acquisitionValue: editing?.acquisitionValue != null ? String(editing.acquisitionValue) : '',
    acquisitionDate: editing?.acquisitionDate || new Date().toISOString().slice(0, 10),
    appreciationRate: editing?.appreciationRate != null ? String(editing.appreciationRate) : String(DEFAULT_APPRECIATION),
    manualCurrentValue: editing?.manualCurrentValue != null ? String(editing.manualCurrentValue) : '',
    fipeValue: editing?.fipeValue || null,
  }));
  const [saving, setSaving] = useState(false);

  // FIPE cascading
  const [brands, setBrands] = useState([]); const [models, setModels] = useState([]); const [years, setYears] = useState([]);
  const [brandCode, setBrandCode] = useState(editing?.fipeBrandCode || '');
  const [modelCode, setModelCode] = useState(editing?.fipeModelCode || '');
  const [yearCode, setYearCode] = useState(editing?.fipeYearCode || '');
  const [fipeLoading, setFipeLoading] = useState(false);
  const [fipeError, setFipeError] = useState('');

  useEffect(() => {
    if (!isVeiculo) return;
    setFipeError('');
    fipeGet('marcas').then(d => setBrands(Array.isArray(d) ? d : [])).catch(() => setFipeError('Não foi possível carregar marcas FIPE. Você pode informar o valor manualmente.'));
  }, [isVeiculo]);
  useEffect(() => {
    if (!isVeiculo || !brandCode) return;
    setModels([]); setYears([]);
    fipeGet(`marcas/${brandCode}/modelos`).then(d => setModels(d.modelos || [])).catch(() => {});
  }, [brandCode, isVeiculo]);
  useEffect(() => {
    if (!isVeiculo || !brandCode || !modelCode) return;
    setYears([]);
    fipeGet(`marcas/${brandCode}/modelos/${modelCode}/anos`).then(d => setYears(Array.isArray(d) ? d : [])).catch(() => {});
  }, [modelCode, brandCode, isVeiculo]);

  const fetchFipeValue = async () => {
    if (!brandCode || !modelCode || !yearCode) return;
    setFipeLoading(true); setFipeError('');
    try {
      const d = await fipeGet(`marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`);
      const val = parseBR(d.Valor);
      setForm(f => ({
        ...f, fipeValue: val,
        brand: d.Marca || f.brand, model: d.Modelo || f.model,
        year: String(d.AnoModelo || f.year), fipeCode: d.CodigoFipe || f.fipeCode,
      }));
    } catch {
      setFipeError('Falha ao consultar a FIPE. Informe o valor manualmente.');
    } finally { setFipeLoading(false); }
  };

  const handleSave = async () => {
    // Reforço do limite no salvamento (novo bem).
    if (!editing?.id && isLimited && assets.length >= FREE_BENS_LIMIT) {
      setShowModal(false);
      setLimitMsg(`Você atingiu o limite de ${FREE_BENS_LIMIT} bens do seu plano (${planLevel === 'standard' ? 'Standard' : 'Gratuito'}). Faça upgrade para o Premium e cadastre quantos bens quiser.`);
      return;
    }
    setSaving(true);
    try {
      const base = {
        userId, kind: editing.kind,
        acquisitionValue: parseBR(form.acquisitionValue),
        acquisitionDate: form.acquisitionDate,
        manualCurrentValue: form.manualCurrentValue === '' ? null : parseBR(form.manualCurrentValue),
        lastValuationAt: new Date().toISOString(),
        updatedAt: Date.now(),
      };
      let payload;
      if (isVeiculo) {
        payload = { ...base, brand: form.brand, model: form.model, year: form.year, version: form.version, fipeCode: form.fipeCode, fipeValue: form.fipeValue, fipeBrandCode: brandCode, fipeModelCode: modelCode, fipeYearCode: yearCode };
      } else {
        payload = { ...base, propertyType: form.propertyType, address: form.address, appreciationRate: parseFloat(form.appreciationRate) || DEFAULT_APPRECIATION };
      }
      // valor atual persistido (para somar no patrimônio sem recomputar)
      payload.currentValue = computeCurrent({ ...editing, ...payload });
      if (editing.id) await updateDoc(doc(db, 'tangible_assets', editing.id), payload);
      else await addDoc(collection(db, 'tangible_assets'), { ...payload, createdAt: new Date().toISOString() });
      onClose();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const field = `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none ${inset} ${txt}`;
  const lbl = `text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${sub}`;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#1e2330] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 ${isDark ? 'bg-[#1e2330] border-white/5' : 'bg-white border-slate-100'}`}>
          <h3 className={`text-base font-black flex items-center gap-2 ${txt}`}>
            {isVeiculo ? <Car className="w-5 h-5 text-blue-500" /> : <Home className="w-5 h-5 text-orange-500" />}
            {editing.id ? 'Editar' : 'Novo'} {isVeiculo ? 'Veículo' : 'Imóvel'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {!isVeiculo ? (
            <>
              <div>
                <label className={lbl}>Tipo</label>
                <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))} className={field}>
                  {PROPERTY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Endereço / Localização</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Bairro, cidade" className={field} />
              </div>
              <div>
                <label className={lbl}>Valorização estimada (% a.a.)</label>
                <input value={form.appreciationRate} onChange={e => setForm(f => ({ ...f, appreciationRate: e.target.value }))} inputMode="decimal" className={field} />
                <p className="text-[10px] text-slate-500 mt-1">Estimativa FipeZAP média ({DEFAULT_APPRECIATION}% a.a.). Ajuste conforme cidade/bairro ou informe o valor atual manualmente abaixo.</p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={lbl}>Marca</label>
                  <select value={brandCode} onChange={e => setBrandCode(e.target.value)} className={field}>
                    <option value="">Selecione…</option>
                    {brands.map(b => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Modelo</label>
                  <select value={modelCode} onChange={e => setModelCode(e.target.value)} disabled={!brandCode} className={field}>
                    <option value="">Selecione…</option>
                    {models.map(m => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Ano</label>
                    <select value={yearCode} onChange={e => setYearCode(e.target.value)} disabled={!modelCode} className={field}>
                      <option value="">Selecione…</option>
                      {years.map(y => <option key={y.codigo} value={y.codigo}>{y.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Versão (opcional)</label>
                    <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className={field} />
                  </div>
                </div>
                <button onClick={fetchFipeValue} disabled={!yearCode || fipeLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-[11px] uppercase tracking-wider">
                  {fipeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Consultar Tabela FIPE
                </button>
                {form.fipeValue != null && <p className="text-center text-xs font-bold text-emerald-500">FIPE: R$ {fmt(form.fipeValue)}</p>}
                {fipeError && <p className="text-center text-[10px] text-amber-500">{fipeError}</p>}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor de aquisição</label>
              <input value={form.acquisitionValue} onChange={e => setForm(f => ({ ...f, acquisitionValue: e.target.value }))} inputMode="decimal" placeholder="R$" className={field} />
            </div>
            <div>
              <label className={lbl}>Data de compra</label>
              <input type="date" value={form.acquisitionDate} onChange={e => setForm(f => ({ ...f, acquisitionDate: e.target.value }))} className={field} />
            </div>
          </div>
          <div>
            <label className={lbl}>Valor atual (manual, opcional)</label>
            <input value={form.manualCurrentValue} onChange={e => setForm(f => ({ ...f, manualCurrentValue: e.target.value }))} inputMode="decimal" placeholder="Sobrescreve a estimativa/FIPE" className={field} />
          </div>
        </div>

        <div className={`flex gap-3 px-6 py-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || parseBR(form.acquisitionValue) <= 0} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs uppercase bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
