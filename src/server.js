// ============================================================================
//  СЕРВЕР «Лёгкий старт» — Этап 3
//  Роли: Новичок → Директор → Национальный (+ Организатор = админ, видит всё).
//  Новичок вводит цифры дня вручную → звонки ×5 и итоги +10 сразу;
//  проведённые встречи (×50) и сделки (×100) уходят директору на подтверждение
//  ВМЕСТЕ с цифрами дня. Директор открывает и подтверждает/отклоняет.
//  У директора — свой чек-лист (сценарий) на каждый день.
// ============================================================================

const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
app.use(express.json({ limit: "8mb" })); // 8mb — чтобы принимать скрины в чат
app.use(express.static(path.join(__dirname, "..", "public")));
const PORT = process.env.PORT || 3000;
// Куда сохраняем данные (чтобы не терялись при перезапуске) и картинки чата
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "..", "data", "app-data.json");
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");

const ROLE_LABELS = { NEWBIE:"Новичок", DIRECTOR:"Директор", NATIONAL:"Национальный директор", ORGANIZER:"Организатор" };
const roleLabel = (r) => ROLE_LABELS[r] || r;
const fullName = (u) => `${u.firstName} ${u.lastName}`.trim();
const POINTS = { call:5, meeting:50, deal:100, daily:10 };

// Старт общий. Пока даты нет — все дни открыты, «сегодня» = демо-день 6.
const CONFIG = { startDate:null, morningHourMsk:6, eveningHourMsk:15, demoCurrentDay:6 };
function currentDay(){
  if(!CONFIG.startDate) return CONFIG.demoCurrentDay;
  return Math.max(0, Math.min(10, Math.floor((Date.now()-new Date(CONFIG.startDate))/86400000)));
}

const nm = (calls,assigned,conducted,deals,daily)=>({calls,meetingsAssigned:assigned,meetingsConducted:conducted,deals,dailyPoints:daily});

// ---- Участники (2 национальные команды) ----
let users = [
  { id:"olga", firstName:"Ольга", lastName:"Соколова", role:"NATIONAL", referrerId:null, teamName:"Команда Ольги", codes:{director:"OLGA-DIR",newbie:"OLGA-NEW"}, ...nm(0,0,0,0,0) },
  { id:"ivan", firstName:"Иван", lastName:"Петров", role:"DIRECTOR", referrerId:"olga", codes:{newbie:"IVAN-NEW"}, ...nm(0,0,0,0,0) },
  { id:"sergey", firstName:"Сергей", lastName:"Волков", role:"DIRECTOR", referrerId:"olga", codes:{newbie:"SERGEY-NEW"}, ...nm(0,0,0,0,0) },
  { id:"nataly", firstName:"Наталья", lastName:"Макарова", role:"NEWBIE", referrerId:"ivan", codes:{}, ...nm(26,9,7,1,60) },
  { id:"petr", firstName:"Пётр", lastName:"Иванов", role:"NEWBIE", referrerId:"ivan", codes:{}, ...nm(12,4,3,0,30) },
  { id:"anna", firstName:"Анна", lastName:"Смирнова", role:"NEWBIE", referrerId:"sergey", codes:{}, ...nm(20,6,5,2,50) },
  { id:"lena", firstName:"Лена", lastName:"Орлова", role:"NEWBIE", referrerId:"olga", codes:{}, ...nm(8,2,1,0,20) },
  { id:"vika", firstName:"Виктория", lastName:"Иванова", role:"NATIONAL", referrerId:null, teamName:"Команда Виктории", codes:{director:"VIKA-DIR",newbie:"VIKA-NEW"}, ...nm(0,0,0,0,0) },
  { id:"dmitry", firstName:"Дмитрий", lastName:"Козлов", role:"DIRECTOR", referrerId:"vika", codes:{newbie:"DMITRY-NEW"}, ...nm(0,0,0,0,0) },
  { id:"kate", firstName:"Екатерина", lastName:"Белова", role:"NEWBIE", referrerId:"dmitry", codes:{}, ...nm(18,5,4,1,40) },
  // Организатор (админ) — видит всё
  { id:"admin", firstName:"Организатор", lastName:"", role:"ORGANIZER", referrerId:null, codes:{}, ...nm(0,0,0,0,0) },
];

