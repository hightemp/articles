# Как я перестал беспокоиться и полюбил тестирование React-компонентов / Хабр
![](https://habrastorage.org/getpro/habr/upload_files/77d/44f/6d6/77d44f6d63e7adde37300ac59b8f207d.png)

_Как тестировать React-компоненты? Какую библиотеку использовать? Как тестировать компоненты, которые берут данные из Redux, а не из пропсов? Как тестировать компоненты, в которых используется роутинг с помощью React-router-dom? Что делать, если в компоненте есть асинхронный код?_

Привет, Хабр, меня зовут Даниил, я выпускник Elbrus Bootcamp. Это вопросы в моей голове, когда на работе меня впервые попросили покрыть тестами компонент. Я, разумеется, стал гуглить тестирование React-компонентов в связке с Redux и React-router-dom, и понял, что в сети есть много ответов на вопрос, зачем нужно тестирование, но мало кто объясняет, как написать тесты. А если и объясняет, то в  общих чертах на абстрактных примерах. Мне не хватало статьи, вооружившись которой, начинающий разработчик мог бы выполнить тест на реальном продукте. Поэтому я решил написать ее сам.

Статья предназначена для таких же, как я: разработчиков, которые пришли на свою первую работу и впервые столкнулись с необходимостью написать тесты. Более опытных коллег прошу проверить мои выводы, дать советы и замечания.

### React-testing-library

Для наглядности я написал небольшое [React-приложение](https://github.com/daneelzam/react-test): меню навигации, страничка с приветствием, на страничке Send форма отправки денег с одного кошелька на другой, с возможностью менять кошельки, вводить сумму перевода с расчетом комиссии, с выводом ряда ошибок. После успешной отправки средств пользователь попадает на экран успеха.

![](https://habrastorage.org/getpro/habr/upload_files/d4c/53b/47b/d4c53b47bd2ee216edebad5d35b12bef.gif)

Для этой статьи я выбрал библиотеку [react-testing-library](https://testing-library.com/docs/react-testing-library/intro), а все примеры кода будут написаны на TypeScript. React-testing-library — это фреймворк огромной библиотеки [Testing Library](https://testing-library.com/), которая для React по умолчанию использует в своей основе [Jest](https://jestjs.io/). Все что будет описано ниже, относится именно к этой библиотеке. Небольшая информация по синтаксису:

```
import { render, screen } from '@testing-library/react';import Send from './index'; test('From element: exist in the DOM', () => {  render(<Send />)  expect(screen.getByLabelText<HTMLSelectElement>('From')).toBeInTheDocument();});
```

**Тест** — это функция, которая принимает два аргумента: название теста и callback-функцию с логикой.

Внутри callback необходимо вызвать функцию **render,** которая импортируется из библиотеки и принимает тестируемый React-компонент.

Дальше идет главная конструкция для теста — функция **expect,** которую можно описать так:

`expect(<реальное состояние>).toBe(<ожидаемое состояние>);`

В данном случае нам необходимо убедиться, что выпадающее меню с кошельками `<реальное состояние>` было отрисовано в HTML-разметке `<ожидаемое состояние>.`

Чтобы получить этот элемент разметки, необходимо воспользоваться методами объекта **screen,** который мы также импортировали из библиотеки. Он содержит различные методы для взаимодействия с DOM-деревом. В данном случае мы вызываем метод «getByLabelText», который осуществляет поиск элемента, который ассоциирован с тегом `<label>`, в котором есть текст «From».

Выполнив поиск элемента, дописываем логическое выражение. В данном случае вызовом функции `.toBeInTheDocument()`.

_Литературный смысл теста можно описать так: «после рендера компонента на странице отображается элемент с лейблом “From”»._

Ниже будет более детальная информация по поисковым методам объекта screen и их отличиям.

#### Работа с DOM-деревом

У react-testing-library есть две ключевые особенности. Во-первых, она позволяет абстрагироваться от логики внутри компонента. Во-вторых, отслеживает состояние элементов реального DOM. Это означает, что библиотека старается максимально имитировать пользовательское поведение и использовать только то, что может видеть он. 

По описанию примера теста выше можно увидеть, что библиотека ищет элемент в реальном DOM-дереве и исследует его состояние. В данном случае — что этот элемент существует. 

А что насчет пункта с абстрагированием от логики внутри компонента? Есть функция расчета комиссии за перевод. Мы можем предположить, что расчет комиссии содержит логику, НО с данной библиотекой мы можем проверить только то, что после расчёта комиссии в DOM-дереве произошли изменения, которые мы ожидаем. То есть мы не проверяем, что state компонента изменился, как делали бы, используя другие библиотеки, а смотрим, что сумма комиссии на страничке — то, что видит пользователь — соответствует нашим ожиданиям. Внутри компонента логика может быть любой.

Мы знаем, что комиссия равна 1% от суммы перевода:

```
import { render, screen } from '@testing-library/react';import Send from './index'; test('Fee element: value was changed after change of amount value', () => {  render(<Send />)  userEvent.type(screen.getByLabelText<HTMLInputElement>('Amount'), '1')  expect(screen.getByLabelText<HTMLInputElement>('Fee').value).toBe('0.01');})
```

_Литературное описание теста: «после того, как пользователь ввел значение “1” в поле ввода с лейблом “Amount”, поле ввода с лейблом “Fee” будет равно 0.01». _

В примере выше использовался еще один важный объект, предоставляемый библиотекой React Testing Library — **userEvent**. Он предоставляет набор методов для взаимодействия с элементами DOM, которые максимально приближены к реальному поведению пользователя.

 Он может что-то напечатать:

`userEvent.type(<Элемент с которым взаимодействует юзер>, «текст который он вводит»)` 

может нажать на кнопку:

`userEvent.click(<Элемент с которым взаимодействует юзер>)`

и так далее.

_Для успешной работы с библиотекой нужно перестать быть разработчиком, который думает о логике внутри своего кода, и стать обычным юзером, который как-то взаимодействует с тем, что видит на страничке, и получает результат своего взаимодействия._

#### Поиск элемента

Теперь, когда основная концепция описана, углубимся в синтаксис, особенности и тонкости. 

Поисковые методы по DOM-дереву, которые предоставляет screen, делятся на три категории: 

1\. getBy — поиск элемента на странице;

2\. queryBy — поиск элемента, которого нет на странице;

3\. findBy — поиск элемента на странице, который зависит от асинхронного кода.

Если getBy не вызывает вопросов и используется чаще всего, то две другие категории требуют внимания. Начнем с queryBy. В нашем примере есть валидация операции отправки денег. Если валидация не прошла, пользователю выводится ошибка:

![](https://habrastorage.org/getpro/habr/upload_files/c9b/aff/0da/c9baff0da166adc1c75437f923ac12b4.png)

```
{error.status && (  <div className="error">    {error.message}  </div>)}
```

Значит, когда пользователь только зашел на страницу с нашим компонентом, он не должен видеть ошибку. Чтобы это проверить, мы должны использовать queryBy:

```
test('Error element: not to be in the component by default', async ()=> {  render(<Send />)  expect(screen.queryByText('Error')).not.toBeInTheDocument();})
```

Также стоит обратить внимание, что для любого утверждения после `expect` не существует обратного утверждения (например, `NotToBeInTheDocument`). Все отрицания выполняются с помощью конструкции `.not` перед выражением. Если вы попробуете выполнить поиск, используя getBy, то получите ошибку в синтаксисе теста — он не найдет элемент.

Следующая категория — findBy для работы с асинхронным кодом. Загрузка имени юзера происходит асинхронно:

```
const getUser = () => Promise.resolve({ id: '1', name: 'John Doe' })
```

А отрисовка элемента происходит после получения данных о юзере:

```
{user && <div>Hello {user.name}</div>}
```

Значит, тут необходимо использовать findBy:

```
test('User element: exist after fetch data', async function () {  render(<Send />)  expect(await screen.findByText(/Hello/)).toBeInTheDocument()});
```

Обратите внимание, что если нам необходимо дождаться выполнения асинхронной функции, то и callback-функция, передаваемая в тест, должна быть асинхронной.

Вот удобная таблица методов поиска:

| 

getBy

 | 

queryBy

 | 

findBy

 |
| 

getByText

 | 

queryByText

 | 

findByText

 |
| 

getByRole

 | 

queryByRole

 | 

findByRole

 |
| 

getByLabelText

 | 

queryByLabelText

 | 

findByLabelText

 |
| 

getByPlaceholderText

 | 

queryByPlaceholderText

 | 

findByPlaceholderText

 |
| 

getByAltText

 | 

queryByAltText

 | 

findByAltText

 |
| 

getByDisplayValue

 | 

queryByDisplayValue

 | 

findByDisplayValue

 |
| 

getByTestId

 | 

queryByTestId

 | 

findByTestId

 |
| 

getByTitle

 | 

queryByTitle

 | 

findByTitle

 |

Подробно хочется остановится только на двух:

1.  Поиск по роли (getByRole, queryByRole, findByRole). Помогает найти элемент по его логической роли в документе. Вот некоторые роли:
    

‘combobox’ - тег `<select />`

‘button’ - тег `<button />` или `<input type=«submit» />`

В нашем примере для поиска кнопки отправки используется getByRole:

```
userEvent.click(screen.getByRole('button'));     
```

2.  Поиск по testId. В коде вы можете указать любому компоненту data-атрибут testId и использовать это значение при поиске элемента:
    

```
<div data-testid="custom-element" />
```

У всех методов поиска есть варианты поиска всех элементов, соответствующих условию на странице:

*   get**All**ByText
    
*   query**All**ByPlaceholderText
    
*   find**All**ByTestId
    
*   и т.д. для всех поисковых методов
    

#### Логические выражения

Следует уделить внимание и правильному использованию логических выражений. Они проверяют выполнение теста:

```
expect(<реальное состояние>).toBe(<ожидаемое состояние>);
```

Приведу пару примеров использования разных методов функции expect:

*   **toBeNull:**
    

`expect(screen.queryByText(/Hello/)).toBeNull();`

_ожидание, что компонент будет равен null_

*   **toBeInTheDocument:**
    

`expect(await screen.findByText(/Hello/)).toBeInTheDocument()`

_ожидание, что компонент есть в DOM_

*   **toBeTruthy:**
    

`expect(screen.getByLabelText<HTMLInputElement>('Fee').disabled).toBeTruthy();`

_ожидание, что поле ввода с лейблом "Fee" будет недоступно для пользовательского ввода_

*   **toHaveTextContent:**
    

`expect(screen.getByText<HTMLSpanElement>(/balance/i)).toHaveTextContent('10');`

_ожидание, что в текстовом элементе, который содержит текст "balance", будет текст '10' _

*   **toBe:**
    

`expect(state[0].balance).toBe(4.95);`

_ожидание, что одна цифра будет равна другой цифре (в данном случае баланс кошелька из state будет равен 4.95)_

Библиотека построена на базе Jest, поэтому все методы с детальным описанием можно увидеть на официальной странице [jest](https://jestjs.io/docs/expect).

В чем преимущество использования максимально подходящих под ситуацию утверждений, хотя всегда есть желание поставить `.toBe()` и не заморачиваться? 

Их два: это более понятный код утверждений для прочтения другим членом команды, даже незнакомым с написанием кода и тестов, и более понятные ошибки в логах, если тест провалился.

#### userEvent и fireEvent

Как я уже говорил, [userEvent](https://github.com/testing-library/user-event) имитирует поведение пользователя. В большинстве ситуаций вы будете использовать его. Вот полный список методов:

*   ​​click - нажатие на элемент;
    
*   dblClick - двойное нажатие на элемент;
    
*   type - печать текста;
    
*   clear - очистить поле ввода (только `<input/>` и `<select/>`);
    
*   tab - нажатие на tab;
    
*   hover - наведение мышки;
    
*   unhover - снятие наведения мышки;
    
*   upload - загрузка файла;
    
*   selectOptions - выбрать из выпадающего списка (`<select />`);
    
*   deselectOptions -убрать выбор ;
    
*   paste - вставить из буфера обмена;
    
*   keyboard - имитация нажатия клавиш;
    

[Ссылка](https://testing-library.com/docs/ecosystem-user-event) на официальную документацию.

Философия react-testing-library учит нас, что необходимо стремиться использовать userEvent как можно чаще для имитации пользовательского поведения. Но иногда возможностей userEvent не хватает. Тогда можно обратиться к fireEvent. По факту, userEvent — это оболочка над fireEvent, которая позволяет получить более высокий уровень абстракции. А вот [fireEvent](https://testing-library.com/docs/dom-testing-library/api-events/#fireevent) — это имитация поведения DOM-элементов. 

Возьмем метод type у userEvent и сравним с тем же событием в fireEvent:

*   userEvent:
    

`userEvent.type(screen.getByLabelText<HTMLInputElement>('Amount'), '10')`

*   fireEvent:
    

`fireEvent.change(screen.getByLabelText<HTMLInputElement>('Amount'), {target: { value: '10' }});`

fireEvent принимает два аргумента: элемент DOM-дерева и объект события, которое с ним происходит.  fireEvent содержит много методов —  "keyPress", "focusOut", "drag" — полный список я смог найти только в их [типах](https://github.com/testing-library/dom-testing-library/blob/main/types/events.d.ts). 

#### Redux

Как тестировать компонент, если он берет данные из Redux-стора? Нужно сделать настоящий store, только внутрь передать заранее написанные данные:

Функция renderWithRedux принимает в себя компонент, который нужно отрисовать, и данные, с которыми этот элемент будет отрисован. Внутри себя она создает store и оборачивает компонент тегом `<Provider/>`, куда и передает созданный store. Обратите внимание: функция возвращает не только рендер компонента, но и сам store.

```
mport { createStore } from "redux";import { Provider } from "react-redux";import { reducer, WalletItem } from "../../redux/store"; const renderWithRedux = (  component: JSX.Element,  { initialState,    store = createStore(reducer, initialState)  }: {initialState?: WalletItem[]; store?: any } = {}) => {  return {    ...render((        <Provider store={store}>          {component}        </Provider>,    store  }}
```

Разберем на конкретных примерах.

```
test('From element: default value is the first wallet', function () {const { store } = renderWithRedux(<Send />, { initialState: MOCK_WALLET_LIST})const state = store.getState();expect(screen.getByLabelText<HTMLSelectElement>('From').value).toBe(state[0].id.toString());});
```

_Литературное описание теста: «Значение поля ввода с лейблом "From" по умолчанию будет равно "id" первого кошелька»._

В функцию renderWithRedux передается тестируемый компонент и данные, а возвращает функция store. Это обычный стор Redux, из него мы получаем state и можем отслеживать, как он меняется в результате различных действий. Например:

```
test('SendTransaction: balances were changed after sending funds',  () => {  const { store } = renderWithRedux(<Send />, { initialState: MOCK_WALLET_LIST})  const state = store.getState();  userEvent.type(screen.getByLabelText<HTMLInputElement>('Amount'), '5')  userEvent.click(screen.getByRole('button'));  expect(state[0].balance).toBe(4.95);  expect(state[1].balance).toBe(12);})
```

_Литературное описание теста: «После того, как пользователь ввел в поле Amount строку "5" и нажал на кнопку, выполняется отправка денег, в результате которой баланс одного кошелька будет равен "4.95", а другого — "12"». _

**ВАЖНО!** Все тесты работают с одним стором. Если вы в первом тесте изменили стор (например, для проверки отправили деньги с одного кошелька на другой), то во всех последующих тестах баланс кошельков будет отличаться от исходного.

Функция renderWithRedux может быть написана вами по-другому. Реализация не важна, главное, чтобы она оборачивала компонент провайдером со стором. Однако реализация в этой статье написана не мной и применяется повсеместно. Своего рода стандарт. Надеюсь, в какой-то момент она станет частью библиотеки.

#### Router

Имитировать роутинг вам потребуется не только для проверки адреса, куда переходит пользователь, но и если используете navigate в компоненте:

```
const navigate = useNavigate();…navigate('/success');
```

Для имитации роутинга нужно обернуть компонент в [<MemoryRouter/>](https://v5.reactrouter.com/web/api/MemoryRouter). Это специальный компонент, который помогает работать с роутингом вне браузера, в том числе для тестирования. Он хранит историю "URL". При этом не пишет в адресную строку и не читает из нее, так как в тестах никакой адресной строки нет.

```
const renderWithRouter = (  component: JSX.Element ) => (    render((      <MemoryRouter>          {component}      </MemoryRouter>)))
```

 В нашем примере есть три роута:

*   "/" — страница "Welcome";
    
*   "/send" — страница "Send";
    
*   "/success" — страница "Success";
    

Для тестирования этого примера нужно выполнить рендер компонентов не только с роутингом, но и с Redux. Так выглядит функция renderWithReduxAndRouter:

```
const renderWithReduxAndRouter = (  component: JSX.Element,  { initialState,    store = createStore(reducer, initialState)  }: {initialState?: WalletItem[]; store?: any } = {}) => {  return {    ...render((      <MemoryRouter>        <Provider store={store}>          {component}        </Provider>      </MemoryRouter>)),    store  }}
```

Компонент, обеспечивающий роутинг, в примере называется <NavBar/> и выглядит так:

```
import React from 'react';import {Link, Route, Routes} from "react-router-dom";import Send from "./send";import Success from "./success";import Welcome from "./welcome"; function NavBar() {  return (    <div>      <nav className="navbar">        <Link className="navbarLink" to='/'>Welcome</Link>        <Link className="navbarLink" to='/send'>Send</Link>      </nav>      <Routes>        <Route path={'/'} element={<Welcome/>}/>        <Route path={'/send'} element={<Send/>}/>        <Route path='/success' element={<Success/>}/>      </Routes>    </div>  );} export default NavBar;
```

Тесты, которые проверяют все три роута:

```
test('First element is Welcome page', () => {  renderWithReduxAndRouter(<NavBar/>, { initialState: MOCK_WALLET_LIST })  expect(screen.getByText('Welcome!')).toBeInTheDocument();})
```

_Литературное описание теста: "Первая страница, которую видит юзер — страница приветствия"._

```
test('After clicking the "Send" link, the "Send" page opens.', () => {  renderWithReduxAndRouter(<NavBar/>, { initialState: MOCK_WALLET_LIST })  userEvent.click(screen.getByText('Send'));  expect(screen.getByRole('button')).toBeInTheDocument()})
```

_Литературное описание теста: "После нажатия на ссылку "Send" пользователь переходит на страницу отправки средств"._

```
 test('After clicking the "Confirm" button, the "Success" page opens.', () => {
  const { store } = renderWithReduxAndRouter(<NavBar/>, { initialState: MOCK_WALLET_LIST })
  const state = store.getState();
  userEvent.click(screen.getByText('Send'));
  userEvent.selectOptions(screen.getByLabelText<HTMLSelectElement>('From'), state[3].id.toString())
  userEvent.selectOptions(screen.getByLabelText<HTMLSelectElement>('To'), state[4].id.toString())
  userEvent.type(screen.getByLabelText('Amount'), '1');
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByTestId('success')).toBeInTheDocument()
})

```

_Литературное описание теста: "После отправки средств пользователь переходит на страницу успеха"._

На последнем примере можно увидеть, как перед отправкой были выбраны кошельки 4 и 5. Все потому, что у нас уже есть тест, который изменяет балансы кошельков. А стор у нас единый для всех тестов. Значит, нужно использовать балансы кошельков, которые до этого не участвовали в тестах, либо учитывать эти изменения в других тестах.

#### Заключение

Писать тесты — не то же самое, что писать код. Главное отличие состоит в необходимости имитировать различные сущности: роутер, пользовательское поведение, данные, библиотеки. Именно в этой области и возникают основные сложности при написании тестов.

В спорах о необходимости тестирования поломано немало копий, но если вы дочитали эту статью, значит, на этот вопрос вы себе уже ответили.

В свой первый релиз я сделал одно из полей в Redux большими буквами, а не маленькими, как было до этого. В результате сломал огромное количество функционала, который был чувствителен к регистру. Привет, срочный hotfix на следующий за релизом день. В этот день на вопрос о необходимости тестирования я себе ответил.

#### Полезные ссылки

Кроме официальной документации, ссылки на которую я оставлял прямо в тексте, при подготовке статьи я использовал несколько обучающих материалов, из которых хочу посоветовать:

\- [текст на английском языке ](https://www.robinwieruch.de/react-testing-library/)

\- [видео на русском языке](https://www.youtube.com/watch?v=n79PMyqcCJ8&t=3294s)

Также можете посмотреть [репозиторий с приложением](https://github.com/daneelzam/react-test), написанным для этой статьи. Там 27 различных тестов, далеко не все из которых вошли в материал.