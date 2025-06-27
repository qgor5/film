// generate.js
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const API_KEY = '7cb67565ace3a08cd9d099c749787121';
const BASE_DIR = path.resolve('./');
const MOVIE_DIR = path.join(BASE_DIR, 'movie');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка сети: ${res.status} ${res.statusText}`);
  return res.json();
}

// Транслитерация заголовков для SEO url
function transliterate(str) {
  const ru = ['а','б','в','г','д','е','ё','ж','з','и','й','к','л','м','н','о','п','р','с','т','у','ф','х','ц','ч','ш','щ','ъ','ы','ь','э','ю','я',' '];
  const en = ['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya','-'];
  return str.toLowerCase().split('').map(c => {
    const idx = ru.indexOf(c);
    return idx >= 0 ? en[idx] : c;
  }).join('').replace(/[^a-z0-9\-]/g, '');
}

// Генерация SEO описания для фильма
function generateSeoDescription(movie, credits, videos) {
  const director = credits.crew.find(c => c.job === 'Director');
  const actors = credits.cast.slice(0, 5).map(a => a.name).join(', ');
  const releaseDate = movie.release_date || movie.first_air_date || 'Неизвестна';
  const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : '';
  const overview = movie.overview || 'Описание недоступно.';

  return `
    <p><strong>Дата выхода:</strong> ${releaseDate}</p>
    <p><strong>Жанры:</strong> ${genres}</p>
    <p><strong>Режиссёр:</strong> ${director ? director.name : 'Неизвестен'}</p>
    <p><strong>В главных ролях:</strong> ${actors}</p>
    <p>${overview}</p>
  `;
}

// Встраиваем YouTube трейлер (если есть)
function getTrailerEmbed(videos) {
  if (!videos || !videos.results) return '';
  const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  if (!trailer) return '';
  return `
    <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">
      <iframe src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
    </div>
  `;
}

// Генерация HTML страницы фильма
function generateMoviePageHtml(movie, credits, videos) {
  const seoDesc = generateSeoDescription(movie, credits, videos);
  const trailerEmbed = getTrailerEmbed(videos);
  const title = movie.title || movie.name || 'Фильм';
  const poster = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/500x750?text=Нет+постера';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Трейлер и описание | TopKino</title>
  <meta name="description" content="${(movie.overview || '').substring(0, 160).replace(/"/g, "'")}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${(movie.overview || '').substring(0, 160).replace(/"/g, "'")}" />
  <meta property="og:image" content="${poster}" />
  <meta property="og:type" content="video.movie" />
  <link rel="canonical" href="https://yourdomain.com/movie/${movie.id}-${transliterate(title)}.html" />
  <style>
    body { background:#111; color:#eee; font-family: Arial, sans-serif; margin:0; padding:20px; }
    header { background:#222; padding:10px; text-align:center; }
    a { color:#00aaff; text-decoration:none; }
    .container { max-width: 800px; margin: auto; }
    img { max-width: 100%; border-radius: 8px; }
    h1 { color:#00aaff; }
    footer { text-align:center; margin-top:40px; font-size:0.8rem; color:#666; }
  </style>
</head>
<body>
  <header><h1>${title}</h1></header>
  <div class="container">
    <img src="${poster}" alt="${title}" />
    ${seoDesc}
    ${trailerEmbed}
    <p><a href="../index.html">← Вернуться на главную</a></p>
  </div>
  <footer>© 2025 TopKino. Все права защищены.</footer>
</body>
</html>`;
}

// Генерация главной страницы index.html
function generateIndexHtml(movies) {
  const moviesHtml = movies.map(movie => {
    const seoTitle = transliterate(movie.title || movie.name);
    const poster = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/300x450?text=Нет+постера';
    return `
    <a class="movie" href="movie/${movie.id}-${seoTitle}.html" title="${movie.title || movie.name}">
      <img src="${poster}" alt="${movie.title || movie.name}" />
      <div class="movie-title">${movie.title || movie.name}</div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>TopKino — Трейлеры популярных фильмов</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { background:#111; color:#eee; font-family: Arial, sans-serif; margin:0; padding:20px; }
    .movie { display:inline-block; width:140px; margin:10px; text-align:center; color:#eee; text-decoration:none; }
    .movie img { width:140px; height:210px; object-fit: cover; border-radius: 6px; }
    .movie-title { margin-top:5px; font-size:0.9rem; }
  </style>
</head>
<body>
  <h1>Популярные фильмы</h1>
  <div class="movies-container">${moviesHtml}</div>
</body>
</html>`;
}

// Генерация sitemap.xml
function generateSitemap(urls) {
  const urlEntries = urls.map(url => `
  <url>
    <loc>${url}</loc>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

// Основная функция
async function main() {
  try {
    await fs.mkdir(MOVIE_DIR, { recursive: true });
    console.log('Папка movie создана или уже существует.');

    // Загружаем популярные фильмы (первую страницу)
    const popularData = await fetchJson(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=ru-RU&page=1`);
    const movies = popularData.results;

    // Для отслеживания ссылок в sitemap
    const sitemapUrls = ['https://kinotrailers.netlify.app/index.html'];

    // Генерируем страницы фильмов
    for (const movie of movies) {
      const seoTitle = transliterate(movie.title || movie.name);
      const movieFileName = `${movie.id}-${seoTitle}.html`;
      const movieFilePath = path.join(MOVIE_DIR, movieFileName);

      // Загружаем детали фильма
      const details = await fetchJson(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=ru-RU`);
      // Загружаем кредиты (режиссёр, актёры)
      const credits = await fetchJson(`https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${API_KEY}&language=ru-RU`);
      // Загружаем видео (трейлеры)
      const videos = await fetchJson(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${API_KEY}&language=ru-RU`);

      const html = generateMoviePageHtml(details, credits, videos);
      await fs.writeFile(movieFilePath, html, 'utf-8');
      console.log(`Сгенерирована страница: ${movieFileName}`);

      sitemapUrls.push(`https://kinotrailers.netlify.app/movie/${movieFileName}`);
    }

    // Генерируем главную страницу
    const indexHtml = generateIndexHtml(movies);
    await fs.writeFile(INDEX_PATH, indexHtml, 'utf-8');
    console.log('Сгенерирован index.html');

    // Генерируем sitemap.xml
    const sitemapXml = generateSitemap(sitemapUrls);
    await fs.writeFile(SITEMAP_PATH, sitemapXml, 'utf-8');
    console.log('Сгенерирован sitemap.xml');

  } catch (err) {
    console.error('Ошибка:', err);
  }
}

main();
