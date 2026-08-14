// ============================================================================
//  ДАННЫЕ-ПРИМЕРЫ и функции наполнения базы
// ----------------------------------------------------------------------------
//  Используется в двух местах:
//   - `npm run seed`         — очистить и наполнить заново (см. seed.js)
//   - при старте на сервере  — наполнить, только если база пустая (seedIfEmpty)
// ============================================================================

// Кладёт примеры в ПУСТУЮ базу (ничего не удаляет)
async function populate(prisma) {
  // ----- 10-ДНЕВНАЯ ПРОГРАММА (День 0 ... День 10) -----
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
    createdDays[day.dayNumber] = await prisma.programDay.create({ data: day });
  }

  // ----- МИССИИ -----
  const mission1 = await prisma.mission.create({
    data: { programDayId: createdDays[1].id, title: "Изучить 3 продукта", description: "Выбрать и разобрать 3 позиции из каталога.", dragonReward: 10 },
  });
  await prisma.mission.create({
    data: { programDayId: createdDays[3].id, title: "Разобрать 5 возражений", description: "Записать ответы на 5 частых возражений.", dragonReward: 10 },
  });
  await prisma.mission.create({
    data: { programDayId: createdDays[4].id, title: "Сделать 20 звонков", description: "По списку контактов, отметить результат.", dragonReward: 10 },
  });

  // ----- УЧЕНИКИ + РЕФЕРАЛЬНАЯ ЦЕПОЧКА -----
  const olga = await prisma.user.create({
    data: { firstName: "Ольга", lastName: "Соколова", email: "olga@example.com",
            role: "NATIONAL", dragons: 1200, programStatus: "ACTIVE", refCode: "OLGA" },
  });
  const ivan = await prisma.user.create({
    data: { firstName: "Иван", lastName: "Петров", email: "ivan@example.com",
            role: "DIRECTOR", dragons: 430, programStatus: "ACTIVE", refCode: "IVAN",
            referrerId: olga.id },
  });
  const nataly = await prisma.user.create({
    data: { firstName: "Наталья", lastName: "Макарова", email: "nataly@example.com",
            role: "NEWBIE", programStatus: "ACTIVE", refCode: "NATALY",
            programStartDate: new Date(), referrerId: ivan.id },
  });
  await prisma.user.create({
    data: { firstName: "Пётр", lastName: "Иванов", email: "petr@example.com",
            role: "NEWBIE", dragons: 25, programStatus: "PAUSED", refCode: "PETR",
            referrerId: ivan.id },
  });
  await prisma.user.create({
    data: { firstName: "Мария", lastName: "Кузнецова", email: "maria@example.com",
            role: "CURATOR", programStatus: "ACTIVE", refCode: "MARIA" },
  });

  // ----- НАЧИСЛЕНИЯ «ДРАКОНОВ» Наталье -----
  const natalyEvents = [
    { amount: 10,  reason: "DAILY_MISSION" },
    { amount: 5,   reason: "CALL" },
    { amount: 50,  reason: "DIRECTOR_MEETING" },
    { amount: 100, reason: "DEAL_CLOSED" },
  ];
  for (const e of natalyEvents) {
    await prisma.dragonTransaction.create({ data: { userId: nataly.id, ...e } });
  }
  const total = natalyEvents.reduce((s, e) => s + e.amount, 0);
  await prisma.user.update({ where: { id: nataly.id }, data: { dragons: total } });

  await prisma.missionCompletion.create({ data: { userId: nataly.id, missionId: mission1.id } });

  return { users: 5, days: programDays.length };
}

// Полностью очищает базу и наполняет заново (для `npm run seed`)
async function reseed(prisma) {
  await prisma.missionCompletion.deleteMany();
  await prisma.dragonTransaction.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.programDay.deleteMany();
  await prisma.user.deleteMany();
  return populate(prisma);
}

// Наполняет ТОЛЬКО если база пустая (безопасно вызывать при каждом старте)
async function seedIfEmpty(prisma) {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`База уже содержит ${count} учеников — посев пропущен.`);
    return;
  }
  console.log("База пустая — наполняю примерами...");
  const r = await populate(prisma);
  console.log(`Готово: учеников ${r.users}, дней программы ${r.days}.`);
}

module.exports = { populate, reseed, seedIfEmpty };
