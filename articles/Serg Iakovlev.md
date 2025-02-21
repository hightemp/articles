# Serg Iakovlev
В этой статье описана технология репликации и шардирования данных в Clickhouse.  
В первом примере будет рассмотрен вариант с одним шардом и тремя репликами  
Во втором примере будет рассмотрен вариант с тремя шардами и лвумя репликами на каждый шард.  
Везде будет использоваться одна и та же схема из 4-х хостов  

### Пример №1: Clickhouse + 1 шард х 3 реплики

В данной конкретной схеме используются 4 хоста: на трех хостах устанавливается Clickhouse, на 4-м устанавливается Zookeeper.  
Я использовал Debian 11.3. На текущий момент в ее репозитариях лежит Clickhouse версии 18.16.1 и ZooKeeper версии 3.4.13.  
ZooKeeper позволяет использовать реплицируемые таблицы в кластере с несколькими хостами в шарде, и эта репликация будет работать в автоматическом режиме - достаточно настроить конфигурацию для ZooKeeper в конфигах самого Clickhouse, после чего данные будут "размазываться" по всем репликам сами.

Установку данной схемы можно разделить на 5 этапов:

 **1. Установка Clickhouse на каждой из 3-х нод
     2. Установка ZooKeeper на 4-м хосте
     3. Настройка конфигов Clickhouse
     4. Проверка
     5. Тестирование кластера** 

### 1\. Установка Clickhouse

Яндекс рекомендует использовать официальные скомпилированные deb пакеты для Debian или Ubuntu. Для установки пакетов выполните:```null

 sudo apt-get install -y apt-transport-https ca-certificates dirmngr
 sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 8919F6BD2B48D754
 
 echo "deb https://packages.clickhouse.com/deb stable main" | sudo tee \
     /etc/apt/sources.list.d/clickhouse.list
 sudo apt-get update
 
 sudo apt-get install -y clickhouse-server clickhouse-client
 
 sudo service clickhouse-server start
 
```

Проверяем```null

 systemctl restart clickhouse-server
 systemctl status clickhouse-server
 
```

Прописываем в /etc/hosts```null

 192.168.56.120    clickhouse1
 
```

clickhouse1 - это имя хоста для первой ноды.  
Повторяем первый пункт для каждого из 3-х хостов

### 2\. Установка ZooKeeper на 4-м хосте

Выполняем команду```null

 apt-get install zookeeper netcat --fix-missing
 
```

В файле```null

 /etc/zookeeper/conf/myid 
 
```

нужно поставить```null

 1
 
```

В файле```null

 /etc/zookeeper/conf/zoo.cfg
 
```

добавить пару строк```null

 autopurge.purgeInterval=1
 autopurge.snapRetainCount=5
 
```

Также в этом файле раскомментировать строку```null

 server.1=zookeeper1.test:2888:3888
 
```

Запускаем zookeeper```null

 sudo -u zookeeper /usr/share/zookeeper/bin/zkServer.sh start
 
```

Проверяем```null

 echo stat | nc localhost 2181
 
```

### 3\. Настройка конфигов Clickhouse

Данный пункт нужно выполнить на каждом из 3-х хостов, на которые мы только что поставили Clickhouse. На первом хосте создаем новый конфиг:```null

 /etc/clickhouse-server/config.d/zookeeper.xml
 
```

192.168.56.123 - это ip для zookeeper:```null

 <yandex>
     <zookeeper>
         <node>
             <host>192.168.56.123</host>
             <port>2181</port>
         </node>
         <session_timeout_ms>30000</session_timeout_ms>
         <operation_timeout_ms>10000</operation_timeout_ms>
     </zookeeper>
     <distributed_ddl>
         <path>/clickhouse/task_queue/ddl</path>
     </distributed_ddl>
 </yandex>
 
```

Создаем еще один новый конфиг```null

 /etc/clickhouse-server/config.d/macros.xml
 
```

следующего содержания - здесь demo - это имя шарда, clickhouse1 - имя самого хоста:```null

 <yandex>
     <macros>
         <cluster>demo</cluster>
         <shard>1</shard>
         <replica>clickhouse1</replica>
     </macros>
 </yandex>
 
```

