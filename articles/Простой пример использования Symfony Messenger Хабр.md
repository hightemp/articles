# Простой пример использования Symfony Messenger / Хабр
Уровень сложностиПростой

Время на прочтение6 мин

Количество просмотров4.9K

И снова о Symfony Messenger...
------------------------------

Пришёл и мой черёд асинхронно и многопоточно средствами PHP кое-что пообрабатывать… И я, естественно, вспомнил про компонент Messenger фреймворка Symfony.

О существовании компонента Symfony Messenger я узнал пару лет назад, когда прорабатывал книгу [Symfony Быстрый старт](https://symfony.com/doc/5.4/the-fast-track/ru/). Но в этой книге работа Messenger была показана в рамках фреймворка Symfony, а мне хотелось его задействовать как независимый компонент.  
Чтобы понять, как его инициализировать и использовать, я пытался найти какой-то простой, законченный и самодостаточный пример, понятный даже чайнику, но мне это не удалось...  
Изучение официальной документации ([https://symfony.com/doc/current/components/messenger.html](https://symfony.com/doc/current/components/messenger.html) и [https://symfony.com/doc/current/messenger.html](https://symfony.com/doc/current/messenger.html)) не давало каких-то вразумительных пояснений как Messenger инициализировать вне фреймворка Symfony.

В процессе изучения вопроса на Хабре нашлись две статьи:  
[https://habr.com/ru/articles/483584/](https://habr.com/ru/articles/483584/)  
[https://habr.com/ru/articles/596559/](https://habr.com/ru/articles/596559/)

В первой из них законченный пример есть. Но меня отпугнуло то, что он какой-то слишком уж профессиональный… ;-) ~А я видел symfony/messenger второй раз в жизни...~

Во второй статье показаны вроде бы понятные пути решения, причём с использованием компонента Symfony Console (прям как мне и надо). Но всё же в этой статье нет рабочего примера, в котором всё сведено воедино и который можно просто запустить и посмотреть, как оно работает.

К тому же, обе статьи "заточены" под дополнительную установку либо базы данных Redis, либо брокера сообщений RabbitMQ. что как-то немного перебор для учебного примера…

Готовый пример использования Symfony Messenger и Symfony Console
----------------------------------------------------------------

Ставить Redis либо RabbitMQ только ради того, чтобы попробовать, как работает Symfony Messenger, ~и отлавливать связанные с их установкой и настройкой глюки~ мне не хотелось и, взяв за основу вышеуказанные статьи и имея в виду официальную документацию, я создал собственный самодостаточный пример, в котором очередь сообщений хранится в используемой через Doctrine базе данных SQLite (не кидайтесь в меня сами знаете чем — пример учебный ;-) ).

Сам пример можно взять отсюда: [https://github.com/balpom/symfony-messenger-sample](https://github.com/balpom/symfony-messenger-sample)

Либо можно установить через Composer:  
`composer create balpom/symfony-messenger-sample`

Как запустить пример
--------------------

### Простой пример работы Symfony Messenger

После установки откройте консоль и перейдите в созданную Composer'ом директорию symfony-messenger-sample.  
Выполните команду:  
`php bin/console messenger:consume doctrine-async`  
Эта команда запустит простой Worker, имитирующий отправку SMS. Сейчас он ждёт, когда в очереди появятся сообщения.

Откройте другую консоль и выполните команду:  
`php tests/send.php`  
Эта команда запустит простой скрипт, который добавит несколько сообщений в очередь.  
После этого в первой консоли можно увидеть, как Worker "отправляет" SMS, взятые им из очереди.

### Пример работы Symfony Messenger в несколько потоков

Из директории symfony-messenger-sample откройте несколько консолей (трёх-четырёх будет достаточно :-) ) и в каждой из них выполните команду:  
`php bin/console messenger:consume doctrine-async`

Откройте ещё одну консоль и выполните команду:  
`php tests/sendmany.php`  
Эта команда запустит простой скрипт, который единомоментно добавит в очередь несколько десятков сообщений.  
После этого в ранее открытых консолях можно увидеть, как Worker'ы совместно "отправляют" SMS, берущиеся ими из очереди.

### Symfony Messenger: как остановить работу Worker'ов

Выполните команду:  
`php bin/console messenger:stop-workers`  
При этом все Worker'ы должны мягко остановиться.

Тонкости работы Symfony Messenger
---------------------------------

Не буду здесь подробно описывать как работает вышеуказанный пример - на то он и пример, чтобы его изучить и принцип работы понять в процессе изучения.  
Скажу лишь, что за основную основу :-) была взята статья [https://habr.com/ru/articles/596559/](https://habr.com/ru/articles/596559/) и более-менее пример сделан по этой статье. По сути, в ней всё и описано. ;-)

### В Symfony 6 реализации транспорта не входят в компонент Messenger

Как я понимаю, примеры в вышеуказанных статьях делались на версии компонентов Symfony младше версии 6.  
И в этих версиях, как я понимаю, реализации транспорта Ampq, Redis и Doctrine входили в состав компонента Messenger.

Начиная с Symfony 6 эти компоненты нужно устанавливать как отдельные компоненты:  
Ampq - symfony/amqp-messenger  
Redis - symfony/redis-messenger  
Doctrine - symfony/doctrine-messenger

Также существуют компоненты транспорта symfony/amazon-sqs-messenger и symfony/beanstalkd-messenger.

### У вас тоже не останавливаются Worker'ы по команде messenger:stop-workers?

Отдельно остановлюсь вот на каком моменте: по идее при выполнении команды `php bin/console messenger:stop-workers` все работающие Worker'ы должны мягко завершить свою работу.  
Причём сам же Worker при запуске радостно сообщает:  
_The worker will automatically exit once it has received a stop signal via the messenger:stop-workers command._

![](https://habrastorage.org/getpro/habr/upload_files/b51/e47/bbe/b51e47bbeadc993096a736916beb78ff.png)

The worker will automatically exit once it has received a stop signal via the messenger:stop-workers command.

Ну то есть как бы подразумевается, что по умолчанию команда `php bin/console messenger:stop-workers` должна работать "из коробки".

Однако в первоначальной версии моего примера по команде messenger:stop-workers Worker'ы не останавливались...

В статье [https://habr.com/ru/articles/596559/](https://habr.com/ru/articles/596559/) автор упоминал следующее (цитата):  
_"Для команды stopWorkersCommand нужно передать адаптер кэширования, для возможности мягкой остановки воркеров, чтобы избежать ситуации когда воркер уже взял сообщение из очереди, но ещё не успел его обработать."_

Сходу было непонятно, причём тут какой-то там кэш и нахрена он нужен. ;-)  
Как я понял позже, команда `messenger:stop-workers` прописывает куда-то в кэш некое значение, при появлении которого работающий в бесконечном цикле Worker (который каким-то образом должен "знать" об этом кэше), прекращает свою работу.  
И действительно, в файле bin/console автор этой статьи передаёт команде stopWorkersCommand экземпляр объекта кэша FilesystemAdapter.

Если посмотреть класс команды stopWorkersCommand, то видно, что всё, что он делает - это добавляет в кэш $cacheItem = $this->restartSignalCachePool->getItem(StopWorkerOnRestartSignalListener::RESTART\_REQUESTED\_TIMESTAMP\_KEY);

Worker запускается внутри класса ConsumeMessagesCommand.  
Я чувствовал, что каким-то образом этот же адаптер кэша должен быть известен и команде ConsumeMessagesCommand, также описанной в файле bin/console.  
Но нигде и никак этот FilesystemAdapter больше не фигурировал, кроме как в stopWorkersCommand...

Сломав весь мозг, пытаясь понять, в чём дело, я полез во внутренности класса Symfony\\Component\\Messenger\\Command\\ConsumeMessagesCommand.  
Его изучение навело меня на мысль, что Worker, запускаемый командой ConsumeMessagesCommand, по умолчанию почему-то не слушает событие StopWorkerOnRestartSignalListener, которое, по идее, и останавливает работающий Worker.

В-общем, я придумал, как решить проблему неостанавливающихся Worker'ов...  
Исходно команды в файле bin/console описывались следующим образом (по сути, точно как у автора вышеупомянутой статьи):

```
$cacheItemPool = $container->get(CacheItemPoolInterface::class);$commands = [    new ConsumeMessagesCommand(            new RoutableMessageBus($container),            $container,            new EventDispatcher(),            new ConsoleLogger($output, [])    ),    new StopWorkersCommand($cacheItemPool)];
```

После добавления в EventDispatcher подписчика StopWorkerOnRestartSignalListener, инициализированного FilesystemAdapter'ом, Worker'ы начали останавливаться:

```
$cacheItemPool = $container->get(CacheItemPoolInterface::class);$eventDispatcher = new EventDispatcher();$eventDispatcher->addSubscriber(new StopWorkerOnRestartSignalListener($cacheItemPool));$commands = [    new ConsumeMessagesCommand(            new RoutableMessageBus($container),            $container,            $eventDispatcher,            new ConsoleLogger($output, [])    ),    new StopWorkersCommand($cacheItemPool)];
```

Заключение
----------

1) Если авторы вышеуказанных статей не столкнулись с проблемой Worker'ов, которые не хотят останавливаться по команде messenger:stop-workers, то, возможно, потому, что во время написания ими своих статей Symfony 6 ещё не существовало, а в более младших версиях компонентов Symfony могло быть всё по-другому...

2) Symfony Messenger и Symfony Console, несомненно, мощные, гибкие и востребованные инструменты и изучение их возможностей требует времени и усилий — это нормально. :-)  
Всё большое начинается с малого и надеюсь, что мой пример кому-то сэкономит день-другой в вопросе изучения с нуля Symfony Messenger.

3) Отдельно однако хочу высказать своё небольшое "фи" создателям компонента Symfony Messenger:  
не знаю как остальные, но я, как "symfony-чайник", выводимое Worker'ом сообщение _The worker will automatically exit once it has received a stop signal via the messenger:stop-workers command_ воспринимаю как поведение по-умолчанию и буквально.  
В том смысле, что "из коробки" Worker должен, как он сам и заявляет, в безусловном порядке прекращать работу при исполнении команды messenger:stop-workers.

На этом всё.  
Успехов в изучении Symfony Messenger и Symfony Console!

Если эта публикация вас вдохновила и вы хотите поддержать автора — не стесняйтесь нажать на кнопку