import os
from flask import Flask, jsonify, request
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

app = Flask(__name__)

@app.route('/classificar', methods=['POST'])
def classificar():

    dados = request.json

    total_income = 0
    total_expense = 0
    qtd_transacoes = 0

    for t in dados:

        if 'amount' not in t:
            continue

        qtd_transacoes += 1

        if t['type'] == 'income':
            total_income += t['amount']

        elif t['type'] == 'expense':
            total_expense += t['amount']

    saldo = total_income - total_expense

    gasto_medio = (
        total_expense / qtd_transacoes
        if qtd_transacoes > 0 else 0
    )

    # Carrega a base de dados real (1000 registros) em formato CSV usando pandas
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, 'dataset.csv')
    df = pd.read_csv(dataset_path)

    # Separa os atributos (X) e rótulos (y)
    X = df[['receitas', 'despesas', 'saldo']].values
    y = df['perfil'].values

    modelo = DecisionTreeClassifier()

    # Treina o classificador com a base de dados
    modelo.fit(X, y)

    perfil = modelo.predict([
        [total_income, total_expense, saldo]
    ])

    return jsonify({
        'perfil': perfil[0],
        'saldo': saldo,
        'receitas': total_income,
        'despesas': total_expense,
        'gasto_medio': gasto_medio
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)