В основном конфиге config.xml заполняем секцию. Здесь clickhouse1, clickhouse2, clickhouse3 - имена хостов:```null

    <remote_servers>
         <demo>
             <shard>
                 <replica>
                     <host>clickhouse1</host>
                     <port>9000</port>
                 </replica>
                 <replica>
                     <host>clickhouse2</host>
                     <port>9000</port>
                 </replica>
                 <replica>
                     <host>clickhouse3</host>
                     <port>9000</port>
                 </replica>
             </shard>
         </demo>
     </remote_servers>
 
 
```

В этом же конфиге нужно раскомментировать строку:  
<listen\_host>::</listen\_host>

Проверяем:

```null

 systemctl restart clickhouse-server
 systemctl status clickhouse-server
 
```

### 4\. Проверка

На каждом из трех хостов из командной строки выполняем команду```null

 clickhouse-client -q "SELECT * FROM system.clusters WHERE cluster='demo' FORMAT Vertical;"
 
```

Везде должен быть одинаковый ответ типа:```null

 Row 1:
 ──────
 cluster:          demo
 shard_num:        1
 shard_weight:     1
 replica_num:      1
 host_name:        clickhouse1
 host_address:     192.168.56.120
 port:             9000
 is_local:         1
 user:             default
 default_database: 
 
 Row 2:
 ──────
 cluster:          demo
 shard_num:        1
 shard_weight:     1
 replica_num:      2
 host_name:        clickhouse2
 host_address:     192.168.56.121
 port:             9000
 is_local:         1
 user:             default
 default_database: 
 
 Row 3:
 ──────
 cluster:          demo
 shard_num:        1
 shard_weight:     1
 replica_num:      3
 host_name:        clickhouse3
 host_address:     192.168.56.122
 port:             9000
 is_local:         1
 user:             default
 default_database: 
 
```

Вторая проверка - на каждой из 3 нод надо проверить zookeeper:```null

 clickhouse-client -q "select * from system.zookeeper where path='/clickhouse/task_queue/'"
 
```

Ответ должен быть типа```null

 ddl     4   4   2022-08-10 10:58:09 2022-08-10 10:58:09 0   0   0   0   0   04
 
```

### 5\. Тестирование кластера

Зайдем на первую ноду и создадим распределенную таблицу.```null

 clickhouse-client
 
```

Выполняем команду:```null

 CREATE TABLE test ON CLUSTER '{cluster}'
 (
     timestamp DateTime,
     contractid UInt32,
     userid UInt32
 ) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/{shard}/default/test', '{replica}')
 PARTITION BY toYYYYMM(timestamp)
 ORDER BY (contractid, toDate(timestamp), userid)
 SAMPLE BY userid;
 
```

Выполним селект к zookeeper:```null

 select * from system.zookeeper WHERE path = '/clickhouse/tables/demo/1/default/test'
 
```

Теперь зайдем на вторую ноду и выполним селект:```null

 select hostName(), database, name from cluster('demo', system.tables) where database='default' and name='test';
 
```

Зайдем на третью ноду и вставим данные```null

 INSERT INTO test(timestamp, contractid, userid) VALUES (NOW(),1,1);
 
```

После этого заходим на любую ноду и делаем селект:```null

 select * from test;
 
```

И видим, что только что добавленные данные везде реплицированы.

Для создания реплики можно использовать другой алгоритм, который отличается от типа ReplicatedMergeTree, рассмотренного выше.  
Этот другой алгоритм основан на том, что создаются две таблицы - одна типа MergeTree, а вторая - Distributed, которая является ссылкой на первую:

```null

 CREATE TABLE default.t_cluster ON CLUSTER demo ( id Int16, name String, birth Date )
 ENGINE = MergeTree() 
 PARTITION BY toYYYYMM(birth) 
 ORDER BY id;
 
 CREATE TABLE default.dist_t_cluster ON CLUSTER demo as t_cluster engine = Distributed(demo, default, t_cluster,rand());
 
 insert into dist_t_cluster values(3, 'ccc', '2021-02-01'), (4, 'ddd', '2021-02-02');
 
 select * from default.dist_t_cluster;
 
```

