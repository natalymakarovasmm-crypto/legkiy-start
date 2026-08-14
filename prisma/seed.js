// Очистить базу и наполнить примерами заново.  Запуск:  npm run seed
const { PrismaClient } = require("@prisma/client");
const { reseed } = require("./seed-data");

const prisma = new PrismaClient();

reseed(prisma)
  .then((r) => {
    console.log("\n✅ Готово! База наполнена примерами.");
    console.log(`   Учеников: ${r.users}, дней программы: ${r.days}.`);
  })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
