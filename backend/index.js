const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ML_URL = process.env.ML_URL || 'http://127.0.0.1:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'spendly_secret_key_12345';

app.use(cors());
app.use(express.json());

// Initialize data file or run migration if it's the old flat array format
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], transactions: [] }, null, 2));
} else {
  try {
    const rawContent = fs.readFileSync(DATA_FILE, 'utf-8').trim();
    let parsed = rawContent ? JSON.parse(rawContent) : { users: [], transactions: [] };
    
    if (Array.isArray(parsed)) {
      // Migrate legacy database format
      const transactions = parsed.filter(t => t.amount !== undefined);
      parsed = {
        users: [],
        transactions: transactions
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
      console.log('Database migrated successfully to multi-user format.');
    }

    // Associate legacy transactions (without userId) to the first user in the database
    if (parsed.users && parsed.users.length > 0) {
      const firstUserId = parsed.users[0].id;
      let migratedCount = 0;
      parsed.transactions.forEach(t => {
        if (!t.userId) {
          t.userId = firstUserId;
          migratedCount++;
        }
      });
      if (migratedCount > 0) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
        console.log(`Database migration: Associated ${migratedCount} legacy transactions with the first user (${parsed.users[0].name}).`);
      }
    }
  } catch (error) {
    console.error('Error migrating DATA_FILE:', error);
  }
}

// Helpers to read and save data safely
const loadData = () => {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { users: [], transactions: [] };
  }
};

const saveData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente ou inválido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// --- AUTHENTICATION ROUTES ---

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios: nome, email e senha' });
    }

    const data = loadData();
    const emailLower = email.toLowerCase();
    
    const userExists = data.users.find(u => u.email === emailLower);
    if (userExists) {
      return res.status(400).json({ error: 'Este e-mail já está em uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      name,
      email: emailLower,
      password: hashedPassword
    };

    data.users.push(newUser);
    saveData(data);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email }
    });
  } catch (error) {
    console.error('Error in /auth/register:', error);
    res.status(500).json({ error: 'Erro interno ao realizar o cadastro' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Preencha o e-mail e a senha' });
    }

    const data = loadData();
    const emailLower = email.toLowerCase();
    const user = data.users.find(u => u.email === emailLower);

    if (!user) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login bem-sucedido',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Error in /auth/login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar o login' });
  }
});

// --- PORTFOLIO & TRANSACTION ROUTES (Protected) ---

// POST /transactions
app.post('/transactions', authMiddleware, (req, res) => {
  try {
    const { amount, category, description, type, date } = req.body;
    
    if (!amount || !category || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes: valor, categoria e tipo' });
    }

    const newTransaction = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      userId: req.userId,
      amount: parseFloat(amount),
      category,
      description: description || '',
      type, // 'income' or 'expense'
      date: date || new Date().toISOString(),
    };

    const data = loadData();
    data.transactions.push(newTransaction);
    saveData(data);

    res.status(201).json({ message: 'Transação salva com sucesso', transaction: newTransaction });
  } catch (error) {
    console.error('Error saving transaction:', error);
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
});

// GET /transactions
app.get('/transactions', authMiddleware, (req, res) => {
  try {
    const data = loadData();
    const userTransactions = data.transactions.filter(t => t.userId === req.userId);
    // Return sorted by newest first
    const sorted = userTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar transações' });
  }
});

// DELETE /transactions/:id
app.delete('/transactions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const data = loadData();
    
    const index = data.transactions.findIndex(t => t.id === id && t.userId === req.userId);
    if (index === -1) {
      return res.status(404).json({ error: 'Transação não encontrada ou acesso negado' });
    }
    
    const deleted = data.transactions.splice(index, 1);
    saveData(data);
    
    res.json({ message: 'Transação excluída com sucesso', transaction: deleted[0] });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Erro ao excluir transação' });
  }
});

