import pandas as pd
import numpy as np

# Semente para reprodutibilidade
np.random.seed(42)

n_samples = 1000
data = []

for _ in range(n_samples):
    # Receita de R$ 1.500 a R$ 15.000
    receita = np.random.uniform(1500, 15000)
    
    # Define a proporção de gastos com base em perfis aleatórios para dar diversidade
    proporcao_gasto = np.random.beta(a=2, b=2) * 1.5 # varia de 0 a 1.5
    
    despesa = receita * proporcao_gasto
    saldo = receita - despesa
    
    # Regras de Rotulação (como um analista financeiro classificaria)
    if despesa > receita or saldo < 0:
        perfil = "Gastador"
    elif despesa > (receita * 0.4):
        perfil = "Equilibrado"
    else:
        perfil = "Econômico"
        
    data.append({
        "receitas": round(receita, 2),
        "despesas": round(despesa, 2),
        "saldo": round(saldo, 2),
        "perfil": perfil
    })

df = pd.DataFrame(data)
df.to_csv("dataset.csv", index=False)
print("Dataset de treino gerado com 1000 registros e salvo em 'dataset.csv'!")
