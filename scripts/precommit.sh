#!/usr/bin/env bash
# Git pre-commit hook — делегирует проверки scripts/precommit.js
# Установка: cp scripts/precommit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
set -e
node scripts/precommit.js
