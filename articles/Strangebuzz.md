# Strangebuzz
Published on 2021-04-04 • Modified on 2021-04-04

In this post, we will see how to create an end-to-end test scenario using Symfony, Panther and Vue.js with a concrete example. Let's go! 😎

» Published in ["A week of Symfony 745"](https://symfony.com/blog/a-week-of-symfony-745-5-11-april-2021).

Prerequisite
------------

I will assume you have a basic knowledge of Symfony and that you know how to run functional and unit tests.

Configuration
-------------

*   PHP **8.4**
*   Symfony **6.4.16**
*   Panther **v1.0.1**
*   Vue.js **2.6.12**

Introduction
------------

As backend developers, we are used to creating unit and functional tests for our projects. But E2E (end-to-end) testing is not so easy to do. Panther's primary goal is to fix this by providing a developer experience (DX) very similar to what we are used to doing when writing functional tests with the Symfony `WebTestCase` Two years after its first release, Panther is now stable so let's see how it goes.

Goal
----

We will see a concrete example to test a registration form where a submit button only appears if given conditions are met.

Installation
------------

You can follow both [the excellent blog post on the Symfony website](https://symfony.com/blog/announcing-symfony-panther-1-0) and/or [the README of the library on GitHub](https://github.com/symfony/panther). Some advices:

*   Your Symfony maker bundle should be up to date to take advantage of the `make:tests` command new options.
*   Your browsers should be up to date, or you will get an error indicating that the driver only supports a given version of the browser.
*   Be sure to have a standard main front controller in your public directory: `index.php`, or you will get `404` errors.

The user registration form
--------------------------

First, we need a standard user registration form; it will be elementary and contain a login and a password. We will use the form I used in a [previous blog post](https://www.strangebuzz.com/en/blog/on-using-the-symfony-notcompromisedpassword-security-validator) to test the `NotCompromisedPassword` validator. Here it is:

If you play with this form (it's a real form, it's a Symfony powered blog! 😉), you see that the subscribe button is only displayed if you enter both the login and password. We have a form; now, let's create our first E2E test!

Click here to see the source of the form type.```null
<?php

declare(strict_types=1);



namespace App\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormError;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Callback;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\NotCompromisedPassword;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Context\ExecutionContextInterface;


final class AccountCreateType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder->add('login', TextType::class, ['constraints' => [new NotBlank()]]);
        $builder->add('password', PasswordType::class, ['constraints' => [new NotBlank()]]);
        $builder->add('check_password', CheckboxType::class, ['required' => false]);
    }

    
    public function validate(array $data, ExecutionContextInterface $context): void
    {
        
        if (\is_bool($data['check_password']) && !$data['check_password']) {
            return;
        }

        $violations = $context->getValidator()->validate($data['password'], [
            new NotCompromisedPassword(),
        ]);

        
        if ($violations instanceof ConstraintViolationList && $violations->count() > 0) {
            
            $root = $context->getRoot();
            $password = $root->get('password');
            if ($password instanceof Form) {
                $password->addError(new FormError((string) $violations));
            }
        }
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'constraints' => [
                new Callback([$this, 'validate']),
            ],
        ]);
    }
}
```

Creating an E2E test case
-------------------------

There's the maker bundle for that ™:

```null
bin/console make:test
```

Enter the asked information like the following:

```
$ bin/console make:test

 Which test type would you like?:
  \[TestCase       \] basic PHPUnit tests
  \[KernelTestCase \] basic tests that have access to Symfony services
  \[WebTestCase    \] to run browser-like scenarios, but that don't execute JavaScript code
  \[ApiTestCase    \] to run API-oriented scenarios
  \[PantherTestCase\] to run e2e scenarios, using a real-browser or HTTP client and a real web server
 > PantherTestCase

Choose a class name for your test, like:
 \* UtilTest (to create tests/UtilTest.php)
 \* Service\\UtilTest (to create tests/Service/UtilTest.php)
 \* \\App\\Tests\\Service\\UtilTest (to create tests/Service/UtilTest.php)

 The name of the test class (e.g. BlogPostTest):
 > BlogPost138Test

 created: tests/BlogPost138Test.php

   Success!     Next: Open your new test class and start customizing it.
 Find the documentation at https://github.com/symfony/panther#testing-usage
```

Let's add our first assertion while cleaning a bit what was generated. For now, we test that we can access the blog post and that the text in the `<h1>` tag is found. We also use Firefox instead of Chrome because we want to use a browser that [respects our privacy](https://twitter.com/EFF/status/1378813625960427521). To do this, we pass the `browser` option in the parameters array of the first argument of the `createPantherClient()` function. I moved this file in a new subdirectory `App\Tests\E2E` to separate it from the other tests:

```null
<?php



declare(strict_types=1);

namespace App\Tests\E2E;

use Symfony\Component\Panther\PantherTestCase;

final class BlogPost138Test extends PantherTestCase
{
    
    public function testPost138(): void
    {
        $client = self::createPantherClient([
            'browser' => PantherTestCase::FIREFOX,
        ]);
        $client->request('GET', '/en/blog/end-to-end-testing-with-symfony-and-panther');
        self::assertSelectorTextContains('h1', 'End-to-end testing with Symfony and Panther');
    }
}
```

Let's run it with the following command. Here I use my Makefile that gives me a shortcut to run only the tests I want. You can find my entire Makefile [here](https://www.strangebuzz.com/en/snippets/the-perfect-makefile-for-symfony).

```null
make test filter=BlogPost138Test
#
./vendor/bin/phpunit --testsuite='main' --filter=BlogPost138Test --stop-on-failure
#
./vendor/bin/phpunit tests/E2E/BlogPost138Test.php
```

If everything is OK we should have the following output:

```
$ ./vendor/bin/phpunit tests/E2E/BlogPost138Test.php
PHPUnit 9.5.4 by Sebastian Bergmann and contributors.

Testing App\\Tests\\E2E\\BlogPost138Test
.                                                                   1 / 1 (100%)

Time: 00:03.313, Memory: 32.50 MB OK (1 test, 1 assertion)
```

The JavaScript test
-------------------

In the previous section, we initialized a new test, but, we would have written almost the same functional test as the standard Symfony `WebTestCase`. Before writing a test that uses Panther's feature, let's see how the form works. Here are the lines handling the toggling of the button and the error message with Vue.js. We use the Vue `:v-if` directive to render some elements conditionally. Note that, if the condition isn't met, the element isn't even in the DOM; it simply doesn't exist from the browser point of view. Here is the snippet:

```null
<div class="card-footer justify-content-center">
    <button id="subscribe_button_panther" v-if="this.post138.login.trim() !== '' && this.post138.password.trim() !== ''" class="btn btn-primary">{{ 'form2_submit'|trans }}</button>
    <p id="error_msg_panther" v-else class="h5">{{ 'form_error'|trans({}, 'post_138') }}</p>
</div>
```

The condition is relatively straightforward; we display the submit button only if the two fields aren't empty. Now we can modify our test to check that the button appears as soon as both fields are filled. At first, we test that the button doesn't exist and the error message is displayed, then, the opposite:

```null
<?php

declare(strict_types=1);

namespace App\Tests\E2E;

use Symfony\Component\Panther\PantherTestCase;

final class BlogPost138Test extends PantherTestCase
{
    private const BUTTON_SELECTOR = '#subscribe_button_panther';
    private const ERROR_MESSAGE_SELECTOR = '#error_msg_panther';
    private const FORM_SELECTOR = '#account_create';

    
    public function testPost138(): void
    {
        $client = self::createPantherClient([
            'browser' => PantherTestCase::FIREFOX,
        ]);
        $crawler = $client->request('GET', '/en/blog/end-to-end-testing-with-symfony-and-panther');
        self::assertSelectorTextContains('h1', 'End-to-end testing with Symfony and Panther');

        
        self::assertSelectorExists(self::ERROR_MESSAGE_SELECTOR);
        self::assertSelectorNotExists(self::BUTTON_SELECTOR);

        
        $crawler->filter(self::FORM_SELECTOR)->form([
            'account_create[login]' => 'Les',
            'account_create[password]' => 'Tilleuls',
        ]);
        $client->waitForVisibility(self::BUTTON_SELECTOR); 

        
        self::assertSelectorNotExists(self::ERROR_MESSAGE_SELECTOR);
        self::assertSelectorExists(self::BUTTON_SELECTOR);
    }
}
```

Let's run the tests, we should have five assertions now, and all should be green. ✅ 🎉

```
$ ./vendor/bin/phpunit tests/E2E/BlogPost138Test.php
PHPUnit 9.5.4 by Sebastian Bergmann and contributors.

Testing App\\Tests\\E2E\\BlogPost138Test
.                                                                   1 / 1 (100%)

Time: 00:05.814, Memory: 87.00 MB OK (1 test, 5 assertions)
```

Community tools and libraries
-----------------------------

Even if Panther is relatively young, it already has an ecosystem around it. For example, the [zenstruck/browser](https://github.com/zenstruck/browser) library provides a friendly fluent interface and already supports it. Here is the same test we wrote before but using this library:

```null
<?php



declare(strict_types=1);

namespace App\Tests\E2E;

use Symfony\Component\Panther\PantherTestCase;
use Zenstruck\Browser\Test\HasBrowser;

final class BlogPost138ZenstruckTest extends PantherTestCase
{
    use HasBrowser;

    private const BUTTON_SELECTOR = '#subscribe_button_panther';
    private const ERROR_MESSAGE_SELECTOR = '#error_msg_panther';

    
    public function testPost138(): void
    {
        $this->pantherBrowser(['browser' => PantherTestCase::FIREFOX])
            ->visit('/en/blog/end-to-end-testing-with-symfony-and-panther')
            ->assertSeeIn('h1', 'End-to-end testing with Symfony and Panther')
            ->assertSeeElement(self::ERROR_MESSAGE_SELECTOR)
            ->assertNotSeeElement(self::BUTTON_SELECTOR)
            ->fillField('account_create[login]', 'Les') 
            ->fillField('Password', 'Tilleuls')         
            ->waitUntilVisible(self::BUTTON_SELECTOR)
            ->assertNotSeeElement(self::ERROR_MESSAGE_SELECTOR)
        ;
    }
}
```

Which version do you prefer 🧐? Thanks Wouter for providing me the test convertion 😉.

Conclusion
----------

We saw a concrete example where we test interactions between a Symfony form and Vue.js that display elements conditionally. We only used three specific Panther assertions, there's a lot more to discover (screenshots, remote browser...)! Panther is very well integrated into the Symfony testing environment and a pleasure to use. It's far from the developer experience we could have with similar tools some (many) years ago. So, what about giving it a try? 😉

Panther is sponsored by [Les-Tilleuls.coop](https://les-tilleuls.coop/en). 🌳

That's it! I hope you like it. Check out the links below to have additional information related to the post. As always, feedback, likes and retweets are welcome. (see the box below) See you! COil. 😊

[  Read the doc](https://github.com/symfony/panther) [ More on the web](https://symfony.com/blog/announcing-symfony-panther-1-0)

They gave feedback and helped me to fix errors and typos in this article; many thanks to [wouterjnl](https://twitter.com/wouterjnl), [jmsche](https://twitter.com/jmsche). 👍

[  Work with me!](https://les-tilleuls.coop/en#contact)

* * *