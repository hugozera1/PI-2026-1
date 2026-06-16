const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ML_URL = process.env.ML_URL || 'http://127.0.0.1:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'spendly_secret_key_12345';

app.use(cors());
app.use(express.json());

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spendly API Documentation',
      version: '1.0.0',
      description: 'Documentação das rotas da API do Spendly (Gerenciamento Financeiro com IA)',
      contact: {
        name: 'Spendly Team',
      },
    },
    servers: [
      {
        url: `http://localhost:3000`,
        description: 'Servidor Local (Ambiente de Desenvolvimento)',
      },
      {
        url: `http://20.164.2.23:3000`,
        description: 'Servidor VM (Produção / Nuvem)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [__filename], // Lê os comentários JSDoc deste próprio arquivo
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registra um novo usuário
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 example: joao@example.com
 *               password:
 *                 type: string
 *                 example: senha123
 *     responses:
 *       201:
 *         description: Usuário cadastrado com sucesso
 *       400:
 *         description: E-mail em uso ou campos em branco
 */
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
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentica um usuário e retorna o token JWT
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: joao@example.com
 *               password:
 *                 type: string
 *                 example: senha123
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *       400:
 *         description: Credenciais inválidas ou campos em branco
 */
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
/**
 * @openapi
 * /transactions:
 *   post:
 *     summary: Cria uma nova transação financeira
 *     tags: [Transações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - category
 *               - type
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 50.00
 *               category:
 *                 type: string
 *                 example: Alimentação
 *               description:
 *                 type: string
 *                 example: Almoço no restaurante
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *                 example: expense
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-06-16T12:00:00.000Z
 *     responses:
 *       201:
 *         description: Transação criada com sucesso
 *       400:
 *         description: Campos obrigatórios ausentes
 *       401:
 *         description: Não autorizado (token inválido/ausente)
 */
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
/**
 * @openapi
 * /transactions:
 *   get:
 *     summary: Retorna a lista de transações do usuário logado
 *     tags: [Transações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de transações carregada com sucesso
 *       401:
 *         description: Não autorizado
 */
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
/**
 * @openapi
 * /transactions/{id}:
 *   delete:
 *     summary: Exclui uma transação pelo ID
 *     tags: [Transações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação
 *     responses:
 *       200:
 *         description: Transação excluída com sucesso
 *       404:
 *         description: Transação não encontrada
 *       401:
 *         description: Não autorizado
 */
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
/**
 * @openapi
 * /dashboard:
 *   get:
 *     summary: Retorna os dados resumidos do painel financeiro (receitas, despesas, saldo, categoria e tendências mensais)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do dashboard processados com sucesso
 *       401:
 *         description: Não autorizado
 */
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
/**
 * @openapi
 * /api/ml:
 *   get:
 *     summary: Analisa as transações do usuário por agrupamento (Clustering) na IA
 *     tags: [IA / Machine Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Análise de agrupamento concluída
 *       500:
 *         description: Erro no servidor de ML
 *       401:
 *         description: Não autorizado
 */
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
/**
 * @openapi
 * /ml/perfil:
 *   get:
 *     summary: Obtém a classificação e score de saúde financeira por IA
 *     tags: [IA / Machine Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Análise realizada com sucesso
 *       550:
 *         description: Erro no servidor de ML
 *       401:
 *         description: Não autorizado
 */
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
/**
 * @openapi
 * /seed:
 *   post:
 *     summary: Gera 50 transações fictícias para testes do usuário logado
 *     tags: [Desenvolvimento / Testes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados de teste gerados com sucesso
 *       401:
 *         description: Não autorizado
 */
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
