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

Usuários de exemplo criados pelo seed (senha `senha123` para todos):

| Papel      | E-mail                |
|------------|------------------------|
| Dono       | dono@example.com       |
| Gerente    | gerente@example.com    |
| Frentista  | fabio@example.com      |
| Frentista  | ana@example.com        |

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
| POST | `/auth/login` | público |
| POST | `/stations` | OWNER |
| GET/PATCH | `/stations`, `/stations/:id/redemption-policy` | OWNER / MANAGER |
| POST | `/users/attendants` | MANAGER / OWNER |
| GET | `/users/team` | MANAGER / OWNER |
| POST/GET/PATCH | `/items` | OWNER cria; todos leem |
| POST/GET | `/goals` | MANAGER/OWNER criam; todos leem (escopo por papel) |
| POST/GET | `/entries` | ATTENDANT lança; MANAGER lança pela equipe |
| POST/GET/PATCH | `/redemptions` | ATTENDANT solicita; MANAGER/OWNER decidem |
| GET | `/dashboard/executive` | OWNER |
| GET | `/dashboard/team` | MANAGER |

## Próximos passos sugeridos

- Testes automatizados (unitários do serviço de comissionamento, integração das rotas).
- Convite de gerentes/frentistas por e-mail em vez de senha definida na hora do cadastro.
- Histórico/auditoria de alterações de metas e itens.
- Exportação de relatórios (CSV/PDF) para a visão executiva.
