/* CRYSTALIS — переключатели темы и языка (RU / EN).
 * Русский — исходный язык интерфейса: тексты в коде остаются русскими, а в режиме EN
 * автоматически переводятся по словарю (и в уже готовой странице, и во всём, что рисуется позже).
 * Тема — атрибут data-theme на <html> + CSS-переменные. Выбор хранится в localStorage. */
(function () {
  'use strict';
  var LS_LANG = 'crystalis_lang', LS_THEME = 'crystalis_theme';
  var doc = document, root = doc.documentElement;
  var lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'ru';
  var theme = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var CYR = /[\u0400-\u04FF]/;
  var CYR_CLASS = '[\u0410-\u044F\u0401\u0451]';
  var CYR_START = new RegExp('^' + CYR_CLASS);

  var PAIRS = [
[
"NFT (невзаимозаменяемый токен) — уникальная запись в блокчейне. Она помогает отличить один токен от другого и может содержать ссылку на цифровой объект или сведения о нём. Важно: сам файл изображения и NFT — не одно и то же. Покупка токена не всегда автоматически передаёт авторские права на изображение.",
"An NFT (non-fungible token) is a unique record on a blockchain. It helps tell one token from another and may contain a link to a digital object or information about it. Important: the image file and the NFT are not the same thing. Buying a token does not always automatically transfer copyright to the image."
],
[
"Смарт-контракт — детерминированный код в блокчейне, исполняемый виртуальной машиной (например, EVM). Стандарт ERC-721 описывает уникальные невзаимозаменяемые токены, где каждый tokenId уникален, а ERC-1155 позволяет хранить в одном контракте как уникальные, так и полувзаимозаменяемые токены.",
"A smart contract is deterministic code on a blockchain, executed by a virtual machine (for example, the EVM). The ERC-721 standard describes unique non-fungible tokens, where every tokenId is unique, while ERC-1155 lets a single contract hold both unique and semi-fungible tokens."
],
[
"Консенсус решает задачу византийских генералов в децентрализованной сети. Proof-of-Work (PoW) требует вычислительной работы майнеров для поиска nonce, тогда как Proof-of-Stake (PoS) опирается на экономический залог (стейкинг) валидаторов и механизм слэшинга за злонамеренное поведение.",
"Consensus solves the Byzantine generals problem in a decentralized network. Proof-of-Work (PoW) requires miners to do computational work to find a nonce, whereas Proof-of-Stake (PoS) relies on validators' economic deposit (staking) and a slashing mechanism for malicious behavior."
],
[
"Криптокошелёк — инструмент для управления ключами и взаимодействия с блокчейном. Публичный адрес можно сообщать для получения активов. Закрытый ключ и секретную фразу восстановления необходимо хранить в тайне: тот, кто получит к ним доступ, может получить контроль над активами.",
"A crypto wallet is a tool for managing keys and interacting with a blockchain. You can share your public address to receive assets. Keep your private key and recovery phrase secret: anyone who gets access to them can take control of your assets."
],
[
"Создавая цифровую работу, используй собственные материалы или контент, на который у тебя есть разрешение. Владение NFT само по себе не означает автоматическую передачу авторских прав. Условия использования должны быть явно указаны создателем или платформой.",
"When creating a digital artwork, use your own materials or content you have permission to use. Owning an NFT does not by itself mean an automatic transfer of copyright. The terms of use must be clearly stated by the creator or the platform."
],
[
"Транзакция — операция, которую пользователь отправляет в сеть. Для её обработки в некоторых сетях требуется комиссия. Размер комиссии может меняться в зависимости от сети, нагрузки и типа операции. Перед подтверждением всегда проверяй сумму, адрес и сеть.",
"A transaction is an operation a user sends to the network. In some networks a fee is required to process it. The fee may vary depending on the network, its load and the type of operation. Always check the amount, address and network before confirming."
],
[
"Криптографическая хеш-функция преобразует входные данные произвольной длины в строку фиксированного размера. Главные свойства: детерминированность, лавинный эффект (изменение даже 1 бита полностью меняет хеш) и стойкость к коллизиям.",
"A cryptographic hash function converts input data of any length into a string of fixed size. Its main properties: determinism, the avalanche effect (changing even 1 bit completely changes the hash) and collision resistance."
],
[
"Блокчейн — это распределённый реестр. Записи объединяются в блоки, а блоки связываются криптографическими методами. Копии реестра хранятся у участников сети. Правила подтверждения записей зависят от конкретного блокчейна.",
"A blockchain is a distributed ledger. Records are grouped into blocks, and blocks are linked using cryptographic methods. Copies of the ledger are kept by network participants. The rules for confirming records depend on the specific blockchain."
],
[
"Mint — процесс создания токена в блокчейне. При выпуске формируется запись токена, а его свойства и связь с цифровым объектом задаются правилами платформы или смарт-контракта. Выпуск может требовать комиссию сети.",
"Mint is the process of creating a token on a blockchain. When minting, a token record is formed, and its properties and link to a digital object are set by the platform's or smart contract's rules. Minting may require a network fee."
],
[
"Представь билет на концерт: он подтверждает право на конкретное место и событие. NFT похож на уникальную цифровую запись, но реальные права зависят от условий проекта и закона.",
"Imagine a concert ticket: it confirms the right to a specific seat and event. An NFT is similar to a unique digital record, but the actual rights depend on the project's terms and the law."
],
[
"Режим без API-ключа · требуется интернет. Подключение к Pollinations экспериментальное: если сервис не ответит, Наставник попробует помочь из встроенной базы знаний.",
"No-API-key mode · internet required. The Pollinations connection is experimental: if the service does not respond, the Mentor will try to help from the built-in knowledge base."
],
[
"В игровых экосистемах ERC-1155 часто используют для предметов, где у одного меча может быть 100 копий, а легендарный артефакт существует в единственном экземпляре.",
"In gaming ecosystems ERC-1155 is often used for items, where one sword may have 100 copies while a legendary artifact exists as a single instance."
],
[
"Для настоящей генерации нужно подключить внешний сервис ИИ через защищённый сервер. Сейчас раздел составляет запрос, но ещё не создаёт изображение.",
"Real generation requires connecting an external AI service through a secure server. For now this section only builds a prompt and does not create an image yet."
],
[
"Это похоже на плату за обработку операции. Комиссия не является гарантией успешного результата, поэтому важно читать детали перед подтверждением.",
"It is similar to a processing charge. A fee does not guarantee a successful result, so it is important to read the details before confirming."
],
[
"Сейчас ты в гостевом режиме. Зарегистрируйся или войди в аккаунт выше, чтобы у каждого участника был собственный профиль, галерея и прогресс.",
"You are in guest mode. Sign up or sign in above so every member has their own profile, gallery and progress."
],
[
"Не настроено. В Netlify → Environment variables добавь YADISK_LOGIN и YADISK_APP_PASSWORD (пароль приложения «Файлы WebDAV» из id.yandex.ru).",
"Not configured. In Netlify → Environment variables add YADISK_LOGIN and YADISK_APP_PASSWORD (the “Files WebDAV” app password from id.yandex.ru)."
],
[
"Если ты купил цифровой токен, это не обязательно означает, что можешь печатать изображение на товарах или использовать его в рекламе.",
"If you bought a digital token, it does not necessarily mean you can print the image on merchandise or use it in advertising."
],
[
"Если в документе изменить одну запятую, его SHA-256 хеш изменится полностью, что позволяет мгновенно выявить подмену метаданных NFT.",
"If you change a single comma in a document, its SHA-256 hash changes completely, which makes it possible to instantly detect tampering with NFT metadata."
],
[
"Создать изображение в редакторе — ещё не значит выпустить NFT. Для выпуска нужна отдельная операция в поддерживаемой блокчейн-сети.",
"Creating an image in an editor does not mean minting an NFT. Minting requires a separate operation on a supported blockchain network."
],
[
"Привет! Я Наставник CRYSTALIS. Могу объяснить тему урока, разобрать термин или помочь подготовиться к тесту. С чего начнём?",
"Hi! I'm the CRYSTALIS Mentor. I can explain a lesson topic, break down a term or help you prepare for the quiz. Where shall we start?"
],
[
"Представь общий журнал, копии которого есть у многих участников. Новая запись добавляется после проверки по правилам сети.",
"Imagine a shared journal that many participants hold copies of. A new entry is added after it is checked against the network's rules."
],
[
"В сети PoS валидатор, пытающийся подписать два противоречащих блока одновременно, теряет часть заблокированных монет.",
"In a PoS network, a validator who tries to sign two conflicting blocks at the same time loses part of their locked coins."
],
[
"Точно! Лавинный эффект гарантирует, что малейшее изменение входных данных кардинально меняет итоговый дайджест.",
"Exactly! The avalanche effect guarantees that the slightest change to the input dramatically changes the resulting digest."
],
[
"Верно. NFT — это невзаимозаменяемый токен. Изображение может быть связано с ним, но не является самим токеном.",
"Correct. An NFT is a non-fungible token. An image may be linked to it, but it is not the token itself."
],
[
"Управляй стрелками ◀ ▶ или нажимай на левую/правую половину экрана. Прыгай по платформам и собирай кристаллы!",
"Steer with the ◀ ▶ arrows or tap the left/right half of the screen. Jump across platforms and collect crystals!"
],
[
"Никогда не передавай секретную фразу или закрытый ключ. Настоящая служба поддержки не должна их запрашивать.",
"Never share your secret phrase or private key. Real support staff should never ask for them."
],
[
"Публичный адрес похож на номер счёта для получения перевода, а секретная фраза — на главный ключ от сейфа.",
"A public address is like an account number for receiving a transfer, while the secret phrase is like the master key to a safe."
],
[
"Восстановить базу из последней копии на Яндекс Диске? Текущие записи с теми же ключами будут перезаписаны.",
"Restore the database from the latest backup on Yandex Disk? Current records with the same keys will be overwritten."
],
[
"Какой механизм защищает сеть Proof-of-Stake от попыток валидатора подтвердить мошенническую ветку блоков?",
"Which mechanism protects a Proof-of-Stake network from a validator trying to confirm a fraudulent branch of blocks?"
],
[
"Верно! ERC-1155 оптимизирует газ и позволяет объединять разные классы активов в едином смарт-контракте.",
"Correct! ERC-1155 optimizes gas and lets different classes of assets be combined in a single smart contract."
],
[
"Работа переедет из галереи на площадку. Её можно снять с продажи в любой момент — она вернётся к тебе.",
"The artwork will move from your gallery to the marketplace. You can take it off sale at any time — it will return to you."
],
[
"В этой версии нет подключения к блокчейну и отправки транзакций. Здесь представлен учебный материал.",
"This version has no blockchain connection and cannot send transactions. Educational material only."
],
[
"Можешь спросить меня о NFT, блокчейне, кошельках, выпуске токенов, комиссиях или авторских правах.",
"You can ask me about NFTs, blockchain, wallets, minting tokens, fees or copyright."
],
[
"Торговая площадка работает с аккаунтом на сервере. Войди или зарегистрируйся во вкладке «Профиль».",
"The marketplace works with a server account. Sign in or sign up on the “Profile” tab."
],
[
"Сохранённая работа — цифровой макет. Она ещё не выпущена в блокчейне и не является настоящим NFT.",
"A saved artwork is a digital mockup. It has not been minted on a blockchain and is not a real NFT."
],
[
"Яндекс Диск не настроен: задай YADISK_LOGIN и YADISK_APP_PASSWORD в переменных окружения Netlify.",
"Yandex Disk is not configured: set YADISK_LOGIN and YADISK_APP_PASSWORD in the Netlify environment variables."
],
[
"Именно так: блокчейн хранит проверяемые записи. Он не предназначен для публикации паролей.",
"Exactly: a blockchain stores verifiable records. It is not meant for publishing passwords."
],
[
"Что произойдёт с SHA-256 хешем метаданных NFT, если изменить всего один символ в описании?",
"What happens to the SHA-256 hash of NFT metadata if you change just one character in the description?"
],
[
"Ответы внешнего ИИ зависят от доступности стороннего сервиса и могут временно не работать.",
"External AI answers depend on a third-party service being available and may temporarily stop working."
],
[
"Именно так! Экономические стимулы и слэшинг делают атаку на сеть финансово невыгодной.",
"Exactly! Economic incentives and slashing make attacking the network financially unprofitable."
],
[
"Чаты доступны с аккаунтом на сервере. Войди или зарегистрируйся во вкладке «Профиль».",
"Chats are available with a server account. Sign in or sign up on the “Profile” tab."
],
[
"Программа в блокчейне, которая выполняет заданные правила при определённых условиях.",
"A program on a blockchain that executes set rules under certain conditions."
],
[
"Логин может содержать только латинские буквы, цифры, точку, дефис или подчёркивание.",
"The login may only contain Latin letters, digits, dots, hyphens or underscores."
],
[
"Изучай цифровое искусство, NFT и технологии. Получай опыт и открывай новые знания.",
"Study digital art, NFTs and technology. Earn experience and unlock new knowledge."
],
[
"Этот урок уже завершён. Ты можешь повторить тест, но опыт повторно не начисляется.",
"This lesson is already completed. You can retake the quiz, but XP is not awarded again."
],
[
"Правильно. Сохранение файла или макета в приложении не создаёт токен в блокчейне.",
"Right. Saving a file or mockup in an app does not create a token on a blockchain."
],
[
"Привет! Я Наставник CRYSTALIS. Задай вопрос — постараюсь помочь. О чём поговорим?",
"Hi! I'm the CRYSTALIS Mentor. Ask a question and I'll do my best to help. What shall we talk about?"
],
[
"Друзей пока нет. Найди участника ниже и добавь его — он сохранится в этом списке.",
"No friends yet. Find a member below and add them — they will be saved in this list."
],
[
"Верно. Права определяются лицензией, договором и применимым законодательством.",
"Correct. Rights are determined by the license, the agreement and applicable law."
],
[
"После регистрации твои текущие работы и прогресс привяжутся к новому аккаунту.",
"After signing up, your current artworks and progress will be linked to the new account."
],
[
"Помогает разбираться в учёбе, технологиях, творчестве и повседневных вопросах",
"Helps with studying, technology, creativity and everyday questions"
],
[
"Нажимай на появляющиеся кристаллы до истечения таймера! Награда за уровень: +",
"Tap the crystals as they appear before the timer runs out! Level reward: +"
],
[
"(например: 500 чтобы начислить, или =1000 чтобы установить точный баланс):",
"(for example: 500 to add, or =1000 to set an exact balance):"
],
[
"Pollinations сейчас недоступен — будут использованы локальные подсказки.",
"Pollinations is unavailable right now — local hints will be used."
],
[
"Например: сияющий кристалл в фантастическом космосе, фиолетовый туман...",
"For example: a glowing crystal in a fantasy space, purple mist..."
],
[
"ERC-1155 позволяет управлять множеством типов токенов в одном контракте",
"ERC-1155 lets you manage many token types in one contract"
],
[
"Плата за обработку операции в блокчейне, если она предусмотрена сетью.",
"A charge for processing an operation on a blockchain, if the network provides for one."
],
[
"Распределённый реестр записей, связанных криптографическими методами.",
"A distributed ledger of records linked by cryptographic methods."
],
[
"В чём ключевое архитектурное отличие стандарта ERC-1155 от ERC-721?",
"What is the key architectural difference between ERC-1155 and ERC-721?"
],
[
"Не удалось сохранить. Попробуй выбрать фотографию меньшего размера.",
"Could not save. Try choosing a smaller photo."
],
[
"Да. На комиссию влияют правила конкретной сети и текущая нагрузка.",
"Yes. The fee is affected by the rules of the specific network and the current load."
],
[
"Изучай, как устроены записи и транзакции в распределённом реестре.",
"Learn how records and transactions work in a distributed ledger."
],
[
"Это личная витрина. Покупки, продажи и платежи пока не подключены.",
"This is a personal showcase. Purchases, sales and payments are not connected yet."
],
[
"Войди, чтобы загрузить свои работы, коллекции и прогресс обучения.",
"Sign in to load your artworks, collections and learning progress."
],
[
"Слэшинг (штрафное списание части застейканных средств валидатора)",
"Slashing (a penalty deduction of part of the validator's staked funds)"
],
[
"Играй в аркады и зарабатывай Сойн за рекорды и пройденные уровни.",
"Play arcade games and earn Soin for records and completed levels."
],
[
"Инструмент для управления ключами и взаимодействия с блокчейном.",
"A tool for managing keys and interacting with a blockchain."
],
[
"Означает ли покупка NFT автоматическую передачу авторских прав?",
"Does buying an NFT automatically transfer copyright?"
],
[
"Снимок — все данные участников одним файлом. Положи его в папку",
"A snapshot is all member data in one file. Put it in the project folder"
],
[
"Картинка не подходит: нужен JPEG, PNG, WebP или GIF до 400 КБ.",
"Image not suitable: a JPEG, PNG, WebP or GIF up to 400 KB is required."
],
[
"Подготовь текстовый запрос для будущего создания изображения.",
"Prepare a text prompt for future image creation."
],
[
"Общий чат для всех участников и личные переписки с друзьями.",
"A global chat for all members and private conversations with friends."
],
[
"Не удалось проверить сервис. Доступны встроенные подсказки.",
"Could not check the service. Built-in hints are available."
],
[
"Хеш изменится полностью и непредсказуемо (лавинный эффект)",
"The hash will change completely and unpredictably (avalanche effect)"
],
[
"ERC-1155 не поддерживает передачу токенов между кошельками",
"ERC-1155 does not support transferring tokens between wallets"
],
[
"Невзаимозаменяемый токен — уникальная запись в блокчейне.",
"Non-fungible token — a unique record on a blockchain."
],
[
"Этот логин зарезервирован. Войди с ним на вкладке «Вход».",
"This login is reserved. Sign in with it on the “Sign in” tab."
],
[
"Скачивание снимка доступно только главному разработчику.",
"Snapshot download is available only to the main developer."
],
[
"JSON: artworks, collections, learning. Правь осторожно.",
"JSON: artworks, collections, learning. Edit carefully."
],
[
"Хеш останется прежним, если размер файла не изменился",
"The hash will stay the same if the file size has not changed"
],
[
"4. После подтверждения запись появляется в блокчейне.",
"4. After confirmation the record appears on the blockchain."
],
[
"Восстановление доступно только главному разработчику.",
"Restoring is available only to the main developer."
],
[
"Оформи цифровую работу и сохрани её в своей галерее.",
"Design a digital artwork and save it to your gallery."
],
[
"Личный аккаунт участника, синхронизация и настройки.",
"Your member account, sync and settings."
],
[
"Версия 1.9 · Аккаунты участников · Боковая навигация",
"Version 1.9 · Member accounts · Side navigation"
],
[
"Нельзя заблокировать себя или главного разработчика.",
"You cannot ban yourself or the main developer."
],
[
"Подумай над материалом урока и выбери другой ответ.",
"Think about the lesson material and choose a different answer."
],
[
"Поиск, фильтры, избранное и управление твоими NFT.",
"Search, filters, favorites and management of your NFTs."
],
[
"Сервер недоступен — используются локальные данные.",
"Server unavailable — using local data."
],
[
"Войди в аккаунт разработчика во вкладке «Профиль».",
"Sign in to the developer account on the “Profile” tab."
],
[
"Яндекс Диск: неверный логин или пароль приложения.",
"Yandex Disk: wrong login or app password."
],
[
"Сумма перевода должна быть от 1 до 1 000 000 Сойн.",
"The transfer amount must be between 1 and 1,000,000 Soin."
],
[
"Нельзя менять роль себе или главному разработчику.",
"You cannot change the role of yourself or the main developer."
],
[
"Выбери игру выше, чтобы начать и заработать Сойн!",
"Choose a game above to start and earn Soin!"
],
[
"Проходи сложные уроки по блокчейну и криптографии",
"Complete advanced lessons on blockchain and cryptography"
],
[
"Пользователь с таким логином уже зарегистрирован.",
"A user with this login is already registered."
],
[
"Сменить никнейм можно раз в 7 дней. Осталось дн.:",
"You can change your display name once every 7 days. Days left:"
],
[
"Когда цифровая работа становится выпущенным NFT?",
"When does a digital artwork become a minted NFT?"
],
[
"Поможет разобраться в уроках, терминах и ошибках",
"Helps with lessons, terms and mistakes"
],
[
"— и на любом новом сайте данные подтянутся сами.",
"— and on any new site the data will load by itself."
],
[
"Выставляй свои NFT на продажу и покупай чужие за",
"List your NFTs for sale and buy others' for"
],
[
"В галерее пока нет работ, которые можно продать.",
"You have no artworks in your gallery that can be sold yet."
],
[
"Объясни искусственный интеллект простыми словами",
"Explain artificial intelligence in simple words"
],
[
"Составь план изучения цифрового искусства с нуля",
"Make a study plan for digital art from scratch"
],
[
"Создавай. Исследуй. Открывай новые возможности.",
"Create. Explore. Discover new possibilities."
],
[
"Пройди первый урок, чтобы получить первый опыт.",
"Complete your first lesson to earn your first XP."
],
[
"Твой ИИ-помощник для вопросов, обучения и идей.",
"Your AI assistant for questions, learning and ideas."
],
[
"Лотов пока нет. Будь первым — выставь свой NFT!",
"No listings yet. Be the first — list your NFT!"
],
[
"Смарт-контракты и стандарты ERC-721 / ERC-1155",
"Smart contracts and the ERC-721 / ERC-1155 standards"
],
[
"Предварительный просмотр твоих цифровых работ.",
"A preview of your digital artworks."
],
[
"Сначала создай работу в разделе «Создать NFT».",
"First create an artwork in the “Create NFT” section."
],
[
"Удалить коллекцию? Работы останутся в галерее.",
"Delete the collection? The artworks will stay in the gallery."
],
[
"Нельзя выставить больше 30 лотов одновременно.",
"You cannot list more than 30 items at once."
],
[
"Распределённые записи о событиях и операциях",
"Distributed records of events and operations"
],
[
"ERC-721 работает только без смарт-контрактoв",
"ERC-721 works only without smart contracts"
],
[
"Каждое достижение имеет 5 уровней прогресса.",
"Every achievement has 5 progress levels."
],
[
"Загрузи изображение и оформи цифровую работу",
"Upload an image and design a digital artwork"
],
[
"Подготовка запросов для создания изображений",
"Prepare prompts for creating images"
],
[
"Создавай тематические подборки своих работ.",
"Build themed sets of your artworks."
],
[
"Яндекс Диск: не удалось загрузить файл (код",
"Yandex Disk: could not upload the file (code"
],
[
"Логин должен содержать от 3 до 32 символов.",
"The login must be 3 to 32 characters long."
],
[
"Задавай вопросы и получай учебные подсказки",
"Ask questions and get study hints"
],
[
"Яндекс Диск: не удалось создать папку (код",
"Yandex Disk: could not create the folder (code"
],
[
"Пароль должен содержать минимум 4 символа.",
"The password must be at least 4 characters long."
],
[
"Аватар должен быть изображением до 250 КБ.",
"The avatar must be an image up to 250 KB."
],
[
"CRYSTALIS • ПЛАТФОРМА ЦИФРОВОГО ИСКУССТВА",
"CRYSTALIS • DIGITAL ART PLATFORM"
],
[
"Объединяй работы в тематические коллекции",
"Group artworks into themed collections"
],
[
"Изучай NFT, блокчейн и цифровую экономику",
"Learn about NFTs, blockchain and the digital economy"
],
[
"Увеличение сложности хеширования SHA-256",
"Increasing the SHA-256 hashing difficulty"
],
[
"Общайся с другими участниками CRYSTALIS.",
"Chat with other CRYSTALIS members."
],
[
"Картинка слишком тяжёлая, выбери другую.",
"The image is too heavy, choose another one."
],
[
"Войди в аккаунт, чтобы смотреть профили.",
"Sign in to view profiles."
],
[
"Цена должна быть от 1 до 1 000 000 Сойн.",
"The price must be between 1 and 1,000,000 Soin."
],
[
"Криптографическое хеширование и SHA-256",
"Cryptographic hashing and SHA-256"
],
[
"Высокое качество цифрового изображения.",
"High-quality digital image."
],
[
"Твой баланс — открыть торговую площадку",
"Your balance — open the marketplace"
],
[
"Имя должно содержать минимум 2 символа.",
"The name must be at least 2 characters long."
],
[
"Узнай, как устроены цифровые транзакции",
"Find out how digital transactions work"
],
[
"Общий чат и личные переписки с друзьями",
"Global chat and private conversations with friends"
],
[
"Объясни, что такое NFT простыми словами",
"Explain what an NFT is in simple words"
],
[
"Изменится только последний символ хеша",
"Only the last character of the hash will change"
],
[
"Ручная модерация администраторами сети",
"Manual moderation by network administrators"
],
[
"Здесь общаются все участники CRYSTALIS",
"All CRYSTALIS members chat here"
],
[
"Проходи уровни в Кристальном лабиринте",
"Clear levels in the Crystal Maze"
],
[
"Собирай работы в тематические подборки",
"Gather artworks into themed sets"
],
[
"От чего может зависеть комиссия сети?",
"What can a network fee depend on?"
],
[
"Pollinations: экспериментальный режим",
"Pollinations: experimental mode"
],
[
"Не удалось обновить данные с сервера.",
"Could not refresh data from the server."
],
[
"Участники, роли, контент и сообщения.",
"Members, roles, content and messages."
],
[
"Пока тишина. Напиши первое сообщение!",
"Nothing here yet. Write the first message!"
],
[
"Накопи капитал внутренней валюты Сойн",
"Accumulate a fortune in the Soin in-app currency"
],
[
"Нельзя добавить в друзья самого себя.",
"You cannot add yourself as a friend."
],
[
"Как работает блокчейн? Приведи пример",
"How does a blockchain work? Give an example"
],
[
"Уникальные токены и цифровые объекты",
"Unique tokens and digital objects"
],
[
"Пароли пользователей в открытом виде",
"Users' passwords in plain text"
],
[
"Авторские права и цифровое искусство",
"Copyright and digital art"
],
[
"Нет, это зависит от условий и закона",
"No, it depends on the terms and the law"
],
[
"Механизмы консенсуса: PoW против PoS",
"Consensus mechanisms: PoW vs PoS"
],
[
"Выбери изображение размером до 5 МБ.",
"Choose an image up to 5 MB."
],
[
"Процесс выпуска токена в блокчейне.",
"The process of issuing a token on a blockchain."
],
[
"Наставник объяснит тему этого урока",
"The Mentor will explain this lesson's topic"
],
[
"1. Пользователь формирует операцию.",
"1. The user creates an operation."
],
[
"Создавай NFT-работы в своей галерее",
"Create NFT artworks in your gallery"
],
[
"Набирай очки в игре Crystalis Jump",
"Score points in Crystalis Jump"
],
[
"Лот уже продан или снят с продажи.",
"The listing has already been sold or removed."
],
[
"Нельзя перевести Сойн самому себе.",
"You cannot send Soin to yourself."
],
[
"После создания токена в блокчейне",
"After a token is created on the blockchain"
],
[
"Спросить наставника об этом уроке",
"Ask the Mentor about this lesson"
],
[
"(Ответ из встроенной базы знаний)",
"(Answer from the built-in knowledge base)"
],
[
"Данные аккаунта синхронизированы!",
"Account data synced!"
],
[
"Копия на Яндекс Диске не найдена.",
"No backup found on Yandex Disk."
],
[
"Просматривай свои цифровые работы",
"Browse your digital artworks"
],
[
"Подтверждение доступа и личности",
"Access and identity verification"
],
[
"Что нельзя сообщать посторонним?",
"What must never be shared with others?"
],
[
"Раздел только для разработчиков.",
"This section is for developers only."
],
[
"Файл слишком большой (до 20 МБ).",
"File is too large (up to 20 MB)."
],
[
"Расскажи историю своей работы...",
"Tell the story of your artwork..."
],
[
"Как связаны блоки и записи сети",
"How blocks and network records connect"
],
[
"Адреса, ключи и цифровые активы",
"Addresses, keys and digital assets"
],
[
"＋ Выбрать фотографию из галереи",
"＋ Choose a photo from your device"
],
[
"Пока неверно. Попробуй ещё раз.",
"Not quite yet. Try again."
],
[
"Не удалось открыть изображение.",
"Could not open the image."
],
[
"💎 Кристальный лабиринт (Уровни)",
"💎 Crystal Maze (Levels)"
],
[
"Яндекс Диск: ошибка чтения (код",
"Yandex Disk: read error (code"
],
[
"Что лучше всего описывает NFT?",
"What best describes an NFT?"
],
[
"Секретную фразу восстановления",
"The secret recovery phrase"
],
[
"Сначала выбери вариант ответа.",
"Choose an answer first."
],
[
"Логин (латиница, цифры, _ . -)",
"Login (Latin letters, digits, _ . -)"
],
[
"Сообщения видят все участники.",
"All members can see the messages."
],
[
"✦ Вышла новая версия CRYSTALIS",
"✦ A new version of CRYSTALIS is out"
],
[
"У этого участника пока нет NFT",
"This member has no NFTs yet"
],
[
"NFT не найден в твоей галерее.",
"NFT not found in your gallery."
],
[
"Нельзя купить собственный лот.",
"You cannot buy your own listing."
],
[
"Поиск по названию или тегам...",
"Search by title or tags..."
],
[
"Защита ключей и личных данных",
"Protecting keys and personal data"
],
[
"Изучение записей и транзакций",
"Exploring records and transactions"
],
[
"Когда её сохранили в телефоне",
"When it is saved on a phone"
],
[
"Да, если изображение красивое",
"Yes, if the image is beautiful"
],
[
"фиолетовый, кристалл, фэнтези",
"purple, crystal, fantasy"
],
[
"Имя или логин (от 2 символов)",
"Name or login (2+ characters)"
],
[
"Выбрать фотографию из галереи",
"Choose a photo from your device"
],
[
"Уникальный токен в блокчейне",
"A unique token on a blockchain"
],
[
"◇ Следующая награда: 3 урока",
"◇ Next reward: 3 lessons"
],
[
"Наставник обдумывает вопрос…",
"The Mentor is thinking about the question…"
],
[
"Загрузить / сменить аватарку",
"Upload / change picture"
],
[
"Экспортировать данные (JSON)",
"Export data (JSON)"
],
[
"Кому (all — всем, или логин)",
"To (all — everyone, or a login)"
],
[
"Искатель кристаллов (Уровни)",
"Crystal Seeker (Levels)"
],
[
"Некорректные данные запроса.",
"Invalid request data."
],
[
"Этот аккаунт удалить нельзя.",
"This account cannot be deleted."
],
[
"Вышла новая версия CRYSTALIS",
"A new version of CRYSTALIS is out"
],
[
"Оформи свою цифровую работу",
"Design your digital artwork"
],
[
"Связь технологий и проектов",
"Connecting technologies and projects"
],
[
"уроков. Продолжай обучение!",
"lessons. Keep learning!"
],
[
"3. Сеть проверяет операцию.",
"3. The network verifies the operation."
],
[
"Работа сохранена в галерее!",
"Artwork saved to the gallery!"
],
[
"Готово: сохранено записей —",
"Done: records saved —"
],
[
"Введи количество Сойн для @",
"Enter the amount of Soin for @"
],
[
"Например, Кристальные мечты",
"E.g. Crystal Dreams"
],
[
"Листай галерею и коллекции",
"Browse galleries and collections"
],
[
"Не удалось получить ответ:",
"Could not get an answer:"
],
[
"2. Кошелёк подписывает её.",
"2. The wallet signs it."
],
[
"Сначала опиши изображение.",
"Describe the image first."
],
[
"Неверный логин или пароль.",
"Wrong login or password."
],
[
"Не удалось прочитать файл.",
"Could not read the file."
],
[
"Нельзя писать самому себе.",
"You cannot message yourself."
],
[
"Например, Кристальные миры",
"E.g. Crystal Worlds"
],
[
"Фотография ещё не выбрана",
"No photo selected yet"
],
[
"От нагрузки и правил сети",
"On network load and rules"
],
[
"Введи название коллекции.",
"Enter the collection name."
],
[
"» теперь в твоей галерее.",
"” is now in your gallery."
],
[
"Покупай и продавай NFT за",
"Buy and sell NFTs for"
],
[
"NFT выставлен на продажу!",
"NFT listed for sale!"
],
[
"Недостаточно Сойн: у тебя",
"Not enough Soin: you have"
],
[
"Напиши вопрос Наставнику.",
"Write a question for the Mentor."
],
[
"Проверка блокчейн-записей",
"Verifying blockchain records"
],
[
"Связанные блоки блокчейна",
"Linked blockchain blocks"
],
[
"Продавай и покупай NFT за",
"Sell and buy NFTs for"
],
[
"СОЗДАЙ СВОЙ ЦИФРОВОЙ МИР",
"CREATE YOUR DIGITAL WORLD"
],
[
"NFT и цифровые коллекции",
"NFTs and digital collections"
],
[
"Опыт, награды и прогресс",
"Experience, rewards and progress"
],
[
"Обычный файл изображения",
"An ordinary image file"
],
[
"Что такое выпуск (Mint)?",
"What is minting (Mint)?"
],
[
"Начинающий исследователь",
"Novice explorer"
],
[
"Синхронизация с сервером",
"Server sync"
],
[
"Выбери файл изображения.",
"Choose an image file."
],
[
". Автокопия — раз в час.",
". Auto-backup — once an hour."
],
[
"вместе со всеми данными?",
"along with all its data?"
],
[
"Введи минимум 2 символа.",
"Enter at least 2 characters."
],
[
"Покупка завершена! NFT «",
"Purchase complete! NFT “"
],
[
"ВЫСТАВИТЬ NFT НА ПРОДАЖУ",
"LIST AN NFT FOR SALE"
],
[
"Покоритель вершин (Jump)",
"Peak Conqueror (Jump)"
],
[
"CRYSTALIS — цифровой мир",
"CRYSTALIS — digital world"
],
[
"Скрыть или показать меню",
"Hide or show menu"
],
[
"Яндекс Диск не настроен.",
"Yandex Disk is not configured."
],
[
"добавил(а) тебя в друзья",
"added you as a friend"
],
[
"Лот недоступен и удалён.",
"The listing is unavailable and has been removed."
],
[
"Новые знания и практика",
"New knowledge and practice"
],
[
"Как проходит транзакция",
"How a transaction works"
],
[
"Транзакции: отсутствуют",
"Transactions: none"
],
[
"(можно изменить сейчас)",
"(can be changed now)"
],
[
"✓ Вы вышли из аккаунта.",
"✓ You have signed out."
],
[
"Заполни логин и пароль.",
"Enter your login and password."
],
[
"Ошибка последней копии:",
"Last backup error:"
],
[
"Игровой центр CRYSTALIS",
"CRYSTALIS Game Center"
],
[
"Это не копия CRYSTALIS.",
"This is not a CRYSTALIS backup."
],
[
"Пользователь не найден.",
"User not found."
],
[
"Укажи логин получателя.",
"Enter the recipient's login."
],
[
"Напиши текст сообщения.",
"Write the message text."
],
[
"Метод не поддерживается",
"Method not supported"
],
[
"Покупай и продавай NFT",
"Buy and sell NFTs"
],
[
"Как работает блокчейн?",
"How does a blockchain work?"
],
[
"Введи название работы.",
"Enter the artwork title."
],
[
"Такой логин уже занят.",
"This login is already taken."
],
[
"☁ Облако (Яндекс Диск)",
"☁ Cloud (Yandex Disk)"
],
[
"Восстановлено записей:",
"Records restored:"
],
[
"ПЕРЕВОД СОЙН УЧАСТНИКУ",
"SEND SOIN TO A MEMBER"
],
[
"Укажи цену — минимум 1",
"Enter a price — minimum 1"
],
[
"Требуется авторизация.",
"Authorization required."
],
[
"Не хватает Сойн: нужно",
"Not enough Soin: need"
],
[
"Защита цифровых данных",
"Digital data protection"
],
[
"Цифровая идентификация",
"Digital identification"
],
[
"Цифровая идентичность",
"Digital identity"
],
[
"Криптокошелёк и ключи",
"Crypto wallet and keys"
],
[
"Когда добавили фильтр",
"When a filter is added"
],
[
"Комиссии и транзакции",
"Fees and transactions"
],
[
"От названия коллекции",
"On the name of the collection"
],
[
"◇ Полный курс впереди",
"◇ The full course lies ahead"
],
[
"Проверяю доступность…",
"Checking availability…"
],
[
"Состояние подключения",
"Connection status"
],
[
"Кошелёк: не подключён",
"Wallet: not connected"
],
[
"(смена доступна через",
"(change available in"
],
[
"Восстановить из копии",
"Restore from backup"
],
[
"Уведомлений пока нет.",
"No notifications yet."
],
[
"Файл копии повреждён.",
"The backup file is corrupted."
],
[
"Введи логин и пароль.",
"Enter a login and password."
],
[
"Аккаунт заблокирован.",
"This account is banned."
],
[
"Получатель не найден.",
"Recipient not found."
],
[
"Сделать разработчиком",
"Make developer"
],
[
"Цифровой NFT-кристалл",
"Digital NFT crystal"
],
[
"Иллюстрация блокчейна",
"Blockchain illustration"
],
[
"Художественный стиль",
"Art style"
],
[
"Что хранит блокчейн?",
"What does a blockchain store?"
],
[
"От цвета изображения",
"On the color of the image"
],
[
"✦ Первый урок открыт",
"✦ First lesson unlocked"
],
[
"✦ Три урока пройдены",
"✦ Three lessons completed"
],
[
"✦ Академия завершена",
"✦ Academy completed"
],
[
"Состояние Наставника",
"Mentor status"
],
[
"Отображаемый никнейм",
"Display name"
],
[
"Пароли не совпадают.",
"Passwords do not match."
],
[
"Сделать копию сейчас",
"Back up now"
],
[
"Скачать снимок (.gz)",
"Download snapshot (.gz)"
],
[
"Личная переписка · @",
"Private chat · @"
],
[
"Картинка прикреплена",
"Image attached"
],
[
"Выставить на продажу",
"List for sale"
],
[
"Укажи логин и сумму.",
"Enter a login and an amount."
],
[
"Имя и коллекция NFT.",
"Name and NFT collection."
],
[
"Достижения CRYSTALIS",
"CRYSTALIS Achievements"
],
[
"Некорректный запрос.",
"Invalid request."
],
[
"Картинка не найдена.",
"Image not found."
],
[
"Не указан ID работы.",
"Artwork ID not specified."
],
[
"Нужно подтверждение.",
"Confirmation required."
],
[
"Метод API не найден.",
"API method not found."
],
[
"О чём эта коллекция?",
"What is this collection about?"
],
[
"Цифровая экосистема",
"Digital ecosystem"
],
[
"＋ Создать коллекцию",
"＋ Create collection"
],
[
"Сформировать запрос",
"Build prompt"
],
[
"Наставник CRYSTALIS",
"CRYSTALIS Mentor"
],
[
"Иллюстрация к уроку",
"Lesson illustration"
],
[
"Продолжить обучение",
"Continue learning"
],
[
"Сеть: не подключена",
"Network: not connected"
],
[
"Удалить эту работу?",
"Delete this artwork?"
],
[
"Панель разработчика",
"Developer panel"
],
[
"Копий пока не было.",
"No backups yet."
],
[
"Картинка недоступна",
"Image unavailable"
],
[
"купил(а) твой NFT «",
"bought your NFT “"
],
[
"Прикрепить картинку",
"Attach an image"
],
[
"Задай любой вопрос…",
"Ask any question…"
],
[
"например, alex_2026",
"e.g. alex_2026"
],
[
"Аркады и награды в",
"Arcades and rewards in"
],
[
"Цифровое искусство",
"Digital art"
],
[
"Работы не найдены.",
"No artworks found."
],
[
"Название коллекции",
"Collection name"
],
[
"Коллекций пока нет",
"No collections yet"
],
[
"Трёхмерная графика",
"3D graphics"
],
[
"Любая криптовалюта",
"Any cryptocurrency"
],
[
"Название блокчейна",
"Blockchain name"
],
[
"Академия CRYSTALIS",
"CRYSTALIS Academy"
],
[
"уроков завершено ·",
"lessons completed ·"
],
[
"ПРОГРАММА ОБУЧЕНИЯ",
"CURRICULUM"
],
[
"Обновить с сервера",
"Refresh from server"
],
[
"Запрос скопирован.",
"Prompt copied."
],
[
"Ошибка регистрации",
"Registration error"
],
[
"проекта под именем",
"under the name"
],
[
"(Текущий прогресс:",
"(Current progress:"
],
[
"Заставка CRYSTALIS",
"CRYSTALIS intro"
],
[
"Новое сообщение от",
"New message from"
],
[
"Новые сообщения от",
"New messages from"
],
[
"Недостаточно прав.",
"Insufficient permissions."
],
[
"Минимум 2 символа.",
"At least 2 characters."
],
[
"ТВОЙ ЦИФРОВОЙ МИР",
"YOUR DIGITAL WORLD"
],
[
"Твой цифровой мир",
"Your digital world"
],
[
"Название работы *",
"Artwork title *"
],
[
"Удалить коллекцию",
"Delete collection"
],
[
"Опиши изображение",
"Describe the image"
],
[
"· Аккаунт активен",
"· Account active"
],
[
"Выйти из аккаунта",
"Sign out"
],
[
"Например, Алексей",
"E.g. Alex"
],
[
"Твоя статистика (",
"Your stats ("
],
[
"Аккаунт подключён",
"Account connected"
],
[
"Копировать запрос",
"Copy prompt"
],
[
"Удалить аккаунт @",
"Delete account @"
],
[
"Некорректный JSON",
"Invalid JSON"
],
[
"Перейти в профиль",
"Go to profile"
],
[
"Торговая площадка",
"Marketplace"
],
[
"Перевод выполнен!",
"Transfer completed!"
],
[
"Профиль участника",
"Member profile"
],
[
"Следующий уровень",
"Next level"
],
[
"Попробовать снова",
"Try again"
],
[
"Куратор коллекций",
"Collection Curator"
],
[
"Напиши сообщение.",
"Write a message."
],
[
"Никнейм обновлён!",
"Display name updated!"
],
[
"Напиши сообщение…",
"Write a message…"
],
[
"Минимум 4 символа",
"At least 4 characters"
],
[
"Цифровое обучение",
"Digital learning"
],
[
"Создать коллекцию",
"Create collection"
],
[
"был(а) только что",
"last seen just now"
],
[
"Редкость (макет)",
"Rarity (mockup)"
],
[
"Сохранить работу",
"Save artwork"
],
[
"Сбросить фильтры",
"Reset filters"
],
[
"СЛОВАРЬ ТЕРМИНОВ",
"GLOSSARY"
],
[
"Знаток CRYSTALIS",
"CRYSTALIS Expert"
],
[
"Аватарка профиля",
"Profile picture"
],
[
"Работ в галерее:",
"Artworks in gallery:"
],
[
"Пройдено уроков:",
"Lessons completed:"
],
[
"Последняя копия:",
"Last backup:"
],
[
"Баланс обновлён!",
"Balance updated!"
],
[
"Никого не нашли.",
"Nobody found."
],
[
"ЛОТЫ НА ПЛОЩАДКЕ",
"MARKETPLACE LISTINGS"
],
[
"· на платформе с",
"· on the platform since"
],
[
"УРОВНЕЙ ПРОЙДЕНО",
"LEVELS COMPLETED"
],
[
"Магистр Академии",
"Academy Master"
],
[
"Это не твой лот.",
"This is not your listing."
],
[
"Логин получателя",
"Recipient's login"
],
[
"Кубок достижений",
"Achievement trophy"
],
[
"NFT В БЛОКЧЕЙНЕ",
"NFTs ON THE BLOCKCHAIN"
],
[
"Проверка данных",
"Data verification"
],
[
"Свойства и теги",
"Properties and tags"
],
[
"Только картинки",
"Only pictures"
],
[
"Публичный адрес",
"Public address"
],
[
"Смарт-контракты",
"Smart contracts"
],
[
"Пример из жизни",
"Real-life example"
],
[
"Проверить ответ",
"Check answer"
],
[
"Очистить диалог",
"Clear conversation"
],
[
"Войти в аккаунт",
"Sign in to account"
],
[
"Создать аккаунт",
"Create account"
],
[
"Журнал действий",
"Activity log"
],
[
"Папка на Диске:",
"Folder on the Disk:"
],
[
"Сообщение для @",
"Message for @"
],
[
"НАЙТИ УЧАСТНИКА",
"FIND A MEMBER"
],
[
"Снять с продажи",
"Remove from sale"
],
[
"Цифровой творец",
"Digital Creator"
],
[
"перевёл(а) тебе",
"sent you"
],
[
"Убрать картинку",
"Remove image"
],
[
"Текст сообщения",
"Message text"
],
[
"Очистить форму",
"Clear form"
],
[
"Любая редкость",
"Any rarity"
],
[
"Создать работу",
"Create artwork"
],
[
"Что такое NFT?",
"What is an NFT?"
],
[
"Смарт-контракт",
"Smart contract"
],
[
"Повтори пароль",
"Repeat password"
],
[
"Гостевой режим",
"Guest mode"
],
[
"Готовый запрос",
"Ready prompt"
],
[
"Синхронизация…",
"Syncing…"
],
[
"Перевести Сойн",
"Send Soin"
],
[
"Игра окончена!",
"Game over!"
],
[
"⏰ Время вышло!",
"⏰ Time's up!"
],
[
"Лот не найден.",
"Listing not found."
],
[
"Разблокировать",
"Unban"
],
[
"МИР CRYSTALIS",
"THE WORLD OF CRYSTALIS"
],
[
"Криптокошелёк",
"Crypto wallet"
],
[
"Игровой центр",
"Game center"
],
[
"Без коллекции",
"No collection"
],
[
"Все категории",
"All categories"
],
[
"♥ Избранное (",
"♥ Favorites ("
],
[
"♥ В избранном",
"♥ Favorited"
],
[
"♡ В избранное",
"♡ Add to favorites"
],
[
"Твой прогресс",
"Your progress"
],
[
"Комиссия сети",
"Network fee"
],
[
"Мастер знаний",
"Master of knowledge"
],
[
"Нужна помощь?",
"Need help?"
],
[
"План обучения",
"Study plan"
],
[
"Что такое ИИ?",
"What is AI?"
],
[
"Ошибка ответа",
"Response error"
],
[
"Имя участника",
"Member name"
],
[
"Доступ закрыт",
"Access denied"
],
[
"Показать меню",
"Show menu"
],
[
"Начать заново",
"Start over"
],
[
"Заблокировать",
"Ban"
],
[
"Безопасность",
"Security"
],
[
"Криптография",
"Cryptography"
],
[
"Проверь себя",
"Test yourself"
],
[
"Русский язык",
"English language"
],
[
"Ошибка входа",
"Sign-in error"
],
[
"· коллекций:",
"· collections:"
],
[
"ЗАБЛОКИРОВАН",
"BANNED"
],
[
"был(а) давно",
"last seen long ago"
],
[
"· Награда: +",
"· Reward: +"
],
[
"Собрано: 0 /",
"Collected: 0 /"
],
[
"Нет доступа.",
"Access denied."
],
[
"Без описания",
"No description"
],
[
"Отправляется",
"Sending"
],
[
"Время вышло!",
"Time's up!"
],
[
"Например, 25",
"E.g. 25"
],
[
"Разработчик",
"Developer"
],
[
"ВОЗМОЖНОСТИ",
"FEATURES"
],
[
"Создать NFT",
"Create NFT"
],
[
"Изображение",
"Image"
],
[
"Легендарная",
"Legendary"
],
[
"Моя галерея",
"My gallery"
],
[
"Продвинутый",
"Advanced"
],
[
"Архитектура",
"Architecture"
],
[
"Ты завершил",
"You completed"
],
[
"← Все уроки",
"← All lessons"
],
[
"Регистрация",
"Sign up"
],
[
"Участники (",
"Members ("
],
[
"Отправлено.",
"Sent."
],
[
"РАЗРАБОТЧИК",
"DEVELOPER"
],
[
"В друзьях ✓",
"Friends ✓"
],
[
"Скрыть меню",
"Hide menu"
],
[
"РЕКОРД JUMP",
"JUMP RECORD"
],
[
"Магнат Сойн",
"Soin Tycoon"
],
[
"Уведомления",
"Notifications"
],
[
"Картинка от",
"Image from"
],
[
"Твоя работа",
"Your artwork"
],
[
"Пропустить",
"Skip"
],
[
"Достижения",
"Achievements"
],
[
"Фотография",
"Photography"
],
[
"Абстракция",
"Abstract"
],
[
"Продать за",
"Sell for"
],
[
"Минимализм",
"Minimalism"
],
[
"Технологии",
"Technology"
],
[
"Творчество",
"Creativity"
],
[
"Да, всегда",
"Yes, always"
],
[
"ДОСТИЖЕНИЯ",
"ACHIEVEMENTS"
],
[
"Первый шаг",
"First step"
],
[
"Коллекций:",
"Collections:"
],
[
"· записей:",
"· records:"
],
[
"неизвестно",
"unknown"
],
[
"Сохранено.",
"Saved."
],
[
"из друзей?",
"from friends?"
],
[
"＋ В друзья",
"＋ Add friend"
],
[
"← Все чаты",
"← All chats"
],
[
"МОИХ ЛОТОВ",
"MY LISTINGS"
],
[
"Публикуем…",
"Publishing…"
],
[
"НА ПРОДАЖЕ",
"FOR SALE"
],
[
"ЗАРАБОТАНО",
"EARNED"
],
[
"Награда: +",
"Reward: +"
],
[
", на счёте",
", you have"
],
[
"Доставлено",
"Delivered"
],
[
"Снять роль",
"Remove role"
],
[
"Сумма Сойн",
"Soin amount"
],
[
"Коллекции",
"Collections"
],
[
"Студия ИИ",
"AI Studio"
],
[
"Наставник",
"Mentor"
],
[
"КОЛЛЕКЦИИ",
"COLLECTIONS"
],
[
"Категория",
"Category"
],
[
"Необычная",
"Uncommon"
],
[
"Эпическая",
"Epic"
],
[
"Коллекция",
"Collection"
],
[
"Начальный",
"Beginner"
],
[
"◇ Новичок",
"◇ Newcomer"
],
[
"Отправить",
"Send"
],
[
"Сохранить",
"Save"
],
[
"Создание…",
"Creating…"
],
[
"Сообщения",
"Messages"
],
[
"Загрузка…",
"Loading…"
],
[
"Сообщение",
"Message"
],
[
"Проверяю…",
"Checking…"
],
[
"(копия от",
"(backup from"
],
[
"Общий чат",
"Global chat"
],
[
"💎 Уровень",
"💎 Level"
],
[
"🎉 Уровень",
"🎉 Level"
],
[
"Прочитано",
"Read"
],
[
"БЕТА 1.9",
"BETA 1.9"
],
[
"Обучение",
"Learn"
],
[
"Блокчейн",
"Blockchain"
],
[
"Создавай",
"Create"
],
[
"Исследуй",
"Explore"
],
[
"Открывай",
"Discover"
],
[
"Описание",
"Description"
],
[
"Создание",
"Creation"
],
[
"10 минут",
"10 minutes"
],
[
"11 минут",
"11 minutes"
],
[
"Верно! +",
"Correct! +"
],
[
"Написать",
"Message"
],
[
"Копирую…",
"Backing up…"
],
[
"Данные @",
"Data of @"
],
[
"УЧАСТНИК",
"MEMBER"
],
[
"печатает",
"typing"
],
[
"Убрать @",
"Remove @"
],
[
"Картинка",
"Image"
],
[
"Обновить",
"Update"
],
[
"Купить «",
"Buy “"
],
[
"НА СЧЁТЕ",
"ON ACCOUNT"
],
[
"Собрано:",
"Collected:"
],
[
"пройден!",
"completed!"
],
[
"Главная",
"Home"
],
[
"Создать",
"Create"
],
[
"Галерея",
"Gallery"
],
[
"Витрина",
"Showcase"
],
[
"Профиль",
"Profile"
],
[
"◇ Войти",
"◇ Sign in"
],
[
"Фэнтези",
"Fantasy"
],
[
"Обычная",
"Common"
],
[
"Удалить",
"Delete"
],
[
"5 минут",
"5 minutes"
],
[
"6 минут",
"6 minutes"
],
[
"7 минут",
"7 minutes"
],
[
"Средний",
"Intermediate"
],
[
"9 минут",
"9 minutes"
],
[
"Сложный",
"Hard"
],
[
"% курса",
"% of the course"
],
[
"НАГРАДЫ",
"REWARDS"
],
[
"Открыть",
"Open"
],
[
"Кошелёк",
"Wallet"
],
[
"· макет",
"· mockup"
],
[
"← Назад",
"← Back"
],
[
"Счёт: 0",
"Score: 0"
],
[
"РАБОТЫ",
"WORKS"
],
[
"Другое",
"Other"
],
[
"Редкая",
"Rare"
],
[
"Основы",
"Basics"
],
[
"Думаю…",
"Thinking…"
],
[
"Пароль",
"Password"
],
[
"Стиль:",
"Style:"
],
[
"Ошибка",
"Error"
],
[
"работ:",
"works:"
],
[
"Сойн (",
"Soin ("
],
[
"Данные",
"Data"
],
[
"Журнал",
"Log"
],
[
"Пусто.",
"Empty."
],
[
"в сети",
"online"
],
[
"ДРУЗЬЯ",
"FRIENDS"
],
[
"Купить",
"Buy"
],
[
"· всем",
"· to everyone"
],
[
"Рынок",
"Market"
],
[
"Игрок",
"Player"
],
[
"работ",
"works"
],
[
"Аниме",
"Anime"
],
[
"ОПЫТА",
"XP"
],
[
"УРОКИ",
"LESSONS"
],
[
"опыта",
"XP"
],
[
"макет",
"mockup"
],
[
"Гость",
"Guest"
],
[
"Вход…",
"Signing in…"
],
[
"Найти",
"Find"
],
[
"и ещё",
"and"
],
[
"Цена,",
"Price,"
],
[
"Счёт:",
"Score:"
],
[
"Админ",
"Admin"
],
[
"Войти",
"Sign in"
],
[
"Назад",
"Back"
],
[
"Сойн",
"Soin"
],
[
"СОЙН",
"SOIN"
],
[
"Игры",
"Games"
],
[
"Чаты",
"Chats"
],
[
"ОПЫТ",
"XP"
],
[
"УРОК",
"LESSON"
],
[
"дн.)",
"days)"
],
[
"Вход",
"Sign in"
],
[
"» за",
"” for"
],
[
"Этап",
"Stage"
],
[
"ур:",
"lvl:"
],
[
"КБ",
"KB"
]
];

  // Шаблоны, где порядок слов в английском другой. Применяются до словаря.
  var PATTERNS = [
    [/(\d+) из (\d+)/g, '$1 of $2'],
    [/(\d)с(?![\u0410-\u044F\u0401\u0451])/g, '$1s'],
    [/был\(а\) (\d+) мин\. назад/g, 'last seen $1 min ago'],
    [/был\(а\) сегодня в (\S+(?:\s?[AP]M)?)/g, 'last seen today at $1'],
    [/был\(а\) вчера в (\S+(?:\s?[AP]M)?)/g, 'last seen yesterday at $1'],
    [/был\(а\) (.+?) в (\d{1,2}:\d{2}(?:\s?[AP]M)?)/g, 'last seen $1 at $2'],
    [/и ещё (\d+)/g, 'and $1 more']
  ];

  var exact = Object.create(null), alts = [];
  PAIRS.forEach(function (p) {
    exact[p[0]] = p[1];
    var k = p[0].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    var pre = '';
    var post = new RegExp(CYR_CLASS + '$').test(p[0]) ? '(?!' + CYR_CLASS + ')' : '';
    alts.push(pre + k + post);
  });
  var FRAG = new RegExp(alts.join('|'), 'g');

  var cache = new Map();
  function tr(str, exactOnly) {
    if (lang !== 'en' || typeof str !== 'string' || !CYR.test(str)) return str;
    var key = (exactOnly ? '1' : '0') + str, hit = cache.get(key);
    if (hit !== undefined) return hit;
    var lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0], core = str.trim(), out;
    if (exact[core] !== undefined) out = lead + exact[core] + trail;
    else if (exactOnly) out = str;
    else {
      out = core;
      PATTERNS.forEach(function (p) { out = out.replace(p[0], p[1]); });
      out = out.replace(FRAG, function (m, off, whole) {
        // слово не должно быть частью более длинного русского слова (проверка слева; справа — в самом шаблоне)
        if (off > 0 && CYR_START.test(m) && CYR.test(whole.charAt(off - 1))) return m;
        return exact[m] !== undefined ? exact[m] : m;
      });
      out = lead + out + trail;
    }
    if (cache.size > 4000) cache.clear();
    cache.set(key, out);
    return out;
  }

  var orig = new WeakMap();
  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];

  function protectedEl(el) { return !!(el && el.closest && el.closest('[translate="no"]')); }
  function exactOnlyEl(el) { return !!(el && el.closest && el.closest('.chat-msg,[data-user]')); }

  function doText(n) {
    var p = n.parentNode;
    if (!p) return;
    var tag = p.nodeName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return;
    var v = n.nodeValue;
    if (!CYR.test(v) || protectedEl(p)) return;
    var t = tr(v, exactOnlyEl(p));
    if (t === v) return;
    // <option> без value берёт значение из текста — фиксируем русское значение, чтобы логика приложения не ломалась
    if (tag === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', v.trim());
    if (!orig.has(n)) orig.set(n, v);
    n.nodeValue = t;
  }
  function doAttrs(el) {
    if (el.nodeType !== 1 || protectedEl(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v && CYR.test(v)) {
        var t = tr(v);
        if (t !== v) { if (!el.hasAttribute('data-ru-' + a)) el.setAttribute('data-ru-' + a, v); el.setAttribute(a, t); }
      }
    }
  }
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) doAttrs(node);
    var w = doc.createTreeWalker(node, 1 | 4);
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function restore(node) {
    var w = doc.createTreeWalker(node, 1 | 4), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { var o = orig.get(n); if (o !== undefined) { n.nodeValue = o; orig.delete(n); } }
      else ATTRS.forEach(function (a) {
        var k = 'data-ru-' + a;
        if (n.hasAttribute(k)) { n.setAttribute(a, n.getAttribute(k)); n.removeAttribute(k); }
      });
    }
  }

  var cfg = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  var obs = new MutationObserver(function (recs) {
    obs.disconnect();
    try {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'childList') r.addedNodes.forEach(walk);
        else if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') {
          var el = r.target;
          if (el.hasAttribute('data-ru-' + r.attributeName)) el.removeAttribute('data-ru-' + r.attributeName);
          doAttrs(el);
        }
      }
    } finally { if (lang === 'en') obs.observe(root, cfg); }
  });

  // alert / confirm / prompt — тоже переводим
  ['alert', 'confirm', 'prompt'].forEach(function (name) {
    var f = window[name]; if (!f) return;
    window[name] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = tr(String(msg == null ? '' : msg)); return f.apply(window, a); };
  });

  function applyTheme(t, save) {
    theme = t === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    var m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', theme === 'light' ? '#F4F2FA' : '#0D0E17');
    if (save) { try { localStorage.setItem(LS_THEME, theme); } catch (e) {} }
    var b = doc.getElementById('themeBtn');
    if (b) {
      var label = lang === 'en' ? (theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme')
                                : (theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему');
      b.setAttribute('title', label); b.setAttribute('aria-label', label); b.removeAttribute('data-ru-title'); b.removeAttribute('data-ru-aria-label');
    }
  }
  function applyLang(l, save) {
    obs.disconnect();
    var prev = lang;
    lang = l === 'en' ? 'en' : 'ru';
    root.lang = lang; root.setAttribute('data-lang', lang);
    if (save) { try { localStorage.setItem(LS_LANG, lang); } catch (e) {} }
    cache.clear();
    if (lang === 'en') { walk(doc); obs.observe(root, cfg); }
    else if (prev === 'en') restore(doc);
    var b = doc.getElementById('langBtn');
    if (b) {
      b.textContent = lang === 'en' ? 'EN' : 'RU';
      var label = lang === 'en' ? 'Language: English (click for Russian)' : 'Язык: русский (нажми для English)';
      b.setAttribute('title', label); b.setAttribute('aria-label', label);
    }
    applyTheme(theme, false);
    try { window.dispatchEvent(new CustomEvent('crystalis:lang', { detail: lang })); } catch (e) {}
  }

  window.I18N = {
    lang: function () { return lang; },
    theme: function () { return theme; },
    tr: tr,
    setLang: function (l) { applyLang(l, true); },
    setTheme: function (t) { applyTheme(t, true); }
  };
  window.LOCALE = function () { return lang === 'en' ? 'en-US' : 'ru-RU'; };

  if (lang === 'en') obs.observe(root, cfg);   // переводим уже во время разбора страницы, до первой отрисовки

  function init() {
    var lb = doc.getElementById('langBtn'), tb = doc.getElementById('themeBtn');
    if (lb) lb.addEventListener('click', function () { applyLang(lang === 'en' ? 'ru' : 'en', true); });
    if (tb) tb.addEventListener('click', function () { applyTheme(theme === 'light' ? 'dark' : 'light', true); });
    applyLang(lang, false);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
