import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

// --- CONFIGURAÇÃO DAS LOTERIAS ---
const LOTERIAS_FIXAS = [
  { id: 'PT-RIO', label: 'PT RIO', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300' },
  { id: 'LOOK', label: 'LOOK', color: 'bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-300' },
  { id: 'NACIONAL', label: 'NACIONAL', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300' },
  { id: 'FEDERAL', label: 'FEDERAL', color: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300' },
  { id: 'LOTEP', label: 'LOTEP', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300' },
  { id: 'BAND', label: 'BAND', color: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300' },
  { id: 'MALUCA', label: 'MALUCA', color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300' },
  { id: 'ALVORADA', label: 'ALVORADA', color: 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border-cyan-300' },
  { id: 'MINAS', label: 'MINAS', color: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' },
  { id: 'OUTRA', label: 'OUTRA (DIGITAR)', color: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300' },
];

// Função auxiliar para calcular o grupo do bicho
const calculateGroup = (numberStr) => {
  if (!numberStr || numberStr.length < 2) return '';
  const number = parseInt(numberStr.slice(-2), 10);
  if (Number.isNaN(number)) return '';
  if (number === 0) return '25';
  return String(Math.ceil(number / 4));
};

const ResultsManager = ({ resultForm, setResultForm, results, createResult }) => {
  // ESTADOS DE NAVEGAÇÃO
  const [step, setStep] = useState('selection'); // 'selection' | 'form'
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedLottery, setSelectedLottery] = useState(null);

  // ESTADOS DO FORMULÁRIO
  const [prizes, setPrizes] = useState(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));
  const [rawInput, setRawInput] = useState(''); // Campo de colar rápido
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]); // Data padrão hoje
  const [inputTime, setInputTime] = useState('');

  // Sincroniza os dados visuais com o formato que a API espera
  useEffect(() => {
    const numerosArray = prizes.map((p) => p.numero).filter((n) => n !== '');
    const gruposArray = prizes.map((p) => p.grupo).filter((g) => g !== '');

    setResultForm((prev) => ({
      ...prev,
      loteria: selectedLottery === 'OUTRA' ? prev.loteria : selectedLottery,
      dataJogo: inputDate.split('-').reverse().join('/'), // YYYY-MM-DD -> DD/MM/AAAA
      codigoHorario: inputTime,
      numeros: numerosArray.join(','),
      grupos: gruposArray.join(','),
    }));
  }, [prizes, selectedLottery, inputDate, inputTime, setResultForm]);

  // --- LÓGICA DE NAVEGAÇÃO ---
  const handleSelectLottery = (lotteryId) => {
    setSelectedLottery(lotteryId);
    setStep('form');
    setPrizes(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));
    setRawInput('');
    setInputTime('');
    setEditingId(null);
  };

  const handleBackToSelection = () => {
    setStep('selection');
    setShowModal(false);
    setSelectedLottery(null);
  };

  const handleAddAnother = () => {
    setShowModal(false);
    setPrizes(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));
    setRawInput('');
    setInputTime('');
  };

  // --- LÓGICA DE SUBMISSÃO ---
  const handleSubmitWrapper = async (e) => {
    e.preventDefault();
    const numeros = prizes.map((p) => p.numero).filter(Boolean);
    const grupos = prizes.map((p) => p.grupo).filter(Boolean);
    if (!selectedLottery || !numeros.length || !inputDate || !inputTime) return;

    const payload = {
      loteria: selectedLottery === 'OUTRA' ? resultForm.loteria : selectedLottery,
      dataJogo: inputDate.split('-').reverse().join('/'),
      codigoHorario: inputTime,
      numeros,
      grupos,
    };

    try {
      if (editingId) {
        await api.put(`/admin/results/${editingId}`, payload);
      } else {
        await api.post('/admin/results', payload);
      }
      setShowModal(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar resultado.';
      alert(msg);
    }
  };

  // --- PARSER INTELIGENTE (COLAR) ---
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
        const calculatedGroup = calculateGroup(rawNum);
        newPrizes[i].grupo = calculatedGroup;

        cursor += numLength;

        // Lógica para pular o grupo se ele estiver na cola
        const nextTwo = cleanData.substr(cursor, 2);
        const nextOne = cleanData.substr(cursor, 1);
        const padGroup = calculatedGroup.padStart(2, '0');

        if (nextTwo === padGroup) cursor += 2;
        else if (nextTwo.length === 2 && nextTwo === calculatedGroup) cursor += 2;
        else if (nextOne === calculatedGroup) cursor += 1;
      }
    }
    setPrizes(newPrizes);
  };

  const handleChange = (index, field, value) => {
    const newPrizes = [...prizes];
    newPrizes[index][field] = value;
    if (field === 'numero') {
      newPrizes[index].grupo = calculateGroup(value);
    }
    setPrizes(newPrizes);
  };

  const parseArrays = (field) => {
    if (Array.isArray(field)) return field;
    try {
      const parsed = JSON.parse(field || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleEdit = (r) => {
    const nums = parseArrays(r.numeros);
    const grps = parseArrays(r.grupos);
    const padded = Array.from({ length: 7 }, (_, i) => ({
      numero: nums[i] ? String(nums[i]).padStart(4, '0') : '',
      grupo: grps[i] ? String(grps[i]).padStart(2, '0') : '',
    }));
    setPrizes(padded);
    setSelectedLottery(r.loteria);
    const dateStr = r.dataJogo?.includes('/') ? r.dataJogo.split('/').reverse().join('-') : r.dataJogo || '';
    setInputDate(dateStr || new Date().toISOString().split('T')[0]);
    setInputTime(r.codigoHorario || '');
    setEditingId(r.id);
    setShowModal(false);
    setStep('form');
    setRawInput('');
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm('Deseja realmente excluir este resultado?');
    if (!ok) return;
    try {
      await api.delete(`/admin/results/${id}`);
      window.location.reload();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao excluir resultado.';
      alert(msg);
    }
  };

  // --- RENDER: ETAPA 1 (SELEÇÃO) ---
  if (step === 'selection') {
    return (
      <div className="admin-card results space-y-6">
        <div className="admin-card-header text-center text-xl">Escolha a Loteria</div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
          {LOTERIAS_FIXAS.map((lot) => (
            <button
              key={lot.id}
              onClick={() => handleSelectLottery(lot.label)}
              className={`${lot.color} border-2 h-32 rounded-2xl shadow-sm flex items-center justify-center text-lg font-black tracking-wide transition-all transform hover:scale-105 hover:shadow-md`}
            >
              {lot.label}
            </button>
          ))}
        </div>

        <div className="mt-8 border-t pt-4 px-4">
          <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Últimos Lançamentos</h3>
          <div className="space-y-2">
            {results.slice(0, 5).map((r) => (
              <div key={r.id} className="text-xs flex justify-between bg-slate-50 p-2 rounded items-center gap-2">
                <div className="flex-1 flex flex-col">
                  <span className="font-bold text-emerald-700">{r.loteria}</span>
                  <span>
                    {r.codigoHorario} - {r.dataJogo}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(r)}
                    className="px-2 py-1 rounded border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="px-2 py-1 rounded border border-red-200 text-red-700 font-bold hover:bg-red-50"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: ETAPA 2 (FORMULÁRIO) ---
  return (
    <div className="admin-card results relative">
      <div className="admin-card-header flex items-center justify-between bg-emerald-700 text-white p-4 rounded-t-lg">
        <button
          type="button"
          onClick={handleBackToSelection}
          className="text-white text-sm font-bold bg-emerald-800 px-3 py-1 rounded hover:bg-emerald-900"
        >
          ← Voltar
        </button>
        <div className="font-bold text-lg">{selectedLottery}</div>
        <div className="w-16" />
      </div>

      <form className="admin-form p-4 space-y-6" onSubmit={handleSubmitWrapper}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="w-full p-3 border rounded-xl font-bold text-slate-700 bg-slate-50 focus:bg-white border-slate-300"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Horário</label>
            <input
              type="text"
              placeholder="Ex: 11:00"
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
              className="w-full p-3 border rounded-xl font-bold text-slate-700 bg-slate-50 focus:bg-white border-slate-300"
              required
            />
          </div>
        </div>

        {selectedLottery === 'OUTRA' && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Nome da Loteria Personalizada</label>
            <input
              value={resultForm.loteria || ''}
              onChange={(e) => setResultForm({ ...resultForm, loteria: e.target.value })}
              className="w-full p-3 border rounded-xl"
              placeholder="Digite o nome..."
              required
            />
          </div>
        )}

        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
          <label className="block text-xs font-bold text-emerald-800 uppercase mb-2">⚡ Colar Resultados (Linha Inteira)</label>
          <textarea
            value={rawInput}
            onChange={handleSmartPaste}
            placeholder="Cole aqui ex: 2690 1480 3290..."
            className="w-full p-2 border border-emerald-300 rounded-lg text-sm font-mono h-16 resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-[30px_1fr_1fr] gap-4 mb-2 font-black text-xs text-slate-500 uppercase text-center">
            <span>#</span>
            <span>Milhar</span>
            <span>Grupo</span>
          </div>

          {prizes.map((prize, index) => (
            <div key={index} className="grid grid-cols-[30px_1fr_1fr] gap-4 mb-3 items-center">
              <span className="text-slate-400 font-bold text-center text-sm">{index + 1}º</span>
              <input
                type="text"
                value={prize.numero}
                onChange={(e) => handleChange(index, 'numero', e.target.value)}
                className="p-3 border-2 border-slate-200 rounded-lg text-center font-mono text-lg font-bold text-slate-800 bg-white focus:border-emerald-500 outline-none"
                maxLength={4}
                placeholder="0000"
              />
              <input
                type="text"
                value={prize.grupo}
                onChange={(e) => handleChange(index, 'grupo', e.target.value)}
                className="p-3 border-2 border-slate-200 rounded-lg text-center font-bold text-lg text-white bg-slate-400 focus:bg-emerald-600 transition-colors outline-none"
                maxLength={2}
                placeholder="Gr"
                tabIndex={-1}
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition transform hover:-translate-y-1"
        >
          {editingId ? 'ATUALIZAR RESULTADO' : 'SALVAR RESULTADO'}
        </button>
      </form>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-bounce-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ✅
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Sucesso!</h2>
            <p className="text-slate-500 mb-8">O resultado foi cadastrado corretamente.</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAddAnother}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700"
              >
                ADICIONAR OUTRO RESULTADO
              </button>
              <button
                type="button"
                onClick={handleBackToSelection}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200"
              >
                VOLTAR PARA O INÍCIO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsManager;