// Итоги дня новичков «на подтверждение» директору: {id,newbieId,day,conducted,deals}
let submissions = [
  { id:"s1", newbieId:"nataly", day:6, conducted:2, deals:1 },
  { id:"s2", newbieId:"anna", day:6, conducted:1, deals:1 },
];
let subCounter = 100;

// Сообщения личных чатов: {id, threadId(=id новичка), from:'newbie'|'director', text, image, at}
let messages = [];

// --- Загрузка сохранённых данных при старте (если файл есть) ---
try {
  if (fs.existsSync(DATA_FILE)) {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (Array.isArray(d.users) && d.users.length) users = d.users;
    if (Array.isArray(d.submissions)) submissions = d.submissions;
    if (Array.isArray(d.messages)) messages = d.messages;
    console.log("Данные загружены из файла.");
  } else {
    console.log("Файла данных нет — стартуем с примеров.");
  }
} catch (e) { console.error("Не удалось прочитать данные:", e.message); }

// --- Сохранение данных (вызываем после каждого изменения) ---
function saveData() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users, submissions, messages }));
  } catch (e) { console.error("Не удалось сохранить данные:", e.message); }
}

// ---- Программа новичка (Дни 0–10) ----
const program = [
  { day:0, title:"Вхожу в запуск", motto:"Я вхожу в новую систему и перестаю быть наблюдателем.", entry:false,
    videos:["Видео 1. Эволюционная модель бизнеса XXI века"],
    mission:["Посмотри видео 1","Напиши пост знакомства в общий чат","Свяжись с директором и вступи в чат команды","Подтверди участие на «Стратегической сессии»"],
    checklist:["Видео 1 просмотрено","Пост знакомства написан","В чат команды вступил","С директором связался","Участие на сессии подтверждаю"] },
  { day:1, title:"Моя точка роста", motto:"Я превращаю мечту в решение.", entry:false,
    videos:["Видео 2. Список контактов — твой стартовый капитал"],
    mission:["Пропиши мечту, её стоимость и срок","Внеси часы Whieda в календарь","Посмотри видео 2","Составь список 20–30 человек","Созвонись с директором"],
    checklist:["Часы Whieda в календаре","Видео 2 просмотрено","Список 20–30 человек готов","Созвон с директором"] },
  { day:2, title:"Строю стратегию", motto:"Мне не нужно быть идеальным. Мне нужно начать.", entry:false,
    videos:["Видео 3. Искусство приглашения","Видео 4. Промоушен директора","Видео 5. Первая встреча «Тройничок»"],
    mission:["Посмотри 3 видео","Напиши скрипт звонка на 2 минуты","Возьми промо директора","Напиши промо себя","«Звонок зеркалу» — 5 раз","Отрепетируй звонок с директором","Выбери первые 5 контактов"],
    checklist:["3 видео просмотрены","Скрипт готов","Промо директора","Промо себя","«Звонок зеркалу»","Созвон с директором","5 контактов"] },
  { day:3, title:"Перехожу к действиям", motto:"Моя победа — набрать номер.", plan:"5 звонков · 3 встречи · 5 в работе", entry:true,
    videos:["Видео 6. Страхи в бизнесе"],
    mission:["Посмотри видео 6","Сделай 5 реальных звонков","Назначай встречи на 24–48 ч","Созвонись с директором по 5 людям","Запишись на «Ролевые игры»"],
    checklist:["Видео 6 просмотрено","Созвон с директором","Пост в общий чат"] },
  { day:4, title:"Набираю ритм", motto:"Я создаю встречу, директор помогает раскрыть возможность.", plan:"10 звонков · 5–6 встреч · 10 в работе", entry:true,
    videos:["Живой эфир: Ролевые игры"],
    mission:["Сделай ещё 5 звонков (всего 10)","Назначь 2–3 встречи","Проведи 2–3 встречи с директором","Обратная связь и следующий шаг","Созвон с директором по 10 людям"],
    checklist:["Созвон с директором","Список обновлён","Пост в общий чат"] },
  { day:5, title:"Открываю новые двери", motto:"Я не теряю людей после первого разговора.", plan:"15 звонков · 7–8 встреч · ориентир 1 сделка", entry:true,
    videos:["Видео 7. Возражения и сопровождение"],
    mission:["Посмотри видео 7","Сделай ещё 5 звонков (всего 15)","Назначай вторые встречи в 24–48 ч","Созвон с директором по 15 людям"],
    checklist:["Видео 7 просмотрено","Созвон с директором","Пост в общий чат"] },
  { day:6, title:"Иду к результату", motto:"20 звонков — мой первый профессиональный цикл.", plan:"20 в работе · 1–2 сделки", entry:true,
    videos:[], mission:["Сделай ещё 5 звонков (всего 20)","Добери до 10 встреч","Проведи встречи","Вторые встречи заинтересованным","Созвон с директором"],
    checklist:["Созвон с директором","Пост в общий чат"] },
  { day:7, title:"Иду к цели", motto:"Назначенная встреча — только начало.", plan:"20 в работе · 2–3 сделки", entry:true,
    videos:[], mission:["Проверь статус каждого из 20","Проведи назначенные встречи","Повторные касания","Вторые встречи","Лист ожидания — красным"],
    checklist:["Список обновлён","Созвон с директором","Пост в общий чат"] },
  { day:8, title:"Довожу до решения", motto:"Я помогаю человеку принять осознанное решение.", plan:"20 в работе · 3 сделки", entry:true,
    videos:[], mission:["Работай со всеми 20","Проведи встречи","Доводи готовых до оформления с директором","Оставь дверь открытой листу ожидания"],
    checklist:["Созвон с директором","Пост в общий чат"] },
  { day:9, title:"Мой результат", motto:"Я завершаю начатое.", plan:"Итоги первого цикла", entry:true,
    videos:[], mission:["Финальный статус каждому из 20","Итоговый разбор с директором","Зафиксируй цифры","Спланируй следующие 20"],
    checklist:["Цифры зафиксированы","Разбор с директором"] },
  { day:10, title:"Я уже не новичок", motto:"У меня есть собственная рабочая система.", plan:"Выпускной", entry:false,
    videos:[], mission:["Заполни итоговую форму","Видео на конкурс «Прорыв запуска»","Приходи на онлайн-выпускной"],
    checklist:["Форма заполнена","Видео отправлено","На выпускном присутствую"] },
];

