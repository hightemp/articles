# Базовая архитектура сервиса на GO / Хабр
Базовая архитектура сервиса на GO
---------------------------------

Основная цель моей архитектуры — разделить код на слои, каждый из которых решает свои задачи. Это не просто модный тренд, а необходимость, которая помогает изолировать бизнес-логику от технических деталей, упрощает тестирование и делает код более понятным.

В моем подходе очевидно прослеживаются идеи **чистой архитектуры**, предложенной дядей Бобом. Однако в угоду практичности, простоты и понятности кода я сознательно иду на некоторые отступления от строгих принципов чистой архитектуры:

1.  Гибкость в использовании Usecase
    
2.  Слои и их названия
    
3.  Акцент на микросервисы
    
4.  Миграции и работа с БД
    
5.  Middleware и инфраструктурные сервисы
    
6.  Практическая адаптация
    

Эти отступления от чистой архитектуры позволяют сохранить ключевые преимущества — изоляцию бизнес-логики, тестируемость и поддерживаемость, — но при этом сделать архитектуру более гибкой и удобной для разработки в реальных условиях.

Все начинается с запроса. Уровень Handlers.
-------------------------------------------

Первое, с чем сталкивается наш сервис, — это внешний запрос. В зависимости от назначения сервиса, это может быть HTTP-запрос от пользователя, RPC-вызов от другого сервиса или даже вызов бинарного файла. В любом случае, запрос необходимо преобразовать в понятный для сервиса формат — внутренние модели, которые затем передаются в слой бизнес-логики. На этом этапе никакая бизнес-логика не выполняется. Путь идеального хендлера выглядит следующим образом:

1.  **Валидация запроса**  
    Проверяем, что запрос соответствует ожидаемому формату и содержит все необходимые данные.
    
2.  **Преобразование запроса в модель**  
    Конвертируем данные из внешнего формата (например, JSON) во внутреннюю бизнес-модель.
    
3.  **Вызов Usecase**  
    Передаем модель в слой бизнес-логики (Usecase). Один хендлер должен вызывать только один Usecase.
    
4.  **Обработка ошибок**  
    Ловим и обрабатываем ошибки, которые могут возникнуть в процессе выполнения. Не всегда удобно или возможно делать это на уровне middleware.
    
5.  **Формирование и возврат ответа**  
    Преобразуем результат работы Usecase в формат, понятный внешнему миру (например, JSON), и возвращаем его.
    

**Задача слоя Handlers** — решать транспортные вопросы, то есть взаимодействовать с внешним миром. Он не должен знать ничего о бизнес-логике, данных или их хранении. Его единственная задача — принимать запросы и возвращать ответы. Чтобы гарантировать изоляцию, Usecase следует скрывать за интерфейсами, чтобы хендлеры не знали о их внутренней реализации.

Пример HTTP-хендлера на Go:

```
func UpdateUserHandler(w http.ResponseWriter, r *http.Request) {    var request UserUpdateRequest    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {        http.Error(w, "Invalid request", http.StatusBadRequest)        return    }    user := request.ToModel()    updatedUser, err := userUsecase.Update(user)    if err != nil {        http.Error(w, err.Error(), http.StatusInternalServerError)        return    }    response := updatedUser.ToResponse()    w.Header().Set("Content-Type", "application/json")    json.NewEncoder(w).Encode(response)}
```

