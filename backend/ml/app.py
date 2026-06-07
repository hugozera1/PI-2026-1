import os
from flask import Flask, jsonify, request
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

app = Flask(__name__)

@app.route('/classificar', methods=['POST'])
def classificar():
    try:
        dados = request.json

        total_income = 0
        total_expense = 0
        total_leisure = 0
        qtd_transacoes = 0

        for t in dados:
            if 'amount' not in t:
                continue

            qtd_transacoes += 1

            if t['type'] == 'income':
                total_income += t['amount']
            elif t['type'] == 'expense':
                total_expense += t['amount']
                # Categorias discricionárias
                if t.get('category') in ['Lazer', 'Outros', 'Alimentação']:
                    total_leisure += t['amount']

        saldo = total_income - total_expense
        
        # Novas features calculadas
        taxa_poupanca = (total_income - total_expense) / total_income if total_income > 0 else 0.0
        leisure_ratio = total_leisure / total_expense if total_expense > 0 else 0.0

        # Calcular score matemático para retorno
        poupanca_score = min(max((taxa_poupanca + 0.1) / 0.3, 0), 1) * 50
        leisure_score = min(max((0.7 - leisure_ratio) / 0.5, 0), 1) * 30
        essential_score = 20 if (0.3 < (1 - leisure_ratio) < 0.8) else 10
        score = round(poupanca_score + leisure_score + essential_score)
        score = min(max(score, 0), 100)

        gasto_medio = (
            total_expense / qtd_transacoes
            if qtd_transacoes > 0 else 0
        )

        # Carrega a base de dados real (1000 registros) em formato CSV usando pandas
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dataset_path = os.path.join(script_dir, 'dataset.csv')
        df = pd.read_csv(dataset_path)

        # Separa os atributos (X) e rótulos (y) usando as novas colunas
        X = df[['receitas', 'despesas', 'taxa_poupanca', 'leisure_ratio']].values
        y = df['perfil'].values

        modelo = DecisionTreeClassifier()

        # Treina o classificador com a base de dados
        modelo.fit(X, y)

        perfil = modelo.predict([
            [total_income, total_expense, taxa_poupanca, leisure_ratio]
        ])

        return jsonify({
            'perfil': perfil[0],
            'score': score,
            'saldo': saldo,
            'receitas': total_income,
            'despesas': total_expense,
            'gasto_medio': gasto_medio,
            'taxa_poupanca': round(taxa_poupanca, 4),
            'leisure_ratio': round(leisure_ratio, 4)
        })

    except Exception as e:
        print("Erro ML:", str(e))
        return jsonify({'error': 'Erro ao classificar dados', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)