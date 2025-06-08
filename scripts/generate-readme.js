#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Извлекает первый заголовок из markdown файла
 * @param {string} filePath - путь к файлу
 * @returns {string|null} - заголовок или null если не найден
 */
function extractTitle(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Ищем заголовки H1 (#) или H3 (###)
            if (trimmed.startsWith('# ') || trimmed.startsWith('### ')) {
                return trimmed.replace(/^#+\s*/, '').trim();
            }
        }
        
        // Если заголовок не найден, используем имя файла без расширения
        return path.basename(filePath, '.md');
    } catch (error) {
        console.warn(`Ошибка при чтении файла ${filePath}:`, error.message);
        return path.basename(filePath, '.md');
    }
}

/**
 * Сканирует директорию и возвращает список markdown файлов с заголовками
 * @param {string} dirPath - путь к директории
 * @returns {Array} - массив объектов {title, filename, relativePath}
 */
function scanDirectory(dirPath) {
    const articles = [];
    
    try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            
            // Обрабатываем только .md файлы
            if (stat.isFile() && path.extname(file) === '.md') {
                const title = extractTitle(filePath);
                const relativePath = path.relative('.', filePath);
                
                articles.push({
                    title,
                    filename: file,
                    relativePath
                });
            }
        }
    } catch (error) {
        console.warn(`Ошибка при сканировании директории ${dirPath}:`, error.message);
    }
    
    return articles;
}

/**
 * URL-кодирует путь для использования в markdown ссылках
 * @param {string} filePath - путь к файлу
 * @returns {string} - закодированный путь
 */
function encodeMarkdownPath(filePath) {
    // Разбиваем путь на части и кодируем каждую часть отдельно
    return filePath.split('/').map(part => encodeURIComponent(part)).join('/');
}

/**
 * Генерирует markdown список статей
 * @param {Array} articles - массив статей
 * @param {string} sectionTitle - заголовок секции
 * @returns {string} - markdown текст
 */
function generateMarkdownSection(articles, sectionTitle) {
    if (articles.length === 0) {
        return `## ${sectionTitle}\n\n*Статьи не найдены*\n\n`;
    }
    
    // Сортируем статьи по заголовку
    articles.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    
    let markdown = `## ${sectionTitle}\n\n`;
    
    for (const article of articles) {
        const encodedPath = encodeMarkdownPath(article.relativePath);
        markdown += `- [${article.title}](${encodedPath})\n`;
    }
    
    markdown += '\n';
    return markdown;
}

/**
 * Основная функция генерации README
 */
function generateReadme() {
    console.log('🚀 Генерация README.md...');
    
    // Сканируем директории
    const ruArticles = scanDirectory('ru');
    const articlesEn = scanDirectory('articles');
    
    console.log(`📚 Найдено статей на русском: ${ruArticles.length}`);
    console.log(`📚 Найдено статей: ${articlesEn.length}`);
    
    // Генерируем содержимое README
    let readmeContent = `# Коллекция статей

Этот репозиторий содержит коллекцию статей по программированию, разработке и технологиям.

---

`;
    
    // Добавляем секцию с русскими статьями
    readmeContent += generateMarkdownSection(ruArticles, '📖 Переведенные статьи');
    
    // Добавляем секцию с английскими статьями
    readmeContent += generateMarkdownSection(articlesEn, '📖 Статьи');
    
    // Записываем README.md
    try {
        fs.writeFileSync('README.md', readmeContent, 'utf-8');
        console.log('✅ README.md успешно сгенерирован!');
        console.log(`📊 Всего статей: ${ruArticles.length + articlesEn.length}`);
    } catch (error) {
        console.error('❌ Ошибка при записи README.md:', error.message);
        process.exit(1);
    }
}

// Проверяем, что скрипт запущен напрямую
if (require.main === module) {
    generateReadme();
}

module.exports = { generateReadme, extractTitle, scanDirectory, encodeMarkdownPath };