// ============================================================================
//  МИНИ-СЕРВЕР приложения «Лёгкий старт»
// ----------------------------------------------------------------------------
//  Это "мозг": принимает запросы из браузера и отдаёт данные из базы.
//  Экраны: Главная, Команда, Рейтинг, Профиль. Запуск:  npm start
// ============================================================================

const express = require("express");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(express.json()); // чтобы читать данные регистрации из тела запроса
app.use(express.static(path.join(__dirname, "..", "public")));

// Генерируем короткий уникальный реферальный код для нового ученика
async function makeUniqueRefCode() {
  for (let i = 0; i < 20; i++) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase(); // напр. "K3F9Q2"
    const exists = await prisma.user.findUnique({ where: { refCode: code } });
    if (!exists) return code;
  }
  return "R" + Date.now().toString(36).toUpperCase(); // запасной вариант
}

// Понятные русские подписи
const REASON_LABELS = {
  DAILY_MISSION: "Итог дня / миссия",
  CALL: "Звонок",
  DIRECTOR_MEETING: "Встреча с директором",
  DEAL_CLOSED: "Закрытая сделка",
  REFERRAL_BONUS: "Бонус за приглашённого",
  OTHER: "Прочее",
};
const ROLE_LABELS = {
  NEWBIE: "Новичок",
  DIRECTOR: "Директор",
  NATIONAL: "Национальный директор",
  CURATOR: "Куратор",
};
const roleLabel = (r) => ROLE_LABELS[r] || r;
const fullName = (u) => `${u.firstName} ${u.lastName}`;

// --- Список учеников для переключателя "смотреть как..." ---
app.get("/api/users", async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json(users.map((u) => ({ id: u.id, name: fullName(u), role: roleLabel(u.role) })));
});

// --- Рейтинг: все ученики по количеству Драконов ---
app.get("/api/rating", async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { dragons: "desc" } });
  res.json(users.map((u) => ({ name: fullName(u), role: roleLabel(u.role), dragons: u.dragons })));
});

// --- Проверка реферального кода: кто пригласил (для экрана приглашения) ---
app.get("/api/referrer/:code", async (req, res) => {
  const owner = await prisma.user.findUnique({ where: { refCode: req.params.code } });
  if (!owner) return res.status(404).json({ error: "Код не найден" });
  res.json({ name: fullName(owner), role: roleLabel(owner.role) });
});

// --- Регистрация нового ученика по реферальной ссылке ---
app.post("/api/register", async (req, res) => {
  try {
    const { firstName, lastName, email, refCode } = req.body;
    if (!firstName || !refCode) {
      return res.status(400).json({ error: "Нужно имя и реферальный код" });
    }
    // Находим пригласившего по его коду
    const referrer = await prisma.user.findUnique({ where: { refCode } });
    if (!referrer) return res.status(404).json({ error: "Пригласивший не найден" });

    // Создаём новичка, ПРИВЯЗАННОГО к пригласившему, с личным кодом
    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName: lastName || "",
        email: email || null,
        role: "NEWBIE",
        programStatus: "ACTIVE",
        programStartDate: new Date(),
        referrerId: referrer.id,          // <-- ПРИВЯЗКА к пригласившему
        refCode: await makeUniqueRefCode(),
      },
    });

    res.json({ id: newUser.id, name: fullName(newUser), refCode: newUser.refCode });
  } catch (e) {
    // Частый случай — email уже занят
    if (e.code === "P2002") return res.status(409).json({ error: "Такой email уже зарегистрирован" });
    console.error(e);
    res.status(500).json({ error: "Ошибка на сервере" });
  }
});

// --- Кабинет конкретного ученика (по его id) ---
app.get("/api/cabinet/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        referrer: true,                       // кто пригласил (наставник)
        referrals: true,                      // кого пригласил я (моя команда)
        dragonHistory: { orderBy: { createdAt: "desc" } },
        missionsDone: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Ученик не найден" });

    const program = await prisma.programDay.findMany({
      orderBy: { dayNumber: "asc" },
      include: { missions: true },
    });

    res.json({
      me: { name: fullName(user), role: roleLabel(user.role), dragons: user.dragons, refCode: user.refCode },
      referrer: user.referrer
        ? { name: fullName(user.referrer), role: roleLabel(user.referrer.role) }
        : null,
      team: user.referrals.map((u) => ({
        name: fullName(u), role: roleLabel(u.role), dragons: u.dragons,
      })),
      dragonHistory: user.dragonHistory.map((t) => ({
        amount: t.amount, reason: REASON_LABELS[t.reason] || t.reason,
      })),
      completedMissionIds: user.missionsDone.map((m) => m.missionId),
      program: program.map((d) => ({
        dayNumber: d.dayNumber, title: d.title,
        missions: d.missions.map((m) => ({ id: m.id, title: m.title, reward: m.dragonReward })),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка на сервере" });
  }
});

app.listen(PORT, () => {
  console.log(`Приложение «Лёгкий старт» запущено: http://localhost:${PORT}`);
});
