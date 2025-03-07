# Под капотом у Mobx. Пишем свою реактивную библиотеку с нуля / Хабр
![](https://habrastorage.org/getpro/habr/upload_files/b92/f23/410/b92f23410f0fb9851398aef63ef30708.png)

Первое мое знакомство с Mobx началось с удивления. Я не понимал всю магию библиотеки и задавал себе вопрос: “А как это возможно?”. Кажется, в ней используются какие-то подкапотные возможности JS или Mobx вообще написан на другом языке. 

И вот, потратив 3 месяца в исходниках, я развеял для себя магию. Mobx все таки написан на JS и даже имеет множественные ограничения, которые нужно соблюдать, чтобы ваш браузер не взорвался.

В этой статье мы создадим свой Mobx с нуля, а так же свяжем его с React, через собственно написанный HOC observer. В конце у вас будет общее понимание реактивности, которое поможет в самостоятельном осмыслении не только Mobx, но и других реактивных библиотек и фреймворков.

Оглавление
----------

[Заглянем Mobx под капот](#under_hood)

*   [Структура, которую строит Mobx.](#mobx_structure)
    
*   [Связь наблюдаемых значений и слушателей](#%D1%81%D0%B2%D1%8F%D0%B7%D1%8C%20%D0%BD%D0%B0%D0%B1%D0%BB%D1%8E%D0%B4%D0%B0%D0%B5%D0%BC%D1%8B%D1%85%20%D0%B7%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D0%B9)
    
*   [Что мы с вами сделаем?](#%D1%87%D1%82%D0%BE%20%D0%BC%D1%8B%20%D1%81%20%D0%B2%D0%B0%D0%BC%D0%B8%20%D1%81%D0%B4%D0%B5%D0%BB%D0%B0%D0%B5%D0%BC)
    
*   [Краткое объяснения логики "связывания"](#%D0%BA%D1%80%D0%B0%D1%82%D0%BA%D0%BE%D0%B5%20%D0%BE%D0%B1%D1%8A%D1%8F%D1%81%D0%BD%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%BB%D0%BE%D0%B3%D0%B8%D0%BA%D0%B8%20%D1%81%D0%B2%D1%8F%D0%B7%D1%8B%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F)
    

[Ваш Mobx](#%D0%92%D0%B0%D1%88%20Mobx)

*   [Глобальное состояние](#%D0%93%D0%BB%D0%BE%D0%B1%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5%20%D1%81%D0%BE%D1%81%D1%82%D0%BE%D1%8F%D0%BD%D0%B8%D0%B5)
    
*   [Autorun](#Autorun)
    
*   [ObservableValue](#ObservableValue)
    
*   [Демонстрация работы ObservableValue](#%D0%94%D0%B5%D0%BC%D0%BE%D0%BD%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B%20ObservableValue)
    
*   [ObservableObject](#ObservableObject)
    
*   [Проксирование объекта](#%D0%9F%D1%80%D0%BE%D0%BA%D1%81%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5%20%D0%BE%D0%B1%D1%8A%D0%B5%D0%BA%D1%82%D0%B0)
    
*   [Изменяем enhancer в ObservableValue](#%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D1%8F%D0%B5%D0%BC%20enhancer%20%D0%B2%20ObservableValue)
    
*   [Демонстрация работы ObservableObject](#%D0%94%D0%B5%D0%BC%D0%BE%D0%BD%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B%20ObservableObject)
    
*   [ObservableArray](#ObservableArray)
    
*   [Проксирование массива](#%D0%9F%D1%80%D0%BE%D0%BA%D1%81%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5%20%D0%BC%D0%B0%D1%81%D1%81%D0%B8%D0%B2%D0%B0)
    
*   [Обновляем enhancer в ObservableValue](#%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D1%8F%D0%B5%D0%BC%20enhancer%20%D0%B2%20ObservableValue)
    
*   [Atom](#Atom)
    
*   [Демонстрация работы ObservableArray](#%D0%94%D0%B5%D0%BC%D0%BE%D0%BD%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B%20ObservableArray)
    
*   [Возможность отписок Reaction](#%D0%92%D0%BE%D0%B7%D0%BC%D0%BE%D0%B6%D0%BD%D0%BE%D1%81%D1%82%D1%8C%20%D0%BE%D1%82%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20Reaction)
    
*   [Связывание библиотеки с react](#%D0%A1%D0%B2%D1%8F%D0%B7%D1%8B%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5%20%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D0%B8%20%D1%81%20react)
    
*   [Демонстрация работы cвязки с React](#%D0%94%D0%B5%D0%BC%D0%BE%D0%BD%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B%20c%D0%B2%D1%8F%D0%B7%D0%BA%D0%B8%20%D1%81%20React)
    

[Что не попало в библиотеку?](#%D0%A7%D1%82%D0%BE%20%D0%BD%D0%B5%20%D0%BF%D0%BE%D0%BF%D0%B0%D0%BB%D0%BE%20%D0%B2%20%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D1%83?)

*   [Полноценные Observable-сущности](#%D0%9F%D0%BE%D0%BB%D0%BD%D0%BE%D1%86%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5%20Observable-%D1%81%D1%83%D1%89%D0%BD%D0%BE%D1%81%D1%82%D0%B8)
    
*   [Computed Values](#Computed%20Values)
    
*   [Actions](#Actions)
    

[Итоги](#%D0%98%D1%82%D0%BE%D0%B3%D0%B8)

Примечания
----------

Статья больше рассчитана на людей, работавших с Mobx, но если вы не знакомы с библиотекой, вот краткое объяснение принципов работы библиотеки:

[Getting-started](https://mobx.js.org/getting-started), [the-gist-of-Mobx](https://mobx.js.org/the-gist-of-mobx.html), [Mobx Api](https://mobx.js.org/api.html)

Писать весь функционал мы, конечно же, не будем, реализуем самый минимум. Наша реализация будет где-то не простой, но все равно достаточно примитивной и не готовой к проду.

Заглянем Mobx под капот
-----------------------

Перед тем, как приступить к написанию и планированию кода, понаблюдаем за Mobx.

Рассмотрим такой пример:

```
import { observable, autorun } from "mobx";const counter = observable({ count: 0 });console.log(counter);function listener()    console.log(counter.count)}autorun(listener);function increment() {  counter.count++;}//каждые полсекунды будет инкрементироваться счетчикsetInterval(increment, 500);
```

Результат работы кода в консоли:

![](https://habrastorage.org/getpro/habr/upload_files/61f/880/ab7/61f880ab7db0fa27c5938577790b8250.png)

Каждые полсекунды будет инкрементироваться счетчик.

[Пример работы в песочнице.](https://codesandbox.io/s/mobx-work-example-forked-d7s1hf?file=/src/index.js)

*   Присваиваем в counter объект обернутый в observable функцию.
    
*   observable функция преобразует обычный объект в наблюдаемый объект.
    
*   Слушатель `listener`, обыкновенная функция, которая внутри себя выводит в консоль поле count.
    
*   Функция `listener` передается в autorun и уже в autorun произойдет связка наблюдаемого поля count и функции `listener`.
    
*   Каждый раз, когда count будет изменяться , будет триггериться вызов функции `listener`.
    

### Что тут происходит?

#### Структура, которую строит Mobx.

Если мы вызовем  `console.log(counter)`, то увидим такой Proxy-объект.

Выглядит сложно. Столько Mobx добавляет всего для одного поля.

![](https://habrastorage.org/getpro/habr/upload_files/404/575/1a9/4045751a9d2d86817e7168a2c5a253f8.png)

Объект обернут в Proxy, в нем можно заметить наше поле `count`. Причем, оно появляется несколько раз. Внутри оригинального объекта и внутри values, копии оригинального объекта, в котором каждое значение обернуто в `ObservableValue`.

`ObservableValue` это обертка над значениями. Она предоставляет доступ к хранимому внутри него состоянию. При вызове метода на изменение значения сущность дергает зависимые слушатели.

Слушатели внутри `ObservableValue` хранятся в виде Реакций (`Reaction`).

Можно увидеть, что внутри единственной реакции содержится наша функция listener, которая передавалась в autorun.

![](https://habrastorage.org/getpro/habr/upload_files/17b/a9d/9cc/17ba9d9cc2169be86688e7dad75074a4.png)

listener

Реакции тоже содержат в себе наблюдаемые значения от которых они зависят и получается рекурсивная зависимость, наблюдаемые значения в себе содержат реакции, а реакции содержат наблюдаемые значения. Данная связь позволяет в любой момент выполнить взаимную отписку.

![](https://habrastorage.org/getpro/habr/upload_files/c7a/426/645/c7a4266454a34e2458a6ac7c9961e702.png)

#### Связь наблюдаемых значений и слушателей

Мы с вами немного заглянули под капот Mobx, понаблюдали за тем какие структуры он строит. В момент вывода в консоль, все слушатели и наблюдаемые значения уже связаны. Возникает закономерный вопрос - а как же происходит вся эта связь внутри?

При использовании Mobx в работе, мы нигде не используем это явно, библиотека это делает за нас. Это ее главная фишка, она берет на себя всю самую сложную и грязную работу, разработчик сосредоточен только на своем коде, а не на бойлерплейте. 

Но  никакой магии в этом нет. Если при написании кода мы забудим обернуть нашу функцию `listener` в  `autorun`, то ничего работать не будет. Все функции, которые должны “слушать” изменения своих значений, должны быть обернуты в autorun или другие подобные обертки.

Рассмотрим такой пример. Мы случайно забыли обернуть `listener` в `autorun`. В консоли пусто и setInterval Работает в холостую.

```
import { observable, autorun } from "mobx";const counter = observable({ count: 0 });console.log(counter);function listener() {  console.log(counter.count);}function increment() {  counter.count++;}setInterval(increment, 500);
```

Сделаем вывод, что для связи с наблюдаемыми значениями функции всегда нужна некоторая обертка. В Mobx это [autorun](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/api/autorun.ts#L36) и [Reaction](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/core/reaction.ts#L53). В Mobx-react это HOC [observer](https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts#L60).

Если порыться в вышеприведенных исходниках, то становится понятно, что autorun и observer под капотом используют все тот же Reaction.

[В autorun тут.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/api/autorun.ts#L69)

В HOC observer внутри используется [useObserver](https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts#L104).

[И вот в нем уже используется Reaction](https://github.com/mobxjs/mobx/blob/f0e066f427d573cbef4b92f3310eb069c3aca205/packages/mobx-react-lite/src/useObserver.ts#L43).

Reaction - ключевая сущность для связывания наблюдаемых значений и слушателей.

#### Краткое объяснения логики “связывания”

Рассмотрим связывание на примере функции autorun.

Мы передаем в функцию autorun слушатель. Он вызывается и регистрирует нашу функцию в глобальную переменную и затем вызывает ее. У наблюдаемых значений внутри функции вызывается геттер, который внутри себя обращается к глобальной переменной и сохраняет к себе.

Наивный код, который очень просто реализует связывание:

```
// Глобальная переменнаяlet globalListener = null;const observableValue = { internalListener: null, // метод отдающий внутреннее состояние наблюдаемого значения get() {   this.internalListener = globalListener;   return "some value"; }};// Функция, которая помещает слушатель в глобальную переменнуюfunction autorun(listener) { globalListener = listener; listener();}//-------------------------------------------// клентский кодfunction listener() { console.log(observableValue.get());}autorun(listener);console.log(observableValue.internalListener === listener); //Listener попал внутрь observableValue
```

[Песочница](https://codesandbox.io/s/svyazyvanie-primer-dlya-mobx-kyq04n?file=/src/index.js).

Вот так это можно представить на рисунке:

![](https://habrastorage.org/getpro/habr/upload_files/d67/041/307/d67041307bf3d307dceb4f893a801a02.png)

Дале, мы воспользуемся стратегией из этого рисунка, для создания своего `autorun`.

Итак, на данном этапе мы.

*   Понаблюдали за Mobx, посмотрели во что они превращает наш код
    
*   Познакомились с логикой связывания слушателей и наблюдаемых значений
    

Имея вышеизложенную информацию можем приступить к определению нужного нам api и планированию внутренностей нашей библиотеки.

Что мы с вами сделаем?
----------------------

Мы воссоздадим функционал библиотеки, основываясь на апи оригинального Mobx.

Прикинем, какое api мы должны получить к концу статью.

Возможность обернуть любое значение и сделать его наблюдаемым. 

Никогда не использовал это, но `observableValue` нужен будет для построения более сложных структур.

[Аналог из Mobx](https://mobx.js.org/api.html#observablebox):

```
const value = observableValue(0)const increment = () => value.set(value.get() + 1)const listener = () => console.log(value.get()) // в консоли 1...2...3...4autorun(listener)setInterval(increment,500)
```

Объекты очень важная вещь в нашей работе, и важно дать возможность нашей библиотеки делать их поля наблюдаемыми.

[Аналог из mobx:](https://mobx.js.org/api.html#observableobject)

```
const obj = observableObject({count: 0})const increment = () => obj.count++const listener = () => console.log(obj.count) // в консоли 1...2...3...4autorun(listener)setInterval(increment, 500)
```

С массивами аналогичная история, что и с объектами.

[Аналог из mobx:](https://mobx.js.org/api.html#observablearray)

```
const arr = observableArray([])const add = () => arr.push(1)const listener = () => console.log(arr) // в консоли [1]...[1, 1]...[1,1,1]...[1,1,1,1]autorun(listener)setInterval(add, 500)
```

Утечки памяти в приложении никому не нужны, отписываться от наблюдаемых значений очень важно.

```
const arr = observableArray([])const add = () => arr.push(1)const listener = () => console.log(arr) // в консоли [1]...[1, 1]...[1,1,1]const dispose = autorun(listener)setInterval(add, 500)setTimeout(dispose, 1600) // после 3 вызова произойдет отписка и listener не будет вызываться, хотя add продолжить вхолостую работать
```

Возможность связать компонент с наблюдаемыми значениями и перерендерить компонент при изменениях.

[Аналог из mobx](https://mobx.js.org/react-integration.html):

```
const obj = observableObject({count: 0})setInterval(() => obj.count++, 500)const App = () => {   return <div>{obj.count}</div> // компонент будет перерендериваться каждые 500 мс}const ObservabledApp = observer(App) //observer свяжет поле count c с компонентом render(<ObservabledApp />, “#root”)
```

Примерное апи библиотеки известно. Теперь я представлю внутренние компоненты.

Концепции всех этих компонентов, взяты из исходников, каждый из них мы поочередно напишем. Перед реализацией каждого из них будет оставлена ссылка на исходники

1.  `ObservableValue` - самый простой примитив наблюдаемого значения, оборачивает простые значения, поля объектов. В реальном коде явно мы его не будем использовать, он будет содержаться только внутри более сложных структур.
    
2.  `ObservableObject` - представляет наблюдаемый объект, каждое поле оборачивается в `ObservableValue`, все операции с полями объекта `ObservableObject` поручает `ObservableValue`.
    
3.  `ObservableArray` - представляет наблюдаемый массив, все значения оборачиватся в `ObservableValue`. `ObservableArray` операции изменения поручает `ObservableValue`.
    
4.  Atom - примитив, который работает со слушателями внутри наблюдаемых значений, является частью `ObservableValue` и `ObservableArray`.
    
5.  Reaction - контейнер для слушателя, сущность, которая занимается связкой слушателя и наблюдаемого значения, все наблюдаемые значения от которых зависит хранит в себе.
    

Диаграмма того, как это можно представить все эти сущности.

![](https://habrastorage.org/getpro/habr/upload_files/2c5/393/675/2c53936757bb1200e1b602a4c58819cd.png)

### На данном этапе

Мы немного заглянули Mobx под капот. Обсудили Api, которое хотим сделать. Познакомились с внутренними компонентами.

Подсмотрев за настоящим mobx, можем приступать к разработке собственного.

Ваш Mobx 
---------

Для начала, реализуем очень простую версию функции autorun и глобальное состояние.

### Глобальное состояние

Тут мы имеем просто поле для реакции, чтобы наблюдаемые значения могли его перехватить и сохранить к себе содержимое.

[Подобный объект слизан из Mobx.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/core/globalstate.ts)

Он гораздо сложнее, там есть поля для хранения очередей реакций, глобальные флаги и много прочего, поле `trackingDerivation`там тоже имеется и выполняет ту же роль, то есть, хранит слушатель на время его связывания с наблюдаемым значением.

```
/*** Класс глобального состояния*/class GlobalState { /**  * Переменная для записи реакции(слушателя)  */ trackingDerivation = null;}export const globalState = new GlobalState();
```

### Autorun

[Исходники autorun](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/api/autorun.ts#L36)

Вот такая супер примитивная реализация, позже эта функция улучшится и будет более соответствовать оригинальной функции.

```
import { globalState } from "./globalState.js"export function autorun(callback) { const prevTrackingDerivation = globalState.trackingDerivation; globalState.trackingDerivation = callback; callback(); globalState.trackingDerivation = prevTrackingDerivation;}
```

Сначала сохраняем прошлый слушатель в константу `prevTrackingDerivation` после завершения работы возвращаем прошлый контекст на место, это нужно для того, чтобы вложенные друг в друга autorun не вмешивались в работу друг друга и каждый autorun жил в своем реактивном контексте.

Нашу функцию записываем в глобальную переменную, а затем вызываем ее, для того, чтобы наблюдаемые значения получили ее и сохранили внутри себя. После вызова возвращаем прошлый слушатель на место и восстанавливаем реактивный контекст.

Для ясности, вот пример кода такой ситуации. Такое бывает в реакт приложении, только вмето autorun используется HOC observer. Компоненты вложены и не должны мешать друг другу.

```
autorun(function listener1() {  // контекст функции listener1  autorun(function listener2() {    // контекст функции listener2  })  // контекст функции listener1})
```

С помощью нашей библиотеки мы можем сохранять слушателей в глобальную переменную. Теперь, нужно эту глобальную переменную отловить и сохранить ее содержимое, для этого реализуем первый контейнер для наблюдаемых значений.

### ObservableValue

[Реализация будет копировать внешний api observable.box из mobx:](https://mobx.js.org/api.html#observablebox)

`ObservableValue` должен содержать в себе

*   зависимых слушателей.
    
*   Метод get, который будет отдавать внутреннее значение и пытаться регистрировать слушателей
    
*   Метод set, устанавливает новое значение и вызывает реакции
    
*   enhancer - функция, которая преобразовывает значения в наблюдаемые, если они сложнее, чем примитивное значение. Пока это просто заглушка и подготовка к будущему функционалу
    

[Исходники ObservableValue:](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observablevalue.ts#L62)

```
// ObservableValue.jsimport { globalState } from "./globalstate.js";import { isPrimitive, isObservable } from "./utils.js"import { $$observable } from "../constants";function enhancer(value) { if (isObservable(value)) return value; if (isPrimitive(value)) return value; return value;}export class ObservableValue { constructor(value) {   this._observers = new Set();   this[$$observable] = true;   this._value = enhancer(value); } get() {   // тут мы отлавливаем функцию, которая была записана в trackingDerivation при вызове autorun   if (globalState.trackingDerivation) {     this.observe(globalState.trackingDerivation);   }   return this._value; } /**  * @description Устанавливает новое значение и уведомляет слушателей  */ set(newValue) {   this._value = enhancer(newValue);   this._notify(); } /**  * @description Добавляет слушатель в массив слушателей  */ observe(reaction) {   this._observers.add(reaction); } /**  * @description Удаляет слушатель из массива слушателей  */ dispose(reaction) {   this._observers.delete(reaction); } /**  * @description Уведомляет слушателей об изменениях  */ _notify() {   this._observers.forEach((reaction) => reaction()); }}
```

### Демонстрация работы ObservableValue

[Пример работы в песочнице ](https://codesandbox.io/s/simple-mobx-todolist-forked-i2c1lf?file=/index.js).

```
import { ObservableValue } from "./ObservableValue";import { autorun } from "./autorun";const count = new ObservableValue(0);function listener() {  console.log(count.get())}autorun(listener);function increment() {  count.set(count.get() + 1);}setInterval(increment, 500);
```

Наш код работает и вызывает слушатели. Уже сейчас его можно где-то использовать.

Но обычно мы с mobx используем сложные структуры (объекты, массивы).  
И для того, чтобы они были реактивными, нам придется вручную оборачивать каждое поле. Так и еще мы лишим наши объекты “нативности”, ведь придется у каждого поля вызывать методы set и get.

В mobx объекты оборачиваются в более сложные структуры, в которых преобразования в наблюдаемые значения прячутся от разработчика и сохраняется “нативность” оригинальных объектов.

### ObservableObject

Снова заглянем под юбку к mobx. Посмотрим, какие структуры он строит для объектов. 

Для примера, просто обернем объект в `observable`

```
import { observable } from "mobx";const observableObject = observable({ value: 1, value2: {value3: 3}, arr: [1, 2, { value4: 4 }]});console.log(observableValue);
```

Вызовем `console.log(observableObject)` и увидим такой Proxy объект.

![](https://habrastorage.org/getpro/habr/upload_files/e77/e27/c01/e77e27c01f6b6e7cda1a9ffc5c69335b.png)

Внутреннее состояние Proxy у observableObject

Можно обратить внимание, что каждое поле объекта обернуто в `ObservableValue`, неважно, примитивное значение или или нет. 

Также объект совсем не содержит слушателей, со слушателями работают только `ОbservableValue`. Это хорошая новость, так как у нас уже реализован `ObservableValue.`

[Исходники ObservableObject.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observableobject.ts#L90)

Реализация в Mobx выглядит страшнее и сложнее, в нашей реализации содержится самый минимум:

В конструкторе все поля оборачиваем в `ObservableValue`.

Метод get `ObservableObject` вызывает метод get у `ObservableValue`, если это функция, то возвращает ее как есть.

Метод set вызывает одноименный метод у `ObservableValue` и устанавливает в него новое значение.

Если происходит установка значения, которого раньше не существовало, то оборачиваем его в `ObservableValue` и добавляем в `values`.

```
import { ObservableValue } from "../ObservableValue";import { isFunction } from "../utils";export class ObservableObject { constructor(target) {   this._target = target;   /**    * создаем объект значений, это копия объекта,    * приходящего извне, только все значения обернуты в ObservableValue    */   this._values = Object.fromEntries(Object.entries(target).map(([key, value]) => [key, new ObservableValue(value)])); } /**  * @description Метод, который возвращает значение из ObservableValue  */ get(target, property) {   if (!this._hasProperty(property)) return;   /* если функция, то просто возвращаем функцию */   if (isFunction(target[property])) return target[property];   return this._values[property].get(); } /**  * @description  Метод, который устанавливает  * значения для ObservableValue и для внешнего объекта  */ set(target, property, value) {   if (this._hasProperty(property)) {     /* если значение есть, то это observableValue и вызываем у нее метод set*/     this._values[property].set(value);     return true;   }   if (isFunction(target[property])) {     /* если функция, то просто устанавливаем функцию */     target[property] = value;     return true;   }   /* значения нет, создаем новое и оборачиваем в ObservableValue*/   this._values[property] = new ObservableValue(value);   target[property] = value;   return true; } _hasProperty(property) {   return property in this._target; }}
```

Теперь надо безопасно упаковать класс в оригинальный объект и спрятать все явные вызовы get и set.

В этом нам поможет нативный функционал Proxy, Symbol и дескрипторы.

### Проксирование объекта

Обернем исходный объект в Proxy и возложим вызовы методов реактивного класса на JS.

Объект Proxy не часто используется на практике, поэтому приложил ссылку:для ознакомления.

[Learn JavaScript](https://learn.javascript.ru/proxy)

[Тут же есть задачка про observable объект](https://learn.javascript.ru/proxy#observable)

Proxy будет в своих ловушках передавать установку и получение значений в `ObservableObject`. Сам `ObservableObject` будем хранить в том же объекте, который проксируем.

Создадим Символ по которому будет хранится класс.

[Информация по символам](https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Symbol)

```
// constants.js/*** Ключ для идентификации наблюдаемых значений*/export const $$observable = Symbol("observable");/*** Ключ, в котором хранится класс реализующий логику наблюдаемых значений.*/export const $$observableAdmin = Symbol("observableAdmin");
```

C помощью `defineProperty`запретим все операции с этим полем, это нужно для того, чтобы клиентский код не мог получить доступа к нему.

```
// observableObject.jsimport {$$observableAdmin} from "./constants";import {ObservableObject} from "./ObservableObject.js"// функция observableObject, которая создает проксиfunction observableObject(target) { Object.defineProperty(target, $$observableAdmin, {   enumerable: false,   configurable: false,   writable: false,   value: new ObservableObject(target) }); return new Proxy(target, {   get(...args) {     return target[$$observableAdmin].get(...args);   },   set(...args) {     return target[$$observableAdmin].set(...args);   } });}
```

Наша функция-фабрика для объектов готова.

### Изменяем enhancer в ObservableValue

Мы научились делать объекты наблюдаемыми, поэтому функцию `enhancer` в `ObservableValue.js` требуется доработать.

```
// ObservableValue.js// ...import { isPrimitive, isPureObject, isObservable } from "./utils.js"function enhancer(value) { if (isObservable(value)) return value; if (isPrimitive(value)) return value; if (isPureObject(value)) return observableObject(value); return value;}// ...
```

Этим ходом мы получили возможность рекурсивно преобразовывать сложные объекты.

Конечно, глубокое оборачивание всего и вся по-умолчанию это плохо и Mobx предоставляет возможность это отключить, но мы пишем учебную версию и для наших нужд можно оставить и так.

### Демонстрация работы ObservableObject

Демонстрация работы с объектами схожа с прошлой демонстрацией.

```
import { makeObservable } from "./makeObservable";import { autorun } from "./autorun";const counter = observableObject({ count: 0 });console.log(counter);function listener() { console.log(counter.count) //вывод в консоль 1…2…3…4…5…6}autorun(listener);function increment() { counter.count++;}setInterval(increment, 500);
```

[Пример в песочнице](https://codesandbox.io/s/minimal-mobx-react-project-forked-xrvmry?file=/index.js)

### ObservableArray

Мы с вами написали преобразования для объектов и примитивов, но для минимальной версии библиотеки не хватает функционала с массивами. 

Давайте уже создадим ее, имея опыт реализации двух прошлых сущностей.

[В Mobx сущность работающая с массивами.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observablearray.ts#L119)

Много страшного кода, но нам не нужно будет реализовывать все.

```
import { isObservable, isPrimitive } from "../utils";import { $$observable } from "../constants";import { ObservableValue } from "../ObservableValue";// ObservableArray.jsfunction arrayEnhancer(items) { return items.map((targetElement) => {   if (isPrimitive(targetElement)) return targetElement;   return new ObservableValue(targetElement); });}export class ObservableArray { constructor(target) {   this._observers = new Set()   this[$$observable] = true;   this._target = target;   this._values = arrayEnhancer(target); } /**  * @description Отдает значение и, если есть глобальный слушатель, то регистрирует его  */ get(target, property) {   if (globalState.trackingDerivation) {            this.observe(globalState.trackingDerivation);    }   const observableValue = this._getValue(property);   if (isObservable(observableValue)) return observableValue.get();   return observableValue; } /**  * @description установка значения по индексу  */ set(target, property, value) {   this.spliceWithArray(property, 0, value);   return true; } /**  * @description возвращает значение по индексу из внутреннего объекта значений  */ _getValue(property) {   return this._values[property]; } /**  * @description обернуть значения в observable и добавить их в массив* за один раз, так как нативные методы массива могут вызывать геттеры и сеттеры несколько раз,* что будет провоцировать лишние вызовы слушателей  *  * Метод оборачивает новые элементы в ObservableValue  */ spliceWithArray(start, deleteCount, ...items) {   this._values.splice(start, deleteCount || 0, ...arrayEnhancer(items));   const splicesValues = this._target.splice(start, deleteCount || 0, ...items);   this._notify();   return splicesValues; } /**  * @description Устанавливаем длину массива и уведомляем слушателей.  */ setLength(newLength) {   const isValuesSetSuccess = Reflect.set(this._values, "length", newLength);   const isTargetSetSuccess = Reflect.set(this._target, "length", newLength);   this._notify();   return isValuesSetSuccess && isTargetSetSuccess; } getValues() {   return this._values; }/**  * @description Добавляет слушатель в массив слушателей  * Добавляет наблюдаемое значение в зависимости реакции  */ observe(reaction) {   this._observers.add(reaction); } /**  * @description Удаляет слушатель из массива слушателей  * Удаляет наблюдаемое значение из зависимостей реакции  */ dispose(reaction) {   this._observers.delete(reaction); } /**  * @description Уведомляет слушателей об изменениях  */ _notify() {   this._observers.forEach((reaction) => reaction()); }}
```

На set мы вызываем метод `spliceWithArray`, он с помощью метода splice реализует вставки нового элемента или перезапись существующего. 

При получении значения мы так же, как и в `ObservableValue` обращаемся к глобальной переменной для того, чтобы записать себе слушатель.

В `ObservableArray` слушатели содержатся и в отдельных обернутых в `ObservableValue элементах` и в самом массиве, так как надо еще следить за длиной массива.

Метод `setLength` устанавливает новую длину массива и уведомляет слушателей

### Проксирование массива

Для “магической” работы массивов нужно, как и для объектов использовать Proxy.

Для валидной работы с методами массивов их нужно будет переопределить, так как они могут несколько раз вызывать set и get у исходного объекта, что будет провоцировать лишние вызовы слушателей.

Такой код по-умолчанию вызовет у массива сеттер аж 5 раз, а это значит, что 5 раз будет запущено уведомление слушателей.

```
arr.push(1, 2, 3, 4, 5);
```

Для решения этой проблемы мы используем `spliceWithArray`.

Наша версия метода push внутри использует функцию `spliceWithArray`. Функция за один раз может выполнить много операций и единожды уведомить слушателей об изменениях.

[Если потребуется написать другие методы, можно легко подсмотреть, как это сделал mobx.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observablearray.ts#L413)

```
import { $$observableAdmin } from "../constants";/*** Имплементация методов массива*/const arrayMethods = { push(...items) {   const internalReactiveInstance = this[$$observableAdmin];   internalReactiveInstance.spliceWithArray(internalReactiveInstance.getValues().length, 0, ...items);   return internalReactiveInstance.getValues().length; },};/*** Proxy ловушки для массива*/export class ArrayHandlers { get(target, property, _) {   const arrayMethod = arrayMethods[property];   if (arrayMethod) return arrayMethod.bind(target);   return target[$$observableAdmin].get(target, property); } set(target, property, value) {   const reactiveField = target[$$observableAdmin];   if (property === "length") return reactiveField.setLength(value);   return reactiveField.set(target, property, value); }}function delegateProxy(target) { return new Proxy(target, new ArrayHandlers());}export function observableArray(target) { Object.defineProperty(target, $$observableAdmin, {   enumerable: false,   configurable: false,   writable: false,   value: new ObservableArray(target), }); return delegateProxy(target);}
```

### Обновляем enhancer в ObservableValue

С появлением функционала реактивных массивов дорабатываем enhancer в `ObservableValue.js`.

```
// ObservableValue.js// ...import { isPrimitive, isObservable, isPureObject, isArray } from "./utils.js"function enhancer(value) { if (isObservable(value)) return value; if (isPrimitive(value)) return value; if (isPureObject(value)) return observableObject(value) if (isArray(value)) return observableArray(value); return value;}// ...
```

### Atom

Мысленно вернемся в самое начало. В ту часть, где я описывал какие компоненты будут составлять нашу библиотеку.

  
Вспомним этот рисунок.

![](https://habrastorage.org/getpro/habr/upload_files/f99/cb3/5d8/f99cb35d8c24df0c3a6bad3013a67b61.png)

В сущностях `ObservableValue` и `ObservableArray` можно заметить сущность Atom.

[Atom в mobx](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/core/atom.ts#L24), это класс, который выполняет работу со слушателями. Наблюдаемые значения, которые взаимодействуют со слушателями должны унаследовать функционал Atom.

При реализации `ObservableArray` и `ObservableValue`, можно обратить на повторяющийся код работы со слушателями (observe, dispose, \_notify). 

Именно эти методы мы вынесем в Atom.

```
// Atom.jsimport { globalState } from "../globalstate";/***  Класс реализующий подписки и уведомление для наблюдаемых значений*/export class Atom { constructor() {   this._observers = new Set([]); } /**  * @description Добавляет слушатель в массив слушателей  * Добавляет наблюдаемое значение в зависимости реакции  */ observe(reaction) {   this._observers.add(reaction); } /**  * @description Удаляет слушатель из массива слушателей  * Удаляет наблюдаемое значение из зависимостей реакции  */ dispose(reaction) {   this._observers.delete(reaction); }  /**  * @description Уведомляет слушателей об изменениях  */ _notify() {   this._observers.forEach((reaction) => reaction()); }  /**  * @description Перехватывает глобальный слушатель  */ _reportObserved() {   if (globalState.trackingDerivation)         this.observe(globalState.trackingDerivation);   }}
```

Среди уже знакомых методов появился`_reportObserved` , он нужен для отлавливания слушателя из глобальной переменной. Atom полезен для того, чтобы вынести дублирующийся код и спрятать логику работы со слушателями, поэтому метод был добавлен сюда.

### Демонстрация работы ObservableArray

Мы добавили 2 новые сущности `Atom` и `ObservableArray`. Тут можно сделать контрольную точку и посмотреть промежуточный результат в [песочнице](https://codesandbox.io/s/minimal-mobx-react-project-forked-e6pj3x?file=/utils.js).

Осталось два финальных рывка: 

1.  Возможность отписаться от наблюдаемых значений
    
2.  Связать нашу библиотеку с реактом
    

Возможность отписок Reaction
----------------------------

Наш фейковый mobx умеет только регистрировать слушатели, но не умеет от них отписываться, а значит наша библиотека это большая утечка памяти.

Пора нам решить эту проблему и создать очередную сущность.

[Называться она будет Reaction, это аналог из mobx.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/core/reaction.ts#L53)

Reaction - это обертка над функцией-слушателем, которая хранит все наблюдаемые значения, от которых зависит слушатель.

Имея в распоряжении всех слушателей, мы можем легко в нужный момент отписаться.

Реакция в конструктор принимает функцию, которая будет зависеть от наблюдаемых значений.

Очень важный метод в реакции `track`. Он принимает функцию, в которой будут содержаться наблюдаемые значения. Именно тут произойдет связка.

```
import { globalState } from "../globalstate";/*** @description Сущность реакции, содержащая колбек, * который привязан к наблюдаемым значениям.* Реакция содержит список наблюдаемых значений, от которых зависит.* Это нужно для взаимной отписки при вызове метода dispose*/export class Reaction { constructor(callback) {   this._callback = callback;   this._observers = new Set([]);   this._disposed = false; } /**  * @description  Добавление наблюдаемого значения  */ addObserver(observer) {   this._observers.add(observer); } /**  * @description  Удаление наблюдаемого значения  */ removeObserver(observer) {   this._observers.delete(observer); } /**  *  @description   *  Запуск трекаемого коллбека с записью текущего контекста в глобальную переменную  *  Чтобы наблюдаемые значения могли перехватить реакцию и сохранить себе в слушатели  *    *  @param trackedCallback коллбэк,   *  вызывающийся для привязки реакции к наблюдаемым значениям  */ track(trackedCallback) {  if (this._disposed) return;  /**  * Сохранение прошлой реакции нужно для поддержки вложенных реакций  */  const prevDerivation = globalState.trackingDerivation;  globalState.trackingDerivation = this;  trackedCallback();  globalState.trackingDerivation = prevDerivation; } /**  * @description  Запуск переданного коллбека  */ run() {   return this._callback(); } /**  * @description  Выполняет подготовку реакции к отписке  *  вызывает метод для взаимных отписок  */ dispose() {   this._disposed = true;   this._clearObservers(); } /**  * @description  Получение метода dispose, с привязкой контекста  */ getDispose() {   return this.dispose.bind(this); } /**  * @description  Вызов взаимной отписки наблюдаемых значений  */ _clearObservers() {   this._observers.forEach((observer) => observer.dispose(this)); }}
```

После введения Reaction, нужно доработать `Atom`.  поправить методы observe, dispose, и \_notify.

Теперь при вызове notify пробегаем по всем реакциям и запускаем метод run у всех реакций, чтобы запустить функцию-слушатель.

При вызове метода observe мы регистрируем наблюдаемое значение и в Atom и в реакцию.

При вызове метода  dispose отписываем реакцию и отписываемся от реакции.

```
import { globalState } from "../globalstate";/***  Класс реализующий подписки и уведомление для наблюдаемых значений*/export class Atom { constructor() {   this._observers = new Set([]); } /**  * @description Добавляет слушатель в массив слушателей  * Добавляет наблюдаемое значение в зависимости реакции  */ observe(reaction) {   // this._observers.add(reaction);   // обновляем код регистрации реакции       this._observers.add(reaction);   reaction.addObserver(this); } /**  * @description Удаляет слушатель из массива слушателей  * Удаляет наблюдаемое значение из зависимостей реакции  */ dispose(reaction) {   // this._observers.delete(reaction);   // обновляем код удаления реакции       this._observers.delete(reaction);   reaction.removeObserver(this); } _reportObserved() {   if (globalState.trackingDerivation) this.observe(globalState.trackingDerivation); } /**  * @description Уведомляет слушателей об изменениях  */ _notify() {   this._observers.forEach((reaction) => reaction.run()); }}
```

Займемся доработкой autorun, используем нововведенный класс реакции. В конструктор Реакции мы передаем наш `callback`. В метод `track`, тоже передаем `callback`. Из autorun возвращаем `dispose`, чтобы была возможность отписаться в клиентском коде.

[autroun в Mobx.](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/api/autorun.ts#L36)

```
// autorun.jsimport { Reaction } from "./Reaction";/*** @description функция для упрощения работы с Reaction*/export function autorun(callback) { const reaction = new Reaction(callback); reaction.track(callback); return reaction.getDispose();}
```

По функционалу библиотеки это все, осталось только реализовать связку с реактом и можно подводить итоги и бежать просить повышение к зарплате у начальника.

Связывание библиотеки с react
-----------------------------

Mobx для связки с реактом использует [HOC observer](https://mobx.js.org/react-integration.html). Напишем такой же.

[Исходники](https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts#L60)

```
export function observer(Component) { return (props) => {   const reactionTrackingRef = useRef(null);   const forceUpdate = useForceUpdate();   if (!reactionTrackingRef.current) {     reactionTrackingRef.current = new Reaction(forceUpdate);   }   useLayoutEffect(() => () => reactionTrackingRef.current.dispose(), []);   let rendering;   reactionTrackingRef.current.track(() => {     rendering = Component(props);   });   return rendering; };}
```

В `reactionTrackingRef` хранится реакция, ее мы создаем только на маунт компонента

В конструктор реакции передали `forceUpdate`, это функция, которая возращается с кастомного хука, при вызове она принудительно перерендерит компонент, если изменятся наблюдаемые значения.

в `useLayoutEffect` мы отписываемся, когда компонент умрет.

Далее, создаем переменную в которую будем записывать jsx из компонента

И в метод `track` передаем функцию, в которой вызывается наш компонент, именно тут и произойдет связка реакции с наблюдаемыми значениями, которые используются в компоненте.

Обратите внимание, что тут не создается новой реакт ноды, компонент, который мы передали в observer вызывается просто как обыкновенная функция. Получается наш HOC неявно становится частью переданного компонента.

Исходники:

В `observer` внутри используется [useObserver](https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts#L104). И вот в нем уже используется [Reaction](https://github.com/mobxjs/mobx/blob/f0e066f427d573cbef4b92f3310eb069c3aca205/packages/mobx-react-lite/src/useObserver.ts#L43). Наша реализация чем-то похожа на оригинальный HOC.

В HOC компоненте используется кастомный хук `useForceUpdate`.

Вот его реализация. 

```
import { useState } from "react";export function useForceUpdate() { const [, updateState] = useState({}); return () => updateState({});}
```

Просто передаем в `setState` пустой объект, и так как каждый раз ссылка на этот объект разная,то будет происходить принудительный ререндер.

### Демонстрация работы cвязки с React

Для демонстрации подготовлен такой пример:

```
import React from "react";import { render } from "react-dom";import { observable } from "./observable";import { observer } from "./observer";const counterObject = observable({ counter: 1 });function Counter() { return (   <div>     <button onClick={() => counterObject.counter--}>-</button>     {counterObject.counter}     <button onClick={() => counterObject.counter++}>+</button>   </div> );}const ObservableCounter = observer(Counter);render(<ObservableCounter />, document.getElementById("root"));
```

[Можно потыкать в песочнице](https://codesandbox.io/s/mobx-react-example-9t0stt?file=/index.js:0-528).

На данном этапе, мы можем считать наше детище завершенным. У нас имеется наша примитивная версия Mobx и адаптер к реакту.

Можно перейти к обсуждению, того, что можно еще улучшить, чтобы получить более близкую к оригиналу версию.

Что не попало в библиотеку?
---------------------------

### Полноценные Observable-сущности

Если вы заглядывали в исходники перед каждой реализацией Observable классов, то могли заметить, что кода в разы больше.

Это потому, что Mobx постарался закрыть все способы взаимодействия c объектами, массивами и тд.

#### Объекты

В сущности объекта есть реализации для обработки

1.  [метода has](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observableobject.ts#L219)
    
2.  [вызовa defineProperty](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observableobject.ts#L312)
    
3.  [Удаления поля](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observableobject.ts#L492)
    
4.  [Вызова ownKeys метода](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observableobject.ts#L627)
    

#### Массивы

Имплементация методов массивов

Mobx почти для каждого метода массивов добавил [свою реализацию](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observablearray.ts#L413), это нужно для оптимизаций, если вы хотите полноценную версию, то это обязательно надо сделать.

#### Map и Set

Map и Set мы вовсе не стали делать, массивов с объектами для большинства случаев хватает. Примерную их реализацию посмотреть в исходниках. Структуру можно посмотреть просто заллогировав обернутый Map или Set, как мы делали это раньше

В Mobx для [Map](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observablemap.ts#L92) и [Set](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/types/observableset.ts) тоже выделены отдельные сущности.

### Computed Values

Я не стал в статью включать вычисляемые значения потом что статья итак получается длинная.

По реализации computed values похожи на гибрид наблюдаемого значения и реакции

Вычисляемые значения содержат список наблюдаемых значений, от которых зависят и список реакций которые зависят от вычисляемого значения.

Вычисляемые значения хранятся в списке слушателей у наблюдаемых значений, когда одно из наблюдаемых значений изменяется, оно триггерит запуск вычисляемого значения, а вычисляемое значение уже запускает зависимые от себя реакции.

На рисунке такая связь выглядит так:

![](https://habrastorage.org/getpro/habr/upload_files/05f/f11/b0f/05ff11b0f32fcaaa113bd3541e2e60f2.png)

Для более лучшего понимания вычисляемого значения выведите их в консоль и вы сразу поймете по какому принципу они устроены.

Выводить структуры Mobx в консоль очень сильно помогает для понимания его работы.

### Actions

[Исходники Action](https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/core/action.ts#L34)

Action в mobx просто декоратор, для них нет отдельной сущности. 

Действия тоже не стал включать в статью, потому что внутри них используется супер низкоуровневое апи [транзакций](https://mobx.js.org/api.html#transaction). Объяснение транзакции это отдельная статья. 

Транзакции позволяют скомпоновать изменения любого количества наблюдаемых значений и вызвать зависимые от них слушатели всего один раз. Это называется батчинг. 

Для добавления батчинга нужно будет немного пересмотреть архитектуру библиотеки.

Наблюдаемые значения должны не вызывать напрямую реакции, а планировать вызов реакци, передавая их в некоторую очередь ожидания. Это позволит собрать все реакции в одном месте и выполнить их за 1 раз. 

Рассмотрим такой пример:

```
class ExampleSuperClass { @observable count: number = 0; @action increment() {   this.count++;   this.count++;   this.count++; }}const esc = new ExampleSuperClass();autorun(() => { console.log(esc.count); // вызовется 2 раза 0…3});esc.increment();
```

В консоли мы увидим это:

![](https://habrastorage.org/getpro/habr/upload_files/d43/402/fd2/d43402fd23eb87b43be82b02a7d388ae.png)

Action собрал все изменения в кучку и сделал так, чтобы функция вызвалась всего 1 раз.

Итоги
-----

В результате, собрав воедино все, вы получаете собственную реактивную систему. 

Полученные знания помогут вам в изучении устройства реального Mobx или других реактивных библиотек и фреймворков.

[Вот рабочий код нашего детища](https://github.com/kybasas/mobx-explainer), в нем имеются примеры работы, тесты и описание к каждому методу.

Благодарности
-------------

Так как это моя первая статья, [devreverza](https://t.me/devreverza) помог ее причесать. Подписывайтесь на его тг-канал, там тоже буду сборки библиотек из исходников.

Ссылки
------

*   [Getting-started](https://mobx.js.org/getting-started)
    
*   [the-gist-of-Mobx](https://mobx.js.org/the-gist-of-mobx.html)
    
*   [Mobx Api](https://mobx.js.org/api.html)
    
*   [Первая песочница с примером работы mobx](https://codesandbox.io/s/mobx-work-example-forked-d7s1hf?file=/src/index.js)
    
*   [Примитивная реализация связывания](https://codesandbox.io/s/svyazyvanie-primer-dlya-mobx-kyq04n?file=/src/index.js)
    
*   [ObservableValue](https://codesandbox.io/s/simple-mobx-todolist-forked-i2c1lf?file=/index.js)
    
*   [ObservableObject](https://codesandbox.io/s/minimal-mobx-react-project-forked-xrvmry?file=/index.js)
    
*   [ObservableArray и Atom](https://codesandbox.io/s/minimal-mobx-react-project-forked-e6pj3x?file=/utils.js)
    
*   [Связывание с React](https://codesandbox.io/s/mobx-react-example-9t0stt?file=/index.js:0-528)