# Рейт-лимитинг ваших Symfony API / Хабр
Время на прочтение5 мин

Количество просмотров3.8K

![](https://habrastorage.org/getpro/habr/upload_files/9c8/fda/25e/9c8fda25e70ed29f25fd6641d83c7acc.png)

В процессе разработке у вас может возникнуть необходимость наложить на ваши API какой-нибудь кастомный рейт-лимит (т.е. ограничить количество запросов для пользователей вашего API). В этой статье я покажу вам, как можно объединить компонент symfony/rate-limiter со стандартными контроллерами.

#### Рейт-лимит конфигурация

Наша конечная цель заключается в том, чтобы следующая рейт-лимит конфигурация работала на любом маршруте, на котором вы захотите, - благодаря атрибутам PHP8:

```
framework:  rate_limiter:    account_create:      policy: 'fixed_window'      limit: 5      interval: '60 minutes'    account_modify: # активация аккаунта, редактирование профиля      policy: 'fixed_window'      limit: 30      interval: '60 minutes'
```

В этой статье опущен разбор самого компонента, поэтому я рекомендую вам прочитать [документацию Symfony по RateLimiter](https://symfony.com/doc/current/rate_limiter.html), если вы хотите разобраться, как он работает, и как его настраивать.

#### Атрибут

Прежде всего, нам нужен атрибут, который мы будем использовать в объявлении маршрутов, количество запросов по которым должно быть ограничено. Здесь нам дополнительно потребуется ключ конфигурации ($configuration), чтобы определить, какую именно рейт-лимит конфигурацию мы собираемся применить:

```
#[Attribute(Attribute::TARGET_METHOD)]class RateLimiting{  public function __construct(    public string $configuration,  ) {  }}
```

#### Контроллер

Теперь давайте применим наш атрибут к каком-нибудь контроллеру:

```
#[RateLimiting('account_create')]
#[Route('/create', methods: ['POST'])]
public function createAccount(): JsonResponse
{
  // логика вашего контроллера ...
}
```

И это все, что нам нужно сделать, чтобы применить рейт-лимит к маршруту.

#### CompilerPass

Но для того, чтобы это заработало, нам нужно заставить Symfony понимать эти атрибуты. То есть нам нужен `CompilerPass` для хранения всех маршрутов с нашим атрибутом, чтобы избежать рефлексии в рантайме:

```
class RateLimitingPass implements CompilerPassInterface{  public function process(ContainerBuilder $container): void  {    if (!$container->hasDefinition(ApplyRateLimitingListener::class)) {      throw new \LogicException(sprintf('Can not configure non-existent service %s', ApplyRateLimitingListener::class));    }    $taggedServices = $container->findTaggedServiceIds('controller.service_arguments');    /** @var Definition[] $serviceDefinitions */    $serviceDefinitions = array_map(fn (string $id) => $container->getDefinition($id), array_keys($taggedServices));    $rateLimiterClassMap = [];    foreach ($serviceDefinitions as $serviceDefinition) {      $controllerClass = $serviceDefinition->getClass();      $reflClass = $container->getReflectionClass($controllerClass);      foreach ($reflClass->getMethods(\ReflectionMethod::IS_PUBLIC | ~\ReflectionMethod::IS_STATIC) as $reflMethod) {        $attributes = $reflMethod->getAttributes(RateLimiting::class);        if (\count($attributes) > 0) {          [$attribute] = $attributes;          $serviceKey = sprintf('limiter.%s', $attribute->newInstance()->configuration);          if (!$container->hasDefinition($serviceKey)) {            throw new \RuntimeException(sprintf(‘Service %s not found’, $serviceKey));          }          $classMapKey = sprintf('%s::%s', $serviceDefinition->getClass(), $reflMethod->getName());          $rateLimiterClassMap[$classMapKey] = $container->getDefinition($serviceKey);        }      }    }    $container->getDefinition(ApplyRateLimitingListener::class)->setArgument('$rateLimiterClassMap', $rateLimiterClassMap);  }}
```

Здесь мы получаем все контроллеры и проверяем для каждого метода, есть ли у них наш атрибут, после чего связываем маршрут с соответствующей службой ограничения количества запросов и добавляем его в наш кэш.

#### Слушатель

Теперь, когда Symfony понимает наш атрибут и кэширует его, нам понадобится слушатель событий, чтобы подключиться к событию `kernel.controller` и проверить, в порядке ли наш рейт-лимит или нет.

```
class ApplyRateLimitingListener implements EventSubscriberInterface{  public function __construct(    private TokenStorageInterface $tokenStorage,    /** @var RateLimiterFactory[] */    private array $rateLimiterClassMap,    private bool $isRateLimiterEnabled,    private RequestStack $requestStack,    private RoleHierarchyInterface $roleHierarchy,  ) {  }  public function onKernelController(KernelEvent $event): void  {    if (!$this->isRateLimiterEnabled || !$event->isMainRequest()) {      return;    }    $request = $event->getRequest();    /** @var string $controllerClass */    $controllerClass = $request->attributes->get('_controller');    $rateLimiter = $this->rateLimiterClassMap[$controllerClass] ?? null;    if (null === $rateLimiter) {      return; // этому контроллеру не назначена служба ограничения количества запросов    }    $token = $this->tokenStorage->getToken();    if ($token instanceof TokenInterface && in_array('ROLE_GLOBAL_MODERATOR', $this->roleHierarchy->getReachableRoleNames(($token->getRoleNames())))) {      return; // игнорируем ограничение количества запросов для модератора сайта и привилегированных ролей    }        $this->ensureRateLimiting($request, $rateLimiter, $request->getClientIp());  }  private function ensureRateLimiting(Request $request, RateLimiterFactory $rateLimiter, string $clientIp): void  {    $limit = $rateLimiter->create(sprintf('rate_limit_ip_%s', $clientIp))->consume();    $request->attributes->set('rate_limit', $limit);    $limit->ensureAccepted();    $user = $this->tokenStorage->getToken()?->getUser();    if ($user instanceof User) {      $limit = $rateLimiter->create(sprintf('rate_limit_user_%s', $user->getId()))->consume();      $request->attributes->set('rate_limit', $limit);      $limit->ensureAccepted();    }  }  public static function getSubscribedEvents(): array  {    return [KernelEvents::CONTROLLER => ['onKernelController', 1024]];  }}
```

В этом примере я решил игнорировать ограничения количества запросов для наших глобальных модераторских ролей. Для всех остальных пользователей я проверяю рейт-лимит на двух уровнях: IP, а затем User, если они залогинены. Таким образом мы можем избежать рассылки спама пользователями с разных IP-адресов. Мне нравится использовать такие бизнес-правила, но вы можете настроить все по своему усмотрению.

Также вы можете заметить, что мы указываем службу ограничения количества запросов перед каждой проверкой: если у нас будет превышение рейт-лимита, будет выброшено исключение (благодаря методу `ensureAccepted`), и вторая проверка не произойдет, у нас будет указана правильная служба ограничения количества запросов.

#### Заголовки

Наконец, чтобы получишь больше информации от службы ограничения количества запросов, мы можем сгенерировать несколько заголовков, чтобы указать, как прошел рейт-лимитинг, и какие-нибудь другие показатели:

```
final class RateLimitingResponseHeadersListener{  public function onKernelResponse(ResponseEvent $event): void  {    if (($rateLimit = $event->getRequest()->attributes->get('rate_limit')) instanceof RateLimit) {      $event->getResponse()->headers->add([        'RateLimit-Remaining' => $rateLimit->getRemainingTokens(),        'RateLimit-Reset' => time() - $rateLimit->getRetryAfter()->getTimestamp(),        'RateLimit-Limit' => $rateLimit->getLimit(),      ]);    }  }}
```

Я взял имена заголовков из [RFC заголовков RateLimit](https://tools.ietf.org/id/draft-polli-ratelimit-headers-00.html). Хоть это все еще черновик, но эти заголовки уже широко используются.

Вот и все - с помощью всего нескольких строк кода вы можете реализовать рейт-лимит для любого маршрута, просто добавив свой новый атрибут `RateLimiting`!

* * *

> Материал подготовлен в рамках курса [«Symfony Framework»](https://otus.pw/BA7w/).
> 
> Всех желающих приглашаем на бесплатное demo-занятие **«Инвалидация кэша в распределённой системе»**. На demo-уроке будем заниматься по следующему плану:
> 
> 1\. Поднимаем инстанс хранилища + 4 инстанса раздающего API в докере  
> 2\. В хранилище заливаем картинку  
> 3\. С раздающего API получаем её и кэшируем в инстансе (обсудим, зачем мы должны ее кэшировать)  
> 4\. Дальше удаляем картинку в хранилище.  
> 5\. Показываем, что раздающее API продолжает её получать  
> 6\. Исправляем флоу, добавляя producer/consumer с оповещением об удалении.  
> 7\. Проверяем, что теперь всё работает ok.
> 
> Регистрация на занятие [здесь.](https://otus.pw/I95K/)