
import { put } from '@vercel/blob';

export async function POST({ request }) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400 });
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
    
    if (htmlCode.includes('```html')) {
        htmlCode = htmlCode.split('```html')[1].split('```')[0].trim();
    } else if (htmlCode.includes('```')) {
        htmlCode = htmlCode.split('```')[1].split('```')[0].trim();
    }

    const fileId = Math.random().toString(36).substring(2, 10);
    const fileName = `site-${fileId}.html`;

    const blob = await put(fileName, htmlCode, {
      access: 'public',
      contentType: 'text/html',
      token: process.env.BLOB_READ_WRITE_TOKEN || import.meta.env.BLOB_READ_WRITE_TOKEN
    });

    return new Response(JSON.stringify({ url: `/api/view?url=${encodeURIComponent(blob.url)}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || error.toString() || 'Failed to generate site' }), { status: 500 });
  }
}
