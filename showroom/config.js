import {META} from './assets-meta.js';

// Coordinates are percentages of the photo (x from left, y from top).
// pose: camera centre and zoom per device: [x, y, zoom].
const P = (d, m = d) => ({d, m});
const station = (id, title, photo, pose, caption) => ({id, title, photo, pose, caption});
const spot = (id, photo, x, y, card) => ({id, photo, x, y, card});

const S425 = 'showroom/structura-425/';
const photo425 = (key, live) => ({
  sd: {base: `${S425}${key}-sd`, formats: ['avif', 'webp']},
  hd: {base: `${S425}${key}-hd`, formats: ['avif', 'webp']},
  depth: {base: `${S425}${key}-depth`, formats: ['webp']},
  live: live ? {base: `${S425}${key}-live-hd`, formats: ['avif', 'webp']} : null,
  lqip: META[key].lqip, zmax: 2.3
});
const photoOld = (id, n) => {
  const stem = `showroom/interactive/${id}-view-0${n}`;
  return {
    sd: {base: `${stem}-desktop`, formats: ['webp', 'jpg']}, hd: null,
    depth: {base: `${stem}-depth`, formats: ['webp']}, live: null,
    lqip: META[`${id}-view-0${n}`].lqip, zmax: 1.45
  };
};
const card = (title, category, text, image, specs = []) => ({title, category, text, image, specs});

const structura425 = {
  id: 'structura425',
  title: 'Structura 425',
  photos: {a: photo425('a', true), b: photo425('b', true)},
  stations: [
    station('overview', 'Общий вид', 'a', P([50, 52, 1]), 'Вся кухня целиком'),
    station('island', 'Остров', 'a', P([50, 71, 1.9], [50, 68, 1.5]), 'Цельный мраморный объём'),
    station('worktop', 'Рабочая зона', 'a', P([50, 45, 2.1], [51, 46, 1.6]), 'Мойка, фартук, верхние фасады'),
    station('angle', 'Другой ракурс', 'b', P([52, 54, 1], [58, 56, 1]), 'Взгляд с левой стороны'),
    station('appliances', 'Колонна с техникой', 'b', P([27, 52, 2.0], [27, 50, 1.55]), 'Духовые шкафы и ручки'),
    station('pantry', 'Кладовая', 'b', P([82, 57, 2.0], [84, 55, 1.55]), 'Высокий шкаф с ящиками')
  ],
  hotspots: [
    spot('a-island', 'a', 50, 67, 'island'),
    spot('a-faucet', 'a', 50, 49.5, 'faucet'),
    spot('a-oven', 'a', 21.4, 55, 'oven'),
    spot('a-oak', 'a', 35.5, 41, 'oak'),
    spot('a-upper', 'a', 55, 35, 'upper'),
    spot('b-oven', 'b', 26.2, 53, 'oven'),
    spot('b-handle', 'b', 34.2, 54, 'handle'),
    spot('b-faucet', 'b', 63.5, 51, 'faucet'),
    spot('b-island', 'b', 56, 68, 'island'),
    spot('b-drawers', 'b', 73.6, 64, 'drawers'),
    spot('b-pantry', 'b', 84, 58, 'pantry')
  ],
  cards: {
    island: card('Мраморный остров', 'Материалы',
      'Светлая поверхность с мягким золотистым прожилком объединяет столешницу и боковые панели в один монолитный объём.',
      `${S425}d-island.webp`, [['Форма', 'Монолитный объём'], ['Оттенок', 'Светлый мрамор'], ['Акцент', 'Тёплые прожилки']]),
    oak: card('Светлый дуб', 'Фасады',
      'Вертикальный рисунок дерева и спокойный тёплый тон превращают высокие шкафы в цельную стену.',
      `${S425}d-oak.webp`, [['Структура', 'Рисунок дерева'], ['Оттенок', 'Светлый дуб'], ['Эффект', 'Единая плоскость']]),
    upper: card('Светлые верхние фасады', 'Фасады',
      'Верхние шкафы без видимых ручек облегчают композицию и подчёркивают мраморный фартук.',
      `${S425}d-upper.webp`, [['Решение', 'Без видимых ручек'], ['Оттенок', 'Тёплый белый'], ['Контраст', 'С дубом и камнем']]),
    faucet: card('Смеситель и мойка', 'Фурнитура',
      'Высокий смеситель в тёплом металле и аккуратная мойка поддерживают спокойный образ рабочей зоны.',
      `${S425}d-faucet.webp`, [['Металл', 'Тёплый тон'], ['Фартук', 'Мраморный'], ['Зона', 'Мойка у стены']]),
    oven: card('Встроенные духовые шкафы', 'Техника',
      'Два чёрных прибора в колонне вписаны в дубовый фасад заподлицо и не нарушают цельность стены.',
      `${S425}d-oven.webp`, [['Колонна', 'Два прибора'], ['Цвет', 'Чёрный'], ['Монтаж', 'Встроенный']]),
    handle: card('Ручки-рейлинги', 'Фурнитура',
      'Тёмная бронзовая ручка с мелким рифлением — тактильный акцент на светлом дубе.',
      `${S425}d-handle.webp`, [['Металл', 'Тёмная бронза'], ['Фактура', 'Рифление'], ['Фасад', 'Светлый дуб']]),
    drawers: card('Организация ящиков', 'Хранение',
      'Деревянные вкладыши делят ящик на зоны для приборов и специй: всё под рукой и на своём месте.',
      `${S425}d-drawers.webp`, [['Вкладыш', 'Светлое дерево'], ['Зоны', 'Приборы и специи'], ['Доступ', 'Всё под рукой']]),
    pantry: card('Высокая кладовая', 'Хранение',
      'Шкаф-пенал открывается в систему полок и выдвижных ящиков, где всё видно сразу.',
      `${S425}d-pantry.webp`, [['Формат', 'Шкаф-пенал'], ['Внутри', 'Полки и ящики'], ['Доступ', 'Всё на виду']])
  }
};

