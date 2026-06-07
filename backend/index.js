const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ML_URL = process.env.ML_URL || 'http://127.0.0.1:5000';

app.use(cors());
app.use(express.json());

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Helper to save data
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// POST /transactions
app.post('/transactions', (req, res) => {
  try {
    const { amount, category, description, type, date } = req.body;
    
    if (!amount || !category || !type) {
      return res.status(400).json({ error: 'Missing required fields: amount, category, type' });
    }

    const newTransaction = {
      id: Date.now().toString(),
      amount: parseFloat(amount),
      category,
      description: description || '',
      type, // 'income' or 'expense'
      date: date || new Date().toISOString(),
    };

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    data.push(newTransaction);
    saveData(data);

    res.status(201).json({ message: 'Transaction saved successfully', transaction: newTransaction });
  } catch (error) {
    console.error('Error saving transaction:', error);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// GET /transactions
app.get('/transactions', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    // Return sorted by newest first
    const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /dashboard
app.get('/dashboard', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    
    let totalIncome = 0;
    let totalExpense = 0;
    const expensesByCategory = {};
    const monthlyTrends = {}; // Format: { "YYYY-MM": { income: 0, expense: 0 } }

    data.forEach(t => {
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
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/ml', async (req, res) => {

    const dados = JSON.parse(
        fs.readFileSync('./data.json')
    )

    const resposta = await axios.post(
        `${ML_URL}/clusterizar`,
        dados
    )

    res.json(resposta.data)
})

// Seed data
app.post('/seed', (req, res) => {
    const seedData = [];
    const categories = ['Alimentação', 'Transporte', 'Lazer', 'Contas', 'Educação'];
    // Generate over last 3 months
    const now = Date.now();
    
    for(let i = 0; i < 50; i++) {
        const isExpense = Math.random() > 0.15; // 85% expenses, 15% income (salary)
        const amount = isExpense ? (Math.random() * 200 + 10) : (Math.random() * 2000 + 1000);
        
        // Random date within last 90 days
        const offset = Math.random() * 90 * 24 * 60 * 60 * 1000;
        const date = new Date(now - offset).toISOString();
        
        seedData.push({
            id: i.toString(),
            type: isExpense ? 'expense' : 'income',
            amount: parseFloat(amount.toFixed(2)),
            category: isExpense ? categories[Math.floor(Math.random() * categories.length)] : 'Salário',
            description: 'Transação de teste',
            date
        });
    }
    
    saveData(seedData);
    res.json({ message: 'Seed data generated', count: seedData.length });
});

app.get('/ml/perfil', async (req, res) => {

  try {

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf-8')
    );

    const resposta = await axios.post(
      `${ML_URL}/classificar`,
      data
    );

    res.json(resposta.data);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Erro ao processar IA'
    });

  }

});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
});
