# Luma — лендинг веб-студии с ИИ-заявками

Сайт студии, которая делает лендинги со встроенным ИИ. Посетитель проходит квиз, спрашивает помощника и оставляет заявку. Заявки хранятся в **Turso** (libSQL), видны в админке `/admin` и дублируются в Telegram-группу.

## Запуск

```bash
npm install
copy .env.example .env
```

Заполните `.env`, затем:

```bash
npm start
```

Откройте http://localhost:3000 и http://localhost:3000/admin

## Переменные окружения

| Ключ | Назначение |
| --- | --- |
| `GEMINI_API_KEY` | ключ [Google AI Studio](https://aistudio.google.com/apikey) для модели `gemini-3.5-flash-lite` |
| `TELEGRAM_BOT_TOKEN` | токен бота от [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | id группы, куда бот шлёт заявки |
| `ADMIN_PASSWORD` | пароль входа в `/admin` |
| `SESSION_SECRET` | секрет подписи cookie админки |
| `TURSO_DATABASE_URL` | URL базы Turso (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | токен доступа Turso |

Таблица `leads` создаётся автоматически при старте сервера. Если есть старый `data/leads.json`, заявки один раз переносятся в Turso.

## Telegram-группа

1. Создайте бота у @BotFather.
2. Создайте группу, добавьте бота, выдайте право писать сообщения.
3. У @BotFather отключите Privacy Mode (`/setprivacy` → Disable), чтобы бот видел сообщения в группе.
4. Напишите в группе любое сообщение, затем откройте в браузере:

`https://api.telegram.org/bot<TOKEN>/getUpdates`

5. Скопируйте `chat.id` группы (обычно начинается с `-100`) в `TELEGRAM_CHAT_ID`.

Если Telegram не настроен, заявки всё равно сохраняются в `data/leads.json`.
