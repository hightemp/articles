# How to implement the rate limiter component on a symfony 5 project
A rate limiter is basically a piece of code that will limit the number of request for a period of time. This is particularly usefull to restrict the access of an api for example. Symfony recently added this component on the version 5.2.

I recently wanted to implement the [Rate Limiter component](https://symfony.com/doc/current/rate_limiter.html) on a symfony project but I faced some issues during the development process.

In this tutorial, I will show you how to implement the rate limiter component on a symfony project.

[

Prerequisites
-------------

](#prerequisites)

To enable and use the rate limiter component, you have to use symfony with a minimum version of `5.2`.

A specific version of php is also needed. You need to use a version greater or equal to `7.2.5`.

[

Installation
------------

](#installation)

In order to use it, you will need to, first, install the package.

```null
composer require symfony/rate-limiter
```

Это единственный пакет, который вам понадобится для использования этого компонента. Эта команда автоматически установит пакет, а также все необходимые пакеты, такие как `symfony/lock` или `symfony/options-resolver`.

[

Конфигурация
------------

](#configuration)[

### Файл пакета

](#package-file)

Как указано в [официальной документации](https://symfony.com/doc/current/rate_limiter.html), сначала вам нужно создать файл с именем `rate_limiter.yaml` в папке `config/packages` со следующим содержимым.

```null


framework:
    rate_limiter:
        anonymous_api:
            policy: 'sliding_window'
            limit: 5
            interval: '1 minute'
```

`policy`Атрибут может быть равен трем различным политикам :

*   исправлено\_window
*   скользящее\_окно
*   token\_bucket - корзина токенов

Для получения более подробной информации о каждой из описанных выше политик я рекомендую вам ознакомиться с [официальной документацией](https://symfony.com/doc/current/rate_limiter.html#rate-limiting-policies).

Атрибут `limit` представляет собой количество запросов, разрешённых в течение определённого периода времени. В этом примере мы будем использовать значение `5` для наглядного отображения разрешённых и запрещённых запросов.

Наконец, атрибут `interval` используется для указания периода времени. Вы можете использовать любую единицу измерения, используемую в [формате относительного времени](https://www.php.net/manual/fr/datetime.formats.relative.php).

Вместо атрибута `interval` можно использовать атрибут `rate`. Этот атрибут представляет собой объект, содержащий 2 поля:

*   интервал
*   амоут

Например, вместо использования

```null
interval: '5 minutes'
```

Вы используете

```null
rate: { interval: '5 minutes', amount: 100}
```

Это означает, что каждые 5 минут может быть отправлено 100 запросов. Но общее количество запросов не может превышать значение `limit`

Если вы не отправляете все запросы за один период времени, они не накапливаются.

[

### Переменная среды

](#environment-variable)

Если вы используете версию PHP, скомпилированную с флагом `--enable-sysvsem`, вы можете сразу перейти к следующему разделу. Но если это не так, вам придётся внести ещё несколько изменений.

Вы можете столкнуться со следующей ошибкой :

```null
Semaphore extension (sysvsem) is required.
```

Это означает, что модуль `Semaphore` не включён в вашей версии PHP.

Чтобы исправить это, доступны два варианта :

*   Повторно скомпилируйте PHP, используя флаг `--enable-sysvsem`,
*   Просто измените `LOCK_DNS` значение в `.env` файле.

Я настоятельно рекомендую второй вариант, он намного проще первого.

Изначально значение `LOCK_DNS` было равно `semaphore`. Чтобы исправить эту ошибку, вам просто нужно изменить его на `flock`.

[

Создайте поддельный API
-----------------------

](#create-a-fake-api)

Давайте создадим фиктивный API, чтобы протестировать этот компонент.

Сначала мы создадим контроллер с помощью `make:controller` в консоли Symfony.

```null
 php bin/console make:controller MainController
```

В этом контроллере мы создадим два маршрута.

*   Первый вернет json для подделки api,
*   Вторым будет традиционный HTTP-маршрут.

Цель состоит в том, чтобы ограничить количество запросов к каждому api-маршруту.

В этот контроллер мы просто вставим следующее содержимое.

```null
<?php



namespace App\Controller;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

class MainController extends AbstractController
{
    
    public function index(): Response
    {
        return $this->json([
            'message' => 'Hello World!',
        ]);
    }

    
    public function home(): Response
    {
        return new Response("Hello world !");
    }
}
```

Важно то, что каждый маршрут API начинается с `api_` и каждый маршрут HTTP начинается с `app_`.

Теперь, если вы обслуживаете свое приложение symfony с помощью :

```null
php -S localhost:8080 -t public
```

И перейдите по адресу [localhost:8080/api](http://localhost:8080/api), вы должны увидеть что-то вроде этого:

```null
{
    "message": "Hello World!"
}
```

Теперь осталось только внедрить логику ограничения скорости в наш код.

[

Реализуйте логику ограничения скорости
--------------------------------------

](#implement-the-rate-limit-logic)

Вы можете просто добавить логику ограничения скорости для каждого маршрута API, но это быстро надоест. Поэтому я рекомендую использовать `EventSubscriber` для выполнения одной и той же логики для каждого запроса.

Чтобы создать подписчика на событие, вам просто нужно создать файл, мы назовем его `RateLimiterSubscriber.php` но вы можете называть его как хотите, в `src/EventSubscriber` папке.

Класс, содержащийся в этом новом файле, должен реализовывать `EventSubscriberInterface`.

Нам также нужно будет добавить в этот класс закрытый атрибут. Этот атрибут должен соответствовать имени ограничителя скорости в верблюжьем регистре с последующим `Limiter`.

В нашем случае это файл `config/package/rate_limiter.yaml`, мы назвали его `anonymous_api`, поэтому нам нужно будет назвать его `anonymousApiLimiter` вот так.

```null



private $anonymousApiLimiter;
```

Теперь давайте инициализируем этот закрытый атрибут.

```null


public function __construct(RateLimiterFactory $anonymousApiLimiter)
{
    $this->anonymousApiLimiter = $anonymousApiLimiter;
}
```

Далее мы найдём функцию `getSubscribedEvent`, которая требуется для `EventSubscriberInterface`. Поскольку мы хотим выполнять логику ограничения скорости для каждого запроса, мы будем вызывать метод `onKernelRequest` для каждого `RequestEvent`.

```null


public static function getSubscribedEvents(): array
{
  return [
        RequestEvent::class => 'onKernelRequest',
  ];
}
```

Наконец, нам нужно создать `onKernelRequest` , который будет содержать нужную нам логику. В нашем случае мы хотим:

*   Получить запрос,
*   Проверьте, содержит ли запрошенное название маршрута `api_`,
*   Извлеките ограничитель на основе идентификатора,
*   Используйте один запрос,
*   Проверьте, разрешен ли запрос (меньше установленного лимита).

Это должно выглядеть примерно так.

```null


public function onKernelRequest(RequestEvent $event): void {
    
  $request = $event->getRequest();

    
  if(strpos($request->get("_route"), 'api_') !== false) {

        
        $limiter = $this->anonymousApiLimiter->create($request->getClientIp());

        
        if (false === $limiter->consume(1)->isAccepted()) {
          throw new TooManyRequestsHttpException();
        }
  }
}
```

Сгруппировав каждую часть, мы получим что-то вроде этого :

```null
<?php



namespace App\EventSubscriber;

use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class RateLimiterSubscriber implements EventSubscriberInterface {

   
   private $anonymousApiLimiter;

   public function __construct(RateLimiterFactory $anonymousApiLimiter) {
      $this->anonymousApiLimiter = $anonymousApiLimiter;
   }

   public static function getSubscribedEvents(): array {
      return [
         RequestEvent::class => 'onKernelRequest',
      ];
   }

   public function onKernelRequest(RequestEvent $event): void {
      $request = $event->getRequest();
      if(strpos($request->get("_route"), 'api_') !== false) {
         $limiter = $this->anonymousApiLimiter->create($request->getClientIp());
         if (false === $limiter->consume(1)->isAccepted()) {
            throw new TooManyRequestsHttpException();
         }
      }
   }
}
```

Теперь, если вы вернётесь на [localhost:8080/api](http://localhost:8080/api) и нажмёте `F5` более 5 раз за 1 минуту, вы получите сообщение об ошибке `HTTP 429 Too Many Requests`, что означает, что всё действительно работает 👍.

[

Заключение
----------

](#conclusion)

Теперь вы должны уметь самостоятельно внедрять компонент ограничения скорости в Symfony. Таким образом вы можете в некоторой степени защитить API, разрешив определённое количество запросов за определённый период времени. Я подробно описал всё в этом репозитории на GitHub: [MrAnyx/test-rate-limiter](https://github.com/MrAnyx/test-rate-limiter).

_Обложка от [Натана Думлао](https://unsplash.com/@nate_dumlao)_