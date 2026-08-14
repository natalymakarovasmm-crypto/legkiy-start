// ============================================================================
//  МИНИ-СЕРВЕР приложения «Лёгкий старт»
// ----------------------------------------------------------------------------
//  Это "мозг": принимает запросы из браузера и отдаёт данные из базы.
//  Пока один экран — Кабинет новичка. Запуск:  npm start
// ============================================================================

const express = require("express");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

// Отдаём файлы страницы (index.html и прочее) из папки public
app.use(express.static(path.join(__dirname, "..", "public")));

// Понятные русские подписи для причин начисления Драконов
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

// --- Главный запрос: данные кабинета новичка (пример — Наталья) ---
app.get("/api/cabinet", async (req, res) => {
  try {
    // Берём ученика вместе со связанными данными за один запрос
    const user = await prisma.user.findFirst({
      where: { firstName: "Наталья" },
      include: {
        referrer: true, // кто пригласил
        dragonHistory: { orderBy: { createdAt: "desc" } },
        missionsDone: { include: { mission: true } },
      },
    });

    // Вся 10-дневная программа
    const program = await prisma.programDay.findMany({
      orderBy: { dayNumber: "asc" },
      include: { missions: true },
    });

    // Собираем ответ в удобном для страницы виде
    res.json({
      me: {
        name: `${user.firstName} ${user.lastName}`,
        role: ROLE_LABELS[user.role] || user.role,
        dragons: user.dragons,
      },
      referrer: user.referrer
        ? {
            name: `${user.referrer.firstName} ${user.referrer.lastName}`,
            role: ROLE_LABELS[user.referrer.role] || user.referrer.role,
          }
        : null,
      dragonHistory: user.dragonHistory.map((t) => ({
        amount: t.amount,
        reason: REASON_LABELS[t.reason] || t.reason,
      })),
      completedMissionIds: user.missionsDone.map((m) => m.missionId),
      program: program.map((d) => ({
        dayNumber: d.dayNumber,
        title: d.title,
        missions: d.missions.map((m) => ({
          id: m.id,
          title: m.title,
          reward: m.dragonReward,
        })),
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
