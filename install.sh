#!/bin/bash
# install.sh — установка «Инетометр» одной командой.
# Использование:
#   bash <(curl -fsSL https://raw.githubusercontent.com/geekhippo/inetometr/main/install.sh)
#
# Поведение:
#   1. Проверяет наличие nginx и certbot (при необходимости устанавливает).
#   2. Скачивает исходники (index.html, styles.css, app.js) из GitHub в /var/www/inetometr.
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

# ── 3. Скачивание исходников ─────────────────────────────────────────────────
echo "📥 Скачиваю файлы из GitHub…"
mkdir -p "$INSTALL_DIR"
for f in index.html styles.css app.js; do
  curl -fsSL "https://raw.githubusercontent.com/${REPO}/${BRANCH}/${f}" -o "${INSTALL_DIR}/${f}"
  echo "  ✓ ${f}"
done

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
