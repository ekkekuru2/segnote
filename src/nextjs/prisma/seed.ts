// 開発用のシードデータ。デモ用のチームとユーザーを1件ずつ用意する。
//   実行: pnpm exec tsx prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const team = await prisma.team.upsert({
    where: { id: "demo" },
    update: {},
    create: { id: "demo", name: "デモ合奏団" },
  });

  const user = await prisma.user.upsert({
    where: { uuid: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { uuid: "00000000-0000-0000-0000-000000000001" },
  });

  await prisma.userTeam.upsert({
    where: { teamUuid_userUuid: { teamUuid: team.uuid, userUuid: user.uuid } },
    update: {},
    create: { teamUuid: team.uuid, userUuid: user.uuid, role: "ADMIN" },
  });

  console.log(`Seeded team "${team.name}" -> /t/${team.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
