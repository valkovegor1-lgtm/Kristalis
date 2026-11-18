function fallback(q) {
  const s = q.toLowerCase();
  if (/привет|здравствуй|добрый день/.test(s)) return 'Привет! Я Наставник CRYSTALIS. Могу помочь с основами цифрового искусства, NFT, блокчейна и безопасностью. Что хочешь узнать?';
  if (/nft|нфт/.test(s)) return 'NFT — это невзаимозаменяемый токен: уникальная запись в блокчейне, которая может подтверждать владение цифровым объектом. Сам файл изображения и токен — не одно и то же. Покупка NFT не всегда передаёт авторские права.';
  if (/блокчейн/.test(s)) return 'Блокчейн — распределённый цифровой реестр. Данные объединяются в блоки, связанные криптографически. Копии реестра хранятся у множества участников сети, а новые записи проходят проверку.';
  if (/кошел[её]к|seed|сид-фраз|приватн/.test(s)) return 'Криптокошелёк управляет ключами, которые позволяют подписывать операции. Никому не сообщай seed-фразу или приватный ключ и не вводи их на неизвестных сайтах. Потеря секретной фразы может означать потерю доступа.';
  if (/искусственн.*интеллект|\bии\b|нейросет/.test(s)) return 'Искусственный интеллект — область технологий, в которой программы выполняют задачи, обычно требующие человеческих способностей: анализируют данные, распознают изображения и создают тексты.';
  return 'Внешний ИИ сейчас не ответил, а встроенная база знаний не содержит точного ответа. Попробуй уточнить вопрос или спросить об NFT, блокчейне, цифровом искусстве, ИИ либо безопасности.';
}
const FALLBACK_EN = {
  hello: "Hi! I'm the CRYSTALIS Mentor. I can help with the basics of digital art, NFTs, blockchain and security. What would you like to know?",
  nft: "An NFT is a non-fungible token: a unique record on a blockchain that can confirm ownership of a digital object. The image file and the token are not the same thing. Buying an NFT does not always transfer copyright.",
  chain: "A blockchain is a distributed digital ledger. Data is grouped into blocks linked cryptographically. Copies of the ledger are held by many network participants, and new records are verified.",
  wallet: "A crypto wallet manages the keys used to sign operations. Never share your seed phrase or private key, and never enter them on unknown sites. Losing the secret phrase can mean losing access.",
  ai: "Artificial intelligence is a field of technology where programs perform tasks that usually require human abilities: analyzing data, recognizing images and generating text.",
  none: "The external AI did not respond and the built-in knowledge base has no exact answer. Try rephrasing, or ask about NFTs, blockchain, digital art, AI or security."
};
function fallbackEn(q) {
  const s = q.toLowerCase();
  if (/\b(hi|hello|hey)\b|привет|здравствуй/.test(s)) return FALLBACK_EN.hello;
  if (/nft|нфт/.test(s)) return FALLBACK_EN.nft;
  if (/blockchain|блокчейн/.test(s)) return FALLBACK_EN.chain;
  if (/wallet|seed|private key|кошел[её]к|сид-фраз|приватн/.test(s)) return FALLBACK_EN.wallet;
  if (/artificial intelligence|\bai\b|нейросет|искусственн/.test(s)) return FALLBACK_EN.ai;
  return FALLBACK_EN.none;
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Метод не поддерживается' };
  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Некорректные данные запроса.' }) }; }
  const en = data.lang === 'en';
  const messages = Array.isArray(data.messages) ? data.messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2500) })) : [];
  const last = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!last || !last.content.trim()) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Напиши вопрос Наставнику.' }) };
  const context = messages.slice(-8).map(m => (m.role === 'assistant' ? 'Наставник: ' : 'Пользователь: ') + m.content.slice(0, 1200)).join('\n');
  const prompt = en
    ? 'You are the CRYSTALIS Mentor, a friendly teacher. Always answer in English, clearly and to the point. Do not invent facts. Never ask for passwords, private keys or seed phrases. Take the conversation context into account.\n' + messages.slice(-8).map(m => (m.role === 'assistant' ? 'Mentor: ' : 'User: ') + m.content.slice(0, 1200)).join('\n') + '\nAnswer the user\'s last question: ' + last.content
    : 'Ты — Наставник CRYSTALIS, дружелюбный русскоязычный преподаватель. Отвечай понятно и по существу. Не выдумывай факты. Не запрашивай пароли, приватные ключи или seed-фразы. Учитывай контекст беседы.\n' + context + '\nОтветь на последний вопрос пользователя: ' + last.content;
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
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify({ answer: en ? fallbackEn(last.content) : fallback(last.content), fallback: true }) };
  }
};