// ---- Программа (чек-лист) ДИРЕКТОРА по дням (из «Сценарий Директора») ----
const dirProgram = [
  { day:0, title:"Собираю команду", checklist:["Добавь всех новичков в командный чат","Напомни вступить в общий чат и написать пост-знакомство","Убедись, что все посмотрели видео об эволюционной модели","Напомни про Стратегическую сессию с Викторией Ивановой","Свяжись лично с каждым новичком"] },
  { day:1, title:"Фундамент результата", checklist:["Будь с новичками на Стратегической сессии","Проследи, чтобы посмотрели видео «Список контактов»","Проведи личный созвон с каждым: цель, время созвонов, список 20–30","Ответь на вопросы команды"] },
  { day:2, title:"Готовлю к звонкам", checklist:["Посмотри материалы дня (3 видео + «Звонок зеркалу»)","Подготовь промо для новичка","Открой окна для встреч на завтра/послезавтра","Созвонись, послушай 2-мин скрипт, скорректируй","Проведи репетицию звонка","Разбери первые 5 контактов новичка"] },
  { day:3, title:"Первые звонки", checklist:["Посмотри материалы (видео «Страхи в бизнесе»)","Напомни план: 5 звонков → 3 встречи","Будь на связи во время звонков","Получай голосовое о кандидате перед встречей","Проводи встречи вместе с новичком","Ежедневный созвон по 5 контактам","Проверь итоги дня новичков в «На подтверждение»"] },
  { day:4, title:"Набираю ритм", checklist:["Открой окна, проведи 2–3 встречи","Будь на «Ролевых играх» с новичками","Ориентир: 10 звонков, 5–6 встреч","Проводи встречи: возражения, закрытие","Созвон по 10 людям","Подтверди цифры в «На подтверждение»"] },
  { day:5, title:"Сопровождаю к решению", checklist:["Будь в контексте (видео «Возражения»)","Проведи 2–3 встречи с каждым","Созвон после встреч: разбери 15 (горячий/тёплый/холодный)","Включи рефлексию в общем чате","Подтверди цифры новичков"] },
  { day:6, title:"Первый цикл", checklist:["Проверь: 20 звонков, ориентир 10 встреч","Проведи встречи (ориентир 1–2 сделки)","Помоги назначить вторые встречи","Разбери 20 человек по каждому новичку","Подтверди цифры новичков"] },
  { day:7, title:"Веду к результату", checklist:["Все 20 кандидатов в работе","Проведи назначенные встречи","Разбери «подумаю» и переносы","Помоги со вторыми встречами","Лист ожидания — красным","Подтверди цифры новичков"] },
  { day:8, title:"Закрываю сделки", checklist:["Проведи все встречи / тройнички","Разбери сомневающихся, повторные касания","Подключай Национального при усилении","Финальный созвон по 20 кандидатам","Подтверди цифры новичков"] },
  { day:9, title:"Финальные итоги", checklist:["Сверь финальные цифры новичков (встречи и сделки)","Итоговый разбор с каждым новичком","Подтверди оставшиеся цифры"] },
  { day:10, title:"Выпускной", checklist:["Помоги новичкам заполнить итоговую форму","Поздравь команду","Приходи на онлайн-выпускной"] },
];

