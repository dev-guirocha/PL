import React, { useEffect, useState } from 'react';
import { FaSyncAlt, FaSearch } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';

const AdminBetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchBets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/bets', {
        params: { page, limit: 20, search }
      });
      
      const lista = res.data.bets || res.data || [];
      const total = res.data.total || lista.length;
      
      setBets(lista);
      setTotalPages(Math.ceil(total / 20));
    } catch (error) {
      console.error('Erro ao buscar apostas', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
  }, [page]);

  const renderPalpites = (palpitesRaw) => {
    try {
      let dados = palpitesRaw;
      if (typeof dados === 'string') {
        dados = JSON.parse(dados);
      }

      if (Array.isArray(dados)) {
        return dados.map((p) => p.numero || p.bicho || p.jogo || p).join(', ');
      }

      if (typeof dados === 'object' && dados !== null) {
        return dados.numero || dados.jogo || JSON.stringify(dados);
      }

      return 'Sem palpites';
    } catch (err) {
      return 'Erro dados';
    }
  };

  const renderStatus = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'won' || s === 'premiado') return <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded">PREMIADA</span>;
    if (s === 'lost' || s === 'nao premiado') return <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded">PERDEU</span>;
    return <span className="text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded">ABERTA</span>;
  };

  return (
    <AdminLayout 
      title="Gerenciar Apostas" 
      subtitle="Visualize todas as apostas realizadas."
      actions={
        <button onClick={fetchBets} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-bold">
          <FaSyncAlt /> Atualizar
        </button>
      }
    >
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <AdminTable headers={['ID', 'Usuário', 'Data/Hora', 'Loteria', 'Modalidade', 'Palpites', 'Valor', 'Status']}>
              {bets.length === 0 ? (
                <AdminTableRow>
                  <AdminTableCell colSpan={8} className="text-center py-8 text-slate-500">
                    Nenhuma aposta encontrada.
                  </AdminTableCell>
                </AdminTableRow>
              ) : (
                bets.map((bet) => (
                  <AdminTableRow key={bet.id}>
                    <AdminTableCell><span className="text-xs font-mono text-slate-400">#{bet.id}</span></AdminTableCell>
                    <AdminTableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{bet.user?.name || 'Anonimo'}</span>
                        <span className="text-xs text-slate-500">{bet.user?.phone}</span>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                       <div className="flex flex-col text-xs">
                          <span className="font-bold">{bet.dataJogo}</span>
                          <span className="text-slate-500">{bet.codigoHorario}</span>
                       </div>
                    </AdminTableCell>
                    <AdminTableCell><span className="font-bold text-indigo-700 text-xs">{bet.loteria}</span></AdminTableCell>
                    <AdminTableCell><span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold">{bet.modalidade}</span></AdminTableCell>
                    <AdminTableCell>
                        <div className="max-w-[200px] truncate text-xs font-mono bg-yellow-50 text-yellow-800 p-1 rounded border border-yellow-100">
                            {renderPalpites(bet.palpites)}
                        </div>
                    </AdminTableCell>
                    <AdminTableCell className="font-bold text-emerald-700">R$ {Number(bet.total).toFixed(2)}</AdminTableCell>
                    <AdminTableCell>{renderStatus(bet.status)}</AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTable>

            {/* Paginação Simples */}
            <div className="p-4 border-t border-slate-100 flex justify-between items-center">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm font-bold text-slate-600">Página {page} de {totalPages || 1}</span>
                <button 
                  disabled={page >= totalPages} 
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50"
                >
                  Próxima
                </button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBetsPage;
