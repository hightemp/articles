# Структурированное логирование в Go с помощью Slog / Хабр
Более 10 лет разработчики на Go жаловались на отсутствие структурированного логирования в ядре Golang. Участники сообщества Golang даже создали несколько собственных пакетов, таких как Logrus, Zap и Zerolog. В 2023 году, команда разработчиков Google Go наконец-то представила Slog — высокопроизводительный пакет для структурированного ведения логов в стандартной библиотеке Go. Мы перевели гайд о возможностях slog.

![](https://habrastorage.org/getpro/habr/upload_files/bf1/2b8/ea3/bf12b8ea302fa7ab933320a44eabca25.png)

Предыстория
-----------

Пакет [Slog](https://pkg.go.dev/log/slog) берет свое начало [в дискуссии на GitHub, открытой Джонатаном Амстердамом](https://github.com/golang/go/discussions/54763). В ней был разработан проект пакета. После доработки он был выпущен в [Go v1.21](https://tip.golang.org/doc/go1.21) и сейчас находится по адресу `log/slog`.

Далее мы посмотрим на возможности Slog с сопутствующими примерами. Для сравнения производительности с другими фреймворками для протоколирования в Go обратитесь к этому [репозиторию GitHub](https://github.com/betterstack-community/go-logging-benchmarks).

Начало работы со Slog
---------------------

Давайте начнем знакомство с пакетом `log/slog` с того как он спроектирован. Он предоставляет три основных типа, с которыми вы должны быть знакомы:

*   `Logger`: это "фронтэнд" логгирования, который предоставляет методы уровня (`Info()` и `Error()`) для записи интересующих событий.
    
*   `Record`: представление каждого автономного объекта журнала, созданного `Logger`.
    
*   `Handler`: интерфейс, который, будучи реализованным, определяет форматирование и назначение каждого `Record`. В пакет `log/slog` включены два встроенных обработчика: `TextHandler` и `JSONHandler` для вывода данных в формате `key=value` и JSON соответственно.
    

Как и большинство библиотек логирования в Go, пакет `slog` предоставляет стандартный `Logger`, доступный через функции верхнего уровня. Этот логер выводит почти такой же результат, как и старый метод `log.Printf()`, за исключением включения уровней журнала:

```
package mainimport (    "log"    "log/slog")func main() {    log.Print("Info message")    slog.Info("Info message")}
```

```
2024/01/03 10:24:22 Info message
2024/01/03 10:24:22 INFO Info message
```

Это выглядит несколько странно, учитывая, что основная цель Slog — привнести структурирование логов в стандартную библиотеку.

Исправить это достаточно просто, создав собственный экземпляр `Logger` с помощью метода `slog.New()`. Он принимает реализацию интерфейса `Handler`, который определяет, как будут отформатированы журналы и куда они будут записаны.

Вот пример, использующий встроенный тип `JSONHandler` для вывода JSON-логов в `stdout`:

```
func main() {    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))    logger.Debug("Debug message")    logger.Info("Info message")    logger.Warn("Warning message")    logger.Error("Error message")}
```

```
{"time":"2023-03-15T12:59:22.227408691+01:00","level":"INFO","msg":"Info message"}
{"time":"2023-03-15T12:59:22.227468972+01:00","level":"WARN","msg":"Warning message"}
{"time":"2023-03-15T12:59:22.227472149+01:00","level":"ERROR","msg":"Error message"}
```

Если вместо этого типа используется `TextHandler`, каждая запись журнала будет отформатирована в соответствии со стандартом Logfmt:

```
logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
```

```
time=2023-03-15T13:00:11.333+01:00 level=INFO msg="Info message"
time=2023-03-15T13:00:11.333+01:00 level=WARN msg="Warning message"
time=2023-03-15T13:00:11.333+01:00 level=ERROR msg="Error message"
```

Все экземпляры `Logger` по умолчанию ведут журнал на уровне `INFO`, что приводит к подавлению записи `DEBUG`, но вы можете легко изменить это по своему усмотрению.

Настройка логера по умолчанию
-----------------------------

Самый простой способ настроить стандартный `Logger` — использовать метод `slog.SetDefault()`, позволяющий заменить стандартный логер на собственный.

```
func main() {    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))    slog.SetDefault(logger)    slog.Info("Info message")}
```

Теперь вы увидите, что методы логирования верхнего уровня пакета теперь выдают JSON, как показано ниже:

```
{"time":"2023-03-15T13:07:39.105777557+01:00","level":"INFO","msg":"Info message"}
```

Использование метода `SetDefault()` также изменяет стандартный `log.Logger`, используемый пакетом `log`. Такое поведение позволяет существующим приложениям, использующим старый `log`, плавно перейти к структурированному логированию:

```
func main() {    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))    slog.SetDefault(logger)    // elsewhere in the application    log.Println("Hello from old logger")}
```

```
{"time":"2023-03-16T15:20:33.783681176+01:00","level":"INFO","msg":"Hello from old logger"}
```

Метод `slog.NewLogLogger()` также доступен для преобразования `slog.Logger` в `log.Logger`, когда вам нужно использовать API, требующие последнее (например, `http.Server.ErrorLog`):

```
func main() {    handler := slog.NewJSONHandler(os.Stdout, nil)    logger := slog.NewLogLogger(handler, slog.LevelError)    _ = http.Server{        // this API only accepts `log.Logger`        ErrorLog: logger,    }}
```

Добавление контекстных атрибутов в записи журнала
-------------------------------------------------

Существенным преимуществом структурированного логирования по сравнению с неструктурированными форматами является возможность добавления произвольных атрибутов в виде пар ключ/значение в записи журнала.

Эти атрибуты предоставляют дополнительный контекст о зарегистрированном событии. Это может быть полезно для таких задач, как устранение неполадок, генерация метрик, аудит и других целей.

Вот пример, иллюстрирующий, как это работает в Slog:

```
logger.Info(  "incoming request",  "method", "GET",  "time_taken_ms", 158,  "path", "/hello/world?q=search",  "status", 200,  "user_agent", "Googlebot/2.1 (+http://www.google.com/bot.html)",)
```

```
{
  "time":"2023-02-24T11:52:49.554074496+01:00",
  "level":"INFO",
  "msg":"incoming request",
  "method":"GET",
  "time_taken_ms":158,
  "path":"/hello/world?q=search",
  "status":200,
  "user_agent":"Googlebot/2.1 (+http://www.google.com/bot.html)"
}
```

Все методы уровня (`Info()`, `Debug()` и т. д.) принимают сообщение журнала в качестве первого аргумента, а затем неограниченное количество слабо типизированных пар ключ/значение.

Этот API похож на SugaredLogger API в Zap (особенно его методы уровня, заканчивающиеся на `w`), поскольку в нем приоритет отдается краткости за счет выделения дополнительной памяти.

Но будьте осторожны, поскольку такой подход может привести к неожиданным проблемам. В частности, несбалансированные пары ключ/значение могут привести к проблематичному выводу:

```
logger.Info(  "incoming request",  "method", "GET",  "time_taken_ms", // the value for this key is missing)
```

Поскольку ключ `time_taken_ms` не имеет соответствующего значения, он будет рассматриваться как значение с ключом `!BADKEY`. Это не очень хорошо, потому что несоответствие свойств может создать плохие записи. Вы можете не знать об этом до тех пор, пока вам не понадобится использовать журналы.

```
{
  "time": "2023-03-15T13:15:29.956566795+01:00",
  "level": "INFO",
  "msg": "incoming request",
  "method": "GET",
  "!BADKEY": "time_taken_ms"
}
```

Чтобы предотвратить подобные проблемы, можно выполнить команду [vet](https://pkg.go.dev/cmd/vet) или использовать [линтер](https://github.com/go-simpler/sloglint), который будет автоматически сообщать о таких проблемах.

![](https://habrastorage.org/getpro/habr/upload_files/5fe/73d/1d6/5fe73d1d62e05e139cc154c126ff83a8.png)

Другой способ предотвратить подобные ошибки — использовать [сильно типизированные контекстные атрибуты](https://pkg.go.dev/log/slog#Attr), как показано ниже:

```
logger.Info(  "incoming request",  slog.String("method", "GET"),  slog.Int("time_taken_ms", 158),  slog.String("path", "/hello/world?q=search"),  slog.Int("status", 200),  slog.String(    "user_agent",    "Googlebot/2.1 (+http://www.google.com/bot.html)",  ),)
```

Такой подход к контекстному логированию гораздо лучше, но он всё равно не является надежным, поскольку ничто не мешает вам смешивать сильно типизированные и слабо типизированные пары ключ/значение подобным образом:

```
logger.Info(  "incoming request",  "method", "GET",  slog.Int("time_taken_ms", 158),  slog.String("path", "/hello/world?q=search"),  "status", 200,  slog.String(    "user_agent",    "Googlebot/2.1 (+http://www.google.com/bot.html)",  ),)
```

Чтобы гарантировать безопасность типов при добавлении контекстных атрибутов к записям, вы должны использовать метод `LogAttrs()` следующим образом:

```
logger.LogAttrs(  context.Background(),  slog.LevelInfo,  "incoming request",  slog.String("method", "GET"),  slog.Int("time_taken_ms", 158),  slog.String("path", "/hello/world?q=search"),  slog.Int("status", 200),  slog.String(    "user_agent",    "Googlebot/2.1 (+http://www.google.com/bot.html)",  ),)
```

Этот метод принимает только тип `slog.Attr` для пользовательских атрибутов, поэтому невозможно получить несбалансированную пару ключ/значение. Однако его API более запутанный, поскольку в дополнение к сообщению журнала и пользовательским атрибутам в метод всегда нужно передавать контекст (или `nil`) и уровень журнала.

Группировка контекстных атрибутов
---------------------------------

Slog также позволяет группировать несколько атрибутов под одним именем, но вывод зависит от используемого хендлера. Например, при использовании `JSONHandler` каждая группа вложена в объект JSON:

```
logger.LogAttrs(  context.Background(),  slog.LevelInfo,  "image uploaded",  slog.Int("id", 23123),  slog.Group("properties",    slog.Int("width", 4000),    slog.Int("height", 3000),    slog.String("format", "jpeg"),  ),)
```

```
{
  "time":"2023-02-24T12:03:12.175582603+01:00",
  "level":"INFO",
  "msg":"image uploaded",
  "id":23123,
  "properties":{
    "width":4000,
    "height":3000,
    "format":"jpeg"
  }
}
```

При использовании `TextHandler` каждый ключ в группе будет иметь префикс в виде названия группы, как показано ниже:

```
time=2023-02-24T12:06:20.249+01:00 level=INFO msg="image uploaded" id=23123
  properties.width=4000 properties.height=3000 properties.format=jpeg
```

Создание и использование дочерних логеров
-----------------------------------------

Иногда может быть полезно включать одни и те же атрибуты во все записи в определённой области. Это будет гарантировать их наличие без повторяющихся операторов записи в лог.

Здесь на помощь приходят дочерние логеры. Они создают новый контекст логирования, который наследуется от родительского логера, и при этом позволяют включать дополнительные поля.

В Slog создание дочерних логеров осуществляется с помощью метода `Logger.With()`. Он принимает одну или несколько пар ключ/значение и возвращает новый `Logger`, который включает указанные атрибуты.

Рассмотрим следующий фрагмент кода, который добавляет идентификатор program's process ID и версию Go, использованную для компиляции, к каждой записи в лог и сохраняет их в свойстве `program_info`.

```
func main() {    handler := slog.NewJSONHandler(os.Stdout, nil)    buildInfo, _ := debug.ReadBuildInfo()    logger := slog.New(handler)    child := logger.With(        slog.Group("program_info",            slog.Int("pid", os.Getpid()),            slog.String("go_version", buildInfo.GoVersion),        ),    )    . . .}
```

Если такая конфигурация задана, то все записи, созданные логером `child`, будут содержать указанные атрибуты в свойстве `program_info`, пока оно не будет переопределено в точке логирования.

```
func main() {    . . .    child.Info("image upload successful", slog.String("image_id", "39ud88"))    child.Warn(        "storage is 90% full",        slog.String("available_space", "900.1 mb"),    )}
```

```
{
  "time": "2023-02-26T19:26:46.046793623+01:00",
  "level": "INFO",
  "msg": "image upload successful",
  "program_info": {
    "pid": 229108,
    "go_version": "go1.20"
  },
  "image_id": "39ud88"
}
{
  "time": "2023-02-26T19:26:46.046847902+01:00",
  "level": "WARN",
  "msg": "storage is 90% full",
  "program_info": {
    "pid": 229108,
    "go_version": "go1.20"
  },
  "available_space": "900.1 MB"
}
```

Вы также можете использовать метод `WithGroup()` для создания дочернего логера, который запускает группу. В этом случае все атрибуты, добавленные к логеру (включая те, которые добавлены в точке логирования), будут вложены под именем группы.

```
handler := slog.NewJSONHandler(os.Stdout, nil)buildInfo, _ := debug.ReadBuildInfo()logger := slog.New(handler).WithGroup("program_info")child := logger.With(  slog.Int("pid", os.Getpid()),  slog.String("go_version", buildInfo.GoVersion),)child.Warn(  "storage is 90% full",  slog.String("available_space", "900.1 MB"),)
```

```
{
  "time": "2023-05-24T19:00:18.384136084+01:00",
  "level": "WARN",
  "msg": "storage is 90% full",
  "program_info": {
    "pid": 1971993,
    "go_version": "go1.20.2",
    "available_space": "900.1 mb"
  }
}
```

Настройка уровней Slog
----------------------

Пакет `log/slog` предоставляет четыре уровня логирования по умолчанию, каждый из которых связан с целочисленным значением: `DEBUG` (-4), `INFO` (0), `WARN` (4) и `ERROR` (8).

Разница в четыре единицы между уровнями — это специальное конструктивное решение. Оно принято для того, чтобы предусмотреть схемы логирования с пользовательскими уровнями между уровнями по умолчанию. Например, вы можете создать пользовательский уровень между `INFO` и `WARN` со значением 1, 2 или 3.

Ранее мы наблюдали, что все логеры по умолчанию настроены на логирование на уровне `INFO`, из-за чего события, записанные с меньшей серьёзностью (например, `DEBUG`), подавляются. Вы можете настроить это поведение через тип [HandlerOptions](https://pkg.go.dev/log/slog#HandlerOptions), как показано ниже.

```
func main() {    opts := &slog.HandlerOptions{        Level: slog.LevelDebug,    }    handler := slog.NewJSONHandler(os.Stdout, opts)    logger := slog.New(handler)    logger.Debug("Debug message")    logger.Info("Info message")    logger.Warn("Warning message")    logger.Error("Error message")}
```

```
{"time":"2023-05-24T19:03:10.70311982+01:00","level":"DEBUG","msg":"Debug message"}
{"time":"2023-05-24T19:03:10.703187713+01:00","level":"INFO","msg":"Info message"}
{"time":"2023-05-24T19:03:10.703190419+01:00","level":"WARN","msg":"Warning message"}
{"time":"2023-05-24T19:03:10.703192892+01:00","level":"ERROR","msg":"Error message"}
```

Такой подход к установке уровня фиксирует уровень `handler` на протяжении всего времени его работы. Если вам нужно, чтобы минимальный уровень динамически изменялся, вы должны использовать тип `LevelVar`, как показано ниже:

```
func main() {    logLevel := &slog.LevelVar{} // INFO    opts := &slog.HandlerOptions{        Level: logLevel,    }    handler := slog.NewJSONHandler(os.Stdout, opts)    . . .}
```

Впоследствии вы можете обновить уровень журнала в любое время, используя следующее:

```
logLevel.Set(slog.LevelDebug)
```

Создание пользовательских уровней журнала
-----------------------------------------

Если вам нужны собственные уровни, помимо тех, что Slog предоставляет по умолчанию, вы можете создать их через [интерфейс Leveler](https://pkg.go.dev/log/slog#Leveler), сигнатура которого выглядит следующим образом:

```
type Leveler interface {    Level() Level}
```

Этот интерфейс легко реализовать через тип `Level`, показанный ниже (поскольку сам `Level` реализует `Leveler`):

```
const (    LevelTrace  = slog.Level(-8)    LevelFatal  = slog.Level(12))
```

Определив пользовательские уровни, как указано выше, вы можете использовать их только через метод `Log()` или `LogAttrs()`:

```
opts := &slog.HandlerOptions{    Level: LevelTrace,}logger := slog.New(slog.NewJSONHandler(os.Stdout, opts))ctx := context.Background()logger.Log(ctx, LevelTrace, "Trace message")logger.Log(ctx, LevelFatal, "Fatal level")
```

```
{"time":"2023-02-24T09:26:41.666493901+01:00","level":"DEBUG-4","msg":"Trace level"}
{"time":"2023-02-24T09:26:41.666602404+01:00","level":"ERROR+4","msg":"Fatal level"}
```

Обратите внимание, как пользовательские уровни обозначены по умолчанию. Это не то что нужно. Поэтому следует настроить имена уровней через тип `HandlerOptions` следующим образом:

```
. . .var LevelNames = map[slog.Leveler]string{    LevelTrace:      "TRACE",    LevelFatal:      "FATAL",}func main() {    opts := slog.HandlerOptions{        Level: LevelTrace,        ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {            if a.Key == slog.LevelKey {                level := a.Value.Any().(slog.Level)                levelLabel, exists := LevelNames[level]                if !exists {                    levelLabel = level.String()                }                a.Value = slog.StringValue(levelLabel)            }            return a        },    }    . . .}
```

Функция `ReplaceAttr()` используется для настройки того, как каждая пара ключ/значение в `Record` будет обрабатываться `Handler`. Это может помочь изменить имена ключей или каким-либо образом обработать значения.

В приведенном выше примере сопоставлены пользовательские уровни журнала с их соответствующими метками, производящими `TRACE` и `FATAL` соответственно.

```
{"time":"2023-02-24T09:27:51.747625912+01:00","level":"TRACE","msg":"Trace level"}
{"time":"2023-02-24T09:27:51.747737319+01:00","level":"FATAL","msg":"Fatal level"}
```

Настройка обработчиков Slog
---------------------------

Как уже говорилось, и `TextHandler`, и `JSONHandler` можно настраивать с помощью типа `HandlerOptions`. Вы уже видели, как настраивать минимальный уровень и изменять атрибуты перед записью в журнал.

Еще одна настройка, которую можно выполнить с помощью `HandlerOptions`, добавляет источник журнала, если это необходимо:

```
opts := &slog.HandlerOptions{    AddSource: true,    Level:     slog.LevelDebug,}
```

```
{
  "time": "2024-01-03T11:06:50.971029852+01:00",
  "level": "DEBUG",
  "source": {
    "function": "main.main",
    "file": "/home/ayo/dev/betterstack/demo/slog/main.go",
    "line": 17
  },
  "msg": "Debug message"
}
```

Кроме того, можно легко менять хендлеры в зависимости от среды приложения. Например, вы можете использовать `TextHandler` для журналов разработки, поскольку его легче читать, а затем переключиться на `JSONHandler` в продакшене для большей гибкости и совместимости с различными инструментами логирования.

Такое поведение легко реализовать с помощью переменных окружения:

```
var appEnv = os.Getenv("APP_ENV")func main() {    opts := &slog.HandlerOptions{        Level: slog.LevelDebug,    }    var handler slog.Handler = slog.NewTextHandler(os.Stdout, opts)    if appEnv == "production" {        handler = slog.NewJSONHandler(os.Stdout, opts)    }    logger := slog.New(handler)    logger.Info("Info message")}
```

```
go run main.go

```

```
time=2023-02-24T10:36:39.697+01:00 level=INFO msg="Info message"
```

```
APP_ENV=production go run main.go
```

```
{"time":"2023-02-24T10:35:16.964821548+01:00","level":"INFO","msg":"Info message"}

```

Создание пользовательских обработчиков
--------------------------------------

Поскольку `Handler` — это интерфейс, можно создавать собственные обработчики для различного форматирования журналов или записи их в другие места.

Его сигнатура выглядит следующим образом:

```
type Handler interface {    Enabled(context.Context, Level) bool    Handle(context.Context, r Record) error    WithAttrs(attrs []Attr) Handler    WithGroup(name string) Handler}
```

Вот что делает каждый из методов:

*   `Enabled()` определяет, следует ли обрабатывать или выбрасывать запись журнала в зависимости от ее уровня. Для принятия решения также может использоваться `context`.
    
*   `Handle()` обрабатывает каждую запись журнала, отправленную обработчику. Она вызывается только в том случае, если `Enabled()` возвращает `true`.
    
*   `WithAttrs()` создает новый обработчик из существующего и добавляет в него указанные атрибуты.
    
*   `WithGroup()` создает новый обработчик из существующего и добавляет в него указанное имя группы так, чтобы это имя квалифицировало последующие атрибуты.
    

Вот пример, использующий пакеты `log`, `json` и [color](https://github.com/fatih/color) для реализации красивого вывода записей журнала:

```
// NOTE: Not well tested, just an illustration of what's possiblepackage mainimport (    "context"    "encoding/json"    "io"    "log"    "log/slog"    "github.com/fatih/color")type PrettyHandlerOptions struct {    SlogOpts slog.HandlerOptions}type PrettyHandler struct {    slog.Handler    l *log.Logger}func (h *PrettyHandler) Handle(ctx context.Context, r slog.Record) error {    level := r.Level.String() + ":"    switch r.Level {    case slog.LevelDebug:        level = color.MagentaString(level)    case slog.LevelInfo:        level = color.BlueString(level)    case slog.LevelWarn:        level = color.YellowString(level)    case slog.LevelError:        level = color.RedString(level)    }    fields := make(map[string]interface{}, r.NumAttrs())    r.Attrs(func(a slog.Attr) bool {        fields[a.Key] = a.Value.Any()        return true    })    b, err := json.MarshalIndent(fields, "", "  ")    if err != nil {        return err    }    timeStr := r.Time.Format("[15:05:05.000]")    msg := color.CyanString(r.Message)    h.l.Println(timeStr, level, msg, color.WhiteString(string(b)))    return nil}func NewPrettyHandler(    out io.Writer,    opts PrettyHandlerOptions,) *PrettyHandler {    h := &PrettyHandler{        Handler: slog.NewJSONHandler(out, &opts.SlogOpts),        l:       log.New(out, "", 0),    }    return h}
```

Когда вы используете `PrettyHandler` в своем коде, например, так:

```
func main() {    opts := PrettyHandlerOptions{        SlogOpts: slog.HandlerOptions{            Level: slog.LevelDebug,        },    }    handler := NewPrettyHandler(os.Stdout, opts)    logger := slog.New(handler)    logger.Debug(        "executing database query",        slog.String("query", "SELECT * FROM users"),    )    logger.Info("image upload successful", slog.String("image_id", "39ud88"))    logger.Warn(        "storage is 90% full",        slog.String("available_space", "900.1 MB"),    )    logger.Error(        "An error occurred while processing the request",        slog.String("url", "https://example.com"),    )}
```

При выполнении программы вы увидите следующий раскрашенный вывод:

![](https://habrastorage.org/getpro/habr/upload_files/61f/778/8dc/61f7788dc479053399e5e57b56904bd8.png)

На [GitHub](https://github.com/search?q=slog-+language%3AGo&type=repositories&l=Go) и на этой странице [Go Wiki](https://tip.golang.org/wiki/Resources-for-slog) вы можете найти несколько пользовательских хендлеров, созданных сообществом. Среди ярких примеров можно назвать:

*   [tint](https://github.com/lmittmann/tint) — записывает тонированные (окрашенные) журналы.
    
*   [slog-sampling](https://github.com/samber/slog-sampling) — повышает пропускную способность журнала за счет исключения повторяющихся записей журнала.
    
*   [slog-multi](https://github.com/samber/slog-multi) — реализует такие рабочие процессы, как промежуточное ПО, fanout, маршрутизация, обход отказов, балансировка нагрузки.
    
*   [slog-formatter](https://github.com/samber/slog-formatter) — обеспечивает более гибкое форматирование атрибутов.
    

Использование пакета context в Slog
-----------------------------------

До сих пор мы использовали в основном стандартные варианты методов уровня, такие как `Info()`, `Debug()` и другие, но Slog также предоставляет варианты с учетом контекста, принимающие в качестве первого аргумента значение `context.Context`. Вот сигнатура для каждого из них:

```
func (ctx context.Context, msg string, args ...any)
```

С помощью таких методов вы можете распространять контекстные атрибуты между функциями, сохраняя их в `Context`, чтобы при нахождении этих значений они добавлялись к любым результирующим записям.

Рассмотрим следующую программу:

```
package mainimport (    "context"    "log/slog"    "os")func main() {    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))    ctx := context.WithValue(context.Background(), "request_id", "req-123")    logger.InfoContext(ctx, "image uploaded", slog.String("image_id", "img-998"))}
```

В переменную `ctx` добавляется `request_id` и передается в метод `InfoContext`. Однако при выполнении программы поле `request_id` не появляется в журнале:

```
{
  "time": "2024-01-02T11:04:28.590527494+01:00",
  "level": "INFO",
  "msg": "image uploaded",
  "image_id": "img-998"
}
```

Чтобы это заработало, нужно создать пользовательский обработчик и переделать метод `Handle`, как показано ниже:

```
type ctxKey stringconst (    slogFields ctxKey = "slog_fields")type ContextHandler struct {    slog.Handler}// Handle adds contextual attributes to the Record before calling the underlying// handlerfunc (h ContextHandler) Handle(ctx context.Context, r slog.Record) error {    if attrs, ok := ctx.Value(slogFields).([]slog.Attr); ok {        for _, v := range attrs {            r.AddAttrs(v)        }    }    return h.Handler.Handle(ctx, r)}// AppendCtx adds an slog attribute to the provided context so that it will be// included in any Record created with such contextfunc AppendCtx(parent context.Context, attr slog.Attr) context.Context {    if parent == nil {        parent = context.Background()    }    if v, ok := parent.Value(slogFields).([]slog.Attr); ok {        v = append(v, attr)        return context.WithValue(parent, slogFields, v)    }    v := []slog.Attr{}    v = append(v, attr)    return context.WithValue(parent, slogFields, v)}
```

Структура `ContextHandler` включает в себя интерфейс `slog.Handler` и реализует метод `Handle`. Этот метод извлекает атрибуты Slog, которые хранятся в предоставленном контексте. Если они найдены, то добавляются к `Record` перед вызовом базового `Handler` для форматирования и вывода записи.

С другой стороны, функция `AppendCtx` добавляет атрибуты Slog в `context.Context` с помощью ключа `slogFields`, чтобы они были доступны для `ContextHandler`.

Вот как их использовать:

```
func main() {    h := &ContextHandler{slog.NewJSONHandler(os.Stdout, nil)}    logger := slog.New(h)    ctx := AppendCtx(context.Background(), slog.String("request_id", "req-123"))    logger.InfoContext(ctx, "image uploaded", slog.String("image_id", "img-998"))}
```

Теперь вы увидите, что `request_id` добавляется во все записи, созданные с помощью аргумента `ctx`:

```
{
  "time": "2024-01-02T11:29:15.229984723+01:00",
  "level": "INFO",
  "msg": "image uploaded",
  "image_id": "img-998",
  "request_id": "req-123"
}
```

Логирование ошибок с помощью Slog
---------------------------------

Для типа `error` не предоставляется хелпер, как в большинстве фреймворков, поэтому вы должны использовать `slog.Any()`, как это сделано здесь:

```
err := errors.New("something happened")logger.ErrorContext(ctx, "upload failed", slog.Any("error", err))
```

```
{
  "time": "2024-01-02T14:13:44.41886393+01:00",
  "level": "ERROR",
  "msg": "upload failed",
  "error": "something happened"
}
```

Чтобы получить и записать в лог трассировку стека ошибок, вы можете использовать такую библиотеку, как [xerrors](https://github.com/MDobak/go-xerrors), для создания ошибок с трассировкой стека.

```
err := xerrors.New("something happened")logger.ErrorContext(ctx, "upload failed", slog.Any("error", err))
```

Прежде чем вы сможете увидеть трассировку стека в журнале ошибок, вам также нужно извлечь, отформатировать и добавить её в соответствующий `Record` с помощью функции `ReplaceAttr()`, продемонстрированной ранее.

Вот пример:

```
package mainimport (    "context"    "log/slog"    "os"    "path/filepath"    "github.com/mdobak/go-xerrors")type stackFrame struct {    Func   string `json:"func"`    Source string `json:"source"`    Line   int    `json:"line"`}func replaceAttr(_ []string, a slog.Attr) slog.Attr {    switch a.Value.Kind() {    case slog.KindAny:        switch v := a.Value.Any().(type) {        case error:            a.Value = fmtErr(v)        }    }    return a}// marshalStack extracts stack frames from the errorfunc marshalStack(err error) []stackFrame {    trace := xerrors.StackTrace(err)    if len(trace) == 0 {        return nil    }    frames := trace.Frames()    s := make([]stackFrame, len(frames))    for i, v := range frames {        f := stackFrame{            Source: filepath.Join(                filepath.Base(filepath.Dir(v.File)),                filepath.Base(v.File),            ),            Func: filepath.Base(v.Function),            Line: v.Line,        }        s[i] = f    }    return s}// fmtErr returns a slog.Value with keys `msg` and `trace`. If the error// does not implement interface { StackTrace() errors.StackTrace }, the `trace`// key is omitted.func fmtErr(err error) slog.Value {    var groupValues []slog.Attr    groupValues = append(groupValues, slog.String("msg", err.Error()))    frames := marshalStack(err)    if frames != nil {        groupValues = append(groupValues,            slog.Any("trace", frames),        )    }    return slog.GroupValue(groupValues...)}func main() {    h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{        ReplaceAttr: replaceAttr,    })    logger := slog.New(h)    ctx := context.Background()    err := xerrors.New("something happened")    logger.ErrorContext(ctx, "image uploaded", slog.Any("error", err))}
```

При этом все ошибки, созданные с помощью `xerrors.New()`, будут логироваться с хорошо отформатированной трассировкой стека следующим образом:

```
{
  "time": "2024-01-03T07:09:31.013954119+01:00",
  "level": "ERROR",
  "msg": "image uploaded",
  "error": {
    "msg": "something happened",
    "trace": [
      {
        "func": "main.main",
        "source": "slog/main.go",
        "line": 82
      },
      {
        "func": "runtime.main",
        "source": "runtime/proc.go",
        "line": 267
      },
      {
        "func": "runtime.goexit",
        "source": "runtime/asm_amd64.s",
        "line": 1650
      }
    ]
  }
}
```

Теперь вы сможете легко проследить путь выполнения, приводящий к неожиданным ошибкам в вашем приложении.

Как скрывать поля с чувствительными данными с помощью интерфейса LogValuer
--------------------------------------------------------------------------

Интерфейс `LogValuer` позволяет стандартизировать вывод логов, указав, как должны записываться пользовательские типы.

Вот его сигнатура:

```
type LogValuer interface {    LogValue() Value}
```

Рассмотрим пример использования этого интерфейса. Например, вот тип `User`, который не реализует интерфейс `LogValuer`. Обратите внимание, как конфиденциальные детали становятся доступны при записи экземпляра в лог:

```
// User does not implement `LogValuer` heretype User struct {    ID        string `json:"id"`    FirstName string `json:"first_name"`    LastName  string `json:"last_name"`    Email     string `json:"email"`    Password  string `json:"password"`}func main() {    handler := slog.NewJSONHandler(os.Stdout, nil)    logger := slog.New(handler)    u := &User{        ID:        "user-12234",        FirstName: "Jan",        LastName:  "Doe",        Email:     "jan@example.com",        Password:  "pass-12334",    }    logger.Info("info", "user", u)}
```

```
{
  "time": "2023-02-26T22:11:30.080656774+01:00",
  "level": "INFO",
  "msg": "info",
  "user": {
    "id": "user-12234",
    "first_name": "Jan",
    "last_name": "Doe",
    "email": "jan@example.com",
    "password": "pass-12334"
  }
}
```

Это проблема, потому что тип содержит секретные поля, которые не должны присутствовать в логах (электронные письма и пароли), и это также может сделать ваши логи излишне громоздкими.

Вы можете решить эту проблему, указав, как вы хотели бы, чтобы тип был представлен в логах. Например, вы можете указать, что в лог должно быть записано только поле `ID` следующим образом:

```
// implement the `LogValuer` interface on the User structfunc (u User) LogValue() slog.Value {    return slog.StringValue(u.ID)}
```

Теперь вы увидите следующий результат:

```
{
  "time": "2023-02-26T22:43:28.184363059+01:00",
  "level": "INFO",
  "msg": "info",
  "user": "user-12234"
}

```

Вы также можете сгруппировать несколько атрибутов следующим образом:

```
func (u User) LogValue() slog.Value {    return slog.GroupValue(        slog.String("id", u.ID),        slog.String("name", u.FirstName+" "+u.LastName),    )}
```

```
{
  "time": "2023-03-15T14:44:24.223381036+01:00",
  "level": "INFO",
  "msg": "info",
  "user": {
    "id": "user-12234",
    "name": "Jan Doe"
  }
}
```

Использование сторонних бэкендов для логирования с Slog
-------------------------------------------------------

Одна из главных целей проектирования Slog — предоставить унифицированный интерфейс для логирования (`slog.Logger`) для Go-приложений, в то время как бэкенд (`slog.Handler`) остаётся настраиваемым от программы к программе.

Таким образом, API для логирования остаётся согласованным во всех зависимостях, даже если бэкенды различаются. Это также позволяет избежать связывания реализации логирования с конкретным пакетом, делая тривиальным переключение на другой бэкенд, если требования в вашем проекте меняются.

Вот пример, который использует интерфейс Slog с Zap backend, возможно это лучшее из обоих миров:

```
go get go.uber.org/zap

```

```
go get go.uber.org/zap/exp/zapslog

```

```
package mainimport (    "log/slog"    "go.uber.org/zap"    "go.uber.org/zap/exp/zapslog")func main() {    zapL := zap.Must(zap.NewProduction())    defer zapL.Sync()    logger := slog.New(zapslog.NewHandler(zapL.Core(), nil))    logger.Info(        "incoming request",        slog.String("method", "GET"),        slog.String("path", "/api/user"),        slog.Int("status", 200),    )}
```

В этом фрагменте кода создаётся новый логер Zap для продакшена, который впоследствии используется как обработчик для пакета Slog через `zapslog.NewHandler()`. После этого вам нужно только писать логи, используя методы, предоставляемые в `slog.Logger`. Полученные записи будут обрабатываться в соответствии с предоставленной конфигурацией `zapL` .

```
{"level":"info","ts":1697453912.4535635,"msg":"incoming request","method":"GET","path":"/api/user","status":200}
```

Переключение на другой логер очень простое, так как логирование осуществляется в терминах `slog.Logger`. Например, вы можете переключиться с Zap на Zerolog следующим образом:

```
go get github.com/rs/zerolog

```

```
go get github.com/samber/slog-zerolog

```

```
package mainimport (    "log/slog"    "os"    "github.com/rs/zerolog"    slogzerolog "github.com/samber/slog-zerolog")func main() {    zerologL := zerolog.New(os.Stdout).Level(zerolog.InfoLevel)    logger := slog.New(        slogzerolog.Option{Logger: &zerologL}.NewZerologHandler(),    )    logger.Info(        "incoming request",        slog.String("method", "GET"),        slog.String("path", "/api/user"),        slog.Int("status", 200),    )}
```

```
{"level":"info","time":"2023-10-16T13:22:33+02:00","method":"GET","path":"/api/user","status":200,"message":"incoming request"}
```

В приведённом фрагменте кода обработчик Zap был заменён на пользовательский обработчик [Zerolog](https://github.com/samber/slog-zerolog). Поскольку логирование не выполняется с помощью пользовательских API каждой из библиотек, процесс миграции занимает всего пару минут по сравнению с ситуацией, когда вам приходится заменять один API логирования на другой во всём приложении.

Best practices для записи и хранения логов в Go:
------------------------------------------------

После того как вы настроили Slog или предпочитаемый вами сторонний фреймворк для логирования, рекомендуем придерживаться следующих лучших практик:

**1\. Стандартизируйте интерфейсы для логирования.** Интерфейс `LogValuer` позволяет стандартизировать способ логирования различных типов в приложении. Это обеспечит согласованное представление этих типов в логах по всему приложению. Кроме того эта стратегия поможет исключить утечку чувствительных данных из логов приложения.

**2\. Добавляйте трассировку стека в логи ошибок.** С трассировкой будет намного легче определить, где возникла ошибка в кодовой базе и какой программный поток привёл к проблеме.

Slog в настоящее время не предоставляет встроенного способа добавления трассировки стека к ошибкам, но, как мы демонстрировали ранее, эту функциональность можно реализовать с помощью пакетов вроде [pkgerrors](https://github.com/pkg/errors) или [go-xerrors](https://github.com/MDobak/go-xerrors) с помощью пары вспомогательных функций.

**3\. Проверяйте согласованность вызовов Slog.** Одним из главных недостатков API Slog является то, что он позволяет использовать два разных типа аргументов. Это может привести к несогласованности в кодовой базе. Кроме того, вы обеспечьте согласованнность в именах ключей (snake\_case, camelCase и т. д.) или чтобы логирующие вызовы содержали аргумент context.

Линтер, подобный [sloglint](https://github.com/go-simpler/sloglint/releases), может помочь вам применить различные правила для Slog. Вот пример конфигурации, используемой через [golangci-lint](https://freshman.tech/linting-golang/):

```
linters-settings:  sloglint:    # Enforce not mixing key-value pairs and attributes.    # Default: true    no-mixed-args: false    # Enforce using key-value pairs only (overrides no-mixed-args, incompatible with attr-only).    # Default: false    kv-only: true    # Enforce using attributes only (overrides no-mixed-args, incompatible with kv-only).    # Default: false    attr-only: true    # Enforce using methods that accept a context.    # Default: false    context-only: true    # Enforce using static values for log messages.    # Default: false    static-msg: true    # Enforce using constants instead of raw keys.    # Default: false    no-raw-keys: true    # Enforce a single key naming convention.    # Values: snake, kebab, camel, pascal    # Default: ""    key-naming-case: snake    # Enforce putting arguments on separate lines.    # Default: false    args-on-sep-lines: true
```

**4\. Делайте централизацию логов, но сначала сохраняйте их в локальные файлы.** Обычно лучше отделять задачу записи логов от их отправки в централизованную систему управления логами. Запись логов в локальные файлы сначала обеспечивает резервную копию на случай проблем с системой управления логами или сетью. Это может предотвратить возможную потерю важных данных.

Кроме того, сохранение логов локально перед отправкой служит буфером. Это помогает оптимизировать пакетную передачу и снизить влияние на производительность приложения.

Локальное хранение логов также обеспечивает большую гибкость. Если потребуется перейти на другую систему управления логами, нужно будет только изменить способ отправки, а не весь механизм логирования. Для получения более подробной информации смотрите статьи (на английском) об использовании специализированных программ доставки логов, таких как Vector или Fluentd.

Настроить запись в файлы можно по-разному. Например, Systemd может легко перенаправить стандартные потоки вывода и ошибок приложения в файл. Docker также по умолчанию собирает все данные, отправленные в оба потока, и перенаправляет их в локальные файлы на хост-машине.

**5\. Делайте выгрузку выборок из логов.** Выгрузка выборок из логов (log sampling) — это практика записи только наиболее репрезентативных записей логов вместо всех событий. Этот метод полезен в средах с высокой нагрузкой, когда системы генерируют большие объёмы данных логов, и обработка каждого события может быть дорогостоящей.

```
package mainimport (    "fmt"    "log/slog"    "os"    slogmulti "github.com/samber/slog-multi"    slogsampling "github.com/samber/slog-sampling")func main() {    // Will print 20% of entries.    option := slogsampling.UniformSamplingOption{        Rate: 0.2,    }    logger := slog.New(        slogmulti.            Pipe(option.NewMiddleware()).            Handler(slog.NewJSONHandler(os.Stdout, nil)),    )    for i := 1; i <= 10; i++ {        logger.Info(fmt.Sprintf("a message from the gods: %d", i))    }}
```

```
{"time":"2023-10-18T19:14:09.820090798+02:00","level":"INFO","msg":"a message from the gods: 4"}
{"time":"2023-10-18T19:14:09.820117844+02:00","level":"INFO","msg":"a message from the gods: 5"}
```

Сторонние фреймворки, такие как Zerolog и Zap, предоставляют встроенные функции выгрузки выборок из логов. В случае с Slog вам потребуется интегрировать сторонний обработчик, такой как [slog-sampling](https://github.com/samber/slog-sampling), или разработать собственное решение. Также можно выбрать выгрузку выборок через специализированную программу доставки логов, такую как Vector.

**6\. Используйте систему управления логами.** Когда логи централизованы в системе управления, становится легко искать, анализировать и отслеживать поведение приложения на нескольких серверах и в разных окружениях. Когда все логи в одном месте, значительно ускоряется способность идентифицировать и диагностировать проблемы, так как больше не нужно переключаться между разными серверами, чтобы собрать информацию о сервисе.

![](https://habrastorage.org/getpro/habr/upload_files/eb5/cf9/540/eb5cf954012a4fc1ddf99e22392ce3ae.png)

Заключение
----------

Я надеюсь, что этот обзор помог вам понять, как работает новый пакет структурированного логирования в Go, и как вы можете начать использовать его в своих проектах. Если вы хотите изучить эту тему подробнее, я рекомендую ознакомиться с полным [предложением](https://go.googlesource.com/proposal/+/master/design/56345-structured-logging.md) и [документацией](https://pkg.go.dev/log/slog) к пакету.

* * *

Если вы изучаете Golang, приходите в Слёрм на курсы [Golang для инженеров](https://slurm.io/go-for-ops?utm_medium=article&utm_source=habr&utm_campaign=golang) и [Golang-разработчик](https://slurm.io/go?utm_medium=article&utm_source=habr&utm_campaign=golang). Они помогут вам систематизировать знания и получить опыт.

☝️ Сегодня 5 марта мы проведём **бесплатный вебинар** «[Goro для быстрого старта. Куда уходит время разработчика?](https://www.youtube.com/live/JT5MViAu3W8?si=PC31l_Hr26FUyS_5)» На нём мы рассмотрим функционал библиотеки Goro, которая здорово помогает оптимизировать вспомогательные процессы. Вебинар будет доступен в записи.