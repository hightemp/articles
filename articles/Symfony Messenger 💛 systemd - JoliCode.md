# Symfony Messenger 💛 systemd - JoliCode
In this article we will explore how to use systemd properly to run Symfony Messenger workers.

![](https://jolicode.com/media/original/2021/symfony-messenger-systemd.jpg)

[Section intitulée what-are-symfony-messenger-and-systemd](#what-are-symfony-messenger-and-systemd)What are Symfony Messenger and systemd?
------------------------------------------------------------------------------------------------------------------------------------------

Symfony documentation says:

> The [Messenger component](https://symfony.com/doc/current/components/messenger.html) helps applications send and receive messages to / from other applications or via message queues.

Concretely, our infrastructure needs to run permanent workers to receive and process messages. Those workers must be managed by a service manager.

systemd website says:

> [systemd](https://systemd.io/) is a suite of basic building blocks for a Linux system. It provides a system and service manager that runs as PID 1 and starts the rest of the system.

systemd is the default service manager of all Debian based OS, which is very popular among servers used for hosting web applications.

In systemd, a “service” is a sort of “unit”. There are [many other sort of units](https://www.digitalocean.com/community/tutorials/understanding-systemd-units-and-unit-files#types-of-units), but we only need “service” here.

[Section intitulée how-to-use-systemd-to-manage-workers](#how-to-use-systemd-to-manage-workers)How to use systemd to manage workers?
------------------------------------------------------------------------------------------------------------------------------------

systemd looks for service files in many directories:

*   `/etc/systemd/system/` for system units (or services) **created** by the administrator of the server (created means that the administrator is the author of the system unit);
*   `/usr/local/lib/systemd/system/` for system units (or services) **installed** by the administrator of the server (installed means that the administrator is not the author of the system unit);
*   `/lib/systemd/system/` for system units (or services) **installed** by the distribution package manager.

Depending on the role you have on your servers, you will write the worker service files either in `/etc/systemd/system/` or `/usr/local/lib/systemd/system/`. To know more about service locations, please consult the [systemd documentation](https://www.freedesktop.org/software/systemd/man/systemd.unit.html).

Here is an example of a service to run a Symfony Messenger worker:

`some_worker.service`

```
[Unit]
StartLimitIntervalSec=20s
StartLimitBurst=5

[Service]
ExecStart=/usr/bin/php -d memory_limit=-1 /home/app/bin/console messenger:consume transport_name --memory-limit=512m --env=prod
Restart=always
RestartSec=1
TimeoutSec=300
User=app

[Install]
WantedBy=multi-user.target

```

Let’s decompose this file to understand each directive:

*   `[Unit]`: Section used to configure the unit:
    *   `StartLimitIntervalSec`: interval during which a number of service starts is allowed. The number of starts is configurable with the `StartLimitBurst` parameter;
    *   `StartLimitBurst`: authorized number of starts within the `StartLimitIntervalSec` interval.

systemd documentation says:

> Configure unit start rate limiting. Units which are started more than burst times within an interval time span are not permitted to start any more. Use StartLimitIntervalSec= to configure the checking interval and StartLimitBurst= to configure how many starts per interval are allowed.

We use these options, in combination with RestartSec to avoid burning the CPU when a worker crashes during its initialization. So the system will wait 1 second before rebooting the worker, and if it reboots too often (it means it’s really broken, and it’s useless to reboot it anymore) we stop it.

Of course you must have a monitoring system, like Datadog, that alerts you if a service is down, and you must fix it ASAP.

*   `[Service]`: Section used to configure the service:
    *   `ExecStart`: This is where you will write your Symfony command to consume messages;
    *   `Restart`: Configures whether the service shall be restarted when the service process exits, is killed, or a timeout is reached;
    *   `RestartSec`: The time to sleep before restarting a service in seconds (or time span like “3min 42s”). Default is 100ms;
    *   `TimeoutSec`: The time that the system should wait until the service starts or stops. If the timeout is reached before the service has started, it will be considered failed. If the timeout is reached before the service has stopped, it will be terminated by [SIGTERM](https://en.wikipedia.org/wiki/Signal_(IPC)#SIGTERM). We have set a large value here, to handle the case where a message processing takes lots of time, so avoiding systemd to kill the process before the end of the message processing;
    *   `User`: The user who will execute the command.
*   `[Install]`: This section is used by `enable` and `disable` commands of [`systemctl`](https://www.freedesktop.org/software/systemd/man/systemctl.html#) which lets you control the installed services on your system:
    *   `WantedBy`: Allows you to determine the dependent services of the current one.

[Section intitulée start-a-service](#start-a-service)Start a service
--------------------------------------------------------------------

To start a service, you must use the `systemctl` CLI tool. Basically it will allow you to manage your services by using several commands.

```
$ systemctl start some_worker.service

```

This command will start the service named `some_worker.service`. Let’s assume this service is located in `/etc/systemd/system/some_worker.service`.

> The “.service” extension is not mandatory, but useful to quickly recognize services among other files.

To be sure the service will automatically start at the boot of the machine, you have to enable it:

```
$ systemctl enable some_worker.service

```

That’s all! Now you have a background service that will handle your Symfony Messenger messages, and **that will restart automatically**. This is highly enjoyable because a good practice of running Symfony Messenger worker is to kill them from time to time, with three options:

*   `--limit=10` to exit after 10 messages;
*   `--memory-limit=128M` to exit when memory hits 128M;
*   `--time-limit=3600` to exit after one hour.

The objective is to avoid memory leak, closed database connection, socket timeout…

You can see the status of services with the `status` command:

```
$ systemctl status some_worker.service
● some_worker.service
     Loaded: loaded (/etc/systemd/system/some_worker.service; disabled; vendor preset: disabled)
     Active: active (running) since Wed 2021-12-22 20:58:00 CET; 14h ago
    Process: 2288289 ExecStart=/usr/bin/php -d memory_limit=-1 /home/app/bin/console messenger:consume transport_name --memory-limit=512m --env=prod
   Main PID: 2288289 (code=exited, status=1/FAILURE)
        Memory: 7.9M
        CPU: 1.587s

```

This output shows some data about the service, among which:

*   the uptime of the service (14h);
*   the status (running);
*   the memory used (7.9M);
*   the PID (2288289).

[Section intitulée how-to-run-many-instances-of-one-worker](#how-to-run-many-instances-of-one-worker)How to run many instances of one worker?
---------------------------------------------------------------------------------------------------------------------------------------------

If the volume of messages require to run multiple workers side by side, you could use [service templates](https://www.freedesktop.org/software/systemd/man/systemd.service.html#Service%20Templates).

Considering `some_worker@.service` is your service template, note the `@` before the extension. It will contain everything about your service, then you could instantiate as many services as you want by starting a service named after this pattern:

```
$ systemctl enable some_worker@{IDENTIFIER}.service

```

Here, {IDENTIFIER} is considered as an argument for the service instance. It could be simply an integer, or any string.

If needed, this argument is available in the service file via `%i` (escaped version) of `%I` (raw version, non escaped). It should be used to set the service description for example, or to make something dynamic in the command of the service instance.

ProTips©: Most of the time it’s not necessary to create more service instances than the number of logical CPU cores on the machine. Processes will be distributed among all cores, so if you have more service instances than cores, some cores will have to manage many service instances at the same time.

[Section intitulée handle-services-with-glob](#handle-services-with-glob)Handle services with glob
--------------------------------------------------------------------------------------------------

We’ve just seen how to manage one service. But as we saw earlier, it’s possible to instantiate a service multiple times. Let’s see how to manage all instances of a service easily.

To start all service instances of a template, let’s use `systemctl` with [glob](https://en.wikipedia.org/wiki/Glob_(programming)):

```
$ systemctl start "dummy_worker@*.service" --all

```

Note the `--all` here, it’s needed by the `start` command to be sure to load and start all units (especially if your service depends on other services which are not actually loaded on glob or already started).

To stop all instances of a service, you can use also a glob:

```
$ systemctl stop "dummy_worker@*.service"

```

There is no need for the `--all` option, because systemd will only stop the instance matching the glob, not their dependencies.

[Section intitulée watch-logs-of-a-service](#watch-logs-of-a-service)Watch logs of a service
--------------------------------------------------------------------------------------------

You will probably need to watch out logs of your service at one moment. If you don’t use a service like Datadog to centralise your logs, you will need to know where to find the logs of systemd’s services.

By default, systemd logs everything in `journalctl`. You can tail the logs of your service using:

```
$ journalctl -xfeu some_worker

```

*   `-x`: means “extended”, it give you more information about your service;
*   `-f`: like the `-f` of `tail` command, it follows the new append lines in the file;
*   `-e`: shows you the end of the file instead of the top, very useful if your service runs for a long time;
*   `-u`: let you precise the name of the unit logos you want to display.

But, if you need to write the logs in a file, you can modify the service with:

```
[Service]
...
StandardOutput=append:/path/to/log.log
StandardError=append:/path/to/error_log.log

```

Be sure the log directory you target exists, systemd will not create it for you.

[Section intitulée delete-properly-a-service](#delete-properly-a-service)Delete properly a service
--------------------------------------------------------------------------------------------------

To delete a service, there are 4 steps to achieve:

### [Section intitulée 1-stop-the-service](#1-stop-the-service)1: Stop the service

To stop a service, use the `systemctl` tool and its `stop` command:

```
$ systemctl stop some_worker.service

```

### [Section intitulée 2-disable-the-service](#2-disable-the-service)2: Disable the service

Disabling a service means that the system will not try to automatically start it at boot. Let’s use the `disable` command:

```
$ systemctl disable some_worker.service

```

### [Section intitulée 3-remove-the-service](#3-remove-the-service)3: Remove the service

Next step, removal of the service. And this time, not using a `systemctl` command, but a dead simple `rm`:

```
$ rm /etc/systemd/system/some_worker.service

```

Finally, the last step is to reload the systemd daemon, to let it know (now you have Frozen song in your head, sorry 😅) this service is removed. It will not impact the running services.

```
$ systemctl daemon-reload

```

[Section intitulée systemd-is-a-powerful-software](#systemd-is-a-powerful-software)systemd is a powerful software
-----------------------------------------------------------------------------------------------------------------

As it was designed to manage OS services, systemd can offer you plenty of other features. Its main advantage for us in Symfony Messenger context, is that it’s installed by default on popular server OS, so there is no need to install another process manager like [Supervisord](http://supervisord.org/) (which is still a great tool too!).

[Section intitulée want-to-try](#want-to-try)Want to try?
---------------------------------------------------------

The Internet is full of brilliant people, so someone has created a [web-based playground](https://systemd-by-example.com/) to experiment systemd in the browser!