# Как переиспользовать код с бандлами Symfony 5? Часть 2. Выносим код в бандл / Хабр
Время на прочтение8 мин

Количество просмотров4.1K

Поговорим о том, как прекратить копипастить между проектами и вынести код в переиспользуемый подключаемый бандл Symfony 5. Серия статей, обобщающих мой опыт работы с бандлами, проведет на практике от создания минимального бандла и рефакторинга демо-приложения, до тестов и релизного цикла бандла.

В [предыдущей статье](https://habr.com/ru/post/498134/) мы создали минимальный бандл из двух файлов и подключили его в проект.

В этой статье:

  

*   Перенос кода в бандл
*   Dependency Injection: регистрация сервисов бандла в DI-контейнере
*   Перенос контроллеров и настройка роутинга
*   Механизм определения путей к ресурсам
*   Перенос шаблонов в бандл

Если вы не последовательно выполняете туториал, то [скачайте приложение из репозитория](https://github.com/bravik/symfony-bundles-tutorial) и переключитесь на ветку [1-bundle-mockup](https://github.com/bravik/symfony-bundles-tutorial/tree/1-bundle-mockup).

Инструкции по установке и запуску проекта в файле `README.md`.

Финальную версию кода для этой статьи вы найдете в ветке [2-basic-refactoring](https://github.com/bravik/symfony-bundles-tutorial/tree/2-basic-refactoring).

Приступим к рефакторингу.

  

Перемещаем основные файлы
-------------------------

  

> Бандл может содержать все то же самое, что и обычные приложения Symfony: сущности, контроллеры и команды, шаблоны, ассеты, тесты и любой другой код.

Переместите файлы сущностей, репозиториев, формы и необходимые контроллеры в `bundles/CalendarBundle/src` (с сохранением структуры папок):

  

```
# Crate dirs
cd bundles/CalendarBundle/src/
mkdir Controller Entity Service
cd ../../../src

# Move files
mv Form Repository ../bundles/CalendarBundle/src/
mv Controller/EditorController.php Controller/EventController.php ../bundles/CalendarBundle/src/Controller
mv Entity/Event.php ../bundles/CalendarBundle/src/Entity
mv Service/EventExporter ../bundles/CalendarBundle/src/Service/EventExporter
mv Twig ../bundles/CalendarBundle/src/Twig
```

![](https://habrastorage.org/webt/yj/pg/bn/yjpgbnikvizkr1n2nrxlcsllogy.png)

Чтобы перемещенный код заработал, нам потребуется обновить пространства имен перемещенных классов. Поменяйте везде после ключевых слов `namespace` и `use` корень `App\` на корень бандла `bravik\CalendarBundle\`.

Внутри бандла не должно остаться никаких зависимостей от пространства имен `App\`: для бандла его не существует.

Все современные IDE имеют функцию поиска и замены по файлам.  
Например в IDE PhpStorm выбираем папку бандла и жмем `Ctrl/Cmd + Shift + R`.

Кроме папки бандла нам потребуется сделать то же самое для `use App\Repository\EventRepository` в `SiteController`

![](https://habrastorage.org/webt/yb/p7/ce/ybp7ceo6niwa92j6mq2ml3ptwuq.png)

Меняем везде и пробуем открыть главную страницу.

Получаем ошибку:

![](https://habrastorage.org/webt/pp/zq/pv/ppzqpv47zh5pzv4rp-4vf1s8dkc.png)

В `SiteController` мы внедряем зависимость: репозиторий `EventRepository`. С помощью механизма autowiring Symfony автоматически распознает typehints аргументов экшна и ищет нужный сервис среди зарегистрированных в DI-контейнере.

Но если в приложении все классы из папки `src/Services` автоматически регистрируются как сервисы, то в бандле никакие классы пока не зарегистрированы.

  

Регистрация сервисов бандла в Dependency Injection контейнере
-------------------------------------------------------------

  

> Ключевая фишка бандла, это автоматическая подгрузка в DI-контейнер приложения своих зависимостей, прямо при установке.

Но если для пользователя бандла она автоматическая, то его разработчику нужно все настроить.

Как и в обычном приложении, для Symfony-бандла мы можем создать конфиг `services.yaml`, в котором будут описаны регистрируемые бандлом в контейнере DI-сервисы.

В корне бандла рядом `src` создайте папку и файл `config/services.yaml`:

  

```
parameters:
    # Здесь могут быть параметры бандла

services:

    # Конфигурация для всех сервисов  этого файла по умолчанию
    _defaults:

        # Включает механизм автоматической подстановки зависимостей контейнера
        # в ваши сервисы по typehints аргументов конструктора (и экшнов контроллеров)
        # https://symfony.com/doc/current/service_container.html#the-autowire-option
        autowire: true

        # Включает механизм автоконфигурации:
        # сервисам автоматически добавляются теги по имплементируемым интерфейсам
        # https://symfony.com/doc/current/service_container.html#the-autoconfigure-option
        autoconfigure: true 

    # Регистрируем контроллеры бандла и репозиторий как DI-сервисы
    bravik\CalendarBundle\Repository\EventRepository: ~
    bravik\CalendarBundle\Controller\EventController: ~
    bravik\CalendarBundle\Controller\EditorController: ~
```

Мы задали настройки по умолчанию для всего файла и зарегистрировали 3 сервиса.

Но в конфиге приложения-хоста `config/services.yaml` у нас осталось еще несколько строк, которые нужно перенести в бандл.

Закомментируйте помеченные `@todo` строки и перенесите следующие строки в бандл:

  

```
# Фильтр Twig для форматирования даты
bravik\CalendarBundle\Twig\TwigRuDateFilter: ~

# Регистрируем все классы компонента EventExporter как DI-сервисы
bravik\CalendarBundle\Service\EventExporter\:
    resource: '../src/Service/EventExporter/*'

# Регистрируем ExporterProvider в качестве DI-сервиса
# и явно инжектим 2 экспортера в конструктор
bravik\CalendarBundle\Service\EventExporter\ExporterManager:
    arguments:
        $exporters:
            - '@bravik\CalendarBundle\Service\EventExporter\Exporters\GoogleCalendarExporter'
            - '@bravik\CalendarBundle\Service\EventExporter\Exporters\ICalendarExporter'
```

Если мы сейчас обновим страницу, то увидим, что ничего не изменилось. Файл конфигурации автоматически не подхватывается фреймворком, и нам нужно подключить его вручную. Для этого в папке `src` бандла создадим папку и класс `DependencyInjection/CalendarExtension.php`:

  

```
<?phpnamespace bravik\CalendarBundle\DependencyInjection;use Exception;use Symfony\Component\DependencyInjection\ContainerBuilder;use Symfony\Component\DependencyInjection\Extension\Extension;class CalendarExtension extends Extension{    public function load(array $configs, ContainerBuilder $container)    {    }}
```

Это очень [важный для бандла класс](https://symfony.com/doc/current/bundles/extension.html#creating-an-extension-class). Он должен называться строго в формате `<BundleName>Extension`, располагаться в папке `src/DependencyInjection` и наследоваться от `Symfony\Component\DependencyInjection\Extension\Extension`.

  

> Когда Symfony компилирует DI-контейнер, фреймворк проходится по всем подключенным бандлам и ищет в них именно Extension-файл. Если он существует, то вызывается метод `Extension::load()` в который передается собираемый контейнер приложения.

Это место, где мы можем добавить в контейнер собственные сервисы бандла. Технически мы могли обойтись и без файла конфигурации, и зарегистрировать все нужные сервисы прямо здесь в PHP-коде. Но удобней объявлять их привычным способом в отдельном конфигурационном файле.

Добавим `services.yaml` бандла в сборку:

  

```
public function load(array $configs, ContainerBuilder $container){    $loader = new YamlFileLoader(        $container,        new FileLocator(__DIR__.'/../../config')    );    $loader->load('services.yaml');}
```

Снова обновим страницу, и снова получаем ошибку:

![](https://habrastorage.org/webt/jb/mb/_e/jbmb_emhogpmw-ixhrftit7fieo.png)

На этот раз приложение не может найти роут контроллера.

  

Настройки роутинга в бандле
---------------------------

В приложениях Symfony настройки роутинга прописываются в файлах:

  

```
config/routes.yaml              # Здесь указываются роуты
config/routes/annotations.yaml  # Здесь подключаются роуты,
                                # размеченные аннотациями в контроллерах
```

В контроллерах нашего бандла роуты размечены аннотациями. Посмотрим как они подключаются в `annotations.yaml`:

  

```
controllers:                          # Произвольный идентификатор
    type: annotation                  # Тип подкючаемого ресурса
    resource: ../../src/Controller/   # Путь к файлам, размеченным аннотациями
```

Создадим такой же файл в папке с конфигами нашего бандла: `config/routes.yaml`.

  

```
calendar_routes:
    type: annotation
    resource: '../src/Controller/'
```

Теперь нужно подключить настройки бандла к конфигурации аннотаций приложения `config/routes/annotations.yaml`.

Добавим туда строки:

  

```
calendar_bundle:
    resource: '@CalendarBundle/config/routes.yaml'
```

Здесь в качестве ресурса мы указываем наш конфиг в бандле.  
`@CalendarBundle` — заменяет относительный путь к корню бандла.

Компонент роутинга Symfony имеет полезные для бандлов настройки префиксов.

Например, что если бы у нас была админка по адресу `/admin` и мы хотели бы наш редактор событий как-то в неё интегрировать: чтобы путь к нему начинался так же с /admin и чтобы он был спрятан за общей формой логина?

Мы можем добавить префиксы к роутам бандла, а при желании можем даже добавить префикс к именам роута:

  

```
calendar_bundle:
    resource: '@CalendarBundle/config/routes.yaml'
    prefix:   /admin
    name_prefix: cms.
```

А дальше с помощью компонента `security` вы можете тонко настроить доступы и роли. Настройки ролей и доступов логично делать вне бандла, это специфичное для каждого приложения поведение.

Чтобы избежать конфликта имен, Symfony [рекомендует всегда использовать](https://symfony.com/doc/current/bundles/best_practices.html#routing) в названиях роутов бандла префиксы `vendor_name_`. Мы не будем придерживаться этой рекомендации.

  

Пути к ресурсам бандла
----------------------

  

> Для обращения к ресурсам бандла в конфигах, а так же в шаблонах Twig у фреймворка предусмотрена [«логическая» ссылка на бандл](https://symfony.com/doc/current/bundles/best_practices.html#resources).

Её можно использовать в формате:

  

*   `@<BundleName>Bundle/path/to/config` — в файлах конфига
*   `@<BundleName>/path/to/template` — упрощенный вариант в шаблонах.

В Symfony это называется «логические пути». Их использование позволяет легко переопределять любые шаблоны бандла. Об этом позже.

Однако по умолчанию ссылка указывает не на корень бандла а на директорию `./src`. Так сложилось исторически, потому что до Symfony 4 принято было ресурсы приложения и бандлов помещать внутри папки `src/Resources`. Начиная с 4 версии [рекомендованная Symfony структура приложений и бандлов стала такой](https://github.com/symfony/symfony/blob/master/UPGRADE-5.0.md#httpkernel), какой вы видите её сейчас — чище и понятней. Однако легаси осталось и нам нужно внести небольшое изменение, чтобы это поправить.

Переопределим в главном файле бандла `CalendarBundle` метод `getPath()`:

  

```
public function getPath(): string{    return dirname(__DIR__);}
```

Теперь `@CalendarBundle` будет указывать на корень нашего бандла.

Обновим страницу, и на этот раз мы увидим наш календарь!

![](https://habrastorage.org/webt/jt/gl/7l/jtgl7llkdqicn5frk-vm5yqj0ju.png)

Но как же так? Мы ведь не скопировали в бандл шаблоны.

Посмотрим на наши контроллеры бандла. Обратите внимание, что они обращаются к шаблонам по абсолютным путям, а значит используют шаблоны из приложения-хоста.

  

Перенос шаблонов в бандл
------------------------

Создадим в корне бандла папку `templates` для шаблонов и перенесем туда содержимое папки `templates/event` из приложения:

  

```
mkdir bundles/CalendarBundle/templates
mv templates/event/* bundles/CalendarBundle/templates
```

Если мы обновим страницу — увидим, что шаблон не найден. Так и должно быть.

С помощью инструмента «Поиск и замена»вашей IDE замените в контроллерах бандла пути к шаблонам на логические относительно бандла. Для этого вхождения `event/` в пути шаблона замените на логическую ссылку `@Calendar/`.

![](https://habrastorage.org/webt/wu/6k/-z/wu6k-z_ljpbd4g0okruxtiq9ddo.png)

  

> На самом деле `@Calendar` в шаблонах Twig это уже не совсем логическая ссылка, а [namespace](https://symfony.com/doc/4.1/templating/namespaced_paths.html) в терминологии Twig. Папку `templates` в путях указывать не нужно, так как Symfony автоматически зарегистрирует namespace, и ассоциирует его с папкой `templates` или `Resources/views` (если папки бандла организованы по старой конвенции).

Кроме этого на главной странице приложения в шаблоне `site/index.html.twig` мы используем виджет календаря из подключаемого twig-шаблона. Точно так же заменим путь к шаблону виджета на относительный путь из бандла:

![](https://habrastorage.org/webt/co/ga/bh/cogabhmmbrlh4c6s2udfode5cay.png)

Обновим страницу, — календарь снова на месте.

Но с шаблонами все еще остается еще одна проблема: некоторые шаблоны бандла унаследованы от базового шаблона `base.html.twig` приложения-хоста:

  

```
{% extends 'base.html.twig' %}
```

Этой проблемой мы займемся в следующей статье.

  

Резюме
------

Мы рассмотрели процесс переноса кода, шаблонов и ассетов в бандл, настроили роутинг и подключили сервисы бандла к сборке DI-контейнера. Финальный код Example Project для этой статьи в ветке [2-basic-refactoring](https://github.com/bravik/symfony-bundles-tutorial/tree/2-basic-refactoring).

  

*   Перенос кода в бандл, — это копирование файла с заменой namespace и путей импорта. В бандле не должно остаться зависимостей от пространства имен приложения `App`
*   Основной класс бандла, — Extension-класс. С его помощью можно вмешаться в компиляцию DI-контейнера приложения и подключить к нему собственные сервисы бандла. Удобно определять сервисы не в самом классе, а с помощью конфигурационного файла.
*   Роуты бандла можно определять в конфигурационных файлах внутри бандла. Эти файлы подключаются в настройках роутинга приложения хоста. Можно использовать аннотации в контроллерах бандла.
*   Пути к файлом ресурсов, в том числе к конфигах, шаблонам и т.д., определяются с помощью «логической» ссылки на бандл, указывающей на корневую папку бандла. С её помощью ресурсы бандла можно переопределять в приложении хосте.

В [следующей статье](https://habr.com/ru/post/498610/) разберемся как интегрировать шаблоны, JS и стили бандла в приложение-хост.

  

Другие статьи серии:
--------------------

[Часть 1. Минимальный бандл](https://habr.com/ru/post/498134/)  
**Часть 2. Выносим код и шаблоны в бандл**  
[Часть 3. Интеграция бандла с хостом: шаблоны, стили, JS](https://habr.com/ru/post/498610/)  
[Часть 4. Интерфейс для расширения бандла](https://habr.com/ru/post/499074/)  
[Часть 5. Параметры и конфигурация](https://habr.com/ru/post/499076/)  
[Часть 6. Тестирование, микроприложение внутри бандла](https://habr.com/ru/post/500044/)  
[Часть 7. Релизный цикл, установка и обновление](https://habr.com/ru/post/500596/)

Если эта публикация вас вдохновила и вы хотите поддержать автора — не стесняйтесь нажать на кнопку