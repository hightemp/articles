# Регламент для работы с ошибками в Go / Хабр
Ошибки в приложениях неизбежны, но мы можем их смягчить и упростить отладку. Но как выбрать правильный способ обработки?

В этой статье предлагаю разобраться, как организовать работу с ошибками в Go так, чтобы они не просто сигнализировали о проблеме, но и помогали быстро её локализовать, воспроизвести и устранить. Рассмотрим инструменты и ограничения Go, обсудим подходы к обработке ошибок, а в финале сформулируем регламент, который поможет выбрать оптимальный способ работы с ошибками в разных сценариях.

Я структурировал способы обработки в зависимости от контекста — ситуации и типа программ, в которой возникает ошибка. Типы разделений — условные, в реальных задачах рекомендую опираться на требования к ошибке:

*   Библиотека — узкоспециализированная программа, основной потребитель разработчик.
    
*   Command Line Interface — консольные утилиты, где пользователем может быть кто угодно, а даже если это программист, то он не обязан понимать, как CLI устроен внутри.
    
*   Сервисы — Worker, WEB/API/RPC-сервисы и др.
    

**Дисклеймер**: любые рекомендации, которые я даю, являются именно рекомендациями, а не догмой. Если вы хотите отступить от них, просто имейте наготове ответ, почему вы это делаете.

