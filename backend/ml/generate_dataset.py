import pandas as pd
import numpy as np

# Semente para reprodutibilidade
np.random.seed(42)

n_samples = 1000
data = []

for _ in range(n_samples):
    receita = np.random.uniform(1500, 15000)
    
    # Proporção de gastos em relação à receita (variando de 0.1 a 1.6)
    gasto_proporcao = np.random.uniform(0.1, 1.6)
    despesa = receita * gasto_proporcao
    
    taxa_poupanca = (receita - despesa) / receita if receita > 0 else 0
    
    # Proporção de gastos discricionários (lazer, alimentação fora, etc.)
    leisure_ratio = np.random.uniform(0.05, 0.95)
    
    # Pontuação de Poupança (até 50 pontos) - ideal é poupar >= 20%
    poupanca_score = min(max((taxa_poupanca + 0.1) / 0.3, 0), 1) * 50
    
    # Pontuação de Gastos Discricionários (até 30 pontos) - ideal é gastar <= 30% em lazer/alimentação fora
    leisure_score = min(max((0.7 - leisure_ratio) / 0.5, 0), 1) * 30
    
    # Pontuação de Equilíbrio (até 20 pontos)
    essential_score = 20 if (0.3 < (1 - leisure_ratio) < 0.8) else 10
    
    score = round(poupanca_score + leisure_score + essential_score)
    score = min(max(score, 0), 100)
    
    # Restaura as classes originais sugeridas
    if score >= 75:
        perfil = "Econômico"
    elif score >= 45:
        perfil = "Equilibrado"
    else:
        perfil = "Gastador"
        
    data.append({
        "receitas": round(receita, 2),
        "despesas": round(despesa, 2),
        "taxa_poupanca": round(taxa_poupanca, 4),
        "leisure_ratio": round(leisure_ratio, 4),
        "score": score,
        "perfil": perfil
    })

df = pd.DataFrame(data)
df.to_csv("dataset.csv", index=False)
print("Dataset de treino com perfis originais gerado com sucesso!")
