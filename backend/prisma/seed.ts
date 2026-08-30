import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateInviteCode } from "../src/utils/inviteCode";

const prisma = new PrismaClient();

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfPrevMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function endOfPrevMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 0);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log("Limpando dados existentes...");
  await prisma.redemption.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.item.deleteMany();
  await prisma.redemptionPolicy.deleteMany();
  await prisma.station.deleteMany();
  await prisma.network.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("senha123", 10);

  console.log("Criando dono e rede...");
  const owner = await prisma.user.create({
    data: { name: "Carlos Dono", email: "dono@example.com", passwordHash: password, role: "OWNER" },
  });
  const network = await prisma.network.create({
    data: { name: "Rede Exemplo de Postos", ownerId: owner.id },
  });

  console.log("Criando itens de meta e comissionamento...");
  const mixItem = await prisma.item.create({
    data: {
      networkId: network.id,
      name: "Mix Aditivada",
      description: "(Gasolina comum + aditivada) / aditivada. Quanto menor, melhor a penetração de aditivada.",
      unit: "razão",
      calculationType: "MIX_RATIO",
      direction: "LOWER_IS_BETTER",
      commissionType: "CENTS_PER_LITER",
      commissionValue: 3, // 3 centavos por litro de aditivada vendido
      payoutMode: "PROPORTIONAL",
      achievementThresholdPercent: 100,
    },
  });
  const lubItem = await prisma.item.create({
    data: {
      networkId: network.id,
      name: "Lubrificantes",
      unit: "L",
      calculationType: "SIMPLE",
      direction: "HIGHER_IS_BETTER",
      commissionType: "CURRENCY_PER_LITER",
      commissionValue: 1.5, // R$ 1,50 por litro
      payoutMode: "PROPORTIONAL",
      achievementThresholdPercent: 100,
    },
  });
  const palhetasItem = await prisma.item.create({
    data: {
      networkId: network.id,
      name: "Palhetas",
      unit: "un",
      calculationType: "SIMPLE",
      direction: "HIGHER_IS_BETTER",
      commissionType: "CURRENCY_PER_UNIT",
      commissionValue: 2,
      payoutMode: "THRESHOLD",
      achievementThresholdPercent: 100,
    },
  });
  const cheirinhoItem = await prisma.item.create({
    data: {
      networkId: network.id,
      name: "Cheirinho",
      unit: "un",
      calculationType: "SIMPLE",
      direction: "HIGHER_IS_BETTER",
      commissionType: "CURRENCY_PER_UNIT",
      commissionValue: 1,
      payoutMode: "THRESHOLD",
      achievementThresholdPercent: 100,
    },
  });
  const volumeItem = await prisma.item.create({
    data: {
      networkId: network.id,
      name: "Volume Vendido",
      unit: "L",
      calculationType: "SIMPLE",
      direction: "HIGHER_IS_BETTER",
      commissionType: "CENTS_PER_LITER",
      commissionValue: 0.5,
      payoutMode: "PROPORTIONAL",
      achievementThresholdPercent: 90,
    },
  });

  /** Cria um posto já com os códigos de convite e a política de resgate padrão. */
  async function createStation(name: string, code: string, address: string) {
    return prisma.station.create({
      data: {
        name,
        code,
        address,
        networkId: network.id,
        managerInviteCode: generateInviteCode(),
        attendantInviteCode: generateInviteCode(),
      },
    });
  }

  /** Cria uma meta mensal do tipo SIMPLE já com lançamentos diários calibrados para atingir a fração informada. */
  async function fillSimpleGoal(
    itemId: string,
    stationId: string,
    attendantId: string,
    createdById: string,
    targetValue: number,
    achievementFraction: number,
    monthStart: Date,
    monthEnd: Date,
    days: number
  ) {
    const goal = await prisma.goal.create({
      data: { stationId, itemId, attendantId, period: "MONTHLY", targetValue, startDate: monthStart, endDate: monthEnd, createdById },
    });
    const perDay = (targetValue * achievementFraction) / days;
    for (let i = 0; i < days; i++) {
      const date = new Date(monthStart);
      date.setDate(date.getDate() + i);
      if (date > monthEnd) break;
      await prisma.entry.create({ data: { goalId: goal.id, attendantId, date, value: perDay } });
    }
    return goal;
  }

  const currentStart = startOfMonth();
  const currentEnd = endOfMonth();
  const prevStart = startOfPrevMonth();
  const prevEnd = endOfPrevMonth();
  const daysInPrevMonth = prevEnd.getDate();

  // -------------------------------------------------------------------------
  // Posto Central: dataset completo (5 itens), com Fábio e Ana em disputa direta.
  // -------------------------------------------------------------------------
  console.log("Criando Posto Central...");
  const manager = await prisma.user.create({
    data: { name: "Marina Gerente", email: "gerente@example.com", passwordHash: password, role: "MANAGER" },
  });
  const central = await createStation("Posto Central", "PC01", "Av. Principal, 100");
  await prisma.station.update({ where: { id: central.id }, data: { managerId: manager.id } });
  await prisma.redemptionPolicy.create({
    data: { stationId: central.id, allowDaily: true, allowWeekly: true, allowMonthly: true },
  });

  const attendant1 = await prisma.user.create({
    data: { name: "Fábio Frentista", email: "fabio@example.com", passwordHash: password, role: "ATTENDANT", stationId: central.id },
  });
  const attendant2 = await prisma.user.create({
    data: { name: "Ana Frentista", email: "ana@example.com", passwordHash: password, role: "ATTENDANT", stationId: central.id },
  });

  async function createGoal(itemId: string, attendantId: string, targetValue: number) {
    return prisma.goal.create({
      data: { stationId: central.id, itemId, attendantId, period: "MONTHLY", targetValue, startDate: currentStart, endDate: currentEnd, createdById: manager.id },
    });
  }

  const goalsAttendant1 = {
    mix: await createGoal(mixItem.id, attendant1.id, 1.4),
    lub: await createGoal(lubItem.id, attendant1.id, 40),
    palhetas: await createGoal(palhetasItem.id, attendant1.id, 20),
    cheirinho: await createGoal(cheirinhoItem.id, attendant1.id, 30),
    volume: await createGoal(volumeItem.id, attendant1.id, 12000),
  };
  const goalsAttendant2 = {
    mix: await createGoal(mixItem.id, attendant2.id, 1.4),
    lub: await createGoal(lubItem.id, attendant2.id, 40),
    palhetas: await createGoal(palhetasItem.id, attendant2.id, 20),
    cheirinho: await createGoal(cheirinhoItem.id, attendant2.id, 30),
    volume: await createGoal(volumeItem.id, attendant2.id, 12000),
  };

  for (let i = 0; i < 10; i++) {
    const date = daysAgo(i);
    await prisma.entry.create({ data: { goalId: goalsAttendant1.mix.id, attendantId: attendant1.id, date, comumLiters: 300, aditivadaLiters: 700 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant1.lub.id, attendantId: attendant1.id, date, value: 4.5 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant1.palhetas.id, attendantId: attendant1.id, date, value: 2 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant1.cheirinho.id, attendantId: attendant1.id, date, value: 3 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant1.volume.id, attendantId: attendant1.id, date, value: 1200 } });

    await prisma.entry.create({ data: { goalId: goalsAttendant2.mix.id, attendantId: attendant2.id, date, comumLiters: 500, aditivadaLiters: 500 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant2.lub.id, attendantId: attendant2.id, date, value: 3 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant2.palhetas.id, attendantId: attendant2.id, date, value: 1 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant2.cheirinho.id, attendantId: attendant2.id, date, value: 2 } });
    await prisma.entry.create({ data: { goalId: goalsAttendant2.volume.id, attendantId: attendant2.id, date, value: 1000 } });
  }

  // Mês anterior (alimenta o mural/hall da fama): Fábio se destaca, Ana fica abaixo da meta.
  await fillSimpleGoal(volumeItem.id, central.id, attendant1.id, manager.id, 12000, 1.25, prevStart, prevEnd, daysInPrevMonth);
  await fillSimpleGoal(volumeItem.id, central.id, attendant2.id, manager.id, 12000, 0.8, prevStart, prevEnd, daysInPrevMonth);

  // -------------------------------------------------------------------------
  // Demais postos da rede: dataset enxuto (2 itens), só para alimentar os
  // rankings de posto/gerente e o mural com mais de 3 postos cadastrados.
  // -------------------------------------------------------------------------
  interface SecondaryStationSeed {
    name: string;
    code: string;
    address: string;
    managerName: string;
    managerEmail: string;
    attendantName: string;
    attendantEmail: string;
    currentFraction: number;
    prevFraction: number;
  }

  const secondaryStations: SecondaryStationSeed[] = [
    {
      name: "Posto Norte",
      code: "PN02",
      address: "Rod. Norte, km 12",
      managerName: "Rui Gerente",
      managerEmail: "rui@example.com",
      attendantName: "Bianca Frentista",
      attendantEmail: "bianca@example.com",
      currentFraction: 1.12,
      prevFraction: 1.1,
    },
    {
      name: "Posto Sul",
      code: "PS03",
      address: "Av. Sul, 500",
      managerName: "Diego Gerente",
      managerEmail: "diego@example.com",
      attendantName: "Julia Frentista",
      attendantEmail: "julia@example.com",
      currentFraction: 0.9,
      prevFraction: 0.95,
    },
    {
      name: "Posto Leste",
      code: "PL04",
      address: "Rua Leste, 77",
      managerName: "Paula Gerente",
      managerEmail: "paula@example.com",
      attendantName: "Marcos Frentista",
      attendantEmail: "marcos@example.com",
      currentFraction: 0.6,
      prevFraction: 0.6,
    },
  ];

  for (const s of secondaryStations) {
    console.log(`Criando ${s.name}...`);
    const stationManager = await prisma.user.create({
      data: { name: s.managerName, email: s.managerEmail, passwordHash: password, role: "MANAGER" },
    });
    const station = await createStation(s.name, s.code, s.address);
    await prisma.station.update({ where: { id: station.id }, data: { managerId: stationManager.id } });
    await prisma.redemptionPolicy.create({
      data: { stationId: station.id, allowDaily: false, allowWeekly: true, allowMonthly: true },
    });

    const stationAttendant = await prisma.user.create({
      data: { name: s.attendantName, email: s.attendantEmail, passwordHash: password, role: "ATTENDANT", stationId: station.id },
    });

    const currentDays = new Date().getDate();
    await fillSimpleGoal(volumeItem.id, station.id, stationAttendant.id, stationManager.id, 10000, s.currentFraction, currentStart, currentEnd, currentDays);
    await fillSimpleGoal(lubItem.id, station.id, stationAttendant.id, stationManager.id, 30, s.currentFraction, currentStart, currentEnd, currentDays);

    await fillSimpleGoal(volumeItem.id, station.id, stationAttendant.id, stationManager.id, 10000, s.prevFraction, prevStart, prevEnd, daysInPrevMonth);
  }

  console.log("\nSeed concluído! Usuários de teste (senha: senha123):");
  console.log("  Dono:               dono@example.com");
  console.log("  Gerente (Central):  gerente@example.com");
  console.log("  Frentista (Central): fabio@example.com / ana@example.com");
  console.log("  Gerente (Norte):    rui@example.com     | Frentista: bianca@example.com");
  console.log("  Gerente (Sul):      diego@example.com   | Frentista: julia@example.com");
  console.log("  Gerente (Leste):    paula@example.com   | Frentista: marcos@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
