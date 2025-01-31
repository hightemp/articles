# Adam Cameron's Dev Blog: TDD & Symfony & Monolog: adding some logging to that endpoint from last time
G'day:

Hopefully this one is shorter than the previous monster ([TDD & Symfony: creating a small web service end point](https://blog.adamcameron.me/2023/01/tdd-symfony-creating-small-web-service.html)). I should perhaps have split that one in two, in hindsight (the Adapter, then the Controller). This article builds on that code.

I have create a wee webservice that I call like this: http://localhost:8008/postcode-lookup/XX200X, and that goes off and hits getaddress.io with much the same request. This web service of mine is two components:

*   [PostcodeLookupController](https://github.com/adamcameron/php8/blob/1.8/src/Controller/PostcodeLookupController.php) which receives the request, and offloads it to…
*   [AddressService/Adapter](https://github.com/adamcameron/php8/blob/1.8/src/Adapter/AddressService/Adapter.php) which is an adapter for the HTTP request to getaddress.io.

Simple. Except I managed to write 4000-ish words on it on Sunday, somehow.

One shortfall I identified with the initial implementation is that it was just swallowing some failure situations that - whilst should not cause a problem for the consuming client of my web service - should be something I pay attention to if they occur. A quick fix for this is to chuck some logging in. And this is a good exercise as it will require me to revisit [Monolog](https://seldaek.github.io/monolog/), and also I'll need to work out a) how to wire it into Symfony; b) and test my integration.

In the previous article I TDDed the first part of the exercise, and then backfilled the testing on the second part as I didn't even know how to wire things together in Symfony when I started, so I decided to spike that first. Today I'm taking a hybrid approach. I'm going to _try_ to TDD it, but there will be some points at which I need to wrestle with Symfony/Monolog config, and I am just gonna go do that when I need to. NB: this is not to suggest any of this config is arduous: I've just forgotten how to do it, so I need to work it out again.

Here goes.

This unit test in [tests/Unit/Controller/PostcodeLookupControllerTest.php](https://github.com/adamcameron/php8/blob/1.9/tests/Unit/Controller/PostcodeLookupControllerTest.php) describes the problem I'm trying to solve:

```
/**
 * @testdox It logs any issues we might need to deal with
 * @dataProvider provideCasesForLoggingTests
 */
public function testLogging(
    int $statusCode,
    string $expectedMessage,
    Level $expectedLogLevel
) {
    $testHandler = new TestHandler();

    $this->configureControllerWithTestLoggingHandler(
        $statusCode,
        $expectedMessage,
        $testHandler
    );

    $this->client->request(
        "GET",
        sprintf("/postcode-lookup/%s", TestConstants::POSTCODE_OK)
    );

    $this->assertLogEntryIsCorrect(
        $testHandler,
        $expectedLogLevel,
        $statusCode,
        $expectedMessage
    );
} 
```

Especially with the data-provider method:

```
public function provideCasesForLoggingTests() : array
{
    return [
        "Unauthorized should log critical" => [
            Response::HTTP_UNAUTHORIZED,
            "Unauthorized",
            Level::Critical
        ],
        "Forbidden should log critical" => [
            Response::HTTP_FORBIDDEN,
            "Forbidden",
            Level::Critical
        ],
        "Too many requests should log critical" => [
            Response::HTTP_TOO_MANY_REQUESTS,
            "Too Many Requests",
            Level::Warning
        ],
        "Server error should log critical" => [
            Response::HTTP_INTERNAL_SERVER_ERROR,
            "Internal Server Error",
            Level::Warning
        ]
    ];
} 
```

Basically the getaddress.io call could return each of those failures, and I wanna log when they occur. I don't care about "the client app passed an invalid postcode", but I do care if I'm using the wrong API key, or if I haven't paid my account (those're both bad, so: critical); and I also kinda wanna keen an eye on throttling issues, and unexpected server errors on their end ("good to know", so just warnings). If any of these occur, I'm still returning a usable response to the client so they don't need to care, but I keep an eye on issues I am having with getaddress.io

There's nothing interesting in that test method, but there's some stuff in the helper methods:

```
private function configureControllerWithTestLoggingHandler(
    int $statusCode,
    string $expectedMessage,
    TestHandler $testHandler
): void {
    $container = self::getContainer();
    $mockedAddressServiceAdapter = $this
        ->getMockBuilder(AddressService\Adapter::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['get'])
        ->getMock();
    $mockedAddressServiceAdapter
        ->expects($this->once())
        ->method('get')
        ->willReturn(new AddressService\Response(
            [],
            $statusCode,
            $expectedMessage
        ));
    $container->set(AddressService\Adapter::class, $mockedAddressServiceAdapter);

    $logger = $container->get("monolog.logger.address_service");
    $logger->setHandlers([$testHandler]);
} 
```

This shows how to grab the DI container and replace my AddressService/Adapter with a mock that returns the values I need to exercise my controller code. Remember: I will be logging in the controller here, as it's a reaction to the response it's returning. I am not changing any Adapter logic here, I am adding some logging to the controller. TBH thinking about it now, maybe this should be in Service/Address instead of the controller. Hrm. Anyhow, I can refactor later if I want (100% test coverage so I'm safe to do that).

I'm also replacing the "live" logging handler in the container with a test one. This is so I don't actually log to the file system, it instead exposes an array of log entries, which I then check out in the custom assertion function:

```
public function assertLogEntryIsCorrect(
    TestHandler $testHandler,
    Level $expectedLogLevel,
    int $statusCode,
    string $expectedMessage
): void {
    $logRecords = $testHandler->getRecords();
    $this->assertCount(1, $logRecords);
    $this->assertEquals($expectedLogLevel->getName(), $logRecords[0]["level_name"]);
    $this->assertEquals(
        AddressService\Adapter::ERROR_MESSAGES[$statusCode],
        $logRecords[0]["message"]
    );
    $this->assertEquals(
        [
            "postcode" => TestConstants::POSTCODE_OK,
            "message" => $expectedMessage
        ],
        $logRecords[0]["context"]
    );
} 
```

(Full disclosure, I am writing this _after_ I have done the full implementation so like there's that ERROR\_MESSAGES const array that came out of some refactoring I did after everything was working).

This assertion is simple enough: look for _one_ log entry, and it needs to be the level, message and context that I should expect.

Before I can run that, I need to wire in Monolog, and before I do that, I need to install it. So I'm gonna have a quick functional test for that too:

```
/** @testdox It writes AddressService entries to the expected log file */
public function [testAddressServiceLogFile](https://github.com/adamcameron/php8/blob/1.9/tests/Functional/System/LoggerTest.php#L12)()
{
    $kernel = new Kernel("test", false);
    $kernel->boot();
    $container = $kernel->getContainer();
    $logFile = $container->getParameter("kernel.logs_dir") . "/address_service.log";

    $logger = $container->get("monolog.logger.address_service");

    $this->assertEquals($logFile, $logger->getHandlers()[0]->getUrl());
} 
```

This doesn't test any actual writing of data to a file: I figure that's Monolog's job to look after. I'm just verifying my config stays the same as I expect it. This is not a unit test, it's just an functional test: testing I've done the config right, and no-one monkeys with it later.

Now I will permit myself to actually install Monolog; or as it is in this case: [symfony/monolog-bundle](https://blog.adamcameron.me/2023/01/symfony/monolog-bundle).

That needs a [monolog.yaml](https://github.com/adamcameron/php8/blob/1.9/config/packages/monolog.yaml) file:

```
monolog:
    handlers:
        address_service_log:
            type: stream
            path: '%kernel.logs_dir%/address_service.log'
            level: debug
            channels: [address_service]

    channels: [address_service] 
```

Having added that: my functional test works, so I'm happy I've configured my log.

Now I can do my implementation of the logging in the controller. I'll show you this in parts:

```
public function [__construct](https://github.com/adamcameron/php8/blob/1.9/src/Controller/PostcodeLookupController.php#L24)(
    AddressService\Adapter $addressServiceAdapter,
    LoggerInterface $addressServiceLogger
) {
    $this->addressServiceAdapter = $addressServiceAdapter;
    $this->logger = $addressServiceLogger;
} 
```

I need to add the logger parameter here, but I don't need to do anything to wire it in to the DI container. Symfony works out that if I ask for a LoggerInterface, then it'll take the parameter name, lop off "Logger" and look for a channel in my monolog.yaml file that is the snake-case version of that. So the paramter name here - $addressServiceLogger will find the address\_service channel in my Monolog config. That's quite cool.

```
public function doGet(string $postcode) : JsonResponse
{
    try {
        $response = $this->addressServiceAdapter->get($postcode);

        $this->logUnexpectedFailures($response, $postcode);

        return new JsonResponse(
            [
                'postcode' => $postcode,
                'addresses' => $response->getAddresses(),
                'message' => $response->getMessage()
            ],
            $response->getHttpStatus()
        );
    } catch (\Exception $e) {
        return new JsonResponse(
            [
                'postcode' => $postcode,
                'addresses' => [],
                'message' => $e->getMessage()
            ],
            HttpStatusCode::HTTP_INTERNAL_SERVER_ERROR
        );
    }
} 
```

There's just that one insertion into the controller logic, and that function is also pretty simple:

```
private function [logUnexpectedFailures](https://github.com/adamcameron/php8/blob/1.9/src/Controller/PostcodeLookupController.php#L59)(
    AddressService\Response $response,
    string $postcode
): void {
    $statusCode = $response->getHttpStatus();

    if (array_key_exists($statusCode, self::RESPONSES_TO_LOG)) {
        $this->logger->log(
            self::RESPONSES_TO_LOG[$statusCode],
            AddressService\Adapter::ERROR_MESSAGES[$statusCode],
            ['postcode' => $postcode, 'message' => $response->getMessage()]
        );
    }
} 
```

That also refers to this lot:

```
private const RESPONSES_TO_LOG = [
    HttpStatusCode::HTTP_UNAUTHORIZED => Level::Critical,
    HttpStatusCode::HTTP_FORBIDDEN => Level::Critical,
    HttpStatusCode::HTTP_TOO_MANY_REQUESTS => Level::Warning,
    HttpStatusCode::HTTP_INTERNAL_SERVER_ERROR => Level::Warning
]; 
```

[Level](https://github.com/Seldaek/monolog/blob/3.2.0/src/Monolog/Level.php) is an [enum](https://www.php.net/manual/en/language.types.enumerations.php), which are new to PHP since the last time I used it. I like. I'll need to look into those in another article maybe (not least of all cos the docs are not as good as they could be).

All the code here is doing is checking if there's a case that we want to log via comparing the returned HTTP status code in that RESPONSES\_TO\_LOG array, and if one is there, log a message with the defined log level.

What's _logged_ comes from the Adapter:

```
public const [ERROR_MESSAGES](https://github.com/adamcameron/php8/blob/1.9/src/Adapter/AddressService/Adapter.php#L12-L17) = [
    HttpFoundationResponse::HTTP_UNAUTHORIZED => "API key is not valid",
    HttpFoundationResponse::HTTP_FORBIDDEN => "Permission denied",
    HttpFoundationResponse::HTTP_TOO_MANY_REQUESTS  => "Too many requests",
    HttpFoundationResponse::HTTP_INTERNAL_SERVER_ERROR => "Server error"
]; 
```

We don't really need too much detail here, we just need to know it's happened.

Again, I wonder if this is an _adapter's_ job to define these. I think I do need a skinny wee service in between the adapter and controller here. I _will_ do that refactor.

And that's _it_. I mean there are a few use statements about the place I didn't show you, but I'll link through to the code and you can look at everything, and there's really not much to it. It _did_ take quite a while to dig out the docs for all this, given I was working with Symfony and Monolog, and testing of each, and being a newbie didn't help because some of the docs seem to assume whilst I was a n00b at (for example) Monolog then that's fine we'll document it slowly, but not thinking about the fact I _also_ don't know the Symfony side of things either, I found the docs assume a level of knowledge that they shouldn't (at times). Being rusty with PHP (eg: not even knowing PHP did enums!) did not help. But I got there.

All the code is in [tag 1.9](https://github.com/adamcameron/php8/tree/1.9) of this project on Github.

Righto.

\--  
Adam