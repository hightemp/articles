# Cron Job Monitoring - Fusonic
We use [Sentry](https://sentry.io/) to track down errors in our live systems. This has been working very well for us and integrates nicely with most of the tooling we use. The only thing we haven't been so happy with is the integration with our background job monitoring tool. Until now.

Author

Arjan Frans

Date

August 7, 2024

Reading time

3 Minutes

Current Challenges
------------------

For monitoring background jobs, we have been using healthchecks.io for a few projects. We have been using it to check if background jobs are running without any errors. For us, it had some main disadvantages.

Even though healthchecks.io has an API to automatically maintain healthchecks, we didn't use it extensively enough to implement this automation. So in the end, it was a lot of copy/pasting ping URLs. Maintaining the healthchecks had a bit of a high administrative burden. 

If errors popped up in our Sentry monitoring, we had to manually find out if it was related to a background job or not. There were no relations between reported errors and the healthcheck. This made it difficult to correlate issues and added extra steps to our troubleshooting process.

Sentry's Cron Job Monitoring
----------------------------

Since January 2024, Sentry's Cron Job Monitoring tool has become available, offering several advantages:

*   Error Correlation: Direct relation between reported errors and healthchecks.
*   Seamless Integration: Easy API integration with the Sentry SDK (which we already use).
*   Cost Efficiency: Pay-per-use pricing model.
*   Unified Notifications: Utilizes existing project notification settings.

Sentry themselves made a [Blog Post](https://blog.sentry.io/cron-monitoring-is-now-generally-available/) which demonstrates the basic features.

Implementation
--------------

Until now, we have been using cron for running scheduled tasks in most of our Symfony-based projects. While cron is widely used, it has its own set of problems, including lack of error reporting, limited environment awareness, and permission issues. Healthcheck reporting was done via 'ping URLs' and was not maintainable at all. Ideally, we needed a solution to manage the scheduling of tasks inside our code, where we could more easily integrate the reporting tooling.

Since the introduction Symfony's [Messenger Component](https://symfony.com/doc/current/messenger.html) in version 5, we have been using that to run background tasks. The 'message consumer' is a process running in the background, listening for incoming messages. Now, with version 6.3, Symfony also includes a [Scheduler Component](https://symfony.com/doc/current/scheduler.html) that works together with the Messenger Component, providing the ability to schedule repetitive background tasks. This is the perfect replacement for the old-school cron tool, offering better integration and maintainability.

In Symfony, we can set up a schedule provider in which we can define the messages that should be handled on a specific interval. Scheduled message will automatically be picked up, by the already running message consumer from the Messenger Component. It is important that we use the classic cron notation (since that is what Sentry SDK requires). The following example runs a job every day at 00:12 and triggers an event which will be handled by the Messenger component.

`#[AsSchedule] final readonly class MainSchedule implements ScheduleProviderInterface { public function getSchedule(): Schedule { return (new Schedule()) ->add( RecurringMessage::cron('0 12 * * *', new SendDailySalesReportEvent()) ) ; } }`

Along with the schedule provider, we implemented an event listener, listening to the pre, post, and failure scheduling events. Inside here we publish all the healthcheck start, end, and failure using the [PHP SDK](https://docs.sentry.io/platforms/php/crons/) for Cron Monitoring. If a healthcheck doesn't exist yet, it can also be created automatically. We simply take a snake-cased version of the classname and use that as the healthcheck name for Sentry.

`final class SchedulerEventSubscriber implements EventSubscriberInterface { /** * @var array<string, string> */ private array $checkInIds = []; public static function getSubscribedEvents(): array { return [ PostRunEvent::class => 'onPostRun', PreRunEvent::class => 'onPreRun', FailureEvent::class => 'onFailure', ]; } public function onPreRun(PreRunEvent $event): void { $messageId = $event->getMessageContext()->id; $trigger = $event->getMessageContext()->trigger; $monitorConfig = new MonitorConfig( MonitorSchedule::crontab((string) $trigger), ); $checkInId = captureCheckIn( slug: $this->getMessageSlug($event->getMessage()), status: CheckInStatus::inProgress(), monitorConfig: $monitorConfig ); if (null !== $checkInId) { $this->checkInIds[$messageId] = $checkInId; } } public function onPostRun(PostRunEvent $event): void { $messageId = $event->getMessageContext()->id; $checkInId = $this->checkInIds[$messageId] ?? null; if (null !== $checkInId) { captureCheckIn( slug: $this->getMessageSlug($event->getMessage()), status: CheckInStatus::ok(), checkInId: $checkInId, ); unset($this->checkInIds[$messageId]); } } public function onFailure(FailureEvent $event): void { $messageId = $event->getMessageContext()->id; $checkInId = $this->checkInIds[$messageId] ?? null; if (null !== $checkInId) { captureCheckIn( slug: $this->getMessageSlug($event->getMessage()), status: CheckInStatus::error() ); unset($this->checkInIds[$messageId]); } } private function getMessageSlug(object $message): string { return (string) u(StringHelper::classBasename($message::class))->snake(); } }`

![](https://www.fusonic.net/uploads/media/900x/03/2153-sentry_1.webp?v=1-0)

In the Cron Monitoring overview in Sentry you can easily see where it's burning when something is wrong.

![](https://www.fusonic.net/uploads/media/900x/04/2154-sentry_2.webp?v=1-0)

In the details, you can see all the check-ins, their durations, and the related issues where the check-ins failed.

### Conclusion

By integrating Sentry's Cron Job Monitoring, we have streamlined our background job monitoring process, reduced administrative overhead, and finally have a clear error correlation. No more manual checks or guesswork. Errors are now directly tied to their respective jobs. Plus, new jobs are automatically created, further simplifying our workflow.

More of that?
-------------

![](https://www.fusonic.net/uploads/media/720x360/06/2266-Kubernetes%20Dashboard%20Login%20%C3%BCber%20OpenID-Connect_B.webp?v=1-0)

![](https://www.fusonic.net/uploads/media/720x360/03/2143-7%20Kriterien%20zur%20Softwareauswahl_B.webp?v=1-0)