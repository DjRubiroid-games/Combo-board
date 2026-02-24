require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(cors());
app.use(express.json());

// Отдаем index.html как фронтенд
app.use(express.static(path.join(__dirname)));

// В телеграме берем токен из секретных переменных (никогда не храним в коде!)
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('⚠️ ВНИМАНИЕ: BOT_TOKEN не задан! Бот не запустится.');
} else {
    const bot = new Telegraf(BOT_TOKEN);

    // ----------- НАСТРОЙКА БОТА -----------
    bot.start((ctx) => {
        ctx.reply(
            'Привет! Я система тактической доски для команды. 🏀\n\n' +
            'Открой мини-приложение, чтобы рисовать или просматривать комбинации:',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: '🏀 Открыть доску',
                            web_app: {
                                url: process.env.WEBAPP_URL || 'https://djrubiroid-games.github.io/Combo-board/'
                            }
                        }]
                    ]
                }
            }
        );
    });

    bot.on('text', (ctx) => {
        if (ctx.message.text !== '/start') {
            ctx.reply('Я здесь! Введите /start чтобы появилось меню с кнопкой.');
        }
    });

    // Запускаем бота, если есть токен
    bot.launch()
        .then(() => console.log('🤖 Telegram-бот запущен и готов к работе!'))
        .catch(err => console.error('❌ Ошибка при запуске бота:', err));

    // Корректная остановка
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Схема для базы данных (комбинаций)
const comboSchema = new mongoose.Schema({
    name: { type: String, required: true },
    author: { type: String, default: 'Тренер' },
    frames: { type: Array, required: true }, // Массив кадров позиций
    createdAt: { type: Date, default: Date.now }
});
const Combo = mongoose.model('Combo', comboSchema);

// ----------- API РОУТЫ ДЛЯ МИНИ-ПРИЛОЖЕНИЯ -----------

// Сохранить комбинацию
app.post('/api/combos', async (req, res) => {
    try {
        const { name, author, frames } = req.body;
        const newCombo = new Combo({ name, author, frames });
        await newCombo.save();
        res.status(201).json({ success: true, combo: newCombo });
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        res.status(500).json({ success: false, error: 'Ошибка сохранения' });
    }
});

// Получить все комбинации
app.get('/api/combos', async (req, res) => {
    try {
        const combos = await Combo.find().sort({ createdAt: -1 });
        res.json({ success: true, combos });
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        res.status(500).json({ success: false, error: 'Ошибка загрузки' });
    }
});

// ----------- ЗАПУСК СЕРВЕРА -----------

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.log('⚠️ MONGODB_URI не задан. Сервер запустится БЕЗ базы данных (сохранение не сработает).');
}

mongoose.connect(MONGODB_URI || 'mongodb://localhost/tacboard_db')
    .then(() => {
        console.log('✅ Подключено к MongoDB');
        app.listen(PORT, () => console.log(`🚀 Сервер (веб/API) запущен на порту ${PORT}`));
    })
    .catch(err => {
        console.error('❌ Ошибка подключения БД:', err.message);
        // Fallback-запуск без базы данных (чтобы фронт все равно работал локально)
        app.listen(PORT, () => console.log(`🚀 (Local Fallback) Сервер запущен на порту ${PORT}`));
    });
