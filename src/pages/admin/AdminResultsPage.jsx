import React, { useEffect, useRef, useState } from 'react';
import { FaPlus, FaReceipt, FaSyncAlt } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';

const LOTERIAS = [
  { code: 'LT PT RIO', horarios: ['09HS', '11HS', '14HS', '16HS', '18HS', '21HS'] },
  { code: 'LT MALUQ RIO', horarios: ['09HS', '11HS', '14HS', '16HS', '18HS', '21HS'] },
  { code: 'LT NACIONAL', horarios: ['02HS', '08HS', '10HS', '12HS', '15HS', '17HS', '21HS', '23HS'] },
  { code: 'LT LOOK', horarios: ['07HS', '09HS', '11HS', '14HS', '16HS', '18HS', '21HS', '23HS'] },
  { code: 'LT BOASORTE', horarios: ['09HS', '11HS', '14HS', '16HS', '18HS', '21HS'] },
  { code: 'PT SP', horarios: ['08HS', '10HS', '12HS', '13HS', '17HS', '19HS', '20HS'] },
  { code: 'LT BAND', horarios: ['15HS'] },
  { code: 'LT LOTEP', horarios: ['09HS', '10HS', '12HS', '15HS', '18HS', '20HS'] },
  { code: 'LT LOTECE', horarios: ['10HS', '14HS', '16HS', '19HS'] },
  { code: 'LT BAHIA', horarios: ['10HS', '12HS', '15HS', '19HS', '21HS'] },
  { code: 'LT BA MALUCA', horarios: ['10HS', '12HS', '15HS', '19HS', '21HS'] },
  { code: 'LT CAPITAL', horarios: ['10HS', '11HS', '13HS', '14HS', '16HS', '18HS', '20HS', '22HS'] },
  { code: 'LT ALVORADA', horarios: ['12HS'] },
  { code: 'LT MINAS DIA', horarios: ['15HS'] },
  { code: 'LT MINAS NOITE', horarios: ['19HS'] },
  { code: 'LT SORTE', horarios: ['14HS', '18HS'] },
  { code: 'LT URUGUAI', horarios: ['15HS', '21HS'] },
];

