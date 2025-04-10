# Symfony Panther: зверь в мире тестирования / Хабр
Время на прочтение5 мин

Количество просмотров4.6K

![](https://habrastorage.org/getpro/habr/upload_files/7f6/135/a11/7f6135a11bb03ad0def562edd04a1215.png)

Тестирование приложения — это не самое простое занятие на земле, не самый быстрый процесс и не самая захватывающая часть процесса разработка приложения. Но это необходимо. Вы не можете позволить себе рисковать стабильностью вашего приложения — если оно начнет крашиться, то вы потеряете пользователей, а заодно и деньги. Добавление нового кода в вашу продукцию не должно быть поводом для стресса. По этой причине и существуют тесты, которые проверяют отсутствие регрессии вашего приложения. Если ваш продукт покрыт тестами (_и если вы написали_ **_хорошие_** _тесты_, что в свою очередь является еще одной _обширной_ темой), вы будете намного увереннее добавлять новые фичи и исправления в свой продукт, не опасаясь что-нибудь сломать.

Мы можем примерно очертить три основных типа тестов при создании приложения:

**Модульные (юнит) тесты**, которые заключаются в тестировании небольших фрагментов кода, таких как функции или, возможно, классы. Они не включает ничего, кроме исполняемого кода, и вам нужно мокать внешние зависимости, например, такие как базы данных, создавая моки наборов данных (например, прямо в тестовом коде) специально для этих тестов. **Выполняются они обычно быстро**;

**Функциональные тесты**, которые проверяют функцию/фичу в целом, не заботясь о том, как дела обстоят внутри. Самым типовым применением функциональных тестов является тестирование API: вы проверяете, что, вызывая конкретный URL API с конкретными аргументами, вы получите обратно определенный ответ. Как правило, они включают внешние зависимости от работающих баз данных. Вот почему иногда они могут выполняться немного медленнее, **а в большинстве случаев намного медленнее, чем модульные тесты**;

**Сквозные (end-to-end) тесты**, которые являются наиболее полными, но и наиболее сложными с точки зрения написания и поддержки. Они в основном заключаются в тестирования вашего приложения в реальном веб-браузере. Что безусловно потрясающе, но также требует больше времени на настройку и поддержку актуальности. С учетом того, что вам нужно тестировать реальные страницы с HTML, CSS и Javascript с помощью автоматизированного браузера и то, что вам, вероятно, придется мокать не очень большое количество служб, используемых вашим приложением, **они, как правило, намного медленнее и тяжелее с точки зрения выполнения, чем функциональные тесты**.

Это всегда вопрос компромисса: предпочитаете ли вы писать тесты очень быстро, но только для того, чтобы убедиться, что ограниченная часть критически важного кода работает без ошибок, или длинные и тяжелые тесты, которые проверяют весь рабочий процесс и путь пользователя, что все до по последней кнопки находится на нужном месте? На этот вопрос единогласного четкого ответа нет, но путь к нему, вероятно, лежит в грамотном сочетании этой тройки.

### Так что же из себя представляет Panther?

Symfony Panther относится к третьей категории тестов. 

Созданная [Кевином Дангласом](https://medium.com/u/a98cc4472a35?source=post_page-----aca0131c08f5-----------------------------------), зарелиженная в феврале 2021 года (версия 1.0), Panther представляет собой **standalone-библиотеку** для сквозного тестирования. Даже не смотря на то, что она позиционируется как “_библиотека для браузерного тестирования и веб-скрапинга для PHP и Symfony_”, вы можете без проблем использовать ее в любом PHP-приложении.

Ее синтаксис очень похож на работу с модульными тестами PHPUnit. Первый плюс: если вы привыкли писать модульные тесты с помощью PHPUnit, вам не придется особо переучиваться. Если вы хотите узнать больше о впечатляющих фичах, которые предоставляет Panther, вот некоторые из них, взятые непосредственно из [Github Panther](https://github.com/symfony/panther):

*   Javascript, содержащийся на страницах, будет выполняться (если вы уже выполняли сквозные тесты, то вы знаете, какой болью может обернутся попытка реализовать это);
    
*   Вы можете делать скриншоты, когда захотите, что является очень нужной возможностью при настройке CI или написании тестов;
    
*   Есть возможность ожидания асинхронно загружаемых элементов;
    
*   Все последние инновации, встроенные в Chrome и Firefox, всегда будут присутствовать в Panther.
    

Несколько слов о последнем пункте. Как это возможно? Что ж, консорциум World Wide Web (W3C) в настоящее время работает над стандартизированным интерфейсом под названием WebDriver, чтобы позволить браузерам быть автоматизированными и дистанционно управляемыми. Поскольку он станет веб-стандартом, в будущем мы увидим все больше и больше браузеров, поддерживающих этот интерфейс. Chrome и Firefox уже реализуют этот интерфейс, что позволяет Panther использовать все их возможности.

### А что по фичам?

Как было сказано ранее, если вы знакомы с тестами PHPUnit, то у вас не возникнет никаких проблем с Panther, так как у нее тот же синтаксис. Та же история, если вы уже проводили функциональные тесты с помощью Symfony и его WebTestCases. Синтаксис точно такой же. Причина этого довольно проста: Panther является расширением PHPUnit и определяет PantherTestCase для предоставления некоторых новых ассертов (утверждений), специально созданных для сквозного тестирования. Очевидно, что “классические” ассерты PHPUnit вам также доступны. Среди новых можно выделить следующие:

*   Ассерт заголовка страницы;
    
*   Ассерт, что селектор существует, включен, содержит что-то, виден;
    
*   Ассерт атрибутов;
    
*   Ожидание (wait), станет узел видимым или нет;
    
*   Ожидание, будет ли узел иметь определенный атрибут или значение содержимого;
    
*   _И многое другое!_
    

Доступны еще десятки. Так что да, утверждать — это здорово, но взаимодействовать со страницей тоже очень круто. Panther позволяет легко:

*   Заполнять и отправлять формы;
    
*   Кликать по ссылкам;
    
*   Делать скриншот всего одной строкой кода;
    
*   Получать доступ к консоли браузера;
    
*   _И, опять же, многое другое!_
    

### Как это выглядит?

Чтобы продемонстрировать вам _внешний вид_ Panther и то, как ее следует использовать, вот фрагмент кода (немного подчищенный) из документации:

```
<?phpnamespace App\Tests;use Symfony\Component\Panther\PantherTestCase;/**@see https://github.com/symfony/panther#a-polymorphic-feline*/class E2eTest extends PantherTestCase{public function testMyApp(): void{$client = static::createPantherClient(); // Or static::createPantherClient(['browser' => static::FIREFOX]) for example$client->request('GET', '/mypage'); $this-&gt;assertPageTitleContains('My Title'); $this-&gt;assertSelectorTextContains('#main', 'My body');  $this-&gt;assertSelectorIsEnabled('.search'); $this-&gt;assertSelectorIsDisabled('[type="submit"]'); // ... $client-&gt;waitForStaleness('.popin'); $client-&gt;waitForVisibility('.loader'); $client-&gt;waitForElementToContain('.total', '25 €'); // ... $this-&gt;assertSelectorWillExist('.popin'); $this-&gt;assertSelectorWillNotExist('.popin'); $this-&gt;assertSelectorWillBeVisible('.loader'); $this-&gt;assertSelectorWillNotBeVisible('.loader'); $this-&gt;assertSelectorWillContain('.total', '€25'); // ...}}
```

Не складывается ли впечатление, что мы проводим здесь модульные тесты? Лично мне это очень нравится. Нет необходимости изучать новый синтаксис или язык для создания сквозных тестов, если вы уже привыкли к модульным тестам PHP.

Внутри Panther сама запустит PHP-сервер для выполнения теста. Но это не обязательно, так как вы можете передать Panther внешний базовый URI, если хотите. Таким образом, внутренний сервер PHP не будет запущен.

Не смотря на то, что библиотека [ограничена в некоторых моментах](https://gist.github.com/alexandre-daubois/734abe40c73a1342293b7dee71a7f5ea), Panther предлагает свежий, чистый и эффективный способ создания сквозных тестов в любом PHP-приложении. Документация на [странице Github](https://github.com/symfony/panther) действительно полная и хорошо поможет вам продвинуться в работе с Panther. Я имею в виду, что вы получите избыточные примеры того, как включить его в свой CI, **с фрагментами кода для Github Actions, Travis, Gitlab и AppVeyor**. Вы также найдете все необходимое для интеграции Panther в Docker-контейнер.

Закончу эту статью еще одной замечательной фичей. Он полностью совместим и предназначен для работы с технологиями реального времени, такими как [Mercure](https://github.com/symfony/mercure) и WebSockets!

* * *

> 1\. Поднимаем инстанс хранилища + 4 инстанса раздающего API в докере  
> 2\. В хранилище заливаем картинку  
> 3\. С раздающего API получаем её и кэшируем в инстансе (обсудим, зачем мы должны ее кэшировать)  
> 4\. Дальше удаляем картинку в хранилище.  
> 5\. Показываем, что раздающее API продолжает её получать  
> 6\. Исправляем флоу, добавляя producer/consumer с оповещением об удалении.  
> 7\. Проверяем, что теперь всё работает ok.