// ---- Помощники ----
const findUser=(id)=>users.find(u=>u.id===id);
const findByCode=(code)=>users.find(u=>u.codes&&(u.codes.newbie===code||u.codes.director===code));
const isNewbie=(u)=>u.role==="NEWBIE";
const dragonsOf=(u)=>u.calls*POINTS.call+u.meetingsConducted*POINTS.meeting+u.deals*POINTS.deal+u.dailyPoints;
const metricsOf=(u)=>({calls:u.calls,assigned:u.meetingsAssigned,conducted:u.meetingsConducted,deals:u.deals});
function sumMetrics(list){const t={calls:0,assigned:0,conducted:0,deals:0,dragons:0};
  for(const u of list){t.calls+=u.calls;t.assigned+=u.meetingsAssigned;t.conducted+=u.meetingsConducted;t.deals+=u.deals;t.dragons+=dragonsOf(u);}return t;}
const newbiesOf=(m)=>users.filter(u=>isNewbie(u)&&u.referrerId===m);
const directorsOf=(n)=>users.filter(u=>u.role==="DIRECTOR"&&u.referrerId===n);
const structureNewbies=(n)=>[...directorsOf(n).flatMap(d=>newbiesOf(d.id)),...newbiesOf(n)];
const nationals=()=>users.filter(u=>u.role==="NATIONAL");
const allNewbies=()=>users.filter(isNewbie);
const newbieCard=(u)=>({id:u.id,name:fullName(u),metrics:metricsOf(u),dragons:dragonsOf(u),currentDay:currentDay()});

// ============================================================================
//  ЗАПРОСЫ
// ============================================================================
app.get("/api/users",(req,res)=>res.json(users.map(u=>({id:u.id,name:fullName(u),role:roleLabel(u.role)}))));
app.get("/api/program",(req,res)=>{const openThrough=currentDay();
  res.json({config:CONFIG,currentDay:openThrough,days:program.map(d=>({...d,locked:d.day>openThrough}))});});
app.get("/api/program-director",(req,res)=>{const openThrough=currentDay();
  res.json({currentDay:openThrough,days:dirProgram.map(d=>({...d,locked:d.day>openThrough}))});});

app.get("/api/rating/newbies",(req,res)=>res.json(allNewbies().map(u=>({id:u.id,name:fullName(u),dragons:dragonsOf(u)})).sort((a,b)=>b.dragons-a.dragons)));
app.get("/api/rating/directors",(req,res)=>res.json(users.filter(u=>u.role==="DIRECTOR").map(u=>({id:u.id,name:fullName(u),dragons:sumMetrics(newbiesOf(u.id)).dragons})).sort((a,b)=>b.dragons-a.dragons)));
app.get("/api/rating/teams",(req,res)=>res.json(nationals().map(u=>{const t=sumMetrics(structureNewbies(u.id));return{id:u.id,name:fullName(u),teamName:u.teamName,dragons:t.dragons,deals:t.deals};}).sort((a,b)=>b.dragons-a.dragons)));