[Видеоверсия](https://www.youtube.com/watch?v=cwl3AjB3jQs) моего доклада по теме на [конференции Golang Conf 2024](https://golangconf.ru/2025?utm_source=habr&utm_medium=article&utm_campaign=go&utm_content=913096).

База: виды ошибок, wrapping, panic и линтеры
--------------------------------------------

В Go нет исключений — об этом подробно сказано [в FAQ, в разделе «Why does Go not have exceptions?»](https://go.dev/doc/faq#exceptions). Вместо этого ошибки представляют собой обычные значения, описанные через интерфейс `error`, и возвращаются напрямую из функций. Подробнее этот подход разобран [в статье «Errors are values»](https://go.dev/blog/errors-are-values) на go.dev.

```
type error interface {    Error() string}func Sqrt(f float64) (float64, error) {    if f < 0 {        return 0, errors.New("math: ...")    }    // implementation} 
```

Под обработкой ошибки в этой статье я подразумеваю проверку через `if`, возврат ошибки или логирование, а также определение типа ошибки с помощью `errors.Is` и `errors.As`, как в коде ниже.

```
f, err := os.Open("file.txt")if err != nil {    return err}if errors.Is(err, os.ErrNotExist) {    log.Print(err)}var pathError *fs.PathErrorif errors.As(err, &pathError) {    log.Printf("Failed at path: %s", pathError.Path)}
```

### Виды ошибок в Go

Есть три вида ошибок:

*   Необрабатываемые: `errors.New` или `fmt.Errorf` без директивы `%w`.
    
*   Sentinel errors.
    
*   Custom Errors / Error types.
    

Более подробный обзор — [в статье «Don’t just check errors, handle them gracefully»](https://dave.cheney.net/2016/04/27/dont-just-check-errors-handle-them-gracefully). А мы коротко пройдём по каждому виду.

#### Необрабатываемые ошибки

Из самого названия следует, что этот тип ошибок не получится программно отловить через `errors.Is` или `errors.As`. Можно попытаться использовать `strings.Contains` или регулярные выражения, но это ненадёжно — легко поймать лишние ошибки или не найти ничего при изменении текста ошибки.

```
func Sqrt(f float64) (float64, error) {    if f < 0 {        return 0, errors.New("math: ...")        // или        // return 0, fmt.Errorf("math: ...")    }    // implementation}
```

Такой подход не предназначен для библиотек и приложений, но уместен в CLI, где потребитель ошибки — чаще всего не программа, а считывающий текст пользователь.

#### Sentinel Error

Ошибки этого типа могут обрабатываться программно. Обычно они создаются во время запуска в виде глобальных переменных, обрабатываются через `errors.Is` и имеют [style guide](https://go.dev/wiki/Errors#naming), где в начале прописывается префикс `Err`.

```
var ErrSqrt = errors.New("math: square root of negative number")func Sqrt(f float64) (float64, error) {    if f < 0 {        return 0, ErrSqrt    }    // implementation}
```

Минус в том, что этот вид ошибок не содержит динамических данных. Чтобы их добавить, можно обернуть ошибку или прибегнуть к Custom Errors (Error types).

Sentinel Errors применяются во всех видах программ — в библиотеках, CLI и сервисах.

#### Custom Errors / Error types

Ошибки этого типа мы задаём в виде отдельной структуры. Данные в них можно добавить динамически и потом вывести.

```
type SqrtError struct {    Value float64}func NewSqrtError(value float64) error {	return &SqrtError{Value:value}}func (e *SqrtError) Error() string {    return fmt.Sprintf(          "math: square root of negative number (%d)",           e.Value)}
```

Custom Errors легко обрабатываются программно с помощью [errors.As](http://errors.as/) и имеют простой [style guide](https://go.dev/wiki/Errors#naming) — в конце дописываем суффикс `Error`. Применяются во всех видах программ.

Можно реализовать дополнительные методы для определения ошибки Custom Errors через поведение.

*   func (e \*netError) Timeout() bool       { / ... / }
    
*   func (e \*netError) Temporary() bool     { / ... / }
    
*   func (e \*netError) Retryable() bool     { / ... / }
    
*   func (e \*netError) Unwrap() error       { / ... / }
    
*   func (e \*netError) Is(target error) bool { / ... / }
    

Это поведение должно быть независимым от контекста.

Например, при разрешении DNS одна программа, допустим, host, получит ошибку и сразу завершится, для неё это фатальная ошибка. А в случае с curl запрос будет повторяться, и ошибка уже считается временной.

*   func (e \*netError) Timeout() bool       { / ... / }
    
*   ~func (e \*netError) Temporary() bool     { / ... / }~
    
*   ~func (e \*netError) Retryable() bool     { / ... / }~
    
*   func (e \*netError) Unwrap() error       { / ... / }
    
*   func (e \*netError) Is(target error) bool { / ... / }
    

Поэтому, если вы добавляете методы в Custom Errors, то называйте их так, чтобы они считывались в разных контекстах одинаково. В [go#45729](https://github.com/golang/go/issues/45729) подробно описан этот кейс.

Когда используете Custom Errors, возвращайте error, а не \*netError, иначе err != nil будет работать некорректно. Детальнее об этом — [в руководстве Go Style Decisions от Google](https://google.github.io/styleguide/go/decisions#returning-errors).

### Wrapping 

Обёртка — мощный инструмент, который используется везде. Она позволяет  накинуть дополнительные сообщения в ошибку, объединить несколько ошибок в одну, добавить входные данные, сделать stacktrace и многое другое.

![](https://habrastorage.org/r/w1560/getpro/habr/upload_files/454/034/683/4540346838bcd78eebb2bbbcbb91ff49.png)

### Panic

Для обработки обычных ошибок в Go `panic` не используется — для этого есть возврат ошибок (`error`). Но panic можно использовать, когда есть баг или логическая ошибка. Ниже несколько примеров таких ситуаций.

**Проверка значений при запуске программы:**

*   `var port = regexp.MustCompile(\`:(\[0-9\]+)$`) в` [`http/cgi`](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/net/http/cgi/host.go#L36).
    
*   определение размера `int` ОС для [gob](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/encoding/gob/decode.go#L1283).
    

Если мы хотим отлавливать порты и задаём для этого глобальную переменную, то при инициализации спокойно можем «упасть» с паникой, ведь программа ещё не запустилась.

**Некорректные или невозможные аргументы для функции, с которыми она не работает:**

*   [strconv.FormatInt](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/strconv/itoa.go#L90)`(5, 1)` паника при невозможной или нестандартной системе счисления < 2 или > 36;
    
*   [strings.Repeat](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/strings/strings.go#L571)`("text", -5)` паника при попытке повторить строку негативное количество раз.
    

**Недостижимое состояние:**

*   прочитано отрицательное число байт в [bufio](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/bufio/bufio.go#L229) или [bytes](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/bytes/buffer.go#L206);
    
*   не смогли декодировать тип [JSON](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/encoding/json/decode.go#L796) или [XML](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/encoding/xml/marshal.go#L943).
    

**Вызов не реализованной команды/инструкций на процессоре:**

*   вызов SSE42 инструкции в [hash](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/hash/crc32/crc32_amd64.go#L55);
    
*   вызов команды reminder в [math](https://github.com/golang/go/blob/45446c867a3ffdf893bdfd1e1ef9e30166eaa157/src/math/arith_s390x.go#L165).
    

### Линтеры

Чтобы автоматически поддерживать соглашения по работе с ошибками, помогают линтеры:

*   [errname](https://github.com/Antonboom/errname) — следит за соблюдением стайл-гайда в названиях ошибок Sentinel и Custom Errors;
    
*   [err113](https://github.com/Djarvur/go-err113/) — запрещает создавать необрабатываемые ошибки в `return` через `errors.New` и `fmt.Errorf` без `%w`;
    
*   [wrapcheck](https://github.com/tomarrell/wrapcheck) — настраиваем, где оборачивание обязательно;
    
*   [nilaway](https://github.com/uber-go/nilaway/) — ищет случаи `panic(nil)`.
    

Только первые три линтера включены в [golangci-lint](https://github.com/golangci/golangci-lint).

Дальше говорим об ошибках и способах их обработки.

Как описать ошибки в Go: правильный текст
-----------------------------------------

Что мы хотим получить от ошибки:

*   **Суть** → понять, что произошло.
    
*   **Место** → где и когда произошла ошибка.
    
*   **Воспроизводимость** → значения аргументов или входных параметрах, которые привели к ошибке.
    
*   **Обработка** → как поступить с ошибкой дальше и также добавить дополнительный функционал.
    

### Суть ошибки: что произошло

В Go ошибки строятся вокруг текста: сам интерфейс говорит нам об этом через возврат строки:

`type error interface { Error() string }`

Кто-то может возразить: мы же можем **создать отдельную переменную** и с помощью её имени описать, что произошло. Главное — не уйти в крайности, создав очень длинное или очень короткое имя. [Разработчики языка](https://go.dev/wiki/CodeReviewComments#variable-names) и [Google](https://google.github.io/styleguide/go/decisions#variable-names) рекомендуют придерживаться понятных и лаконичных названий.

```
// Плохоvar ErrNoFOrDir = errors.New(...)var ErrFileOrDirectoryWereNotFound = errors.New(...)// Подойдётvar ErrNotFoundFileOrDirectory = errors.New(...)var ErrFileOrDirNotFound = errors.New(...)var ErrNoFileOrDir = errors.New(...)
```

Другой вариант, если ошибка обозначает сложный кейс — **использовать комментарии**. Но они могут быть бесконечно длинными, редко обновляются, и в них нет динамических данных.

```
// UnacceptablePrice происходит, когда человек задает слишком высокую // или слишком низкую цену в регионе продажиvar UnacceptablePrice = errors.New(...)
```

**Или же использовать Custom Errors** и таким образом добавить динамические данные. 

```
type NotFoundFileOrDirecoryError struct {Path string}
```

Однако конечный потребитель — пользователь или разработчик — будет ориентироваться именно на текст сообщения, а не на код. Поэтому **концентрируемся на тексте ошибки**, чтобы явно описать, что произошло.

Благодаря текстово-центричной природе ошибок в Go, мы можем использовать разные форматы вывода через модификаторы `#`, `+`, `-` и другие благодаря [GoStringer](https://pkg.go.dev/fmt#example-GoStringer) и [Formatter](https://pkg.go.dev/fmt#Formatter).

Также существует отдельный интерфейс, который в случае сложно структурированной ошибки помогает сформировать разный вывод для глаголов и модификаторов вывода. Пока он запущен в качестве эксперимента, но его уже можно использовать.

```
package golang.org/x/xerrorstype Formatter interface {    error    FormatError(p Printer) (next error)}
```

### Требования к тексту ошибок

Теперь рассмотрим, какими свойствами должен обладать текст.

1.  **Лаконичность и выразительность**
    

// **Плохо**

`0x2` или `ENOENT (Error No Entity)` 

Избегайте сообщений вроде `ENOENT` или `0x2`. Такие коды, хоть и короткие, но невыразительны и непонятны без контекста.

Следующий вариант текста уже выразительный, но слишком длинный:

// **Плохо**

`file or directory that you're trying to process doesn't exist`

В идеале нужно добиваться, чтобы текст был и лаконичный, и выразительный.

// **Хорошо**

`no such file or directory`

2.  **Двоеточие, чтобы разделить части сообщения**
    

`read config: no such file or directory`

Двоеточие для разделения разных частей сообщения — это Go-специфичное свойство, к которому просто стоит привыкнуть. Иногда альтернативно используют ";". На этот счёт ждём вердикта в [proposal #49123](https://github.com/golang/go/issues/49123) ещё с 2021 года.

3.  **Отказ от слов «failed», «error», «cannot», «does not» и т.д.**
    

Рекомендация от [Uber](https://github.com/uber-go/guide/blob/master/style.md#error-wrapping) — бессмысленно использовать слова, которые не несут информации, потому что ошибка уже говорит: «Что-то не так». Убираем лишнее, и текст ошибки становится короче:

`~failed to~ x: ~cannot~ read config: ~error~ no such file or directory`

`x: read config: no such file or directory`

4.  **Сообщение начинается с маленькой буквы. Без точки в конце**
    

Ошибки в Go часто состоят из нескольких сообщений, [go.dev](http://go.dev/). Если будем склеивать с большой буквы, то получим волну, а это неудобно читать. В конце не ставим точку по той же причине: есть двоеточие как разделитель.

Но если всё-таки хочется начинать сообщение в логе с заглавной буквы, добавляйте префикс в лог, а не в саму ошибку:

`log.Printf("Error: %s, requestID=%s\n", err, reqID)`

Контекст: где и когда произошла ошибка
--------------------------------------

Описание ошибки — это **уникальный текст**.

В примере ниже содержание ошибки описано в две строки: «no such file or directory» отвечает на вопрос что произошло, а «open file.xml» — когда произошло. Не забывайте склеивать их вместе:

```
// Плохоno such file or directory // сообщает что произошлоopen file.xml // сообщает когда произошло// Хорошоopen file.xml: no such file or directory // сообщает что и когда произошло
```

Единое сообщение — короткое и понятное, этой информации нам чаще всего достаточно только в узкоспециализированных библиотеках.

Если же библиотека растёт, то с каждым новым уровнем функциональности нужно добавлять дополнительный контекст, чтобы потом отследить путь ошибки. В таком виде это можно использовать не только для библиотеки, но и для сервисов или CLI.

`read config: open file.xml: no such file or directory`

Дополнительным маркером хорошего описания ошибки является возможность легко найти её через поиск в редакторе, либо через grep "read config". 

**Текст ошибки** **зависит от потребителя**. Мы можем добавлять больше данных и сделать текст более человекочитаемым:

**read default json config:** open file.json: no such file or directory

**read user xml config:** open file.xml: no such file or directory

В сервисах стек вызовов может быть очень длинным, и сформулировать понятное описание ошибки бывает сложно. Поэтому здесь можно пренебречь читаемостью и разделять участки двоеточием:

**config: default: json reader:** open file.json: no such file or directory

**config: user: xml reader:** open file.xml: no such file or directory

Такой вариант со склеиванием приемлем для очень крупных библиотек или сервисов, где конечным потребителем ошибок является разработчик или подготовленный человек. Здесь, чтобы добиться человекочитаемости, нужно потратить слишком много времени. И стоит избегать в CLI, потому что конечный потребитель ошибки — пользователь, а не программист, который понимает, что происходит.

### Инструменты для описания того, где и когда произошла ошибка

1.  **Текстовый wrapping**
    

Самый простой способ добавить информацию в ошибку — это использовать `fmt.Errorf` с `%w`.

```
f, err := os.Open("file.xml")if err != nil {   return fmt.Errorf("read config: %w", err)}
```

Альтернативно можно использовать Custom Errors, чтобы добавить больше информации.

2.  **Filepath:codeline**
    

Другой способ определить, где и когда произошла ошибка — добавить путь к файлу и номер строки в коде:

`config/config.go:11 read config: open file.xml: no such file or directory`

Такой вариант стоит применять только в сервисах и с оговоркой, так как эту ошибку, скорее всего, будет читать разработчик, а не пользователь.

Создаём отдельный кастомный тип, в который храним путь и номер строки. Потом финально вызываем wrapping, в котором берём текущий stack frame и кладём в ошибку:

```
type fileCode struct {	msg string	err error}func (e *fileCode) Error() string {	return e.msg}func (e *fileCode) Unwrap() error {	return e.err}func FileCode(err error) error {	if err == nil {		return nil	}	_, file, line, _ := runtime.Caller(1)	return &fileCode{		msg: fmt.Sprintf("%s:%d: %v", file, line, err),		err: err,	}}
```

3.  **Stacktrace и Backtrace**
    

Более информативный способ — добавить контекст о том, где и когда произошла ошибка — использовать stacktrace в сервисах.

```
func main() {    eg.Go(config.Read) // так же вызываем в горутине errors.WithStack(err)    err := errors.WithStack(eg.Wait())    fmt.Printf("%+v\n", err)}/*read config: open file.xml: no such file or directoryconfig.Read     config/config.go:11main.main     cmd/main.go:10*/
```

Многие, кто пришёл в Go из других языков, привыкли, что stacktrace всегда под рукой. Кажется, если бы в Go тоже был встроенный stacktrace, то мы бы как зажили «хорошо», любую ошибку можно было бы исправить за пару секунд. В версии 1.13 у нас даже была такая возможность. Но 3 сентября 2019 разработчики от stacktrace отказались, и для этого были причины:

*   Если бы stacktrace добавили по умолчанию, мы потеряли бы **обратную совместимость**, потому что перестало бы работать сравнение, либо `reflect.DeepEqual` ([официальное объяснение](https://github.com/golang/go/issues/60873#issuecomment-1599583115)).
    
*   **Снижение производительности** затронуло бы все приложения, и это слишком серьёзный минус.
    
*   **Ограниченность stacktrace для goroutine**.  Когда мы положили stacktrace в ошибку, то увидели только стек текущей goroutine, а не родительской. Чтобы исправить это и stacktrace вновь появился, нужно добавлять его на границе вызова новой goroutine.
    

Сейчас идёт обсуждение, стоит ли добавлять stacktrace или backtrace именно в Go. Об этом много сказано в proposals [60873](https://github.com/golang/go/issues/60873#top), [63358](https://github.com/golang/go/issues/63358).

*   **Искусственное чувство осведомлённости**
    

В stacktrace очень большой объём информации, но насколько эта информация качественная? Да, она отвечает на вопрос, где произошла ошибка, но не говорит, что произошло и как это воспроизвести. Многие разработчики, создавая ошибки, думают: «Я добавил stacktrace, супер, у меня есть много информации», но по факту на вопросы: что произошло и как воспроизвести, ответов нет. В таком случае нам всё равно нужно думать о тексте ошибки и параметрах.

Мысли Rob Pike и Andrew Gerrand на эту тему в статье «[Error handling in Upspin](https://commandcenter.blogspot.com/2017/12/error-handling-in-upspin.html)», в разделе «Users and implementers».

*   **Разные версии приложения будут иметь разный stacktrace**
    

Если у пользователя версия V1, а у нас в локальной разработке уже V2, и мы серьёзно переписали код там, где возникла ошибка, stacktrace просто не совпадёт и окажется бесполезным. Но если мы заранее подумали над текстом ошибки, то именно он даст нам реальную пользу.

Однако, несмотря на перечисленные минусы, если программа уже работает в продакшене без подробных сообщений об ошибках и вам срочно нужно понять, где именно произошёл сбой, то stacktrace может сильно помочь. 

Для справки: в Proposals [Go 1.13 errors](https://github.com/golang/go/issues/29934) можно прочитать, как предполагалась реализация stacktrace в Go, и в [60873](https://github.com/golang/go/issues/60873#top) — ответ от разработчиков, почему это всё-таки не произошло.

Альтернативой stacktrace выступает **backtrace** и добавляет по одному фрейму на каждом уровне обработки ошибок через wrapping, что позволяет получить стек вызова даже в goroutine. Вот как это выглядит:

```
func main() error {    eg.Go(config.Read)    err := StackFrame(eg.Wait()) // cmd/main.go:10    fmt.Printf("%+v\n", err)}func ReadConfig(...) error {    return StackFrame(err, ...) // config/config.go:11}func Open(...) (*File, error) {return StackFrame(err, ...) // config/config.go:24}
```

Вот инструменты, которые позволяют внедрить stacktrace или backtrace автоматически или полуавтоматически:

*   [errtrace](https://github.com/bracesdev/errtrace?tab=readme-ov-file#automatic-instrumentation) — добавляет стек и переписывает все ошибки автоматически;
    
*   [wrapcheck](https://github.com/tomarrell/wrapcheck) — позволяет отследить все места где нет добавления стека;
    
*   [go-ruleguard](https://github.com/quasilyte/go-ruleguard) – позволяют создать правила для поиска где нужно добавить стек;
    
*   [semgrep, codeql, sourcegraph](https://semgrep.dev/docs/writing-rules/autofix) — позволяют создать правила для поиска и добавления стека.
    

Воспроизводимость ошибки
------------------------

Чтобы воспроизводить ошибку, нужно добавить в неё дополнительные данные.

`read user xml config: open file.xml: no such file`

Рассмотрим несколько способов:

1.  Самый простой и, надеюсь, уже любимый способ — через fmt.Errorf.
    

На каждом уровне мы докидываем дополнительную информацию. Это можно применять в любых видах программ:

```
func Run() error {    return fmt.Errorf("...: %w", err)}func ReadConfig(path, cType, format) error {    return fmt.Errorf(        "read %s %s config: %w", cType, format, err)}func Open(path string) (*File, error) {    return fmt.Errorf("open %s: %w", path, err)}
```

2\. Если параметров в функции много, можно записать их в одном из двух вариантов. Главное — соблюдать единый стиль во всей программе:

```
func Do(arg1, arg2, arg3, arg4) error {	// Вариант один	// Do arg1=str, arg2=2, arg3=...: source err    return fmt.Errorf("Do arg1=%s, arg2=%s,...: %w", arg1, ..., err)	// Вариант два как в slog	// Do(str, 2, ...): source err        return fmt.Errorf("Do(%s, %s,...): %w", arg1, ..., err)}
```

Основной минус такого оформления в том, что если потребитель — не разработчик, то вряд ли он сможет понять, что произошло. Поэтому применяем только в сервисах и очень редко в библиотеках.

Другие виды записи можно поизучать на [Github](https://github.com/search?q=lang%3AGo+%2Ffmt%5C.Errorf%5C%28%22.%2B%22%28%2C.%2B%29%7B4%2C%7D%5C%29%2F&type=code) или в [Golang репозитории](https://github.com/search?q=repo%3Agolang%2Fgo+%2Ffmt%5C.Errorf%5C%28%22.%2B%22%28%2C.%2B%29%7B4%2C%7D%5C%29%2F&type=code) через регулярку `/fmt\.Errorf\(".+"(,.+){4,}\)/`.

3\. Custom Errors

Чтобы описать ошибку с помощью Custom Errors, создаём отдельный тип, прописываем параметры, которые хотим в неё положить:

```
// Реальный пример https://pkg.go.dev/io/fs#PathErrortype ConfigError struct {    Format string   Type string   Err error // исходная ошибка}func (e *ConfigError) Error() string {   return "read" + e.Type + " " + e.Format + " config:" + e.Err.Error()}
```

Преимущество такого подхода, в отличие от fmt.Errorf, в том, что данные можно программно обработать — подходит для всех видов программ. Например, если ошибка содержит Type равный 'user', значит, проблема с пользовательским конфигом, и чтобы решить эту проблему, можно вызвать дефолтные настройки.

4\. Wrapping для неструктурированных данных

Альтернативно можно сделать отдельный wrapping, который будет хранить неструктурированные данные. В него можно складывать всё, что угодно:

```
type dataError struct {	err  error	data map[string]any}func (e *dataError) Error() string {	return fmt.Sprintf("%s: %s", e.err.Error(), e.data)}func (e *dataError) Data() map[string]any {	return e.data}func DataError(err error, data map[string]any) error {	return &dataError{		err:  err,		data: data,	}}if err != nil {	return DataWrapping(err, map[string]any{		"configType": cType,		"operation": op,	})}
```

Такой вариант подходит только для сервисов. В библиотеках этот способ не будет универсальным — это нужно объяснять пользователям. А в CLI важно, чтобы сообщение было понятным неспециалисту. Если мы закинем туда много неструктурированных данных, в этом будет неудобно разобраться.

Практическое применение DataError — когда мы снизу вверх «накладываем» неструктурированные данные в ошибку, а сверху в одном месте всё это логируем:

```
func main() {	err := Run()var dataErr interface{ Data() map[string]any}if errors.As(err, dataErr) {   log.Print(err, "\n", dataErr.Data())}}func Run() error {   return DataWrapping(err, map[string]any{"time": time.Now()})}func ReadConfig(path, format, cType) error {   return DataWrapping(err, map[string]any{"path": path,"format": format,"cType": cType,   })}func Open(path string) (*File, error) {return DataWrapping(err, map[string]any{"path": path})}
```

Этот вариант применим только в сервисах в случае, если вы не позаботились заранее о сообщениях в ошибки или хотите собирать как можно больше данных для отладки программы.

Дополнительно, если у вас есть общие наименования user\_id, order\_id и т.д., то создайте для них константы.

Я вдохновлялся [contexttags](https://github.com/cockroachdb/errors/blob/master/contexttags_api.go#L40) из `cockroachdb/errors` и [properties](https://github.com/joomcode/errorx/blob/master/property_test.go#L41) из `joomcode/errorx`.

Обработка ошибки: как определить и что делать дальше
----------------------------------------------------

В качестве **стандартных способов**, которые пришли к нам в [Go 1.13](https://go.dev/blog/go1.13-errors), есть два программных, применяющихся чаще всего:

*   `errors.Is` — пришёл на смену простому сравнению (`==`) или `switch err`.
    
*   `errors.As` — заменяет `type assertion serr`, `ok := err.(*SyntaxError)` или `switch err.(type)`
    

**Дополнительные способы**:

*   `strings.Contains / regexp:` используются только для необрабатываемых ошибок в старом коде или для API. Он помогает отлавливать нужные фрагменты текста, но это ненадёжно.
    
*   Синтаксический сахар: можно написать свою функцию `Any`
    

```
// Чтобы заменитьerrors.Is(err, ErrInput) || errors.Is(err, ErrNet) || ...// наcerrors.Any(err, ErrInput, ErrNet, ErrDB, ...)
```

### Локальная обработка

Чаще всего ошибки обрабатываются **там, где возникают**. Это выглядит так:

```
func ReadConfig(path, format, cType) {	f, err = Open(path)	if err != nil {		return err		// или		return Wrapping(err, format, cType)	}	// implementation}
```

В месте получения ошибки пишем `if err != nil` и дальше возвращаем её, или возвращаем с wrapping, или выполняем какую-то другую логику, такую как graceful degradation, ретрай, игнорирование ошибки или что-то другое.

Такой способ применим в любом виде программ, но у него есть недостаток. В приложениях однотипная обработка ошибок начнёт дублироваться:

```
func httpHandler(w http.ResponseWriter, r *http.Request) {	err := initDoSomethingCool()	if errors.Is(err, errPrepareAlToAoSomethingCool) {		w.WriteHeader(http.StatusForbidden)		return	}	if errors.Is(err, errNotFound) {		w.WriteHeader(http.StatusNotFound)		slog.Error(r.RequestURI, "err", err, "stacktrace", ExtractStacktrace(err))		return	}	if err != nil {		w.WriteHeader(http.StatusInternalServerError)		slog.Error(r.RequestURI, "err", err, "stacktrace", ExtractStacktrace(err))		return	}}
```

Чтобы избежать этого, используем централизованную обработку.

### Централизованная обработка

Чаще всего этот вид обработки выглядит как middleware либо декоратора и заключается в том, что мы собираем код в одном месте и создаём «единую точку правды» в виде функции `handleError`.

```
func httpHandler(w http.ResponseWriter, r *http.Request) {	err := initDoSomethingCool()	handleError(w, r, err)}func handleError(w http.ResponseWriter, r *http.Request, err error) {	if errors.Is(err, errPrepareAlToAoSomethingCool) {		w.WriteHeader(http.StatusForbidden)		return	}	if errors.Is(err, errNotFound) {		w.WriteHeader(http.StatusNotFound)		slog.Error(r.RequestURI, "err", err, "stacktrace", ExtractStacktrace(err))		return	}	if err != nil {		w.WriteHeader(http.StatusInternalServerError)		slog.Error(r.RequestURI, "err", err, "stacktrace", ExtractStacktrace(err))		return	}}
```

Метод применим в основном только в сервисах.

### Игнорирование ошибок

Дисклеймер: стремимся не игнорировать ошибки, иначе можно потерять контроль.

Если вы всё-таки решили игнорировать, делайте это явно: через нижнее подчеркивание и равно (`_=`). Также используйте [линтер errcheck](https://github.com/kisielk/errcheck), который подскажет, где вы забыли обработать ошибку:

```
package iotype Writer interface {	Write(p []byte) (n int, err error)}package main// Вместоfunc Write(w io.Writer, buf []byte) {	w.Write(buf)}// пишите явную, что вы не обрабатываете ошибкуfunc Write(w io.Writer, buf []byte) {	_, _ = w.Write(buf)}
```

Игнорировать можно в нескольких случаях:

*   **Ошибка невозможна**
    

Например, если мы маршаллим JSON из стандартной структуры, где ошибка не может произойти. Линтер [errchkjson](https://github.com/breml/errchkjson) подскажет, когда проверка избыточна.

Второй вариант — когда сама функция внутри по коду не предполагает возврат ошибки. В таком случае можно, паникнуть, потому что это невозможная ситуация. Но выбор за вами. Пример, когда код не может вернуть ошибку — [strings.Builder.Write](https://github.com/golang/go/blob/4f77a83589baa5a3038cc6e35615084dc7e5f0c1/src/strings/builder.go#L81).

*   **Ошибка не важна**
    

Если вы сознательно не обрабатываете ошибку, пометьте это решение, например, в комментарии или общем документе.

### Возврат ошибки наверх

Следующий вариант обработки — это вернуть ошибку через return err:

```
err = ReadConfig(...)if err != nil {   return err}
```

Это универсальный приём, который подходит для любой программы — CLI, сервиса, библиотеки.

### Дополнение текстом

Дополнить текстом можно через `fmt.Errorf` или с помощью кастомных типов. Укажите, где и почему произошла ошибка, и добавьте полезные данные или контекст:

```
err = ReadConfig(...)if err != nil {   return fmt.Errorf("context (%s): %w", data, err)}
```

Применим для всех видов программ.

### Заменить исходную ошибку новой 

Следующий вариант обработки ошибки — это когда мы заменяем какую-то внутреннюю ошибку нашей ошибкой один к одному:

```
if errors.Is(Err, sql.ErrNoRows) {   return ErrUserNotFound}
```

Такой вариант подходит для сервисов и CLI, но не подойдёт для библиотек, где важно сохранить цепочку причин и знать про нижележащие ошибки.

### Типизация ошибок

Дополнительно можно типизировать ошибки, обозначив, что ошибка произошла в области, которая относится к пользователю. Например, через `fmt.Errorf` или создать кастомный тип:

```
var ErrUser = errors.New("user")// user: source error msgfmt.Errorf("%w: %s", ErrUser, msg)// Custom Errorstype UserError struct {   err    ID int64}func (e *UserError) Error() string {/*...*/}
```

Применим для всех видов программ.

### Группировка ошибок

Ошибки можно объединять. Это полезно, если одна ошибка повлекла за собой другую или, если вы обрабатываете CSV-файл и хотите сохранить ошибки по всем строкам:

`errors.Join(ErrMaxRetry, err)`

Или, когда достигли максимального количества повторных попыток и важно знать исходную причину, а не только то, что мы достигли лимита попыток:

`fmt.Errorf("%w: %w", ErrMaxRetry, err)`

`fmt.Errorf("%w: %w", ErrUser, err)`

Применим для всех видов программ.

### Retry

Можно обрабатывать ошибку с помощью `retry`, повторяя действия:

```
Retry(func () (*http.Response, error) {    return http.Post(...)}, MaxRetry(3), Timeout(Second), Backoff())
```

Этот способ применим для всех видов программ, но, пожалуйста, помните про его недостатки:

*   Учтите лимит по количеству и/или времени, иначе можно попасть в бесконечный цикл.
    
*   Применяйте экспоненциальный рост задержки, чтобы не положить вызываемый сервис.
    
*   Логируйте и сохраняйте последнюю причину сбоя — не лишайте разработчика возможности понять, что произошло и почему мы достигли максимального количества. В библиотеке kamilsk/retry, у которой 340+ звездочек, эта ошибка есть. Вы не будете понимать, что происходит — будет только ошибка Error MaxRetry, поэтому сохраняйте исходные ошибки.
    

### Логирование ошибки

Следующий вариант обработки — логирование:

```
func errHandler(f func(resp, req) error) Handler {   //...   if errors.Is(err, ErrValidation) {      log.Print("Error: %s\n", err)      http.Error(w, err.Error(), 400)      return  }  //...}
```

Этот метод можно использовать как локально, так и централизованно. В CLI-приложениях логирование встречается редко: обычно ошибку сразу показывают пользователю. А для библиотек это не характерно и до появления slog, у нас не было универсального способа логировать удобно.

### Graceful degradation

Следующий вариант обработки — graceful degradation — используем только в приложениях:

```
func TimeZone() (*Tz, error){	tz, err = syscall.Timezone()	if err != nil {		log.Print(err)		return DefaultTimeZone, nil	}	// implementation}
```

Работает просто: вместо ошибки мы возвращаем значение по умолчанию или ничего, и дополнительно производим какое-то действие, в данном случае — логирование.

### Recover

Обычно `recover` применяют для восстановления после паники, но с помощью `recover` можно обрабатывать ошибки. Такой приём пригодится, если:

*   Вы не доверяете нижележащему коду и перехватываете его паники (актуально в библиотеках, CLI и сервисах).
    
*   В программах с множеством goroutine нужно предотвратить падение всего приложения из-за одной goroutine.
    

Примеры использования `recover` для ошибок на [go.dev](http://go.dev/) в статье [Go Wiki: PanicAndRecover](https://go.dev/wiki/PanicAndRecover). Пример в пакете [json](https://github.com/golang/go/blob/fe36ce669c1a452d2b0e81108a7e07674b50692a/src/encoding/json/encode.go#L290).

### Обрабатываем ошибку единожды

Финально замечу, что **обрабатываем ошибку единожды**. Если вы решили её залогировать, то только логируйте:

```
func Write(w io.Writer, buf []byte) error {    _, err := w.Write(buf)    if err != nil {        log.Print(err)    }    // implementation    return nil}
```

Если хотите вернуть ошибку — возвращайте:

```
func Write(w io.Writer, buf []byte) error {   _, err = w.Write(buf)   if err != nil {        return err   }   // implementation   return nil}
```

Можно также дополнительно её обернуть, но не делайте оба действия одновременно. Иначе вы рискуете обрабатывать множество раз одно, тем самым усложните себе жизнь при отладке.

Пример «двойной обработки» ошибки выглядит так:

```
// Мы печатаем ошибку дважды// failed to write to file: err// unable to write: errfunc main() {	file, err := os.Create("output.txt")	if err != nil {		log.Fatalf("failed to create file: %s", err)	}	defer file.Close()	data := []byte("Hello, Golang!\n")	if err := Write(file, data); err != nil {		log.Fatalf("failed to write to file: %s", err)	}}func Write(w io.Writer, buf []byte) error {    _, err := w.Write(buf)    if err != nil {        log.Printf("unable to write: %s", err)        return err    }    return nil}
```

Регламенты
----------

Общие рекомендации для работы с ошибками:

1.  Пишите лаконичный и выразительный текст.
    
2.  Обрабатывайте ошибку только один раз.
    
3.  Для определения ошибки используйте `errors.Is` или `errors.As`,​​ а в случае, если работаете со старым кодом допустимо `strings.Contains` или `RegExp`.
    
4.  Не паникуйте. Оставляйте `panic` для действительно критических логических ошибок или недостижимых состояний.
    

Небольшая легенда критериев, которые я буду использовать дальше:

✔️ Применяем

✖️ Избегаем

**?**  Только при определённых условиях

### Регламент для библиотек

Виды ошибок:

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

Sentinel Errors

Custom Errors

Wrapping

 | 

Необрабатываемые ошибки

Panic

 |

#### Уникальный текст ошибок в библиотеках

| 

✔️ Применяем

 | 

**?**  Только при определённых условиях

 |
| 

Чтобы получился уникальный текст, используйте формат, понятный пользователю, незнакомому с вашим ПО:

`read default json config: open file.xml: no such file or directory`

 | 

Чтобы получился уникальный текст, используйте формат, понятный пользователю, незнакомому с вашим ПО:

`read default json config: open file.xml: no such file or directory`

 |
|  | 

Когда тяжело сформировать человекопонятный текст и потребителем ошибки является разработчик, то можно использовать формат с двоеточием, разделяющим каждый кусочек:

`config: default: json reader: open file.xml: no such file or directory`

 |

#### Место и время возникновения ошибок в библиотеках

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

Чтобы понять, где и когда ошибка произошла, используем только `fmt.Errorf` с глаголом `%w` или свои собственные кастомные типы:

`fmt.Errorf` с `%w`, Custom Errors

 | 

filepath:codeline

stacktrace или backtrace

 |

#### Воспроизводимость ошибок в библиотеках

Чтобы воспроизводить ошибку, также используем `fmt.Errorf` с кастомными типами, но все данные, которые мы положили в ошибку, нужно также положить и в текст:

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

Чтобы воспроизводить ошибку, также используем `fmt.Errorf` с кастомными типами, но все данные, которые мы положили в ошибку, нужно также положить и в текст:

`fmt.Errorf` с `%w`, Custom Errors с включением всех полей в текст ошибки

 | 

Custom Errors, когда не все поля включены в текст ошибки

Wrapping c добавлением всех аргументов функции Wrapping 

 |

#### Обработка ошибок в библиотеках

Для обработки ошибок в библиотеках в основном используют только обработку по месту. Спокойно возвращайте ошибку наверх, либо оборачивайте через добавление текста описывающего текущую ситуации, либо места, где произошла ошибка с аргументами. Типизируйте, объединяйте, ретрайте и делайте recover для внешнего кода, которому не доверяете, но не для своего.

| 

✔️ Применяем

 | 

✖️Избегаем

 | 

**?** Только при определённых условиях

 |
| 

Локальная обработка (где получили ошибку)

Wrapping добавляет текст (операцию, аргументы)

Типизация

Объединение

Retry

recover для внешнего кода

 | 

Централизованная обработка

Graceful degradation

recover для goroutine, чтобы не положить все приложентрализованная обработка

Игнорирование ошибок

 | 

Замена ошибки 1 к 1

Логирование

 |

### Регламент для CLIs

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

Необрабатываемые ошибки

Sentinel Errors

Custom Errors

Wrapping

 | 

Panic

 |

Здесь, в отличие от библиотек, можно использовать необрабатываемые ошибки, потому что конечный потребитель — пользователь, а не программа.

#### Уникальный текст ошибок в CLIs

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

`read default json config: open file.xml: no such file or directory`

 | 

`config: default: json reader: open file.xml: no such file or directory`

 |

#### Место и время возникновения ошибок в CLIs

Чтобы понять, где и когда ошибка произошла, используем `fmt.Errorf` с `%w` и кастомные типы.

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

`fmt.Errorf` с `%w`, Custom Errors

 | 

filepath:codeline

stacktrace или backtrace

 |

#### Воспроизводимость ошибок в CLIs

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

`fmt.Errorf` с `%w`, Custom Errors (все поля включены в текст)

 | 

Custom Errors, когда не все поля включены в текст ошибки

Wrapping c добавлением всех аргументов функции

 |

#### Обработка ошибок  в CLIs

Здесь ошибку можно иногда игнорировать, только если явно понятно, зачем это делается. Также можно заменять один к одному нижележащую ошибку на определённую ошибку.

| 

✔️ Применяем

 | 

✖️Избегаем

 | 

**?** Только при определённых условиях

 |
| 

Локальная обработка (где получили ошибку)

Wrapping добавляет текст (операцию, аргументы)

Замена ошибки 1 к 1

Типизация

Объединение

Retry

recover для внешнего кода

 | 

Централизованная обработка

Graceful degradation

recover для goroutine, чтобы не положить все приложение

 | 

Игнорирование

Логирование

 |

### Регламент для сервисов

Виды ошибок: 

| 

✔️ Применяем

 | 

✖️ Избегаем

 |
| 

Sentinel Errors

Custom Errors

Wrapping

 | 

Необрабатываемые ошибки

Panic

 |

#### Уникальный текст ошибок в сервисах

Чтобы сформировать уникальный текст, подходят оба варианта, как человеко-читаемый, так и через двоеточие.

| 

✔️ Применяем

 |
| 

`read default json config: open file.xml: no such file or directory`

`config: default: json reader: open file.xml: no such file or directory`

 |

#### Место и время возникновения ошибок в сервисах

| 

✔️ Применяем

 | 

**?** Только при определённых условиях

 |
| 

`fmt.Errorf` с `%w`, Custom Errors

 | 

Если код уже существует, и нужно быстро получить понимание, где и когда произошла ошибка, можно использовать:

filepath:codeline

stacktrace или backtrace

Но всё-таки стоит это делать не за счёт текста.

 |

#### Воспроизводимость ошибок в сервисах

Чтобы воспроизвести ошибку, можно использовать как `fmt.Errorf` с кастомными типами, когда параметры ошибки включены в текст, так и Custom Errors, когда данных гораздо больше, но не все поля добавлены в текст. По возможности избегайте сценариев, когда данные, извлеченные из контекста, добавляются в ошибку, потому что лишняя информация мешает понять, что произошло.

| 

✔️ Применяем

 | 

**?** Только при определённых условиях

 |
| 

`fmt.Errorf` с `%w`, Custom Errors (все поля включены в текст)

Custom Errors, когда не все поля включены в текст ошибки

 | 

Wrapping c добавлением всех аргументов функции

 |

#### Обработка ошибок в сервисах

Обрабатывать ошибки в сервисах можно как локально, так и централизованно. Здесь же доступны retry и логирование, добавляется graceful degradation и recover в случаях, когда нужно предотвратить обрушения приложения из-за нижележащих goroutine.

| 

✔️ Применяем

 | 

**?** Только при определённых условиях

 |
| 

Локальная обработка (где получили ошибку)

Централизованная обработка

Wrapping добавляет текст (операцию, аргументы)

Замена ошибки 1 к 1

Типизация

Объединение

Retry

Логирование

Graceful degradation

recover для внешних ошибок

recover для goroutine, чтобы не положить все приложение

 | 

Игнорирование

 |

> Хотите обсудить другие Go'шные темы — приходите на Golang Conf Х **4 июня 2025** в Москве или подключайтесь к онлайн-трансляции из любой точки мира. Подробности на [официальном сайте конференции](https://golangconf.ru/2025?utm_source=habr&utm_medium=article&utm_campaign=go2&utm_content=913096).