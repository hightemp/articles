# Async IO on Linux: select, poll, and epoll (RU)
This week I got a new book in the mail: [The Linux Programming Interface](https://www.nostarch.com/tlpi). My awesome coworker Arshia recommended it to me so I bought it! It’s written by the maintainer of the [Linux man-pages project](https://www.kernel.org/doc/man-pages/), Michael Kerrisk. It talks about the Linux programming interface as of kernel 2.6.x.

Here’s the cover.

![](https://jvns.ca/images/linuxprogramming.png)

In the contributing guidelines (you can contribute to the linux man pages!! mind=blown), there’s a list of [missing man pages](https://www.kernel.org/doc/man-pages/missing_pages.html) that would be useful to contribute. It says:

> You need to have a reasonably high degree of understanding of the topic, or be prepared to invest the time (e.g., reading source code, writing test programs) to gain that understanding. Writing test programs is important: quite a few kernel and glibc bugs have been uncovered while writing test programs during the preparation of man pages.

I thought this was a cool reminder of how you can learn a lot by documenting something & writing small test programs!

But today we’re going to talk about something I learned from this book: the `select`, `poll`, and `epoll` system calls.

### [Chapter 63: Alternative I/O models](#chapter-63-alternative-i-o-models)

This book is huge: 1400 pages. I started it at Chapter 63 (“alternative I/O models”) because I’ve been meaning to understand better what’s up with `select`, `poll` and `epoll` for quite some time. And writing up things I learn helps me understand them, so here’s my attempt at explaining!

This chapter is basically about how to monitor a lot of file descriptors for new input/output. Who needs to watch a lot of file descriptors at a time? Servers!

For example if you’re writing a web server in node.js on Linux, it’s actually using the `epoll` Linux system call under the hood. Let’s talk about why, how `epoll` is different from `poll` and `select`, and about how it works!

### [Servers need to watch a lot of file descriptors](#servers-need-to-watch-a-lot-of-file-descriptors)

Suppose you’re a webserver. Every time you accept a connection with the `accept` system call ([here’s the man page](http://man7.org/linux/man-pages/man2/accept.2.html)), you get a new file descriptor representing that connection.

Если вы являетесь веб-сервером, у вас могут быть открыты тысячи соединений одновременно. Вам нужно знать, когда люди отправляют вам новые данные по этим соединениям, чтобы вы могли обрабатывать их и отвечать на них.

У вас мог бы быть цикл, который в основном выполняет:

```
for x in open_connections:
    if has_new_input(x):
        process_input(x)

```

Проблема в том, что это может отнимать много процессорного времени. Вместо того, чтобы тратить все процессорное время на вопрос “есть ли обновления сейчас? как насчет сейчас? как насчет сейчас? как насчет сейчас?”, вместо этого мы бы предпочли просто спросить ядро Linux “эй, вот 100 файловых дескрипторов. Скажите мне, когда один из них будет обновлен!”.

Три системных вызова, которые позволяют Linux отслеживать множество файловых дескрипторов, — это `poll`, `epoll` и `select`. Давайте начнём с опроса и выбора, потому что с этого начиналась глава.

### [Первый способ: выберите и опросите](#first-way-select-poll)

Эти два системных вызова доступны в любой системе Unix, в то время как `epoll` является специфичным для Linux. Вот как они работают:

1.  Предоставьте им список файловых дескрипторов, чтобы получить информацию о
2.  Они сообщают вам, в какие из них есть данные, доступные для чтения / записи

Первое, что меня удивило в этой главе, — это то, что **опрос и выборка по сути используют один и тот же код**.

Я посмотрел определение `poll` и `select` в исходном коде ядра Linux, чтобы убедиться в этом, и это правда!

*   вот [определение системного вызова select](https://github.com/torvalds/linux/blob/v4.10/fs/select.c#L634-L656) и [do\_select](https://github.com/torvalds/linux/blob/v4.10/fs/select.c#L404-L542)
*   и [определение системного вызова poll](https://github.com/torvalds/linux/blob/v4.10/fs/select.c#L1005-L1055) и [do\_poll](https://github.com/torvalds/linux/blob/v4.10/fs/select.c#L795-L879)

Они оба вызывают множество одних и тех же функций. В частности, в книге упоминается, что `poll` возвращает более широкий набор возможных результатов для файловых дескрипторов, таких как `POLLRDNORM | POLLRDBAND | POLLIN | POLLHUP | POLLERR` в то время как `select` просто сообщает, что «есть ввод / есть вывод / есть ошибка».

`select` преобразует более подробные результаты `poll` (например, `POLLWRBAND`) в общее «вы можете писать». Вы можете увидеть код, в котором это делается, в Linux 4.10 [здесь](https://github.com/torvalds/linux/blob/v4.10/fs/select.c#L468-L482).

Следующее, что я узнал, — это то, что **опрос может работать лучше, чем выбор, если у вас мало файловых дескрипторов**.

Чтобы увидеть это, вы можете просто посмотреть на подписи к опросу и выбрать!

```
int ppoll(struct pollfd *fds, nfds_t nfds,
          const struct timespec *tmo_p, const sigset_t
          *sigmask)`
int pselect(int nfds, fd_set *readfds, fd_set *writefds,
            fd_set *exceptfds, const struct timespec *timeout,
            const sigset_t *sigmask);

```

С помощью `poll` вы сообщаете ему “вот файловые дескрипторы, которые я хочу отслеживать: 1, 3, 8, 19 и т.д.” (это `pollfd` аргумент. С помощью select вы сообщаете ему: “Я хочу отслеживать 19 файловых дескрипторов. Вот 3 набора битов, с помощью которых нужно отслеживать чтения / записи / исключения”. Поэтому, когда он запускается, он [перебирает от 0 до 19 файловых дескрипторов](https://github.com/torvalds/linux/blob/v4.10/fs/select.c#L440), даже если на самом деле вас интересовали только 4 из них.

В этой главе есть гораздо больше конкретных сведений о том, чем отличаются `poll` и `select`, но это были две основные вещи, которые я узнал!

### [почему бы нам не использовать функции опроса и выбора?](#why-don-t-we-use-poll-and-select)

Хорошо, но в Linux мы сказали, что ваш сервер Node. js не будет использовать ни опрос, ни выборку, он будет использовать `epoll`. Почему?

Из книги:

> При каждом вызове `select()` или `poll()` ядро должно проверять все указанные файловые дескрипторы, чтобы убедиться, что они готовы. При мониторинге большого количества файловых дескрипторов, находящихся в плотно упакованном диапазоне, время, необходимое для этой операции, значительно превышает \[остальное время, которое они должны потратить\]

По сути, каждый раз, когда вы вызываете `select` или `poll`, ядру приходится с нуля проверять, доступны ли ваши файловые дескрипторы для записи. Ядро не запоминает список файловых дескрипторов, которые оно должно отслеживать!

### [Ввод-вывод, управляемый сигналом (это то, чем пользуются люди?)](#signal-driven-i-o-is-this-a-thing-people-use)

В книге на самом деле описываются два способа, с помощью которых можно попросить ядро запомнить список файловых дескрипторов, которые оно должно отслеживать: ввод-вывод с управлением сигналами и `epoll`. Ввод-вывод с управлением сигналами — это способ заставить ядро отправлять вам сигнал при обновлении файлового дескриптора с помощью вызова `fcntl`. Я никогда не слышал, чтобы кто-то этим пользовался, и в книге говорится, что `epoll` просто лучше, поэтому мы пока проигнорируем его и поговорим об epoll.

### [срабатывающий по уровню против срабатывающего по краю](#level-triggered-vs-edge-triggered)

Прежде чем мы поговорим об epoll, нам нужно поговорить о «триггерных» и «нетриггерных» уведомлениях о файловых дескрипторах. Я никогда раньше не слышал этой терминологии (думаю, она пришла из электротехники?). По сути, есть два способа получать уведомления

*   получите список всех интересующих вас файловых дескрипторов, доступных для чтения («срабатывающих по уровню»)
*   получайте уведомления каждый раз, когда дескриптор файла становится доступным для чтения (“срабатывает по краю”).

### [что такое epoll?](#what-s-epoll)

Ладно, мы готовы поговорить об epoll!! Это очень интересно, потому что я часто видел `epoll_wait` при трассировке программ и часто не понимал, что именно это значит.

Группа системных вызовов `epoll` (`epoll_create`, `epoll_ctl`, `epoll_wait`) предоставляет ядру Linux список файловых дескрипторов для отслеживания и запроса обновлений о действиях с этими файловыми дескрипторами.

Вот шаги по использованию epoll:

1.  Вызовите `epoll_create` , чтобы сообщить ядру, что вы собираетесь использовать epoll! Он возвращает вам идентификатор
2.  Вызовите `epoll_ctl` для того, чтобы сообщить ядру о файловых дескрипторах, обновления которых вас интересуют. Интересно, что вы можете указать множество различных типов файловых дескрипторов (каналы, FIFO, сокеты, очереди сообщений POSIX, экземпляры inotify, устройства и многое другое), но **не обычные файлы**. Я думаю, в этом есть смысл: каналы и сокеты имеют довольно простой API (один процесс записывает в канал, а другой процесс считывает!), поэтому имеет смысл сказать «в этом канале есть новые данные для считывания». Но файлы — это что-то странное! Вы можете записывать данные в середину файла! Поэтому нет смысла говорить, что «в этом файле доступны для чтения новые данные».
3.  Вызовите `epoll_wait` для ожидания обновлений списка интересующих вас файлов.

### [производительность: выбор и опрос по сравнению с epoll](#performance-select-poll-vs-epoll)

В книге есть таблица, в которой сравнивается производительность 100 000 операций мониторинга:

```
# operations  |  poll  |  select   | epoll
10            |   0.61 |    0.73   | 0.41
100           |   2.9  |    3.0    | 0.42
1000          |  35    |   35      | 0.53
10000         | 990    |  930      | 0.66

```

Таким образом, использование epoll действительно намного быстрее, если у вас более 10 дескрипторов файлов для мониторинга.

### [кто пользуется epoll?](#who-uses-epoll)

Иногда я вижу `epoll_wait` при трассировке программы. Почему? Есть очевидный, но бесполезный ответ: «она отслеживает некоторые файловые дескрипторы», но мы можем сделать лучше!

Во-первых, если вы используете «зелёные» потоки или цикл событий, то, скорее всего, вы используете epoll для всех сетевых операций и ввода-вывода по каналам!

Например, вот программа на Golang, которая использует epoll в Linux!

```
package main

import "net/http"
import "io/ioutil"

func main() {
    resp, err := http.Get("http://example.com/")
        if err != nil {
            // handle error
        }
    defer resp.Body.Close()
    _, err = ioutil.ReadAll(resp.Body)
}

```

Здесь вы можете увидеть, как среда выполнения Golang использует epoll для поиска DNS:

```
16016 connect(3, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("127.0.1.1")}, 16 <unfinished ...>
16020 socket(PF_INET, SOCK_DGRAM|SOCK_CLOEXEC|SOCK_NONBLOCK, IPPROTO_IP
16016 epoll_create1(EPOLL_CLOEXEC <unfinished ...>
16016 epoll_ctl(5, EPOLL_CTL_ADD, 3, {EPOLLIN|EPOLLOUT|EPOLLRDHUP|EPOLLET, {u32=334042824, u64=139818699396808}}
16020 connect(4, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("127.0.1.1")}, 16 <unfinished ...>
16020 epoll_ctl(5, EPOLL_CTL_ADD, 4, {EPOLLIN|EPOLLOUT|EPOLLRDHUP|EPOLLET, {u32=334042632, u64=139818699396616}}

```

По сути, это подключение 2 сокетов (на файловых дескрипторах 3 и 4) для выполнения DNS-запросов (к 127.0.1.1:53), а затем использование `epoll_ctl` для запроса у epoll обновлений о них

Затем он выполняет 2 DNS-запроса для example.com (почему 2? Нельхаге предполагает, что один из них запрашивает запись A, а другой — запись AAAA!) и использует `epoll_wait` для ожидания ответов

```
# these are DNS queries for example.com!
16016 write(3, "\3048\1\0\0\1\0\0\0\0\0\0\7example\3com\0\0\34\0\1", 29
16020 write(4, ";\251\1\0\0\1\0\0\0\0\0\0\7example\3com\0\0\1\0\1", 29
# here it tries to read a response but I guess there's no response
# available yet
16016 read(3,  <unfinished ...>
16020 read(4,  <unfinished ...>
16016 <... read resumed> 0xc8200f4000, 512) = -1 EAGAIN (Resource temporarily unavailable)
16020 <... read resumed> 0xc8200f6000, 512) = -1 EAGAIN (Resource temporarily unavailable)
# then it uses epoll to wait for responses
16016 epoll_wait(5,  <unfinished ...>
16020 epoll_wait(5,  <unfinished ...>

```

Таким образом, одна из причин, по которой ваша программа может использовать epoll, заключается в том, что она написана на Go / node.js / Python с gevent и работает с сетью.

Какие библиотеки используют go/node.js/Python для работы с epoll?

*   node.js использует [libuv](https://github.com/libuv/libuv) (который был написан для проекта node.js)
*   сетевая библиотека gevent в Python использует [libev /libevent](https://blog.gevent.org/2011/04/28/libev-and-libevent/)
*   В Golang используется собственный код, потому что это Go. Это [похоже на реализацию сетевого опроса с помощью epoll в среде выполнения Golang](https://github.com/golang/go/blob/91c9b0d568e41449f26858d88eb2fd085eaf306d/src/runtime/netpoll_epoll.go) — всего около 100 строк, что интересно. Вы можете посмотреть общий интерфейс netpoll [здесь](https://golang.org/src/runtime/netpoll.go) — в BSD он реализован с помощью kqueue вместо

Веб-серверы также реализуют epoll — например, [вот код epoll в nginx](https://github.com/nginx/nginx/blob/0759f088a532ec48170ca03d694cc103757a0f4c/src/event/modules/ngx_epoll_module.c).

### [дополнительные сведения о select и epoll](#more-select-epoll-reading)

Мне понравились эти 3 поста Марека:

*   [select в корне нарушен](https://idea.popcount.org/2017-01-06-select-is-fundamentally-broken/)
*   [epoll фундаментально сломан, часть 1](https://idea.popcount.org/2017-02-20-epoll-is-fundamentally-broken-12/)
*   [epoll фундаментально сломан, часть 2](https://idea.popcount.org/2017-03-20-epoll-is-fundamentally-broken-22/)

В частности, в них говорится о том, что поддержка многопоточных программ в epoll исторически была не очень хорошей, хотя в Linux 4.5 были внесены некоторые улучшения.

и это:

*   [используя select (2) правильным способом](http://aivarsk.github.io/2017/04/06/select/)

### [ладно, этого достаточно](#ok-that-s-enough)

Я узнал много нового о select и epoll, когда писал этот пост! Сейчас у нас 1800 слов, так что, думаю, этого достаточно. С нетерпением жду продолжения чтения этой книги по интерфейсу программирования Linux и новых открытий!

Возможно, в этом посте есть что-то не так, дайте мне знать, что именно!

Одна небольшая вещь, которая мне нравится в моей работе, — это то, что я могу оплачивать книги по программированию! Это круто, потому что иногда это побуждает меня покупать и читать книги, которые учат меня тому, чему я не смог бы научиться иначе. И покупка книги обходится намного дешевле, чем посещение конференции!