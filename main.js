const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
        listings: Array.isArray(parsed.listings) ? parsed.listings : [],
        notifs: parsed.notifs && typeof parsed.notifs === 'object' ? parsed.notifs : {},
        chats: parsed.chats && typeof parsed.chats === 'object'
          ? { global: Array.isArray(parsed.chats.global) ? parsed.chats.global : [], dm: parsed.chats.dm && typeof parsed.chats.dm === 'object' ? parsed.chats.dm : {}, images: parsed.chats.images && typeof parsed.chats.images === 'object' ? parsed.chats.images : {} }
          : { global: [], dm: {}, images: {} }
      };
    }
  } catch (e) {
    console.error('Ошибка чтения БД:', e.message);
  }
  return { users: [], sessions: {}, listings: [], notifs: {}, chats: { global: [], dm: {}, images: {} } };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Ошибка записи БД:', e.message);
  }
}

// ---------- Резервные копии db.json на Яндекс Диск (WebDAV) ----------
// Переменные окружения: YADISK_LOGIN, YADISK_APP_PASSWORD (пароль приложения «Файлы WebDAV»), YADISK_FOLDER, BACKUP_INTERVAL_MIN
const ydConfig = () => {
  const u = process.env.YADISK_LOGIN, p = process.env.YADISK_APP_PASSWORD;
  if (!u || !p) return null;
  return { auth: 'Basic ' + Buffer.from(u + ':' + p).toString('base64'), dir: String(process.env.YADISK_FOLDER || 'CRYSTALIS-backup').replace(/^\/+|\/+$/g, '') };
};
const ydUrl = (cfg, name) => (process.env.YADISK_URL || 'https://webdav.yandex.ru') + '/' + cfg.dir.split('/').map(encodeURIComponent).join('/') + (name ? '/' + name : '');
async function ydPut(cfg, name, buf) {
  let acc = (process.env.YADISK_URL || 'https://webdav.yandex.ru');
  for (const part of cfg.dir.split('/')) {
    acc += '/' + encodeURIComponent(part);
    const r = await fetch(acc, { method: 'MKCOL', headers: { Authorization: cfg.auth } });
    if (r.status === 401) throw new Error('неверный логин или пароль приложения');
    if (![201, 405].includes(r.status)) throw new Error('не удалось создать папку (код ' + r.status + ')');
  }
  const r = await fetch(ydUrl(cfg, name), { method: 'PUT', headers: { Authorization: cfg.auth, 'Content-Type': 'application/gzip' }, body: buf });
  if (![200, 201, 204].includes(r.status)) throw new Error('не удалось загрузить файл (код ' + r.status + ')');
}
async function backupNow() {
  const cfg = ydConfig();
  if (!cfg || !fs.existsSync(DB_FILE)) return;
  try {
    const buf = zlib.gzipSync(fs.readFileSync(DB_FILE));
    await ydPut(cfg, 'crystalis-local-latest.json.gz', buf);
    await ydPut(cfg, 'crystalis-local-' + new Date().toISOString().slice(0, 10) + '.json.gz', buf);
    console.log('Резервная копия на Яндекс Диск: ' + Math.round(buf.length / 1024) + ' КБ');
  } catch (e) { console.error('Резервная копия не удалась:', e.message); }
}
async function restoreIfEmpty() {
  const cfg = ydConfig();
  if (!cfg || fs.existsSync(DB_FILE)) return;
  try {
    const r = await fetch(ydUrl(cfg, 'crystalis-local-latest.json.gz'), { headers: { Authorization: cfg.auth } });
    if (r.status === 401) return console.error('Яндекс Диск: неверный логин или пароль приложения, стартуем с пустой базой.');
    if (!r.ok) return console.log('Копия на Яндекс Диске не найдена (код ' + r.status + '), стартуем с пустой базой.');
    fs.writeFileSync(DB_FILE, zlib.gunzipSync(Buffer.from(await r.arrayBuffer())));
    console.log('База восстановлена из копии на Яндекс Диске.');
  } catch (e) { console.error('Восстановление не удалось:', e.message); }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getAuthToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function getSessionUser(req, db) {
  const token = getAuthToken(req);
  if (!token || !db.sessions[token]) return null;
  const userId = db.sessions[token].userId;
  return db.users.find(u => u.id === userId) || null;
}

function send(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}

function bodyJson(req, res, cb, maxBytes = 6000000) {
  let raw = '';
  req.on('data', c => {
    raw += c;
    if (raw.length > maxBytes) {
      send(res, 413, { error: 'Слишком большой запрос.' });
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      cb(JSON.parse(raw || '{}'));
    } catch (_) {
      send(res, 400, { error: 'Некорректные данные запроса.' });
    }
  });
}

function fallback(q) {
  const s = q.toLowerCase();
  if (/привет|здравствуй|добрый день/.test(s)) return 'Привет! Я Наставник CRYSTALIS. Могу помочь с основами цифрового искусства, NFT, блокчейна и безопасностью. Что хочешь узнать?';
  if (/nft|нфт/.test(s)) return 'NFT — это невзаимозаменяемый токен: уникальная запись в блокчейне, которая может подтверждать владение цифровым объектом. Сам файл изображения и токен — не одно и то же. Покупка NFT не всегда передаёт авторские права.';
  if (/блокчейн/.test(s)) return 'Блокчейн — распределённый цифровой реестр. Данные объединяются в блоки, связанные криптографически. Копии реестра хранятся у множества участников сети, а новые записи проходят проверку.';
  if (/кошел[её]к|seed|сид-фраз|приватн/.test(s)) return 'Криптокошелёк управляет ключами, которые позволяют подписывать операции. Никому не сообщай seed-фразу или приватный ключ и не вводи их на неизвестных сайтах. Потеря секретной фразы может означать потерю доступа.';
  if (/искусственн.*интеллект|ии|нейросет/.test(s)) return 'Искусственный интеллект — область технологий, в которой программы выполняют задачи, обычно требующие человеческих способностей: анализируют данные, распознают изображения и создают тексты. Генеративные модели отвечают, предсказывая подходящее продолжение на основе обучения.';
  if (/уч[её]б|план|изуч/.test(s)) return 'Начни с основ: 1) изучи цифровые изображения и форматы; 2) познакомься с блокчейном; 3) разберись, что такое NFT и кошелёк; 4) изучи безопасность; 5) создай учебную цифровую работу. После каждого этапа закрепляй знания небольшим проектом.';
  return 'Встроенная база знаний не содержит точного ответа на этот вопрос, а подключиться к ИИ не удалось. Попробуй уточнить формулировку или спросить об NFT, блокчейне, цифровом искусстве и безопасности.';
}

function callGemini(messages, cb) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'ВАШ_API_КЛЮЧ_GEMINI') {
    return cb(new Error('API-ключ Gemini не настроен'));
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 2500) }]
  }));

  const systemInstruction = {
    parts: [{ text: 'Ты — Наставник CRYSTALIS, дружелюбный русскоязычный преподаватель. Отвечай понятно и по существу. Не выдумывай факты. Не запрашивай пароли, приватные ключи или seed-фразы.' }]
  };

  const postData = JSON.stringify({
    system_instruction: systemInstruction,
    contents: contents
  });

  const req = https.request({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 20000
  }, r => {
    let data = '';
    r.on('data', c => data += c);
    r.on('end', () => {
      if (r.statusCode < 200 || r.statusCode >= 300) {
        return cb(new Error('Google API ответил кодом ' + r.statusCode));
      }
      try {
        const parsed = JSON.parse(data);
        const answer = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!answer) return cb(new Error('Пустой ответ от Gemini'));
        cb(null, answer);
      } catch (e) {
        cb(new Error('Ошибка обработки ответа от Gemini'));
      }
    });
  });

  req.on('timeout', () => req.destroy(new Error('Истекло время ожидания Gemini')));
  req.on('error', cb);
  req.write(postData);
  req.end();
}

