# Введение в PHP Reflection API / Хабр
Привет, Хабр! Представляю вашему вниманию перевод статьи "[Introduction to PHP Reflection API](https://medium.com/tech-tajawal/introduction-to-php-reflection-api-4af07cc17db4)" автора [Mustafa Magdi](https://medium.com/@MustafaMagdi).

Как в PHP анализировать структуру данных
----------------------------------------

![](https://habrastorage.org/webt/28/yf/vj/28yfvjxcesjrzqexormxj_csapw.png)

### Вступление

Когда я начал программировать на PHP, то не знал о возможностях **Reflection API**. Главная причина в том, что мне не нужно было проектировать свои простые классы, модули или даже пакеты. Затем я обнаружил, что это играет главную роль во многих областях. В статье мы рассмотрим **Reflection API** по следующим пунктам:

1.  [Что такое **Reflection API**](#p1)
2.  [Установка и конфигурирование](#p2)
3.  [Использование](#p3)
4.  [Заключение](#p4)
5.  [Рекомендации](#p5)

  

### 1\. Что такое Reflection API

  

> В информатике **отражение** или **рефлексия** (холоним интроспекции, англ. reflection) означает процесс, во время которого программа может отслеживать и модифицировать собственную структуру и поведение во время выполнения. — [Wikipedia](https://ru.wikipedia.org/wiki/%D0%A0%D0%B5%D1%84%D0%BB%D0%B5%D0%BA%D1%81%D0%B8%D1%8F_(%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5)).

Что означает возможность остановить и взглянуть внутрь своего кода (reverse-engineering)? Давайте посмотрим на следующий фрагмент кода:

```
/** * Class Profile */class Profile{   /**    * @return string    */   public function getUserName(): string   {      return 'Foo';   }}
```

Класс **Profile** — чёрный ящик. Используя **Reflection API** вы сможете прочитать, что там находится внутри:

```
// инициализация$reflectionClass = new ReflectionClass('Profile');// получить имя классаvar_dump($reflectionClass->getName());=> output: string(7) "Profile"// получить документацию классаvar_dump($reflectionClass->getDocComment());=> output:string(24) "/** * Class Profile */"
```

Таким образом **ReflectionClass** выступает аналитиком для нашего класса **Profile**, и в этом состоит главная идея **Reflection API**.

PHP даёт вам ключ к любому запертому ящику, таким образом мы имеем ключи  
для следующего:

> [ReflectionClass](http://php.net/manual/ru/class.reflectionclass.php): сообщает информацию о классе.  
> [ReflectionFunction](http://php.net/manual/ru/class.reflectionfunction.php): сообщает информацию о функции.  
> [ReflectionParameter](http://php.net/manual/en/class.reflectionparameter.php): извлекает информацию о параметрах функции или метода.  
> [ReflectionClassConstant](http://php.net/manual/en/class.reflectionclassconstant.php): сообщает информацию о константе класса.  

Полный список вы можете изучить на [php.net](http://php.net/)

### 2\. Установка и конфигурирование

Для использования классов **Reflection API** нет необходимости что-либо устанавливать или настраивать, так как они входят в состав ядра PHP.

### 3\. Примеры использования

Далее представлено несколько примеров того, как мы можем использовать **Reflection API**:

Пример 1:

Получить родительский класс для определённого класса:

```
// дочерний классclass Child extends Profile{}$class = new ReflectionClass('Child');// получаем список всех родителейprint_r($class->getParentClass()); // ['Profile']
```

  
Пример 2:

Получить документацию метода `getUserName()`:

```
$method = new ReflectionMethod('Profile', 'getUserName');var_dump($method->getDocComment());=> output:string(33) "/** * @return string */"
```

  
Пример 3:

Может использоваться как `instanceOf` и `is_a()` для валидации объектов:

```
$class = new ReflectionClass('Profile');$obj   = new Profile();var_dump($class->isInstance($obj)); // bool(true)// такой же какvar_dump(is_a($obj, 'Profile')); // bool(true)// такой же какvar_dump($obj instanceof Profile); // bool(true)
```

  
Пример 4:

В некоторых ситуациях вы можете застрять с unit-тестированием и задаться вопросом: «Как я могу протестировать закрытую функцию?!»

Не беспокойтесь, вот хитрость:

```
// добавим закрытый метод getUserName()private function getUserName(): string{    return 'Foo';}$method = new ReflectionMethod('Profile', 'getUserName');// проверим является ли метод закрытым и сделаем его доступнымif ($method->isPrivate()) {    $method->setAccessible(true);}echo $method->invoke(new Profile()); // Foo
```

Предыдущие примеры довольно просты, но есть другие примеры, в которых вы можете увидеть, как **Reflection API** используется более обширно:

> *   **Генератор документации к API**: пакет [lavarel-apidoc-generator](https://github.com/mpociot/laravel-apidoc-generator) широко использует **ReflectionClass** и **ReflrectionMethod** для получения и последующей обработки информации о блоках документации классов и методов, и оформления этих блоков кода.
> *   **Dependency Injection Container**: проверить всю тему вы можете [здесь](https://medium.com/@MustafaMagdi/dependency-injection-di-container-in-php-a7e5d309ccc6)

  

### 4\. Заключение

PHP предоставляет полноценный **Reflection API**, который помогает легко достичь различные области ООП-структур.

### 5\. Ссылки

  

*   [Официальная документация Reflection API](http://php.net/manual/ru/book.reflection.php)
*   [Статья о Dependency Injection Container](https://medium.com/@MustafaMagdi/dependency-injection-di-container-in-php-a7e5d309ccc6)

**От переводчика:**

_Также можно посмотреть пример использования Reflection API в пакете Codeception в классе [Stub](https://github.com/Codeception/Stub/blob/master/src/Stub.php).  
Этот класс через рефлексию помогает мо́кать методы и свойства в unit-тестах._

_Следует добавить, что Reflection API работает довольно медленно, по этому не стоит сильно увлекаться. Использовать рекомендуется в тестах или во время отладки, но если можно обойтись без него, то лучше так и сделать. И категорически не рекомендуется использовать в рабочем коде проекта, т.к. это ещё и не безопасно._