import { useEffect, useState } from "react";
import api from "../api";

export default function AIProfileCard() {
  const [ia, setIa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIA();
  }, []);

  const fetchIA = async () => {
    try {
      const response = await api.get('/ml/perfil');
      setIa(response.data);
    } catch (error) {
      console.error("Erro IA:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const getColor = () => {
    if (!ia) return 'text-stone-400';
    switch (ia.perfil) {
      case 'Gastador':
        return 'text-rose-400';
      case 'Equilibrado':
        return 'text-yellow-400';
      case 'Econômico':
        return 'text-lime-400';
      default:
        return 'text-stone-400';
    }
  };

  const getMessage = () => {
    if (!ia) return '';
    switch (ia.perfil) {
      case 'Gastador':
        return 'Seus gastos estão altos. Tente poupar um pouco mais e reduzir despesas variáveis imediatamente.';
      case 'Equilibrado':
        return 'Seu perfil financeiro está equilibrado. Continue monitorando seus gastos para poupar ainda mais.';
      case 'Econômico':
        return 'Excelente controle financeiro! Seu orçamento está muito saudável e você possui uma ótima taxa de poupança.';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
        <p className="text-stone-400">
          🤖 Analisando perfil financeiro por IA...
        </p>
      </div>
    );
  }

  if (!ia) return null;

  return (
    <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex-1 mr-2">
          Algoritimo de Saúde Financeira
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-stone-450 text-sm font-medium">Score: {ia.score || 0}/100</span>
          <span className={`font-bold ${getColor()}`}>
            ({ia.perfil})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-stone-400 text-sm">
            Receitas
          </p>
          <p className="text-white font-semibold">
            {formatCurrency(ia.receitas)}
          </p>
        </div>

        <div>
          <p className="text-stone-400 text-sm">
            Despesas
          </p>
          <p className="text-white font-semibold">
            {formatCurrency(ia.despesas)}
          </p>
        </div>

        <div>
          <p className="text-stone-400 text-sm">
            Saldo
          </p>
          <p className={`font-semibold ${ia.saldo >= 0 ? 'text-lime-400' : 'text-rose-400'}`}>
            {formatCurrency(ia.saldo)}
          </p>
        </div>

        <div>
          <p className="text-stone-400 text-sm">
            Gasto Médio
          </p>
          <p className="text-white font-semibold">
            {formatCurrency(ia.gasto_medio)}
          </p>
        </div>
      </div>

      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 text-sm text-stone-300">
        {getMessage()}
      </div>
    </div>
  );
}