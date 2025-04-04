# Создание анонимного чата в Telegram: Бот с MiniApp интерфейсом. Часть 2 — VueJS3 + Centrifugo с монетизацией приложения / Хабр
Время на прочтение33 мин

Количество просмотров2.4K

Друзья, приветствую!

Как вы поняли из названия статьи, сегодня мы завершим наш проект анонимного чата "Тет А Тет" в формате телеграм-бота с MiniApp (ранее известного как WebApp).

Напоминаю, что в статье [«Создание анонимного чата в Telegram: Бот с MiniApp интерфейсом. Часть 1 — Бэкенд на FastAPI, Aiogram, Redis и Centrifugo»](https://habr.com/ru/companies/amvera/articles/890976/) мы уже реализовали всю логику нашего приложения, описав специальные API-методы и логику телеграм-бота. Теперь нам осталось только добавить пользовательский интерфейс, чем мы сегодня и займемся.

Перед продолжением **обязательно** ознакомьтесь с предыдущей статьей. Кроме того, для комфортного погружения в сегодняшний материал рекомендую ознакомиться с моей статьей [«Centrifugo v6 + FastAPI + Python: разрабатываем веб-опросник с обновлениями в реальном времени»](https://habr.com/ru/companies/amvera/articles/885714/), где я рассматривал более простые примеры работы с Centrifugo на фронтенде.

### Необходимые предпосылки

Для комфортного погружения у вас должны быть:

*   Поднятая база данных Redis
    
*   Запущенное приложение Centrifugo
    
*   Токен телеграм-бота (получается в боте BotFather)
    
*   Описанные API методы для взаимодействия с Redis (работа с комнатами и очередями)
    
*   API методы для взаимодействия с Centrifugo (создание каналов, подписка на каналы и публикация сообщений)
    

Далее по ходу повествования я буду считать, что у вас есть все необходимое для работы и базовое понимание функционирования Centrifugo.

### План работы на сегодня

Теперь перейдем к детальному плану. Основная задача — реализация стильного и удобного пользовательского интерфейса для нашего чата "Тет А Тет", который будет функционировать как Real-Time приложение.

В контексте проекта **Real-Time** — это мгновенная передача сообщений от одного пользователя к другому без необходимости опроса сервера на предмет новых обновлений. Другими словами, это реализация классического чата, где пользователь не обязан постоянно обновлять страницу для получения новых уведомлений (подробнее об этом я говорил в своей предыдущей статье).

#### Пользовательские элементы интерфейса

Если говорить о том, что будет видеть пользователь при открытии нашего Telegram MiniApp, то нам предстоит реализовать следующие элементы:

1.  **Страница фильтров** — интерфейс для указания параметров поиска собеседника (пол и диапазон возраста)
    
2.  **Загрузчик запуска** — анимация при старте MiniApp приложения
    
3.  **Загрузчик ожидания** — интерфейс для отображения процесса поиска собеседника
    
4.  **Страница чата** — основной интерфейс для отправки и получения сообщений
    

#### Логика приложения

Рассмотрим логику, которую нам предстоит реализовать в MiniApp:

1.  **Взаимодействие с API** — функции для запроса на поиск собеседника, проверки статуса комнаты, выхода из комнаты, удаления комнаты и прочих операций
    
2.  **Взаимодействие с Centrifugo** — методы для отправки запросов на наш бэкенд (например, публикация сообщений в канал) и методы взаимодействия с Centrifugo на стороне фронтенда (с помощью официальной библиотеки)
    
3.  **Реактивный интерфейс** — создание "бесшовного" и отзывчивого приложения с использованием VueJS3
    

### Дополнительные важные аспекты

Отдельными блоками мы обсудим:

1.  **Монетизацию приложения** — удобный и простой способ быстрого заработка на MiniApp с помощью [RichAds](https://richads.com/publishers/telegram/?utm_source=alexey&utm_medium=pr&utm_campaign=tg_publishers&utm_content=habr)
    
2.  **Деплой всех компонентов** — как запустить наше приложение на удаленном сервере [Amvera Cloud](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs)
    

Давайте на этих двух вопросах остановимся подробнее.

### Монетизация MiniApp

Мы разрабатываем приложение, которое не подразумевает прямую монетизацию — мы не планируем продавать ни услуги, ни товары. Следовательно, логичным и самым доступным методом монетизации такого приложения будет реклама.

Если вы сталкивались с необходимостью размещения рекламы в своих MiniApp или просто на сайте, то знаете, что процесс интеграции может быть хлопотным. Часто без первоначального трафика (например, пары тысяч просмотров страницы в месяц) рекламные сервисы просто не одобряют монетизацию.

Метод монетизации, о котором я расскажу, позволит абсолютно каждому без каких-либо сложностей подключить рекламу в своем MiniApp приложении. В этом нам поможет сервис **RichAds**.

Процесс подключения предельно прост:

1.  Регистрируетесь на сайте [RichAds](https://richads.com/publishers/telegram/?utm_source=alexey&utm_medium=pr&utm_campaign=tg_publishers&utm_content=habr) (бесплатно и без подтверждений)
    
2.  Выбираете формат монетизации — Telegram MiniApp
    
3.  Вставляете в специальные поля ссылку на бота и на MiniApp
    
4.  Получаете фрагмент кода для интеграции (всего около 5 строчек)
    
5.  После внедрения ваши пользователи начнут видеть «умную» и ненавязчивую рекламу в виде небольших баннеров, которые легко закрыть
    

В качестве бонуса вы получаете удобный интерфейс аналитики для отслеживания посещений и кликов. Сразу после подключения к вам будет привязан персональный менеджер, у которого можно проконсультироваться по любым вопросам.

Оплата за клики весьма привлекательная — даже при средней активности вашего Telegram MiniApp можно рассчитывать на приятное денежное вознаграждение.

### Деплой приложения

Напомню, что наше приложение состоит из нескольких микросервисов:

*   Телеграм-бот
    
*   База данных Redis
    
*   Centrifugo
    
*   API (бэкенд на FastAPI)
    

Каждый из этих сервисов должен быть доступен извне. Очевидно, что мало пользы от чата, запущенного на локальном компьютере только для личного использования.

Для внешнего доступа необходим деплой. Обычно это выполняется либо на VPS/выделенный сервер, либо на облачные хостинги типа Heroku или его отечественного аналога [**Amvera Cloud**](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs).

В прошлой статье я показывал, как на Amvera буквально в несколько кликов можно развернуть Redis, Celery и FastAPI. Сегодня, продолжая эту традицию, я покажу, как развернуть фронтенд-приложение (MiniApp).

В результате у нас будет четыре независимых приложения: Redis, FastAPI, Celery и VueJS3, которые будут функционировать автономно, но в единой системе.

На платформе **Amvera Cloud** у меня сейчас запущено около 20 проектов. Это удобно, не требует особых технических знаний и, что важно, предоставляет бесплатное доменное имя с HTTPS, которое автоматически привязывается к проекту. Особенно это полезно при необходимости поднятия бэкенда и фронтенда как независимых приложений, каждому из которых нужна собственная ссылка. На Amvera эта задача решается полуавтоматически.

Процесс деплоя предельно прост:

1.  Создаете проект
    
2.  Загружаете файлы
    
3.  Собираете приложение
    
4.  Привязываете домен и активируете его
    

Затратив всего несколько минут, вы получаете полноценное удаленно запущенное приложение с собственным доменным именем.

### Технический стек

Теперь приблизимся к практической части и рассмотрим технический стек, который будем использовать:

*   **Бэкенд** — наши API методы, к которым будет обращаться фронтенд
    
*   **VueJS3** — JavaScript фреймворк для создания стильных и современных веб-приложений
    
*   **VUE-TG** — библиотека для взаимодействия с Telegram MiniApp API
    
*   **Centrifuge** — библиотека для взаимодействия с Centrifugo на стороне фронтенда
    
*   **Vue-Router** — компонент для удобной маршрутизации
    

Для стилизации я использовал чистый CSS, который в рамках этой статьи подробно рассматривать не планирую. Тем, кого интересует эта часть кода, рекомендую обратиться к полному исходному коду проекта, который доступен в моем бесплатном Telegram-канале ["Легкий путь в Python"](https://t.me/PythonPathMaster).

### Дисклеймер

Друзья, я в первую очередь бэкенд-разработчик. Фронтенд, в частности VueJS, для меня скорее приятное хобби. Поэтому прошу не воспринимать сегодняшний материал как описание Best Practices.

Моя главная задача — продемонстрировать, как связать фронтенд на VueJS (JavaScript) с бэкендом на FastAPI (Python) и показать реализацию Real-Time чата с использованием VueJS3. Поэтому, во-первых, давайте без негатива, а во-вторых, если вы знаете, как написать или объяснить что-то лучше — оставляйте полезную информацию в комментариях. Она будет ценна для всех читателей.

Несмотря на это, наш фронтенд будет полностью функциональным и реализованным в соответствии с моим видением логики и дизайна. Так что полезное в этом проекте для себя сможет найти любой, кого интересует тема Centrifugo и приложений, работающих в реальном времени.

Начнем!

Подготовка проекта
------------------

Начнем с создания и подготовки проекта. В рамках этого блока мы поднимем VueJS3 приложение, установим все необходимые библиотеки и организуем его структуру.

### Настройка базового проекта

Создадим новый проект Vue:

```
npm install vue@latest
```

При установке укажем имя проекта и выберем компоненты **TypeScript** и **VueRouter**.

После завершения перейдем в созданную папку:

```
cd project_name
```

Установим зависимости:

```
npm install
```

Отформатируем код:

```
npm run format
```

Выполним тестовый запуск приложения:

```
npm run dev
```

После запуска перейдите по ссылке: [http://localhost:5173/](http://localhost:5173/%EF%BF%BC)

Вы должны увидеть следующее:

![](https://habrastorage.org/getpro/habr/upload_files/326/763/a26/326763a263863ff82fb7b909fa7afd05.png)

Убедитесь, что корректно работает роутинг для этого кликаем на Home и About.

### Установка дополнительных библиотек

Остановим работу приложения VueJS комбинацией клавиш CTRL+C (или CMD+C на macOS).

Установим библиотеку для работы с Telegram MiniApp:

```
npm i vue-tg@beta
```

Установим клиент для Centrifugo:

```
npm install centrifuge
```

На момент написания статьи у меня использовались следующие версии пакетов:

*   centrifuge: ^5.3.4
    
*   vue: ^3.5.13
    
*   vue-router: ^4.5.0
    
*   vue-tg: ^0.9.0-beta.3
    

### Настройка конфигурации проекта

Настроим файл конфигурации (vite.config.ts). В базовом виде он выглядит примерно так:

```
import { fileURLToPath, URL } from 'node:url'import { defineConfig } from 'vite'import vue from '@vitejs/plugin-vue'import vueDevTools from 'vite-plugin-vue-devtools'// https://vite.dev/config/export default defineConfig({  plugins: [vue(), vueDevTools()],  resolve: {    alias: {      '@': fileURLToPath(new URL('./src', import.meta.url)),    },  },})
```

Для более удобной работы я предлагаю:

1.  Убрать из списка плагинов vueDevTools(), чтобы не мешали лишние элементы
    
2.  Использовать серверный порт 3000 (более привычный)
    
3.  Настроить список разрешенных хостов для удобной подвязки тоннелей и доменного имени
    

После доработки конфигурация должна выглядеть так:

```
import { fileURLToPath, URL } from 'node:url'import vue from '@vitejs/plugin-vue'import { defineConfig } from 'vite'// https://vite.dev/config/export default defineConfig({  plugins: [vue()],  server: {    host: '0.0.0.0',    port: 3000,    allowedHosts: true,  },  resolve: {    alias: {      '@': fileURLToPath(new URL('./src', import.meta.url)),    },  },})
```

### Настройка туннеля для разработки

Для удобства тестирования MiniApp поднимем локальный туннель. Для этих целей можно использовать утилиты **Tuna** или **Ngrok** — принципиальной разницы нет.

Для запуска туннеля используем команду:

```
ngrok http 3000# илиtuna http 3000
```

![](https://habrastorage.org/getpro/habr/upload_files/087/bb1/c04/087bb1c043e2a51c438f1a28d4703dfe.png)

После этого запустим наше приложение:

```
npm run dev
```

Если всё прошло корректно, то при переходе по URL туннеля (выделенной ссылке) у вас должно открыться VueJS3 приложение. Эту ссылку можно будет привязать к телеграм-боту на этапе разработки. После деплоя мы заменим её на постоянную.

### Структура проекта и стилизация

Добавим в папку src директорию services и создадим в ней файл api.ts. В этом файле мы будем описывать функции для взаимодействия с нашим API, разработанным в предыдущей статье.

Теперь отключим ненужные стили. Для этого перейдем в файл src/assets/main.css и очистим его содержимое.

Подключим к проекту шрифты и зададим базовые стили:

```
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&amp;display=swap');:root {  --font-family: 'Montserrat', sans-serif;}* {  font-family: var(--font-family);}body,html {  font-family: 'Montserrat', sans-serif;}.container {  max-width: 600px;  margin: 2rem auto;  padding: 2rem;  background-color: #ffffff;  border-radius: 1rem;  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);  text-align: center;}
```

Полных стилей получилось достаточно много, поэтому я не буду тратить время на их подробное описание. Все стили вы найдете в полном исходном коде проекта в моем Telegram-канале [«Легкий путь в Python»](https://t.me/PythonPathMaster) (это бесплатно).

### Настройка маршрутизации

В нашем приложении будет две основные страницы:

*   **Главная**: страница с формой фильтрации пользователей
    
*   **Страница чата**: интерфейс обмена сообщениями
    

Для начала отредактируем файл src/App.vue, приведя его к следующему виду:

```
<script setup lang="ts"></script><template>  <div class="app-container">    <router-view />  </div></template><style>/* Стили упущены для краткости */</style>
```

Обратите внимание, что \`<router-view>\` уже был подключен глобально, поэтому дополнительные импорты не требуются.

### Создание компонентов для страниц

Теперь подготовим два представления для наших маршрутов. Они размещаются в папке src/views/. У нас уже есть там некоторые файлы — давайте их изменим и уберём лишнее.

Превратим файл HomeView.vue в простой тестовый компонент:

```
<script setup lang="ts"></script><template>  <div>    <h1>Home View</h1>  </div></template>
```

Я убрал всё лишнее и оставил такой минималистичный формат для удобства тестирования.

Далее скопируем этот файл и создадим ChatView.vue с аналогичным содержимым:

```
<script setup lang="ts"></script><template>  <div>    <h1>Chat View</h1>  </div></template>
```

Файл AboutView.vue можно удалить, так как он нам не понадобится.

### Настройка маршрутов

Внесем правки в файл src/router/index.ts, корректно подключив наши компоненты:

```
import { createRouter, createWebHistory } from 'vue-router'import ChatView from '../views/ChatView.vue'import HomeView from '../views/HomeView.vue'const router = createRouter({  history: createWebHistory(import.meta.env.BASE_URL),  routes: [    {      path: '/',      name: 'home',      component: HomeView,    },    {      path: '/chat',      name: 'chat',      component: ChatView,    },  ],})export default router
```

На этом этап базовой настройки проекта завершен. В следующих разделах статьи мы займемся написанием функционального кода для нашего приложения.

Пишем функции для взаимодействия с API
--------------------------------------

В этой части мы создадим необходимые функции для взаимодействия с нашим бэкендом и Centrifugo. Будем работать с файлом src/services/api.ts.

### Настройка базовых URL-адресов

Сначала пропишем две важные переменные для работы с API:

```
export const BASE_SITE: string = 'https://back_url.com'export const CENTRIFUGO_URL: string =  'wss://centrifugo_url/connection/websocket'
```

Где:

*   **BASE\_SITE** – ссылка на ваш запущенный бэкенд
    
*   **CENTRIFUGO\_URL** – полный путь для подключения к Centrifugo по WebSocket
    

> **Важно:** Если вы развернули ваш проект на хостинге [Amvera](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs), то формат URL будет как в примере выше. В других случаях замените wss на ws, а centrifugo\_url на IP-адрес вашего сервера.

### Функция очистки комнаты

Реализуем функцию, которая будет удалять комнату из базы данных Redis:

```
export const clearRoom = async (originalRoom: string): Promise<void> => {  try {    const response = await fetch(      `${BASE_SITE}/api/clear_room/${originalRoom}`,      {        method: 'POST',        headers: { 'Content-Type': 'application/json' },      }    )    if (!response.ok) {      throw new Error(`Ошибка HTTP: ${response.status}`)    }  } catch (error) {    console.error('Ошибка при очистке комнаты:', error)  }}
```

**Обратите внимание:** Для корректной работы этой функции необходим активный бэкенд, который я описывал в [предыдущей статье](https://habr.com/ru/companies/amvera/articles/890976/). Функция принимает идентификатор комнаты и выполняет запрос, который удаляет соответствующую запись в Redis.

На этом простом примере наглядно видно, как связываются между собой база данных, бэкенд и веб-приложение.

### Работа с Centrifugo: принцип публикации сообщений

Хочу отдельно остановиться на процессе публикации сообщений в Centrifugo. Напомню общий принцип работы:

Centrifugo использует **каналы** — это сущности, на которые можно подписаться. Все пользователи, подписанные на канал, автоматически получают сообщения, опубликованные в этом канале.

В нашем случае:

1.  Канал — это наш чат
    
2.  Участники канала — максимум 2 человека (+ система)
    
3.  Процесс обмена сообщениями:
    
    *   Пользователь пишет сообщение
        
    *   Оно попадает в Centrifugo
        
    *   Centrifugo рассылает сообщение всем участникам канала
        

Не важно, кто именно опубликовал сообщение в канал — важно то, что его увидят все участники.

### Системные сообщения

Помимо обычных участников, в чате существует сущность **Система**. Она отправляет служебные сообщения, например, о подключении нового пользователя или о том, что кто-то покинул чат.

Реализуем функцию для отправки системных сообщений:

```
export const sendSystemMessage = async (  message: string,  room: string,  user_id: number) => {  try {    await fetch(`${BASE_SITE}/api/send-msg/${room}`, {      method: 'POST',      headers: {        'Content-Type': 'application/json',      },      body: JSON.stringify({        sender: 'Система',        user_id: user_id,        message: message,      }),    })  } catch (error) {    console.error('Ошибка при отправке системного сообщения:', error)  }}
```

**Важный момент:** Centrifugo создает канал только после того, как к нему присоединился минимум один участник. Как только это происходит, у нас появляется техническая возможность публиковать туда сообщения.

Это наглядно отображается в административной панели Centrifugo: указав ID канала, вы можете сразу публиковать сообщения.

Большинство функциональности уже реализовано для нас. Единственная сложность заключается в подписке пользователя на канал (напомню, что первый присоединившийся участник автоматически создаст канал).

Для большей наглядности метод публикации сообщений обычными пользователями мы расположим непосредственно во view-компоненте чата. Там же выполним и подписку пользователя на канал.

### Функция поиска собеседника

Следующая функция будет вызываться, когда пользователь нажимает кнопку «Найти собеседника»:

```
export interface PartnerSearchParams {  id: number  gender: string  age_from: number | null  age_to: number | null}export interface PartnerSearchResponse {  status: 'matched' | 'waiting'  room_key?: string  partner?: {    id: number    name: string    // добавьте другие поля партнера по необходимости  }  message?: string  token?: string}export const findPartner = async (  params: PartnerSearchParams): Promise<PartnerSearchResponse> => {  try {    const response = await fetch(`${BASE_SITE}/api/find-partner`, {      method: 'POST',      headers: {        'Content-Type': 'application/json',      },      body: JSON.stringify(params),    })    if (!response.ok) {      throw new Error(`Ошибка: ${response.status}`)    }    return await response.json()  } catch (error) {    console.error('Ошибка при поиске партнера:', error)    throw error  }}
```

Здесь я добавил интерфейсы для обеспечения типовой безопасности, что соответствует современным стандартам TypeScript и делает код более надежным.

На этом базовый API-слой нашего приложения готов. Далее мы приступим к созданию компонентов и представлений, которые будут использовать эти функции для взаимодействия с бэкендом и Centrifugo.

Работаем с компонентами
-----------------------

В этой части мы создадим несколько компонентов для нашего чат-приложения. Я решил сильно не дробить данный проект на множество компонентов, чтобы не терялась нить повествования, но всё-таки несколько ключевых элементов выделим отдельно.

Напоминаю, что компоненты — это функциональные блоки, которые мы потом будем подключать к нашим представлениям (views).

### Структура компонентов

Работаем с папкой src/components. Там уже есть несколько компонентов, которые мы можем очистить и создать следующие файлы:

*   **ActionButtons.vue**: здесь мы отдельно опишем пользовательские кнопки, такие как «Отмена» и «Закрыть»
    
*   **AppLoader.vue**: здесь будет загрузчик (анимированные часы), который будет отображаться при запуске нашего MiniApp приложения
    
*   **LoadingIndicator.vue**: здесь будет загрузчик поиска нового пользователя (индикатор процесса поиска)
    
*   **SearchForm.vue**: здесь будет компонент пользовательской формы для поиска собеседника
    

Остальные компоненты будут размещены уже в рамках представлений (views).

Далее рассмотрим все компоненты по отдельности. Стили в данной статье я подробно рассматривать не буду, сосредоточимся на функциональности.

### Компонент ActionButtons.vue

```
<script setup lang="ts">defineProps({  primaryText: {    type: String,    required: true,  },  secondaryText: {    type: String,    required: true,  },})const emit = defineEmits(['primary-click', 'secondary-click'])</script><template>  <div class="buttons-container">    <button class="btn-primary" @click="emit('primary-click')">      {{ primaryText }}    </button>    <button class="btn-secondary" @click="emit('secondary-click')">      {{ secondaryText }}    </button>  </div></template><style scoped></style>
```

Это простой компонент с двумя кнопками — основной и второстепенной. Заслуживает внимания использование пропсов и эмитов. Пропсы (primaryText и secondaryText) нужны, чтобы через родительские компоненты (представления) пробрасывать текстовые значения для кнопок. Эмиты (primary-click и secondary-click) позволяют передавать события нажатия кнопок обратно родительскому компоненту.

### Компонент AppLoader.vue

```
<script setup lang="ts">import { onMounted, ref } from 'vue'const emit = defineEmits(['loaded'])const progress = ref(0)onMounted(() => {  const interval = setInterval(() => {    if (progress.value < 100) {      progress.value += 5    } else {      clearInterval(interval)      setTimeout(() => {        emit('loaded')      }, 200)    }  }, 20)})</script><template>  <div class="loader-container">    <div class="loader-content">      <div class="clock-loader">        <div class="clock">          <div class="hand hour-hand"></div>          <div class="hand minute-hand"></div>        </div>      </div>      <div class="loading-text">Загрузка приложения...</div>      <div class="progress-bar">        <div class="progress" :style="{ width: `${progress}%` }"></div>      </div>    </div>  </div></template><style scoped></style>
```

Данный компонент реализует анимированный индикатор загрузки приложения в виде часов с прогресс-баром. Обратите внимание на использование хука жизненного цикла onMounted() — он запускает интервальный таймер, который постепенно увеличивает значение переменной progress от 0 до 100%. Когда прогресс достигает 100%, компонент эмитирует событие loaded, сигнализируя родительскому компоненту о завершении загрузки.

### Компонент LoadingIndicator.vue

```
<script setup lang="ts">defineProps({  message: {    type: String,    default: 'Загрузка...',  },})</script><template>  <div class="loader-container">    <div class="loader">      <div class="dot"></div>      <div class="dot"></div>      <div class="dot"></div>      <div class="dot"></div>    </div>    <div class="status-message">{{ message }}</div>    <slot></slot>  </div></template><style scoped>/* Стили для загрузчика */</style>
```

Этот компонент работает похожим образом с предыдущим загрузчиком, но использует анимацию с плавающими точками. В нём также есть возможность задать пользовательское сообщение через пропс `message` и добавить дополнительный контент через слот. Этот загрузчик мы будем использовать при поиске собеседника.

### Компонент SearchForm.vue

```
<script setup lang="ts">import { findPartner } from '@/services/api'import { ref } from 'vue'import ActionButtons from './ActionButtons.vue'const props = defineProps({  gender: {    type: String,    required: true,  },  ageFrom: {    type: Number,    default: null,  },  ageTo: {    type: Number,    default: null,  },  userId: {    // Добавляем props для ID пользователя    type: Number,    required: true,  },})const emit = defineEmits([  'update:gender',  'update:ageFrom',  'update:ageTo',  'find',  'close',  'partner-found',  'waiting',])const isLoading = ref(false)const error = ref('')// Функция для отправки запроса на поиск партнераasync function findPartnerHandler() {  isLoading.value = true  error.value = ''  try {    const data = await findPartner({      id: props.userId,      gender: props.gender,      age_from: props.ageFrom,      age_to: props.ageTo,    })    // Обработка ответа    if (data.status === 'matched') {      emit('partner-found', {        roomKey: data.room_key,        partner: data.partner,        token: data.token,      })    } else if (data.status === 'waiting') {      emit('waiting', {        roomKey: data.room_key,        message: data.message,        token: data.token,      })    }    emit('find', data)  } catch (err) {    error.value =      err instanceof Error        ? err.message        : 'Произошла ошибка при поиске партнера'    console.error('Ошибка при поиске партнера:', err)  } finally {    isLoading.value = false  }}</script><template>  <div class="form-container">    <div v-if="error" class="error-message">{{ error }}</div>    <div class="form-group">      <label for="gender">Пол:</label>      <select        id="gender"        :value="gender"        @input="          emit('update:gender', ($event.target as HTMLSelectElement).value)        "        class="form-control"        :disabled="isLoading"      >        <option value="any">Не указывать</option>        <option value="man">Мужской</option>        <option value="woman">Женский</option>      </select>    </div>    <div class="form-group">      <label>Возраст:</label>      <div class="age-range">        <input          type="number"          :value="ageFrom"          @input="            emit(              'update:ageFrom',              ($event.target as HTMLInputElement).value                ? parseInt(($event.target as HTMLInputElement).value)                : null            )          "          class="form-control"          placeholder="От"          :disabled="isLoading"        />        <input          type="number"          :value="ageTo"          @input="            emit(              'update:ageTo',              ($event.target as HTMLInputElement).value                ? parseInt(($event.target as HTMLInputElement).value)                : null            )          "          class="form-control"          placeholder="До"          :disabled="isLoading"        />      </div>    </div>    <ActionButtons      primary-text="Найти собеседника"      secondary-text="Закрыть"      @primary-click="findPartnerHandler"      @secondary-click="emit('close')"      :primary-disabled="isLoading"      :primary-loading="isLoading"    />  </div></template><style scoped>/* Стили для формы */</style>
```

Этот компонент значительно сложнее предыдущих. Он представляет собой форму поиска собеседника с фильтрами по полу и возрасту.

Давайте разберем ключевые моменты:

1.  **Пропсы и эмиты**: Компонент принимает начальные значения полей формы и ID пользователя через пропсы, а также определяет набор событий для двусторонней привязки данных и уведомления о результатах поиска.
    
2.  **Состояние загрузки**: Используется реактивная переменная isLoading для отслеживания процесса поиска и блокировки элементов формы во время запроса.
    
3.  **Обработка ошибок**: Компонент предусматривает отображение ошибок при поиске партнера.
    
4.  **Функция поиска**: Метод findPartnerHandler() вызывает API-функцию findPartner() из нашего сервиса, передавая параметры фильтрации, и обрабатывает различные статусы ответа:
    
    *   При статусе matched эмитирует событие partner-found с информацией о найденном партнере
        
    *   При статусе waiting эмитирует событие waiting, указывающее на ожидание подходящего партнера
        
5.  **Использование подкомпонента**: Форма включает компонент ActionButtons для отображения кнопок действий.
    
6.  **Двусторонняя привязка**: Для каждого поля формы используется паттерн "props down, events up", где изменения передаются родительскому компоненту через события update:\*.
    

Теперь у нас есть базовый набор компонентов, которые будут использоваться в различных представлениях нашего приложения. Каждый компонент выполняет свою специфическую функцию:

*   ActionButtons — универсальный компонент для кнопок действий
    
*   AppLoader — загрузчик при старте приложения
    
*   LoadingIndicator — индикатор загрузки во время различных операций
    
*   SearchForm — форма поиска собеседника с фильтрами
    

Далее мы будем интегрировать эти компоненты в представления (views) нашего приложения и добавлять бизнес-логику взаимодействия между ними.

Адаптируем приложение под MiniApp
---------------------------------

В этом разделе мы трансформируем наше VueJS 3 приложение в Telegram MiniApp для удобства тестирования и интеграции с мессенджером. Это даст нам доступ к стилям и API Telegram, а также позволит получать данные пользователя напрямую из мессенджера.

### Подключение Telegram Web App API

Для начала необходимо подключить скрипт Telegram Web App к нашему приложению. Для этого вносим изменения в файл index.html, который находится в корне проекта:

```
<!DOCTYPE html><html lang="">  <head>    <meta charset="UTF-8" />    <link rel="icon" href="/favicon.ico" />    <meta name="viewport" content="width=device-width, initial-scale=1.0" />    <script src="https://telegram.org/js/telegram-web-app.js"></script>    <title>Chat Tet@Tet</title>  </head>  <body>    <div id="app"></div>    <script type="module" src="/src/main.ts"></script>  </body></html>
```

Добавив тег  `<script src="`[`https://telegram.org/js/telegram-web-app.js"></script>`](https://telegram.org/js/telegram-web-app.js%22%3E%3C/script%3E) в секцию head, мы подключаем библиотеку Telegram Web App, которая предоставляет доступ к API мессенджера.

### Преимущества использования MiniApp

Когда мы запускаем приложение через Telegram бота, мессенджер распознаёт его как MiniApp благодаря подключенному скрипту. Это даёт нам ряд возможностей:

*   **Доступ к данным пользователя**: автоматическое получение имени, логина, ID, аватара, выбранного языка и других данных пользователя
    
*   **Использование нативных компонентов Telegram**: интеграция с UI-элементами мессенджера
    
*   **Готовые JavaScript методы**: отображение уведомлений, закрытие приложения, работа с камерой и многое другое
    
*   **Стили Telegram**: возможность использовать фирменный стиль мессенджера для единообразия интерфейса
    

### Связываем приложение с ботом

Теперь необходимо связать наше VueJS приложение с ботом Telegram. Для этого вернёмся к нашему бэкенду и настроим файл .env:

1.  Найдем переменную FRONT\_URL
    
2.  Установим в качестве значения ссылку на туннель, который мы получили ранее
    

Например:

```
FRONT_URL=https://va920h-85-175-194-59.ru.tuna.am

```

Эта ссылка используется в бэкенде для формирования клавиатуры бота. Вот пример соответствующего кода:

```
def main_user_kb(user_id: int, sender: str) -&gt; InlineKeyboardMarkup:    kb = InlineKeyboardBuilder()    kb.button(text="👤 Мой профиль", callback_data="my_profile")    kb.button(text="ℹ️ О нас", callback_data=f"about_us_{sender}")    url = f"{settings.FRONT_URL}?user_id={user_id}&amp;sender={sender}"    kb.button(text="💬 Чат Тет-а-тет", web_app=WebAppInfo(url=url))    kb.adjust(1)    return kb.as_markup()
```

Обратите внимание на следующие моменты:

*   URL принимает параметры запроса user\_id и sender
    
*   user\_id — это Telegram ID пользователя
    
*   sender — это имя пользователя (никнейм)
    
*   Ссылка вызывается не напрямую, а через объект WebAppInfo, что является стандартом для MiniApp в Telegram
    

### Обновление конфигурации на сервере

Если вы делали деплой на сервис [Amvera Cloud](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs) (как я в этом примере), то для применения изменений вам необходимо:

1.  Зайти в панель управления вашего проекта
    
2.  Перейти на вкладку «Репозиторий»
    
3.  Заменить файл .env на актуальную версию с новым FRONT\_URL
    
4.  Нажать кнопку «Пересобрать»
    

![](https://habrastorage.org/getpro/habr/upload_files/a2f/067/3c4/a2f0673c4e91c72f93103fc9aea98416.png)

После успешной пересборки проекта наше веб-приложение официально становится Telegram MiniApp. Дальнейшую разработку будем вести с учётом особенностей этой платформы.

### Что дальше?

Теперь, когда наше приложение интегрировано с Telegram, мы можем использовать его специфические возможности:

*   Получать информацию о пользователе напрямую из Telegram
    
*   Использовать встроенные UI-компоненты
    
*   Применять Theme API для адаптации к выбранной пользователем теме
    
*   Реализовать более нативный и привычный для пользователей Telegram интерфейс
    

В следующих разделах мы займёмся разработкой основных представлений (views) нашего приложения и интеграцией Telegram API в наш код.

### Работаем с файлом App.vue.

Файл src/App.vue считается основным файлом сборки VueJS приложений. Как правило, там описываются общие блоки кода, которые будут иметь отношение ко всему проекту.

Заполним мы этот файл следующим образом:

```
<script setup lang="ts">import { onMounted, ref } from 'vue'import { useMiniApp } from 'vue-tg'import AppLoader from './components/AppLoader.vue'const isLoading = ref(true)const handleLoaded = () => {  isLoading.value = false}const miniApp = useMiniApp()const initializeTelegramAds = () => {  miniApp.ready()}onMounted(() => {  initializeTelegramAds()})</script><template>  <div class="app-container">    <AppLoader v-if="isLoading" @loaded="handleLoaded" />    <div v-show="!isLoading" class="container">      <router-view />    </div>  </div></template><style></style>
```

Тут мы интегрировали компонент загрузчика перед запуском приложения и добавили важную логику:

```
const miniApp = useMiniApp()const initializeTelegramAds = () => {  miniApp.ready()}
```

Метод miniApp.ready() гарантирует, что приложение правильно инициализировано и готово к работе.

Далее, на этапе интеграции [RichAds](https://richads.com/publishers/telegram/?utm_source=alexey&utm_medium=pr&utm_campaign=tg_publishers&utm_content=habr), мы ещё вернемся к этой функции, добавив в нее дополнительную логику для интеграции. Это позволит расширить возможности приложения и обеспечить полноценную поддержку рекламных функций.

#### Работаем с файлом HomeView.vue

Теперь пришло время перейти к файлу, содержащему более сложную логику, а именно — src/views/HomeView.vue. Этот компонент отвечает за одно из двух представлений (страниц) нашего приложения и играет ключевую роль в процессе подбора собеседника.

На данной странице мы реализуем форму поиска собеседника, а также добавим интерфейсные элементы: кнопки «Найти собеседника» и «Закрыть». Кроме того, здесь будет отображаться индикатор загрузки с текстом «Мы ищем собеседника».

Главная сложность работы с этим компонентом заключается в обеспечении реактивности. Нам нужно динамически обрабатывать процесс поиска собеседника, а также корректно управлять переходами между различными состояниями пользователя.

#### Логика переходов между состояниями

После нажатия на кнопку «Найти собеседника» возможны два сценария:

1.  **Мгновенное подключение к чату**, если на сервере уже есть пользователь, ожидающий собеседника.
    
2.  **Переход в режим ожидания**, если на данный момент свободного собеседника нет.
    

Выход из состояния ожидания может произойти в одном из трех случаев:

1.  **Собеседник найден** — тогда происходит автоматическое подключение к чату.
    
2.  **Пользователь нажал «Отмена»** — система возвращает его к экрану подбора фильтров.
    
3.  **Пользователь нажал «Закрыть»** — выход из MiniApp.
    

Важный нюанс: при нажатии на «Отмена» или «Закрыть» текущая комната автоматически удаляется, а если собеседник был найден, её статус изменяется на Matched, исключая возможность подключения к ней других пользователей. После этого комната может только быть удалена.

#### Реализация компонента

Начнем с блока `<script setup lang="ts">`, где мы выполним все необходимые импорты:

```
import { ref, onMounted, inject } from 'vue'import SearchForm from '@/components/SearchForm.vue'import LoadingIndicator from '@/components/LoadingIndicator.vue'import ActionButtons from '@/components/ActionButtons.vue'import { useRouter, useRoute } from 'vue-router'import { useMiniApp } from 'vue-tg'import { BASE_SITE } from '@/services/api'
```

### Определение состояний

Здесь мы задаем основные реактивные переменные, управляющие состоянием формы и процесса поиска:

```
const { close } = useMiniApp()const router = useRouter()const route = useRoute()// Состояния формы поискаconst gender = ref('any')const ageFrom = ref<number | null>(18)const ageTo = ref<number | null>(120)// Состояния процесса поискаconst isLoading = ref(false)const searchStatus = ref<'idle' | 'searching' | 'matched' | 'error'>('idle')const searchError = ref('')const roomKey = ref('')const partnerInfo = ref<any>(null)const userToken = ref('')const currentUserId = parseInt(route.query.user_id as string)const sender = route.query.sender as string// Таймер для проверки статуса комнатыlet statusCheckInterval: number | null = null
```

### Функции управления процессом поиска

Функция findCompanion запускает процесс поиска, устанавливая соответствующий статус:

```
const findCompanion = () => {  isLoading.value = true  searchStatus.value = 'searching'}
```

При успешном поиске вызывается handlePartnerFound, которая обрабатывает найденного собеседника и перенаправляет пользователя в чат:

```
const handlePartnerFound = (data: any) => {  console.log('Партнер найден:', data)  isLoading.value = false  searchStatus.value = 'matched'  roomKey.value = data.roomKey  partnerInfo.value = data.partner  userToken.value = data.token  router.push({    path: '/chat',    query: {      room: roomKey.value,      token: userToken.value,      user_id: currentUserId,      sender: sender,    },  })  clearStatusCheckInterval()}
```

Если подходящего собеседника не нашлось, запускается процесс ожидания:

```
const handleWaiting = (data: any) => {  console.log('Ожидание партнера:', data)  isLoading.value = true  searchStatus.value = 'searching'  roomKey.value = data.roomKey  userToken.value = data.token  startStatusCheck()}
```

Функция startStatusCheck запускает таймер, который каждую секунду проверяет состояние комнаты:

```
const startStatusCheck = () => {  clearStatusCheckInterval()  statusCheckInterval = window.setInterval(checkRoomStatus, 1000)}
```

Функция checkRoomStatus выполняет HTTP-запрос для проверки статуса комнаты и принимает соответствующие меры:

```
const checkRoomStatus = async () => {  try {    const response = await fetch(      `${BASE_SITE}/api/room-status?key=${roomKey.value}&user_id=${currentUserId}`    )    if (!response.ok) {      throw new Error(`Ошибка: ${response.status}`)    }    const data = await response.json()    if (data.status === 'matched') {      clearStatusCheckInterval()      handlePartnerFound({        roomKey: roomKey.value,        partner: data.partner,        token: userToken.value,      })    } else if (data.status === 'closed' || data.status === 'expired') {      clearStatusCheckInterval()      isLoading.value = false      searchStatus.value = 'idle'      searchError.value = 'Время ожидания истекло. Попробуйте снова.'    }  } catch (error) {    console.error('Ошибка при проверке статуса комнаты:', error)  }}
```

Логика поиска собеседника в нашем приложении построена на опросе (polling). Это значит, что в определенном интервале времени отправляется запрос к серверу для проверки статуса комнаты. Если статус изменяется на Matched, пользователь автоматически подключается к чату.

Однако такой подход — не единственный возможный. Вместо периодического опроса можно было бы использовать **реактивную модель** на основе Centrifugo, которая позволила бы реализовать поиск собеседника в режиме реального времени.

#### Альтернативный вариант на Centrifugo

Если бы мы выбрали подход с **Centrifugo**, реализация выглядела бы следующим образом:

1.  При старте поиска собеседника клиент подписывается на специальный канал Centrifugo, ожидая события о новом собеседнике.
    
2.  Когда система находит подходящего пользователя, сервер публикует сообщение в этот канал, уведомляя клиента.
    
3.  Клиент получает это сообщение мгновенно, без необходимости периодического запроса.
    
4.  После получения уведомления клиент отписывается от канала, завершая процесс поиска, и автоматически переходит в чат.
    

#### Почему я выбрал polling?

Хотя реактивный подход через Centrifugo дает преимущество в быстродействии и снижает нагрузку на сервер (так как исключает постоянные запросы), для данной статьи и демонстрации работы системы я выбрал polling. Этот метод проще в реализации, а в некоторых сценариях (например, если сервер не поддерживает WebSockets или требуется минимальная зависимость от сторонних решений) он остается вполне рабочим вариантом.

Тем не менее, если в будущем потребуется улучшить отклик системы и уменьшить нагрузку, можно рассмотреть переход на WebSockets через Centrifugo, обеспечивая настоящую реактивную работу системы.

#### Шаблон компонента

```
<template>  <h1 class="title">Поиск Собеседника</h1>  <div class="content">    <!-- Форма поиска -->    <SearchForm      v-if="!isLoading"      v-model:gender="gender"      v-model:ageFrom="ageFrom"      v-model:ageTo="ageTo"      :userId="currentUserId"      @find="findCompanion"      @partner-found="handlePartnerFound"      @waiting="handleWaiting"      @close="closeSearch"    />    <!-- Индикатор загрузки -->    <LoadingIndicator      v-if="isLoading"      :message="        searchStatus === 'searching'          ? 'Ищем подходящего собеседника...'          : 'Подключение к чату...'      "    >      <p v-if="searchError" class="error-message">{{ searchError }}</p>      <ActionButtons        primary-text="Отменить"        secondary-text="Закрыть"        @primary-click="cancelSearch"        @secondary-click="closeSearch"      />    </LoadingIndicator>  </div></template>
```

Таким образом, компонент HomeView.vue отвечает за поиск собеседника, обработку статусов комнаты и переход в чат. В следующем разделе разберем работу чата и обработку сообщений.

### Работаем с файлом ChatView.vue

Теперь переходим к реализации чата в файле ChatView.vue. В отличие от поиска собеседника, здесь мы используем Centrifugo для обеспечения работы чата в режиме реального времени (необходимости опрашивать сервер на предмет появления там сообщений нет, они будут отображаться мгновенно самостоятельно).

### Подключаем необходимые зависимости

Начинаем с импорта нужных модулей и компонентов:

```
import IconSend from '@/components/icons/IconSend.vue'import {  BASE_SITE,  CENTRIFUGO_URL,  clearRoom,  sendSystemMessage,} from '@/services/api'import { Centrifuge } from 'centrifuge'import { nextTick, onMounted, onUnmounted, ref, computed } from 'vue'import { useRoute, useRouter } from 'vue-router'import { useMiniApp } from 'vue-tg'
```

#### Инициализация переменных и состояний

Далее определяем ключевые переменные, включая token, user\_id и room, которые будут использоваться для соединения с Centrifugo и отправки сообщений:

```
const { close } = useMiniApp()const router = useRouter()const route = useRoute()const route_query = route.queryconst token = route_query.token as stringconst user_id = route_query.user_id as stringconst sender = route_query.senderconst originalRoom = route.query.room as stringconst room = originalRoom.replace('chat_room:', '')
```

Для работы с чатом создаем реактивные переменные:

```
const messages = ref<  { sender: string; text: string; type?: 'system' | 'user' }[]>([])const newMessage = ref('')const inputRef = ref(null)
```

#### Подключение к Centrifugo

Мы создаем экземпляр Centrifuge, передавая ему URL сервера и token пользователя, который был сгенерирован на бэкенде и подставлен как параметр запроса в ссылку:

```
const centrifuge = new Centrifuge(CENTRIFUGO_URL, { token: token })
```

Далее подписываемся на канал комнаты:

```
let sub: ReturnType<typeof centrifuge.newSubscription>const initializeSubscription = () => {  sub = centrifuge.newSubscription(room)  sub.on('publication', (ctx) => {    const data = JSON.parse(ctx.data)    if (data.user_id !== parseInt(user_id)) {      receiveMessage(        data.sender,        data.message,        data.sender === 'Система' ? 'system' : 'user'      )    }    console.log('Received publication:', data)  })  sub.subscribe()  sendSystemMessage(    `Пользователь ${sender} присоединился к чату`,    room,    parseInt(user_id)  )}
```

После того, как первый пользователь подпишется на этот канал — он будет автоматически создан. Следовательно, следом к каналу подключается наша система, у которой появляется возможность публиковать сообщения в канал.

То есть наш пользователь не получит сообщения о том, что он подключился к чату, так как на момент подключения отправлять системное сообщение некуда, но вот когда второй пользователь подключится — все участники чата увидят системное сообщение.

### Жизненный цикл компонента

При монтировании компонента подключаемся к Centrifugo и подписываемся на канал, тем самым инициализируя процесс создания канала:

```
onMounted(() => {  centrifuge.connect()  initializeSubscription()})
```

При размонтировании отписываемся и отключаемся:

```
onUnmounted(() => {  sendSystemMessage(    `Пользователь ${sender} покинул чат`,    room,    parseInt(user_id)  )  if (sub) {    sub.unsubscribe()  }  centrifuge.disconnect()})
```

#### Отправка сообщений

Функция отправки сообщений на сервер:

```
const sendMessageWithServer = async () => {  if (newMessage.value.trim() !== '') {    try {      const response = await fetch(`${BASE_SITE}/api/send-msg/${room}`, {        method: 'POST',        headers: { 'Content-Type': 'application/json' },        body: JSON.stringify({          sender: sender,          user_id: parseInt(user_id),          message: newMessage.value.trim(),        }),      })      if (!response.ok) throw new Error('Ошибка при отправке сообщения')      messages.value.push({        sender: 'Вы',        text: newMessage.value.trim(),        type: 'user',      })      newMessage.value = ''      nextTick(() => scrollChatToBottom())    } catch (error) {      console.error('Ошибка:', error)      alert('Не удалось отправить сообщение.')    }  }}
```

Обратите внимание на этот блок кода:

```
messages.value.push({  sender: 'Вы',  text: newMessage.value.trim(),  type: 'user',})
```

Когда мы будем публиковать сообщение в чате, для нас, оно отобразится как «Вы». Но, при этом, наш собеседник увидит в подписи наше имя (тот ник, который мы придумали при входе в бота).

Так же обратите внимание на тип. Мы указываем, что сообщение отправляет не система, а именно пользователь.

### Получение сообщений

Когда сообщение поступает через Centrifugo, оно добавляется в массив сообщений:

```
const receiveMessage = (  sender: string,  message: string,  type: 'system' | 'user' = 'user') => {  messages.value.push({ sender, text: message, type })  nextTick(() => scrollChatToBottom())}
```

Давайте разберем функцию пошагово:

1.  **Аргументы функции**:
    
    *   sender: string — имя отправителя сообщения.
        
    *   message: string — сам текст сообщения.
        
    *   type: 'system' | 'user' = 'user' — тип сообщения (по умолчанию считается, что это сообщение от пользователя, но может быть и системным).
        
2.  **Добавление сообщения в массив**:
    
    ```
    messages.value.push({ sender, text: message, type })
    ```
    
    *   Берем массив messages.value (это реактивное хранилище Vue, которое обновляет интерфейс при изменении).
        
    *   Добавляем в него объект с данными нового сообщения.
        
    *   После этого Vue автоматически обновит отображение чата.
        
3.  **Прокрутка чата вниз**:
    
    ```
    nextTick(() => scrollChatToBottom())
    ```
    
    *   nextTick() говорит Vue: "Подожди, пока интерфейс обновится, а потом выполни прокрутку чата вниз".
        
    *   Это нужно, чтобы последнее сообщение всегда оставалось в поле видимости пользователя.
        

#### Зачем это нужно?

*   Каждое новое сообщение сразу отображается в чате.
    
*   Если сообщений много, чат автоматически прокручивается вниз, чтобы пользователь видел последние сообщения без необходимости вручную скроллить.
    
*   Поддерживает как пользовательские (type: 'user'), так и системные (type: 'system') сообщения.
    

В итоге, когда приходит сообщение через Centrifugo, эта функция делает так, чтобы оно мгновенно появилось в чате, а пользователь не пропустил важную информацию.

### Прокрутка чата вниз

```
const scrollChatToBottom = () => {  const chatContainer = document.getElementById('chatContainer')  if (chatContainer) {    chatContainer.scrollTop = chatContainer.scrollHeight  }}
```

Наше приложение полностью готово! Теперь можно переходить к его тестированию, развертыванию и, конечно, к внедрению монетизации.

Если у вас возникли вопросы или вы хотите ознакомиться с полным исходным кодом, присоединяйтесь к моему Telegram-сообществу [**«Легкий путь в Python»**](https://t.me/PythonPathMaster). Там уже более 3000 участников, и вместе мы обязательно разберемся со всеми нюансами!

### Запуск и тестирование приложения

Для запуска приложения снова вводим команду:

```
npm run dev
```

Теперь открываем нашего Telegram-бота (в моем случае ссылка: [https://t.me/tet\_a\_tetMiniAppBot](https://t.me/tet_a_tetMiniAppBot)) и нажимаем **/start**.

Если вы зашли в бота впервые, то сначала нужно будет ответить на несколько вопросов: указать пол, возраст и никнейм в системе. После этого перед вами появится следующая клавиатура:

![](https://habrastorage.org/getpro/habr/upload_files/2f5/f6b/323/2f5f6b323f1049194ed9d92bb91a5ceb.png)

Нажимаем на кнопку **«Чат Тет-А-Тет»** и наблюдаем загрузчик при запуске приложения. Затем перед нами откроется основное окно:

![](https://habrastorage.org/getpro/habr/upload_files/08e/d93/1ae/08ed931ae9d3c0c546440b91a2cb119e.png)

По умолчанию поле «Пол» установлено в значение «Не указывать», а возраст выставлен в диапазоне от 18 до 120 лет. Можно оставить эти настройки или задать желаемые параметры поиска.

Чтобы протестировать чат, я открою MiniApp в Telegram с разных аккаунтов и попробую инициировать общение.

![](https://habrastorage.org/getpro/habr/upload_files/39a/1df/357/39a1df35759bbdea57f22ee8ee7a19d8.png)

Сначала запускаем поиск собеседника с одного аккаунта:

![](https://habrastorage.org/getpro/habr/upload_files/24f/abb/229/24fabb2290fda95b3c3d18cfaab707f8.png)

А затем подключаемся со второго аккаунта:

![](https://habrastorage.org/getpro/habr/upload_files/d0e/e5e/152/d0ee5e152450bbbe4c91dd6ff3af57ae.png)

Красным прямоугольником отметил блок в котором будет отображена реклама, представленная сервисом RichAds.

Заметьте, что системное сообщение о подключении получил только второй пользователь. Это связано с тем, что при входе первого пользователя чат еще не был создан, и отправлять сообщение было просто некуда.

Теперь отправим несколько сообщений в чат:

![](https://habrastorage.org/getpro/habr/upload_files/1c3/426/8f5/1c34268f52ca26d4ab7a701f7daee9be.png)

На скриншотах этого не передать, но поверьте, все работает мгновенно и в реальном времени — за это отдельное спасибо Centrifugo\*.

Посмотрим, что произойдет, если один из пользователей покинет чат (в моем случае я нажал кнопку «Новый»):

![](https://habrastorage.org/getpro/habr/upload_files/7d8/842/e25/7d8842e259c3e4cc45742abceb1998a5.png)

Как видим, система отправила сообщение о том, что пользователь **Василий покинул чат**.

Теперь давайте посмотрим на работу приложения в формате скринкаста:

![](https://habrastorage.org/getpro/habr/upload_files/9fa/c1b/f57/9fac1bf57350af3d203955b43cd2ab0b.gif)

Это значит, что наш проект полностью готов, и мы можем переходить к его развертыванию и монетизации.

#### Деплой проекта: пошаговое руководство

Пришло время запустить наш проект в удалённой среде. Начнём с его сборки. Для этого в терминале выполняем команду:

```
npm run build
```

После успешной сборки в корневой директории появится папка dist, содержащая готовые файлы проекта. Однако просто открыть index.html в браузере не получится. Причины этого:

1.  **ES-модули** – современные веб-приложения используют модульную структуру, которая требует обработки на сервере.
    
2.  **Ограничения безопасности** – браузеры блокируют выполнение локальных скриптов, что может вызвать ошибки при загрузке ресурсов.
    
3.  **Отсутствие серверной логики** – если в проекте есть серверные зависимости, они не смогут работать без соответствующей среды.
    

#### Выбор сервера для рендеринга

Для корректного рендеринга нам нужен веб-сервер. Можно использовать FastAPI, но мы пойдём более традиционным путём и выберем Nginx. Чтобы упростить процесс развёртывания, воспользуемся Docker.

Если ваш проект размещается на **Amvera Cloud**, то запуск контейнера локально не потребуется – всё будет настроено автоматически.

#### Подготовка Docker-окружения

Создадим в корне проекта (рядом с папкой dist) файл Dockerfile со следующим содержимым:

```
# Базовый образ NGINX (легковесный и быстрый)FROM nginx:alpine  # Удаляем стандартный index.htmlRUN rm /usr/share/nginx/html/index.html# Копируем собранные файлы в директорию NGINXCOPY dist/ /usr/share/nginx/html/# Открываем порт 80 для веб-доступаEXPOSE 80# Запускаем NGINXCMD ["nginx", "-g", "daemon off;"]
```

### Разбор Dockerfile

*   **Базовый образ** – используется лёгкая версия NGINX на базе Alpine Linux, что ускоряет загрузку и экономит ресурсы.
    
*   **Удаление стандартного файла** – заменяем дефолтный index.html на наш.
    
*   **Копирование файлов** – переносим содержимое dist/ в директорию, откуда NGINX будет отдавать файлы пользователям.
    
*   **Экспонирование порта 80** – это необходимо для доступа к сайту через браузер.
    
*   **Запуск NGINX** – сервер запускается в фоновом режиме и обслуживает запросы.
    

Теперь Dockerfile станет основой для сборки проекта в облаке **Amvera Cloud**. Останется только загрузить файлы, и всё заработает.

### Запуск фронтенда на Amvera Cloud

Теперь перейдём к самому процессу деплоя. Все шаги сведены к простому алгоритму:

1.  **Регистрация на** [**Amvera Cloud**](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs) (новым пользователям даётся бонус в 111 рублей).
    
2.  **Создание проекта** – нажимаем «Создать проект», выбираем тип «Приложение» и заполняем основные параметры.
    
3.  **Загрузка файлов** – можно использовать GIT или загрузить файлы вручную через интерфейс. Важно загрузить папку dist и Dockerfile.
    
4.  **Настройка окружения** – выбираем Docker в качестве инструмента. Остальные параметры оставляем по умолчанию.
    
5.  **Запуск и сборка** – нажимаем «Завершить» и ждём несколько минут, пока сервис развернёт проект.
    

#### Подключение HTTPS-домена

Чтобы сделать проект доступным по защищённому соединению, выполняем несколько шагов:

1.  **Заходим в настройки проекта**.
    
2.  **Открываем вкладку «Домены»**.
    
3.  **Добавляем домен** – можно выбрать бесплатный HTTPS-домен [Amvera Cloud](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs), которого будет более чем достаточно для полноценного функционирования нашего Telegram Mini App, или привязать собственный.
    
4.  **Пересобираем проект** – после привязки домена система автоматически обновит конфигурацию.
    
5.  **Ждём 2-3 минуты**, и сайт будет доступен в интернете.
    

Теперь в проекте бэкенда снова вносим правки в файл .env, устанавливая в качестве значения переменной FRONT\_URL уже "боевую" ссылку и пересобираем бэкенд.

### Монетизация приложения

После успешного развёртывания проекта на боевом сервере осталось последнее, но важное действие — **настройка монетизации**. Для этого мы воспользуемся сервисом [**RichAds**](https://richads.com/publishers/telegram/?utm_source=alexey&utm_medium=pr&utm_campaign=tg_publishers&utm_content=habr), который поможет нам интегрировать рекламу в Telegram Mini App.

#### Шаг 1: Регистрация на RichAds

*   Переходим на официальный сайт RichAds: 👉 [RichAds для Telegram](https://richads.com/publishers/telegram/?utm_source=alexey&utm_medium=pr&utm_campaign=tg_publishers&utm_content=habr).
    
*   Нажимаем кнопку **"SIGN UP"** и заполняем форму регистрации.
    

![](https://habrastorage.org/getpro/habr/upload_files/4e3/978/54d/4e397854d3873437a32b81d6463dcb1f.png)

*   Настраиваем профиль (в блоке "откуда о нас узнали" можно указать, например, yakvenalex Habr).
    

![](https://habrastorage.org/getpro/habr/upload_files/c80/773/90d/c8077390d633d516f5c5111471ed6b29.png)

*   Подключаем приложение, следуя инструкциям на экране.
    

![](https://habrastorage.org/getpro/habr/upload_files/fcd/47f/ba9/fcd47fba96569057387db6fee8c6bcce.png)

Вствыляем ссылку на телеграм бота и ссылку на веб-приложение.

*   После регистрации появится окно с кратким руководством.
    

![](https://habrastorage.org/getpro/habr/upload_files/447/a5d/71c/447a5d71c1aa240fef0b454f3cf16b4f.png)

Кликаем на JS tag code -> check connection -> Continue

#### Шаг 2: Интегрируем код в проект

В буфере обмена, после клика на JS tag code у вас буде следующий код (с вашими данными в pubId и appId:

```
<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js"></script><script>  window.TelegramAdsController = new TelegramAdsController();  window.TelegramAdsController.initialize({    pubId: "123456",    appId: "1234",  });</script>
```

Теперь добавим рекламный скрипт в код нашего **Vue.js 3** приложения.

### 1\. Изменяем index.html

В файле `index.html` в разделе `<head>` добавляем код RichAds сразу после подключения Telegram Mini App API:  

```
<!DOCTYPE html><html lang="ru">  <head>    <meta charset="UTF-8" />    <link rel="icon" href="/favicon.ico" />    <meta name="viewport" content="width=device-width, initial-scale=1.0" />        <!-- Telegram MiniApp API -->    <script src="https://telegram.org/js/telegram-web-app.js"></script>        <!-- RichAds рекламный скрипт -->    <script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js"></script>    <title>Chat Tet@Tet</title>  </head>  <body>    <div id="app"></div>    <script type="module" src="/src/main.ts"></script>  </body></html>
```

### 2\. Обновляем src/App.vue

В файле src/App.vue нужно обновить функцию **initializeTelegramAds**:

**Было:**

```
const initializeTelegramAds = () => {  miniApp.ready()}
```

**Стало:**

```
const initializeTelegramAds = () => {  miniApp.ready();  window.TelegramAdsController = new TelegramAdsController();  window.TelegramAdsController.initialize({    pubId: "123456",    appId: "1234",  });};
```

Этим изменением мы модернизировали стандартный скрипт [RichAds](https://richads.com/publishers/telegram/?utm_source=alexey&utm_medium=pr&utm_campaign=tg_publishers&utm_content=habr) под реалии **Vue.js 3**.

#### Шаг 4: Сборка и развёртывание

1.  **Пересобираем проект:**
    

```
npm run build
```

2.  **Загружаем файлы на сервер** (например, в [**Amvera Cloud**](https://amvera.ru/?utm_source=habr&utm_medium=article&utm_campaign=yakvenalex_tet_a_tet_vuejs), если проект был там развернут).
    
3.  **Запускаем пересборку в облаке**, нажав соответствующую кнопку.
    

#### Проверка результата

Если всё сделано правильно, при открытии **Telegram Mini App** на мобильном устройстве вы увидите рекламу.

📌 **Пример отображения рекламы:**

![](https://habrastorage.org/getpro/habr/upload_files/b32/f1c/a38/b32f1ca389c122cfe4e2fe107e757ec1.jpg)

Пример рекламы на странице выбора чата

![](https://habrastorage.org/getpro/habr/upload_files/a1f/314/64a/a1f31464a39127cb8cf664f025a2d898.jpg)

Пример на странице поиска собеседника

![](https://habrastorage.org/getpro/habr/upload_files/eb2/18c/6d0/eb218c6d00d9ed157cb63d5c53a5ba65.jpg)

Пример на странице чата

Готово! Теперь проект не только работает, но и приносит доход.

### Заключение

Вот и подошло к концу наше увлекательное путешествие в мир RealTime-приложений и FullStack-разработки. Путь был непростым, но, без сомнений, захватывающим.

Серия этих статей была создана, чтобы показать вам, насколько мощные и гибкие инструменты — FastAPI, Redis, Centrifugo и Vue.js 3 — позволяют строить современные микросервисные приложения. Теперь у вас есть прочный фундамент и понимание ключевых аспектов разработки.

#### Что вы узнали:

*   Как фронтенд и бэкенд взаимодействуют через API-запросы.
    
*   Как Python делает работу с Redis и Celery удобной и эффективной.
    
*   Как Redis и Celery помогают создавать RealTime-приложения.
    
*   Как настроить и использовать Centrifugo на бэкенде и фронтенде.
    
*   Как монетизировать свои проекты, превращая код в источник дохода.
    

Поздравляю! Мы проделали большую работу, и теперь у вас есть все необходимые знания, чтобы углубляться в тему и разрабатывать еще более сложные и интересные проекты.

Если эта серия публикаций была вам полезна, не забудьте поддержать её лайком или комментарием. Ваша обратная связь мотивирует меня создавать ещё больше качественного контента.

А для тех, кто хочет больше эксклюзивных материалов и живого общения — приглашаю в мой Telegram-канал «[Лёгкий путь в Python](https://t.me/PythonPathMaster)». Там нас уже более 3000 участников, и сообщество продолжает расти. Кстати, подписчики канала получили полный исходный код этого проекта ещё пару недель назад.

На этом всё. Надеюсь, что это не прощание, а лишь начало вашего большого пути в мир RealTime-разработки. До скорого!

Если эта публикация вас вдохновила и вы хотите поддержать автора — не стесняйтесь нажать на кнопку