![](https://habrastorage.org/getpro/habr/upload_files/079/0ea/f48/0790eaf48e265a5181b084d9aa1e8abc.png)

Рисунок 1. Handler

Организация хендлеров в пространстве. Роутеры.
----------------------------------------------

Прежде чем углубляться в слои бизнес-логики, важно обсудить, как организовать множество хендлеров в рамках сервиса. Хендлеров может быть очень много, и для каждого из них могут потребоваться свои middleware (MW). Например, для одних нужна авторизация, для других — логирование, а для третьих — проверка прав доступа. Чтобы избежать хаоса и дублирования кода, хендлеры нужно логически группировать и настраивать группы, а не каждый в отдельности.

Для этого мы используем **роутеры**. Вместо того чтобы настраивать все хендлеры в одном роутере, мы создаем отдельные роутеры для каждой группы хендлеров и настраиваем роутер сразу.

Пример реализации роутера для cущности юзера:

```
type UserRouter struct {	serverConfig   *config.Config	no_auth_router *mux.Router	auth_router    *mux.Router	logger         logger.Logger	User           entities.UserUseCaseInterface	Object         entities.ObjectUseCaseInterface}func NewUserRouter(serverConfig *config.Config, nar *mux.Router, ar *mux.Router, UserUC entities.UserUseCaseInterface, ObjectUC entities.ObjectUseCaseInterface, log logger.Logger) *UserRouter {	return &UserRouter{		serverConfig:   serverConfig,		no_auth_router: nar,		auth_router:    ar,		logger:         log,		User:           UserUC,		Object:         ObjectUC,	}}func ConfigureRouter(ur *UserRouter) {	ur.auth_router.HandleFunc("/user/current", ur.GetUserFromAuth()).Methods("GET")	ur.auth_router.Use(middleware.CORS)	ur.auth_router.Use(middleware.Logger(ur.logger))	ur.auth_router.Use(middleware.Authorization(ur.serverConfig.TelegramBotToken, ur.User))	ur.auth_router.Use(middleware.Recover(ur.logger))	ur.no_auth_router.HandleFunc("/user/id/{id}", ur.ReadByIdHandler).Methods("GET", "OPTIONS")	ur.no_auth_router.HandleFunc("/user/email/{email}", ur.ReadByEmailHandler).Methods("GET", "OPTIONS")	ur.no_auth_router.HandleFunc("/register", ur.RegistrationHandler).Methods("POST", "OPTIONS")	ur.no_auth_router.Use(middleware.CORS)	ur.no_auth_router.Use(middleware.Logger(ur.logger))	ur.no_auth_router.Use(middleware.Recover(ur.logger))}
```

И объединение всех роутеров в один мега-роутер:

```
	rout := mux.NewRouter()	// Routers	pingrouter := PingRouter.NewPingRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), UserUC, log)	instructionrouter := InstructionRouter.NewInstructionRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), InstructionUC, UserUC, log)	productrouter := ProductRouter.NewProductRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), ProductUC, UserUC, log)	rentedproductrouter := RentedProductRouter.NewRentedProductRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), RentedProductUC, UserUC, log)	showcaserouter := ShowcaseRouter.NewShowcaseRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), ShowcaseUC, UserUC, log)	userrouter := UserRouter.NewUserRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), rout.PathPrefix("/api/v1").Subrouter(), UserUC, ObjectUC, log)	objectrouter := ObjectRouter.NewObjectRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), ObjectUC, UserUC, log)	cardrouter := CardRouter.NewCardRouter(s.config, rout.PathPrefix("/api/v1").Subrouter(), CardUC, UserUC, log)	http.Handle("/", rout)    // Configure Routers	PingRouter.ConfigureRouter(pingrouter)	InstructionRouter.ConfigureRouter(instructionrouter)	ProductRouter.ConfigureRouter(productrouter)	RentedProductRouter.ConfigureRouter(rentedproductrouter)	ShowcaseRouter.ConfigureRouter(showcaserouter)	UserRouter.ConfigureRouter(userrouter)	ObjectRouter.ConfigureRouter(objectrouter)	CardRouter.ConfigureRouter(cardrouter)
```

![](https://habrastorage.org/getpro/habr/upload_files/3f4/6db/72c/3f46db72c61775f0720f958a7492587d.png)

Рисунок 2. Routers

Между запросом и роутером. Middleware.
--------------------------------------

Прежде чем запрос попадет в роутер и будет обработан хендлером, его часто нужно предварительно обработать. Это может быть проверка авторизации пользователя, настройка CORS (Cross-Origin Resource Sharing), логирование запросов, добавление заголовков или даже преобразование данных. Для этих задач используются **middleware** — промежуточные обработчики, которые выполняются перед тем, как запрос достигнет хендлера.

Middleware — это мощный инструмент, который позволяет централизованно обрабатывать общие задачи для всех или группы запросов. Это избавляет от необходимости дублировать код в каждом хендлере и делает код более чистым и поддерживаемым.

Самый понятный пример использования MW на мой взгляд - проверка авторизации и дальнейшее прокидывание информации об авторизированном юзере в наши хендлеры и бизнес-логику:

```
func AuthMiddleware(next http.Handler) http.Handler {	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {		// Пропуск аутентификации для предзапросов CORS		if r.Method == http.MethodOptions {			next.ServeHTTP(w, r)			return		}		cookie, err := r.Cookie("session")		if err != nil || !checkAuthorization(cookie.Value) {			w.WriteHeader(http.StatusUnauthorized)			return		}		ctx := context.WithValue(r.Context(), Key, database.UserHash[cookie.Value])		next.ServeHTTP(w, r.WithContext(ctx))	})}func checkAuthorization(hash string) bool {	_, exists := database.UserHash[hash]	return exists}
```

Поэтому воткнем на нашу схему MW, не забываем, что для каждого роутера они могут быть свои.

![](https://habrastorage.org/getpro/habr/upload_files/252/3c3/942/2523c39420cb8d6469d4dbf5d6ba5b2d.png)

Рисунок 3. Middleware

Здесь делается бизнес. Usecase
------------------------------

Слой **UseCase** — это сердце микросервиса, где реализуется вся бизнес-логика. Здесь определяются правила, какие действия доступны пользователю, какие данные можно изменять, а какие — нет, и как взаимодействовать с другими системами. Основная задача UseCase — описать бизнес-процессы максимально понятно, без привязки к техническим деталям.

#### Что делает UseCase?

UseCase отвечает за:

*   **Бизнес-правила**: что можно делать, а что нельзя.
    
*   **Преобразование данных**: фильтрация, обогащение, агрегация.
    
*   **Взаимодействие с сервисами**: получение данных, отправка изменений.
    
*   **Возврат результата**: подготовка данных для ответа.
    

#### Как организован UseCase?

Обычно UseCase представляет собой класс (или структуру в Go), который группирует методы, связанные с одной бизнес-сущностью или процессом. Например, для сущности "Пользователь" может быть UseCase с методами:

*   CreateUser
    
*   UpdateUser
    
*   DeleteUser
    
*   GetUser
    

Юзкейсов бывает очень много и чтобы не запутаться предлагаю их тоже сгруппировать по **Entities**(О них ниже), чтобы не запутаться, какой юзкейс к чему относится.

Пример UseCase на Go:

```
type UserUseCase struct {    userRepo UserRepository    authService AuthService}func (u *UserUseCase) CreateUser(user User) (*User, error) {    // 1. Проверка бизнес-предусловий    if !u.authService.CanCreateUser(user) {        return nil, errors.New("user creation not allowed")    }    // 2. Получение данных из сервисов    existingUser, err := u.userRepo.GetByEmail(user.Email)    if err != nil && !errors.Is(err, sql.ErrNoRows) {        return nil, err    }    if existingUser != nil {        return nil, errors.New("user already exists")    }    // 3. Преобразование данных    user.ID = uuid.New().String()    user.CreatedAt = time.Now()    // 4. Отправка изменений в сервисы    if err := u.userRepo.Save(user); err != nil {        return nil, err    }    // 5. Возврат результата    return &user, nil}
```

![](https://habrastorage.org/getpro/habr/upload_files/cae/774/fbf/cae774fbfdee82aa17afb1b4ea4ff273.png)

Рисунок 4. UseCase

Сущности. Entities
------------------

Сущности — это простые структуры данных, которые описывают объекты предметной области. Например, сущность **User** может содержать поля, такие как ID, Name, Email, CreatedAt и т.д. Эти сущности используются на всех слоях приложения, но их описание обычно находится в одном месте для удобства.

Раньше я упоминал, что интерфейсы можно держать рядом с реализацией UseCase, но мне больше нравится другой подход: **держать интерфейсы рядом с описанием сущности**. Это делает код более наглядным, так как вы видите поля сущности и методы, которые с ней связаны, в одном месте.

Опишем сущность юзера и его юзкейсы:

```
type User struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	RePassword string `json:"repassword"`
}

type UserUseCase interface {
	Signup(user *User) (*User, *Session, error)
	Login(user *User) (*User, *Session, error)
	Logout(id string) error
	CheckAuth(sessionID string) (*Session, error)
}
```

И дополним нашу схему:  

![](https://habrastorage.org/getpro/habr/upload_files/94d/5d4/06e/94d5d406ec53a14c1cbf848b69d6e2bd.png)

Рисунок 5. Entities

#### Дополнение: Services и вспомогательные функции

В дополнение к сущностям (**Entities**) стоит упомянуть **Services**. Некоторые разработчики выделяют Services в отдельный слой и используют их как вспомогательные функции для бизнес-логики. Однако я предпочитаю более гибкий подход: если функция нужна только один раз, я пишу её прямо в **UseCase** или **Handler**. Если же функция используется часто, я выношу её в файл с сущностями (**Entities**), чтобы её могли использовать другие части приложения.

На примере пользователя такой функцией может быть например валидация почты:

```
type User struct {	Name       string `json:"name"`	Email      string `json:"email"`	Password   string `json:"password"`	RePassword string `json:"repassword"`}type UserUseCase interface {	Signup(user *User) (*User, *Session, error)	Login(user *User) (*User, *Session, error)	Logout(id string) error	CheckAuth(sessionID string) (*Session, error)}func EmailIsValid(email string) bool {	_, err := mail.ParseAddress(email)	return err == nil}
```

![](https://habrastorage.org/getpro/habr/upload_files/a41/b1b/e50/a41b1be502b132cc263f46092e8b5354.png)

Рисунок 6. Services

Базы данных. Repository
-----------------------

Бизнес-логика (UseCase) не существует сама по себе — ей нужно где-то хранить данные. Для этого используется слой **Repository**. Этот слой отвечает за взаимодействие с базой данных, но при этом он абстрагирован от конкретной реализации базы данных. Это позволяет легко менять базу данных (например, с PostgreSQL на MongoDB) без изменения бизнес-логики.

#### Что такое Repository?

**Repository** — это слой, который:

1.  Абстрагирует доступ к базе данных.
    
2.  Предоставляет методы для работы с данными (CRUD: Create, Read, Update, Delete).
    
3.  Работает с сущностями (Entities), а не с бизнес-моделями (Models).
    

#### Зачем нужен Repository?

1.  **Изоляция бизнес-логики**  
    UseCase не должен знать, как данные хранятся и как они извлекаются. Это задача Repository.
    
2.  **Тестируемость**  
    Repository можно легко мокировать в unit-тестах, что позволяет тестировать UseCase изолированно.
    

#### Как работает Repository?

Repository предоставляет интерфейс, который описывает методы для работы с данными. Например, для сущности **User** это может быть:

*   GetByID — получение пользователя по ID.
    
*   GetByEmail — получение пользователя по email.
    
*   Save — сохранение пользователя.
    
*   Delete — удаление пользователя.
    

Репозитории так же удобно сгруппировать по сущностям, поэтому не забываем добавить наш интерфейс репозитория в Entities юзера:

```
type User struct {	Name       string `json:"name"`	Email      string `json:"email"`	Password   string `json:"password"`	RePassword string `json:"repassword"`}type UserUseCase interface {	Signup(user *User) (*User, *Session, error)	Login(user *User) (*User, *Session, error)	Logout(id string) error	CheckAuth(sessionID string) (*Session, error)}type UserRepository interface {	CreateUser(signup *User) (*User, error)	CheckUser(login *User) (*User, error)	GetByEmail(email string) (bool, error)}func EmailIsValid(email string) bool {	_, err := mail.ParseAddress(email)	return err == nil}
```

На нашей схеме это будет выглядеть так:

![](https://habrastorage.org/getpro/habr/upload_files/e03/2fb/94c/e032fb94cd56df0f5bdb438264e92b05.png)

Рисунок 7. Repository

### Меняем СУБД без боли. Interfaces

Одна из ключевых идей хорошей архитектуры — это **изоляция изменений**. Если вы решите поменять базу данных, драйвер для работы с ней или даже библиотеку для логирования, это не должно превращаться в кошмар, где приходится переписывать половину проекта. Чтобы избежать этого, мы используем **интерфейсы**. Интерфейсы позволяют абстрагироваться от конкретной реализации и легко менять её в будущем.

Слой Adapters: Работа с внешними API
------------------------------------

Наш сервис уже умеет обрабатывать запросы, работать с базой данных и выполнять бизнес-логику. Однако в реальных приложениях сервисы часто взаимодействуют с другими сервисами или внешними API. Например, нам может понадобиться получить данные из банковского API, отправить уведомление через сторонний сервис или запросить информацию у другого микросервиса.

Если взаимодействие происходит по RPC, то у нас уже есть готовый клиент. Но если это внешний API, нам нужно написать собственный клиент, который будет:

*   Шифровать данные.
    
*   Передавать креды.
    
*   Скрывать технические детали (например, заголовки или параметры запросов).
    
*   Обрабатывать ошибки и преобразовывать ответы.
    

Эту работу **нельзя делать в бизнес-логике**, так как это нарушает принцип изоляции. Вместо этого мы создадим слой **Adapters**, который будет отвечать за взаимодействие с внешними системами.

Пример адаптера для банковского API:

```
type BankAPIAdapter struct {    baseURL    string    apiKey     string    httpClient *http.Client}// NewBankAPIAdapter — конструктор для BankAPIAdapterfunc NewBankAPIAdapter(baseURL, apiKey string) *BankAPIAdapter {    return &BankAPIAdapter{        baseURL:    baseURL,        apiKey:     apiKey,        httpClient: &http.Client{},    }}// GetCustomerByINN — получение клиента по ИННfunc (b *BankAPIAdapter) GetCustomerByINN(inn string) (*Customer, error) {    url := b.baseURL + "/customer?inn=" + inn    req, err := http.NewRequest("GET", url, nil)    if err != nil {        return nil, err    }    // Добавляем заголовок с API-ключом    req.Header.Set("Authorization", "Bearer "+b.apiKey)    // Выполняем запрос    resp, err := b.httpClient.Do(req)    if err != nil {        return nil, err    }    defer resp.Body.Close()    // Обрабатываем ответ    if resp.StatusCode != http.StatusOK {        return nil, errors.New("bank API returned non-200 status code")    }    var customer Customer    if err := json.NewDecoder(resp.Body).Decode(&customer); err != nil {        return nil, err    }    return &customer, nil}
```

![](https://habrastorage.org/getpro/habr/upload_files/1c1/d28/e1b/1c1d28e1badebeef202459f262d88e08.png)

Рисунок 8. Adapters

Итого
-----

В результате мы получили универсальную и легко поддерживаемую структуру сервиса, которую я разработал на основе личного опыта, учебных проектов и работы в команде.

Эта структура — результат многолетнего опыта, и она отлично подходит для большинства проектов. Однако важно помнить, что архитектура — это не догма, а инструмент. Если вы видите, что какие-то изменения сделают ваш сервис лучше, — смело вносите их. Главное — чтобы код оставался поддерживаемым, тестируемым и понятным.

Буду рад услышать ваши замечания, предложения и идеи по улучшению этой архитектуры. Давайте делиться опытом и делать наши сервисы ещё лучше!