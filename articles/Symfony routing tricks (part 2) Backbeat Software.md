# Symfony routing tricks (part 2) | Backbeat Software
*   [Part 1](https://backbeat.tech/blog/symfony-routing-tricks-part-1)

In part 1 we explored some advanced Symfony routing techniques:

*   Using an event listener to override the router;
*   Creating routes programatically;
*   Adding expression language requirements;
*   Combining an event listener, programmatic route creation, and expression language requirements together to make an API that routes across different versions based on the `Accept` header.

In this post we’ll look at another technique from a real-life project: writing a custom router to handle some unusual requirements.

New dashboard, new router
-------------------------

Our friends at [EmailOctopus](https://emailoctopus.com/) are constantly improving their product, and in 2019 they launched a brand new version of their customer dashboard:

[![](https://backbeat.tech/img/email-octopus-dashboard.png)
](https://backbeat.tech/img/email-octopus-dashboard.png)

We worked on this new dashboard together in secret before unveiling it to their customers. It was a major project that required significant changes to the codebase, which we aimed to make gradually through a series of small pull requests.

We wanted users to be able to “opt-in” and try out the V2 dashboard while it was still being worked on. On the other hand, we wanted the existing V1 experience to continue uninterrupted.

We came up with these requirements:

*   A user can opt-in and opt-out of the new dashboard at any time.
*   When opted-in, the user should see the V2 dashboard **only**.
*   When opted-out, the user should see the V1 dashboard **only**.
*   A V1 and V2 route can **both** have the same URL. For example, `/campaigns` would invoke the V2 campaigns controller while opted-in, and the V1 campaigns controller when opted-out.
*   A common collection of routes should be available for both versions, e.g. `/` for the homepage or `/legal/privacy` for the privacy policy.
*   Above all, do not break the existing dashboard!

To fulfil these requirements, we decided to write a custom implementation of Symfony’s `RouterInterface`.

Designing the router
--------------------

After talking through various options, we decided to create two separate routers for the V1 and V2 routes, then another router that aggregates both of them:

![](https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVERcbkJbVG9wIGxldmVsIHJvdXRlcl1cbkIgLS0-IEN7VXNlciBoYXMgb3B0ZWQgaW4_fVxuQyAtLT58Tk98IERbVjEgcm91dGVyXVxuQyAtLT58WUVTfCBFW1YyIHJvdXRlcl1cbkQgLS0-fC9jYW1wYWlnbnN8IEZbVjEgcm91dGVdXG5FIC0tPnwvY2FtcGFpZ25zfCBHW1YyIHJvdXRlXVxuRCAtLT58L2xlZ2FsL3ByaXZhY3l8IEhbU2hhcmVkIHJvdXRlXVxuRSAtLT58L2xlZ2FsL3ByaXZhY3l8IEhcbiIsIm1lcm1haWQiOnsidGhlbWUiOiJkZWZhdWx0In0sInVwZGF0ZUVkaXRvciI6ZmFsc2V9)

Let’s build our own version in this post, using a typical Symfony application as a base.

Split existing routes
---------------------

To start, we’ll split the existing routing files to match this portion of the diagram:

![](https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVERcbkFbVjEgcm91dGVyXSAtLT58L2NhbXBhaWduc3wgQltWMSByb3V0ZV1cbkEgLS0-fC9sZWdhbC9wcml2YWN5fCBDW1NoYXJlZCByb3V0ZV0iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)

Assuming a Symfony flex structure, convert `routes.yaml` into two files:

```diff
  protected function configureRoutes(RouteCollectionBuilder $routes)
  {
      $confDir = $this->getProjectDir().'/config';

      $routes->import($confDir.'/{routes}/*'.self::CONFIG_EXTS, '/', 'glob');
      $routes->import($confDir.'/{routes}/'.$this->environment.'/**/*'.self::CONFIG_EXTS, '/', 'glob');
-     $routes->import($confDir.'/{routes}'.self::CONFIG_EXTS, '/', 'glob');
+     $routes->import($confDir.'/routes_shared.yaml');
+     $routes->import($confDir.'/routes_v1.yaml');
  }

```

```yaml
# routes_shared.yaml
sales:
    resource: ../src/Controller/Sales/
    type: annotation

legal:
    resource: ../src/Controller/Legal/
    type: annotation
```

```yaml
# routes_v1.yaml
dashboard:
    resource: ../src/Controller/Dashboard/
    type: annotation
```

The `router` service in the container now represents ‘V1 router’ in the diagram.

Fortunately, EmailOctopus had controllers grouped into separate directories, which made this segmentation quite easy.

Create V2 routes
----------------

To create ‘V2 router’ in the diagram, we’ll copy ‘V1 router’ and tweak it a bit:

![](https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVERcbkFbVjIgcm91dGVyXSAtLT58L2xlZ2FsL3ByaXZhY3l8IEJbU2hhcmVkIHJvdXRlXVxuQSAtLT58L2NhbXBhaWduc3wgQ1tWMiByb3V0ZV0iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)

Add a `process()` method to the `Kernel`, registering it as a compiler pass:

```diff
+ use Symfony\Component\DependencyInjection\ContainerBuilder;
+ use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;

  class Kernel extends BaseKernel implements CompilerPassInterface
  {
+     public function process(ContainerBuilder $container)
+     {
+     }
  }

```

In it we’ll clone the existing `router` service, and tweak the definition to coexist peacefully with the other router (change the name of the cached matcher and generator).

```php
<?php

public function process(ContainerBuilder $container)
{
    $v1Router = $container->findDefinition('router');
    $v2Router = clone $v1Router;

    $v2Router->setArgument(1, 'kernel::loadV2Routes');
    $v2Router->setArgument(2, array_merge(
        $v2Router->getArgument(2),
        [
            'generator_cache_class' => '%router.cache_class_prefix%V2UrlGenerator',
            'matcher_cache_class' => '%router.cache_class_prefix%V2UrlMatcher',
        ]
    ));
}

```

We’re not doing anything with this service definition at the moment, but we’ll use it shortly.

Create `Kernel::loadV2Routes()`:

```php
<?php

public function loadV2Routes(LoaderInterface $loader)
{
    $routes = new RouteCollectionBuilder($loader);
    $confDir = $this->getProjectDir() . '/config';

    $routes->import($confDir.'/{routes}/*'.self::CONFIG_EXTS, '/', 'glob');
    $routes->import($confDir.'/{routes}/'.$this->environment.'/**/*'.self::CONFIG_EXTS, '/', 'glob');
    $routes->import($confDir.'/routes_shared.yaml');
    $routes->import($confDir.'/routes_v2.yaml');

    return $routes->build();
}

```

Note that this is not the same as the existing `configureRoutes()` method: our method is derived from [MicroKernelTrait::loadRoutes()](https://github.com/symfony/symfony/blob/4980dcaf70e9a188d71706cb561d77454eb60f3a/src/Symfony/Bundle/FrameworkBundle/Kernel/MicroKernelTrait.php#L90) instead.

Finally, add `routes_v2.yaml`:

```yaml
# routes_v2.yaml
dashboard:
    resource: ../src/Controller/DashboardV2/
    type: annotation
```

We’ve created a new router service definition, but not doing anything with it yet. Let’s combine the two routers together.

Combine both routers
--------------------

Create an `AggregateRouter` class, which implements `RouterInterface` by delegating to one of the two routers passed to it:

```php
<?php

namespace App\Routing;

use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Routing\RequestContext;
use Symfony\Component\Routing\Exception\RouteNotFoundException;
use Symfony\Component\HttpFoundation\Request;

class AggregateRouter implements RouterInterface
{
    private $v1Router;
    private $v2Router;

    public function __construct(RouterInterface $v1Router, RouterInterface $v2Router)
    {
        $this->v1Router = $v1Router;
        $this->v2Router = $v2Router;
    }

    public function getRouteCollection()
    {
        $routes = $this->v1Router->getRouteCollection();
        $routes->addCollection($this->v2Router->getRouteCollection());

        return $routes;
    }

    public function setContext(RequestContext $context)
    {
        return $this->v1Router->setContext($context);
    }

    public function getContext()
    {
        return $this->v1Router->getContext();
    }

    public function match($pathinfo)
    {
        $optedIn = false;

        if ($optedIn) {
            return $this->v2Router->match($pathInfo);
        }

        return $this->v1Router->match($pathinfo);
    }

    public function generate($name, $parameters = [], $referenceType = self::ABSOLUTE_PATH)
    {
        try {
            return $this->v1Router->generate($name, $parameters, $referenceType);
        } catch (RouteNotFoundException $e) {
            return $this->v2Router->generate($name, $parameters, $referenceType);
        }
    }
}

```

It delegates all the decisions to the V1 router for now, since `$optedIn` is hardcoded to `false`.

Update `Kernel::process()` to register it as the new `router` service:

```diff
  public function process(ContainerBuilder $container)
  {
      $v1Router = $container->findDefinition('router');
      $v2Router = clone $v1Router;

      $v2Router->setArgument(1, 'kernel::loadV2Routes');
      $v2Router->setArgument(2, array_merge(
          $v2Router->getArgument(2),
          [
              'generator_cache_class' => '%router.cache_class_prefix%V2UrlGenerator',
              'matcher_cache_class' => '%router.cache_class_prefix%V2UrlMatcher',
          ]
      ));

+     $aggregateRouter = (new Definition(AggregateRouter::class))
+                   ->setArguments([
+                       $v1Router,
+                       $v2Router,
+                   ])
+                   ->setPublic(true);
+
+     $container->setDefinition('router', $aggregateRouter);
  }

```

After this change, the `router` service in the container will be an instance of `AggregateRouter`. Since it only uses the V1 router at the moment, our application still behaves exactly the same.

Actually use both routers
-------------------------

The application routing now looks a bit like this:

![](https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVERcbkNbVG9wIGxldmVsIHJvdXRlcl0gLS0-IERbVjEgcm91dGVyXVxuRCAtLT58L2NhbXBhaWduc3wgRltWMSByb3V0ZV1cbkVbVjIgcm91dGVyXSAtLT58L2NhbXBhaWduc3wgR1tWMiByb3V0ZV1cbkQgLS0-fC9sZWdhbC9wcml2YWN5fCBIW1NoYXJlZCByb3V0ZV1cbkUgLS0-fC9sZWdhbC9wcml2YWN5fCBIIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)

How can we use `RouterInterface::match()` to make the V1/V2 decision when we only have `$pathinfo` available? As our requirements state, both V1 and V2 need to available at `/campaigns`.

Fortunately there’s another option - [Symfony\\Component\\Routing\\Matcher\\RequestMatcherInterface::matchRequest()](https://github.com/symfony/symfony/blob/4.4/src/Symfony/Component/Routing/Matcher/RequestMatcherInterface.php#L38) expects a `Symfony\Component\HttpFoundation\Request` object instead of a `$pathinfo` string. If a router implements this interface, Symfony will call `matchRequest()` instead of `match()` to route the request.

Update `AggregateRouter` to implement it:

```diff
+ use Symfony\Component\Routing\Matcher\RequestMatcherInterface;

+ class AggregateRouter implements RouterInterface, RequestMatcherInterface
- class AggregateRouter implements RouterInterface

```

```diff
      public function match($pathinfo)
      {
+         throw new RouteNotFoundException(
+             __CLASS__ . ' relies on ' . RequestMatcherInterface::class
+          );
+     }
+
+     public function matchRequest(Request $request)
+     {
          $optedIn = false;

          if ($optedIn) {

```

This gives us access to the request object to make the V1/V2 decision. We’ve also updated `match()` to throw an error to stop the router being used incorrectly.

With access to the request, we can easily check opt-in status using a cookie:

```diff
      public function matchRequest(Request $request)
      {
-         $optedIn = false;
+         $optedIn = $request->cookies->get('v2') === 'y';

          if ($optedIn) {
              return $this->v2Router->match($pathInfo);
          }

          return $this->v1Router->match($pathinfo);
      }

```

Perfect! A request to `/campaigns` with the `v2` cookie set to `y` will go to the V2 endpoint, and the V1 endpoint if not. As `routes_shared.yaml` is loaded by both V1 and V2 routers, we’ll always be able to access common pages like `/legal/privacy` regardless of cookie status.

Finishing touches
-----------------

All that remains is to set the cookie for selected users. For EmailOctopus, we added messages to both dashboard versions:

[![](https://backbeat.tech/img/email-octopus-v2-opt-in.png)
](https://backbeat.tech/img/email-octopus-v2-opt-in.png) [![](https://backbeat.tech/img/email-octopus-v2-opt-out.png)
](https://backbeat.tech/img/email-octopus-v2-opt-out.png)

Each would link to a controller that toggled the status of the cookie.

```php
<?php

use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class DashboardPreferenceController
{
    /**
     * @Route("/_dashboard_preference")
     *
     * Opt the user in or out of the V2 dashboard,
     * then redirect them to the dashboard homepage.
     */
    public function togglePreference(Request $request)
    {
        $currentlyOptedIn = $request->cookies->get('v2') === 'y';

        // Note that /dashboard is available in both V1 and V2
        $response = new RedirectResponse('/dashboard');
        $response->headers->setCookie(new Cookie('v2', $currentlyOptedIn ? '' : 'y'));

        return $response;
    }
}

```

Going back to normal
--------------------

When the V2 migration was fully completed, we simply reversed the process to go back to using a regular Symfony router, then deleted all the V1 routes.

Conclusion
----------

This concludes our 2-part series on advanced Symfony routing techniques, I hope you learned something new!

Do you need help with routing in your application? [Send us an email](mailto:hello@backbeat.tech), we’d be delighted to help you.