### Пример №2: Clickhouse + 3 шарда х 3 реплики

Установку Clickhouse и установку ZooKeeper на каждой из 3-х нод мы уже сделали в предыдущем примере. Поэтому переходим к настройке.  
Мы рассмотрим схему, в которой мало того, что данные будут реплицированы, они при этом еще будут шардированы. Т.е. в предыдущем рассмотренном случае мы имели аж тройную репликацию с полной избыточностью, когда данные дублируются одновременно в трех местах - это конечно супер-надежно, но не супер-эффективно.  
В этом же примере данные будут распределены по трем разным хостам, и у каждой уникальной порции данных будет своя реплика. Этот вариант тоже имеет право на существование. Будут созданы 4 базы - три для хранения реальных данных и четвертая для хранения симлинка. Физически все данные будут храниться в базах dwh01, dwh02, dwh03. Четвертая база dwh выступает в роли "заглушки" и будет физически пуста.  
В этом примере мы будем использовать все те же 4 хоста - 3 для данных и один для zookeeper, Последний мы трогать не будем и оставим как есть. Везде рекомендуется использовать для кластеров минимум от 3-х серверов для zookeeper.

1\. Создаем новый конфиг - это нужно проделать на каждой из 3-х нод

```null

 /etc/clickhouse-server/config.d/cluster.xml
 
```

Корневой конфиг cluster.xml на этот раз оставляем нетронутым, поскольку всегда существует вероятность, что при очередном апдэйте самого кликхауса он может быть перезаписан.```null

 <yandex>
     <listen_host>::</listen_host>
     <remote_servers>
          <test>
              <shard>
                 <internal_replication>true</internal_replication>
                 <replica>
                     <default_database>dwh01</default_database>
                     <host>clickhouse1</host>
                     <port>9000</port>
                 </replica>
                 <replica>
                     <default_database>dwh01</default_database>
                     <host>clickhouse2</host>
                     <port>9000</port>
                 </replica>
              </shard>
              <shard>
                 <replica>
                     <default_database>dwh02</default_database>
                     <host>clickhouse2</host>
                     <port>9000</port>
                 </replica>
                 <replica>
                     <default_database>dwh02</default_database>
                     <host>clickhouse3</host>
                     <port>9000</port>
                 </replica>
              </shard>
              <shard>
                 <replica>
                     <default_database>dwh03</default_database>
                     <host>clickhouse3</host>
                     <port>9000</port>
                 </replica>
                 <replica>
                     <default_database>dwh03</default_database>
                     <host>clickhouse1</host>
                     <port>9000</port>
                 </replica>
              </shard>
          </test> 
     </remote_servers>
 </yandex>
 
```

2\. Создаем новый конфиг - это нужно проделать на каждой из 3-х нод```null

 /etc/clickhouse-server/config.d/zookeeper.xml
 
```

```null

 <yandex>
     <zookeeper>
         <node>
             <host>192.168.56.123
             <port>2181</port>
         </node>
         <session_timeout_ms>30000</session_timeout_ms>
         <operation_timeout_ms>10000</operation_timeout_ms>
     </zookeeper>
     <distributed_ddl>
         <path>/clickhouse/task_queue/ddl</path>
     </distributed_ddl>
 </yandex>
 
```

3\. Создаем новый конфиг:```null

 /etc/clickhouse-server/config.d/macro.xml
 
```

На первом хосте:```null

 <yandex>
     <macros>
         <cluster01>test</cluster01>
         <shard01>1</shard01>
         <shard02>3</shard02>
         <replica01>clickhouse1</replica01>
         <replica02>clickhouse1</replica02>
     </macros>
 </yandex>
 
```

На втором хосте:```null

 <yandex>
     <macros>
         <cluster01>test</cluster01>
         <shard01>2</shard01>
         <shard02>1</shard02>
         <replica01>clickhouse2</replica01>
         <replica02>clickhouse2</replica02>
     </macros>
 </yandex>
 
```

На третьем хосте:```null

 <yandex>
     <macros>
         <cluster01>test</cluster01>
         <shard01>3</shard01>
         <shard02>2</shard02>
         <replica01>clickhouse3</replica01>
         <replica02>clickhouse3</replica02>
     </macros>
 </yandex>
 
```

