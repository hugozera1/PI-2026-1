import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Plus, X, ArrowUpCircle, ArrowDownCircle, Banknote, LogOut, Trash2, User, Lock, Mail } from 'lucide-react';
import api from './api';
import AIProfileCard from "./components/AIProfileCard";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const CATEGORIES = ['Alimentação', 'Transporte', 'Lazer', 'Contas', 'Educação', 'Salário', 'Outros'];

export default function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('spendly_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('spendly_user')));
  const [view, setView] = useState(localStorage.getItem('spendly_token') ? 'dashboard' : 'login');

  // Auth Forms State
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard State
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, txRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/transactions')
      ]);
      setData(dashRes.data);
      setTransactions(txRes.data.filter(t => t.amount !== undefined && t.date).slice(0, 10)); // pega ultimas 10 
    } catch (error) {
      console.error('Error fetching dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/login', {
        email: authEmail,
        password: authPassword
      });
      localStorage.setItem('spendly_token', res.data.token);
      localStorage.setItem('spendly_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setView('dashboard');
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Erro ao realizar login. Tente novamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/register', {
        name: authName,
        email: authEmail,
        password: authPassword
      });
      localStorage.setItem('spendly_token', res.data.token);
      localStorage.setItem('spendly_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setView('dashboard');
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Erro ao realizar cadastro. Tente novamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('spendly_token');
    localStorage.removeItem('spendly_user');
    setToken(null);
    setUser(null);
    setView('login');
    setData(null);
    setTransactions([]);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount.replace(',', '.'))) return alert('Insira um valor válido');
    
    setSaving(true);
    try {
      await api.post('/transactions', {
        amount: parseFloat(amount.replace(',', '.')),
        category,
        description,
        type
      });
      setModalOpen(false);
      setAmount('');
      setDescription('');
      fetchDashboard(); // recarrega os dados e componentes
    } catch (error) {
      alert('Erro ao salvar transação');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Tem certeza de que deseja excluir esta transação?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchDashboard();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao excluir transação');
    }
  };

  // Render Authentication View
  if (view === 'login' || view === 'register') {
    return (
      <div className="min-h-screen bg-stone-950 text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="bg-stone-900/50 backdrop-blur-xl border border-stone-850 p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-2xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center mb-3">
              <Banknote className="h-7 w-7 text-lime-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-lime-400">SPENDLY</h1>
            <p className="text-stone-400 text-sm mt-1 text-center">
              {view === 'login' ? 'Entre na sua conta para gerenciar seu portfolio' : 'Crie sua conta para gerenciar seu portfolio'}
            </p>
          </div>

          {authError && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span className="text-rose-400">⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-4">
            {view === 'register' && (
              <div>
                <label className="block text-stone-450 text-xs mb-1.5 uppercase tracking-wider font-semibold">Nome Completo</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-500 pointer-events-none">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-stone-950/80 border border-stone-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/50 transition-all text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-stone-450 text-xs mb-1.5 uppercase tracking-wider font-semibold">E-mail</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-500 pointer-events-none">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-stone-950/80 border border-stone-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-450 text-xs mb-1.5 uppercase tracking-wider font-semibold">Senha</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-500 pointer-events-none">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-950/80 border border-stone-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-lime-500 hover:bg-lime-400 text-stone-950 font-bold py-3.5 rounded-xl mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-lime-500/20 text-sm cursor-pointer"
            >
              {authLoading ? 'Processando...' : view === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm">
            <p className="text-stone-400">
              {view === 'login' ? 'Não tem uma conta?' : 'Já possui uma conta?'}
              <button
                onClick={() => {
                  setView(view === 'login' ? 'register' : 'login');
                  setAuthError('');
                  setAuthName('');
                  setAuthEmail('');
                  setAuthPassword('');
                }}
                className="text-lime-400 hover:text-lime-300 font-semibold ml-1.5 transition-colors focus:outline-none cursor-pointer"
              >
                {view === 'login' ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Carregando carteira...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Prepare Doughnut
  const categoryLabels = Object.keys(data.expensesByCategory);
  const categoryValues = Object.values(data.expensesByCategory);
  const doughnutData = {
    labels: categoryLabels,
    datasets: [
      {
        data: categoryValues,
        backgroundColor: ['#84cc16', '#bef264', '#14b8a6', '#0ea5e9', '#ec4899', '#f59e0b', '#64748b'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const doughnutOptions = {
    plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } } },
    cutout: '75%',
  };

  // Prepare Bar
  const monthLabels = Object.keys(data.monthlyTrends).sort();
  const incomeData = monthLabels.map(m => data.monthlyTrends[m].income);
  const expenseData = monthLabels.map(m => data.monthlyTrends[m].expense);
  const barData = {
    labels: monthLabels,
    datasets: [
      { label: 'Receitas', data: incomeData, backgroundColor: '#84cc16', borderRadius: 4 },
      { label: 'Despesas', data: expenseData, backgroundColor: '#10b981', opacity: 0.5, borderRadius: 4 }, // a lighter or darker green variant
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { position: 'top', labels: { color: '#d1d5db' } } },
    scales: {
      y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
      x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
    },
  };

  const formatCurrency = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-stone-950 text-white font-sans selection:bg-lime-500/30 pb-20">
      
      {/* Header */}
      <div className="border-b border-white/5 bg-stone-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Spendly Logo" className="h-10 w-10 object-contain rounded" onError={(e) => e.target.style.display = 'none'} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-lime-400 leading-tight">SPENDLY</h1>
              <p className="text-gray-400 text-xs tracking-wider uppercase">Financial</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-stone-300 text-sm hidden md:inline font-medium">
              Olá, <span className="text-lime-400">{user?.name}</span>
            </span>

            <button 
              onClick={() => setModalOpen(true)} 
              className="bg-lime-500 hover:bg-lime-400 text-stone-950 font-semibold px-4 py-2 rounded-full flex items-center gap-2 transition-colors shadow-lg shadow-lime-500/20 cursor-pointer"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nova Transação</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-stone-400 hover:text-rose-400 bg-stone-900 hover:bg-rose-500/10 p-2 rounded-full transition-all border border-stone-800 cursor-pointer"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-gray-400 text-sm font-medium">Saldo Atual</h3>
              <Banknote size={20} className={data.summary.balance >= 0 ? "text-lime-400" : "text-rose-400"} />
            </div>
            <p className={`text-4xl font-semibold tracking-tight ${data.summary.balance >= 0 ? 'text-lime-400' : 'text-rose-400'}`}>
              {formatCurrency(data.summary.balance)}
            </p>
          </div>
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-gray-400 text-sm font-medium">Receitas</h3>
              <ArrowUpCircle size={20} className="text-emerald-500" />
            </div>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {formatCurrency(data.summary.totalIncome)}
            </p>
          </div>
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
             <div className="flex justify-between items-start mb-2">
              <h3 className="text-gray-400 text-sm font-medium">Despesas</h3>
              <ArrowDownCircle size={20} className="text-stone-500" />
            </div>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {formatCurrency(data.summary.totalExpense)}
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 col-span-1 lg:col-span-2">
             <h2 className="text-lg font-semibold text-white mb-4">Análise Mensal</h2>
             <div className="relative h-64">
               {monthLabels.length > 0 ? (
                 <Bar data={barData} options={barOptions} />
               ) : (
                 <div className="flex items-center justify-center w-full h-full text-stone-500">Sem dados mensais</div>
               )}
             </div>
          </div>
          
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
             <h2 className="text-lg font-semibold text-white mb-6">Por Categoria</h2>
             <div className="relative h-64 flex justify-center">
               {categoryValues.length > 0 ? (
                 <Doughnut data={doughnutData} options={doughnutOptions} />
               ) : (
                 <div className="flex items-center justify-center w-full h-full text-stone-500">Sem dados</div>
               )}
             </div>
          </div>
        </div>

        {/* AI CARD */}
        <div className="mb-8">
          <AIProfileCard />
        </div>

        {/* Recent Transactions List */}
        <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-lg font-semibold text-white">Transações Recentes</h2>
             <span className="text-xs text-stone-400 bg-stone-800 px-2 py-1 rounded-full">{transactions.length} registros</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 text-sm">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Categoria</th>
                  <th className="pb-3 font-medium">Descrição</th>
                  <th className="pb-3 font-medium text-right">Valor</th>
                  <th className="pb-3 font-medium text-right pr-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan="5" className="py-8 text-center text-stone-500">Nenhuma transação encontrada.</td></tr>
                )}
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-stone-800/50 hover:bg-stone-800/20 transition-colors">
                    <td className="py-4 text-sm text-stone-300">
                      {new Date(tx.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4">
                      <span className="bg-stone-800 text-stone-300 text-xs px-2 py-1 rounded-md border border-stone-700">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-stone-400">
                      {tx.description || '-'}
                    </td>
                    <td className={`py-4 text-right font-medium ${tx.type === 'income' ? 'text-lime-400' : 'text-white'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="py-4 text-right pr-4">
                      <button 
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="text-stone-500 hover:text-rose-400 bg-stone-800/40 hover:bg-rose-500/10 p-1.5 rounded-lg border border-stone-800/80 transition-all inline-flex items-center justify-center cursor-pointer"
                        title="Excluir Transação"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modern Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-stone-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Nova Transação</h2>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-white transition-colors cursor-pointer">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-6 flex flex-col gap-5">
              
              {/* Type Switcher */}
              <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800">
                <button 
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${type === 'expense' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                  onClick={() => setType('expense')}
                >
                  Despesa
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${type === 'income' ? 'bg-lime-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                  onClick={() => setType('income')}
                >
                  Receita
                </button>
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 uppercase tracking-wider">Valor (R$)</label>
                <input 
                  type="number" step="0.01" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 uppercase tracking-wider">Categoria</label>
                <select 
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-all"
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-stone-400 text-xs mb-1 uppercase tracking-wider">Descrição Opcional</label>
                <input 
                  type="text" 
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Almoço, Uber..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-all"
                />
              </div>

              <button 
                type="submit" disabled={saving}
                className="w-full bg-lime-500 hover:bg-lime-400 text-stone-950 font-bold text-lg py-4 rounded-xl mt-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? 'Registrando...' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
