# PostgreSQL Primary Key Dilemma: UUID vs. BIGINT | by Sanjeev Singh | Medium
**PostgreSQL Primary Key Dilemma: UUID vs. BIGINT**

**Introduction**

PostgreSQL, a robust open-source relational database management system, is known for its reliability, performance, and replication capabilities. However, developers often grapple with the choice of primary keys, which can significantly impact database performance. In this blog, I will try to address some common PostgreSQL challenges and offer comprehensive solutions to optimize your database.

**Problem Statement 1:** _Slower INSERT Performance with Random UUIDs_

One frequent issue we encounter in PostgreSQL is slower INSERT performance when using random UUIDs as primary keys. Random UUIDs are 128-bit values and are slower to generate than integers. The problem arises because random UUIDs are evenly distributed across their vast value range. Consequently, inserting data into indexes using these UUIDs results in poor data locality.

**Solution 1:** _Optimize UUID Generation and Data Locality_

To overcome slower INSERT performance with random UUIDs, you can optimize UUID generation and improve data locality by using sequential UUIDs. PostgreSQL provides the `uuid-ossp` extension, which includes the `uuid_generate_v1mc()` function for generating version 1 UUIDs with a time-based component.It generates UUIDs that are time-based and have a component that is based on the current time, which can be advantageous in certain scenarios.

Here’s how you can create a table with a primary key that uses sequential UUIDs:

> CREATE EXTENSION IF NOT EXISTS “uuid-ossp”;
> 
> — Create a table with sequential UUID primary key  
> CREATE TABLE your\_table (  
> id UUID DEFAULT uuid\_generate\_v1mc() PRIMARY KEY,  
> — Other columns…  
> );

By utilizing the `uuid_generate_v1mc()` function as the default value for the UUID column, you ensure that UUIDs are generated in a way that enhances INSERT performance through improved data locality.

**Problem Statement 2:** Storage Space Impact of UUIDs

Another concern with UUIDs is their larger storage size compared to integers. UUIDs consume 128 bits, whereas integers are typically 32 or 64 bits. This increased storage requirement can lead to higher disk I/O and potentially slower query performance.

**Solution 2:** Consider Using BIGINT as an Alternative

If storage efficiency is a priority, contemplate employing BIGINT as the primary key data type instead of UUID. BIGINT is a 64-bit integer capable of accommodating a wide range of values. Transitioning to BIGINT can help reduce disk I/O demands, resulting in improved overall query performance.

**Problem Statement 3:** Index Selection

**Solution 3:** _Choose the Right Index Type for UUID and BIGINT Primary Keys_

When dealing with UUID and BIGINT primary keys, choosing the right index type is critical. If your primary key typically consists of a single key column and your queries involve range queries on that key, a B-Tree index is often the most suitable choice. Here’s why a B-Tree index is an excellent fit for primary keys with range queries:

1.  Efficient Range Queries: B-Tree indexes are designed to handle range queries efficiently. They enable operations like greater than (>) and less than (<) comparisons with excellent performance.
2.  Balanced Structure: B-Tree indexes maintain a balanced tree structure, ensuring that queries remain performant even as the dataset grows.
3.  Suitable for Single Columns: B-Tree indexes are well-suited for indexing single columns, aligning with the typical structure of primary keys.
4.  Support for Equality Queries: B-Tree indexes also work efficiently for equality queries (e.g., `WHERE key = 'some_value'`).

While other index types like GiST and BRIN can be beneficial for certain scenarios, they are not commonly used as primary key indexes, especially when dealing with range queries. GiST and BRIN indexes are better suited for specific data types and access patterns, as mentioned in the previous response.

**Conclusion**

PostgreSQL, known for its versatility, is a powerful open-source relational database system. Developers frequently grapple with primary key challenges, including slow INSERT performance, storage limitations, and index selection. By implementing the strategies mentioned — using sequential UUIDs, exploring BIGINT, and making informed index choices — you can optimize your PostgreSQL database, ensuring great user experiences as your data scales.