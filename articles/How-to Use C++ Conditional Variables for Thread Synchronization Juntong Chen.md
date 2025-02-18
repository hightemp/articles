# How-to: Use C++ Conditional Variables for Thread Synchronization | Juntong Chen
[Contents](#contents)
---------------------

*   [Intro](#intro)
*   [Example](#example)
    *   [If you are using Linux](#if-you-are-using-linux)
*   [Ныряй Глубже](#dive-deeper)
    *   [Зачем нам нужны `unique_lock` и `mutex`?](#why-do-we-need-unique_lock-and-mutex)
    *   [Что делать, если условие выполнено до ожидания / никогда не выполнено?](#what-if-the-condition-is-met-before-waitnever-met)
    *   [Что делать, если notify() вызывается перед ожиданием / никогда не вызывается?](#what-if-notify-is-called-before-waitnever-called)
    *   [Приостановить или Заблокировать](#suspend-vs-block)
*   [Заключение](#conclusion)

[Вступление](#intro)
--------------------

Условные переменные — это примитив синхронизации в C++, который позволяет потокам ожидать выполнения определённого условия[1](#user-content-fn-cppref). Это полезно, когда нужно координировать выполнение нескольких потоков. Чтобы использовать условную переменную, вам понадобится:

*   Условная переменная `std::contional_variable cv`
*   Мьютекс `std::mutex mtx` и блокировка `std::unique_lock<std::mutex> lck(mtx)`
*   Подходящие условия ожидания для проверки
*   Соответствующие вызовы уведомлений из других потоков

Вот упрощенная структура использования условной переменной:

```null
std::mutex mtx;{    std::unique_lock<std::mutex> lck(mtx);    cv.wait(lck, [] {return condition;    });}{    std::unique_lock<std::mutex> lck(mtx);    condition = true;    cv.notify_one();}
```

Здесь поток 1 приостанавливается вызовом `.wait` до `condition == true`. Однако CVs не будет автоматически пробуждать поток при выполнении условия. Вместо этого он проверяет условие при получении уведомления от другого потока. Именно здесь на помощь приходят `.notify_one()` и `.notify_all()`. В других потоках, вызывая:

*   `cv.notify_one()`(чтобы случайным образом разбудить один поток, приостановленный `cv`)
*   `cv.notify_all()` (чтобы разбудить все потоки, приостановленные `cv`)

`cv` проверит условие и разбудит поток, если условие выполнено.

[Пример](#example)
------------------

Здесь мы приводим пример, чтобы проиллюстрировать фактическое использование условных переменных. Это абстрактный пример из реального сценария, над которым я недавно работал, где нам нужно собирать данные о производительности для каждого запущенного потока. Допустим, у нас есть несколько рабочих потоков, которые проходят два этапа: подготовка и выполнение. Обычно мы хотим дождаться, пока все потоки завершат подготовку, сделать что-то ещё в основных потоках и запустить выполнение для всех рабочих потоков.

В этом примере у нас есть класс `Worker` , который создаёт несколько рабочих потоков, где каждый поток:

*   Задает имя своего потока с помощью `pthread_setname_np` (Этап подготовки)
*   Задержка на 1 секунду (этап загрузки полезной нагрузки)

У нас также есть класс `Reporter` , который сообщает идентификатор и имена всех рабочих потоков, что требует, чтобы все потоки завершили этап подготовки перед отправкой данных. После отправки данных мы хотим запустить этап обработки данных для всех рабочих потоков.

Для этого мы используем условную переменную `cv_ready` для ожидания завершения этапа подготовки всеми потоками. Её условие — `num_ready == num_workers`, где `num_ready` — количество потоков, завершивших этап подготовки, а `num_workers` — общее количество рабочих потоков. Мы используем `cv_ready.notify_one()` в рабочих потоках, чтобы уведомить основной поток о необходимости проверить условие и вернуться. После подготовки рабочие потоки приостанавливаются с помощью `cv`, и в этот момент мы инициализируем класс `Reporter` и вызываем `report()` для передачи информации о потоке. После передачи информации мы вызываем `cv.notify_all()` для запуска этапа обработки данных во всех рабочих потоках.

```null
#include <condition_variable>#include <string>#include <pthread.h>#include <thread>#include <vector>#include <iostream>#include <mach/mach.h>class Reporter {public:Reporter() {task_threads(mach_task_self(), &threads, &thread_count);        std::cout << "[Reporter] Reporter loaded. Found " << thread_count << " threads." << std::endl;    }void report() {        std::cout << "[Reporter] Reporting all threads:" << std::endl;for (int i = 0; i < thread_count; i++) {char thread_name[64];uint64_t tid;pthread_t pthread = pthread_from_mach_thread_np(threads[i]);pthread_getname_np(pthread, thread_name, sizeof(thread_name));pthread_threadid_np(pthread, &tid);            std::cout << "[Reporter]   - thread " << i << " name: "                       << thread_name << " tid: " << tid << std::endl;        }    }private:thread_act_array_t threads;mach_msg_type_number_t thread_count;};class Worker {public:Worker(int16_t n) : num_workers(n), num_ready(0) { }void worker_thread(std::string thread_name, uint16_t thread_id) {        {            std::lock_guard<std::mutex> lck(mtx);pthread_setname_np(thread_name.c_str());            std::cout << "[Worker] Thread " << thread_name << " ready to run." << std::endl;            num_ready++;            cv_ready.notify_one();        }        std::unique_lock<std::mutex> lck(mtx);        cv.wait(lck, [this] {return num_ready == num_workers;        });        lck.unlock();        std::this_thread::sleep_for(std::chrono::seconds (1));        {            std::lock_guard<std::mutex> lck(mtx);            std::cout << "[Worker] Thread " << thread_name << " finished." << std::endl;        }    }void create_workers() {        std::string main_thread_name = "main";pthread_setname_np(main_thread_name.c_str());for (int i = 0; i < num_workers; i++) {            std::string worker_name = "worker-" + std::to_string(i);            m_threads.emplace_back(std::thread(&Worker::worker_thread, this, worker_name, i));        }        std::unique_lock<std::mutex> lck(mtx_ready);        cv_ready.wait(lck, [this] {return num_ready == num_workers;        });    }void report() {        Reporter *reporter = new Reporter();        reporter->report();    }void run() {        cv.notify_all();for (auto &t: m_threads) {            t.join();        }    }private:int16_t num_workers;int16_t num_ready;    std::vector<std::thread> m_threads;    std::condition_variable cv;    std::mutex mtx;    std::condition_variable cv_ready;    std::mutex mtx_ready;};int main() {    Worker *worker = new Worker(5);    worker->create_workers();    worker->report();    worker->run();}
```

Мы можем получить следующий результат:

```null
[Worker] Thread worker-0 ready to run.[Worker] Thread worker-3 ready to run.[Worker] Thread worker-1 ready to run.[Worker] Thread worker-2 ready to run.[Worker] Thread worker-4 ready to run.[Reporter] Reporter loaded. Found 6 threads.[Reporter]   - thread 0 name: main tid: 4454155[Reporter]   - thread 1 name: worker-0 tid: 4454239[Reporter]   - thread 2 name: worker-1 tid: 4454240[Reporter]   - thread 3 name: worker-2 tid: 4454241[Reporter]   - thread 4 name: worker-3 tid: 4454242[Reporter]   - thread 5 name: worker-4 tid: 4454243[Worker] Thread worker-4 finished.[Worker] Thread worker-3 finished.[Worker] Thread worker-0 finished.[Worker] Thread worker-2 finished.[Worker] Thread worker-1 finished.
```

Здесь первые 5 строк — это этап подготовки рабочих потоков, а следующие 7 строк — это информация о потоках, предоставляемая классом `Reporter`  . После предоставления информации рабочие потоки одновременно начинают выполнять свою задачу и завершают её в случайном порядке.

### [Если вы используете Linux](#if-you-are-using-linux)

Обратите внимание, что в коде используются системные вызовы macOS в приложении Reporter. Если вы используете систему Linux, вместо этого можно использовать следующий `Reporter` класс:

```null
#include <dirent.h>#include <fstream>class Reporter {public:Reporter() {        DIR *dir = opendir("/proc/self/task");if (dir) {struct dirent *entry;while ((entry = readdir(dir)) != nullptr) {if (entry->d_type == DT_DIR && isdigit(entry->d_name[0])) {                    thread_ids.push_back(entry->d_name);                }            }closedir(dir);        }        thread_count = thread_ids.size();        std::cout << "[Reporter] Reporter loaded. Found " << thread_count << " threads." << std::endl;    }void report() {        std::cout << "[Reporter] Reporting all threads:" << std::endl;for (int i = 0; i < thread_count; i++) {            std::string tid = thread_ids[i];            std::string thread_name = get_thread_name(tid);            std::cout << "[Reporter]   - thread " << i << " name: " << thread_name                      << " tid: " << tid << std::endl;        }    }private:  std::vector<std::string> thread_ids;int thread_count;  std::string get_thread_name(const std::string &tid) {      std::ifstream comm_file("/proc/self/task/" + tid + "/comm");      std::string name;if (comm_file.is_open()) {          std::getline(comm_file, name);      }return name;  }};
```

Вам также необходимо изменить `pthread_setname_np` на `pthread_setname_np(pthread_self(), thread_name.c_str())` в `Worker` классе.

[Ныряй Глубже](#dive-deeper)
----------------------------

### [Зачем нам нужны `unique_lock` и `mutex`?](#why-do-we-need-unique_lock-and-mutex)

Как указано в справке cpp:

> Любой поток, который собирается ожидать `std::condition_variable`\-события, должен получить `std::unique_lock<std::mutex>`\-событие для мьютекса, используемого для защиты общей переменной.

Но почему? Интуитивно понятно, что если `cv` предназначено для приостановки потока до выполнения условия, то блокировка не нужна. Если мы хотим обеспечить безопасность потоков при оценке условий, почему бы просто не использовать атомарные переменные в предикате условия?

Давайте разберемся в деталях этого процесса:

```null
{    std::unique_lock<std::mutex> lck(mtx);    cv.wait(lck, [] {return ready;    });while(!ready) {        cv.wait(lck);    }}
```

Причины использования блокировок связаны с проверкой `wait` и условий. Во-первых, без блокировки условие может измениться между моментом проверки условия и моментом приостановки потока. Блокировка обеспечивает атомарность процесса. Другая причина — чтобы не пропустить уведомления, так как уведомление может быть вызвано непосредственно перед началом ожидания. Поэтому потоки, отправляющие уведомления, также должны использовать тот же мьютекс перед вызовом `notify`.

Другими словами, мьютекс предназначен для **защиты самой условной переменной**. Он будет освобождён, как только поток будет приостановлен, чтобы другие потоки могли получить доступ к условной переменной для уведомления и внести изменения в условия[2](#user-content-fn-whylock).

### [Что делать, если условие выполнено до ожидания / никогда не выполнено?](#what-if-the-condition-is-met-before-waitnever-met)

Когда поток уже приостановлен и cv получает уведомление, он проверяет условие и снова приостанавливает поток или пробуждает его. Однако при первом `wait` вызове cv условие не проверяется. Он приостанавливает поток, освобождает мьютекс и ожидает уведомления. Если условие уже выполнено при вызове `wait`, это похоже на вызов функции без предиката условия:

```null
{    std::unique_lock<std::mutex> lck(mtx);    cv.wait(lck);}
```

Если условие никогда не выполняется, то функция приостанавливается навсегда (как и ожидалось). В приведённом выше примере условие для `cv_ready` — `num_ready == num_workers`. Если оно никогда не будет выполнено, функция приостановки `create_workers` будет висеть бесконечно, указывая на то, что не все потоки готовы.

### [Что делать, если notify() вызывается перед ожиданием / никогда не вызывается?](#what-if-notify-is-called-before-waitnever-called)

Если мы отправим уведомление до вызова wait, оно будет потеряно, так как эти вызовы не ставятся в очередь. Без дополнительных уведомлений поток будет зависать до тех пор, пока не произойдёт ложное пробуждение[3](#user-content-fn-leimao). Иногда это происходит по ошибке, если вы забыли получить мьютекс в потоке, отправляющем уведомление, что подчёркивает важность мьютексов в `cv`s.

Если уведомление никогда не вызывается (и условия соблюдены), это не означает, что поток никогда не проснётся. Есть две возможности:

*   Истечение времени ожидания: если вы используете `wait_for` или `wait_until`, cv разбудит поток после истечения времени ожидания, несмотря на то, что условие не выполнено, и вернёт `false`, чтобы вы могли обработать случаи истечения времени ожидания:

```null
if (cv.wait_for(lck, std::chrono::seconds(1),                 [] { return ready; })) {} else {}if (cv.wait_until(lck, std::chrono::system_clock::now() + std::chrono::seconds(1),                  [] { return ready; })) {} else {}
```

*   Ложное пробуждение: по определению, ложное пробуждение — это ситуация, когда условная переменная пробуждается без уведомления[4](#user-content-fn-spurious). Это явление, обусловленное спецификой платформы и особенностями планирования потоков на уровне ОС[5](#user-content-fn-spuriouswhy), не является ни гарантированным, ни предсказуемым. Поэтому мы всегда должны проверять условия после пробуждения (вот почему параметр предиката в функции `wait` обычно необходим).

### [Приостановить или Заблокировать](#suspend-vs-block)

В этой статье я использую термин «приостановить» для описания поведения потока, когда он вызывает `cv.wait` вместо «блокировки». Я предпочитаю использовать термин «приостановить», потому что он лучше описывает поведение этого ожидания. Когда поток приостановлен, он не потребляет процессорное время до тех пор, пока не будет подан сигнал `cv` (при условии, что он создан с флагом `-pthread` в системах Linux)[6](#user-content-fn-pthread_wait). Теперь поток не запланирован, а его идентификатор вставлен в конец списка ожидающих потоков. Напротив, «блокировка» потока подразумевает, что поток выполняет какую-то операцию, которая мешает ему работать, например, борется за блокировку или ожидает ввода-вывода, что требует больше ресурсов процессора. Например, `do-while` цикл можно считать блокирующим поток:

```null
do {} while (!ready);
```

[Заключение](#conclusion)
-------------------------

Это очень много информации! Я потратил некоторое время на то, чтобы разобраться в этой теме, и надеюсь, что эта статья поможет вам получить общее представление о том, как работают условные переменные.

Одним словом, условные переменные приостанавливают поток в определённых местах и ожидают **уведомлений**, которые указывают ему возобновить работу (если условие выполнено) или продолжить ожидание (если условие не выполнено).

1.  [https://en.cppreference.com/w/cpp/thread/condition\_variable](https://en.cppreference.com/w/cpp/thread/condition_variable) [↩](#user-content-fnref-cppref)
    
2.  [https://stackoverflow.com/a/2763749/10926869](https://stackoverflow.com/a/2763749/10926869) [↩](#user-content-fnref-whylock)
    
3.  [https://leimao.github.io/blog/CPP-Condition-Variable](https://leimao.github.io/blog/CPP-Condition-Variable) [↩](#user-content-fnref-leimao)
    
4.  [https://en.wikipedia.org/wiki/Spurious\_wakeup](https://en.wikipedia.org/wiki/Spurious_wakeup) [↩](#user-content-fnref-spurious)
    
5.  [https://stackoverflow.com/a/1461956/10926869](https://stackoverflow.com/a/1461956/10926869) [↩](#user-content-fnref-spuriouswhy)
    
6.  [https://stackoverflow.com/a/3966781/10926869](https://stackoverflow.com/a/3966781/10926869) [↩](#user-content-fnref-pthread_wait)