4\. После настройки конфигов на каждой ноде выполнить команды:```null

 systemctl restart clickhouse-server
 systemctl status clickhouse-server
 
```

И выполнить селекты на каждой ноде:```null

 SELECT * FROM system.macros m ;
 SELECT * FROM system.clusters c WHERE cluster = 'test';
 
```

5\. Из командной строки выполнить: На первой ноде:```null

 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh"
 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh01"
 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh03"
 
```

На второй ноде:```null

 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh"
 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh02"
 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh01"
 
```

На третьей ноде:```null

 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh"
 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh03"
 clickhouse-client --query "CREATE DATABASE IF NOT EXISTS dwh02"
 
```

Данные и реплики будут храниться в разных базах, здесь идет перекрестная схема репликации.  
На первом хосте будут хранится данные и реплика с третьего хоста.  
На втором хосте будут хранится данные и реплика с первого хоста.  
На третьем хосте будут хранится данные и реплика со второго хоста.  
Как видим, если один хост падает, то не все потеряно, как говорится.

6\. На первой ноде из клиента создаем таблицу hits\_shard типа ReplicatedMergeTree:

```null

 CREATE TABLE dwh01.hits_shard
 (
  `WatchID` UInt64,
  `JavaEnable` UInt8,
  `Title` String,
  `GoodEvent` Int16,
  `EventTime` DateTime,
  `EventDate` Date,
  `CounterID` UInt32,
  `ClientIP` UInt32,
  `ClientIP6` FixedString(16),
  `RegionID` UInt32,
  `UserID` UInt64,
  `CounterClass` Int8,
  `OS` UInt8,
  `UserAgent` UInt8,
  `URL` String,
  `Referer` String,
  `URLDomain` String,
  `RefererDomain` String,
  `Refresh` UInt8,
  `IsRobot` UInt8,
  `RefererCategories` Array(UInt16),
  `URLCategories` Array(UInt16),
  `URLRegions` Array(UInt32),
  `RefererRegions` Array(UInt32),
  `ResolutionWidth` UInt16,
  `ResolutionHeight` UInt16,
  `ResolutionDepth` UInt8,
  `FlashMajor` UInt8,
  `FlashMinor` UInt8,
  `FlashMinor2` String,
  `NetMajor` UInt8,
  `NetMinor` UInt8,
  `UserAgentMajor` UInt16,
  `UserAgentMinor` FixedString(2),
  `CookieEnable` UInt8,
  `JavascriptEnable` UInt8,
  `IsMobile` UInt8,
  `MobilePhone` UInt8,
  `MobilePhoneModel` String,
  `Params` String,
  `IPNetworkID` UInt32,
  `TraficSourceID` Int8,
  `SearchEngineID` UInt16,
  `SearchPhrase` String,
  `AdvEngineID` UInt8,
  `IsArtifical` UInt8,
  `WindowClientWidth` UInt16,
  `WindowClientHeight` UInt16,
  `ClientTimeZone` Int16,
  `ClientEventTime` DateTime,
  `SilverlightVersion1` UInt8,
  `SilverlightVersion2` UInt8,
  `SilverlightVersion3` UInt32,
  `SilverlightVersion4` UInt16,
  `PageCharset` String,
  `CodeVersion` UInt32,
  `IsLink` UInt8,
  `IsDownload` UInt8,
  `IsNotBounce` UInt8,
  `FUniqID` UInt64,
  `HID` UInt32,
  `IsOldCounter` UInt8,
  `IsEvent` UInt8,
  `IsParameter` UInt8,
  `DontCountHits` UInt8,
  `WithHash` UInt8,
  `HitColor` FixedString(1),
  `UTCEventTime` DateTime,
  `Age` UInt8,
  `Sex` UInt8,
  `Income` UInt8,
  `Interests` UInt16,
  `Robotness` UInt8,
  `GeneralInterests` Array(UInt16),
  `RemoteIP` UInt32,
  `RemoteIP6` FixedString(16),
  `WindowName` Int32,
  `OpenerName` Int32,
  `HistoryLength` Int16,
  `BrowserLanguage` FixedString(2),
  `BrowserCountry` FixedString(2),
  `SocialNetwork` String,
  `SocialAction` String,
  `HTTPError` UInt16,
  `SendTiming` Int32,
  `DNSTiming` Int32,
  `ConnectTiming` Int32,
  `ResponseStartTiming` Int32,
  `ResponseEndTiming` Int32,
  `FetchTiming` Int32,
  `RedirectTiming` Int32,
  `DOMInteractiveTiming` Int32,
  `DOMContentLoadedTiming` Int32,
  `DOMCompleteTiming` Int32,
  `LoadEventStartTiming` Int32,
  `LoadEventEndTiming` Int32,
  `NSToDOMContentLoadedTiming` Int32,
  `FirstPaintTiming` Int32,
  `RedirectCount` Int8,
  `SocialSourceNetworkID` UInt8,
  `SocialSourcePage` String,
  `ParamPrice` Int64,
  `ParamOrderID` String,
  `ParamCurrency` FixedString(3),
  `ParamCurrencyID` UInt16,
  `GoalsReached` Array(UInt32),
  `OpenstatServiceName` String,
  `OpenstatCampaignID` String,
  `OpenstatAdID` String,
  `OpenstatSourceID` String,
  `UTMSource` String,
  `UTMMedium` String,
  `UTMCampaign` String,
  `UTMContent` String,
  `UTMTerm` String,
  `FromTag` String,
  `HasGCLID` UInt8,
  `RefererHash` UInt64,
  `URLHash` UInt64,
  `CLID` UInt32,
  `YCLID` UInt64,
  `ShareService` String,
  `ShareURL` String,
  `ShareTitle` String,
  `ParsedParams` Nested(
  Key1 String,
  Key2 String,
  Key3 String,
  Key4 String,
  Key5 String,
  ValueDouble Float64),
  `IslandID` FixedString(16),
  `RequestNum` UInt32,
  `RequestTry` UInt8
 )
 ENGINE=ReplicatedMergeTree('/clickhouse/{cluster01}/{shard01}/tables/hits', '{replica01}')
 PARTITION BY toYYYYMM(EventDate)
 ORDER BY (CounterID, EventDate, intHash32(UserID))
 SAMPLE BY intHash32(UserID);
 
 
 CREATE TABLE dwh03.hits_shard
 (
  `WatchID` UInt64,
  `JavaEnable` UInt8,
  `Title` String,
  `GoodEvent` Int16,
  `EventTime` DateTime,
  `EventDate` Date,
  `CounterID` UInt32,
  `ClientIP` UInt32,
  `ClientIP6` FixedString(16),
  `RegionID` UInt32,
  `UserID` UInt64,
  `CounterClass` Int8,
  `OS` UInt8,
  `UserAgent` UInt8,
  `URL` String,
  `Referer` String,
  `URLDomain` String,
  `RefererDomain` String,
  `Refresh` UInt8,
  `IsRobot` UInt8,
  `RefererCategories` Array(UInt16),
  `URLCategories` Array(UInt16),
  `URLRegions` Array(UInt32),
  `RefererRegions` Array(UInt32),
  `ResolutionWidth` UInt16,
  `ResolutionHeight` UInt16,
  `ResolutionDepth` UInt8,
  `FlashMajor` UInt8,
  `FlashMinor` UInt8,
  `FlashMinor2` String,
  `NetMajor` UInt8,
  `NetMinor` UInt8,
  `UserAgentMajor` UInt16,
  `UserAgentMinor` FixedString(2),
  `CookieEnable` UInt8,
  `JavascriptEnable` UInt8,
  `IsMobile` UInt8,
  `MobilePhone` UInt8,
  `MobilePhoneModel` String,
  `Params` String,
  `IPNetworkID` UInt32,
  `TraficSourceID` Int8,
  `SearchEngineID` UInt16,
  `SearchPhrase` String,
  `AdvEngineID` UInt8,
  `IsArtifical` UInt8,
  `WindowClientWidth` UInt16,
  `WindowClientHeight` UInt16,
  `ClientTimeZone` Int16,
  `ClientEventTime` DateTime,
  `SilverlightVersion1` UInt8,
  `SilverlightVersion2` UInt8,
  `SilverlightVersion3` UInt32,
  `SilverlightVersion4` UInt16,
  `PageCharset` String,
  `CodeVersion` UInt32,
  `IsLink` UInt8,
  `IsDownload` UInt8,
  `IsNotBounce` UInt8,
  `FUniqID` UInt64,
  `HID` UInt32,
  `IsOldCounter` UInt8,
  `IsEvent` UInt8,
  `IsParameter` UInt8,
  `DontCountHits` UInt8,
  `WithHash` UInt8,
  `HitColor` FixedString(1),
  `UTCEventTime` DateTime,
  `Age` UInt8,
  `Sex` UInt8,
  `Income` UInt8,
  `Interests` UInt16,
  `Robotness` UInt8,
  `GeneralInterests` Array(UInt16),
  `RemoteIP` UInt32,
  `RemoteIP6` FixedString(16),
  `WindowName` Int32,
  `OpenerName` Int32,
  `HistoryLength` Int16,
  `BrowserLanguage` FixedString(2),
  `BrowserCountry` FixedString(2),
  `SocialNetwork` String,
  `SocialAction` String,
  `HTTPError` UInt16,
  `SendTiming` Int32,
  `DNSTiming` Int32,
  `ConnectTiming` Int32,
  `ResponseStartTiming` Int32,
  `ResponseEndTiming` Int32,
  `FetchTiming` Int32,
  `RedirectTiming` Int32,
  `DOMInteractiveTiming` Int32,
  `DOMContentLoadedTiming` Int32,
  `DOMCompleteTiming` Int32,
  `LoadEventStartTiming` Int32,
  `LoadEventEndTiming` Int32,
  `NSToDOMContentLoadedTiming` Int32,
  `FirstPaintTiming` Int32,
  `RedirectCount` Int8,
  `SocialSourceNetworkID` UInt8,
  `SocialSourcePage` String,
  `ParamPrice` Int64,
  `ParamOrderID` String,
  `ParamCurrency` FixedString(3),
  `ParamCurrencyID` UInt16,
  `GoalsReached` Array(UInt32),
  `OpenstatServiceName` String,
  `OpenstatCampaignID` String,
  `OpenstatAdID` String,
  `OpenstatSourceID` String,
  `UTMSource` String,
  `UTMMedium` String,
  `UTMCampaign` String,
  `UTMContent` String,
  `UTMTerm` String,
  `FromTag` String,
  `HasGCLID` UInt8,
  `RefererHash` UInt64,
  `URLHash` UInt64,
  `CLID` UInt32,
  `YCLID` UInt64,
  `ShareService` String,
  `ShareURL` String,
  `ShareTitle` String,
  `ParsedParams` Nested(
  Key1 String,
  Key2 String,
  Key3 String,
  Key4 String,
  Key5 String,
  ValueDouble Float64),
  `IslandID` FixedString(16),
  `RequestNum` UInt32,
  `RequestTry` UInt8
 )
 ENGINE=ReplicatedMergeTree('/clickhouse/{cluster01}/{shard02}/tables/hits', '{replica02}')
 PARTITION BY toYYYYMM(EventDate)
 ORDER BY (CounterID, EventDate, intHash32(UserID))
 SAMPLE BY intHash32(UserID);
 
```

