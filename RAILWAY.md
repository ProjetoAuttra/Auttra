# Railway deploy

Este projeto e publicado como quatro servicos no Railway: Postgres, API (Back), Web (Front) e Painel ADM (Admin).

## Banco

Crie um Postgres no Railway e use a variavel `DATABASE_URL` gerada por ele no servico da API.

## API (Back)

Use a pasta `Back` como root do servico, com o Dockerfile existente.

Variaveis obrigatorias:

```env
DATABASE_URL=<URL do Postgres do Railway>
JWT_SECRET=<chave longa e aleatoria, 32+ caracteres>
CORS_ORIGIN=https://app.auttra.com.br,https://adm.auttra.com.br
TURNSTILE_SECRET_KEY=<secret key do Cloudflare Turnstile>
```

O Railway injeta `PORT` automaticamente. A API tambem expoe `GET /health` para health checks.

**Sem `TURNSTILE_SECRET_KEY` (ou `JWT_SECRET`), a API derruba o processo no boot** (`throw` em `src/config/env.ts`, nao eh um erro silencioso). Se o servico aparecer como "Crashed" logo depois de subir, confira `railway logs --deployment` primeiro — geralmente eh uma dessas duas variaveis faltando. Pegue a chave real no [dashboard do Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) (Add widget, modo Managed, dominios `app.auttra.com.br` e `adm.auttra.com.br`). O widget gera um par: a **Site Key** vai no servico Web (`TURNSTILE_SITE_KEY`), a **Secret Key** vai aqui na API.

`CORS_ORIGIN` precisa listar todo dominio publico que faz chamada de browser direto pra API (separados por virgula, sem espaco). Hoje isso e so o Web (`app.auttra.com.br`) — o Painel ADM chama a API via proxy do proprio nginx dele (mesma origem), entao nao precisa estar em `CORS_ORIGIN`, mas foi deixado na lista por seguranca caso isso mude.

Variaveis opcionais de e-mail (recuperacao de senha), via Resend:

```env
RESEND_API_KEY=<API key do Resend>
RESEND_FROM=Auttra <no-reply@mail.auttra.com.br>
```

`mail.auttra.com.br` precisa estar verificado como dominio no Resend antes de usar esse remetente (veja a secao "E-mail (Resend)" abaixo). Sem `RESEND_API_KEY`, o envio de e-mail falha silenciosamente (o endpoint de recuperacao de senha continua respondendo com sucesso, mas nenhum e-mail sai).

Tambem uteis:

```env
PASSWORD_RESET_URL_BASE=https://app.auttra.com.br
FRONTEND_URL=https://app.auttra.com.br
```

`FRONTEND_URL` precisa incluir o protocolo (`https://`) — ele e usado para montar URLs completas de redirect (ex: link de acompanhamento), nao so como referencia de dominio.

## E-mail (Resend)

Para enviar e-mails a partir de `no-reply@mail.auttra.com.br`:

1. No dashboard do Resend, va em **Domains -> Add Domain** e cadastre `mail.auttra.com.br`.
2. O Resend vai gerar registros DNS (geralmente um MX + TXT de SPF, e um TXT de DKIM em `resend._domainkey.mail.auttra.com.br`). Adicione esses registros exatamente como mostrados no painel de DNS de onde o dominio `auttra.com.br` esta hospedado (registro.br, Cloudflare, etc).
3. Volte ao Resend e clique em **Verify DNS Records**. A propagacao costuma levar minutos, mas pode levar ate algumas horas.
4. Quando o dominio aparecer como **Verified**, `RESEND_FROM=Auttra <no-reply@mail.auttra.com.br>` passa a funcionar. Antes disso, o Resend rejeita o envio.

## Web (Front)

Use a pasta `Front` como root do servico, com o Dockerfile existente.

Variaveis:

```env
API_URL=https://<dominio-da-api>.up.railway.app
VITE_API_URL=https://<dominio-da-api>.up.railway.app
TURNSTILE_SITE_KEY=<site key do Cloudflare Turnstile>
```

O frontend gera `config.js` no start do container, entao `API_URL` e `TURNSTILE_SITE_KEY` podem ser alteradas no Railway sem rebuildar a imagem (so precisa reiniciar o deploy). Sem `TURNSTILE_SITE_KEY`, o widget sobe com a chave publica de teste do Cloudflare (sempre aprova) — funciona, mas sem protecao real de captcha.

## Painel ADM (Admin)

Use a pasta `Admin` como root do servico, com o Dockerfile existente.

Variavel obrigatoria:

```env
BACKEND=https://<dominio-da-api>.up.railway.app
```

O nginx do Painel ADM usa `BACKEND` como alvo do proxy `/api/` (mesma origem do ponto de vista do browser, por isso nao precisa estar em `CORS_ORIGIN` da API). O login do Painel ADM usa 2FA (TOTP/Google Authenticator), nao usa Cloudflare Turnstile — nao precisa configurar `TURNSTILE_*` aqui.

**Build:** o `npm run build` do Admin roda `tsc -b && vite build` (diferente do Front, que so roda `vite build`), entao qualquer erro de tipo quebra o build de producao — inclusive em arquivos de config como `vite.config.ts`.

## Observacoes

- Nao execute `Back/init_test_user.sql` em producao.
- Depois do primeiro deploy, copie o dominio publico do Web (e do Painel ADM, se aplicavel) para `CORS_ORIGIN` da API.
- Se mudar o dominio da API, atualize `API_URL`/`VITE_API_URL` no Web e `BACKEND` no Painel ADM, e reinicie os deploys.
- **Se o repositorio no GitHub for renomeado ou transferido de dono/org**, o `git push`/`pull` continua funcionando (o GitHub redireciona), mas o **deploy automatico a cada push pode parar** — o GitHub App do Railway fica preso a instalacao antiga. Pra religar: no dashboard do Railway, va em cada servico -> Settings -> Source -> reconecte o repositorio (pode pedir pra reautorizar o GitHub App na nova org/dono). Enquanto isso nao for feito, use `railway redeploy --from-source -y --service <nome>` pra puxar o commit mais recente manualmente.

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