app.get("/api/referrer/:code",(req,res)=>{const o=findByCode(req.params.code);if(!o)return res.status(404).json({error:"Код не найден"});
  const as=o.codes.director===req.params.code?"DIRECTOR":"NEWBIE";res.json({name:fullName(o),role:roleLabel(o.role),invitedAsRole:roleLabel(as)});});
app.post("/api/register",(req,res)=>{const{firstName,lastName,code}=req.body||{};if(!firstName||!code)return res.status(400).json({error:"Нужно имя и код"});
  const o=findByCode(code);if(!o)return res.status(404).json({error:"Пригласивший не найден"});
  const role=o.codes.director===code?"DIRECTOR":"NEWBIE";const id="u"+Date.now();
  const codes=role==="DIRECTOR"?{newbie:id.toUpperCase()+"-NEW"}:{};
  users.push({id,firstName,lastName:lastName||"",role,referrerId:o.id,codes,...nm(0,0,0,0,0)});
  saveData();
  res.json({id,name:`${firstName} ${lastName||""}`.trim(),role:roleLabel(role)});});

// Новичок отправляет итоги дня с цифрами
app.post("/api/submit-day",(req,res)=>{const{userId,day,calls,assigned,conducted,deals}=req.body||{};
  const u=findUser(userId);if(!u||!isNewbie(u))return res.status(400).json({error:"Только новичок"});
  u.calls+=Math.max(0,+calls||0); u.meetingsAssigned+=Math.max(0,+assigned||0); u.dailyPoints+=POINTS.daily;
  const c=Math.max(0,+conducted||0), d=Math.max(0,+deals||0);
  if(c>0||d>0) submissions.push({id:"s"+(++subCounter),newbieId:u.id,day:+day||currentDay(),conducted:c,deals:d});
  saveData();
  res.json({ok:true,pending:(c>0||d>0)});});

// Директор подтверждает/отклоняет итоги дня. Может ИСПРАВИТЬ цифры перед подтверждением.
app.post("/api/confirm",(req,res)=>{const{submissionId,approve,conducted,deals}=req.body||{};
  const i=submissions.findIndex(s=>s.id===submissionId);if(i===-1)return res.status(404).json({error:"Не найдено"});
  const s=submissions[i];
  if(approve){const u=findUser(s.newbieId);
    const c=conducted!==undefined?Math.max(0,+conducted||0):s.conducted; // если директор исправил — берём его цифры
    const d=deals!==undefined?Math.max(0,+deals||0):s.deals;
    u.meetingsConducted+=c;u.deals+=d;}
  submissions.splice(i,1);saveData();res.json({ok:true});});

