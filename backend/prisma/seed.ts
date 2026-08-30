import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
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

  console.log("Criando gerente e posto...");
  const manager = await prisma.user.create({
    data: { name: "Marina Gerente", email: "gerente@example.com", passwordHash: password, role: "MANAGER" },
  });
  const station = await prisma.station.create({
    data: { name: "Posto Central", code: "PC01", address: "Av. Principal, 100", networkId: network.id, managerId: manager.id },
  });
  await prisma.redemptionPolicy.create({
    data: { stationId: station.id, allowDaily: true, allowWeekly: true, allowMonthly: true },
  });

  console.log("Criando frentistas...");
  const attendant1 = await prisma.user.create({
    data: { name: "Fábio Frentista", email: "fabio@example.com", passwordHash: password, role: "ATTENDANT", stationId: station.id },
  });
  const attendant2 = await prisma.user.create({
    data: { name: "Ana Frentista", email: "ana@example.com", passwordHash: password, role: "ATTENDANT", stationId: station.id },
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

  console.log("Criando metas do mês...");
  const start = startOfMonth();
  const end = endOfMonth();

  async function createGoal(itemId: string, attendantId: string, targetValue: number) {
    return prisma.goal.create({
      data: {
        stationId: station.id,
        itemId,
        attendantId,
        period: "MONTHLY",
        targetValue,
        startDate: start,
        endDate: end,
        createdById: manager.id,
      },
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

  console.log("Criando lançamentos de exemplo...");
  for (let i = 0; i < 10; i++) {
    const date = daysAgo(i);
    await prisma.entry.create({
      data: { goalId: goalsAttendant1.mix.id, attendantId: attendant1.id, date, comumLiters: 300, aditivadaLiters: 700 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant1.lub.id, attendantId: attendant1.id, date, value: 4.5 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant1.palhetas.id, attendantId: attendant1.id, date, value: 2 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant1.cheirinho.id, attendantId: attendant1.id, date, value: 3 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant1.volume.id, attendantId: attendant1.id, date, value: 1200 },
    });

    await prisma.entry.create({
      data: { goalId: goalsAttendant2.mix.id, attendantId: attendant2.id, date, comumLiters: 500, aditivadaLiters: 500 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant2.lub.id, attendantId: attendant2.id, date, value: 3 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant2.palhetas.id, attendantId: attendant2.id, date, value: 1 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant2.cheirinho.id, attendantId: attendant2.id, date, value: 2 },
    });
    await prisma.entry.create({
      data: { goalId: goalsAttendant2.volume.id, attendantId: attendant2.id, date, value: 1000 },
    });
  }

  console.log("\nSeed concluído! Usuários de teste (senha: senha123):");
  console.log("  Dono:    dono@example.com");
  console.log("  Gerente: gerente@example.com");
  console.log("  Frentista 1: fabio@example.com");
  console.log("  Frentista 2: ana@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
