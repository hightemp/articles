# Настройка кластера Clickhouse Steb-by-Step - часть 1 | avamk.ru
В этой статье поговорим о настройках кластера Clickhouse, понятии репликации и распределенных таблицах. ClickHouse был специально разработан для работы в кластере, узлы которого расположены в разных дата-центрах. СУБД можно масштабировать линейно (так называемое _[горизонтальное масштабирование](https://clickhouse.com/docs/ru/introduction/distinctive-features/#parallelnaia-obrabotka-zaprosa-na-mnogikh-protsessornykh-iadrakh)_) до сотен узлов. В этой статье описана настройка кластера Clickhouse и настройка репликации — часть 1. Продолжение в статье [](https://avamk.ru/nastrojka-klastera-clickhouse-steb-by-step-chast-2.html)[Настройка кластера Clickhouse Steb-by-Step — часть 2](https://avamk.ru/nastrojka-klastera-clickhouse-steb-by-step-chast-2.html)

Масштабирование в основном нужно для решения проблем, которые возникают при увеличении объема анализируемых данных и увеличении нагрузки. В этом случае данные больше не могут храниться и обрабатываться на одном физическом сервере.

ClickHouse обеспечивает сегментирование и репликацию «из коробки». Поэтому их можно гибко настраивать отдельно для каждой таблицы. Для репликации требуется Apache ZooKeeper (рекомендуется версия 3.4.5+). ZooKeeper не является строгим требованием. В некоторых простых случаях, вы можете дублировать данные, записывая их во все реплики из кода вашего приложения. Такой подход не рекомендуется, в этом случае ClickHouse не сможет гарантировать согласованность данных на всех репликах. Это обязанность перекладывается на ваше приложение.

Репликация работает на уровне отдельной таблицы, а не всего сервера. Сервер может одновременно хранить как реплицированные, так и не реплицированные таблицы.

Шардинг кластера Clickhouse
---------------------------

[Шардинг](https://clickhouse.com/docs/ru/introduction/distinctive-features/#raspredelionnaia-obrabotka-zaprosa-na-mnogikh-serverakh) (_горизонтальное разбиение_) в ClickHouse позволяет записывать и хранить фрагменты данных в распределенном кластере и обрабатывать (**читать**) данные параллельно на всех узлах кластера, увеличивая пропускную способность и уменьшая задержку. Например, в запросах с GROUP BY СУБД ClickHouse будет выполнять агрегирование на удаленных узлах и передавать промежуточные состояния агрегатных функций на узел-инициатор запроса, где будет выполнено конечное агрегирование данных.

Для шардирования используется специальный движок таблиц _[Distributed](https://clickhouse.com/docs/ru/engines/table-engines/special/distributed/)_, который не хранит данные, а делегирует запросы SELECT к таблицам сегментов (таблицы, содержащие фрагменты данных) с последующей обработкой полученных данных.

Запись данных в сегменты может выполняться в двух режимах:

1.  через распределенную таблицу и дополнительный ключ сегментирования,
2.  непосредственно в таблицы сегментов, из которых затем данные будут считываться через распределенную таблицу.

Рассмотрим эти режимы более подробно.

В первом режиме данные записываются в распределенную таблицу с помощью ключа шарда. В простейшем случае ключ сегментирования может быть случайным числом, т. е. результатом вызова функции rand (). Однако рекомендуется брать значение хэш-функции по полю в таблице в качестве ключа сегментирования, что позволит, с одной стороны, локализовать небольшие наборы данных на одном сегменте, а с другой — обеспечит достаточно равномерное распределение таких наборов по разным шардам в кластере. 

Например, идентификатор сеанса пользователя (sessions\_id) позволит локализовать положение блоков для одного пользователя на одном сегменте, в то время как сеансы разных пользователей будут равномерно распределяться по всем сегментам в кластере (при условии, что значения поля sessions\_id имеет хорошее распределение). Ключ сегментирования также может быть нечисловым или составным. В этом случае используется встроенная функция [cityHash64](https://clickhouse.com/docs/en/sql-reference/functions/hash-functions/#cityhash64). В этом режиме данные, записываемые на один из узлов кластера, будут автоматически перенаправляться на необходимые шарды с помощью ключа сегментирования, однако, увеличивая трафик.

Более сложный способ — вычислить необходимый шард вне ClickHouse и записать его прямо в таблицу шардов. Сложность здесь связана с тем, что вам нужно знать список доступных узлов-шардов. Однако в этом случае вставка данных становится более эффективной, а механизм сегментирования (определение желаемого фрагмента) может быть более гибким, однако этот метод не рекомендуется.

Репликация кластера Clickhouse
------------------------------

ClickHouse поддерживает репликацию данных, обеспечивая целостность данных на репликах. Для репликации данных используются специальные движки таблиц семейства MergeTree:

*   ReplicatedMergeTree;
*   ReplicatedCollapsingMergeTree;
*   ReplicatedAggregatingMergeTree;
*   ReplicatedSummingMergeTree.

Репликация часто используется в сочетании с сегментированием — репликация Master-Master с сегментированием является распространенной стратегией, используемой в базах данных OLAP (ориентированных на столбцы). Это также относится к Clickhouse.

Например, мы используем кластер из шести узлов: три шарда по две реплики. Следует отметить, что репликация не зависит от механизмов шардинга и работает на уровне отдельных таблиц, а также каждый шард присутствует на двух узлах поскольку коэффициент репликации равен 2.

Шардинг распределяет части данных (разобщенные данные) между несколькими серверами, поэтому каждый сервер действует как единый источник подмножества данных. Репликация копирует данные на несколько серверов, поэтому каждый бит данных можно найти на нескольких узлах.

*   Масштабируемость определяется сегментированием или шардированием данных.
*   Надежность определяется репликацией данных

Шардинг и репликация данных полностью независимы. Шардинг — естественная часть ClickHouse, в то время как репликация сильно зависит от Zookeeper, который используется для уведомления реплик об изменениях состояния данных.

![](https://avamk.ru/wp-content/uploads/2021/11/clickhouse-cluster-zookeeper-1024x469.png)

Clickhouse из 6-ти узлов 3-х шардов с 2-мя репликами

Схема распределенной таблицы
----------------------------

Для дальнейшего описания темы настройка кластера Clickhouse Steb-by-Step, остается разобрать понятие распределенной таблицы. Для того чтобы ClickHouse мог выбрать правильные базы данных для обращения к локальным таблицам сегментов, распределенная таблица должна быть создана с указанием базы данных (или с указанием базы данных по умолчанию).

![](https://avamk.ru/wp-content/uploads/2021/11/Distributed-table-Creation.png)

Создание распределенной таблицы

Когда приходит запрос к распределенной таблице, ClickHouse автоматически добавляет соответствующую базу данных для каждой локальной таблицы сегментов.

Выводы
------

Распределенная таблица — это просто механизм запросов, она не хранит никаких данных. Когда запрос запускается, он будет отправлен всем фрагментам кластера, а затем обработан и агрегирован для возврата результата. Распределенная таблица может быть создана на всех экземплярах или может быть создана на той ноде, с которой клиенты будут напрямую запрашивать данные или на основе бизнес-требований. Рекомендуется создавать на нескольких нодах.

В этом посте описана работа кластера Clickhouse. Мы подробно обсудили основные предпосылки процесса сегментирования и репликации ClickHouse, а в следующем посте мы подробно обсудим установку и настройку кластера.

Ссылка на источник: [Clickhouse Cluster setup and Replication Configuration Part-1](https://aavin.dev/clickhouse-cluster-setup-and-replication-configuration-part1/)