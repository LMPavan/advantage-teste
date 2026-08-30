# Metas Posto — App de metas e comissionamento para redes de postos de combustível

MVP full-stack para gestão de metas comerciais em postos de combustível (mix de aditivada,
lubrificantes, palhetas, cheirinho, volume vendido, etc.), com atingimento, comissionamento
configurável e resgate de comissão, em três visões:

- **Frentista**: acompanha suas metas, atingimento e comissão gerada; lança vendas do dia; solicita
  resgate (diário/semanal/mensal, conforme liberado pelo administrador).
- **Gerente**: gerencia a equipe do posto, cria/edita metas por frentista (ou coletivas), aprova ou
  rejeita resgates.
- **Dono / administrador**: cadastra postos (rede), cria os itens de meta e define como cada um gera
  comissão, libera as periodicidades de resgate por posto, e acompanha a visão executiva (ranking de
  postos, gerentes e frentistas).

Inclui também **gamificação**: ranking de frentistas dentro do posto, ranking de postos/gerentes dentro
da rede, medalhas e molduras douradas/prata/bronze para o 1º/2º/3º lugar, foto de perfil, e um mural
("hall da fama") com os melhores do mês anterior em toda a rede.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL, autenticação JWT.
- **Frontend**: React + TypeScript + Vite, roteamento por papel (react-router-dom).

## Estrutura

```
backend/    API REST (Express + Prisma)
frontend/   SPA React (dashboards por papel)
docker-compose.yml   Postgres local para desenvolvimento
```

## Modelo de negócio

- **Mix de aditivada**: `(gasolina comum + gasolina aditivada) / gasolina aditivada`. Quanto menor,
  melhor a penetração de aditivada — por isso o item usa a direção "menor é melhor". A comissão é em
  **centavos por litro** de aditivada vendido.
- **Lubrificantes**: comissão em **R$ por litro**.
- **Palhetas / Cheirinho**: comissão em **R$ por unidade**.
- **Volume vendido**: métrica geral de litros, também comissionável.
- Todo item é cadastrado pelo dono/administrador, que escolhe: como o valor realizado é calculado
  (valor direto ou mix), a direção da meta, o tipo de comissionamento (centavos/litro, R$/litro,
  R$/unidade, % sobre valor vendido ou valor fixo ao bater a meta) e a forma de pagamento — só paga ao
  atingir um percentual mínimo (threshold) ou paga proporcional ao atingimento.
- **Resgate**: o frentista só pode solicitar resgate nas periodicidades (diária/semanal/mensal)
  liberadas pelo administrador para o posto. O gerente (ou dono) aprova, rejeita ou marca como pago.

## Cadastro e códigos de convite

O primeiro passo do cadastro é escolher o perfil (dono, gerente ou frentista):

- **Dono**: cadastra diretamente, criando a rede/posto (não precisa de código).
- **Gerente / Frentista**: precisa de um **código de convite** do posto ao qual vai pertencer.
  - Cada posto tem dois códigos, gerados automaticamente na criação: um para gerente e outro para
    frentistas. O dono vê e compartilha ambos na tela **Postos**; o gerente vê e compartilha o código
    de frentista na tela **Equipe e metas**.
  - Um código de gerente só é aceito se o posto ainda não tiver gerente vinculado.
  - Qualquer código pode ser regenerado a qualquer momento (invalidando o anterior): o dono regenera
    os dois; o gerente só regenera o de frentista do próprio posto.
- Em todos os perfis, é possível enviar uma foto de perfil (redimensionada no navegador antes do envio),
  usada nos rankings e no mural.

## Gamificação

- **Ranking do posto** (frentistas): cada frentista vê sua posição e a dos colegas do mesmo posto,
  ordenado pelo atingimento médio das metas do período. O 1º lugar sempre recebe moldura dourada e
  medalha 🥇, o 2º prata 🥈, o 3º bronze 🥉.
- **Ranking da rede** (postos/gerentes): gerente e dono comparam o desempenho do próprio posto com os
  demais postos da rede. As medalhas e molduras só aparecem quando a rede tem **mais de 3 postos**
  cadastrados — abaixo disso é exibida apenas a lista ordenada, sem o efeito visual.
  - Aplicado também à tabela de "Ranking de postos" na visão executiva do dono, no mesmo critério.