const AdminResultsPage = () => {
  const [form, setForm] = useState({
    loteria: '',
    horario: '',
    data: '',
    n1: '',
    n2: '',
    n3: '',
    n4: '',
    n5: '',
    n6: '',
    n7: '',
    g1: '',
    g2: '',
    g3: '',
    g4: '',
    g5: '',
    g6: '',
    g7: '',
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [settlingId, setSettlingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [success, setSuccess] = useState('');
  const milharRefs = useRef([]);
  const grupoRefs = useRef([]);
  const selectedLottery = LOTERIAS.find((l) => l.code === form.loteria);
  const horariosDisponiveis = selectedLottery?.horarios || [];
  const codigoPreview = form.loteria && form.horario ? `${form.loteria} ${form.horario}` : '';
  const [filterDate, setFilterDate] = useState('');
  const [filterLottery, setFilterLottery] = useState('');

  const fetchResults = async ({ loteria = filterLottery, date = filterDate } = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/results', {
        params: { page: 1, pageSize: 50, loteria, date },
      });
      setResults(res.data?.results || res.data || []);
    } catch (err) {
      setError('Erro ao carregar resultados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const settleResult = async (id) => {
    if (!id) return;
    setSettlingId(id);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/admin/results/${id}/settle`);
      const summary = res.data?.summary;
      if (summary) {
        const matched = summary.matchedBetIds?.length ? ` | Encontradas: ${summary.matchedBetIds.join(', ')}` : '';
        setSuccess(`Liquidação: ${summary.processed}/${summary.totalBets} processadas, ${summary.wins} premiadas.${matched}`);
      }
      fetchResults();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao liquidar apostas para este resultado.';
      setError(msg);
    } finally {
      setSettlingId(null);
    }
  };

  const generatePule = async (id) => {
    if (!id) return;
    setGeneratingId(id);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/admin/results/${id}/pule`);
      const already = res.data?.alreadyExists;
      setSuccess(already ? 'PULE já existia para este resultado.' : 'PULE gerado com sucesso.');
      fetchResults();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao gerar PULE.';
      setError(msg);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.loteria || !form.horario || !form.data) {
      setError('Preencha loteria, data e horário.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const lot = LOTERIAS.find((l) => l.code === form.loteria);
      const numeros = [form.n1, form.n2, form.n3, form.n4, form.n5, form.n6, form.n7].filter(Boolean);
      const grupos = [form.g1, form.g2, form.g3, form.g4, form.g5, form.g6, form.g7].filter(Boolean);
      const fullCode = `${form.loteria} ${form.horario}`.trim();
      await api.post('/admin/results', {
        loteria: form.loteria,
        dataJogo: form.data,
        codigoHorario: fullCode,
        numeros,
        grupos,
      });
      setForm({
        loteria: form.loteria,
        horario: lot?.horarios?.[0] || '',
        data: '',
        n1: '',
        n2: '',
        n3: '',
        n4: '',
        n5: '',
        n6: '',
        n7: '',
        g1: '',
        g2: '',
        g3: '',
        g4: '',
        g5: '',
        g6: '',
        g7: '',
      });
      fetchResults();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar resultado.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMilharChange = (idx, value) => {
    const limit = idx === 7 ? 3 : 4; // N7 é centena (3 dígitos), demais são milhares (4)
    const digits = value.replace(/\D/g, '').slice(0, limit);
    setForm((prev) => ({ ...prev, [`n${idx}`]: digits }));
    if (digits.length === limit) {
      const target = grupoRefs.current[idx];
      if (target) target.focus();
    }
  };

  const handleGrupoChange = (idx, value) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    setForm((prev) => ({ ...prev, [`g${idx}`]: digits }));
    if (digits.length === 2 && idx < 7) {
      const nextMilhar = milharRefs.current[idx + 1];
      if (nextMilhar) nextMilhar.focus();
    }
  };

  return (
    <AdminLayout
      title="Resultados"
      subtitle="Cadastro manual dos resultados diários."
      actions={
        <button
          onClick={fetchResults}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-semibold text-sm"
        >
          <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      }
    >
      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-r shadow-sm">
          <p className="font-bold">Erro</p>
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-3 rounded-r shadow-sm">
          <p className="font-bold">Ok</p>
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-700">Filtrar resultados</p>
            <p className="text-xs text-slate-500">Escolha a data e a loteria para listar apenas os resultados daquele dia.</p>
          </div>
          <button
            onClick={() => fetchResults({ loteria: filterLottery, date: filterDate })}
            className="px-3 py-2 text-sm font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
            disabled={loading}
          >
            Buscar
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                const date = e.target.value;
                setFilterDate(date);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de loteria</label>
            <select
              value={filterLottery}
              onChange={(e) => {
                const val = e.target.value;
                setFilterLottery(val);
                // Se já tem data selecionada, busca imediatamente ao escolher loteria
                if (filterDate || val) {
                  fetchResults({ loteria: val, date: filterDate });
                }
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            >
              <option value="">Todas</option>
              {LOTERIAS.map((lot) => (
                <option key={lot.code} value={lot.code}>
                  {lot.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold">
          <FaPlus /> Registrar resultado
        </div>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleSubmit}>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Loteria</label>
            <select
              value={form.loteria}
              onChange={(e) => {
                const code = e.target.value;
                const lot = LOTERIAS.find((l) => l.code === code);
                setForm((prev) => ({
                  ...prev,
                  loteria: code,
                  horario: lot?.horarios?.[0] || '',
                }));
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              required
            >
              <option value="">Selecione</option>
              {LOTERIAS.map((lot) => (
                <option key={lot.code} value={lot.code}>
                  {lot.code}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Horário</label>
            <select
              value={form.horario}
              onChange={(e) => setForm({ ...form, horario: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              required
              disabled={!form.loteria}
            >
              <option value="">Selecione</option>
              {horariosDisponiveis.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Código / Loteria / Horário</label>
            <input
              value={codigoPreview}
              readOnly
              placeholder="Selecione loteria e horário"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-slate-700"
            />
          </div>

          {[1, 2, 3, 4, 5, 6, 7].map((idx) => (
            <React.Fragment key={idx}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{`N${idx} (Milhar)`}</label>
                <input
                  placeholder="Ex: 1234"
                  value={form[`n${idx}`]}
                  onChange={(e) => handleMilharChange(idx, e.target.value)}
                  inputMode="numeric"
                  maxLength={idx === 7 ? 3 : 4}
                  ref={(el) => (milharRefs.current[idx] = el)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{`Grupo ${idx}`}</label>
                <input
                  placeholder="Ex: 04"
                  value={form[`g${idx}`] || ''}
                  onChange={(e) => handleGrupoChange(idx, e.target.value)}
                  inputMode="numeric"
                  maxLength={2}
                  ref={(el) => (grupoRefs.current[idx] = el)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  disabled={saving}
                />
              </div>
            </React.Fragment>
          ))}

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <AdminTable headers={['Data', 'Código/Horário', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'Grupos', 'Ação']}>
          {results.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={11}>
                Nenhum resultado cadastrado.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            results.map((r) => {
              const rawNums = (r.numeros || r.n || []).length
                ? r.numeros || r.n
                : [r.n1, r.n2, r.n3, r.n4, r.n5, r.n6, r.n7].filter((n) => n !== undefined);
              let rawGroups = r.grupos || r.g || [];
              if (typeof rawGroups === 'string') {
                try {
                  rawGroups = JSON.parse(rawGroups);
                } catch {
                  rawGroups = [];
                }
              }
              if (!rawGroups.length) {
                rawGroups = [r.g1, r.g2, r.g3, r.g4, r.g5, r.g6, r.g7].filter((g) => g !== undefined);
              }

              const nums = [...rawNums];
              const groups = [...rawGroups];
              while (nums.length < 7) nums.push('—');
              while (groups.length < 7) groups.push(null);

              const groupsWithFallback = groups.map((g, i) => {
                if (g) return g;
                const num = nums[i];
                if (!num || num === '—') return '—';
                const dezena = String(num).replace(/\D/g, '').slice(-2);
                if (!dezena) return '—';
                const val = parseInt(dezena, 10);
                if (Number.isNaN(val)) return '—';
                const group = val === 0 ? 25 : Math.ceil(val / 4);
                return String(group).padStart(2, '0');
              });

              return (
                <AdminTableRow key={r.id || r._id}>
                  <AdminTableCell className="font-semibold">{r.data || r.dataJogo || '—'}</AdminTableCell>
                  <AdminTableCell>{r.codigoHorario || r.codigo || r.loteria || '—'}</AdminTableCell>
                  {nums.slice(0, 7).map((num, i) => (
                    <AdminTableCell key={`${r.id || r._id}-n-${i}`}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{num || '—'}</span>
                        <span className="text-xs text-slate-500">Grupo: {groupsWithFallback[i] || '—'}</span>
                      </div>
                    </AdminTableCell>
                  ))}
                  <AdminTableCell className="text-sm text-slate-700">
                    {groupsWithFallback.slice(0, 7).join(' • ') || '—'}
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => settleResult(r.id || r._id)}
                        disabled={settlingId === (r.id || r._id)}
                        className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                      >
                        {settlingId === (r.id || r._id) ? 'Liquidando...' : 'Liquidar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => generatePule(r.id || r._id)}
                        disabled={generatingId === (r.id || r._id)}
                        className="px-3 py-1 rounded-md border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition disabled:opacity-60 flex items-center gap-2"
                      >
                        <FaReceipt />
                        {generatingId === (r.id || r._id) ? 'Gerando...' : 'Gerar PULE'}
                      </button>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })
          )}
        </AdminTable>
      )}
    </AdminLayout>
  );
};

export default AdminResultsPage;
