function fallback(q) {
  const s = q.toLowerCase();
  if (/привет|здравствуй|добрый день/.test(s)) return 'Привет! Я Наставник CRYSTALIS. Могу помочь с основами цифрового искусства, NFT, блокчейна и безопасностью. Что хочешь узнать?';
  if (/nft|нфт/.test(s)) return 'NFT — это невзаимозаменяемый токен: уникальная запись в блокчейне, которая может подтверждать владение цифровым объектом. Сам файл изображения и токен — не одно и то же. Покупка NFT не всегда передаёт авторские права.';
  if (/блокчейн/.test(s)) return 'Блокчейн — распределённый цифровой реестр. Данные объединяются в блоки, связанные криптографически. Копии реестра хранятся у множества участников сети, а новые записи проходят проверку.';
  if (/кошел[её]к|seed|сид-фраз|приватн/.test(s)) return 'Криптокошелёк управляет ключами, которые позволяют подписывать операции. Никому не сообщай seed-фразу или приватный ключ и не вводи их на неизвестных сайтах. Потеря секретной фразы может означать потерю доступа.';
  if (/искусственн.*интеллект|\bии\b|нейросет/.test(s)) return 'Искусственный интеллект — область технологий, в которой программы выполняют задачи, обычно требующие человеческих способностей: анализируют данные, распознают изображения и создают тексты.';
  return 'Внешний ИИ сейчас не ответил, а встроенная база знаний не содержит точного ответа. Попробуй уточнить вопрос или спросить об NFT, блокчейне, цифровом искусстве, ИИ либо безопасности.';
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Метод не поддерживается' };
  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Некорректные данные запроса.' }) }; }
  const messages = Array.isArray(data.messages) ? data.messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2500) })) : [];
  const last = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!last || !last.content.trim()) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Напиши вопрос Наставнику.' }) };
  const context = messages.slice(-8).map(m => (m.role === 'assistant' ? 'Наставник: ' : 'Пользователь: ') + m.content.slice(0, 1200)).join('\n');
  const prompt = 'Ты — Наставник CRYSTALIS, дружелюбный русскоязычный преподаватель. Отвечай понятно и по существу. Не выдумывай факты. Не запрашивай пароли, приватные ключи или seed-фразы. Учитывай контекст беседы.\n' + context + '\nОтветь на последний вопрос пользователя: ' + last.content;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const response = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt), { signal: controller.signal, headers: { 'Accept': 'text/plain', 'User-Agent': 'CRYSTALIS/1.0' } });
    clearTimeout(timer);
    if (!response.ok) throw new Error('AI service unavailable');
    const answer = (await response.text()).trim();
    if (!answer || answer.length > 12000) throw new Error('Invalid AI response');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify({ answer, fallback: false }) };
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify({ answer: fallback(last.content), fallback: true }) };
  }
};