// GET /dashboard
app.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const data = loadData();
    const userTransactions = data.transactions.filter(t => t.userId === req.userId);
    
    let totalIncome = 0;
    let totalExpense = 0;
    const expensesByCategory = {};
    const monthlyTrends = {}; // Format: { "YYYY-MM": { income: 0, expense: 0 } }

    userTransactions.forEach(t => {
      if (!t || typeof t.date !== 'string') return;
      const monthKey = t.date.substring(0, 7); // YYYY-MM
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { income: 0, expense: 0 };
      }

      if (t.type === 'income') {
        totalIncome += t.amount;
        monthlyTrends[monthKey].income += t.amount;
      } else if (t.type === 'expense') {
        totalExpense += t.amount;
        monthlyTrends[monthKey].expense += t.amount;
        
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
      }
    });

    const balance = totalIncome - totalExpense;

    // Automatic Insights Generation
    const insights = [];
    
    if (totalExpense > 0) {
      // Find highest spending category
      let maxCat = '';
      let maxAmount = 0;
      Object.keys(expensesByCategory).forEach(cat => {
        if (expensesByCategory[cat] > maxAmount) {
          maxAmount = expensesByCategory[cat];
          maxCat = cat;
        }
      });
      
      const percentage = Math.round((maxAmount / totalExpense) * 100);
      insights.push(`Você gastou ${percentage}% (${maxAmount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}) com ${maxCat}.`);
      
      if (percentage > 50) {
         insights.push(`⚠️ Alerta: Mais da metade dos seus gastos estão concentrados em ${maxCat}.`);
      }
    }

    if (balance < 0) {
      insights.push(`🚨 Atenção: Suas despesas ultrapassaram suas receitas no período analisado.`);
    } else if (balance > 0) {
      insights.push(`✅ Ótimo trabalho! Você tem um saldo positivo de ${balance.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.`);
    }

    res.json({
      summary: { totalIncome, totalExpense, balance },
      expensesByCategory,
      monthlyTrends,
      insights
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Erro ao processar dados do painel' });
  }
});

// GET /api/ml
app.get('/api/ml', authMiddleware, async (req, res) => {
  try {
    const data = loadData();
    const userTransactions = data.transactions.filter(t => t.userId === req.userId);

    const resposta = await axios.post(
        `${ML_URL}/clusterizar`,
        userTransactions
    );

    res.json(resposta.data);
  } catch (error) {
    console.error('Error on ML cluster API:', error);
    res.status(500).json({ error: 'Erro ao processar IA' });
  }
});

// GET /ml/perfil
app.get('/ml/perfil', authMiddleware, async (req, res) => {
  try {
    const data = loadData();
    const userTransactions = data.transactions.filter(t => t.userId === req.userId);

    const resposta = await axios.post(
      `${ML_URL}/classificar`,
      userTransactions
    );

    res.json(resposta.data);
  } catch (error) {
    console.error('Error classification on ML:', error.message);
    res.status(500).json({
      error: 'Erro ao processar perfil por IA'
    });
  }
});

// Seed data
app.post('/seed', authMiddleware, (req, res) => {
  try {
    const seedData = [];
    const categories = ['Alimentação', 'Transporte', 'Lazer', 'Contas', 'Educação'];
    const now = Date.now();
    
    for(let i = 0; i < 50; i++) {
        const isExpense = Math.random() > 0.15; // 85% expenses, 15% income (salary)
        const amount = isExpense ? (Math.random() * 200 + 10) : (Math.random() * 2000 + 1000);
        
        const offset = Math.random() * 90 * 24 * 60 * 60 * 1000;
        const date = new Date(now - offset).toISOString();
        
        seedData.push({
            id: 'seed_' + i + '_' + Math.random().toString(36).substring(2, 7),
            userId: req.userId,
            type: isExpense ? 'expense' : 'income',
            amount: parseFloat(amount.toFixed(2)),
            category: isExpense ? categories[Math.floor(Math.random() * categories.length)] : 'Salário',
            description: 'Transação de teste',
            date
        });
    }
    
    const data = loadData();
    // Append seed transactions to the user
    data.transactions = data.transactions.concat(seedData);
    saveData(data);
    res.json({ message: 'Dados de teste gerados para o usuário', count: seedData.length });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ error: 'Erro ao gerar dados de teste' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
});
