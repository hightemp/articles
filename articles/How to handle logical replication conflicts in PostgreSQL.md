# How to handle logical replication conflicts in PostgreSQL
![](https://www.postgresql.fastware.com/hubfs/Images/Blogs/img-blog-curtain-author-takamichi-osumi-orange-to-yellow.png)

While physical replication copies whole clusters and accepts read-only queries on the standby if required, logical replication gives more fine-grained and flexible control over data replication.

Logical replication is a method of selective data replication. While physical replication copies whole clusters and accepts read-only queries on the standby if required[1](#anchor-references), logical replication gives more fine-grained and flexible control over data replication. Some of the capabilities available in logical replication are:

In logical replication, data is applied on the subscriber by subscription worker process, which operates in a similar way to conduct DML operations on the node. So, if new incoming data violates any constraints on the subscriber, the replication stops with error.

This is referred to as conflict[2](#anchor-references), and requires manual intervention from the user so that it can proceed.

In PostgreSQL 15, the PostgreSQL community is introducing improvements and new features useful to tackle logical replication conflicts. I’ll describe these improvements and how you can apply them to handle conflicts.

In this post, the resolution is achieved by skipping the transaction that conflicts with existing data. Regarding the auto-disabling feature (disable\_on\_error option) described in this post, I also worked as one of the developers in the community. The figure below illustrates how a conflict may happen during apply.

Disclaimer: In this post I’ve used the development version of PostgreSQL, and the community can either decide to change its design or completely revert those.

The community has been working really hard to make sure that Postgres provides a reliable, efficient, and easy measure in terms of logical replication. Part of this effort are the commit of the features and improvements below:![](https://www.postgresql.fastware.com/hs-fs/hubfs/Images/Diagrams/img-dgm-logical-replication-conflict.png?width=400&name=img-dgm-logical-replication-conflict.png)

We have checked each enhancement for this theme. So, in this section, I’ll emulate one conflict scenario. Keep in mind that skipping a transaction by calling pg\_replication\_origin\_advance is just one of the resolutions that users can choose, users can also change data or permissions on the subscriber to solve the conflict.

1 On the publisher side, create a table and a publication.

postgres=# CREATE TABLE tab (id integer);  
CREATE TABLE  
postgres=# INSERT INTO tab VALUES (5);  
INSERT 0 1  
postgres=# CREATE PUBLICATION mypub FOR TABLE tab;  
CREATE PUBLICATION

We now have one record for initial table synchronization.

2 On the subscriber side, create a table with a unique constraint and a subscription.

postgres=# CREATE TABLE tab (id integer UNIQUE);  
CREATE TABLE  
postgres=# CREATE SUBSCRIPTION mysub CONNECTION '…' PUBLICATION mypub WITH (disable\_on\_error = true);  
NOTICE: created replication slot "mysub" on publisher  
CREATE SUBSCRIPTION

We have now created a subscription with the disable\_on\_error option enabled. At the same time, this definition causes the initial table synchronization in the background, which will succeed without any issues.

3 On the publisher side, execute three transactions in succession after the table synchronization.

postgres=# BEGIN; -- Txn1  
BEGIN  
postgres=\*# INSERT INTO tab VALUES (1);  
INSERT 0 1  
postgres=\*# COMMIT;  
COMMIT  
postgres=# BEGIN; -- Txn2  
BEGIN  
postgres=\*# INSERT INTO tab VALUES (generate\_series(2, 4));  
INSERT 0 3  
postgres=\*# INSERT INTO tab VALUES (5);  
INSERT 0 1  
postgres=\*# INSERT INTO tab VALUES (generate\_series(6, 8));  
INSERT 0 3  
postgres=\*# COMMIT;  
COMMIT  
postgres=# BEGIN; -- Txn3  
BEGIN  
postgres=\*# INSERT INTO tab VALUES (9);  
INSERT 0 1  
postgres=\*# COMMIT;  
COMMIT  
postgres=# SELECT \* FROM tab;  
id  
\----  
5  
1  
2  
3  
4  
5  
6  
7  
8  
9  
(10 rows)

Txn1 can be replayed successfully. But the second statement of Txn2 (highlighted in blue above) includes a duplicated value same as the table synchronization (also highlighted in blue in the first command section). On the subscriber, this violates the unique constraint on the table. Therefore, it will cause a conflict and disable the subscription. As a result, the subscription will stop here. Txn3 won’t be replayed until the conflict is addressed, as per the steps below.

4 On the subscriber side, check the current replication status.

postgres=# SELECT \* FROM pg\_stat\_subscription\_stats;  
subid | subname | apply\_error\_count | sync\_error\_count | stats\_reset  
\-------+---------+-------------------+------------------+-------------  
16389 | mysub | 1 | 0 |  
(1 row)postgres=# SELECT oid, subname, subenabled, subdisableonerr FROM pg\_subscription;  
oid | subname | subenabled | subdisableonerr  
\-------+---------+------------+-----------------  
16389 | mysub |

f

| t  
(1 row)postgres=# SELECT \* FROM tab;  
id  
\----  
5  
1  
(2 rows)

Before skipping a transaction, we’ll have a look at the current status.

There was no failure during initial table synchronization, but there was one during apply phase. That is what pg\_stat\_subscription\_stats shows so far. Furthermore, since we created the subscription with the disable\_on\_error option set to true, the subscription mysub has been disabled due to the failure. The table tab has the data replicated up to Txn1, which we have successfully replayed.

5 On the subscriber side, check the error message of this conflict and the log message of the disable\_on\_error option.

ERROR: duplicate key value violates unique constraint "tab\_id\_key"  
DETAIL: Key (id)=(5) already exists.  
rocessing remote data for replication origin "pg\_16389" during "INSERT"  
for replication target relation "public.tab" in transaction 730 finished at 0/1566D10  
LOG: logical replication subscription "mysub" has been disabled due to an error

Above we can see the replication origin name and the LSN that indicates commit\_lsn. I’ll utilize those to skip Txn2 as below.

6 On the subscriber side, execute pg\_replication\_origin\_advance and then enable the subscription.

postgres=# SELECT pg\_replication\_origin\_advance('

pg\_16389

', '

0/1566D11

'::pg\_lsn);  
pg\_replication\_origin\_advance  
\-------------------------------(1 row)postgres=# ALTER SUBSCRIPTION mysub ENABLE;  
ALTER SUBSCRIPTIONpostgres=# SELECT \* FROM tab;  
id  
\----  
5  
1 

9

(3 rows)

After making the origin advance, I enabled the subscription to re-activate it - immediately, we can see the replicated data for Txn3.

Here, note that some other data irrelevant to the direct cause of the conflict in Txn2, regardless of the timing within the same transaction (remember, we performed other inserts in Txn2, highlighted in red), was not replicated - the whole transaction Txn2 was skipped.

The sequence of events here is as follows:

*   We used pg\_replication\_origin\_advance and enabled the subscription.
*   Enabling the subscription launched the apply worker and it sent the LSN passed via pg\_replication\_origin\_advance to the walsender process on the publisher.
*   This walsender process evaluated whether transaction Txn2 should be sent or skipped at decoding commit, by comparing the related LSNs.
*   The walsender concluded that transaction Txn2 should be skipped.

Lastly, I emphasize we must pay attention to pass an appropriate LSN to pg\_replication\_origin\_advance. Although the possibility is becoming quite low because of the new community’s improvements described in this blog, it can easily skip other transactions unrelated to the conflict if it’s misused.

### What can go wrong if I specify the wrong parameters?

![](https://www.postgresql.fastware.com/hubfs/Images/Illustrations/ill-man-using-laptop-06-variation-01.svg)
For reference, we provide an example of what would happen if we use pg\_replication\_origin\_advance incorrectly.

Below, I re-executed the above scenario with one more transaction Txn4 to insert 10 after Txn3. Then, as the argument of pg\_replication\_origin\_advance, I set a LSN bigger than that of Txn3’s commit record but smaller than that of Txn4’s commit record (retrieved by pg\_waldump[8](#anchor-references)). After I enabled the subscription, I got the replicated data without the value of Txn3.

Result on the subscriber side of using pg\_replication\_origin\_advance incorrectly is as follows.

postgres=# SELECT \* FROM tab;  
id  
\----  
5  
1  
 10  
(3 rows)

As shown above, we can never be too careful when manually intervening in the replication to solve conflicts.

On this point, the community has already introduced a different feature (ALTER SUBSCRIPTION SKIP) separately.  
This feature is one step ahead of pg\_replication\_origin\_advance in the aspect of handling  
logical replication conflicts. Please have a look at my [next post](https://www.postgresql.fastware.com/blog/addressing-replication-conflicts-using-alter-subscription-skip) that describes the detail.

### Wrapping up

As logical replication becomes more widely adopted in enterprises, the need for handling practical problems like conflicts becomes ever more important. For this reason, the improvements added to PostgreSQL are essential.

The PostgreSQL community has been hardening the database, and in this blog post I have described an easy way to handle logical replication conflicts. Still, we have to be careful to provide the correct information for the tool being used, in this case pg\_replication\_origin\_advance.

### If you would like to learn more

If you would like to read more about logical replication and its mechanics in PostgreSQL, I wrote the blog post [How to gain insight into the pg\_stat\_replication\_slots view by examining logical replication](https://www.postgresql.fastware.com/blog/how-to-gain-insight-into-the-pg-stat-replication-slots-view-by-examining-logical-replication). And my colleague Ajin Cherian wrote a blog post on [Logical decoding of two-phase commits in PostgreSQL 14](https://www.postgresql.fastware.com/blog/logical-decoding-of-two-phase-commits) in case you would like to learn more about logical decoding and how PostgreSQL performs it for two-phase commits.

* * *

#### References in this post:

Subscribe to be notified of future blog posts

If you would like to be notified of my next blog posts and other PostgreSQL-related articles, fill the form [here](#form-blog-subscription).

We also have a series of technical articles for PostgreSQL enthusiasts of all stripes, with tips and how-to's.

[Explore PostgreSQL Insider >](https://www.postgresql.fastware.com/cs/c/?cta_guid=d5749edc-b3d1-4261-8f28-27f72581c729&signature=AAH58kG8iDeBUxrkv3AZ-re_6v3Nebg_NA&portal_id=2585850&pageId=73942342036&placement_guid=a2bb4af2-87cc-4ede-8c72-0a394a2413b0&click=c3ec48fa-46fa-49c0-88d4-02bc96a57145&redirect_url=APefjpGkd579UQ7YjPZbFyYNSPZl5nVfXr4W6fuMxMv9mBZ-HzDwTysgmoLH5d6q1L6nUFH-0K9hfKFRHCwB7dgaE4JhXeO9O3XK33C_XwJTVZZm440xh07s1frf-XSeoi0u18TuUz0yqNPLagppKm0_VKnJfdiiaw&hsutk=3ee6e1996ccf006d1e2822abf6565104&canon=https%3A%2F%2Fwww.postgresql.fastware.com%2Fblog%2Fhow-to-handle-logical-replication-conflicts-in-postgresql&ts=1740053465849&__hstc=96896000.3ee6e1996ccf006d1e2822abf6565104.1740053466620.1740053466620.1740053466620.1&__hssc=96896000.1.1740053466620&__hsfp=3432840748&contentType=blog-post "Explore PostgreSQL Insider >")