function legacy(id, title, views, spots, cards) {
  return {
    id, title,
    photos: Object.fromEntries(views.map(([name], i) => [`v${i + 1}`, photoOld(id, i + 1)])),
    stations: views.map(([name], i) => station(`view-${i + 1}`, name, `v${i + 1}`, P([50, 50, 1]), '')),
    hotspots: spots.map(([photoKey, x, y, cardId]) => spot(`${photoKey}-${cardId}`, photoKey, x, y, cardId)),
    cards
  };
}

const lm = 'showroom/light-minimal-';
const lightminimal = legacy('lightminimal', 'Cadra 746',
  [['Общий вид'], ['Перед островом'], ['Остров и рабочая зона'], ['Материалы вблизи']],
  [['v1', 55, 53, 'sink'], ['v2', 38, 32, 'niche'], ['v2', 50, 51, 'worktop'], ['v3', 44, 37, 'sink'], ['v3', 20, 35, 'worktop'], ['v4', 44, 46, 'sink'], ['v4', 30, 12, 'niche']],
  {
    sink: card('Золотая мойка', 'Фурнитура', 'Тёплый металлический акцент на светлом острове.', `${lm}sink.jpg`),
    worktop: card('Светлая столешница', 'Материалы', 'Спокойная светлая поверхность объединяет рабочие зоны.', `${lm}worktop.jpg`),
    niche: card('Подсвеченная ниша', 'Технологии', 'Мягкая подсветка выделяет фактуру камня и предметы в нише.', `${lm}niche.jpg`)
  });

const lf = 'showroom/light-frame-';
const lightframe = legacy('lightframe', 'Nordic 793',
  [['Общий вид'], ['Вдоль острова'], ['Рабочая зона']],
  [['v1', 58, 67, 'front'], ['v2', 56, 64, 'handle'], ['v3', 55, 53, 'worktop'], ['v3', 62, 59, 'handle']],
  {
    front: card('Рамочные фасады', 'Материалы', 'Светлый фасад с тонким профилем и тёплой фурнитурой.', `${lf}storage.jpg`),
    handle: card('Металлическая ручка', 'Фурнитура', 'Небольшая ручка аккуратно подчёркивает геометрию фасада.', `${lf}storage.jpg`),
    worktop: card('Рабочая поверхность', 'Материалы', 'Каменная фактура и продуманное рабочее освещение.', `${lf}worktop.jpg`)
  });

const senso498 = legacy('senso498', 'Senso 498',
  [['Общий вид'], ['Перед рабочей зоной'], ['Мойка и столешница']],
  [['v1', 75, 52, 'front'], ['v2', 48, 22, 'front'], ['v2', 21, 63, 'light'], ['v3', 65, 60, 'sink']],
  {
    front: card('Матовый фасад', 'Материалы', 'Глубокий шоколадный оттенок с мягкой матовой поверхностью.', 'showroom/senso-498-2.jpg'),
    light: card('Контурная подсветка', 'Технологии', 'Световая линия подчёркивает край рабочей поверхности.', 'showroom/senso-498-3.jpg'),
    sink: card('Золотая мойка', 'Фурнитура', 'Тёплый металл становится выразительной деталью интерьера.', 'showroom/senso-498-4.jpg')
  });

const structura = legacy('structura', 'Structura 419',
  [['Общий вид'], ['Рабочая зона'], ['Фактура вблизи']],
  [['v1', 84, 30, 'oak'], ['v2', 56, 66, 'handle'], ['v3', 62, 32, 'stone']],
  {
    oak: card('Тёмный дуб', 'Материалы', 'Выразительная древесная фактура тёмных фасадов.', 'showroom/structura-419-3.jpg'),
    handle: card('Минималистичная ручка', 'Фурнитура', 'Лаконичная ручка сохраняет цельность плоскости фасада.', 'showroom/structura-419-2.jpg'),
    stone: card('Каменная столешница', 'Материалы', 'Светлый камень создаёт баланс с тёмным дубом.', 'showroom/structura-419-4.jpg')
  });

const configs = {structura425, lightminimal, lightframe, senso498, structura};
export const getShowroomConfig = id => configs[id] || structura425;