- **Mural (hall da fama)**: página acessível aos três perfis com o pódio (top 3) de frentistas e de
  postos do **mês anterior**, em toda a rede, com foto/avatar de cada um.

## Rodando localmente

### 1. Banco de dados

```bash
docker compose up -d db
```

(ou aponte `DATABASE_URL` para um Postgres já existente)

### 2. Backend

```bash
cd backend
cp .env.example .env   # ajuste DATABASE_URL/JWT_SECRET se necessário
npm install
npx prisma migrate dev
npm run prisma:seed    # cria dados de exemplo
npm run dev            # http://localhost:3333
```

Usuários de exemplo criados pelo seed (senha `senha123` para todos), distribuídos em 4 postos da mesma
rede — o suficiente para já mostrar as medalhas no ranking de postos (regra de mais de 3 postos):

| Papel      | E-mail                | Posto         |
|------------|------------------------|---------------|
| Dono       | dono@example.com       | (rede toda)   |
| Gerente    | gerente@example.com    | Posto Central |
| Frentista  | fabio@example.com      | Posto Central |
| Frentista  | ana@example.com        | Posto Central |
| Gerente    | rui@example.com        | Posto Norte   |
| Frentista  | bianca@example.com     | Posto Norte   |
| Gerente    | diego@example.com      | Posto Sul     |
| Frentista  | julia@example.com      | Posto Sul     |
| Gerente    | paula@example.com      | Posto Leste   |
| Frentista  | marcos@example.com     | Posto Leste   |

O seed também cria dados do mês anterior para os frentistas do Posto Central, Norte e Sul, para
popular o mural (hall da fama) desde o primeiro acesso.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173 (proxy /api -> :3333)
```

Acesse `http://localhost:5173`, faça login com um dos usuários acima (ou cadastre uma nova rede pela
tela de login, como dono).

## Principais endpoints da API

| Método | Rota | Quem acessa |
|---|---|---|
| POST | `/auth/register-owner` | público (cria dono + rede) |
| POST | `/auth/register` | público (cria gerente/frentista via código de convite) |
| POST | `/auth/login` | público |
| POST | `/stations` | OWNER |
| GET/PATCH | `/stations`, `/stations/:id/redemption-policy` | OWNER / MANAGER |
| POST | `/stations/:id/invite-codes/regenerate` | OWNER (qualquer código); MANAGER (só o de frentista do próprio posto) |
| POST | `/users/attendants` | MANAGER / OWNER |
| GET | `/users/team` | MANAGER / OWNER |
| POST/GET/PATCH | `/items` | OWNER cria; todos leem |
| POST/GET | `/goals` | MANAGER/OWNER criam; todos leem (escopo por papel) |
| POST/GET | `/entries` | ATTENDANT lança; MANAGER lança pela equipe |
| POST/GET/PATCH | `/redemptions` | ATTENDANT solicita; MANAGER/OWNER decidem |
| GET | `/dashboard/executive` | OWNER |
| GET | `/dashboard/team` | MANAGER |
| GET | `/dashboard/station-ranking` | ATTENDANT/MANAGER (próprio posto) / OWNER (`?stationId=`) |
| GET | `/dashboard/network-ranking` | MANAGER / OWNER |
| GET | `/dashboard/hall-of-fame` | ATTENDANT / MANAGER / OWNER (mês anterior por padrão, ou `?month=YYYY-MM`) |

## Próximos passos sugeridos

- Testes automatizados (unitários do serviço de comissionamento/ranking, integração das rotas).
- Envio do código de convite por e-mail/WhatsApp diretamente pelo sistema (hoje é copiar e colar).
- Histórico/auditoria de alterações de metas e itens.
- Exportação de relatórios (CSV/PDF) para a visão executiva.
- Mover a foto de perfil de data URI (armazenada no banco) para um serviço de storage de objetos
  (S3/Cloudinary) caso o volume de usuários cresça.
