# 狼烟 / Linux内核源码分析：epoll
2016-11-01 опубликовано в \[[технология](https://blog.hongxiaolong.com/category/tech)\]

В предыдущей статье [Анализ исходного кода NGINX: в модели событий](http://hongxiaolong.com/posts/nginx-event-module.html) NGINX использует инкапсуляцию epoll в качестве основного модуля модели событий, который управляет циклом прослушивания портов NGINX и циклом отправки и получения данных.

epoll - это улучшенный опрос, выполняемый ядром Linux для обработки большого количества файловых дескрипторов. Это улучшенная версия интерфейса мультиплексированного ввода-вывода select / poll под Linux. Это может значительно повысить коэффициент использования системного процессора программой, когда активно только небольшое количество одновременных подключений.

Краткое описание различий между select / poll / epoll заключается в следующем：

*   выберите:
    
    *   Существует максимальное ограничение на количество прослушиваемых файловых дескрипторов；
        
    *   Все события должны быть пройдены во время проверки готовности, что неэффективно；
        
    *   Режим ядра и пользовательский режим требуют копирования в память, что обходится дорого；
        
*   опрос：
    
    *   Нет ограничения на максимальное количество подключений, оно реализовано на основе связанного списка；
        
    *   Все события должны быть пройдены во время проверки готовности, что неэффективно；
        
    *   Режим ядра и пользовательский режим требуют копирования в память, что обходится дорого；
        
*   эполл：
    
    *   Максимальное количество подключений не ограничено. Верхний предел поддерживаемых файловых дескрипторов - это максимальное количество файлов, которые можно открыть. На компьютере с объемом памяти 1 ГБ это около 100 000.；
        
    *   Во время проверки готовности необходимо выполнять обход только событий ready, что является очень эффективным методом.；
        
    *   Режим ядра и пользовательский режим не требуют копирования памяти, ядро может напрямую добавлять список событий потока в область памяти, предоставленную пользователем.；
        

epoll относится к чему-то, что было написано плохо, потому что его код реализации очень упрощен, с простым файлом ”fs / eventpoll.c", даже чуть более 2000 строк, но сценарии его применения очень обширны, в основном все высокопроизводительные модели событий веб-сервера инкапсулируют реализацию epoll.

Таким образом, эта статья представляет собой памятку для краткого обзора реализации исходного кода epoll в ядре Linux.

Системные вызовы epoll имеют следующие три：

```
 int epoll_create(int size);
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event)；
int epoll_wait(int epfd, struct epoll_event * events, int maxevents, int timeout); 
```

*   "epoll\_create()" создает дескриптор epoll, а также содержит описание файла；
    
*   "epoll\_ctl()" используется для регистрации события в epoll и указания типа события для прослушивания.；
    
*   "epoll\_wait()" используется для обнаружения и ожидания активированных событий, где ”события” и "maxevents” предоставляются ядру для добавления готовых событий.；
    

Часть первая: Создание epoll
----------------------------

"epoll\_create()" используется для создания целевого дескриптора epoll. Очевидно, что epoll должен потреблять определенные системные ресурсы.

Когда ядро Linux запускает систему, оно фактически заранее завершило выделение и инициализацию этой части ресурсов.

```
 static int __init eventpoll_init(void)
{
    struct sysinfo si;

    si_meminfo(&si);
    
    max_user_watches = (((si.totalram - si.totalhigh) / 25) << PAGE_SHIFT) /
        EP_ITEM_COST;
    BUG_ON(max_user_watches < 0);

    
    ep_nested_calls_init(&poll_loop_ncalls);

    
    ep_nested_calls_init(&poll_safewake_ncalls);

    
    ep_nested_calls_init(&poll_readywalk_ncalls);

    
    BUILD_BUG_ON(sizeof(void *) <= 8 && sizeof(struct epitem) > 128);

    
    epi_cache = kmem_cache_create("eventpoll_epi", sizeof(struct epitem),
            0, SLAB_HWCACHE_ALIGN | SLAB_PANIC, NULL);

    
    pwq_cache = kmem_cache_create("eventpoll_pwq",
            sizeof(struct eppoll_entry), 0, SLAB_PANIC, NULL);

    return 0;
} 
```

“eventpoll\_init()" будет вызван, когда модуль ядра загружен для завершения распределения ресурсов, связанных с epoll. Как видно из его исходного кода, ядро Linux предоставляет epoll два блока памяти на основе механизма slab, ”eventpoll\_epi” и ”eventpoll\_pwq”. Мы можем непосредственно наблюдать это через файловую систему ”proc”.Блок памяти, _здесь вам нужно сравнить версию ядра самостоятельно, чтобы убедиться.._。

Очевидно, что выделение и освобождение объектов в epoll происходят очень часто, и slab может максимизировать эффективность использования памяти epoll.

Затем проанализируйте исходный код "epoll\_create()".：

```
 SYSCALL_DEFINE1(epoll_create1, int, flags)
{
    int error, fd;
    struct eventpoll *ep = NULL;
    struct file *file;

    
    BUILD_BUG_ON(EPOLL_CLOEXEC != O_CLOEXEC);

    if (flags & ~EPOLL_CLOEXEC)
        return -EINVAL;
    
    error = ep_alloc(&ep);
    if (error < 0)
        return error;
    
    fd = get_unused_fd_flags(O_RDWR | (flags & O_CLOEXEC));
    if (fd < 0) {
        error = fd;
        goto out_free_ep;
    }
    file = anon_inode_getfile("[eventpoll]", &eventpoll_fops, ep,
                 O_RDWR | (flags & O_CLOEXEC));
    if (IS_ERR(file)) {
        error = PTR_ERR(file);
        goto out_free_fd;
    }
    ep->file = file;
    fd_install(fd, file);
    return fd;

out_free_fd:
    put_unused_fd(fd);
out_free_ep:
    ep_free(ep);
    return error;
} 
```

Как можно видеть, логика "epoll\_create()" не сложна. "ep\_alloc()" создает объект ”struct eventpoll" для epoll. Это основная структура epoll. Он связан с ”fd" и "file”, и все последующие операции с epoll передаются напрямую через этот связанный ”fd", которым можно управлять.

“fd” используется для управления epoll, а ”file" используется для связывания файла в Linux, потому что epoll существует как файл, но на самом деле он анонимный, потому что его можно связать с соответствующим индексом, и более сложных файловых операций не требуется.

“anon\_inode\_getfile()" завершает создание анонимных файлов. Есть также очень важный момент. epoll использует эту функцию, чтобы связать ”ep” с ”file-> private\_data".

Кроме того, ”ep\_alloc()" инициализирует ряд очень важных элементов при создании экземпляра объекта epoll.

```
 /* linux-3.10.103/linux-3.10.103/fs/eventpoll.c */

static int ep_alloc(struct eventpoll **pep)
{
    int error;
    struct user_struct *user;
    struct eventpoll *ep;

    user = get_current_user();
    error = -ENOMEM;
    ep = kzalloc(sizeof(*ep), GFP_KERNEL);
    if (unlikely(!ep))
        goto free_uid;

    spin_lock_init(&ep->lock);
    mutex_init(&ep->mtx);
    init_waitqueue_head(&ep->wq);
    init_waitqueue_head(&ep->poll_wait);
    INIT_LIST_HEAD(&ep->rdllist);
    ep->rbr = RB_ROOT;
    ep->ovflist = EP_UNACTIVE_PTR;
    ep->user = user;

    *pep = ep;

    return 0;

free_uid:
    free_uid(user);
    return error;
} 
```

*   ep-> wq: “wq” - это очередь ожидания, которую ”epoll\_wait ()" будет использовать при ожидании готовности события.；
    
*   ep-> poll\_wait: ”poll\_wait" - это
    
*   ep-> rdllist: "rdllist” - это очередь готовности, используемая для проведения событий epoll ready;
    

Часть вторая: Регистрация на мероприятие epoll
----------------------------------------------

“epoll\_ctl()" используется для регистрации события с помощью epoll, "epfd" указывает ”fd”, возвращаемый "epoll\_create()", "op" определяет операцию добавления, удаления и изменения событий, ”fd” указывает сокет или другой "fd", который необходимо отслеживать, а "event" указывает способ прослушивания событий. (Например, LT / ET..), исходный код выглядит следующим образом：

```
 SYSCALL_DEFINE4(epoll_ctl, int, epfd, int, op, int, fd,
        struct epoll_event __user *, event)
{
    int error;
    int did_lock_epmutex = 0;
    struct file *file, *tfile;
    struct eventpoll *ep;
    struct epitem *epi;
    struct epoll_event epds;

    error = -EFAULT;
    if (ep_op_has_event(op) &&
        copy_from_user(&epds, event, sizeof(struct epoll_event)))
        goto error_return;

    
    error = -EBADF;
    file = fget(epfd);
    if (!file)
        goto error_return;

    
    tfile = fget(fd);
    if (!tfile)
        goto error_fput;

    
    error = -EPERM;
    if (!tfile->f_op || !tfile->f_op->poll)
        goto error_tgt_fput;

    
    if ((epds.events & EPOLLWAKEUP) && !capable(CAP_BLOCK_SUSPEND))
        epds.events &= ~EPOLLWAKEUP;

    
    error = -EINVAL;

    

    if (file == tfile || !is_file_epoll(file))
        goto error_tgt_fput;

    
    ep = file->private_data;

    

    

    if (op == EPOLL_CTL_ADD || op == EPOLL_CTL_DEL) {
        mutex_lock(&epmutex);
        did_lock_epmutex = 1;
    }
    if (op == EPOLL_CTL_ADD) {
        if (is_file_epoll(tfile)) {
            error = -ELOOP;
            if (ep_loop_check(ep, tfile) != 0) {
                clear_tfile_check_list();
                goto error_tgt_fput;
            }
        } else
            list_add(&tfile->f_tfile_llink, &tfile_check_list);
    }

    mutex_lock_nested(&ep->mtx, 0);

    
    epi = ep_find(ep, tfile, fd);

    error = -EINVAL;
    switch (op) {
    case EPOLL_CTL_ADD:
        if (!epi) {
            epds.events |= POLLERR | POLLHUP;
            error = ep_insert(ep, &epds, tfile, fd);
        } else
            error = -EEXIST;
        clear_tfile_check_list();
        break;
    case EPOLL_CTL_DEL:
        if (epi)
            error = ep_remove(ep, epi);
        else
            error = -ENOENT;
        break;
    case EPOLL_CTL_MOD:
        if (epi) {
            epds.events |= POLLERR | POLLHUP;
            error = ep_modify(ep, epi, &epds);
        } else
            error = -ENOENT;
        break;
    }
    mutex_unlock(&ep->mtx);

error_tgt_fput:
    if (did_lock_epmutex)
        mutex_unlock(&epmutex);

    fput(tfile);
error_fput:
    fput(file);
error_return:

    return error;
} 
```

Код перед ”ep\_find()” используется для выполнения некоторых операций обработки исключений. epoll не разрешено прослушивать в цикле, то есть ”fd”, который прослушивает ”epoll\_ctl()", не может быть самим описанием файла epoll.

Основной код "EPOLL\_CTL()" находится после "ep\_find()". Фактически, это ”EPOLL\_CTL\_ADD / EPOLL\_CTL\_DEL / EPOLL\_CTL\_MOD” в инструкции "switch" для завершения регистрации, удаления и модификации событий. Код последних двух не очень сложный. Давайте сосредоточимся непосредственно на основной функции регистрации событий "ep\_insert()".”.

```
 /* linux-3.10.103/linux-3.10.103/fs/eventpoll.c */

/*
 * Must be called with "mtx" held.
 */
static int ep_insert(struct eventpoll *ep, struct epoll_event *event,
             struct file *tfile, int fd)
{
    int error, revents, pwake = 0;
    unsigned long flags;
    long user_watches;
    struct epitem *epi;
    struct ep_pqueue epq;

    user_watches = atomic_long_read(&ep->user->epoll_watches);
    if (unlikely(user_watches >= max_user_watches))
        return -ENOSPC;

    /* slab可以提高epitem的分配和回收效率 */

    if (!(epi = kmem_cache_alloc(epi_cache, GFP_KERNEL)))
        return -ENOMEM;

    /* 三个队列的初始化，就绪队列、关联文件队列、等待队列 */   

    /* Item initialization follow here ... */
    INIT_LIST_HEAD(&epi->rdllink);
    INIT_LIST_HEAD(&epi->fllink);
    INIT_LIST_HEAD(&epi->pwqlist);

    /* 将epitem和对应的epoll关联起来 */

    epi->ep = ep;
    ep_set_ffd(&epi->ffd, tfile, fd);
    epi->event = *event;
    epi->nwait = 0;
    epi->next = EP_UNACTIVE_PTR;

    /* epoll的自动休眠问题，有兴趣可以阅读EPOLLWAKEUP的注释 */

    if (epi->event.events & EPOLLWAKEUP) {
        error = ep_create_wakeup_source(epi);
        if (error)
            goto error_create_wakeup_source;
    } else {
        RCU_INIT_POINTER(epi->ws, NULL);
    }

    /* 设置epoll的poll table，其实就是设置epq.pt的回调函数为ep_ptable_queue_proc */

    /* Initialize the poll table using the queue callback */
    epq.epi = epi;
    init_poll_funcptr(&epq.pt, ep_ptable_queue_proc);

    /*
     * Attach the item to the poll hooks and get current event bits.
     * We can safely use the file* here because its usage count has
     * been increased by the caller of this function. Note that after
     * this operation completes, the poll callback can start hitting
     * the new item.
     */

    /* 将上面设置好回调函数的epq.pt传入驱动层 */
    revents = ep_item_poll(epi, &epq.pt);

    /*
     * We have to check if something went wrong during the poll wait queue
     * install process. Namely an allocation for a wait queue failed due
     * high memory pressure.
     */
    error = -ENOMEM;
    if (epi->nwait < 0)
        goto error_unregister;

    /* Add the current item to the list of active epoll hook for this file */
    spin_lock(&tfile->f_lock);
    list_add_tail(&epi->fllink, &tfile->f_ep_links);
    spin_unlock(&tfile->f_lock);

    /* 添加epitem至epoll的红黑树中 */

    /*
     * Add the current item to the RB tree. All RB tree operations are
     * protected by "mtx", and ep_insert() is called with "mtx" held.
     */
    ep_rbtree_insert(ep, epi);

    /* now check if we've created too many backpaths */
    error = -EINVAL;
    if (reverse_path_check())
        goto error_remove_epi;

    /* We have to drop the new item inside our item list to keep track of it */
    spin_lock_irqsave(&ep->lock, flags);

    /* If the file is already "ready" we drop it inside the ready list */
    if ((revents & event->events) && !ep_is_linked(&epi->rdllink)) {
        list_add_tail(&epi->rdllink, &ep->rdllist);
        ep_pm_stay_awake(epi);

        /* Notify waiting tasks that events are available */
        if (waitqueue_active(&ep->wq))
            wake_up_locked(&ep->wq);
        if (waitqueue_active(&ep->poll_wait))
            pwake++;
    }

    spin_unlock_irqrestore(&ep->lock, flags);

    atomic_long_inc(&ep->user->epoll_watches);

    /* We have to call this outside the lock */
    if (pwake)
        ep_poll_safewake(&ep->poll_wait);

    return 0;

error_remove_epi:
    spin_lock(&tfile->f_lock);
    if (ep_is_linked(&epi->fllink))
        list_del_init(&epi->fllink);
    spin_unlock(&tfile->f_lock);

    rb_erase(&epi->rbn, &ep->rbr);

error_unregister:
    ep_unregister_pollwait(ep, epi);

    /*
     * We need to do this because an event could have been arrived on some
     * allocated wait queue. Note that we don't care about the ep->ovflist
     * list, since that is used/cleaned only inside a section bound by "mtx".
     * And ep_insert() is called with "mtx" held.
     */
    spin_lock_irqsave(&ep->lock, flags);
    if (ep_is_linked(&epi->rdllink))
        list_del_init(&epi->rdllink);
    spin_unlock_irqrestore(&ep->lock, flags);

    wakeup_source_unregister(ep_wakeup_source(epi));

error_create_wakeup_source:
    kmem_cache_free(epi_cache, epi);

    return error;
} 
```

INIT\_LIST\_HEAD завершает инициализацию трех очередей, связанных с объектом события epoll ”epitem”：

*   rdllink: очередь готовности к событию epitem；
    
*   fllink: очередь файлов, связанная с epitem；
    
*   pwqlist: очередь ожидания epitem；
    

Эти три очереди очень важны. ”fllink" используется для записи дескрипторов файлов, связанных с epitem (которые будут использоваться при освобождении ресурсов). ”rdllink” и "pwqlist" будут проанализированы позже.

epoll установит для своей функции обратного вызова значение ”ep\_ptable\_queue\_proc ()" при регистрации события. Когда событие прибудет, уровень драйвера вызовет функцию обратного вызова для завершения активации события.

_“ep\_item\_poll()” вызовет соответствующую операцию опроса ”fd”, чтобы узнать, поступит ли событие. Если вам интересно, вы можете прочитать ”poll\_wait ()" уровня драйвера. В этой части есть возможность поговорить об этом снова._

Когда epoll регистрирует событие, он вставляет объект event в красно-черное дерево ”rbr” epoll. Временная стоимость равна O (logn), а n - общее количество событий. При обычных обстоятельствах это общее количество подключений.

"ep\_insert()" также определит, готов ли файл, представленный текущим ”fd” (код за красно-черным деревом). если он готов, добавьте его непосредственно в "rdllink", а затем запустите ожидающий целевой процесс.；

Часть третья: Готовность epoll к мероприятиям
---------------------------------------------

”ep\_ptable\_queue\_proc()”, упомянутый в регистрации событий epoll, связывает объект события epoll с драйвером устройства (в основном сетевой карты). Когда происходит соответствующее событие, уровень драйвера вызывает функцию обратного вызова.

```
 /* linux-3.10.103/linux-3.10.103/fs/eventpoll.c */

/*
 * This is the callback that is used to add our wait queue to the
 * target file wakeup lists.
 */
static void ep_ptable_queue_proc(struct file *file, wait_queue_head_t *whead,
                 poll_table *pt)
{
    struct epitem *epi = ep_item_from_epqueue(pt);
    struct eppoll_entry *pwq;

    if (epi->nwait >= 0 && (pwq = kmem_cache_alloc(pwq_cache, GFP_KERNEL))) {
        init_waitqueue_func_entry(&pwq->wait, ep_poll_callback);
        pwq->whead = whead;
        pwq->base = epi;
        add_wait_queue(whead, &pwq->wait);
        list_add_tail(&pwq->llink, &epi->pwqlist);
        epi->nwait++;
    } else {
        /* We have to signal that an error occurred */
        epi->nwait = -1;
    }
} 
```

Как можно видеть, основная логика этой функции обратного вызова заключается в использовании очереди ожидания ядра Linux для добавления объекта ”eppoll\_entry” в очередь ожидания ”pwqlist” epitem и присвоения его функции обратного вызова значения ”ep\_poll\_callback()”.

“ep\_ptable\_queue\_proc()" должен взаимодействовать с кодом уровня драйвера для завершения обратного вызова. В основном это код реализации стека протоколов TCP / IP. Мы не будем здесь его расширять. По умолчанию, когда данные достигают уровня драйвера, "ep\_poll\_callback()" будет вызван обратно.

```
 /* linux-3.10.103/linux-3.10.103/fs/eventpoll.c */

/*
 * This is the callback that is passed to the wait queue wakeup
 * mechanism. It is called by the stored file descriptors when they
 * have events to report.
 */
static int ep_poll_callback(wait_queue_t *wait, unsigned mode, int sync, void *key)
{
    int pwake = 0;
    unsigned long flags;
    struct epitem *epi = ep_item_from_wait(wait);
    struct eventpoll *ep = epi->ep;

    if ((unsigned long)key & POLLFREE) {
        ep_pwq_from_wait(wait)->whead = NULL;
        /*
         * whead = NULL above can race with ep_remove_wait_queue()
         * which can do another remove_wait_queue() after us, so we
         * can't use __remove_wait_queue(). whead->lock is held by
         * the caller.
         */
        list_del_init(&wait->task_list);
    }

    spin_lock_irqsave(&ep->lock, flags);

    /*
     * If the event mask does not contain any poll(2) event, we consider the
     * descriptor to be disabled. This condition is likely the effect of the
     * EPOLLONESHOT bit that disables the descriptor when an event is received,
     * until the next EPOLL_CTL_MOD will be issued.
     */
    if (!(epi->event.events & ~EP_PRIVATE_BITS))
        goto out_unlock;

    /*
     * Check the events coming with the callback. At this stage, not
     * every device reports the events in the "key" parameter of the
     * callback. We need to be able to handle both cases here, hence the
     * test for "key" != NULL before the event match test.
     */
    if (key && !((unsigned long) key & epi->event.events))
        goto out_unlock;

    /*
     * If we are transferring events to userspace, we can hold no locks
     * (because we're accessing user memory, and because of linux f_op->poll()
     * semantics). All the events that happen during that period of time are
     * chained in ep->ovflist and requeued later on.
     */
    if (unlikely(ep->ovflist != EP_UNACTIVE_PTR)) {
        if (epi->next == EP_UNACTIVE_PTR) {
            epi->next = ep->ovflist;
            ep->ovflist = epi;
            if (epi->ws) {
                /*
                 * Activate ep->ws since epi->ws may get
                 * deactivated at any time.
                 */
                __pm_stay_awake(ep->ws);
            }

        }
        goto out_unlock;
    }

    /* 添加就绪事件至rdllist */

    /* If this file is already in the ready list we exit soon */
    if (!ep_is_linked(&epi->rdllink)) {
        list_add_tail(&epi->rdllink, &ep->rdllist);
        ep_pm_stay_awake_rcu(epi);
    }

    /*
     * Wake up ( if active ) both the eventpoll wait list and the ->poll()
     * wait list.
     */

    /* 唤醒阻塞在epoll_wait()的进程 */

    if (waitqueue_active(&ep->wq))
        wake_up_locked(&ep->wq);

    /* 唤醒阻塞在eventpoll文件的进程 */

    if (waitqueue_active(&ep->poll_wait))
        pwake++;

out_unlock:
    spin_unlock_irqrestore(&ep->lock, flags);

    /* We have to call this outside the lock */
    if (pwake)
        ep_poll_safewake(&ep->poll_wait);

    return 1;
} 
```

У ”ep\_poll\_callback()" есть две основные функции.:：

*   Добавьте готовое событие в "rdllist”；
    
*   Активируйте процесс, заблокированный в ”epoll\_wait()”；
    

Давайте, наконец, проанализируем исходный код ”epoll\_wait()".：

```
 SYSCALL_DEFINE4(epoll_wait, int, epfd, struct epoll_event __user *, events,
        int, maxevents, int, timeout)
{
    int error;
    struct fd f;
    struct eventpoll *ep;

    
    if (maxevents <= 0 || maxevents > EP_MAX_EVENTS)
        return -EINVAL;

    
    if (!access_ok(VERIFY_WRITE, events, maxevents * sizeof(struct epoll_event)))
        return -EFAULT;

    
    f = fdget(epfd);
    if (!f.file)
        return -EBADF;

    
    error = -EINVAL;
    if (!is_file_epoll(f.file))
        goto error_fput;

    
    ep = f.file->private_data;

    
    error = ep_poll(ep, events, maxevents, timeout);

error_fput:
    fdput(f);
    return error;
} 
```

Эта часть кода очень краткая. Наше основное внимание уделяется входным параметрам ”events” и "maxevents" и функции "ep\_poll()”. "events” и ”maxevents" - это места, предоставляемые пользователем ядру для добавления готовых событий, так что можно избежать многократного копирования пользовательского пространства и пространства ядра..

Код для ”ep\_poll ()" выглядит следующим образом：

```
 /* linux-3.10.103/linux-3.10.103/fs/eventpoll.c */

/**
 * ep_poll - Retrieves ready events, and delivers them to the caller supplied
 *           event buffer.
 *
 * @ep: Pointer to the eventpoll context.
 * @events: Pointer to the userspace buffer where the ready events should be
 *          stored.
 * @maxevents: Size (in terms of number of events) of the caller event buffer.
 * @timeout: Maximum timeout for the ready events fetch operation, in
 *           milliseconds. If the @timeout is zero, the function will not block,
 *           while if the @timeout is less than zero, the function will block
 *           until at least one event has been retrieved (or an error
 *           occurred).
 *
 * Returns: Returns the number of ready events which have been fetched, or an
 *          error code, in case of error.
 */
static int ep_poll(struct eventpoll *ep, struct epoll_event __user *events,
           int maxevents, long timeout)
{
    int res = 0, eavail, timed_out = 0;
    unsigned long flags;
    long slack = 0;
    wait_queue_t wait;
    ktime_t expires, *to = NULL;

    if (timeout > 0) {
        struct timespec end_time = ep_set_mstimeout(timeout);

        slack = select_estimate_accuracy(&end_time);
        to = &expires;
        *to = timespec_to_ktime(end_time);
    } else if (timeout == 0) {
        /*
         * Avoid the unnecessary trip to the wait queue loop, if the
         * caller specified a non blocking operation.
         */
        timed_out = 1;
        spin_lock_irqsave(&ep->lock, flags);
        goto check_events;
    }

fetch_events:
    spin_lock_irqsave(&ep->lock, flags);

    /* 如果没有就绪事件，则持续等待，直到有事件被激活或者超时 */

    if (!ep_events_available(ep)) {
        /*
         * We don't have any available event to return to the caller.
         * We need to sleep here, and we will be wake up by
         * ep_poll_callback() when events will become available.
         */

        /* 进程将在此休眠，直到上文中的"ep_poll_callback()"在有事件就绪时唤醒该进程 */

        init_waitqueue_entry(&wait, current);
        __add_wait_queue_exclusive(&ep->wq, &wait);

        for (;;) {
            /*
             * We don't want to sleep if the ep_poll_callback() sends us
             * a wakeup in between. That's why we set the task state
             * to TASK_INTERRUPTIBLE before doing the checks.
             */
            set_current_state(TASK_INTERRUPTIBLE);
            if (ep_events_available(ep) || timed_out)
                break;
            if (signal_pending(current)) {
                res = -EINTR;
                break;
            }

            spin_unlock_irqrestore(&ep->lock, flags);
            if (!schedule_hrtimeout_range(to, slack, HRTIMER_MODE_ABS))
                timed_out = 1;

            spin_lock_irqsave(&ep->lock, flags);
        }
        __remove_wait_queue(&ep->wq, &wait);

        set_current_state(TASK_RUNNING);
    }
check_events:
    /* Is it worth to try to dig for events ? */
    eavail = ep_events_available(ep);

    spin_unlock_irqrestore(&ep->lock, flags);

    /*
     * Try to transfer events to user space. In case we get 0 events and
     * there's still timeout left over, we go trying again in search of
     * more luck.
     */

    /* 注释很明白地解释了内核在此将就绪事件拷贝至用户空间中 */

    if (!res && eavail &&
        !(res = ep_send_events(ep, events, maxevents)) && !timed_out)
        goto fetch_events;

    return res;
} 
```

Важная причина, по которой epoll более эффективен, чем select и poll, заключается в том, что ему нужно только просматривать события ready во время проверки готовности. Посредством приведенного выше анализа также проверяется его принцип.

Когда epoll реализует ”epoll\_wait()”, ему не нужно просматривать все события. Он активно копирует готовые события в очередь готовности ”rdllist” через механизм обратного вызова.

Кроме того, epoll эффективно использует очередь ожидания ядра Linux для пробуждения процесса, заблокированного с помощью ”epoll\_wait()”, вовремя, когда событие готово.

подводить итог
--------------

код epoll действительно относительно прост и компактен, но механизм его реализации в основном зависит от очереди ожидания ядра Linux, поэтому его модель обратного вызова непросто понять.

Анализируя реализацию epoll в исходном коде, также легко понять причины и принципы реализации, почему его эффективность более эффективна, чем select и poll.

Однако у epoll на самом деле есть некоторые проблемы. Epoll полагается на характеристики красно-черного дерева для добавления и удаления событий. Временная сложность красно-черного дерева при добавлении и удалении узлов равна O (logn), поэтому все еще существуют определенные проблемы с производительностью при частом установлении и закрытии соединений при больших подключениях (в сценарии ультракоротких подключений), следовательно, применимый сценарий epoll в основном, когда количество активных подключений ограничено.