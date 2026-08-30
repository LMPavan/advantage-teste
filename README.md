# Metas Posto — App de metas e comissionamento para redes de postos de combustível

MVP full-stack para gestão de metas comerciais em postos de combustível (mix de aditivada,
lubrificantes, palhetas, cheirinho, volume vendido, etc.), com atingimento, comissionamento
configurável e resgate de comissão, em três visões:

- **Frentista**: dashboard com metas do período, quanto falta para bater cada uma e a comissão já
  gerada; posição no ranking do posto em destaque; lança vendas do dia; solicita resgate (diário/
  semanal/mensal, conforme liberado pelo administrador); acompanha suas medalhas. Pode abrir o detalhe
  de qualquer item para ver o que fez dia a dia e um gráfico do ritmo de comissão, filtrando por
  semana, mês ou período personalizado.
- **Gerente**: dashboard com KPIs do posto (atingimento, comissão, resgates pendentes, comissão por
  item) e a posição de cada frentista no ranking do posto; gestão de equipe e metas; aprovação de
  resgates.
- **Dono / administrador**: dashboard com KPIs de toda a rede (postos, gerentes, frentistas,
  atingimento, comissão, resgates, comissão por item, melhor posto / que precisa de atenção), cadastro
  de postos e itens/comissionamento, gestão de resgates em qualquer posto da rede, e visão executiva
  (ranking de postos e frentistas).

Inclui também **gamificação**: ranking de frentistas dentro do posto, ranking de postos/gerentes dentro
da rede, medalhas e molduras douradas/prata/bronze para o 1º/2º/3º lugar, foto de perfil, um mural
("hall da fama") com os melhores do mês anterior em toda a rede, e um conjunto de **conquistas**
(badges) individuais do frentista por marcos de comissão, desempenho e consistência.

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
  - Filtrável por item (botões "Todos os itens" / "Mix Aditivada" / "Lubrificantes" / ...): ao
    escolher um item, a lista mostra o valor realizado e a meta daquele item específico junto com o
    percentual de atingimento (ex.: "Realizado: 45 de 40 L — 112.5%"), em vez da média combinada de
    todos os itens. Frentistas sem meta do item escolhido não aparecem nessa visão.
  - A própria página inicial do frentista ("Minhas metas") mostra em destaque a posição atual dele no
    ranking do posto, com a mesma cor de moldura (ouro/prata/bronze) quando aplicável, e quantos pontos
    de atingimento faltam para alcançar a posição acima.
- **Ranking da rede** (postos/gerentes): gerente e dono comparam o desempenho do próprio posto com os
  demais postos da rede. As medalhas e molduras só aparecem quando a rede tem **mais de 3 postos**
  cadastrados — abaixo disso é exibida apenas a lista ordenada, sem o efeito visual.
  - Aplicado também à tabela de "Ranking de postos" na visão executiva do dono, no mesmo critério.
- **Mural (hall da fama)**: página acessível aos três perfis com o pódio (top 3) de frentistas e de
  postos do **mês anterior**, em toda a rede, com foto/avatar de cada um.
- **Conquistas (medalhas do frentista)**: calculadas automaticamente a partir do histórico completo
  (não apenas do período atual) — sem precisar de nenhuma infraestrutura extra além dos dados já
  existentes:
  - 🎉 Primeira comissão · 💵 R$100 · 💰 R$500 · 🏦 R$1.000 · 💎 R$5.000 em comissão acumulada
  - 🎯 Meta batida (qualquer meta ≥100%) · 🌟 Mês perfeito (todas as metas do mês fechado anterior
    ≥100%) · ⛽ Mestre do mix (bateu a meta de mix de aditivada)
  - 🥇 Campeão do mês (1º colocado do posto no mês fechado anterior) · 🥉 Pódio (top 3 do posto no mês
    fechado anterior)
  - 🔥 Sequência (lançou vendas em 5 dias seguidos) · 🏧 Resgate na conta (teve um resgate pago)
  - As medalhas conquistadas aparecem em destaque no topo de "Minhas metas" e na página dedicada
    "Conquistas", junto com as ainda bloqueadas.

## Período mostrado nos dashboards e rankings

Por padrão, todas as telas de "período atual" (Minhas metas, os dois dashboards, os rankings sem
`?month=`) mostram apenas **metas ativas agora** (a data de hoje está dentro do início/fim da meta) —
metas de meses já fechados não entram nessas somas. Somente o mural (hall da fama) e as chamadas
explícitas com `?month=YYYY-MM` olham para outros períodos, propositalmente.

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
| POST/GET | `/goals` | MANAGER/OWNER criam; todos leem (escopo por papel, só metas ativas agora) |
| GET | `/goals/:id/daily` | ATTENDANT/MANAGER/OWNER (escopo do posto/rede); aceita `?start=&end=` |
| POST/GET | `/entries` | ATTENDANT lança; MANAGER lança pela equipe |
| POST/GET/PATCH | `/redemptions` | ATTENDANT solicita; MANAGER/OWNER decidem |
| GET | `/dashboard/executive` | OWNER |
| GET | `/dashboard/team` | MANAGER |
| GET | `/dashboard/owner-summary` | OWNER (KPIs, resgates, comissão por item, destaques) |
| GET | `/dashboard/manager-summary` | MANAGER (KPIs, resgates, comissão por item, destaques) |
| GET | `/dashboard/station-ranking` | ATTENDANT/MANAGER (próprio posto) / OWNER (`?stationId=`); aceita `?itemId=` para ranking de um item específico |
| GET | `/dashboard/network-ranking` | MANAGER / OWNER |
| GET | `/dashboard/hall-of-fame` | ATTENDANT / MANAGER / OWNER (mês anterior por padrão, ou `?month=YYYY-MM`) |
| GET | `/badges` | ATTENDANT (conquistas do próprio frentista) |

## Próximos passos sugeridos

- Testes automatizados (unitários do serviço de comissionamento/ranking, integração das rotas).
- Envio do código de convite por e-mail/WhatsApp diretamente pelo sistema (hoje é copiar e colar).
- Histórico/auditoria de alterações de metas e itens.
- Exportação de relatórios (CSV/PDF) para a visão executiva.
- Mover a foto de perfil de data URI (armazenada no banco) para um serviço de storage de objetos
  (S3/Cloudinary) caso o volume de usuários cresça.
