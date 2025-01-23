# “Yield” и деликатная работа с памятью в PHP / Хабр
![](https://habrastorage.org/getpro/habr/upload_files/c4f/92c/1b7/c4f92c1b77fdb18eb5af690884832ffd.jpeg)

https://pixabay.com

Вы когда-нибудь задавались вопросом: “Какая польза от **_yield_** в PHP?”. Позвольте мне избавить вас от поиска в Google; Я с удовольствием раскрою вам пару ключевых моментов о **_yield_**:

1.  Что такое **_yield_**.
    
2.  Различия между **_yield_** и **_return_**.
    
3.  Варианты использования **_yield_**.
    
4.  Заключение.
    
5.  Ссылки.
    

### 1\. Что такое “yield”

> _Функция-генератор выглядит так же, как и обычная функция, за исключением того, что вместо всего лишь одного значения генератор вырабатывает (yields) столько значений, сколько ему нужно._

Взгляните на следующий пример:

```
function getValues() {   yield 'value';}// вывод строки "value"echo getValues();
```

Конечно, это не будет работать. Предыдущий пример выдаст ошибку: `Object of class Generator could not be converted to string`. Позвольте мне объяснить почему:

### 2\. Различия между “yield” и “return”

Полученная ошибка говорит нам о том, что функция `getValues​​()` не возвращает строку, как мы могли бы этого ожидать. Давайте проверим ее тип:

```
function getValues() {   return 'value';}var_dump(getValues()); // string(5) "value"function getValues() {   yield 'value';}var_dump(getValues()); // class Gene(0) {}rator#1 
```

Класс [**Generator**](http://php.net/manual/en/class.generator.php) реализует интерфейс [**Iterator**](http://php.net/manual/en/class.iterator.php), поэтому для получения значений вам необходимо проитерировать по результатам функции `getValue()`:

```
foreach (getValues() as $value) {  echo $value;}// можно также сделать это через переменную$values = getValues();foreach ($values as $value) {  echo $value;}
```

Но различия на этом не заканчиваются!

> _Генератор позволяет вам писать код с использованием оператора foreach для итерации по набору данных без необходимости создавать в памяти массив, что, однако, может приводить к превышению лимита памяти._

В следующем примере мы создадим массив из 800000 элементов и вернем его из функции `getValues​​()`, контролируя память, выделенную для этого фрагмента кода, с помощью функции [memory\_get\_usage()](http://php.net/manual/en/function.memory-get-usage.php). Мы будем запрашивать потребление памяти через каждые 200000 добавленных элементов, что означает, что контрольных точек будет четыре:

```
<?phpfunction getValues() {   $valuesArray = [];   // get the initial memory usage   echo round(memory_get_usage() / 1024 / 1024, 2) . ' MB' . PHP_EOL;   for ($i = 1; $i < 800000; $i++) {      $valuesArray[] = $i;      // let us do profiling, so we measure the memory usage      if (($i % 200000) == 0) {         // get memory usage in megabytes         echo round(memory_get_usage() / 1024 / 1024, 2) . ' MB'. PHP_EOL;      }   }   return $valuesArray;}$myValues = getValues(); // building the array here once we call the functionforeach ($myValues as $value) {}
```

Вот такие результаты потребления памяти мы получили для примера, приведенного выше:

```
0.34 MB
8.35 MB
16.35 MB
32.35 MB
```

Несколько строк нашего кода потребляют более 30 мегабайт памяти. Каждый раз, когда мы добавляем элемент в массив `$valuesArray`, мы увеличиваем его размер в памяти.

Давайте рассмотрим тот же пример, только с использованием **_yield_**:

```
<?phpfunction getValues() {   // get the initial memory usage   echo round(memory_get_usage() / 1024 / 1024, 2) . ' MB' . PHP_EOL;   for ($i = 1; $i < 800000; $i++) {      yield $i;      // let us do profiling, so we measure the memory usage      if (($i % 200000) == 0) {         // get memory usage in megabytes         echo round(memory_get_usage() / 1024 / 1024, 2) . ' MB'. PHP_EOL;      }   }}$myValues = getValues(); // no action taken until we loop over the valuesforeach ($myValues as $value) {} // start generating values here
```

Результат для этого варианта кода может вас поразить:

```
0.34 MB
0.34 MB
0.34 MB
0.34 MB
```

Конечно это не означает, что вам нужно повсеместно переходить от **_return_** к **_yield_**, но если в своем приложении вы создаете огромные массивы, которые могут вызывать проблемы с памятью на сервере, **_yield_** однозначно будет решением вашей проблемы.

### 3\. Варианты использования “yield”

Существует много вариантов использования **_yield_**, но я выделю пару из них:

*   a. Используя **_yield_**, вы также можете использовать **_return_**:
    

```
function getValues() {  yield 'value';  return 'returnValue';}$values = getValues();foreach ($values as $value) {}echo $values->getReturn(); // 'returnValue'
```

*   b. Возврат пар ключ-значение:
    

```
function getValues() {  yield 'key' => 'value';}$values = getValues();foreach ($values as $key => $value) {  echo $key . ' => ' . $value;}
```

Подробнее об этом можно почитать [здесь](http://php.net/manual/en/language.generators.syntax.php).

### 4\. Заключение

Основная цель этой статьи - показать на примерах, в чем разница между **_yield_** и **_return_** в контексте потребления памяти. По моему мнению, это очень важно знать каждому разработчику.

### 5\. Ссылки

1.  [http://php.net/manual/en/language.generators.syntax.php](http://php.net/manual/en/language.generators.syntax.php)
    
2.  [http://php.net/manual/en/class.generator.php](http://php.net/manual/en/class.generator.php)
    
3.  [http://php.net/manual/en/language.generators.php](http://php.net/manual/en/language.generators.php)
    
4.  [http://php.net/manual/en/function.memory-get-usage.php](http://php.net/manual/en/function.memory-get-usage.php)
    

* * *

_Данная статья переведена в преддверии старта курса PHP Developer. Basic. Узнать подробнее о курсе_ [_можно по ссылке_](https://otus.pw/VjBc/)_._