#!/bin/bash
# install.sh — установка «Инетометр» одной командой.
# Использование:
#   bash <(curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/install.sh)
#
# Поведение:
#   1. Проверяет наличие nginx и certbot (при необходимости устанавливает).
# 2. Скачивает production-файлы (index.html, styles.v12.css, app.js, lib/*.js) из GitHub
#    в /var/www/inetometr. Dev-артефакты (tests/, .github/, package.json и т.п.)
#    в архиве есть, но НЕ копируются — только то, что нужно браузеру.
#   3. Создаёт конфиг nginx для домена $DOMAIN (по умолчанию inetometr.ru).
#   4. Получает SSL-сертификат Let's Encrypt (опционально).
#   5. Запускает и добавляет nginx в автозагрузку.

set -e

REPO="geekhippo/inetometr"
BRANCH="main"
INSTALL_DIR="/var/www/inetometr"
NGINX_SITE="/etc/nginx/sites-available/inetometr"
NGINX_ENABLED="/etc/nginx/sites-enabled/inetometr"

echo "🚀 Установка «Инетометр»"

# ── 1. Домен ──────────────────────────────────────────────────────────────────
read -p "Домен [inetometr.ru]: " DOMAIN < /dev/tty
DOMAIN=${DOMAIN:-inetometr.ru}

read -p "Email для Let's Encrypt [admin@${DOMAIN}]: " EMAIL < /dev/tty
EMAIL=${EMAIL:-admin@${DOMAIN}}

# ── 2. Проверка / установка nginx и certbot ──────────────────────────────────
if ! command -v nginx >/dev/null 2>&1; then
  echo "📦 nginx не найден. Устанавливаю…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    echo "❌ Не удалось установить nginx. Установите его вручную и запустите скрипт снова."
    exit 1
  fi
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "📦 certbot не найден. Устанавливаю…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y certbot python3-certbot-nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y certbot python3-certbot-nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y certbot python3-certbot-nginx
  fi
fi

# ── 3. Скачивание исходников (через tar-архив, чтобы выдержать любую структуру) ─
echo "📥 Скачиваю файлы из GitHub…"
TMP_DIR=$(mktemp -d)
# GitHub отдаёт архив репозитория целиком — внутри inetometr-<sha>/ со всеми файлами
curl -fsSL "https://codeload.github.com/${REPO}/tarball/refs/heads/${BRANCH}" -o "${TMP_DIR}/src.tar.gz"
tar -xzf "${TMP_DIR}/src.tar.gz" -C "${TMP_DIR}"
SRC_DIR=$(find "${TMP_DIR}" -maxdepth 1 -type d -name 'inetometr-*' | head -1)
if [ -z "$SRC_DIR" ]; then
  echo "❌ Не удалось распаковать архив репозитория"
  exit 1
fi

# Очищаем старую установку и копируем ТОЛЬКО production-файлы
# (в архиве репо есть dev-артефакты: .github/, tests/, e2e/, package.json и т.п. —
#  на проде они не нужны и могут запутать)
mkdir -p "$INSTALL_DIR"
rm -rf "${INSTALL_DIR:?}/"*
# Список прод-файлов. Если структура изменится — скрипт явно упадёт с понятной ошибкой.
PROD_FILES=(
  index.html
  styles.v12.css
  app.js
)
for f in "${PROD_FILES[@]}"; do
  if [ ! -f "$SRC_DIR/$f" ]; then
    echo "❌ В архиве нет обязательного файла: $f"
    echo "   Возможно, репозиторий повреждён. Проверьте:"
    echo "   https://github.com/${REPO}/tree/${BRANCH}"
    rm -rf "$TMP_DIR"
    exit 1
  fi
  cp "$SRC_DIR/$f" "$INSTALL_DIR/"
done
# lib/ — подключаемые модули (gauge.js, share.js, server-meta.js)
if [ -d "$SRC_DIR/lib" ]; then
  mkdir -p "$INSTALL_DIR/lib"
  cp -r "$SRC_DIR/lib/." "$INSTALL_DIR/lib/"
  # Проверим что там есть хоть какие-то .js
  if ! ls "$INSTALL_DIR/lib"/*.js >/dev/null 2>&1; then
    echo "❌ В lib/ нет .js файлов — приложение не будет работать"
    rm -rf "$TMP_DIR"
    exit 1
  fi
else
  echo "❌ В архиве нет директории lib/ — приложение не будет работать"
  rm -rf "$TMP_DIR"
  exit 1
fi
rm -rf "$TMP_DIR"
TOTAL=$(find "$INSTALL_DIR" -type f | wc -l)
echo "  ✓ ${TOTAL} production-файлов скопировано в ${INSTALL_DIR}"
echo "    $(ls "$INSTALL_DIR")"

# Устанавливаем владельца
if id "www-data" >/dev/null 2>&1; then
  chown -R www-data:www-data "$INSTALL_DIR"
elif id "nginx" >/dev/null 2>&1; then
  chown -R nginx:nginx "$INSTALL_DIR"
fi

# ── 4. Конфиг nginx ───────────────────────────────────────────────────────────
echo "🛠  Создаю конфиг nginx для ${DOMAIN}…"
cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${INSTALL_DIR};
    index index.html;

    # Кеширование статики
    location ~* \.(css|js|svg|png|jpg|jpeg|gif|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files \$uri =404;
    }

    # SPA-фолбэк
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Сжатие
    gzip on;
    gzip_types text/css application/javascript text/html application/json image/svg+xml;
    gzip_min_length 256;

    # Безопасность
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
EOF

# Включаем сайт
if [ -d /etc/nginx/sites-enabled ]; then
  ln -sf "$NGINX_SITE" "$NGINX_ENABLED"
  rm -f /etc/nginx/sites-enabled/default
fi

# Проверяем конфиг и перезапускаем nginx
nginx -t
systemctl enable nginx
systemctl restart nginx

# ── 5. SSL-сертификат Let's Encrypt ──────────────────────────────────────────
if command -v certbot >/dev/null 2>&1; then
  echo "🔒 Получаю SSL-сертификат для ${DOMAIN}…"
  certbot --nginx --non-interactive --agree-tos -m "$EMAIL" \
    -d "$DOMAIN" -d "www.${DOMAIN}" || {
      echo "⚠️  Не удалось получить сертификат. Возможно, DNS для ${DOMAIN}"
      echo "    ещё не направлен на этот сервер. Сайт работает по http://${DOMAIN}"
      echo "    Повторите позже: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    }
else
  echo "⚠️  certbot не установлен — SSL не настроен. Сайт работает только по HTTP."
fi

# ── 6. Итог ───────────────────────────────────────────────────────────────────
echo ""
echo "🎉 Готово! «Инетометр» установлен."
echo ""
echo "   HTTP:  http://${DOMAIN}"
if [ -f /etc/letsencrypt/live/"${DOMAIN}"/fullchain.pem ]; then
  echo "   HTTPS: https://${DOMAIN}"
fi
echo ""
echo "📁 Файлы:        ${INSTALL_DIR}"
echo "⚙️  Конфиг nginx: ${NGINX_SITE}"
echo "📜 Логи:         journalctl -u nginx -f"
echo ""
echo "🛠  Команды управления:"
echo "   sudo systemctl status nginx   # статус"
echo "   sudo systemctl restart nginx  # перезапуск"
echo "   sudo nginx -t                 # проверить конфиг"
echo ""
echo "🔄 Обновление до новой версии:"
echo "   cd /tmp && curl -fsSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/install.sh | bash -s -- --update"