На второй ноде аналогично - те же поля я пропускаю:```null

 CREATE TABLE dwh02.hits_shard
 ...
 ENGINE=ReplicatedMergeTree('/clickhouse/{cluster01}/{shard01}/tables/hits', '{replica01}')
 PARTITION BY toYYYYMM(EventDate)
 ORDER BY (CounterID, EventDate, intHash32(UserID))
 SAMPLE BY intHash32(UserID);
 
 CREATE TABLE dwh01.hits_shard
 ...
 ENGINE=ReplicatedMergeTree('/clickhouse/{cluster01}/{shard02}/tables/hits', '{replica02}')
 PARTITION BY toYYYYMM(EventDate)
 ORDER BY (CounterID, EventDate, intHash32(UserID))
 SAMPLE BY intHash32(UserID);
 
```

На третьей ноде :```null

 CREATE TABLE dwh03.hits_shard
 ...
 ENGINE=ReplicatedMergeTree('/clickhouse/{cluster01}/{shard01}/tables/hits', '{replica01}')
 PARTITION BY toYYYYMM(EventDate)
 ORDER BY (CounterID, EventDate, intHash32(UserID))
 SAMPLE BY intHash32(UserID);
 
 CREATE TABLE dwh02.hits_shard
 ...
 ENGINE=ReplicatedMergeTree('/clickhouse/{cluster01}/{shard02}/tables/hits', '{replica02}')
 PARTITION BY toYYYYMM(EventDate)
 ORDER BY (CounterID, EventDate, intHash32(UserID))
 SAMPLE BY intHash32(UserID);
 
```