const APP_VERSION = '1.9.1';
const START_COINS = 100;
const wallet = u => (u.wallet || (u.wallet = { coins: START_COINS, rev: 0 }));

function notify(db, login, o) {
  if (!db.notifs) db.notifs = {};
  const k = String(login).toLowerCase();
  const list = db.notifs[k] || (db.notifs[k] = []);
  const at = new Date().toISOString();
  const ex = o.key && list.find(n => n.key === o.key && !n.read);
  if (ex) { ex.count = (ex.count || 1) + 1; ex.text = o.textN ? o.textN(ex.count) : o.text; ex.at = at; return; }
  list.unshift({ id: Date.now() + '_' + crypto.randomBytes(3).toString('hex'), type: o.type, key: o.key || '', text: o.text, link: o.link || null, at, read: false, count: 1 });
  db.notifs[k] = list.slice(0, 50);
}
// Присутствие: «в сети»/«был(а)…» и «печатает…». Хранится в памяти, а lastSeen раз в минуту — в аккаунте.
const ONLINE_MS = 25000, TYPING_MS = 6000;
const seenMap = {}, typingMap = {};
function touchUser(me) {
  const now = Date.now();
  seenMap[me.login.toLowerCase()] = now;
  if (now - (me.lastSeen || 0) > 60000) { me.lastSeen = now; return true; }
  return false;
}
function presenceOf(u) {
  const at = seenMap[u.login.toLowerCase()] || u.lastSeen || 0;
  return { lastSeen: at, online: !!at && Date.now() - at < ONLINE_MS };
}
const dmKeyOf = (a, b) => [a, b].map(s => String(s).toLowerCase()).sort().join('|');
function markMsgs(db, me, sender, asRead) {
  const list = (db.chats && db.chats.dm && db.chats.dm[dmKeyOf(me.login, sender)]) || [];
  const s = String(sender).toLowerCase();
  let ch = false;
  list.forEach(m => {
    if (String(m.from).toLowerCase() !== s) return;
    if (!m.delivered) { m.delivered = true; ch = true; }
    if (asRead && !m.read) { m.read = true; ch = true; }
  });
  return ch;
}
const unreadOf = (db, me) => ((db.notifs && db.notifs[me.login.toLowerCase()]) || []).filter(n => !n.read).length;

