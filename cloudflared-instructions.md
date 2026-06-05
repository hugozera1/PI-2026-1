# Configurando o Cloudflared

Siga os passos abaixo para expor seus serviços locais para o seu domínio:

1. Autentique o cloudflared no seu terminal (caso ainda não tenha feito):
   ```bash
   cloudflared tunnel login
   ```

2. Crie o tunnel:
   ```bash
   cloudflared tunnel create finance-tunnel
   ```
   *Guarde o ID gerado e atualize-o no arquivo `cloudflared-config.yml`.*

3. Crie os registros DNS apontando para o tunnel:
   ```bash
   cloudflared tunnel route dns finance-tunnel api.hugozera.space
   cloudflared tunnel route dns finance-tunnel app.hugozera.space
   ```

4. Inicie o tunnel usando a configuração criada na raiz do projeto:
   ```bash
   cloudflared tunnel --config cloudflared-config.yml run finance-tunnel
   ```

Isso mapeará `api.hugozera.space` para a API (porta 3000) e `app.hugozera.space` para o painel web (porta 5173).