7\. На всех нодах создаем распределенную таблицу```null

 CREATE TABLE dwh.hits_distributed
 (
  `WatchID` UInt64,
  `JavaEnable` UInt8,
  `Title` String,
  `GoodEvent` Int16,
  `EventTime` DateTime,
  `EventDate` Date,
  `CounterID` UInt32,
  `ClientIP` UInt32,
  `ClientIP6` FixedString(16),
  `RegionID` UInt32,
  `UserID` UInt64,
  `CounterClass` Int8,
  `OS` UInt8,
  `UserAgent` UInt8,
  `URL` String,
  `Referer` String,
  `URLDomain` String,
  `RefererDomain` String,
  `Refresh` UInt8,
  `IsRobot` UInt8,
  `RefererCategories` Array(UInt16),
  `URLCategories` Array(UInt16),
  `URLRegions` Array(UInt32),
  `RefererRegions` Array(UInt32),
  `ResolutionWidth` UInt16,
  `ResolutionHeight` UInt16,
  `ResolutionDepth` UInt8,
  `FlashMajor` UInt8,
  `FlashMinor` UInt8,
  `FlashMinor2` String,
  `NetMajor` UInt8,
  `NetMinor` UInt8,
  `UserAgentMajor` UInt16,
  `UserAgentMinor` FixedString(2),
  `CookieEnable` UInt8,
  `JavascriptEnable` UInt8,
  `IsMobile` UInt8,
  `MobilePhone` UInt8,
  `MobilePhoneModel` String,
  `Params` String,
  `IPNetworkID` UInt32,
  `TraficSourceID` Int8,
  `SearchEngineID` UInt16,
  `SearchPhrase` String,
  `AdvEngineID` UInt8,
  `IsArtifical` UInt8,
  `WindowClientWidth` UInt16,
  `WindowClientHeight` UInt16,
  `ClientTimeZone` Int16,
  `ClientEventTime` DateTime,
  `SilverlightVersion1` UInt8,
  `SilverlightVersion2` UInt8,
  `SilverlightVersion3` UInt32,
  `SilverlightVersion4` UInt16,
  `PageCharset` String,
  `CodeVersion` UInt32,
  `IsLink` UInt8,
  `IsDownload` UInt8,
  `IsNotBounce` UInt8,
  `FUniqID` UInt64,
  `HID` UInt32,
  `IsOldCounter` UInt8,
  `IsEvent` UInt8,
  `IsParameter` UInt8,
  `DontCountHits` UInt8,
  `WithHash` UInt8,
  `HitColor` FixedString(1),
  `UTCEventTime` DateTime,
  `Age` UInt8,
  `Sex` UInt8,
  `Income` UInt8,
  `Interests` UInt16,
  `Robotness` UInt8,
  `GeneralInterests` Array(UInt16),
  `RemoteIP` UInt32,
  `RemoteIP6` FixedString(16),
  `WindowName` Int32,
  `OpenerName` Int32,
  `HistoryLength` Int16,
  `BrowserLanguage` FixedString(2),
  `BrowserCountry` FixedString(2),
  `SocialNetwork` String,
  `SocialAction` String,
  `HTTPError` UInt16,
  `SendTiming` Int32,
  `DNSTiming` Int32,
  `ConnectTiming` Int32,
  `ResponseStartTiming` Int32,
  `ResponseEndTiming` Int32,
  `FetchTiming` Int32,
  `RedirectTiming` Int32,
  `DOMInteractiveTiming` Int32,
  `DOMContentLoadedTiming` Int32,
  `DOMCompleteTiming` Int32,
  `LoadEventStartTiming` Int32,
  `LoadEventEndTiming` Int32,
  `NSToDOMContentLoadedTiming` Int32,
   `FirstPaintTiming` Int32,
  `RedirectCount` Int8,
  `SocialSourceNetworkID` UInt8,
  `SocialSourcePage` String,
  `ParamPrice` Int64,
  `ParamOrderID` String,
  `ParamCurrency` FixedString(3),
  `ParamCurrencyID` UInt16,
  `GoalsReached` Array(UInt32),
  `OpenstatServiceName` String,
  `OpenstatCampaignID` String,
  `OpenstatAdID` String,
  `OpenstatSourceID` String,
  `UTMSource` String,
  `UTMMedium` String,
  `UTMCampaign` String,
  `UTMContent` String,
  `UTMTerm` String,
  `FromTag` String,
  `HasGCLID` UInt8,
  `RefererHash` UInt64,
  `URLHash` UInt64,
  `CLID` UInt32,
  `YCLID` UInt64,
  `ShareService` String,
  `ShareURL` String,
  `ShareTitle` String,
  `ParsedParams.Key1` Array(String),
  `ParsedParams.Key2` Array(String),
  `ParsedParams.Key3` Array(String),
  `ParsedParams.Key4` Array(String),
  `ParsedParams.Key5` Array(String),
  `ParsedParams.ValueDouble` Array(Float64),
  `IslandID` FixedString(16),
  `RequestNum` UInt32,
  `RequestTry` UInt8
 )
 ENGINE = Distributed('test', '', 'hits_shard', rand());
 
```

