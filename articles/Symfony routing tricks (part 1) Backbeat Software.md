# Symfony routing tricks (part 1) | Backbeat Software
*   [Part 2](https://backbeat.tech/blog/symfony-routing-tricks-part-2)

One of the great things about the [Symfony](http://symfony.com/) framework is its flexibility - nearly every aspect of it can be configured, tweaked, or swapped out - and routing is no exception.

Here are some of the Symfony routing tricks we’ve learned over the years.

Routing is just an event listener you can override
--------------------------------------------------

In most Symfony applications, routing is handled by the [RouterListener](https://github.com/symfony/symfony/blob/b04484c3cfdc1211d1f89246f139136641b1d057/src/Symfony/Component/HttpKernel/EventListener/RouterListener.php) on the `kernel.request` event. It uses the router to match the request to a route and [set attributes on the request object](https://github.com/symfony/symfony/blob/b04484c3cfdc1211d1f89246f139136641b1d057/src/Symfony/Component/HttpKernel/EventListener/RouterListener.php#L126), the most important being the `_controller` and `_route` attributes.

Once the `kernel.request` event has completed, Symfony uses a _controller resolver_ to get a controller to call. You can create your own controller resolver, but the [default implementation](https://github.com/symfony/symfony/blob/b04484c3cfdc1211d1f89246f139136641b1d057/src/Symfony/Component/HttpKernel/Controller/ControllerResolver.php#L18) looks at the `_controller` attribute set on the request.

This means we can override the router completely if we set the `_controller` attribute before the `RouterListener` can.

Let’s create a listener to prevent our app being accessed at the weekend:

```php
<?php

namespace App\EventListener;

use App\Controller\WeekendController;
use Symfony\Component\HttpKernel\Event\RequestEvent;

final class WeekendListener
{
    public function onKernelRequest(RequestEvent $event)
    {
        if ($this->isAWeekend()) {
            $event->getRequest()->attributes->set(
                '_controller',
                WeekendController::class . '::notAvailable'
            );
        }
    }
}

```

Using the console, we can see the RouterListener has a priority of `32` on the `kernel.request` event:

```
$ ./bin/console debug:event-dispatcher kernel.request

Registered Listeners for "kernel.request" Event
===============================================

 ------- -------------------------------------------------------------- ----------
  Order   Callable                                                       Priority
 ------- -------------------------------------------------------------- ----------
  #1      ...\DebugHandlersListener::configure()                         2048
  #2      ...\ValidateRequestListener::onKernelRequest()                 256
  #3      ...\SessionListener::onKernelRequest()                         128
  #4      ...\LocaleListener::setDefaultLocale()                         100
  #5      ...\RouterListener::onKernelRequest()                          32
  #6      ...\ResolveControllerNameSubscriber::onKernelRequest()         24
  #7      ...\LocaleListener::onKernelRequest()                          16
  #8      ...\TraceableFirewallListener::configureLogoutUrlGenerator()   8
  #9      ...\TraceableFirewallListener::onKernelRequest()               8
 ------- -------------------------------------------------------------- ----------

```

So we’ll set the priority of our listener to `33`.

```yaml
# config/services.yaml

services:
    App\EventListener\WeekendListener:
        tags:
            # Priority 33 so it runs before routing
            - {name: kernel.event_listener, event: kernel.request, priority: 33}
```

That’s it! The `WeekendListener` will run before the `RouterListener`, setting the controller for every request to the `WeekendController::notAvailable()` method before the `RouterListener` can run. Your users can get some well-deserved rest and go outside.

Creating routes programatically
-------------------------------

Sometimes you need to create a lot of routes programatically. Suppose we had a folder full of markdown files and wanted to create a route for each of them:

```
$ tree help-docs/
help-docs
├── intro.md
├── getting-started
│   ├── install.md
│   ├── setup.md
│   └── tweaks.md
├── advanced
│   ├── appearance.md
│   ├── changing-things.md
│   └── custom-elements.md

```

It would be a pain to manually create a controller and route for each file, especially since the controller logic would be almost identical each time:

```php
<?php

namespace App\Controller;

use App\Markdown;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class HelpController extends AbstractController
{
    /**
     * @Route("/help/getting-started/install")
     */
    public function gettingStartedInstall(Markdown $markdown)
    {
        return new Response(
            $markdown->render('getting-started/install.md')
        );
    }

    /**
     * @Route("/help/getting-started/setup")
     */
    public function gettingStartedSetup(Markdown $markdown)
    {
        return new Response(
            $markdown->render('getting-started/setup.md')
        );
    }

    //..etc
}

```

Let’s simplify to a single controller method and write a service to generate the routes dynamically instead.

The simplified controller would expect a `markdown_file` attribute to be defined on the request object:

```php
<?php

namespace App\Controller;

use App\Markdown;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;

class HelpController extends AbstractController
{
    public function article(Request $request, Markdown $markdown)
    {
        return new Response(
            $markdown->render($request->attributes->get('markdown_file'))
        );
    }
}

```

The route generator would loop over all the files, creating a route for each one that points to the `article()` method with a different `markdown_file` attribute:

```php
<?php

namespace App\Routing;

use App\Controller\HelpController;
use Symfony\Component\Config\Resource\FileResource;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

class HelpArticleLoader
{
    private static $articles = [
        'intro',
        'getting-started/install',
        'getting-started/setup',
        'getting-started/tweaks',
        'advanced/appearance',
        'advanced/changing-things',
        'advanced/custom-elements',
    ];

    public function load()
    {
        $collection = new RouteCollection();
        foreach (self::$articles as $article) {
            $route = new Route('/help/'.$article, [
                '_controller' => HelpController::class . '::article',
                'markdown_file' => $article . '.md',
            ]);
            $routeName = 'help_' . str_replace(['-', '/'], '_', $article);
            $collection->add($routeName, $route);
        }

        // Refresh the routing cache when this file changes.
        // If you find the articles by scanning the filesystem, you could use
        // a DirectoryResource pointing to the `help-docs/` folder instead.
        $collection->addResource(new FileResource(__FILE__));

        return $collection;
    }
}

```

To enable it, add it as a `service` resource to the routing configuration and make sure it’s a public service:

```yaml
# config/routes.yaml
help_articles:
    resource: 'App\Routing\HelpArticleLoader::load'
    type:     service
```

```yaml
# config/services.yaml
services:
    App\Routing\HelpArticleLoader:
        public: true
```

That’s it! The routes are now available:

```
$ ./bin/console debug:router
------------------------------- -------- -------- ------ -----------------------------------
 Name                            Method   Scheme   Host   Path
------------------------------- -------- -------- ------ -----------------------------------
 ...
 help_intro                      ANY      ANY      ANY    /help/intro
 help_getting_started_install    ANY      ANY      ANY    /help/getting-started/install
 help_getting_started_setup      ANY      ANY      ANY    /help/getting-started/setup
 help_getting_started_tweaks     ANY      ANY      ANY    /help/getting-started/tweaks
 help_advanced_appearance        ANY      ANY      ANY    /help/advanced/appearance
 help_advanced_changing_things   ANY      ANY      ANY    /help/advanced/changing-things
 help_advanced_custom_elements   ANY      ANY      ANY    /help/advanced/custom-elements
------------------------------- -------- -------- ------ -----------------------------------

```

Using the expression language
-----------------------------

While custom event listeners give you a lot of power, they’re also time-consuming to write. The [ExpressionLanguage component](https://symfony.com/doc/current/components/expression_language.html) can be used to add custom routing logic very quickly.

Install the component with `composer require symfony/expression-language`, then set the `condition` property on your routes:

```php
<?php

namespace App\Controller;

use Symfony\Component\Routing\Annotation\Route;

final class AppController
{
    /**
     * @Route("/info", condition="request.headers.get('User-Agent') matches '/iphone/i'")
     */
    public function appleDeviceInfo()
    {
    }

    /**
     * @Route("/info", condition="request.headers.get('User-Agent') matches '/android/i'")
     */
    public function androidDeviceInfo()
    {
    }

    /**
     * @Route("/info", condition="context.scheme === 'https' and context.port > 8000")
     */
    public function specialCaseOnly()
    {
    }
}

```

I often hear question about performance when using the ExpressionLanguage, but (like many other things in Symfony) the expressions are compiled into highly efficient PHP code. Take a look inside `/var/cache/dev/UrlMatcher.php` to see the compiled expressions for yourself:

```php
<?php
// extract of dumper route matching functions
//
'/info' => [
    [['_route' => 'app_info_appledeviceinfo', '_controller' => 'App\\Controller\\InfoController::appleDeviceInfo'], null, null, null, false, false, 1],
    [['_route' => 'app_info_androiddeviceinfo', '_controller' => 'App\\Controller\\InfoController::androidDeviceInfo'], null, null, null, false, false, 2],
    [['_route' => 'app_info_specialcaseonly', '_controller' => 'App\\Controller\\InfoController::specialCaseOnly'], null, null, null, false, false, -3],
],
//
//
static function ($condition, $context, $request) { // $checkCondition
    switch ($condition) {
        case 1: return preg_match("/iphone/i", $request->headers->get("User-Agent"));
        case 2: return preg_match("/android/i", $request->headers->get("User-Agent"));
        case -3: return (($context->scheme === "https") && ($context->port > 8000));
//

```

Combining the ExpressionLanguage with a custom loader and event listener
------------------------------------------------------------------------

You can also combine the ExpressionLanguage with a custom route loader and event listener for some serious routing shenanigans. Suppose you’re building an API that you’d like to version using a custom content type in the `Accept` header:

*   `GET /api/cars` with the header `Accept: application/vnd.cars.v1` would hit the controller for version 1;
*   `GET /api/cars` with `Accept: application/vnd.cars.v2` would hit the version 2 controller.

### ExpressionLanguage only

We could add conditions to every route:

```php
<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class V1Controller
{
    /**
     * @Route("/api/cars",
     *     name="api_v1_cars",
     *     condition="request.headers.get('Accept') === 'application/vnd.cars.v1'"
     * )
     */
    public function cars()
    {
        return new JsonResponse([
            'version' => 1,
        ]);
    }
}

```

```php
<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class V2Controller
{
    /**
     * @Route("/api/cars",
     *     name="api_v2_cars",
     *     condition="request.headers.get('Accept') === 'application/vnd.cars.v2'"
     * )
     */
    public function cars()
    {
        return new JsonResponse([
            'version' => 2,
        ]);
    }
}

```

But it’s a little repetitive and fragile. What if we want to support different formats, e.g. `application/vnd.cars.v1+json` and `application/vnd.cars.v1+html` like [GitHub does for its API](https://developer.github.com/v3/media/)?

### Add a listener to set the API version

All the conditions really need to know is the API version, not the full Accept header. We could refactor to decouple the version from the Accept header:

```diff
  /**
   * @Route("/api/cars",
   *     name="api_v2_cars",
-  *     condition="request.headers.get('Accept') === 'application/vnd.cars.v2'"
+  *     condition="request.attributes.get('api_version') === 2"
   * )
   */
  public function cars()

```

Then add a listener to set the `api_version` attribute on the request:

```php
<?php

namespace App\EventListener;

use Symfony\Component\HttpKernel\Event\RequestEvent;

final class ApiVersionListener
{
    public function onKernelRequest(RequestEvent $event)
    {
        $request = $event->getRequest();
        $requestedContentType = $request->getAcceptableContentTypes()[0] ?? '';
        // e.g. 'application/vnd.cars.v2+json'

        list($version, $format) = $this->parseContentType($requestedContentType);
        // e.g. 2 and 'json'

        $request->attributes->set('api_version', $version);
        $request->attributes->set('api_format', $format);
    }
}

```

Make sure to also register the listener as higher priority than the `RouterListener`, as we want `api_version` to be set before routing begins.

This is better, but still involves a lot of repetition: writing `request.attributes.get('api_version') === 2` for every controller will get boring fast!

### Auto-generate routes with the api\_version requirement

We could generate these API routes with a custom route loader, using the class name of the controller to automatically set the required API version:

```diff
  class V2Controller
  {
-     /**
-      * @Route("/api/cars",
-      *     name="api_v2_cars",
-      *     condition="request.attributes.get('api_version') === 2"
-      * )
-      */
      public function cars()
      {
          return new JsonResponse([
              'version' => 2,
          ]);
      }

+     public static function getRoute(): array
+     {
+         return ['GET', '/api/cars'];
+     }
  }

```

The loader would receive a list of controller classes, perhaps through a compiler pass, using the `getRoute()` method to build a route for each:

```php
<?php

namespace App\Routing;

use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

class ApiLoader
{
    private $controllerClasses = [];

    public function __construct(array $controllerClasses)
    {
        $this->controllerClasses = $controllerClasses;
    }

    public function load()
    {
        $collection = new RouteCollection();

        foreach ($this->controllerClasses as $controllerClass) {
            // e.g. 'App\Controller\V2Controller'
            list($httpMethod, $controllerMethod) = $controllerClass::getRoute();
            // e.g. 'GET' and 'cars'
            $route = new Route($path, [
                '_controller' => $controllerClass . '::' . $controllerMethod,
            ]);
            $route->setMethods([$httpMethod]);
            $version = $this->versionFromControllerClass($controllerClass);
            // e.g. 2
            $route->setCondition('request.attributes.get("api_version") === ' . $version);
            $routeName = $this->controllerClassToRouteName($controllerClass);
            // e.g. 'api_v2_cars'
            $collection->add($routeName, $route);
        }

        return $collection;
    }
}

```

Much better! If we ever have to tweak the `Accept` header or change `api_version` to something else, we only need to do so in the event listener and route loader.

Further reading
---------------

There’s a lot more to the Routing, ExpressionLanguage, and HttpKernel components. Check out these pages in the Symfony docs for more information:

*   [The Workflow of a Request](https://symfony.com/doc/current/components/http_kernel.html#the-workflow-of-a-request) gives a detailed walkthrough of the kernel events involved in routing a request;
*   [How to Create a custom Route Loader](https://symfony.com/doc/current/routing/custom_route_loader.html) shows some more advanced route loader implementations;
*   [Matching Expressions](https://symfony.com/doc/current/routing.html#matching-expressions) explains more about the ExpressionLanguage component in routes.

In [part 2](https://backbeat.tech/blog/symfony-routing-tricks-part-2) we’ll look at an advanced routing example from a client project. See you next time!