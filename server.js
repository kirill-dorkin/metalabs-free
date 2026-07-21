import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { put } from '@vercel/blob';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
// Раздаем статику из текущей директории
app.use(express.static(__dirname));

// Папка для сохранения сайтов
const sitesDir = path.join(__dirname, 'local-sites', 'sites');
try {
  if (!fs.existsSync(sitesDir)) {
    fs.mkdirSync(sitesDir, { recursive: true });
  }
} catch (e) {
  // Ignored on read-only environments like Vercel
}

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const fullPrompt = `
Выступай в роли лучшего в мире Senior Frontend-разработчика, эксперта по Tailwind CSS и UI/UX дизайнера студийного уровня.

Твоя задача — вернуть ТОЛЬКО ОДИН единый, чистый, валидный блок HTML-кода (начиная с <!DOCTYPE html>) с встроенным JS. 

КРИТЕРИИ ИДЕАЛЬНОГО ДИЗАЙНА (ЧИТ-КОДЫ):
1. ФРЕЙМВОРК: Строго используй Tailwind CSS через CDN. ВЕСЬ дизайн делай ТОЛЬКО классами Tailwind! КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ писать тег <style> и кастомный CSS. В <head> настрой цвета в tailwind.config под тематику сайта.
2. ИКОНКИ И ШРИФТЫ: Подключи FontAwesome и крутой Google Font (например, Montserrat).
3. ПРОСТРАНСТВО: Огромные отступы (py-24, py-32). Много "воздуха".
4. ПРЕМИАЛЬНЫЙ ВИЗУАЛ: Glassmorphism (bg-white/10 backdrop-blur-lg border border-white/20), тени (shadow-2xl), градиенты (bg-gradient-to-r). Закругления (rounded-3xl).
5. ИНТЕРАКТИВНОСТЬ: Эффекты наведения (hover:-translate-y-2 hover:shadow-2xl transition-all duration-300).
6. ИЗОБРАЖЕНИЯ: Запрещено использовать Unsplash/Picsum. Используй ТОЛЬКО векторные иконки FontAwesome (text-6xl) внутри крутых градиентных блоков ИЛИ надежный Placehold: https://placehold.co/800x600/4f46e5/ffffff?text=Image
7. АНИМАЦИИ: У элементов, которые должны появляться при скролле, сразу пропиши Tailwind классы: "opacity-0 translate-y-10 transition-all duration-1000". Внизу добавь JS (Intersection Observer), который в нужный момент ДОБАВИТ им классы "opacity-100 translate-y-0" и УДАЛИТ "opacity-0 translate-y-10". Никакого ручного CSS!

СТРУКТУРА ОТВЕТА:
- Верни СТРОГО только HTML-код.
- НИКАКИХ markdown разметок вроде \`\`\`html.
- Код должен работать в браузере сразу, без единой строчки кастомного CSS.

ВОТ ПРОМПТ ОТ ЗАКАЗЧИКА:
${prompt}
  `;

  try {
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemini-3-flash-preview",
        "messages": [
          { "role": "user", "content": fullPrompt }
        ]
      })
    });

    const data = await aiResponse.json();
    
    if (!aiResponse.ok) {
        throw new Error(JSON.stringify(data));
    }

    let htmlCode = data.choices[0].message.content;
    
    // Очистка от маркдауна, если модель его добавила (```html ... ```)
    if (htmlCode.includes('```html')) {
        htmlCode = htmlCode.split('```html')[1].split('```')[0].trim();
    } else if (htmlCode.includes('```')) {
        htmlCode = htmlCode.split('```')[1].split('```')[0].trim();
    }

    const fileId = crypto.randomBytes(8).toString('hex');
    const fileName = `site-${fileId}.html`;

    if (process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
         throw new Error("BLOB_READ_WRITE_TOKEN is missing! Vercel Blob is not connected properly.");
      }
      // Если есть токен Vercel Blob, сохраняем в облако
      const blob = await put(fileName, htmlCode, {
        access: 'public',
        contentType: 'text/html'
      });
      // Возвращаем локальную ссылку, которая скачает Blob и отдаст его браузеру без скачивания как файл
      res.json({ url: `/api/view?url=${encodeURIComponent(blob.url)}` });
    } else {
      // Иначе сохраняем локально
      const filePath = path.join(sitesDir, fileName);
      fs.writeFileSync(filePath, htmlCode);

      // Получаем локальный IP-адрес для QR-кода
      const os = await import('os');
      const interfaces = os.networkInterfaces();
      let localIp = '';
      for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name]) {
              if (iface.family === 'IPv4' && !iface.internal) {
                  localIp = iface.address;
              }
          }
      }
      res.json({ url: `/local-sites/sites/${fileName}`, localIp });
    }

  } catch (error) {
    console.error('Error generating site:', error);
    try {
        fs.writeFileSync(path.join(__dirname, 'error.log'), error.toString() + '\n' + (error.stack || ''));
    } catch(e) {}
    res.status(500).json({ error: 'Failed to generate site' });
  }
});

// Проксируем HTML-файлы с Vercel Blob, чтобы они открывались в браузере, а не скачивались
app.get('/api/view', async (req, res) => {
  try {
    const blobUrl = req.query.url;
    if (!blobUrl || !blobUrl.includes('blob.vercel-storage.com')) {
      return res.status(400).send('Invalid URL');
    }
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error('Failed to fetch');
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error viewing site:', error);
    res.status(500).send('Error loading site');
  }
});

// --- Live Reload Logic ---
let clients = [];
app.get('/livereload', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  clients.push(res);
  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// На Vercel мы не должны запускать локальный сервер или watch, поэтому оборачиваем это условием
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.html') || filename.endsWith('.css'))) {
      clients.forEach(client => client.write(`data: reload\n\n`));
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Live Reload is active.`);
  });
}

// Экспортируем app для использования в serverless функции Vercel
export default app;