В команде мы задаем название кластера - test - и имя таблицы - hits\_shard.  
Здесь мы задали параметр - rand() - при этом данные - примерно - равномерно - и случайным образом - "расползутся"" по трем базам. Никто не запрещает вместо rand() указать какой-то столбец или набор столбцов, при этом данные лягут в порядке сортировки по указанному полю.

8\. Загружаем данные из csv файла - всего в нем 100000 записей:  
Данные можно взять [тут](http://iakovlev.org/zip/clickhouse.zip):

```null

 clickhouse-client --query " INSERT INTO dwh.hits_distributed FORMAT TSV" --max_insert_block_size=100000 < out.csv
 
```

9\. Выполняем на каждой ноде запрос. Он должен дать везде 100000 записей - ровно столько лежит в файле csv.```null

 select count(*) from dwh.hits_distributed;
 
```

10\. Выполняем запросы: На первой ноде```null

 select count(*) from dwh01.hits_shard;
 select count(*) from dwh03.hits_shard;
 
```

На второй ноде```null

 select count(*) from dwh01.hits_shard;
 select count(*) from dwh02.hits_shard;
 
```

На третьей ноде:```null

 select count(*) from dwh02.hits_shard;
 select count(*) from dwh03.hits_shard;
 
```

У вас могут быть другие цифры, но в сумме они должны дать 100000. Физически записи распределяются по разным базам. В таблице данные хранятся в отсортированном виде по синтетическому ключу: CounterID + EventDate + intHash32(UserID)  
Если мы выполним этот же селект на реплике, то получим ровно такой же результат - т.е. это полноценные реплики. Аналогичную картину мы получим для dwh02 и dwh03.  
Т.е. мы видим, что загруженный набор из 100000 записей:  
1\. Разбился на 3 части и случайным образом распределился по 3-м базам  
2\. У каждой базы тут же появилась своя реплика в виде полной копии на соседней ноде - это важно, потому что в случае краха какого-то хоста всегда есть реплика на другом хосте.
| Оставьте свой комментарий ! |
| --- |
|   

| ![](http://iakovlev.org/images/1.gif)
 |
| Ваше имя: |

| Комментарий: |

| Оба поля являются обязательными |

  
|  Автор  |  Комментарий к данной статье |
| --- | --- | |