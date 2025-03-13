# Практичный гайд по переменным окружения в Go / Хабр
Привет, Хабр! Представляю вашему вниманию перевод статьи [A no-nonsense guide to environment variables in Go](https://endaphelan.me/guides/golang/a-no-nonsense-guide-to-environment-variables-in-go/) автора Enda Phelan.

Переменные окружения — лучший способ хранения конфигурации приложения, поскольку они могут быть заданы на системном уровне. Это один из принципов методологии [Twelve-Factor App](https://12factor.net/config), он позволяет отделять приложения от системы, в которой они запущены (конфигурация может существенно различаться между деплоями, код не должен различаться).  

### Использование переменных окружения

Всё, что необходимо для взаимодействия с переменными окружения есть в стандартной библиотеке [os](https://golang.org/pkg/os/). Вот так можно получить значение переменной окружения PATH:

```
package mainimport (    "fmt"    "os")func main() {    // Store the PATH environment variable in a variable    path, exists := os.LookupEnv("PATH")    if exists {        // Print the value of the environment variable    	fmt.Print(path)   }}
```

А так — установить значение переменной:

```
package mainimport (    "fmt"    "os")func main() {    // Set the USERNAME environment variable to "MattDaemon"    os.Setenv("USERNAME", "MattDaemon")    // Get the USERNAME environment variable    username := os.Getenv("USERNAME")    // Prints out username environment variable    fmt.Print(username)}
```

  

### Загрузка переменных окружения из файла .env

На девелоперской машине, где сразу запущено много проектов, хранить параметры в переменных окружениях не всегда удобно; логичнее будет разделить их между проектами с помощью env-файлов. Сделать это можно, например, с помощью [godotenv](https://github.com/joho/godotenv) — это портированная на Go Ruby-библиотека [dotenv](https://github.com/bkeepers/dotenv). Она позволяет устанавливать необходимые для приложения переменные окружения из файла .env.

Чтобы установить пакет запустим:

```
go get github.com/joho/godotenv
```

Добавим настройки в файл .env в корне проекта:

```
GITHUB_USERNAME=craicoverflowGITHUB_API_KEY=TCtQrZizM1xeo1v92lsVfLOHDsF7TfT5lMvwSno
```

Теперь можно использовать эти значения в приложении:

```
package mainimport (    "log"    "github.com/joho/godotenv"    "fmt"    "os")// init is invoked before main()func init() {    // loads values from .env into the system    if err := godotenv.Load(); err != nil {        log.Print("No .env file found")    }}func main() {    // Get the GITHUB_USERNAME environment variable    githubUsername, exists := os.LookupEnv("GITHUB_USERNAME")    if exists {	fmt.Println(githubUsername)    }    // Get the GITHUB_API_KEY environment variable    githubAPIKey, exists := os.LookupEnv("GITHUB_API_KEY")	    if exists {	 fmt.Println(githubAPIKey)    }}
```

Важно помнить, что если значение переменной окружения установлено на системном уровне, Go будет использовать именно это значение вместо указанного в env-файле.

### Оборачиваем переменные окружения в конфигурационный модуль

Неплохо, конечно, иметь доступ к переменным окружения напрямую, как было показано выше, но вот поддерживать такое решение представляется довольно проблематичным. Имя переменной — это строка и, если оно изменится, то представьте себе головную боль, в которую выльется процесс обновления ссылок на переменную по всему приложению.

Чтобы решить эту проблему создадим конфигурационный модуль для работы с переменными окружения более централизованным и поддерживаемым способом.

Вот простой модуль **config**, который возвращает параметры конфигурации в структуре **Config** (также установим дефолтные значения параметров на случай, если переменной окружения в системе не окажется):

```
package configimport (    "os")type GitHubConfig struct {    Username string    APIKey   string}type Config struct {    GitHub GitHubConfig}// New returns a new Config structfunc New() *Config {    return &Config{        GitHub: GitHubConfig{	    Username: getEnv("GITHUB_USERNAME", ""),	    APIKey: getEnv("GITHUB_API_KEY", ""),	},    }}// Simple helper function to read an environment or return a default valuefunc getEnv(key string, defaultVal string) string {    if value, exists := os.LookupEnv(key); exists {	return value    }    return defaultVal}
```

Далее добавим типы в структуру **Config**, поскольку имеющееся решение поддерживает только строковые типы, а это не очень-то разумно для больших приложений.

Создадим хэндлеры для типов bool, slice и integer:

```
package configimport (    "os"    "strconv"    "strings")type GitHubConfig struct {    Username string    APIKey   string}type Config struct {    GitHub    GitHubConfig    DebugMode bool    UserRoles []string    MaxUsers  int}// New returns a new Config structfunc New() *Config {    return &Config{	GitHub: GitHubConfig{	    Username: getEnv("GITHUB_USERNAME", ""),	    APIKey:   getEnv("GITHUB_API_KEY", ""),	},	DebugMode: getEnvAsBool("DEBUG_MODE", true),	UserRoles: getEnvAsSlice("USER_ROLES", []string{"admin"}, ","),	MaxUsers:  getEnvAsInt("MAX_USERS", 1),    }}// Simple helper function to read an environment or return a default valuefunc getEnv(key string, defaultVal string) string {    if value, exists := os.LookupEnv(key); exists {	return value    }    return defaultVal}// Simple helper function to read an environment variable into integer or return a default valuefunc getEnvAsInt(name string, defaultVal int) int {    valueStr := getEnv(name, "")    if value, err := strconv.Atoi(valueStr); err == nil {	return value    }    return defaultVal}// Helper to read an environment variable into a bool or return default valuefunc getEnvAsBool(name string, defaultVal bool) bool {    valStr := getEnv(name, "")    if val, err := strconv.ParseBool(valStr); err == nil {	return val    }    return defaultVal}// Helper to read an environment variable into a string slice or return default valuefunc getEnvAsSlice(name string, defaultVal []string, sep string) []string {    valStr := getEnv(name, "")    if valStr == "" {	return defaultVal    }    val := strings.Split(valStr, sep)    return val}
```

Добавим в наш env-файл новые переменные окружения:

```
GITHUB_USERNAME=craicoverflowGITHUB_API_KEY=TCtQrZizM1xeo1v92lsVfLOHDsF7TfT5lMvwSnoMAX_USERS=10USER_ROLES=admin,super_admin,guestDEBUG_MODE=false
```

Теперь можно использовать их в любом месте приложения:

```
package mainimport (    "fmt"    "log"    "github.com/craicoverflow/go-environment-variables-example/config"    "github.com/joho/godotenv")// init is invoked before main()func init() {    // loads values from .env into the system    if err := godotenv.Load(); err != nil {	log.Print("No .env file found")    }}func main() {    conf := config.New()    // Print out environment variables    fmt.Println(conf.GitHub.Username)    fmt.Println(conf.GitHub.APIKey)    fmt.Println(conf.DebugMode)    fmt.Println(conf.MaxUsers)    // Print out each role    for _, role := range conf.UserRoles {	fmt.Println(role)    }}
```

  

### Готово!

Да, существуют пакеты, предлагающие готовое решение для конфигурации вашего приложения, но насколько они необходимы, если это так легко сделать самостоятельно?

А как вы управляете конфигурацией в вашем приложении?