// ---- ЛИЧНЫЙ ЧАТ новичок ↔ директор (thread = id новичка) ----
// Сообщения треда
app.get("/api/chat/:threadId",(req,res)=>{
  const t=req.params.threadId;
  res.json(messages.filter(m=>m.threadId===t).sort((a,b)=>a.at-b.at));
});
// Отправить сообщение (текст и/или скрин в формате data:base64)
app.post("/api/chat/:threadId",(req,res)=>{
  const t=req.params.threadId; const {from,text,image}=req.body||{};
  const newbie=findUser(t);
  if(!newbie||!isNewbie(newbie)) return res.status(404).json({error:"Чат не найден"});
  let imageUrl=null;
  if(image && typeof image==="string" && image.startsWith("data:image/")){
    try{
      const m=image.match(/^data:(image\/\w+);base64,(.+)$/);
      if(m){ const ext=m[1].split("/")[1].replace("jpeg","jpg");
        const fn=`msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
        fs.mkdirSync(UPLOAD_DIR,{recursive:true});
        fs.writeFileSync(path.join(UPLOAD_DIR,fn), Buffer.from(m[2],"base64"));
        imageUrl=`/uploads/${fn}`; }
    }catch(e){ console.error("Скрин не сохранён:",e.message); }
  }
  if(!(text&&text.trim()) && !imageUrl) return res.status(400).json({error:"Пустое сообщение"});
  const msg={ id:"m"+Date.now()+Math.random().toString(36).slice(2,5), threadId:t,
    from:(from==="director"?"director":"newbie"), text:(text||"").trim(), image:imageUrl, at:Date.now() };
  messages.push(msg); saveData(); res.json(msg);
});
// Директору — список его чатов с новичками (с последним сообщением)
app.get("/api/threads/:directorId",(req,res)=>{
  const dir=findUser(req.params.directorId); if(!dir) return res.status(404).json({error:"Не найден"});
  const team=newbiesOf(dir.id);
  res.json(team.map(n=>{
    const ms=messages.filter(m=>m.threadId===n.id).sort((a,b)=>a.at-b.at);
    const last=ms[ms.length-1];
    return { threadId:n.id, name:fullName(n),
      last: last?(last.image?"📷 фото":last.text):"", lastFrom:last?last.from:null, count:ms.length };
  }));
});

// Кабинет по роли
app.get("/api/cabinet/:id",(req,res)=>{const u=findUser(req.params.id);if(!u)return res.status(404).json({error:"Не найден"});
  const ref=u.referrerId?findUser(u.referrerId):null;const refShort=ref?{name:fullName(ref),role:roleLabel(ref.role)}:null;
  const today=currentDay();

  if(isNewbie(u)){
    const all=allNewbies().map(x=>({id:x.id,d:dragonsOf(x)})).sort((a,b)=>b.d-a.d);
    const pos=all.findIndex(x=>x.id===u.id)+1;
    const mine=submissions.filter(s=>s.newbieId===u.id).map(s=>({day:s.day,conducted:s.conducted,deals:s.deals}));
    return res.json({role:"NEWBIE",currentDay:today,
      me:{name:fullName(u),roleLabel:roleLabel(u.role),dragons:dragonsOf(u),metrics:metricsOf(u)},
      referrer:refShort,rating:{position:pos,total:all.length},pendingMine:mine});
  }
  if(u.role==="DIRECTOR"){
    const team=newbiesOf(u.id);
    const q=submissions.filter(s=>team.some(n=>n.id===s.newbieId)).map(s=>({id:s.id,newbieName:fullName(findUser(s.newbieId)),
      day:s.day,conducted:s.conducted,deals:s.deals,reward:s.conducted*POINTS.meeting+s.deals*POINTS.deal}));
    return res.json({role:"DIRECTOR",currentDay:today,
      me:{name:fullName(u),roleLabel:roleLabel(u.role),refCode:u.codes.newbie},
      referrer:refShort,newbies:team.map(newbieCard),teamTotals:sumMetrics(team),pending:q});
  }
  if(u.role==="NATIONAL"){
    const dirs=directorsOf(u.id).map(d=>({id:d.id,name:fullName(d),totals:sumMetrics(newbiesOf(d.id)),newbies:newbiesOf(d.id).map(newbieCard)}));
    return res.json({role:"NATIONAL",currentDay:today,
      me:{name:fullName(u),roleLabel:roleLabel(u.role),teamName:u.teamName,refCodes:u.codes},
      directors:dirs,ownNewbies:newbiesOf(u.id).map(newbieCard),grandTotals:sumMetrics(structureNewbies(u.id))});
  }
  // ORGANIZER — видит всё
  const teams=nationals().map(n=>({id:n.id,name:fullName(n),teamName:n.teamName,totals:sumMetrics(structureNewbies(n.id)),
    directors:directorsOf(n.id).map(d=>({id:d.id,name:fullName(d),totals:sumMetrics(newbiesOf(d.id)),newbies:newbiesOf(d.id).map(newbieCard)})),
    ownNewbies:newbiesOf(n.id).map(newbieCard)}));
  return res.json({role:"ORGANIZER",currentDay:today,me:{name:fullName(u),roleLabel:roleLabel(u.role)},
    globalTotals:sumMetrics(allNewbies()),
    counts:{nationals:nationals().length,directors:users.filter(x=>x.role==="DIRECTOR").length,newbies:allNewbies().length,pending:submissions.length},
    teams});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`«Лёгкий старт» запущен на порту ${PORT}`));