const pubListing = l => ({ id: l.id, seller: l.seller, sellerName: l.sellerName, price: l.price, at: l.at, title: l.art.title, desc: l.art.desc || '', category: l.art.category || '', rarity: l.art.rarity || '', image: l.preview || '' });
const pubArt = a => ({ id: a.id, title: a.title, desc: a.desc || '', category: a.category || '', rarity: a.rarity || '', traits: a.traits || '', image: a.thumb || (a.image && a.image.length < 250000 ? a.image : '') });

function marketApi(db, me, p, method, body) {
  if (!Array.isArray(db.listings)) db.listings = [];
  if (!me.data) me.data = { artworks: [], collections: [], learning: { done: [], xp: 0, answers: {} }, mentorHistory: [] };
  if (!Array.isArray(me.data.artworks)) me.data.artworks = [];
  const w = wallet(me);

  if (p === '/api/poll' && method === 'GET') {
    let ch = touchUser(me);
    // Приложение открыто и получило уведомление — значит личные сообщения «доставлены»
    const senders = new Set(((db.notifs && db.notifs[me.login.toLowerCase()]) || []).filter(n => !n.read && n.type === 'dm' && n.link && n.link.login).map(n => n.link.login));
    senders.forEach(s => { if (markMsgs(db, me, s, false)) ch = true; });
    return [200, { coins: w.coins, rev: w.rev, unread: unreadOf(db, me), version: APP_VERSION }, ch];
  }
  if (p === '/api/market' && method === 'GET') return [200, { listings: db.listings.slice(0, 100).map(pubListing), coins: w.coins }];

  if (p === '/api/market/list' && method === 'POST') {
    const price = Math.floor(Number(body.price));
    if (!(price >= 1 && price <= 1000000)) return [400, { error: 'Цена должна быть от 1 до 1 000 000 Сойн.' }];
    const idx = me.data.artworks.findIndex(a => String(a.id) === String(body.artworkId));
    if (idx < 0) return [404, { error: 'NFT не найден в твоей галерее.' }];
    if (db.listings.filter(l => l.seller === me.login).length >= 30) return [400, { error: 'Нельзя выставить больше 30 лотов одновременно.' }];
    const art = me.data.artworks.splice(idx, 1)[0];
    const preview = typeof body.thumb === 'string' && body.thumb.startsWith('data:image/') && body.thumb.length < 400000 ? body.thumb : (art.thumb || '');
    db.listings.unshift({ id: 'l_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'), seller: me.login, sellerName: me.name || me.login, price, at: new Date().toISOString(), art, preview });
    w.rev++;
    return [200, { ok: true, artworks: me.data.artworks, rev: w.rev }, true];
  }

  if (p === '/api/market/cancel' && method === 'POST') {
    const l = db.listings.find(x => x.id === body.id);
    if (!l) return [404, { error: 'Лот не найден.' }];
    if (l.seller !== me.login) return [403, { error: 'Это не твой лот.' }];
    db.listings = db.listings.filter(x => x !== l);
    me.data.artworks.unshift(l.art);
    w.rev++;
    return [200, { ok: true, artworks: me.data.artworks, rev: w.rev }, true];
  }

  if (p === '/api/market/buy' && method === 'POST') {
    const l = db.listings.find(x => x.id === body.id);
    if (!l) return [404, { error: 'Лот уже продан или снят с продажи.' }];
    if (l.seller === me.login) return [400, { error: 'Нельзя купить собственный лот.' }];
    if (w.coins < l.price) return [400, { error: 'Не хватает Сойн: нужно ' + l.price + ', на счёте ' + w.coins + '.' }];
    const seller = findUser(db, l.seller);
    if (!seller) { db.listings = db.listings.filter(x => x !== l); return [410, { error: 'Продавец не найден, лот удалён.' }, true]; }
    w.coins -= l.price;
    wallet(seller).coins += l.price;
    db.listings = db.listings.filter(x => x !== l);
    me.data.artworks.unshift({ ...l.art, id: Date.now() + Math.floor(Math.random() * 1000), collection: '', boughtFrom: l.seller, boughtAt: new Date().toISOString() });
    w.rev++;
    notify(db, seller.login, { type: 'sale', text: (me.name || me.login) + ' купил(а) твой NFT «' + l.art.title + '» за ' + l.price + ' Сойн', link: { tab: 'Рынок' } });
    return [200, { ok: true, coins: w.coins, artworks: me.data.artworks, rev: w.rev, title: l.art.title }, true];
  }

  if (p.startsWith('/api/profile/') && method === 'GET') {
    const u = findUser(db, decodeURIComponent(p.slice(13)));
    if (!u) return [404, { error: 'Пользователь не найден.' }];
    const isFriend = (me.friends || []).some(l => l.toLowerCase() === u.login.toLowerCase());
    return [200, {
      user: { login: u.login, name: u.name || u.login, avatar: u.avatar || '', createdAt: u.createdAt, isFriend, self: u.id === me.id, ...presenceOf(u) },
      artworks: ((u.data && u.data.artworks) || []).map(pubArt),
      listings: db.listings.filter(l => l.seller === u.login).map(pubListing)
    }];
  }

  if (p === '/api/notifications' && method === 'GET') {
    const list = (db.notifs && db.notifs[me.login.toLowerCase()]) || [];
    return [200, { notifications: list.slice(0, 40).map(({ key, ...n }) => n), unread: list.filter(n => !n.read).length }];
  }

  if (p === '/api/notifications/read' && method === 'POST') {
    const list = (db.notifs && db.notifs[me.login.toLowerCase()]) || [];
    let ch = false;
    list.forEach(n => { if (!n.read && (!body.key || n.key === body.key)) { n.read = true; ch = true; } });
    return [200, { ok: true }, ch];
  }

  if (p === '/api/profile/update' && method === 'POST') {
    if (typeof body.avatar === 'string') {
      if (body.avatar && (!body.avatar.startsWith('data:image/') || body.avatar.length > 350000)) {
        return [400, { error: 'Аватар должен быть изображением до 250 КБ.' }];
      }
      me.avatar = body.avatar;
    }
    if (typeof body.name === 'string') {
      const nextName = body.name.trim().slice(0, 40);
      if (nextName.length < 2) return [400, { error: 'Имя должно содержать минимум 2 символа.' }];
      if (nextName !== me.name) {
        const WEEK_MS = 7 * 24 * 3600 * 1000;
        const last = Number(me.lastNameChange || 0);
        if (last && Date.now() - last < WEEK_MS) {
          const leftDays = Math.ceil((WEEK_MS - (Date.now() - last)) / (24 * 3600 * 1000));
          return [429, { error: 'Сменить никнейм можно раз в 7 дней. Осталось дн.: ' + leftDays + '.' }];
        }
        me.name = nextName;
        me.lastNameChange = Date.now();
      }
    }
    return [200, { ok: true, user: { id: me.id, login: me.login, name: me.name, avatar: me.avatar || '', lastNameChange: me.lastNameChange || 0, favs: me.favs || [], gameStats: me.gameStats || { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 }, createdAt: me.createdAt } }, true];
  }

  if (p === '/api/fav/toggle' && method === 'POST') {
    const id = String(body.id || '').trim();
    if (!id) return [400, { error: 'Не указан ID работы.' }];
    if (!Array.isArray(me.favs)) me.favs = [];
    const idx = me.favs.indexOf(id);
    if (idx >= 0) me.favs.splice(idx, 1);
    else me.favs.unshift(id);
    me.favs = me.favs.slice(0, 200);
    return [200, { ok: true, favs: me.favs }, true];
  }

  if (p === '/api/coins/transfer' && method === 'POST') {
    const toLogin = String(body.to || '').trim();
    const amount = Math.floor(Number(body.amount));
    if (!toLogin) return [400, { error: 'Укажи логин получателя.' }];
    if (!(amount >= 1 && amount <= 1000000)) return [400, { error: 'Сумма перевода должна быть от 1 до 1 000 000 Сойн.' }];
    const target = findUser(db, toLogin);
    if (!target) return [404, { error: 'Получатель не найден.' }];
    if (target.id === me.id) return [400, { error: 'Нельзя перевести Сойн самому себе.' }];
    if (w.coins < amount) return [400, { error: 'Недостаточно Сойн: у тебя ' + w.coins + '.' }];
    w.coins -= amount;
    wallet(target).coins += amount;
    notify(db, target.login, { type: 'transfer', text: (me.name || me.login) + ' перевёл(а) тебе ' + amount + ' Сойн', link: { tab: 'Рынок' } });
    return [200, { ok: true, coins: w.coins }, true];
  }

  if (p === '/api/game/reward' && method === 'POST') {
    const reward = Math.max(0, Math.min(50, Math.floor(Number(body.coins) || 0)));
    const score = Math.max(0, Math.floor(Number(body.score) || 0));
    const level = Math.max(0, Math.floor(Number(body.level) || 0));
    if (!me.gameStats) me.gameStats = { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 };
    if (score > (me.gameStats.jumpBest || 0)) me.gameStats.jumpBest = score;
    if (level > (me.gameStats.levelsCleared || 0)) me.gameStats.levelsCleared = level;
    me.gameStats.coinsEarned = (me.gameStats.coinsEarned || 0) + reward;
    if (reward > 0) w.coins += reward;
    return [200, { ok: true, coins: w.coins, gameStats: me.gameStats }, true];
  }

  return [404, { error: 'Метод API не найден.' }];
}

