# Railway deploy

Este projeto deve ser publicado como tres servicos no Railway: Postgres, API e Web.

## Banco

Crie um Postgres no Railway e use a variavel `DATABASE_URL` gerada por ele no servico da API.

## API

Use a pasta `Back` como root do servico, com o Dockerfile existente.

Variaveis obrigatorias:

```env
DATABASE_URL=<URL do Postgres do Railway>
JWT_SECRET=<chave longa e aleatoria>
CORS_ORIGIN=https://<dominio-do-front>.up.railway.app
TURNSTILE_SECRET_KEY=<secret key do Cloudflare Turnstile>
```

O Railway injeta `PORT` automaticamente. A API tambem expoe `GET /health` para health checks.

Sem `TURNSTILE_SECRET_KEY`, a API recusa subir em producao (mesma trava que ja existe pra `JWT_SECRET`). Pegue a chave real no dashboard do Cloudflare Turnstile.

Variaveis opcionais de e-mail (recuperacao de senha), via Resend:

```env
RESEND_API_KEY=<API key do Resend>
RESEND_FROM=Auttra <no-reply@auttra.com.br>
```

`auttra.com.br` precisa estar verificado como dominio no Resend antes de usar esse remetente (veja a secao "E-mail (Resend)" abaixo). Sem `RESEND_API_KEY`, o envio de e-mail falha silenciosamente (o endpoint de recuperacao de senha continua respondendo com sucesso, mas nenhum e-mail sai).

## E-mail (Resend)

Para enviar e-mails a partir de `no-reply@auttra.com.br`:

1. No dashboard do Resend, va em **Domains -> Add Domain** e cadastre `auttra.com.br`.
2. O Resend vai gerar registros DNS (geralmente um MX + TXT de SPF numa subdominio tipo `send.auttra.com.br`, e um TXT de DKIM em `resend._domainkey.auttra.com.br`). Adicione esses registros exatamente como mostrados no painel de DNS de onde o dominio `auttra.com.br` esta hospedado (registro.br, Cloudflare, etc).
3. Volte ao Resend e clique em **Verify DNS Records**. A propagacao costuma levar minutos, mas pode levar ate algumas horas.
4. Quando o dominio aparecer como **Verified**, `RESEND_FROM=Auttra <no-reply@auttra.com.br>` passa a funcionar. Antes disso, o Resend rejeita o envio.

## Web

Use a pasta `Front` como root do servico, com o Dockerfile existente.

Variavel obrigatoria:

```env
API_URL=https://<dominio-da-api>.up.railway.app/api
```

O frontend gera `config.js` no start do container, entao `API_URL` pode ser alterada no Railway sem rebuildar a imagem.

## Observacoes

- Nao execute `Back/init_test_user.sql` em producao.
- Depois do primeiro deploy, copie o dominio publico do front para `CORS_ORIGIN` da API.
- Se mudar o dominio da API, atualize `API_URL` no servico Web e reinicie o deploy.

## Primeiro usuario para teste

No servico da API, defina temporariamente as variaveis abaixo e rode o comando `npm run seed:admin` em um deploy/job/shell da Railway:

```env
ADMIN_NAME="Seu Nome"
ADMIN_EMAIL="seu-email@dominio.com"
ADMIN_PASSWORD="uma-senha-forte"
OFICINA_NOME="Minha Oficina"
OFICINA_CIDADE="Sao Paulo"
OFICINA_UF="SP"
OFICINA_LOGRADOURO="Rua Exemplo"
OFICINA_NUMERO="123"
OFICINA_CEP="00000-000"
OFICINA_TELEFONE="11999999999"
OFICINA_EMAIL="oficina@dominio.com"
```

O script cria a cidade, a oficina, os perfis padrao, o usuario proprietario e o vinculo `usuario_oficina`. Depois que confirmar o login, remova `ADMIN_PASSWORD` das variaveis do Railway.

Se voce estiver rodando localmente com `railway run` e receber erro em `postgres.railway.internal`, isso acontece porque esse host interno so resolve dentro da rede do Railway. Nesse caso, use o caminho de startup temporario:

1. No servico Back, defina `RUN_SEED_ADMIN=true`.
2. Garanta que as variaveis `ADMIN_*` e `OFICINA_*` estao preenchidas.
3. Faca redeploy do Back.
4. Confira nos logs a mensagem `Admin inicial pronto.`
5. Remova `RUN_SEED_ADMIN` e `ADMIN_PASSWORD`.
6. Faca redeploy novamente.
