// ============================================================================
//  ЗАПОЛНЕНИЕ БАЗЫ ПРИМЕРАМИ (seed = "посев")
// ----------------------------------------------------------------------------
//  Этот файл кладёт в базу несколько показательных записей, чтобы модель данных
//  можно было увидеть "живой": ученики с ролями, реферальная цепочка, баллы,
//  10-дневная программа с миссиями. Запускается командой:  npm run seed
// ============================================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Очищаю базу от старых примеров (чтобы не задваивались)...");
  // Порядок важен: сначала "дочерние" таблицы, потом основные.
  await prisma.missionCompletion.deleteMany();
  await prisma.dragonTransaction.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.programDay.deleteMany();
  await prisma.user.deleteMany();

  // ----- 1. 10-ДНЕВНАЯ ПРОГРАММА (День 0 ... День 10) -----
  console.log("Создаю 10-дневную программу...");
  const programDays = [
    { dayNumber: 0,  title: "День 0. Добро пожаловать",        description: "Знакомство с академией и приложением." },
    { dayNumber: 1,  title: "День 1. Продукт Whieda",          description: "Изучаем продукцию на основе ТКМ." },
    { dayNumber: 2,  title: "День 2. Твоя история",            description: "Формулируем личную мотивацию." },
    { dayNumber: 3,  title: "День 3. Работа с возражениями",   description: "Учимся отвечать на частые вопросы." },
    { dayNumber: 4,  title: "День 4. Первые звонки",           description: "Практика: 20 звонков по списку." },
    { dayNumber: 5,  title: "День 5. Встреча с директором",    description: "Как проходит встреча, к чему готовиться." },
    { dayNumber: 6,  title: "День 6. Презентация",             description: "Собираем короткую презентацию." },
    { dayNumber: 7,  title: "День 7. Закрытие сделки",         description: "Доводим до результата." },
    { dayNumber: 8,  title: "День 8. Твоя команда",            description: "Приглашаем и поддерживаем новичков." },
    { dayNumber: 9,  title: "День 9. Аналитика 20/10/3",       description: "Считаем активность: 20 звонков → 10 встреч → 3 сделки." },
    { dayNumber: 10, title: "День 10. Ты — бизнес-партнёр",    description: "Итоги и переход к статусу партнёра." },
  ];

  const createdDays = {};
  for (const day of programDays) {
    const d = await prisma.programDay.create({ data: day });
    createdDays[day.dayNumber] = d;
  }

  // ----- 2. МИССИИ (примеры заданий для нескольких дней) -----
  console.log("Создаю миссии...");
  const mission1 = await prisma.mission.create({
    data: { programDayId: createdDays[1].id, title: "Изучить 3 продукта", description: "Выбрать и разобрать 3 позиции из каталога.", dragonReward: 10 },
  });
  await prisma.mission.create({
    data: { programDayId: createdDays[3].id, title: "Разобрать 5 возражений", description: "Записать ответы на 5 частых возражений.", dragonReward: 10 },
  });
  await prisma.mission.create({
    data: { programDayId: createdDays[4].id, title: "Сделать 20 звонков", description: "По списку контактов, отметить результат.", dragonReward: 10 },
  });

  // ----- 3. УЧЕНИКИ + РЕФЕРАЛЬНАЯ ЦЕПОЧКА -----
  // Цепочка приглашений: Ольга (Национальный) → Иван (Директор) → Наталья/Пётр (Новички)
  console.log("Создаю учеников и реферальную цепочку...");

  const olga = await prisma.user.create({
    data: { firstName: "Ольга", lastName: "Соколова", email: "olga@example.com",
            role: "NATIONAL", dragons: 1200, programStatus: "ACTIVE", refCode: "OLGA" },
  });

  const ivan = await prisma.user.create({
    data: { firstName: "Иван", lastName: "Петров", email: "ivan@example.com",
            role: "DIRECTOR", dragons: 430, programStatus: "ACTIVE", refCode: "IVAN",
            referrerId: olga.id }, // Ивана пригласила Ольга
  });

  const nataly = await prisma.user.create({
    data: { firstName: "Наталья", lastName: "Макарова", email: "nataly@example.com",
            role: "NEWBIE", programStatus: "ACTIVE", refCode: "NATALY",
            programStartDate: new Date(),
            referrerId: ivan.id }, // Наталью пригласил Иван
  });

  await prisma.user.create({
    data: { firstName: "Пётр", lastName: "Иванов", email: "petr@example.com",
            role: "NEWBIE", dragons: 25, programStatus: "PAUSED", refCode: "PETR",
            referrerId: ivan.id }, // Петра тоже пригласил Иван
  });

  // Куратор — курирует прохождение (не входит в реферальную цепочку)
  await prisma.user.create({
    data: { firstName: "Мария", lastName: "Кузнецова", email: "maria@example.com",
            role: "CURATOR", programStatus: "ACTIVE", refCode: "MARIA" },
  });

  // ----- 4. НАЧИСЛЕНИЯ «ДРАКОНОВ» Наталье (журнал + баланс) -----
  console.log("Начисляю Драконов Наталье по её активности...");
  const natalyEvents = [
    { amount: 10,  reason: "DAILY_MISSION" },   // итог дня
    { amount: 5,   reason: "CALL" },            // звонок
    { amount: 50,  reason: "DIRECTOR_MEETING" },// встреча с директором
    { amount: 100, reason: "DEAL_CLOSED" },     // закрытая сделка
  ];
  for (const e of natalyEvents) {
    await prisma.dragonTransaction.create({ data: { userId: nataly.id, ...e } });
  }
  // Обновляем быстрый счётчик баланса (сумма начислений = 165)
  const total = natalyEvents.reduce((sum, e) => sum + e.amount, 0);
  await prisma.user.update({ where: { id: nataly.id }, data: { dragons: total } });

  // ----- 5. ОТМЕТКА "миссия выполнена" -----
  await prisma.missionCompletion.create({
    data: { userId: nataly.id, missionId: mission1.id },
  });

  console.log("\n✅ Готово! База наполнена примерами.");
  const userCount = await prisma.user.count();
  const dayCount = await prisma.programDay.count();
  console.log(`   Учеников: ${userCount}, дней программы: ${dayCount}.`);
  console.log(`   У Натальи ${total} Драконов (10 + 5 + 50 + 100).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
