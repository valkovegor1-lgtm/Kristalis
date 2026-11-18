// CRYSTALIS API для Netlify: аккаунты, синхронизация, сообщения, панель разработчика.
// Данные хранятся в Netlify Blobs (store "crystalis").
// Главный разработчик: логин из DEV_LOGINS (по умолчанию 1111), пароль DEV_PASSWORD (по умолчанию 1111),
// имя DEV_NAME (по умолчанию Егор). Вход с этим паролем создаёт или сбрасывает аккаунт.
//
// Резервные копии в Яндекс Диск (WebDAV). Переменные окружения Netlify:
//   YADISK_LOGIN          — логин/почта Яндекса
//   YADISK_APP_PASSWORD   — пароль приложения (id.yandex.ru → Безопасность → Пароли приложений → «Файлы WebDAV»)
//   YADISK_FOLDER         — папка на Диске (по умолчанию CRYSTALIS-backup)
//   BACKUP_INTERVAL_MIN   — как часто делать автокопию, минут (по умолчанию 60)
const { connectLambda, getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const nodePath = require('path');

const BACKUP_SKIP = ['session:', 'presence:', 'typing:', 'meta:', 'chatimg:'];   // временное и тяжёлое в копию не берём
const ydConfig = () => {
  const u = process.env.YADISK_LOGIN, p = process.env.YADISK_APP_PASSWORD;
  if (!u || !p) return null;
  return { auth: 'Basic ' + Buffer.from(u + ':' + p).toString('base64'), dir: String(process.env.YADISK_FOLDER || 'CRYSTALIS-backup').replace(/^\/+|\/+$/g, '') };
};
const ydBase = cfg => (process.env.YADISK_URL || 'https://webdav.yandex.ru') + '/' + cfg.dir.split('/').map(encodeURIComponent).join('/');
async function ydPut(cfg, name, buf) {
  // Создаём папку (201 — создана, 405 — уже есть)
  let acc = (process.env.YADISK_URL || 'https://webdav.yandex.ru');
  for (const part of cfg.dir.split('/')) {
    acc += '/' + encodeURIComponent(part);
    const r = await fetch(acc, { method: 'MKCOL', headers: { Authorization: cfg.auth } });
    if (r.status === 401) throw new Error('Яндекс Диск: неверный логин или пароль приложения.');
    if (![201, 405].includes(r.status)) throw new Error('Яндекс Диск: не удалось создать папку (код ' + r.status + ').');
  }
  const r = await fetch(ydBase(cfg) + '/' + name, { method: 'PUT', headers: { Authorization: cfg.auth, 'Content-Type': 'application/gzip' }, body: buf });
  if (![200, 201, 204].includes(r.status)) throw new Error('Яндекс Диск: не удалось загрузить файл (код ' + r.status + ').');
}
async function ydGet(cfg, name) {
  const r = await fetch(ydBase(cfg) + '/' + name, { headers: { Authorization: cfg.auth } });
  if (r.status === 404) throw new Error('Копия на Яндекс Диске не найдена.');
  if (r.status === 401) throw new Error('Яндекс Диск: неверный логин или пароль приложения.');
  if (!r.ok) throw new Error('Яндекс Диск: ошибка чтения (код ' + r.status + ').');
  return Buffer.from(await r.arrayBuffer());
}

const SESSION_TTL = 30 * 24 * 3600 * 1000;
const APP_VERSION = '1.9.1';   // держи в одном значении с CLIENT_VERSION в public/index.html
const START_COINS = 100;       // стартовый баланс Сойн
const pubListing = l => ({ id: l.id, seller: l.seller, sellerName: l.sellerName, price: l.price, at: l.at, title: l.title, desc: l.desc || '', category: l.category || '', rarity: l.rarity || '', image: l.image || '' });
const pubArt = a => ({ id: a.id, title: a.title, desc: a.desc || '', category: a.category || '', rarity: a.rarity || '', traits: a.traits || '', image: a.thumb || (a.image && a.image.length < 250000 ? a.image : '') });
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const out = (status, obj) => ({ statusCode: status, headers: H, body: JSON.stringify(obj) });
const err = (status, msg) => out(status, { error: msg });

const devLogins = () => String(process.env.DEV_LOGINS || '1111').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const isRootDev = login => devLogins().includes(String(login).toLowerCase());
const roleOf = u => (isRootDev(u.login) ? 'developer' : (u.role === 'developer' ? 'developer' : 'user'));
const pub = u => ({ id: u.id, login: u.login, name: u.name, avatar: u.avatar || '', lastNameChange: u.lastNameChange || 0, favs: Array.isArray(u.favs) ? u.favs : [], gameStats: u.gameStats || { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 }, createdAt: u.createdAt, role: roleOf(u) });
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
const uKey = login => 'user:' + String(login).toLowerCase();

let initChecked = false;   // на тёплом экземпляре функции проверку первого запуска делаем один раз
exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore('crystalis');
  const path = (event.path || '').replace(/^\/(\.netlify\/functions\/api|api)/, '').replace(/\/+$/, '') || '/';
  const method = event.httpMethod;
  let body = {};
  if (method === 'POST') {
    try { body = JSON.parse(event.body || '{}'); } catch { return err(400, 'Некорректные данные запроса.'); }
  }
  const qs = event.queryStringParameters || {};

  const getUser = login => store.get(uKey(login), { type: 'json' });
  const putUser = u => store.setJSON(uKey(u.login), u);
  const getList = async key => (await store.get(key, { type: 'json' })) || [];

  async function newSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    await store.setJSON('session:' + token, { login: user.login, createdAt: Date.now() });
    return token;
  }
  async function authUser() {
    const h = event.headers.authorization || event.headers.Authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const s = await store.get('session:' + token, { type: 'json' });
    if (!s || Date.now() - s.createdAt > SESSION_TTL) return null;
    const u = await getUser(s.login);
    if (!u || u.banned) return null;
    return u;
  }
  // Кошелёк (Сойн) и счётчик изменений NFT хранятся отдельно от аккаунта, чтобы синхронизация их не затирала
  const getWallet = async login => (await store.get('wallet:' + String(login).toLowerCase(), { type: 'json' })) || { coins: START_COINS, rev: 0 };
  const putWallet = (login, w) => store.setJSON('wallet:' + String(login).toLowerCase(), w);
  async function notify(login, o) {
    const k = 'notifs:' + String(login).toLowerCase();
    const list = (await store.get(k, { type: 'json' })) || [];
    const at = new Date().toISOString();
    const ex = o.key && list.find(n => n.key === o.key && !n.read);
    if (ex) { ex.count = (ex.count || 1) + 1; ex.text = o.textN ? o.textN(ex.count) : o.text; ex.at = at; await store.setJSON(k, list); return; }
    list.unshift({ id: Date.now() + '_' + crypto.randomBytes(3).toString('hex'), type: o.type, key: o.key || '', text: o.text, link: o.link || null, at, read: false, count: 1 });
    await store.setJSON(k, list.slice(0, 50));
  }
  async function log(actor, action, target, extra) {
    const l = await getList('log');
    l.unshift({ at: new Date().toISOString(), actor, action, target, extra: extra || '' });
    await store.setJSON('log', l.slice(0, 200));
  }

  // ---------- Резервные копии на Яндекс Диск ----------
  async function runBackup() {
    const cfg = ydConfig();
    if (!cfg) throw new Error('Яндекс Диск не настроен: задай YADISK_LOGIN и YADISK_APP_PASSWORD в переменных окружения Netlify.');
    const { blobs } = await store.list();
    const keys = blobs.map(b => b.key).filter(k => !BACKUP_SKIP.some(p => k.startsWith(p)));
    const data = {};
    for (let i = 0; i < keys.length; i += 20) {
      await Promise.all(keys.slice(i, i + 20).map(async k => { const v = await store.get(k, { type: 'json' }); if (v !== null && v !== undefined) data[k] = v; }));
    }
    const buf = zlib.gzipSync(Buffer.from(JSON.stringify({ app: 'crystalis', format: 1, at: new Date().toISOString(), store: data })));
    const day = new Date().toISOString().slice(0, 10);
    await ydPut(cfg, 'crystalis-latest.json.gz', buf);
    await ydPut(cfg, 'crystalis-' + day + '.json.gz', buf);
    const st = { at: Date.now(), ok: true, keys: Object.keys(data).length, bytes: buf.length };
    await store.setJSON('meta:backup', st);
    return st;
  }
  // Записать снимок в хранилище (сессии и временные ключи не трогаем)
  async function applySnapshot(snap) {
    if (!snap || snap.app !== 'crystalis' || !snap.store) throw new Error('Это не копия CRYSTALIS.');
    const entries = Object.entries(snap.store).filter(([k]) => !BACKUP_SKIP.some(p => k.startsWith(p)));
    for (let i = 0; i < entries.length; i += 20) await Promise.all(entries.slice(i, i + 20).map(([k, v]) => store.setJSON(k, v)));
    return { keys: entries.length, at: snap.at };
  }
  const parseSnap = buf => { try { return JSON.parse(zlib.gunzipSync(buf).toString('utf8')); } catch { throw new Error('Файл копии повреждён.'); } };
  async function runRestore() {
    const cfg = ydConfig();
    if (!cfg) throw new Error('Яндекс Диск не настроен.');
    return applySnapshot(parseSnap(await ydGet(cfg, 'crystalis-latest.json.gz')));
  }
  // Файл-снимок, лежащий внутри проекта (seed/crystalis-latest.json.gz) — так данные переезжают вместе с приложением
  function readSeed() {
    const dirs = [nodePath.join(__dirname, 'seed'), nodePath.join(__dirname, '..', '..', 'seed'), nodePath.join(process.env.LAMBDA_TASK_ROOT || '/var/task', 'seed'), nodePath.join(process.cwd(), 'seed')];
    for (const d of dirs) { const f = nodePath.join(d, 'crystalis-latest.json.gz'); try { if (fs.existsSync(f)) return fs.readFileSync(f); } catch {} }
    return null;
  }
  // Первый запуск на пустом сайте: подтягиваем данные с Яндекс Диска, а если их там нет — из seed-файла
  async function autoInit() {
    if (await store.get('meta:init', { type: 'json' })) return;
    const { blobs } = await store.list({ prefix: 'user:' });
    if (blobs.length) return void await store.setJSON('meta:init', { at: Date.now(), from: 'existing' });
    let from = '', transient = false;
    if (ydConfig()) {
      try { await runRestore(); from = 'yandex-disk'; }
      catch (e) { if (!/не найдена/.test(e.message)) transient = true; }
    }
    if (!from) {
      const seed = readSeed();
      if (seed) { try { await applySnapshot(parseSnap(seed)); from = 'seed'; } catch { transient = true; } }
    }
    if (from || !transient) await store.setJSON('meta:init', { at: Date.now(), from: from || 'empty' });
  }
  // Автокопия: первый /poll после истечения интервала запускает выгрузку (сначала ставим метку, чтобы не запускать её параллельно)
  async function maybeBackup() {
    if (!ydConfig()) return;
    const every = Math.max(10, Number(process.env.BACKUP_INTERVAL_MIN) || 60) * 60000;
    const st = await store.get('meta:backup', { type: 'json' });
    if (st && Date.now() - st.at < every) return;
    await store.setJSON('meta:backup', { ...(st || {}), at: Date.now(), ok: st ? st.ok : false, running: true });
    try { await runBackup(); } catch (e) { await store.setJSON('meta:backup', { at: Date.now(), ok: false, error: e.message }); }
  }

  if (!initChecked) { initChecked = true; await autoInit().catch(() => { initChecked = false; }); }

  // ---------- Регистрация / вход ----------
  if (path === '/auth/register' && method === 'POST') {
    const login = String(body.login || '').trim();
    const name = String(body.name || login).trim().slice(0, 40) || login;
    const password = String(body.password || '');
    if (login.length < 3 || login.length > 32) return err(400, 'Логин должен содержать от 3 до 32 символов.');
    if (!/^[a-zA-Z0-9_.-]+$/.test(login)) return err(400, 'Логин может содержать только латинские буквы, цифры, точку, дефис или подчёркивание.');
    if (password.length < 4) return err(400, 'Пароль должен содержать минимум 4 символа.');
    if (isRootDev(login)) return err(403, 'Этот логин зарезервирован. Войди с ним на вкладке «Вход».');
    if (await getUser(login)) return err(409, 'Пользователь с таким логином уже зарегистрирован.');
    const salt = crypto.randomBytes(16).toString('hex');
    const init = body.initialData || {};
    const user = {
      id: 'u_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      login, name, salt, passwordHash: hash(password, salt), role: 'user', banned: false,
      createdAt: new Date().toISOString(),
      data: {
        artworks: Array.isArray(init.artworks) ? init.artworks : [],
        collections: Array.isArray(init.collections) ? init.collections : [],
        learning: init.learning || { done: [], xp: 0, answers: {} },
        mentorHistory: Array.isArray(init.mentorHistory) ? init.mentorHistory : []
      }
    };
    await putUser(user);
    return out(201, { token: await newSession(user), user: pub(user), data: user.data });
  }

  if (path === '/auth/login' && method === 'POST') {
    const login = String(body.login || '').trim(), password = String(body.password || '');
    if (!login || !password) return err(400, 'Введи логин и пароль.');
    let user = await getUser(login);
    if (isRootDev(login) && password === (process.env.DEV_PASSWORD || '1111') && (!user || hash(password, user.salt) !== user.passwordHash)) {
      const salt = crypto.randomBytes(16).toString('hex');
      user = user || {
        id: 'u_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'), login, role: 'developer', createdAt: new Date().toISOString(),
        data: { artworks: [], collections: [], learning: { done: [], xp: 0, answers: {} }, mentorHistory: [] }
      };
      user.name = process.env.DEV_NAME || 'Егор'; user.salt = salt; user.passwordHash = hash(password, salt); user.banned = false;
      await putUser(user);
    }
    if (!user || hash(password, user.salt) !== user.passwordHash) return err(401, 'Неверный логин или пароль.');
    if (user.banned) return err(403, 'Аккаунт заблокирован.');
    return out(200, { token: await newSession(user), user: pub(user), data: user.data });
  }

  // ---------- Всё ниже требует входа ----------
  const me = await authUser();
  if (path === '/auth/logout' && method === 'POST') {
    const h = event.headers.authorization || event.headers.Authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (/^[a-f0-9]{64}$/.test(token)) await store.delete('session:' + token);
    return out(200, { ok: true });
  }
  if (!me) return err(401, 'Требуется авторизация.');

  if (path === '/auth/me' && method === 'GET') return out(200, { user: pub(me), data: me.data });

  if (path === '/user/sync' && method === 'POST') {
    let stale = false;
    if (Array.isArray(body.artworks)) {
      // Если NFT менялись на сервере (покупка/продажа), устаревший клиент их не затирает
      if (typeof body.rev === 'number' && body.rev < (await getWallet(me.login)).rev) stale = true;
      else me.data.artworks = body.artworks;
    }
    if (Array.isArray(body.collections)) me.data.collections = body.collections;
    if (body.learning && typeof body.learning === 'object') me.data.learning = body.learning;
    if (Array.isArray(body.mentorHistory)) me.data.mentorHistory = body.mentorHistory;
    await putUser(me);
    return out(200, { ok: true, stale });
  }

  if (path === '/inbox' && method === 'GET') {
    const msgs = (await getList('messages')).filter(m => m.to === 'all' || String(m.to).toLowerCase() === me.login.toLowerCase());
    return out(200, { messages: msgs.slice(0, 30) });
  }

  // ---------- Чаты и друзья ----------
  const cleanText = t => String(t || '').replace(/\r/g, '').trim().slice(0, 1000);
  // Картинки в чате: JPEG/PNG/WebP/GIF в виде data-URL, до ~400 КБ. Хранятся отдельно от списка сообщений.
  const cleanImage = s => { s = String(s || ''); return /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 400000 ? s : ''; };
  const imgKey = id => 'chatimg:' + id;
  const person = u => ({ login: u.login, name: u.name || u.login, avatar: u.avatar || '' });
  const newMsg = text => ({ id: Date.now() + '_' + crypto.randomBytes(3).toString('hex'), from: me.login, name: me.name || me.login, text, at: new Date().toISOString() });
  if (!Array.isArray(me.friends)) me.friends = [];

  // Присутствие: «в сети» / «был(а) ...» и «печатает…». Хранится отдельными маленькими записями, не в аккаунте.
  const ONLINE_MS = 25000, TYPING_MS = 6000;
  const touch = () => store.setJSON('presence:' + me.login.toLowerCase(), { at: Date.now() });
  const presenceOf = async login => {
    const rec = await store.get('presence:' + String(login).toLowerCase(), { type: 'json' });
    const at = (rec && rec.at) || 0;
    return { lastSeen: at, online: !!at && Date.now() - at < ONLINE_MS };
  };
  const typingKey = (dmKey, login) => 'typing:' + dmKey + ':' + String(login).toLowerCase();
  // Отметить сообщения от sender (адресованные мне) как доставленные и/или прочитанные
  async function markMsgs(dmKey, sender, asRead) {
    const list = await getList(dmKey);
    const s = String(sender).toLowerCase();
    let ch = false;
    list.forEach(m => {
      if (String(m.from).toLowerCase() !== s) return;
      if (!m.delivered) { m.delivered = true; ch = true; }
      if (asRead && !m.read) { m.read = true; ch = true; }
    });
    if (ch) await store.setJSON(dmKey, list);
    return list;
  }

  if (path.startsWith('/chat/image/') && method === 'GET') {
    const id = decodeURIComponent(path.slice(12));
    if (!/^[\w-]+$/.test(id)) return err(400, 'Некорректный запрос.');
    const rec = await store.get(imgKey(id), { type: 'json' });
    if (!rec) return err(404, 'Картинка не найдена.');
    if (rec.scope !== 'global' && !String(rec.scope).slice(3).split('|').includes(me.login.toLowerCase())) return err(403, 'Нет доступа.');
    return out(200, { image: rec.image });
  }

  if (path === '/chat/global') {
    if (method === 'GET') return out(200, { messages: (await getList('chat:global')).slice(-100) });
    if (method === 'POST') {
      const text = cleanText(body.text), image = cleanImage(body.image);
      if (body.image && !image) return err(400, 'Картинка не подходит: нужен JPEG, PNG, WebP или GIF до 400 КБ.');
      if (!text && !image) return err(400, 'Напиши сообщение.');
      const m = newMsg(text);
      if (image) { m.img = true; await store.setJSON(imgKey(m.id), { image, scope: 'global', from: me.login }); }
      await store.setJSON('chat:global', (await getList('chat:global')).concat(m).slice(-300));
      return out(200, { ok: true, message: m });
    }
  }

  if (path === '/friends' && method === 'GET') {
    const friends = await Promise.all((await Promise.all(me.friends.map(getUser))).filter(Boolean).map(async u => ({ ...person(u), ...(await presenceOf(u.login)) })));
    return out(200, { friends });
  }

  if (path === '/friends/add' && method === 'POST') {
    const u = await getUser(body.login || '');
    if (!u || u.banned) return err(404, 'Пользователь не найден.');
    if (u.login.toLowerCase() === me.login.toLowerCase()) return err(400, 'Нельзя добавить в друзья самого себя.');
    if (!me.friends.some(l => l.toLowerCase() === u.login.toLowerCase())) {
      me.friends.push(u.login); await putUser(me);
      await notify(u.login, { type: 'friend', text: (me.name || me.login) + ' добавил(а) тебя в друзья', link: { tab: 'Игрок', login: me.login } });
    }
    return out(200, { ok: true, friend: person(u) });
  }

  if (path === '/friends/remove' && method === 'POST') {
    const l = String(body.login || '').toLowerCase();
    me.friends = me.friends.filter(x => x.toLowerCase() !== l);
    await putUser(me);
    return out(200, { ok: true });
  }

  if (path === '/users/search' && method === 'GET') {
    const q = String(qs.q || '').trim().toLowerCase();
    if (q.length < 2) return out(200, { users: [] });
    const { blobs } = await store.list({ prefix: 'user:' });
    const mine = me.friends.map(l => l.toLowerCase());
    const users = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean)
      .filter(u => !u.banned && u.login.toLowerCase() !== me.login.toLowerCase() && (u.login.toLowerCase().includes(q) || String(u.name || '').toLowerCase().includes(q)))
      .slice(0, 20)
      .map(u => ({ ...person(u), isFriend: mine.includes(u.login.toLowerCase()) }));
    return out(200, { users });
  }

  if (path.startsWith('/dm/')) {
    let rest = path.slice(4), isTyping = false;
    if (rest.endsWith('/typing')) { isTyping = true; rest = rest.slice(0, -7); }
    const peer = await getUser(decodeURIComponent(rest));
    if (!peer || peer.banned) return err(404, 'Пользователь не найден.');
    if (peer.login.toLowerCase() === me.login.toLowerCase()) return err(400, 'Нельзя писать самому себе.');
    const key = 'dm:' + [me.login, peer.login].map(s => s.toLowerCase()).sort().join('|');
    if (isTyping && method === 'POST') {
      await Promise.all([touch(), store.setJSON(typingKey(key, me.login), { at: Date.now() })]);
      return out(200, { ok: true });
    }
    if (method === 'GET') {
      // Открыл переписку — значит собеседник получил и прочитал его сообщения
      const [list, pres, tp] = await Promise.all([markMsgs(key, peer.login, true), presenceOf(peer.login), store.get(typingKey(key, peer.login), { type: 'json' }), touch()]);
      const typing = !!(tp && tp.at && Date.now() - tp.at < TYPING_MS);
      return out(200, { peer: { ...person(peer), ...pres, typing: typing && pres.online }, messages: list.slice(-100) });
    }
    if (method === 'POST') {
      const text = cleanText(body.text), image = cleanImage(body.image);
      if (body.image && !image) return err(400, 'Картинка не подходит: нужен JPEG, PNG, WebP или GIF до 400 КБ.');
      if (!text && !image) return err(400, 'Напиши сообщение.');
      const m = newMsg(text);
      m.delivered = false; m.read = false;
      if (image) { m.img = true; await store.setJSON(imgKey(m.id), { image, scope: key, from: me.login }); }
      await store.setJSON(key, (await getList(key)).concat(m).slice(-500));
      store.delete(typingKey(key, me.login)).catch(() => {}); touch().catch(() => {});
      const nm = me.name || me.login;
      await notify(peer.login, { type: 'dm', key: 'dm:' + me.login.toLowerCase(), text: (image && !text ? 'Картинка от ' : 'Новое сообщение от ') + nm, textN: n => 'Новые сообщения от ' + nm + ' (' + n + ')', link: { tab: 'dm', login: me.login, name: nm } });
      return out(200, { ok: true, message: m });
    }
  }

  // ---------- Автообновление, уведомления ----------
  if (path === '/poll' && method === 'GET') {
    const w = await getWallet(me.login);
    const unreadList = (await getList('notifs:' + me.login.toLowerCase())).filter(n => !n.read);
    // Приложение открыто и получило уведомление — значит личные сообщения «доставлены»
    const senders = [...new Set(unreadList.filter(n => n.type === 'dm' && n.link && n.link.login).map(n => String(n.link.login).toLowerCase()))].slice(0, 5);
    await Promise.all([touch(), ...senders.map(s => markMsgs('dm:' + [me.login, s].map(x => x.toLowerCase()).sort().join('|'), s, false))]);
    await maybeBackup().catch(() => {});
    return out(200, { coins: w.coins, rev: w.rev, unread: unreadList.length, version: APP_VERSION });
  }
  if (path === '/notifications' && method === 'GET') {
    const list = await getList('notifs:' + me.login.toLowerCase());
    return out(200, { notifications: list.slice(0, 40).map(({ key, ...n }) => n), unread: list.filter(n => !n.read).length });
  }
  if (path === '/notifications/read' && method === 'POST') {
    const k = 'notifs:' + me.login.toLowerCase();
    const list = await getList(k);
    let ch = false;
    list.forEach(n => { if (!n.read && (!body.key || n.key === body.key)) { n.read = true; ch = true; } });
    if (ch) await store.setJSON(k, list);
    return out(200, { ok: true });
  }

  // ---------- Профили игроков ----------
  if (path.startsWith('/profile/') && method === 'GET') {
    const u = await getUser(decodeURIComponent(path.slice(9)));
    if (!u || u.banned) return err(404, 'Пользователь не найден.');
    const isFriend = me.friends.some(l => l.toLowerCase() === u.login.toLowerCase());
    const all = await allListings();
    return out(200, {
      user: { login: u.login, name: u.name || u.login, avatar: u.avatar || '', createdAt: u.createdAt, isFriend, self: u.login.toLowerCase() === me.login.toLowerCase(), ...(await presenceOf(u.login)) },
      artworks: ((u.data && u.data.artworks) || []).map(pubArt),
      listings: all.filter(l => l.seller.toLowerCase() === u.login.toLowerCase()).map(pubListing)
    });
  }

  // ---------- Торговая площадка (Сойн) ----------
  async function allListings() {
    const { blobs } = await store.list({ prefix: 'listing:' });
    return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean).sort((a, b) => a.at < b.at ? 1 : -1);
  }
  if (path === '/market' && method === 'GET') {
    return out(200, { listings: (await allListings()).slice(0, 100).map(pubListing), coins: (await getWallet(me.login)).coins });
  }
  if (path === '/market/list' && method === 'POST') {
    const price = Math.floor(Number(body.price));
    if (!(price >= 1 && price <= 1000000)) return err(400, 'Цена должна быть от 1 до 1 000 000 Сойн.');
    const arts = me.data.artworks || (me.data.artworks = []);
    const idx = arts.findIndex(a => String(a.id) === String(body.artworkId));
    if (idx < 0) return err(404, 'NFT не найден в твоей галерее.');
    const mine = (await allListings()).filter(l => l.seller.toLowerCase() === me.login.toLowerCase()).length;
    if (mine >= 30) return err(400, 'Нельзя выставить больше 30 лотов одновременно.');
    const art = arts.splice(idx, 1)[0];
    const preview = typeof body.thumb === 'string' && body.thumb.startsWith('data:image/') && body.thumb.length < 400000 ? body.thumb : (art.thumb || '');
    const id = 'l_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    await store.setJSON('listingart:' + id, art);
    await store.setJSON('listing:' + id, { id, seller: me.login, sellerName: me.name || me.login, price, at: new Date().toISOString(), title: art.title, desc: art.desc || '', category: art.category || '', rarity: art.rarity || '', image: preview });
    await putUser(me);
    const w = await getWallet(me.login); w.rev++; await putWallet(me.login, w);
    return out(200, { ok: true, artworks: arts, rev: w.rev });
  }
  if (path === '/market/cancel' && method === 'POST') {
    const l = await store.get('listing:' + String(body.id), { type: 'json' });
    if (!l) return err(404, 'Лот не найден.');
    if (l.seller.toLowerCase() !== me.login.toLowerCase()) return err(403, 'Это не твой лот.');
    const art = await store.get('listingart:' + l.id, { type: 'json' });
    await store.delete('listing:' + l.id); await store.delete('listingart:' + l.id);
    if (art) (me.data.artworks || (me.data.artworks = [])).unshift(art);
    await putUser(me);
    const w = await getWallet(me.login); w.rev++; await putWallet(me.login, w);
    return out(200, { ok: true, artworks: me.data.artworks, rev: w.rev });
  }
  if (path === '/market/buy' && method === 'POST') {
    const l = await store.get('listing:' + String(body.id), { type: 'json' });
    if (!l) return err(404, 'Лот уже продан или снят с продажи.');
    if (l.seller.toLowerCase() === me.login.toLowerCase()) return err(400, 'Нельзя купить собственный лот.');
    const w = await getWallet(me.login);
    if (w.coins < l.price) return err(400, 'Не хватает Сойн: нужно ' + l.price + ', на счёте ' + w.coins + '.');
    const seller = await getUser(l.seller);
    const art = await store.get('listingart:' + l.id, { type: 'json' });
    // Сначала «забираем» лот, чтобы второй покупатель его не получил
    await store.delete('listing:' + l.id); await store.delete('listingart:' + l.id);
    if (!seller || !art) return err(410, 'Лот недоступен и удалён.');
    w.coins -= l.price; w.rev++;
    const sw = await getWallet(seller.login); sw.coins += l.price;
    (me.data.artworks || (me.data.artworks = [])).unshift({ ...art, id: Date.now() + Math.floor(Math.random() * 1000), collection: '', boughtFrom: l.seller, boughtAt: new Date().toISOString() });
    await putUser(me); await putWallet(me.login, w); await putWallet(seller.login, sw);
    await notify(seller.login, { type: 'sale', text: (me.name || me.login) + ' купил(а) твой NFT «' + l.title + '» за ' + l.price + ' Сойн', link: { tab: 'Рынок' } });
    return out(200, { ok: true, coins: w.coins, artworks: me.data.artworks, rev: w.rev, title: l.title });
  }

  
  // ---------- Профиль: аватар, смена ника (раз в 7 дней), избранное, перевод Сойн, игры ----------
  if (path === '/profile/update' && method === 'POST') {
    if (typeof body.avatar === 'string') {
      if (body.avatar && (!body.avatar.startsWith('data:image/') || body.avatar.length > 350000)) {
        return err(400, 'Аватар должен быть изображением до 250 КБ.');
      }
      me.avatar = body.avatar;
    }
    if (typeof body.name === 'string') {
      const nextName = body.name.trim().slice(0, 40);
      if (nextName.length < 2) return err(400, 'Имя должно содержать минимум 2 символа.');
      if (nextName !== me.name) {
        const WEEK_MS = 7 * 24 * 3600 * 1000;
        const last = Number(me.lastNameChange || 0);
        if (last && Date.now() - last < WEEK_MS) {
          const leftDays = Math.ceil((WEEK_MS - (Date.now() - last)) / (24 * 3600 * 1000));
          return err(429, 'Сменить никнейм можно раз в 7 дней. Осталось дн.: ' + leftDays + '.');
        }
        me.name = nextName;
        me.lastNameChange = Date.now();
      }
    }
    await putUser(me);
    return out(200, { ok: true, user: pub(me) });
  }

  if (path === '/fav/toggle' && method === 'POST') {
    const id = String(body.id || '').trim();
    if (!id) return err(400, 'Не указан ID работы.');
    if (!Array.isArray(me.favs)) me.favs = [];
    const idx = me.favs.indexOf(id);
    if (idx >= 0) me.favs.splice(idx, 1);
    else me.favs.unshift(id);
    me.favs = me.favs.slice(0, 200);
    await putUser(me);
    return out(200, { ok: true, favs: me.favs });
  }

  if (path === '/coins/transfer' && method === 'POST') {
    const toLogin = String(body.to || '').trim();
    const amount = Math.floor(Number(body.amount));
    if (!toLogin) return err(400, 'Укажи логин получателя.');
    if (!(amount >= 1 && amount <= 1000000)) return err(400, 'Сумма перевода должна быть от 1 до 1 000 000 Сойн.');
    const target = await getUser(toLogin);
    if (!target || target.banned) return err(404, 'Получатель не найден.');
    if (target.login.toLowerCase() === me.login.toLowerCase()) return err(400, 'Нельзя перевести Сойн самому себе.');
    const w = await getWallet(me.login);
    if (w.coins < amount) return err(400, 'Недостаточно Сойн: у тебя ' + w.coins + '.');
    const tw = await getWallet(target.login);
    w.coins -= amount;
    tw.coins += amount;
    await putWallet(me.login, w);
    await putWallet(target.login, tw);
    await notify(target.login, {
      type: 'transfer',
      text: (me.name || me.login) + ' перевёл(а) тебе ' + amount + ' Сойн',
      link: { tab: 'Рынок' }
    });
    return out(200, { ok: true, coins: w.coins });
  }

  if (path === '/game/reward' && method === 'POST') {
    const reward = Math.max(0, Math.min(50, Math.floor(Number(body.coins) || 0)));
    const score = Math.max(0, Math.floor(Number(body.score) || 0));
    const level = Math.max(0, Math.floor(Number(body.level) || 0));
    if (!me.gameStats) me.gameStats = { jumpBest: 0, levelsCleared: 0, coinsEarned: 0 };
    if (score > (me.gameStats.jumpBest || 0)) me.gameStats.jumpBest = score;
    if (level > (me.gameStats.levelsCleared || 0)) me.gameStats.levelsCleared = level;
    me.gameStats.coinsEarned = (me.gameStats.coinsEarned || 0) + reward;
    await putUser(me);
    const w = await getWallet(me.login);
    if (reward > 0) {
      w.coins += reward;
      await putWallet(me.login, w);
    }
    return out(200, { ok: true, coins: w.coins, gameStats: me.gameStats });
  }

  // ---------- Панель разработчика ----------
  if (path.startsWith('/admin')) {
    if (roleOf(me) !== 'developer') return err(403, 'Недостаточно прав.');

    if (path === '/admin/users' && method === 'GET') {
      const { blobs } = await store.list({ prefix: 'user:' });
      const users = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
      const enriched = await Promise.all(users.map(async u => {
        const w = await getWallet(u.login);
        return {
          ...pub(u), banned: !!u.banned, rootDev: isRootDev(u.login), coins: w.coins,
          works: (u.data.artworks || []).length, collections: (u.data.collections || []).length
        };
      }));
      return out(200, { users: enriched.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1) });
    }

    if (path === '/admin/user' && method === 'GET') {
      const u = await getUser(qs.login || '');
      if (!u) return err(404, 'Пользователь не найден.');
      return out(200, { user: pub(u), banned: !!u.banned, data: u.data });
    }

    if (path === '/admin/user/update' && method === 'POST') {
      const u = await getUser(body.login || '');
      if (!u) return err(404, 'Пользователь не найден.');
      const self = u.login.toLowerCase() === me.login.toLowerCase();
      const changes = [];
      if (typeof body.name === 'string') { u.name = body.name.trim().slice(0, 40) || u.name; changes.push('имя'); }
      if (body.role === 'user' || body.role === 'developer') {
        if (self || isRootDev(u.login)) return err(400, 'Нельзя менять роль себе или главному разработчику.');
        u.role = body.role; changes.push('роль → ' + body.role);
      }
      if (typeof body.banned === 'boolean') {
        if (self || isRootDev(u.login)) return err(400, 'Нельзя заблокировать себя или главного разработчика.');
        u.banned = body.banned; changes.push(body.banned ? 'блокировка' : 'разблокировка');
      }
      if (body.data && typeof body.data === 'object') {
        const d = body.data;
        if (Array.isArray(d.artworks)) u.data.artworks = d.artworks;
        if (Array.isArray(d.collections)) u.data.collections = d.collections;
        if (d.learning && typeof d.learning === 'object') u.data.learning = d.learning;
        changes.push('данные');
      }
      await putUser(u);
      await log(me.login, 'update', u.login, changes.join(', '));
      return out(200, { ok: true, user: pub(u) });
    }

    if (path === '/admin/user/delete' && method === 'POST') {
      const u = await getUser(body.login || '');
      if (!u) return err(404, 'Пользователь не найден.');
      if (u.login.toLowerCase() === me.login.toLowerCase() || isRootDev(u.login)) return err(400, 'Этот аккаунт удалить нельзя.');
      await store.delete(uKey(u.login));
      await log(me.login, 'delete', u.login);
      return out(200, { ok: true });
    }

    if (path === '/admin/message' && method === 'POST') {
      const text = String(body.text || '').trim().slice(0, 1000);
      const to = String(body.to || 'all').trim();
      if (!text) return err(400, 'Напиши текст сообщения.');
      if (to !== 'all' && !(await getUser(to))) return err(404, 'Получатель не найден.');
      const msgs = await getList('messages');
      msgs.unshift({ id: Date.now(), to, from: me.name || me.login, text, at: new Date().toISOString() });
      await store.setJSON('messages', msgs.slice(0, 300));
      await log(me.login, 'message', to);
      return out(200, { ok: true });
    }

    
    if (path === '/admin/coins' && method === 'POST') {
      const u = await getUser(body.login || '');
      if (!u) return err(404, 'Пользователь не найден.');
      const w = await getWallet(u.login);
      if (body.mode === 'set') {
        w.coins = Math.max(0, Math.floor(Number(body.amount) || 0));
      } else {
        w.coins = Math.max(0, w.coins + Math.floor(Number(body.amount) || 0));
      }
      await putWallet(u.login, w);
      await log(me.login, 'coins_' + (body.mode || 'add'), u.login, String(w.coins));
      return out(200, { ok: true, coins: w.coins });
    }

    if (path === '/admin/backup/status' && method === 'GET') {
      return out(200, { configured: !!ydConfig(), folder: ydConfig() ? ydConfig().dir : '', last: await store.get('meta:backup', { type: 'json' }) });
    }
    if (path === '/admin/backup/run' && method === 'POST') {
      try { const st = await runBackup(); await log(me.login, 'backup', 'yandex-disk', st.keys + ' записей'); return out(200, { ok: true, ...st }); }
      catch (e) { await store.setJSON('meta:backup', { at: Date.now(), ok: false, error: e.message }); return err(502, e.message); }
    }
    if (path === '/admin/backup/download' && method === 'GET') {
      if (!isRootDev(me.login)) return err(403, 'Скачивание снимка доступно только главному разработчику.');
      const { blobs } = await store.list();
      const keys = blobs.map(b => b.key).filter(k => !BACKUP_SKIP.some(p => k.startsWith(p)));
      const data = {};
      for (let i = 0; i < keys.length; i += 20) await Promise.all(keys.slice(i, i + 20).map(async k => { const v = await store.get(k, { type: 'json' }); if (v !== null && v !== undefined) data[k] = v; }));
      const buf = zlib.gzipSync(Buffer.from(JSON.stringify({ app: 'crystalis', format: 1, at: new Date().toISOString(), store: data })));
      if (buf.length > 4.5 * 1024 * 1024) return err(413, 'Снимок слишком большой для прямого скачивания (' + Math.round(buf.length / 1048576) + ' МБ). Возьми файл crystalis-latest.json.gz с Яндекс Диска.');
      return { statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': 'attachment; filename="crystalis-latest.json.gz"', 'Cache-Control': 'no-store' }, body: buf.toString('base64') };
    }
    if (path === '/admin/backup/restore' && method === 'POST') {
      if (!isRootDev(me.login)) return err(403, 'Восстановление доступно только главному разработчику.');
      if (body.confirm !== true) return err(400, 'Нужно подтверждение.');
      try { const r = await runRestore(); await log(me.login, 'restore', 'yandex-disk', r.keys + ' записей'); return out(200, { ok: true, ...r }); }
      catch (e) { return err(502, e.message); }
    }

    if (path === '/admin/log' && method === 'GET') return out(200, { log: await getList('log') });
  }

  return err(404, 'Метод API не найден.');
};
