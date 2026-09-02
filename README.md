# 📡 ИНЕТОМЕТР

> Открытый сервис для измерения скорости интернет-соединения.
> Минималистичный интерфейс в стиле Яндекс.Интернетометра: одна большая шкала,
> три метрики в ряд, интерактивный индикатор и график скорости в реальном времени.

🌐 **Продукт:** [inetometr.ru](https://inetometr.ru)
💻 **Код:** [github.com/geekhippo/inetometr](https://github.com/geekhippo/inetometr)

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-orange.svg)
![No build step](https://img.shields.io/badge/build-none-success.svg)
![Tests: 134/134](https://img.shields.io/badge/tests-134%2F134-success.svg)
![E2E: 30/30](https://img.shields.io/badge/e2e-30%2F30-success.svg)
![WCAG 2.2 AA](https://img.shields.io/badge/WCAG-2.2%20AA-brightgreen.svg)

---

## ✨ Возможности

### Замер
- 📊 **Входящая скорость** (↓, Мбит/с) — потоковое скачивание с 4 размерами файлов
- 📤 **Исходящая скорость** (↑, Мбит/с) — POST 3 блоков по 0.5/2/5 МБ
- ⏱ **Задержка / ping** (мс) — 10 последовательных HTTP-запросов, медиана
- 🌐 **Multi-server fallback** — Cloudflare → Hetzner → httpbin, замер не падает при недоступности одного
- 🎯 **Логарифмическая шкала** — 1 / 10 / 100 / 1000 Мбит/с в стиле Яндекс.Интернетометра
- 📈 **График в реальном времени** — скользящее окно 120 точек, Min / Avg / Max

### UX
- ✨ **Плавная анимация счётчика** — числа считают от старого к новому (ease-out cubic, 350мс)
- 📊 **Rolling median** — цифры не прыгают на TCP bursts (окно 7 сэмплов ≈ 1.4с)
- 📈 **История за 7 дней** — локальный localStorage, мини-график тренда, дельты ↑↓
- 🖼 **Скачать PNG-картинку** — Open Graph карточка 1200×630 с результатом
- 📤 **Web Share API** — нативный диалог шаринга на мобильных (Telegram / WhatsApp / Mail)
- 🔗 **Open Graph + Twitter Card** — красивое превью при расшаривании ссылки

### Качество
- ♿ **WCAG 2.2 AA** — все цветовые пары прошли аудит, skip-link, focus-ring, ARIA
- 📱 **Mobile-first responsive** — 4 брейкпоинта + landscape-режим, touch-targets ≥ 44px
- 🌙 **Тёмная тема** — автоматически по `prefers-color-scheme`, с медиа-запросами
- 🚫 **Zero dependencies** — никаких npm-пакетов, никаких сборщиков
- 🔁 **prefers-reduced-motion** — все анимации отключаются по системной настройке

---

## 🚀 Быстрый старт

### Использование как готовый сервис
Просто откройте **[inetometr.ru](https://inetometr.ru)** и нажмите **«Начать замер»**.
Никакой регистрации, никаких логов, всё работает в браузере.

### Запуск локально для разработки
Это **статический сайт**, нужен любой HTTP-сервер:

```bash
# Python
python3 -m http.server 8765
# затем http://127.0.0.1:8765/

# Node.js
npx serve .

# PHP
php -S 127.0.0.1:8765
```

---

## 🛠 Установка на сервер (production)

### Одной командой
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/install.sh)
```

Скрипт попросит домен (по умолчанию `inetometr.ru`) и e-mail для Let's Encrypt, после чего:

1. Установит `nginx` и `certbot` (если их нет)
2. Скачает **только production-файлы** (45 КБ) с CDN-fallback (GitHub → jsDelivr)
3. Создаст конфиг nginx для вашего домена
4. Получит бесплатный SSL-сертификат Let's Encrypt
5. Добавит nginx в автозагрузку и перезапустит

### Альтернатива если GitHub raw заблокирован
```bash
bash <(curl -fsSL https://cdn.jsdelivr.net/gh/geekhippo/inetometr@main/install.sh)
```

### Требования к серверу

| | Минимум | Рекомендуется |
|---|---|---|
| **ОС** | любой Linux с systemd | Ubuntu 22.04 LTS / Debian 12 |
| **RAM** | 256 МБ | 512 МБ |
| **CPU** | 1 ядро | 1 ядро |
| **Свободно на диске** | 200 МБ | 1 ГБ |
| **Открытые порты** | 80, 443 | 80, 443 |
| **Доступ в интернет** | да (для certbot и обновлений) | да |

### Предусловия
1. **DNS записи** направлены на IP-адрес сервера:
   ```
   A    @              →  <IP_СЕРВЕРА>
   A    www            →  <IP_СЕРВЕРА>
   ```
2. **Открыты порты 80 и 443** (для HTTP и HTTPS).
3. **sudo-доступ** на сервере (для установки пакетов и управления systemd).

### Ручная установка
```bash
# 1. Создайте директорию
sudo mkdir -p /var/www/inetometr
sudo chown $USER:$USER /var/www/inetometr

# 2. Скачайте production-файлы (6 файлов, ~45 КБ)
git clone --depth 1 https://github.com/geekhippo/inetometr /tmp/inetometr
cp /tmp/inetometr/{index.html,styles.v12.css,app.js,og-image.svg} /var/www/inetometr/
cp -r /tmp/inetometr/lib /var/www/inetometr/

# 3. Установите nginx + certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# 4. Создайте конфиг (см. install.sh или docs)

# 5. SSL
sudo certbot --nginx -d inetometr.ru -d www.inetometr.ru
```

---

## 🔄 Обновление
```bash
# Скачать свежие файлы (без остановки nginx)
bash <(curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/install.sh)

# Или вручную
cd /tmp && rm -rf inetometr && git clone --depth 1 https://github.com/geekhippo/inetometr
cp /tmp/inetometr/{index.html,styles.v12.css,app.js,og-image.svg} /var/www/inetometr/
cp -r /tmp/inetometr/lib /var/www/inetometr/
```

---

## 🧪 Разработка (dev workflow)

### Установка dev-зависимостей
```bash
npm install
```

### Команды
```bash
npm test               # 134 unit-теста (Vitest)
npm run test:watch     # watch-режим
npm run test:ui        # Vitest UI
npm run coverage       # покрытие кода (v8)
npm run lint           # ESLint 9 (flat config)
npm run format         # Prettier — автоформатирование
npm run format:check   # проверить форматирование
npm run e2e            # Playwright e2e (нужен chromium: npx playwright install chromium)
npm run precommit      # lint + test перед коммитом
```

### Pre-commit hook (опционально)
```bash
cp scripts/precommit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### CI/CD
Каждый push в `test` или `main` запускает `.github/workflows/ci.yml`:
- ESLint (0 ошибок — иначе блок)
- Vitest (134 теста — все должны проходить)
- HTML smoke (наличие обязательных id и ES-module script)
- Playwright e2e (30 тестов)

### Git workflow
**Защита `main`:** все изменения через PR + 1 approval + линейная история.
**Рабочая ветка:** `test` — все фичи сначала туда, потом squash-merge в `main`.

---

## 🏗 Структура проекта

```
inetometr/
├── index.html                   # Структура (шкала, метрики, кнопка, график, история, кнопки шаринга)
├── styles.v12.css               # Mobile-first CSS, clamp() fluid, 4 брейкпоинта
├── app.js                       # Точка входа (ES module), импортирует lib/*
├── og-image.svg                 # Open Graph 1200×630 (для превью ссылки)
├── lib/
│   ├── gauge.js                 # Геометрия шкалы (121 тик, дуга, индикатор)
│   ├── stats.js                 # median, rollingMedian, trimmedMean
│   ├── animator.js              # Плавная анимация чисел (rAF ease-out)
│   ├── share.js                 # Форматирование текста результата + clipboard
│   ├── share-api.js             # Обёртка над navigator.share/canShare
│   ├── server-meta.js           # Парсинг cf-meta-* заголовков
│   ├── image-card.js            # Рендер PNG 1200×630 с результатом
│   ├── history.js               # localStorage история + агрегаты
│   ├── speedtest-servers.js     # Конфиг multi-server fallback
│   └── svg-to-png.js            # SVG → PNG конвертер
├── tests/                       # 134 unit-теста (Vitest)
│   ├── gauge.test.js            # 25 — геометрия шкалы
│   ├── stats.test.js            # 23 — статистика
│   ├── animator.test.js         # 10 — анимация
│   ├── share.test.js            # 10 — форматирование
│   ├── server-meta.test.js      #  8 — CDN-мета
│   ├── image-card.test.js       #  4 — PNG-генерация
│   ├── speedtest-servers.test.js# 20 — multi-server
│   ├── share-api.test.js        # 11 — Web Share
│   ├── svg-to-png.test.js       #  4 — SVG конвертер
│   └── history.test.js          # 19 — история
├── e2e/                         # 30 e2e тестов (Playwright)
│   ├── smoke.spec.js            #  9 — критический путь
│   └── responsive.spec.js       # 21 — адаптив на 4 разрешениях
├── scripts/
│   ├── precommit.js             # Pre-commit gate
│   └── precommit.sh             # Git hook wrapper
├── .github/workflows/ci.yml     # GitHub Actions: lint + test + e2e
├── install.sh                   # Установка на сервер (CDN-fallback)
├── package.json
├── vitest.config.js
├── eslint.config.js
├── .prettierrc.json
├── playwright.config.js
├── LICENSE
└── README.md                    # Этот файл
```

**Размер прод-кода:** ~50 КБ (HTML + CSS + JS + og-image.svg, без node_modules).

---

## 🧠 Как это работает

### Замер
1. **Ping** — 10 последовательных HTTP-запросов к `__down?bytes=0`, медиана
2. **Download** — потоковое чтение 4 файлов (1/5/10/25 МБ), сэмплирование каждые 200мс
3. **Upload** — POST 3 блоков (0.5/2/5 МБ) с LCG-данными (несжимаемыми)
4. **Multi-server** — каждый размер пробует серверы по приоритету: Cloudflare → Hetzner → httpbin
5. **Результат** — медиана всех сэмплов (устойчиво к выбросам)

### UI
- **Шкала** — SVG с 121 тиком, логарифмическое преобразование `mbps → t∈[0,1]`
- **Анимация** — `requestAnimationFrame` + ease-out cubic, 350мс, отключается по reduced-motion
- **Сглаживание** — rolling median 7 сэмплов (≈1.4с при 200мс интервале) убирает TCP bursts
- **График** — Canvas 2D, DPR-aware, gradient от оранжевого к красному
- **История** — `localStorage` ключ `inetometr:history:v1`, последние 50 замеров

### Шеринг
- **PNG-картинка** — Canvas 1200×630 с логотипом, датой, сервером, 3 метриками, графиком
- **Web Share API** — на устройствах с поддержкой `navigator.share` (мобильные) + `navigator.canShare({files})` для PNG
- **Open Graph** — `og:image` указывает на `/og-image.svg` (2.6 КБ), Twitter Card `summary_large_image`

---

## 📦 Зависимости

**Runtime: ноль.** Никаких npm-пакетов, никаких bundler'ов, никаких шрифтов для скачивания.

Внешние ресурсы (только CDN):
- Google Fonts: YS Display + Inter (fallback)
- Cloudflare speed endpoints (`speed.cloudflare.com`)
- Hetzner speed mirror (`speed.hetzner.de`) — fallback
- nghttp2 httpbin (`nghttp2.org/httpbin/post`) — upload fallback

**Dev: 5 пакетов** (только для разработки, не идут в прод):
- `vitest` — unit-тесты
- `eslint` + `prettier` — качество кода
- `@playwright/test` — e2e
- `happy-dom` — DOM-полифилл для тестов

---

## 🤝 Участие в разработке

PR'ы приветствуются! Перед PR убедитесь:

1. `npm test` — 134/134 passing
2. `npm run e2e` — 30/30 passing
3. `npm run lint` — 0 errors
4. Изменения в ветке `test`, мердж в `main` через PR
5. Все коммиты с осмысленными сообщениями

### Дорожная карта
- **v1.7** — PWA (offline, manifest, service worker, install to home screen)
- **v1.8** — CSV-экспорт, multi-week статистика, сравнение замеров
- **v2.0** — Web Worker для замера (UI не подвисает), Jitter (stddev), TTFB, latency under load
- **Потом** — WebRTC-тест (P2P между двумя браузерами), карта CDN-серверов

---

## 📄 Лицензия

MIT License — свободное использование и модификация.

```
MIT License

Copyright (c) 2026 GeekHippo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## 📋 Changelog

### v1.6.0 (текущая) — Quality + UX + Sharing
- 📊 **Rolling median** для UI-цифр (окно 7 сэмплов ≈ 1.4с) — одиночные TCP bursts не видны
- ✨ **Анимация счётчика** (ease-out cubic, 350мс) — цифры плавно считают от старого к новому
- 🖼 **Скачать PNG-картинку** — Open Graph карточка 1200×630 с логотипом, датой, метриками, графиком
- 🌐 **Multi-server fallback** — Cloudflare → Hetzner → httpbin, замер не падает при недоступности одного
- 📤 **Web Share API** — нативный диалог шаринга на мобильных (Telegram / WhatsApp / Mail)
- 🔗 **Open Graph + Twitter Card** — `og-image.svg` (2.6 КБ) + meta-теги для красивого превью ссылки
- 📈 **История замеров** — localStorage (50 последних), мини-график тренда 7 дней, дельты ↑↓
- 🧪 **134 unit + 30 e2e тестов** (было 25 + 6)
- 🧹 **Линт** — 0 errors (browser globals в eslint config)

### v1.5.0 — Mobile-first адаптивный дизайн
- 📱 **Mobile-first рефакторинг CSS** — 4 брейкпоинта (480 / 768 / 1024 / 1440)
- ✨ **20+ `clamp()`** для плавной адаптации шрифтов и отступов
- 👆 **Touch-targets ≥ 44px** (WCAG AAA)
- 📐 **Landscape-режим** для телефонов + compact-режим для низких десктоп-окон
- 🚫 **Убран `transform: scale(0.82)`** + `user-scalable=no` (нарушение WCAG 2.2.1)

### v1.4.0 — Copy result + CDN Server badge
- 📋 **Кнопка «Скопировать результат»** — текстовый формат для техподдержки
- 🌍 **Бейдж CDN-сервера** — парсинг `cf-meta-colo`, `cf-meta-city`, `cf-meta-country`
- 🏷 **Форматирование** — Telegram-friendly, эмодзи, копирование одной кнопкой

### v1.3.0 — Technical Debt
- 🏗 **Модульная архитектура** — `lib/gauge.js`, `lib/share.js`, `lib/server-meta.js`
- 🧪 **Vitest 2.x** + 25 unit-тестов
- 🎨 **ESLint 9** (flat config) + Prettier 3
- 🎭 **Playwright E2E** (3 теста) — критический путь: замер + индикатор
- 🤖 **GitHub Actions CI** — lint + unit + smoke на каждом PR
- 🛡 **Защита main** — required PR + 1 approval + linear history

### v1.2.1 — WCAG 2.2 AA + scale(0.82)
- ♿ **A11y:** skip-link, focus-ring, ARIA, prefers-reduced-motion, color-scheme
- 🎨 **Theme:** `--accent-text: #c22600` (контраст 5.9:1)
- 📏 **Layout:** `transform: scale(0.82)` для вписывания в 800×600

### v1.2 — UX/UI audit
- ♿ **A11y (WCAG 2.2 AA)** — все цветовые пары прошли аудит
- ♿ **A11y:** skip-link «Перейти к графику» (WCAG 2.4.1)
- ♿ **A11y:** focus-ring (3px, оранжевый) на всех интерактивных элементах
- ♿ **A11y:** `aria-live="polite"` на status, current, max/avg/min
- ♿ **A11y:** `prefers-reduced-motion` — отключает анимации
- 🎨 **Theme:** `--text-mute` поднят до 4.5:1+ в обеих темах

### v1.1
- 🐛 **Fix:** корректный расчёт среднего на графике
- 🐛 **Fix:** диалог «О сервисе» — единый класс
- ⚡ **Perf:** троттлинг графика до ~12 FPS
- ⚡ **Perf:** сэмплирование `allSpeeds` раз в 200мс
- 🌙 **UX:** тёмная тема по `prefers-color-scheme`
- 📦 **Real-data:** upload-тест с LCG-данными (несжимаемыми)

### v1.0
- 🎉 Первый релиз: шкала в стиле Яндекс.Интернетометра, 3 метрики, индикатор, график

---

Сделано с ❤️ для сообщества [GeekHippo](https://geekhippo.ru)
