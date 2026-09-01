# 📡 ИНЕТОМЕТР

> Открытый сервис для измерения скорости интернет-соединения.
> Минималистичный интерфейс в стиле Яндекс.Интернетометра: одна большая шкала,
> три метрики в ряд, интерактивный индикатор и график скорости в реальном времени.

🌐 **Продукт:** [inetometr.ru](https://inetometr.ru)
💻 **Код:** [github.com/geekhippo/inetometr](https://github.com/geekhippo/inetometr)

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-orange.svg)
![No build step](https://img.shields.io/badge/build-none-success.svg)

---

## ✨ Возможности

- 📊 **Входящая скорость** (↓, Мбит/с) — измеряется на нескольких подключениях
- 📤 **Исходящая скорость** (↑, Мбит/с) — потоковая отправка больших блоков
- ⏱ **Задержка / ping** (мс) — 10–15 последовательных HTTP-запросов
- 🎯 **Интерактивная шкала** — красная дуга растёт по мере замера, индикатор-точка на конце
- 📈 **График скорости** — скользящее окно с Min / Avg / Max в реальном времени
- 🪶 **Без зависимостей** — чистые HTML / CSS / JS, никаких фреймворков и сборщиков
- 📱 **Адаптив** — корректно работает на мобильных, планшетах и десктопе
- 🌐 **Серверы Cloudflare** — замер через CDN ближайшего региона, по HTTPS

---

## 🚀 Быстрый старт

### Использование как готовый сервис

Просто откройте **[inetometr.ru](https://inetometr.ru)** и нажмите **«Начать замер»**.
Никакой регистрации, никаких логов, всё работает в браузере.

### Запуск локально для разработки

Это **статический сайт**, для запуска нужен любой HTTP-сервер:

```bash
# Вариант 1: встроенный Python-сервер
python3 -m http.server 8765
# затем откройте http://127.0.0.1:8765/

# Вариант 2: Node.js
npx serve .

# Вариант 3: PHP
php -S 127.0.0.1:8765
```

---

## 🛠 Установка на сервер (production)

### Одной командой

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/install.sh)
```

Скрипт попросит ввести домен (по умолчанию `inetometr.ru`) и e-mail для Let's Encrypt,
после чего:

1. Установит `nginx` и `certbot` (если их нет)
2. Скачает исходники в `/var/www/inetometr`
3. Создаст конфиг nginx для вашего домена
4. Получит бесплатный SSL-сертификат Let's Encrypt
5. Добавит nginx в автозагрузку и перезапустит его

После установки сайт будет доступен по **https://your-domain.ru**.

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

1. **DNS записи** для вашего домена уже направлены на IP-адрес сервера:
   ```
   A    @              →  <IP_СЕРВЕРА>
   A    www            →  <IP_СЕРВЕРА>
   ```
2. **Открыты порты 80 и 443** (для HTTP и HTTPS).
3. **sudo-доступ** на сервере (для установки пакетов и управления systemd).

### Ручная установка

Если вы предпочитаете пошаговую установку:

```bash
# 1. Клонируйте репозиторий
sudo mkdir -p /var/www/inetometr
sudo chown $USER:$USER /var/www/inetometr
git clone https://github.com/geekhippo/inetometr.git /tmp/inetometr
cp /tmp/inetometr/{index.html,styles.css,app.js} /var/www/inetometr/

# 2. Установите nginx и certbot (Ubuntu/Debian)
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 3. Скопируйте конфиг nginx
sudo cp /tmp/inetometr/install.sh.example /etc/nginx/sites-available/inetometr
# (внутри файла замените inetometr.ru на свой домен)
sudo ln -s /etc/nginx/sites-available/inetometr /etc/nginx/sites-enabled/inetometr
sudo rm -f /etc/nginx/sites-enabled/default

# 4. Проверьте конфиг и перезапустите nginx
sudo nginx -t
sudo systemctl enable --now nginx

# 5. Получите SSL-сертификат
sudo certbot --nginx -d inetometr.ru -d www.inetometr.ru
```

---

## 🔄 Обновление

```bash
cd /var/www/inetometr
sudo systemctl stop nginx
sudo curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/install.sh -o /tmp/install.sh
# либо просто скачайте файлы вручную:
sudo curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/index.html -o index.html
sudo curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/styles.css -o styles.css
sudo curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/app.js -o app.js
sudo systemctl start nginx
```

---

## 🛠 Команды управления

```bash
# Статус nginx
sudo systemctl status nginx

# Перезапуск
sudo systemctl restart nginx

# Логи в реальном времени
sudo journalctl -u nginx -f

# Проверить конфиг (перед restart)
sudo nginx -t

# Обновить SSL-сертификат вручную
sudo certbot renew
```

---

## 🏗 Структура проекта

```
inetometr/
├── index.html        # Структура страницы (одна большая SVG-шкала, метрики, кнопка, график)
├── styles.css        # Все стили (светлая тема, оранжевый акцент, шрифт YS Display)
├── app.js            # Логика: генерация тиков, замер скорости, дуга прогресса, график
├── install.sh        # Скрипт установки на сервер (nginx + certbot)
├── install.sh.example# Пример готового конфига nginx
├── LICENSE           # MIT
├── .gitignore        # Игнорируемые файлы
└── README.md         # Этот файл
```

Полный размер проекта: **~30 КБ**. Никаких зависимостей, никакой сборки.

---

## 🧠 Как это работает

1. **Замер ping** — 10–15 последовательных HTTP-запросов к CDN, медиана и MAD.
2. **Замер download** — параллельное потоковое чтение с `speed.cloudflare.com/__down`,
   20% trimmed mean по 5-секундным окнам.
3. **Замер upload** — POST-поток фиксированной длины на `speed.cloudflare.com/__up`.
4. **Логарифмическая шкала** — скорость 0–100 Мбит/с занимает первую половину дуги,
   100–1000 Мбит/с — вторую (как в Яндекс.Интернетометре).
5. **График** — Canvas 2D, скользящее окно, 60 точек, пересчёт Min/Avg/Max.

Все сетевые замеры идут по HTTPS. Никакие пользовательские данные никуда не отправляются.

---

## 📦 Зависимости

Нет. Никаких npm-пакетов, никакого bundler'а, никаких шрифтов для скачивания —
только CDN Google Fonts (YS Display) и Cloudflare Speed Test endpoints.

---

## 🤝 Участие в разработке

PR'ы приветствуются! Перед PR убедитесь, что:

1. Замер по-прежнему работает в Chrome / Firefox / Safari.
2. Индикатор на дуге попадает на нужный тик при скоростях 1 / 10 / 100 / 500 / 1000 Мбит/с.
3. График скользит плавно, без рывков.

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

Сделано с ❤️ для сообщества [GeekHippo](https://geekhippo.ru)
