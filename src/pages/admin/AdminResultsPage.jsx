import React, { useEffect, useState, useMemo } from 'react';
import { FaSyncAlt, FaReceipt, FaCheck, FaEdit, FaTrash, FaArrowLeft } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';
// IMPORTANTE: Importamos a mesma lista que o usuário vê para garantir igualdade
import { LOTERIAS_SORTEIOS } from '../../data/sorteios'; 

// --- CONFIGURAÇÃO VISUAL DAS LOTERIAS ---
// As labels aqui devem bater com o texto contido no sorteios.js (ex: "LT PT RIO")
const LOTERIAS_FIXAS = [
  { id: 'PT-RIO', label: 'LT PT RIO', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300' },
  { id: 'LOOK', label: 'LT LOOK', color: 'bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-300' },
  { id: 'NACIONAL', label: 'LT NACIONAL', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300' },
  { id: 'FEDERAL', label: 'FEDERAL', color: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300' },
  { id: 'LOTEP', label: 'LT LOTEP', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300' },
  { id: 'BAND', label: 'LT BAND', color: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300' },
  { id: 'MALUCA', label: 'LT MALUQ RIO', color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300' },
  { id: 'ALVORADA', label: 'LT ALVORADA', color: 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border-cyan-300' },
  { id: 'MINAS', label: 'LT MINAS', color: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' },
  { id: 'BAHIA', label: 'LT BAHIA', color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300' },
  { id: 'OUTRA', label: 'OUTRA (DIGITAR)', color: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300' },
];

const calculateGroup = (numberStr) => {
  if (!numberStr || numberStr.length < 2) return '';
  const number = parseInt(numberStr.slice(-2), 10);
  if (Number.isNaN(number)) return '';
  if (number === 0) return '25';
  return String(Math.ceil(number / 4));
};

const AdminResultsPage = () => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [view, setView] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState({ title: '', text: '' });

  // --- ESTADOS DO FORMULÁRIO ---
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [inputDate, setInputDate] = useState(todayStr);
  
  // inputTime agora pode ser preenchido automaticamente
  const [inputTime, setInputTime] = useState('');
  const [customLotteryName, setCustomLotteryName] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [prizes, setPrizes] = useState(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));

  // --- LÓGICA DE HORÁRIOS FIXOS ---
  // Analisa o arquivo sorteios.js e extrai os horários compatíveis com a loteria selecionada
  const availableTimes = useMemo(() => {
    if (!selectedLottery || selectedLottery === 'OUTRA') return [];
    
    // Procura em todos os grupos de sorteios
    let foundTimes = [];
    
    // Varre a lista oficial (LOTERIAS_SORTEIOS)
    const listaOficial = Array.isArray(LOTERIAS_SORTEIOS) ? LOTERIAS_SORTEIOS : [];
    
    listaOficial.forEach(grupo => {
      if (Array.isArray(grupo.horarios)) {
        grupo.horarios.forEach(fullString => {
          // Verifica se o nome da loteria selecionada está dentro da string do horário
          // Ex: selectedLottery="LT PT RIO" e fullString="LT PT RIO 11HS" -> Match!
          if (fullString.includes(selectedLottery)) {
             // Extrai apenas a parte do horário para exibir no dropdown?
             // OU usa a string inteira? 
             // Vamos usar a string inteira no valor para garantir match perfeito,
             // mas podemos limpar visualmente se quiser.
             // Aqui extraímos a parte que NÃO é o nome da loteria para ficar limpo:
             const timePart = fullString.replace(selectedLottery, '').trim();
             if (timePart) foundTimes.push(timePart);
          }
        });
      }
    });

    // Caso especial: Se selecionou FEDERAL, buscar itens que contenham FEDERAL
    if (selectedLottery === 'FEDERAL') {
       listaOficial.forEach(grupo => {
         grupo.horarios?.forEach(h => {
            if (h.includes('FEDERAL')) {
               const timePart = h.replace('FEDERAL', '').trim(); // ex "20H" ou "19HS"
               if (timePart) foundTimes.push(timePart);
            }
         });
       });
    }

    // Remove duplicatas e ordena
    return [...new Set(foundTimes)].sort();
  }, [selectedLottery]);

  const fetchResults = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/results', { params: { page: 1, pageSize: 50 } });
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
    setActionLoading(id);
    try {
      const res = await api.post(`/admin/results/${id}/settle`);
      const summary = res.data?.summary;
      if (summary) {
        setSuccess(`Liquidação: ${summary.processed} processadas, ${summary.wins} premiadas.`);
      }
      fetchResults();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao liquidar.');
    } finally {
      setActionLoading(null);
    }
  };

  const generatePule = async (id) => {
    if (!id) return;
    setActionLoading(id);
    try {
      const res = await api.post(`/admin/results/${id}/pule`);
      setSuccess(res.data?.alreadyExists ? 'PULE já existia.' : 'PULE gerado com sucesso.');
      fetchResults();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao gerar PULE.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja apagar este resultado?')) return;
    setActionLoading(id);
    try {
      await api.delete(`/admin/results/${id}`);
      fetchResults();
    } catch (err) {
      setError('Erro ao deletar.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartAdd = (lotteryLabel) => {
    setSelectedLottery(lotteryLabel);
    setCustomLotteryName('');
    setEditingId(null);
    setPrizes(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));
    setRawInput('');
    setInputTime('');
    setInputDate(todayStr);
    setView('form');
  };

  const handleEdit = (r) => {
    const nums = r.numeros || [];
    const grps = r.grupos || [];
    
    const newPrizes = Array.from({ length: 7 }, (_, i) => ({
      numero: nums[i] ? String(nums[i]) : '',
      grupo: grps[i] ? String(grps[i]) : ''
    }));
    
    setPrizes(newPrizes);
    
    const knownLottery = LOTERIAS_FIXAS.find(l => l.label === r.loteria);
    if (knownLottery) {
      setSelectedLottery(knownLottery.label);
    } else {
      setSelectedLottery('OUTRA');
      setCustomLotteryName(r.loteria);
    }

    const dateFormatted = r.dataJogo.includes('/') ? r.dataJogo.split('/').reverse().join('-') : r.dataJogo;
    setInputDate(dateFormatted);
    setInputTime(r.codigoHorario || '');
    setEditingId(r.id || r._id);
    setView('form');
  };

  const handleBack = () => {
    setView('dashboard');
    setShowModal(false);
  };

  const handleAddAnother = () => {
    setShowModal(false);
    setPrizes(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));
    setRawInput('');
    setInputTime('');
  };

  const handleSmartPaste = (e) => {
    const text = e.target.value;
    setRawInput(text);
    const cleanData = text.replace(/\D/g, '');
    if (!cleanData) return;

    const newPrizes = Array.from({ length: 7 }, () => ({ numero: '', grupo: '' }));
    let cursor = 0;

    for (let i = 0; i < 7; i++) {
      if (cursor >= cleanData.length) break;
      let numLength = 4;
      if (cleanData.length - cursor < 4) numLength = cleanData.length - cursor;
      const rawNum = cleanData.substr(cursor, numLength);

      if (rawNum) {
        newPrizes[i].numero = rawNum;
        const calcGroup = calculateGroup(rawNum);
        newPrizes[i].grupo = calcGroup;
        cursor += numLength;
        const nextTwo = cleanData.substr(cursor, 2);
        const nextOne = cleanData.substr(cursor, 1);
        const padGroup = calcGroup.padStart(2, '0');
        if (nextTwo === padGroup) cursor += 2;
        else if (nextTwo.length === 2 && nextTwo === calcGroup) cursor += 2;
        else if (nextOne === calcGroup) cursor += 1;
      }
    }
    setPrizes(newPrizes);
  };

  const handleChangePrize = (index, field, value) => {
    const newPrizes = [...prizes];
    newPrizes[index][field] = value;
    if (field === 'numero') {
      newPrizes[index].grupo = calculateGroup(value);
    }
    setPrizes(newPrizes);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numeros = prizes.map(p => p.numero).filter(Boolean);
    const grupos = prizes.map(p => p.grupo).filter(Boolean);

    if (!numeros.length) {
      alert('Preencha pelo menos um número.');
      return;
    }

    const finalLotteryName = selectedLottery === 'OUTRA' ? customLotteryName : selectedLottery;
    
    const payload = {
      loteria: finalLotteryName.trim(), 
      dataJogo: inputDate.split('-').reverse().join('/'),
      codigoHorario: inputTime, // Agora envia exatamente o que estava no dropdown
      numeros,
      grupos
    };

    try {
      if (editingId) {
        await api.put(`/admin/results/${editingId}`, payload);
        setModalMessage({ title: 'Atualizado!', text: 'Resultado editado com sucesso.' });
      } else {
        await api.post('/admin/results', payload);
        setModalMessage({ title: 'Sucesso!', text: 'Resultado cadastrado com sucesso.' });
      }
      setShowModal(true);
      fetchResults();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar.');
    }
  };

  return (
    <AdminLayout
      title={view === 'dashboard' ? 'Resultados' : 'Cadastro de Resultado'}
      subtitle={view === 'dashboard' ? 'Gerencie e liquide os resultados.' : 'Preencha os dados do sorteio.'}
      actions={
        view === 'dashboard' && (
          <button
            onClick={fetchResults}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-semibold text-sm"
          >
            <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar Lista
          </button>
        )
      }
    >
      {(error || success) && (
        <div className={`mb-4 border-l-4 p-3 rounded-r shadow-sm ${error ? 'bg-red-50 border-red-500 text-red-700' : 'bg-emerald-50 border-emerald-500 text-emerald-700'}`}>
          <p className="font-bold">{error ? 'Erro' : 'Sucesso'}</p>
          <p>{error || success}</p>
        </div>
      )}

      {view === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
            {LOTERIAS_FIXAS.map((lot) => (
              <button
                key={lot.id}
                onClick={() => handleStartAdd(lot.label)}
                className={`${lot.color} border-2 h-24 rounded-xl shadow-sm flex items-center justify-center text-sm md:text-base font-black tracking-wide transition-all transform hover:scale-105 hover:shadow-md text-center px-1`}
              >
                {lot.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
              Histórico de Lançamentos
            </div>
            {loading ? (
              <div className="p-8 flex justify-center"><Spinner size={32} /></div>
            ) : (
              <AdminTable headers={['Data', 'Loteria/Hora', 'Resultados', 'Grupos', 'Ações']}>
                {results.length === 0 ? (
                  <AdminTableRow><AdminTableCell colSpan={5} className="text-center py-4">Nenhum resultado.</AdminTableCell></AdminTableRow>
                ) : results.map(r => {
                  const nums = r.numeros || [];
                  const grps = r.grupos || [];
                  return (
                    <AdminTableRow key={r.id || r._id}>
                      <AdminTableCell className="font-semibold">{r.dataJogo}</AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-700">{r.loteria}</span>
                          <span className="text-xs text-slate-500">{r.codigoHorario}</span>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs font-mono text-xs">
                           {nums.join(' - ')}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{grps.join(', ')}</div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => settleResult(r.id || r._id)}
                            disabled={actionLoading === (r.id || r._id)}
                            title="Liquidar Apostas"
                            className="p-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                          >
                             <FaCheck />
                          </button>
                          <button
                            onClick={() => generatePule(r.id || r._id)}
                            disabled={actionLoading === (r.id || r._id)}
                            title="Gerar PDF Pule"
                            className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                             <FaReceipt />
                          </button>
                          <button
                            onClick={() => handleEdit(r)}
                            title="Editar"
                            className="p-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                             <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id || r._id)}
                            title="Excluir"
                            className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                             <FaTrash />
                          </button>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTable>
            )}
          </div>
        </>
      )}

      {view === 'form' && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
             <button onClick={handleBack} className="flex items-center gap-2 font-bold hover:text-emerald-200"><FaArrowLeft /> Voltar</button>
             <h2 className="text-xl font-black uppercase">{selectedLottery === 'OUTRA' ? (customLotteryName || 'Nova Loteria') : selectedLottery}</h2>
             <div className="w-16"></div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                 <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} className="w-full p-3 border rounded-xl" required />
               </div>
               
               {/* --- AQUI ESTÁ A MUDANÇA: DROPDOWN INTELIGENTE --- */}
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
                 {availableTimes.length > 0 ? (
                   <select 
                     value={inputTime} 
                     onChange={e => setInputTime(e.target.value)} 
                     className="w-full p-3 border rounded-xl bg-white font-bold text-emerald-800"
                     required
                   >
                     <option value="">Selecione...</option>
                     {availableTimes.map((time) => (
                       <option key={time} value={time}>{time}</option>
                     ))}
                   </select>
                 ) : (
                   <input 
                     type="text" 
                     value={inputTime} 
                     onChange={e => setInputTime(e.target.value)} 
                     placeholder="Ex: 11:00" 
                     className="w-full p-3 border rounded-xl" 
                     required 
                   />
                 )}
               </div>
            </div>

            {selectedLottery === 'OUTRA' && (
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Loteria</label>
                 <input type="text" value={customLotteryName} onChange={e => setCustomLotteryName(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Ex: LT PT RIO..." required />
               </div>
            )}

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
               <label className="block text-xs font-bold text-emerald-800 uppercase mb-2">⚡ Colagem Rápida</label>
               <textarea 
                  value={rawInput} 
                  onChange={handleSmartPaste} 
                  placeholder="Cole a linha inteira aqui (Ex: 2690 1480...)" 
                  className="w-full p-3 border border-emerald-300 rounded-lg font-mono text-sm h-20" 
               />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <div className="grid grid-cols-[40px_1fr_1fr] gap-4 mb-2 font-black text-xs text-slate-500 uppercase text-center">
                  <span>#</span><span>Milhar</span><span>Grupo</span>
               </div>
               {prizes.map((prize, idx) => (
                  <div key={idx} className="grid grid-cols-[40px_1fr_1fr] gap-4 mb-3 items-center">
                     <span className="text-center font-bold text-slate-400">{idx + 1}º</span>
                     <input 
                       value={prize.numero} 
                       onChange={e => handleChangePrize(idx, 'numero', e.target.value)} 
                       className="p-3 border-2 border-slate-200 rounded-lg text-center font-mono text-lg font-bold" 
                       maxLength={4} 
                       placeholder="0000" 
                     />
                     <input 
                       value={prize.grupo} 
                       onChange={e => handleChangePrize(idx, 'grupo', e.target.value)} 
                       className="p-3 border-2 border-slate-200 rounded-lg text-center font-bold text-lg bg-slate-200" 
                       maxLength={2} 
                       placeholder="Gr" 
                     />
                  </div>
               ))}
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition">
               {editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR RESULTADO'}
            </button>
          </form>
        </div>
      )}

      {showModal && (
         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-bounce-in">
               <div className="text-4xl mb-4">✅</div>
               <h2 className="text-2xl font-black text-slate-800">{modalMessage.title}</h2>
               <p className="text-slate-500 mb-8">{modalMessage.text}</p>
               <div className="space-y-3">
                  <button onClick={handleAddAnother} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">ADICIONAR OUTRO</button>
                  <button onClick={handleBack} className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold">VOLTAR AO INÍCIO</button>
               </div>
            </div>
         </div>
      )}
    </AdminLayout>
  );
};

export default AdminResultsPage;