const cleanText = t => String(t || '').replace(/\r/g, '').trim().slice(0, 1000);
const cleanImage = s => { s = String(s || ''); return /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 400000 ? s : ''; };
const pubPerson = u => ({ login: u.login, name: u.name || u.login, avatar: u.avatar || '' });
const findUser = (db, login) => db.users.find(u => u.login.toLowerCase() === String(login || '').trim().toLowerCase());
const newMsg = (me, text) => ({
  id: Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
  from: me.login, name: me.name || me.login, text, at: new Date().toISOString()
});

function chatApi(db, me, p, method, body, query) {
  if (!db.chats) db.chats = { global: [], dm: {}, images: {} };
  if (!db.chats.images) db.chats.images = {};
  if (!Array.isArray(me.friends)) me.friends = [];

  if (p.startsWith('/api/chat/image/') && method === 'GET') {
    const id = decodeURIComponent(p.slice(16));
    const rec = /^[\w-]+$/.test(id) ? db.chats.images[id] : null;
    if (!rec) return [404, { error: 'Картинка не найдена.' }];
    if (rec.scope !== 'global' && !rec.scope.split('|').includes(me.login.toLowerCase())) return [403, { error: 'Нет доступа.' }];
    return [200, { image: rec.image }];
  }

  if (p === '/api/chat/global') {
    if (method === 'GET') return [200, { messages: db.chats.global.slice(-100) }];
    if (method === 'POST') {
      const text = cleanText(body.text), image = cleanImage(body.image);
      if (body.image && !image) return [400, { error: 'Картинка не подходит: нужен JPEG, PNG, WebP или GIF до 400 КБ.' }];
      if (!text && !image) return [400, { error: 'Напиши сообщение.' }];
      const m = newMsg(me, text);
      if (image) { m.img = true; db.chats.images[m.id] = { image, scope: 'global', from: me.login }; }
      db.chats.global = db.chats.global.concat(m).slice(-300);
      return [200, { ok: true, message: m }, true];
    }
  }

  if (p === '/api/friends' && method === 'GET') {
    const friends = me.friends.map(l => findUser(db, l)).filter(Boolean).map(u => ({ ...pubPerson(u), ...presenceOf(u) }));
    return [200, { friends }];
  }

  if (p === '/api/friends/add' && method === 'POST') {
    const u = findUser(db, body.login);
    if (!u) return [404, { error: 'Пользователь не найден.' }];
    if (u.id === me.id) return [400, { error: 'Нельзя добавить в друзья самого себя.' }];
    if (!me.friends.some(l => l.toLowerCase() === u.login.toLowerCase())) {
      me.friends.push(u.login);
      notify(db, u.login, { type: 'friend', text: (me.name || me.login) + ' добавил(а) тебя в друзья', link: { tab: 'Игрок', login: me.login } });
    }
    return [200, { ok: true, friend: pubPerson(u) }, true];
  }

  if (p === '/api/friends/remove' && method === 'POST') {
    const l = String(body.login || '').toLowerCase();
    me.friends = me.friends.filter(x => x.toLowerCase() !== l);
    return [200, { ok: true }, true];
  }

  if (p === '/api/users/search' && method === 'GET') {
    const q = String(query.get('q') || '').trim().toLowerCase();
    if (q.length < 2) return [200, { users: [] }];
    const mine = me.friends.map(l => l.toLowerCase());
    const users = db.users
      .filter(u => u.id !== me.id && (u.login.toLowerCase().includes(q) || String(u.name || '').toLowerCase().includes(q)))
      .slice(0, 20)
      .map(u => ({ ...pubPerson(u), isFriend: mine.includes(u.login.toLowerCase()) }));
    return [200, { users }];
  }

  if (p.startsWith('/api/dm/')) {
    let rest = p.slice(8), isTyping = false;
    if (rest.endsWith('/typing')) { isTyping = true; rest = rest.slice(0, -7); }
    const peer = findUser(db, decodeURIComponent(rest));
    if (!peer) return [404, { error: 'Пользователь не найден.' }];
    if (peer.id === me.id) return [400, { error: 'Нельзя писать самому себе.' }];
    const key = dmKeyOf(me.login, peer.login);
    const list = db.chats.dm[key] || [];
    if (isTyping && method === 'POST') {
      typingMap[key + ':' + me.login.toLowerCase()] = Date.now();
      return [200, { ok: true }, touchUser(me)];
    }
    if (method === 'GET') {
      // Открыл переписку — значит собеседник получил и прочитал его сообщения
      const ch = markMsgs(db, me, peer.login, true) | touchUser(me);
      const pres = presenceOf(peer);
      const tp = typingMap[key + ':' + peer.login.toLowerCase()] || 0;
      return [200, { peer: { ...pubPerson(peer), ...pres, typing: pres.online && Date.now() - tp < TYPING_MS }, messages: list.slice(-100) }, !!ch];
    }
    if (method === 'POST') {
      const text = cleanText(body.text), image = cleanImage(body.image);
      if (body.image && !image) return [400, { error: 'Картинка не подходит: нужен JPEG, PNG, WebP или GIF до 400 КБ.' }];
      if (!text && !image) return [400, { error: 'Напиши сообщение.' }];
      const m = newMsg(me, text);
      m.delivered = false; m.read = false;
      delete typingMap[key + ':' + me.login.toLowerCase()];
      if (image) { m.img = true; db.chats.images[m.id] = { image, scope: key, from: me.login }; }
      db.chats.dm[key] = list.concat(m).slice(-500);
      const nm = me.name || me.login;
      notify(db, peer.login, { type: 'dm', key: 'dm:' + me.login.toLowerCase(), text: (image && !text ? 'Картинка от ' : 'Новое сообщение от ') + nm, textN: n => 'Новые сообщения от ' + nm + ' (' + n + ')', link: { tab: 'dm', login: me.login, name: nm } });
      return [200, { ok: true, message: m }, true];
    }
  }
  return marketApi(db, me, p, method, body);
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    return bodyJson(req, res, data => {
      const login = String(data.login || '').trim();
      const name = String(data.name || login).trim().slice(0, 40);
      const password = String(data.password || '');

      if (login.length < 3 || login.length > 32) {
        return send(res, 400, { error: 'Логин должен содержать от 3 до 32 символов.' });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(login)) {
        return send(res, 400, { error: 'Логин может содержать только латинские буквы, цифры, точку, дефис или подчёркивание.' });
      }
      if (password.length < 4) {
        return send(res, 400, { error: 'Пароль должен содержать минимум 4 символа.' });
      }

      const db = loadDB();
      if (db.users.some(u => u.login.toLowerCase() === login.toLowerCase())) {
        return send(res, 409, { error: 'Пользователь с таким логином уже зарегистрирован.' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const user = {
        id: 'u_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
        login,
        name: name || login,
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
        data: {
          artworks: Array.isArray(data.initialData?.artworks) ? data.initialData.artworks : [],
          collections: Array.isArray(data.initialData?.collections) ? data.initialData.collections : [],
          learning: data.initialData?.learning || { done: [], xp: 0, answers: {} },
          mentorHistory: Array.isArray(data.initialData?.mentorHistory) ? data.initialData.mentorHistory : []
        }
      };

      db.users.push(user);
      const token = createToken();
      db.sessions[token] = { userId: user.id, createdAt: Date.now() };
      saveDB(db);

      return send(res, 201, {
        token,
        user: { id: user.id, login: user.login, name: user.name, avatar: user.avatar || '', lastNameChange: user.lastNameChange || 0, favs: user.favs || [], gameStats: user.gameStats || { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 }, createdAt: user.createdAt },
        data: user.data
      });
    });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    return bodyJson(req, res, data => {
      const login = String(data.login || '').trim();
      const password = String(data.password || '');

      if (!login || !password) {
        return send(res, 400, { error: 'Введи логин и пароль.' });
      }

      const db = loadDB();
      const user = db.users.find(u => u.login.toLowerCase() === login.toLowerCase());
      if (!user) {
        return send(res, 401, { error: 'Неверный логин или пароль.' });
      }

      const candidateHash = hashPassword(password, user.salt);
      if (candidateHash !== user.passwordHash) {
        return send(res, 401, { error: 'Неверный логин или пароль.' });
      }

      const token = createToken();
      db.sessions[token] = { userId: user.id, createdAt: Date.now() };
      saveDB(db);

      return send(res, 200, {
        token,
        user: { id: user.id, login: user.login, name: user.name, avatar: user.avatar || '', lastNameChange: user.lastNameChange || 0, favs: user.favs || [], gameStats: user.gameStats || { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 }, createdAt: user.createdAt },
        data: user.data
      });
    });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const db = loadDB();
    const user = getSessionUser(req, db);
    if (!user) {
      return send(res, 401, { error: 'Сессия не найдена или истекла.' });
    }
    return send(res, 200, {
      user: { id: user.id, login: user.login, name: user.name, avatar: user.avatar || '', lastNameChange: user.lastNameChange || 0, favs: user.favs || [], gameStats: user.gameStats || { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 }, createdAt: user.createdAt },
      data: user.data
    });
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getAuthToken(req);
    if (token) {
      const db = loadDB();
      if (db.sessions[token]) {
        delete db.sessions[token];
        saveDB(db);
      }
    }
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/user/sync' && req.method === 'POST') {
    return bodyJson(req, res, payload => {
      const db = loadDB();
      const user = getSessionUser(req, db);
      if (!user) {
        return send(res, 401, { error: 'Требуется авторизация.' });
      }
      let stale = false;
      if (payload.artworks && Array.isArray(payload.artworks)) {
        if (typeof payload.rev === 'number' && payload.rev < wallet(user).rev) stale = true;
        else user.data.artworks = payload.artworks;
      }
      if (payload.collections && Array.isArray(payload.collections)) {
        user.data.collections = payload.collections;
      }
      if (payload.learning && typeof payload.learning === 'object') {
        user.data.learning = payload.learning;
      }
      if (payload.mentorHistory && Array.isArray(payload.mentorHistory)) {
        user.data.mentorHistory = payload.mentorHistory;
      }
      saveDB(db);
      return send(res, 200, { ok: true, stale });
    });
  }

  if (pathname === '/api/mentor/status' && req.method === 'GET') {
    return send(res, 200, { provider: 'google-gemini', online: true, experimental: true });
  }

  if (pathname === '/api/mentor' && req.method === 'POST') {
    return bodyJson(req, res, data => {
      const input = Array.isArray(data.messages) ? data.messages : [];
      const messages = input.slice(-12).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 2500)
      }));
      const q = messages.filter(m => m.role === 'user').slice(-1)[0];
      if (!q || !q.content.trim()) return send(res, 400, { error: 'Напиши вопрос Наставнику.' });
      
      callGemini(messages, (err, answer) => {
        if (!err) return send(res, 200, { answer, fallback: false });
        send(res, 200, { answer: fallback(q.content), fallback: true });
      });
    }, 30000);
  }

  if (/^\/api\/(chat\/global|chat\/image\/.+|friends(\/add|\/remove)?|users\/search|dm\/.+|poll|market(\/list|\/cancel|\/buy)?|profile\/update|profile\/.+|fav\/toggle|coins\/transfer|game\/reward|notifications(\/read)?)$/.test(pathname)) {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const run = body => {
      const db = loadDB();
      const me = getSessionUser(req, db);
      if (!me) return send(res, 401, { error: 'Требуется авторизация.' });
      const [status, obj, changed] = chatApi(db, me, pathname, req.method, body, query);
      if (changed) saveDB(db);
      return send(res, status, obj);
    };
    if (req.method === 'POST') return bodyJson(req, res, run, (pathname === '/api/market/list' || pathname === '/api/chat/global' || pathname.startsWith('/api/dm/')) ? 700000 : 20000);
    return run({});
  }

  if (pathname.startsWith('/api/')) {
    return send(res, 404, { error: 'Метод API не найден.' });
  }

  const filePath = path.resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    res.writeHead(403);
    return res.end('Доступ запрещён');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Страница не найдена');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  });
});
restoreIfEmpty().finally(() => {
  server.listen(PORT, '0.0.0.0', () => console.log('CRYSTALIS 1.3 (с Google Gemini) запущен на порту ' + PORT));
  if (ydConfig()) {
    console.log('Автокопия на Яндекс Диск включена.');
    setTimeout(backupNow, 30000);
    setInterval(backupNow, Math.max(10, Number(process.env.BACKUP_INTERVAL_MIN) || 60) * 60000);
  }
});
