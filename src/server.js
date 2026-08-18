// ============================================================================
//  СЕРВЕР приложения «Лёгкий старт» — версия для интернета (встроенные данные)
// ----------------------------------------------------------------------------
//  Никакой базы данных: все примеры хранятся прямо здесь, в коде (в памяти).
//  Это делает запуск на любом хостинге простым и надёжным. Регистрация новых
//  участников работает, но сбрасывается при перезапуске — для показа этого
//  достаточно. Настоящую базу (PostgreSQL) подключим отдельным этапом.
//  Запуск:  npm start
// ============================================================================

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = process.env.PORT || 3000;

// --- Понятные подписи ---
const ROLE_LABELS = {
  NEWBIE: "Новичок", DIRECTOR: "Директор",
  NATIONAL: "Национальный директор", CURATOR: "Куратор",
};
const REASON_LABELS = {
  DAILY_MISSION: "Итог дня / миссия", CALL: "Звонок",
  DIRECTOR_MEETING: "Встреча с директором", DEAL_CLOSED: "Закрытая сделка",
  REFERRAL_BONUS: "Бонус за приглашённого", OTHER: "Прочее",
};
const roleLabel = (r) => ROLE_LABELS[r] || r;
const fullName = (u) => `${u.firstName} ${u.lastName}`.trim();

// ============================================================================
//  ВСТРОЕННЫЕ ДАННЫЕ (то, что раньше лежало в базе)
// ============================================================================

// Ученики + реферальная цепочка: Ольга → Иван → Наталья/Пётр
const users = [
  { id: "olga", firstName: "Ольга", lastName: "Соколова", role: "NATIONAL",
    dragons: 1200, referrerId: null, refCode: "OLGA",
    dragonHistory: [], missionsDone: [] },
  { id: "ivan", firstName: "Иван", lastName: "Петров", role: "DIRECTOR",
    dragons: 430, referrerId: "olga", refCode: "IVAN",
    dragonHistory: [], missionsDone: [] },
  { id: "nataly", firstName: "Наталья", lastName: "Макарова", role: "NEWBIE",
    dragons: 165, referrerId: "ivan", refCode: "NATALY",
    dragonHistory: [
      { amount: 100, reason: "DEAL_CLOSED" },
      { amount: 50, reason: "DIRECTOR_MEETING" },
      { amount: 5, reason: "CALL" },
      { amount: 10, reason: "DAILY_MISSION" },
    ],
    missionsDone: ["m1"] },
  { id: "petr", firstName: "Пётр", lastName: "Иванов", role: "NEWBIE",
    dragons: 25, referrerId: "ivan", refCode: "PETR",
    dragonHistory: [], missionsDone: [] },
  { id: "maria", firstName: "Мария", lastName: "Кузнецова", role: "CURATOR",
    dragons: 0, referrerId: null, refCode: "MARIA",
    dragonHistory: [], missionsDone: [] },
];

// 10-дневная программа (миссии — у нескольких дней)
const program = [
  { dayNumber: 0,  title: "День 0. Добро пожаловать",      missions: [] },
  { dayNumber: 1,  title: "День 1. Продукт Whieda",        missions: [{ id: "m1", title: "Изучить 3 продукта", reward: 10 }] },
  { dayNumber: 2,  title: "День 2. Твоя история",          missions: [] },
  { dayNumber: 3,  title: "День 3. Работа с возражениями", missions: [{ id: "m3", title: "Разобрать 5 возражений", reward: 10 }] },
  { dayNumber: 4,  title: "День 4. Первые звонки",         missions: [{ id: "m4", title: "Сделать 20 звонков", reward: 10 }] },
  { dayNumber: 5,  title: "День 5. Встреча с директором",  missions: [] },
  { dayNumber: 6,  title: "День 6. Презентация",           missions: [] },
  { dayNumber: 7,  title: "День 7. Закрытие сделки",       missions: [] },
  { dayNumber: 8,  title: "День 8. Твоя команда",          missions: [] },
  { dayNumber: 9,  title: "День 9. Аналитика 20/10/3",     missions: [] },
  { dayNumber: 10, title: "День 10. Ты — бизнес-партнёр",  missions: [] },
];

const findUser = (id) => users.find((u) => u.id === id);
const findByCode = (code) => users.find((u) => u.refCode === code);

// ============================================================================
//  ЗАПРОСЫ (те же адреса, что и раньше — страница не меняется)
// ============================================================================

// Список учеников для переключателя "смотреть как..."
app.get("/api/users", (req, res) => {
  res.json(users.map((u) => ({ id: u.id, name: fullName(u), role: roleLabel(u.role) })));
});

// Рейтинг по Драконам
app.get("/api/rating", (req, res) => {
  const sorted = [...users].sort((a, b) => b.dragons - a.dragons);
  res.json(sorted.map((u) => ({ name: fullName(u), role: roleLabel(u.role), dragons: u.dragons })));
});

// Проверка реферального кода (кто пригласил)
app.get("/api/referrer/:code", (req, res) => {
  const owner = findByCode(req.params.code);
  if (!owner) return res.status(404).json({ error: "Код не найден" });
  res.json({ name: fullName(owner), role: roleLabel(owner.role) });
});

// Кабинет конкретного ученика
app.get("/api/cabinet/:id", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: "Ученик не найден" });

  const referrer = user.referrerId ? findUser(user.referrerId) : null;
  const team = users.filter((u) => u.referrerId === user.id);

  res.json({
    me: { name: fullName(user), role: roleLabel(user.role), dragons: user.dragons, refCode: user.refCode },
    referrer: referrer ? { name: fullName(referrer), role: roleLabel(referrer.role) } : null,
    team: team.map((u) => ({ name: fullName(u), role: roleLabel(u.role), dragons: u.dragons })),
    dragonHistory: user.dragonHistory.map((t) => ({ amount: t.amount, reason: REASON_LABELS[t.reason] || t.reason })),
    completedMissionIds: user.missionsDone,
    program,
  });
});

// Регистрация нового ученика по реферальной ссылке
app.post("/api/register", (req, res) => {
  const { firstName, lastName, email, refCode } = req.body || {};
  if (!firstName || !refCode) return res.status(400).json({ error: "Нужно имя и реферальный код" });

  const referrer = findByCode(refCode);
  if (!referrer) return res.status(404).json({ error: "Пригласивший не найден" });

  const newUser = {
    id: "u" + Date.now(),
    firstName, lastName: lastName || "", email: email || null,
    role: "NEWBIE", dragons: 0, referrerId: referrer.id,
    refCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    dragonHistory: [], missionsDone: [],
  };
  users.push(newUser); // хранится в памяти до перезапуска
  res.json({ id: newUser.id, name: fullName(newUser), refCode: newUser.refCode });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Приложение «Лёгкий старт» запущено на порту ${PORT}`);
});
