import "./global.css";
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Set this to true to use the production Azure backend, or false to use the local development backend
const USE_PRODUCTION_BACKEND = true;
const AZURE_BACKEND_URL = 'https://pi-5-gvfngxh8heavbvat.southafricanorth-01.azurewebsites.net';

// Dynamic IP resolution for Expo Go and Emulator environments
let ip = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
try {
  if (Constants?.expoConfig?.hostUri) {
    ip = Constants.expoConfig.hostUri.split(':')[0];
  } else if (Constants?.manifest?.debuggerHost) {
    ip = Constants.manifest.debuggerHost.split(':')[0];
  } else if (Constants?.experienceUrl) {
    ip = Constants.experienceUrl.split('//')[1].split(':')[0];
  }
} catch (e) {
  console.log('Failed to parse dynamic IP, using fallback', e);
}

const API_URL = USE_PRODUCTION_BACKEND ? AZURE_BACKEND_URL : `http://${ip}:3000`;

// Configure axios instance with interceptor to inject JWT token automatically
const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use(async (config) => {
  const storedToken = await AsyncStorage.getItem('spendly_token');
  if (storedToken) {
    config.headers.Authorization = `Bearer ${storedToken}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('spendly_token');
      await AsyncStorage.removeItem('spendly_user');
      Alert.alert("Sessão Expirada", "Por favor, faça login novamente.");
    }
    return Promise.reject(error);
  }
);

function MainApp() {
  // Authentication State
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); // 'login' | 'register' | 'dashboard'

  // Auth Forms State
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard State
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [iaData, setIaData] = useState(null);

  // Form State for new transaction
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('expense');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const checkAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('spendly_token');
      const storedUser = await AsyncStorage.getItem('spendly_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setView('dashboard');
      } else {
        setView('login');
      }
    } catch (e) {
      console.log('Error checking authentication:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, dashRes, iaRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/dashboard'),
        api.get('/ml/perfil').catch(e => {
          console.log('ML not ready yet:', e.message);
          return { data: null };
        })
      ]);
      setTransactions(txRes.data.slice(0, 10)); // ultimas 10
      setBalance(dashRes.data.summary.balance);
      if (iaRes && iaRes.data) {
        setIaData(iaRes.data);
      }
    } catch (error) {
      console.log('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!authEmail || !authPassword) {
      Alert.alert("Erro", "Preencha todos os campos.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: authEmail.trim(),
        password: authPassword
      });
      await AsyncStorage.setItem('spendly_token', res.data.token);
      await AsyncStorage.setItem('spendly_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setView('dashboard');
      Alert.alert("Sucesso", "Login realizado!");
    } catch (error) {
      Alert.alert("Erro de Login", error.response?.data?.error || "E-mail ou senha inválidos.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!authName || !authEmail || !authPassword) {
      Alert.alert("Erro", "Preencha todos os campos.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/register`, {
        name: authName.trim(),
        email: authEmail.trim().toLowerCase(),
        password: authPassword
      });
      await AsyncStorage.setItem('spendly_token', res.data.token);
      await AsyncStorage.setItem('spendly_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setView('dashboard');
      Alert.alert("Sucesso", "Cadastro realizado com sucesso!");
    } catch (error) {
      Alert.alert("Erro de Cadastro", error.response?.data?.error || "Falha ao realizar cadastro.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('spendly_token');
    await AsyncStorage.removeItem('spendly_user');
    setToken(null);
    setUser(null);
    setView('login');
    setTransactions([]);
    setBalance(0);
    setIaData(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
  };

  const handleAddTransaction = async () => {
    if (!amount || !category) {
      Alert.alert("Erro", "Preencha o valor e a categoria.");
      return;
    }

    try {
      await api.post('/transactions', {
        amount: parseFloat(amount.replace(',', '.')),
        category,
        description,
        type
      });
      setModalVisible(false);
      setAmount('');
      setDescription('');
      fetchData(); // atualizar
      Alert.alert("Sucesso", "Transação registrada!");
    } catch (error) {
      Alert.alert("Erro", "Falha ao salvar transação.");
    }
  };

  const handleDeleteTransaction = (id) => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir esta transação?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/transactions/${id}`);
              fetchData();
              Alert.alert("Sucesso", "Transação excluída!");
            } catch (error) {
              Alert.alert("Erro", "Falha ao excluir transação.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-grow justify-center items-center bg-zinc-950">
        <ActivityIndicator size="large" color="#84cc16" />
        <Text className="text-zinc-400 mt-4 font-semibold">Carregando...</Text>
      </View>
    );
  }

  // --- RENDER AUTH SCREENS ---
  if (view === 'login' || view === 'register') {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950 justify-center px-6" edges={['top', 'bottom']}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
            <View className="items-center mb-8">
              <View className="h-14 w-14 rounded-2xl bg-lime-500/10 border border-lime-500/20 items-center justify-center mb-3">
                <Text className="text-lime-400 text-3xl font-bold">S</Text>
              </View>
              <Text className="text-3xl font-extrabold text-lime-400 tracking-tight">SPENDLY</Text>
              <Text className="text-zinc-400 text-xs mt-1 uppercase tracking-wider">Financial Portfolio Manager</Text>
            </View>

            {view === 'register' && (
              <View className="mb-4">
                <Text className="text-zinc-400 text-xs mb-1.5 uppercase font-semibold">Nome Completo</Text>
                <TextInput
                  className="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-3.5 text-sm"
                  placeholder="Seu nome"
                  placeholderTextColor="#52525b"
                  value={authName}
                  onChangeText={setAuthName}
                />
              </View>
            )}

            <View className="mb-4">
              <Text className="text-zinc-400 text-xs mb-1.5 uppercase font-semibold">E-mail</Text>
              <TextInput
                className="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-3.5 text-sm"
                placeholder="exemplo@email.com"
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                value={authEmail}
                onChangeText={setAuthEmail}
              />
            </View>

            <View className="mb-6">
              <Text className="text-zinc-400 text-xs mb-1.5 uppercase font-semibold">Senha</Text>
              <TextInput
                className="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-3.5 text-sm"
                placeholder="••••••••"
                placeholderTextColor="#52525b"
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
              />
            </View>

            <TouchableOpacity
              className="bg-lime-500 py-4 rounded-xl items-center shadow-lg shadow-lime-500/10"
              onPress={view === 'login' ? handleLogin : handleRegister}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator size="small" color="#0c0a09" />
              ) : (
                <Text className="text-zinc-950 font-bold text-base">
                  {view === 'login' ? 'Entrar' : 'Cadastrar'}
                </Text>
              )}
            </TouchableOpacity>

            <View className="mt-8 flex-row justify-center">
              <Text className="text-zinc-400 text-sm">
                {view === 'login' ? 'Não tem uma conta?' : 'Já possui uma conta?'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setView(view === 'login' ? 'register' : 'login');
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthName('');
                }}
              >
                <Text className="text-lime-400 font-bold text-sm ml-2">
                  {view === 'login' ? 'Cadastre-se' : 'Faça login'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }

  // --- RENDER DASHBOARD SCREEN ---
  const formatBRL = (val) => `R$ ${parseFloat(val || 0).toFixed(2).replace('.', ',')}`;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>

      {/* Dynamic Header */}
      <View className="flex-row justify-between items-center px-6 py-4 border-b border-zinc-900 bg-zinc-900/30">
        <View>
          <Text className="text-lime-400 text-2xl font-bold">SPENDLY</Text>
          <Text className="text-zinc-400 text-xs">Olá, {user?.name}</Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-zinc-900 border border-zinc-850 px-4 py-2 rounded-full"
        >
          <Text className="text-rose-400 font-bold text-xs">Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

        {/* Balance Card */}
        <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-8">
          <Text className="text-zinc-400 text-sm mb-1 uppercase tracking-wider font-semibold">Saldo Disponível</Text>
          <Text className={`text-4xl font-bold ${balance >= 0 ? 'text-lime-400' : 'text-rose-400'}`}>
            {formatBRL(balance)}
          </Text>
        </View>

        {/* AI Health Score Card */}
        {iaData && (
          <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-8">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white text-lg font-bold flex-1 mr-2">Algoritimo de Saúde Financeira</Text>
              <View className="flex-row items-center gap-1.5 shrink-0">
                <Text className="text-zinc-450 text-xs font-semibold">Score: {iaData.score}/100</Text>
                <Text className={`font-bold text-xs ${iaData.perfil === 'Econômico' ? 'text-lime-400' :
                    iaData.perfil === 'Equilibrado' ? 'text-yellow-400' : 'text-rose-400'
                  }`}>
                  ({iaData.perfil})
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between mb-4 bg-zinc-950/50 p-3.5 rounded-2xl border border-zinc-850">
              <View>
                <Text className="text-zinc-500 text-xs">Gasto Médio</Text>
                <Text className="text-white font-bold text-sm mt-0.5">{formatBRL(iaData.gasto_medio)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-zinc-500 text-xs">Margem Poupança</Text>
                <Text className={`font-bold text-sm mt-0.5 ${iaData.taxa_poupanca >= 0 ? 'text-lime-400' : 'text-rose-400'}`}>
                  {Math.round(iaData.taxa_poupanca * 100)}%
                </Text>
              </View>
            </View>

            <View className="bg-zinc-950 border border-zinc-850 p-4 rounded-2xl">
              <Text className="text-zinc-300 text-xs leading-5">
                {iaData.perfil === 'Econômico' && "Excelente controle financeiro! Seu orçamento está muito saudável e você possui uma ótima taxa de poupança."}
                {iaData.perfil === 'Equilibrado' && "Seu perfil financeiro está equilibrado. Continue monitorando seus gastos para poupar ainda mais."}
                {iaData.perfil === 'Gastador' && "Seus gastos estão altos. Tente poupar um pouco mais e reduzir despesas variáveis imediatamente."}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-xl font-bold">Transações Recentes</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text className="text-lime-400 font-semibold">Atualizar</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <Text className="text-zinc-500 italic mt-2 mb-8">Nenhuma transação recente encontrada.</Text>
        ) : (
          transactions.map(tx => (
            <View key={tx.id} className="flex-row justify-between items-center bg-zinc-900 mb-3 p-4 rounded-2xl border border-zinc-800">
              <View className="flex-1 mr-2">
                <Text className="text-white font-bold text-base">{tx.category}</Text>
                <Text className="text-zinc-500 text-xs mt-1">{tx.description || 'Sem descrição'}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className={`font-bold ${tx.type === 'income' ? 'text-lime-400' : 'text-zinc-100'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatBRL(tx.amount)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteTransaction(tx.id)}
                  className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20"
                >
                  <Text className="text-rose-400 text-xs">🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View className="h-32" />
      </ScrollView>

      {/* FAB - Nova Transação */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 bg-lime-500 w-16 h-16 rounded-full justify-center items-center shadow-xl shadow-lime-500/20 z-50"
        onPress={() => setModalVisible(true)}
      >
        <Text className="text-zinc-950 text-4xl leading-10 font-light">+</Text>
      </TouchableOpacity>

      {/* Modal de Nova Transação */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 justify-end bg-black/60">
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              className="w-full"
            >
              <View className="bg-zinc-900 rounded-t-3xl p-6 h-[80%] border-t border-zinc-800">
                <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-2xl text-white font-bold">Nova Transação</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1">
                    <Text className="text-zinc-400 text-lg">X</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  <View className="flex-row mb-6 bg-zinc-950 border border-zinc-850 rounded-xl p-1">
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-lg items-center ${type === 'expense' ? 'bg-zinc-800' : ''}`}
                      onPress={() => setType('expense')}
                    >
                      <Text className={`font-bold ${type === 'expense' ? 'text-white' : 'text-zinc-400'}`}>Despesa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-lg items-center ${type === 'income' ? 'bg-lime-500' : ''}`}
                      onPress={() => setType('income')}
                    >
                      <Text className={`font-bold ${type === 'income' ? 'text-zinc-950' : 'text-zinc-400'}`}>Receita</Text>
                    </TouchableOpacity>
                  </View>

                  <Text className="text-zinc-400 mb-2 font-medium">Valor (R$)</Text>
                  <TextInput
                    className="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-4 mb-4 text-lg"
                    placeholder="0,00"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    returnKeyType="done"
                  />

                  <Text className="text-zinc-400 mb-2 font-medium">Categoria</Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {['Alimentação', 'Transporte', 'Lazer', 'Contas', 'Educação', 'Salário'].map(cat => (
                      <TouchableOpacity
                        key={cat}
                        className={`px-4 py-2 rounded-full border ${category === cat ? 'bg-lime-500 border-lime-500' : 'border-zinc-800 bg-zinc-950'}`}
                        onPress={() => setCategory(cat)}
                      >
                        <Text className={category === cat ? 'text-zinc-950 font-semibold' : 'text-zinc-300'}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-zinc-400 mb-2 font-medium">Descrição (Opcional)</Text>
                  <TextInput
                    className="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-4 mb-8"
                    placeholder="Supermercado, Uber, etc."
                    placeholderTextColor="#52525b"
                    value={description}
                    onChangeText={setDescription}
                    returnKeyType="done"
                  />

                  <TouchableOpacity
                    className="bg-lime-500 py-4 rounded-xl items-center mb-8"
                    onPress={handleAddTransaction}
                  >
                    <Text className="text-zinc-950 font-bold text-lg">Salvar Transação</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MainApp />
    </SafeAreaProvider>
  );
}
