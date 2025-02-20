# Maciej Walkowiak | PostgreSQL and UUID as primary key
**UUID**s are often used as database table **primary keys**. They are easy to generate, easy to share between distributed systems and guarantee uniqueness.

Considering the size of UUID it is questionable if it is a right choice, but often it is not up to us to decide.

This article does not focus on "_if UUID is the right format for a key_", but how to use **UUID** as a primary key with **PostgreSQL** efficiently.

* * *

Postgres Data Types for UUID[](#postgres-data-types-for-uuid)
-------------------------------------------------------------

UUID can be seen as a string and it may be tempting to store them as such. Postgres has a flexible data type for storing strings: `text` and it is often used as a primary key to store UUID values.

Is it a right data type? Definitely not.

Postgres has a dedicated data type for UUIDs: `uuid`. UUID is a 128 bit data type, so storing single value takes 16 bytes. `text`  data type has 1 or 4 bytes overhead plus storing the actual string.

These differences are not that important in small tables, but become an issue once you start storing hundreds of thousands or millions of rows.

I run an experiment to see what is the difference in practice. There are two tables that have just one column - an `id` as a primary key. First table uses `text`, second `uuid`:

sql

```
create  table  bank_transfer(
 id text  primary key
);
create  table  bank_transfer_uuid(
 id uuid primary key
);
```

I did not specify the type for primary key index, so Postgres uses the default one - **B-tree**.

Then I inserted `10 000 000` rows to each table using `batchUpdate` from Spring's `JdbcTemplate`:

java

```
jdbcTemplate.batchUpdate("insert into bank_transfer (id) values (?)",
 new  BatchPreparedStatementSetter() {
 @Override
 public  void setValues(PreparedStatement  ps, int  i)  throws  SQLException  {
 ps.setString(1, UUID.randomUUID().toString());
 }
  
 @Override
 public  int getBatchSize()  {
 return  10_000_000;
 }
});
```

java

```
jdbcTemplate.batchUpdate("insert into bank_transfer_uuid (id) values (?)",
 new  BatchPreparedStatementSetter() {
 @Override
 public  void setValues(PreparedStatement  ps, int  i)  throws  SQLException  {
 ps.setObject(1, UUID.randomUUID());
 }
 @Override
 public  int getBatchSize()  {
 return  10_000_000;
 }
 });
```

I run a query to find the table size and the index size:

sql

```
select 
 relname as  "table", 
 indexrelname as  "index",
 pg_size_pretty(pg_relation_size(relid)) "table size",
 pg_size_pretty(pg_relation_size(indexrelid)) "index size"
from 
 pg_stat_all_indexes
where 
 relname not  like  'pg%';
```

```
+------------------+-----------------------+----------+----------+
|table             |index                  |table size|index size|
+------------------+-----------------------+----------+----------+
|bank_transfer_uuid|bank_transfer_uuid_pkey|422 MB    |394 MB    |
|bank_transfer     |bank_transfer_pkey     |651 MB    |730 MB    |
+------------------+-----------------------+----------+----------+
```

Table that uses `text` is 54% larger and the index size 85% larger. This is also reflected in number of pages Postgres uses to store these tables and indexes:

sql

```
select relname, relpages from pg_class where relname like  'bank_transfer%';
```

```
+-----------------------+--------+
|relname                |relpages|
+-----------------------+--------+
|bank_transfer          |83334   |
|bank_transfer_pkey     |85498   |
|bank_transfer_uuid     |54055   |
|bank_transfer_uuid_pkey|50463   |
+-----------------------+--------+
```

Larger size of tables, indexes and bigger number of tables means that Postgres must perform work to insert new rows and fetch rows - especially once index sizes are larger than available RAM memory, and Postgres must load indexes from disk.

UUID and B-Tree index[](#uuid-and-b-tree-index)
-----------------------------------------------

Random UUIDs are not a good fit for a B-tree indexes - and B-tree index is the only available index type for a primary key.

B-tree indexes work the best with ordered values - like auto-incremented or time sorted columns.

UUID - even though always looks similar - comes in multiple variants. Java's `UUID.randomUUID()` - returns UUID v4 - which is a pseudo-random value. For us the more interesting one is UUID v7 - which produces time-sorted values. It means that each time new UUID v7 is generated, a greater value it has. And that makes it a good fit for B-Tree index.

To use UUID v7 in Java we need a 3rd party library like [java-uuid-generator](https://github.com/cowtowncoder/java-uuid-generator):

xml

```
<dependency>
 <groupId>com.fasterxml.uuid</groupId>
 <artifactId>java-uuid-generator</artifactId>
 <version>5.0.0</version>
</dependency>
```

Then we can generate UUID v7 with:

java

```
UUID uuid =  Generators.timeBasedEpochGenerator().generate();
```

This theoretically should improve the performance of executing `INSERT` statements.

How UUID v7 affects INSERT performance[](#how-uuid-v7-affects-insert-performance)
---------------------------------------------------------------------------------

I created another table, exactly the same as `bank_transfer_uuid` but it will store only UUID v7 generated using the library mentioned above:

sql

```
create  table  bank_transfer_uuid_v7(
 id uuid primary key
);
```

Then I run `10` rounds of inserting `10000` rows to each table and measured how long it takes:

java

```
for (int i =  1; i <=  10; i++) {
 measure(() ->  IntStream.rangeClosed(0, 10000).forEach(it -> {
 jdbcClient.sql("insert into bank_transfer (id) values (:id)")
 .param("id", UUID.randomUUID().toString())
 .update();
 }));
 measure(() ->  IntStream.rangeClosed(0, 10000).forEach(it -> {
 jdbcClient.sql("insert into bank_transfer_uuid (id) values (:id)")
 .param("id", UUID.randomUUID())
 .update();
 }));
 measure(() ->  IntStream.rangeClosed(0, 10000).forEach(it -> {
 jdbcClient.sql("insert into bank_transfer_uuid_v7 (id) values (:id)")
 .param("id", Generators.timeBasedEpochGenerator().generate())
 .update();
 }));
}
```

The results look a little random especially when comparing times for a table with regular `text` column and `uuid` v4:

```
+-------+-------+---------+
| text  | uuid  | uuid v7 |
+-------+-------+---------+
| 7428  | 8584  | 3398    |
| 5611  | 4966  | 3654    |
| 13849 | 10398 | 3771    |
| 6585  | 7624  | 3679    |
| 6131  | 5142  | 3861    |
| 6199  | 10336 | 3722    |
| 6764  | 6039  | 3644    |
| 9053  | 5515  | 3621    |
| 6134  | 5367  | 3706    |
| 11058 | 5551  | 3850    |
+-------+-------+---------+
```

**BUT** we can clearly see, that inserting UUID v7 is **~2x faster** and inserting regular UUID v4.

Further reading[](#further-reading)
-----------------------------------

*   [UUID v7 will likely be supported natively in Postgres 17](https://commitfest.postgresql.org/47/4388/)
*   [UUID Version 7 format](https://www.ietf.org/archive/id/draft-peabody-dispatch-new-uuid-format-04.html#name-uuid-version-7)
*   [UUIDs are Popular, but Bad for Performance](https://www.percona.com/blog/uuids-are-popular-but-bad-for-performance-lets-discuss/)
*   [https://vladmihalcea.com/uuid-database-primary-key/](https://vladmihalcea.com/uuid-database-primary-key/)

Summary[](#summary)
-------------------

As mentioned at the beginning - due to UUID length - even with all these optimizations, it is not the best type for a primary key. If you have an option to choose, take a look at [TSID](https://github.com/vladmihalcea/hypersistence-tsid) maintained by [Vlad Mihalcea](https://twitter.com/vlad_mihalcea).

But if you must or for some reason want to use UUIDs, take into account the optimizations I mentioned. Also keep in mind that such optimizations make a difference for large datasets. If you're storing hundreds or even few thousands of rows, and have a low traffic, you will likely not see any difference in the application performance. But if there's a chance you will have large dataset or big traffic - it is better to do it right from the beginning as changing primary keys can be quite a challenge.

At the end a disclarimer - I am not pretending to be a Postgres expert - I am rather sharing what I've learned.

As usual, I hope you found it useful! Feel free to drop a comment if you found any mistake or have a question. Also, feel free to reach out to me on [twitter.com/maciejwalkowiak](https://twitter.com/maciejwalkowiak).

Let's stay in touch and follow me on Twitter: [@maciejwalkowiak](https://twitter.com/maciejwalkowiak)

Subscribe to RSS feed ![](https://maciejwalkowiak.com/rss.png)