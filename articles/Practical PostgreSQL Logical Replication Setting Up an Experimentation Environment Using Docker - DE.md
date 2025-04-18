# Practical PostgreSQL Logical Replication: Setting Up an Experimentation Environment Using Docker - DEV Community
[](#introduction)Introduction
-----------------------------

In the world of database management, ensuring data consistency, availability, and scalability is paramount. Among the myriad strategies to achieve these goals, **logical replication** in PostgreSQL stands out as a powerful feature that allows data to be replicated to different systems in real-time. This not only enhances read performance across distributed databases but also serves as a cornerstone for disaster recovery and almost zero-downtime upgrades.

Logical replication works by replicating changes at the level of database transactions, providing the flexibility to select which databases, tables, or even rows get replicated. This granular control makes it an invaluable tool for creating highly available systems that can withstand the loss of a primary database or scale horizontally as demand increases. Although this fine-grain control can be useful for some complex scenarios, in this article, we will focus on a setup where all the database tables and rows will be replicated.

Setting up and experimenting with logical replication can seem daunting. This is where Docker comes into play. By containerizing PostgreSQL instances, Docker allows us to mimic complex, distributed database setups on a single machine, making this advanced feature more approachable for everyone.

In this article, we will embark on a hands-on journey to understand and implement PostgreSQL logical replication. We'll set up a master database and two replicas within a Dockerized environment, guiding you through the process of configuring logical replication, manipulating data, and observing how PostgreSQL handles data consistency and recovery in real-time. This exploration will not only clarify the process of setting up logical replication but also highlight its potential in real-world scenarios. For those interested in following along with code examples and configurations, the source code for this project is available on GitHub at [https://github.com/ietxaniz/pg-logrepl](https://github.com/ietxaniz/pg-logrepl).

[](#what-we-will-build)What We Will Build
-----------------------------------------

In this hands-on guide, we'll embark on a fascinating journey to set up a robust PostgreSQL logical replication environment using Docker. Our project is designed to simulate a real-world scenario where data consistency, availability, and scalability are key. Here's what we'll accomplish:

*   **Create Three PostgreSQL Instances**: Using Docker Compose, we will spin up three separate PostgreSQL instances. This setup will serve as the backbone of our replication environment, providing a practical insight into managing multiple databases in a contained ecosystem.
    
*   **Configure Logical Replication**: All instances will be configured to support logical replication. This involves setting one database as the master (publisher) and the other two as replicas (subscribers), establishing a real-time data synchronization framework.
    
*   **Schema Synchronization**: We'll ensure that all three databases start with the same schema, laying the foundation for seamless data replication across our setup.
    
*   **Data Manipulation and Replication**: Through a series of data manipulation exercises, we'll demonstrate how changes made to the master database are immediately reflected in the replica databases. This includes adding data and simulating a replica downtime.
    
*   **Failover and Recovery Scenarios**: We'll simulate a failover scenario by killing the master instance and promoting a replica to be the new master. This part of the project will highlight the resilience and flexibility of logical replication in handling unexpected database failures.
    
*   **Data Consistency Checks**: At various stages, we'll verify that data remains consistent across all instances, demonstrating the reliability of PostgreSQL's logical replication mechanism.
    
*   **Role Reversal and Recovery**: Finally, we'll bring the original master back online as a replica, completing our exploration of logical replication dynamics and ensuring all databases are synchronized.
    

Throughout this project, we will follow a sequence of steps designed to provide you with a comprehensive understanding of setting up and managing a logical replication system in PostgreSQL. By the end, you'll have hands-on experience with critical database administration tasks, including configuring replication, handling failovers, and ensuring data consistency across distributed systems.

For your convenience and to facilitate following along, all the code, configurations, and Docker Compose files used in this guide will be available in a GitHub repository. This will allow you to replicate the setup on your own machine and experiment further with PostgreSQL's logical replication features.

[](#working-environment)Working Environment
-------------------------------------------

The sole prerequisite for this tutorial is having **Docker installed** on your machine. This guide and accompanying scripts are tailored for Linux environments, providing a smooth experience for Linux users right out of the box. However, the beauty of Docker is its cross-platform compatibility. Therefore, if you're using **macOS** or **Windows with WSL (Windows Subsystem for Linux)**, you can still follow along without significant modifications. The versatility of Docker ensures that our setup can be replicated across different operating systems, making it accessible to a broader audience.

If Docker is not yet installed on your system, you can find detailed installation instructions on the [official Docker website](https://docs.docker.com/get-docker/). Ensure Docker is correctly installed and running before proceeding to the next steps of this guide.

The skills and knowledge you'll gain from this tutorial are not limited to experimental setups or learning environments. The principles of PostgreSQL logical replication, when combined with the power of Docker, have wide applicability in real-world scenarios, especially in **distributed environments across data centers**. Whether you're looking to enhance data availability, scale your read operations, or set up a robust disaster recovery system, the concepts covered here will provide a solid foundation.

While we focus on a contained Docker environment for simplicity, the underlying principles can be extrapolated to more complex setups, including instances running on separate nodes in a data center or even across multiple data centers. This makes our guide an invaluable resource for anyone looking to implement logical replication in production environments.

For the sake of simplicity and to keep our focus on the core concepts of logical replication, this guide will not cover the setup of encryption for data in transit between the master and replica databases. However, it's important to acknowledge that **encryption is a critical aspect of securing data** in production environments. In real-world applications, ensuring the security of data in transit using SSL/TLS or other encryption methods is essential to protect against eavesdropping and man-in-the-middle attacks.

While this tutorial does not delve into encryption configurations, you should explore PostgreSQL's documentation on [securing your database](https://www.postgresql.org/docs/current/ssl-tcp.html) and consider encryption as an integral part of setting up logical replication in a production environment.

[](#setting-up-the-system)Setting Up the System
-----------------------------------------------

### [](#docker-compose-setup)Docker Compose Setup

To kick off our exploration of PostgreSQL logical replication, we'll start by creating the backbone of our environment: the Docker Compose setup. This setup will include one master and two replica PostgreSQL instances, each running in separate Docker containers. What makes our setup particularly interesting is the use of different PostgreSQL versions for each instance. This approach not only tests the compatibility of logical replication across versions but also simulates a real-world use case for upgrading PostgreSQL instances with minimal downtime.

Below is the `docker-compose.yml` file that defines our PostgreSQL instances:  

```
services:
  master:
    image: postgres:16.1-alpine3.19
    container_name: logrepl_pg_master
    volumes:
      - logrepl_pg_master-data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    restart: unless-stopped
  replica1:
    image: postgres:15.5-alpine3.19
    container_name: logrepl_pg_replica1
    volumes:
      - logrepl_pg_replica1-data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    restart: unless-stopped
  replica2:
    image: postgres:14.10-alpine3.19
    container_name: logrepl_pg_replica2
    volumes:
      - logrepl_pg_replica2-data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    restart: unless-stopped
volumes:
  logrepl_pg_master-data:
    name: logrepl_pg_master-data
  logrepl_pg_replica1-data:
    name: logrepl_pg_replica1-data
  logrepl_pg_replica2-data:
    name: logrepl_pg_replica2-data 
```

Enter fullscreen mode Exit fullscreen mode

This configuration establishes a master database using PostgreSQL 16.1 and two replicas using versions 15.5 and 14.10, respectively. By employing Alpine Linux as the base image, we ensure our setup is lightweight and efficient. Each service is configured with its volume for data persistence, ensuring that data remains intact across container restarts.

To bring up the databases, create a file named `docker-compose.yml` with the content above. Then, in a shell window, execute the following command:  

```
docker compose up 
```

Enter fullscreen mode Exit fullscreen mode

This command will start the PostgreSQL instances as defined in the Docker Compose file. You'll see logs in the terminal indicating that the containers are up and running, ready for the next steps of schema creation and logical replication configuration.

Once our Docker containers are up and running, the next step is crucial: creating identical schemas across all instances. This consistency is vital for ensuring smooth replication from the master to the replicas. For our project, we'll be using a simple yet illustrative schema that includes users, posts, and comments—emulating a basic blogging platform. This schema not only demonstrates the relationships between different data types but also sets the stage for understanding how logical replication handles data synchronization.

### [](#project-schema)Project Schema

The schema for our project is defined as follows:  

```
-- Schema for Users
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
);

-- Schema for Posts
CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Schema for Comments
CREATE TABLE comments (
    comment_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
); 
```

Enter fullscreen mode Exit fullscreen mode

This schema sets up a relational structure where users can create posts, and both users and posts can have comments, mimicking a real-world application's data model.

### [](#schema-application-script)Schema Application Script

To simplify the schema application across our PostgreSQL instances, we've prepared a script named `create-schemas.sh`. This script automates the process of copying the `schema.sql` file to each container and executing it against the PostgreSQL service inside. Here's how the script works:  

```
#!/bin/bash
# Define the database containers
databases=("logrepl_pg_master" "logrepl_pg_replica1" "logrepl_pg_replica2")
schema_file="./schema.sql"

for db in "${databases[@]}"; do echo "Copying schema to $db..."
    docker cp "$schema_file" "$db:/tmp/schema.sql"

    echo "Loading schema in $db..."
    docker exec -i "$db" psql -U postgres -d postgres -f /tmp/schema.sql

    echo "Removing schema file from $db..."
    docker exec -i "$db" rm /tmp/schema.sql

    echo "Schema loaded successfully in $db!"
done 
```

Enter fullscreen mode Exit fullscreen mode

To execute this script, ensure it has execute permissions by running `chmod +x create-schemas.sh`, then execute it with `./create-schemas.sh`. The script will iterate over each defined database container, copy the schema file, execute it, and clean up, ensuring that each database instance is configured with the identical schema needed for our logical replication setup.

By maintaining schema consistency across the master and replica databases, we ensure that our logical replication process can proceed without any schema-related conflicts, providing a seamless data synchronization experience.

### [](#configuration-for-logical-replication)Configuration for Logical Replication

After setting up our PostgreSQL instances and ensuring they share identical schemas, the next crucial step is to configure them for logical replication. This process requires adjusting specific settings in the PostgreSQL configuration files to enable and optimize the replication process.

To streamline this configuration process, we've created a script named `configure-dbs.sh`. This script automates the adjustments necessary for all instances (master and replicas) to prepare them for logical replication. By configuring the same parameters across all databases, we not only prepare them for their current roles but also allow for the flexibility to change roles in the future, such as converting a replica into a master during failover scenarios or planned upgrades.

#### [](#key-configuration-changes)Key Configuration Changes

*   **`wal_level`**: Set to `logical` to support capturing and replicating changes at the transaction level, rather than at the physical block level.
*   **`max_replication_slots`**: Increased to accommodate the planned number of replicas, ensuring the master retains enough WAL logs for all replicas.
*   **`max_wal_senders`**: Raised to allow more concurrent WAL sender processes, facilitating efficient data streaming to replicas.
*   **Replication Permissions in `pg_hba.conf`**: Configured to grant necessary connection permissions for replication purposes.

#### [](#configuration-script)Configuration Script

```
#!/bin/bash
# Script to configure PostgreSQL instances for logical replication

max_number_of_replicas=4
max_wal_senders=8

# Define all PostgreSQL instances
databases=("logrepl_pg_master" "logrepl_pg_replica1" "logrepl_pg_replica2")

for db in "${databases[@]}"; do
    # Apply configuration changes
    ...
done

# Reminder to execute with caution, especially in production environments. 
```

Enter fullscreen mode Exit fullscreen mode

Before running `configure-dbs.sh`, ensure it's executable with `chmod +x configure-dbs.sh`. Execute the script to apply configuration changes across all instances. Designed for efficiency and safety, this script reduces complexity and minimizes the potential for configuration errors, setting the stage for a seamless replication process.

### [](#configure-replication)Configure Replication

After configuring our PostgreSQL instances for logical replication, the next step is to establish the replication relationship itself. This involves defining one database as the master (or publisher) and the others as replicas (or subscribers). We achieve this through the `configure-replication.sh` script, which automates the setup, ensuring changes made in the master database are seamlessly replicated to `logrepl_pg_replica1` and `logrepl_pg_replica2`.  

```
#!/bin/bash

# Define the master database and the replicas
master_db="logrepl_pg_master"
replicas=("logrepl_pg_replica1" "logrepl_pg_replica2")

# Configure the master database
echo "Configuring $master_db as master..."
docker exec -i "$master_db" psql -U postgres -d postgres -c "DROP PUBLICATION IF EXISTS my_publication;"
docker exec -i "$master_db" psql -U postgres -d postgres -c "CREATE PUBLICATION my_publication FOR ALL TABLES;"

# Configure each replica to follow the master
for replica in "${replicas[@]}"; do echo "Configuring $replica to replicate from $master_db..."

    # Construct the connection string
    conninfo="host=$master_db port=5432 user=postgres password=postgres dbname=postgres"

    # Configure the subscription on the replica
    docker exec -i "$replica" psql -U postgres -d postgres -c "DROP SUBSCRIPTION IF EXISTS ${replica}_subscription;"
    docker exec -i "$replica" psql -U postgres -d postgres -c "CREATE SUBSCRIPTION ${replica}_subscription CONNECTION 'dbname=postgres host=$master_db user=postgres password=postgres' PUBLICATION my_publication;"

    echo "$replica configured to replicate from $master_db."
done echo "Master and replicas configured successfully for logical replication." 
```

Enter fullscreen mode Exit fullscreen mode

The script starts by configuring `logrepl_pg_master` as the master database. It does so by dropping any existing publication named `my_publication` (to avoid conflicts) and then creating a new publication that includes all tables. This publication acts as the source of data changes that will be replicated to the subscribers. For each replica, the script creates a subscription to the master's publication. It first removes any existing subscription to avoid conflicts, then establishes a new subscription using the connection information to the master database. This subscription mechanism is what allows the replicas to receive and apply changes from the master.

#### [](#key-commands-explained)Key Commands Explained

*   `DROP PUBLICATION IF EXISTS my_publication;`: Ensures idempotency by removing the existing publication before creating a new one.
*   `CREATE PUBLICATION my_publication FOR ALL TABLES;`: Creates a new publication on the master that includes all tables, making them available for replication.
*   `DROP SUBSCRIPTION IF EXISTS ${replica}_subscription;`: Removes any existing subscription on the replica.
*   `CREATE SUBSCRIPTION ${replica}_subscription CONNECTION '...' PUBLICATION my_publication;`: Establishes a new subscription on each replica to the master's publication, enabling data replication.

[](#data-manipulation-and-replication-process)Data Manipulation and Replication Process
---------------------------------------------------------------------------------------

Now that we've set up our PostgreSQL logical replication environment, it's time to see it in action. We'll begin by demonstrating how data added to the master database is automatically replicated across all connected replicas. This real-time synchronization is the heart of logical replication, ensuring data consistency and availability across our distributed database system.

### [](#adding-data-to-the-master)Adding Data to the Master

Let's start by inserting a new user into the `users` table on the master database. We'll execute the following command in a shell environment:  

```
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "INSERT INTO users (username, email) VALUES ('newuser', 'newuser@example.com');"
INSERT 0 1 
```

Enter fullscreen mode Exit fullscreen mode

This command inserts a new row with the username `newuser` and the email `newuser@example.com` into the `users` table. The `INSERT 0 1` response indicates that the operation was successful and one row was added.

### [](#verifying-replication-on-the-replicas)Verifying Replication on the Replicas

Next, we'll verify that this new row has been replicated to both replicas. To do this, we'll query the `users` table on each replica:  

```
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email        |         created_at         
---------+----------+---------------------+----------------------------
       1 | newuser  | newuser@example.com | 2024-02-11 10:08:08.116556
(1 row)

$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email        |         created_at         
---------+----------+---------------------+----------------------------
       1 | newuser  | newuser@example.com | 2024-02-11 10:08:08.116556
(1 row) 
```

Enter fullscreen mode Exit fullscreen mode

As we can observe, the `users` table on both `logrepl_pg_replica1` and `logrepl_pg_replica2` instances reflects the data we inserted into the master database. This immediate synchronization showcases the efficiency and reliability of PostgreSQL's logical replication.

### [](#switching-off-one-of-the-replicas)Switching Off One of the Replicas

To further test the resilience of our logical replication setup, let's simulate a scenario where one of the replicas (`logrepl_pg_replica2`) goes offline. This step will help us understand how PostgreSQL handles replication when a subscriber is temporarily unavailable.

First, we'll stop the `logrepl_pg_replica2` container:  

```
$ docker stop logrepl_pg_replica2
logrepl_pg_replica2 
```

Enter fullscreen mode Exit fullscreen mode

With `logrepl_pg_replica2` offline, let's insert a new user into the `users` table on the master database:  

```
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "INSERT INTO users (username, email) VALUES ('newuser2', 'newuser2@example.com');"
INSERT 0 1 
```

Enter fullscreen mode Exit fullscreen mode

Now, let's verify that this new data is replicated to `logrepl_pg_replica1`, which is still online:  

```
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
(2 rows) 
```

Enter fullscreen mode Exit fullscreen mode

As expected, `logrepl_pg_replica1` has successfully received and applied the new data. However, since `logrepl_pg_replica2` is offline, it won't have this latest update. Attempting to query `logrepl_pg_replica2` results in an error, as the container is not running:  

```
$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
Error response from daemon: container 70cb8a4ff8f10ac047cbfd6b531b23cf88fe4def0c4ef1521187027ee343f173 is not running 
```

Enter fullscreen mode Exit fullscreen mode

This step effectively demonstrates the robustness of our logical replication setup in handling scenarios where a replica may become temporarily unavailable. Next, we'll explore how PostgreSQL catches up the offline replica once it's back online, ensuring data consistency across the entire replication system.

### [](#switching-on-replica2)Switching On Replica2

After demonstrating the behavior of our logical replication setup with one replica offline, let's proceed to bring `logrepl_pg_replica2` back online. This step is crucial to observe how PostgreSQL handles the synchronization process for replicas that were temporarily unavailable and ensures they catch up with the master's current state.

To restart `logrepl_pg_replica2`, we simply use the Docker command to start the container:  

```
$ docker start logrepl_pg_replica2
logrepl_pg_replica2 
```

Enter fullscreen mode Exit fullscreen mode

After giving it a moment to initialize and reestablish its connection to the master, we then check the `users` table to confirm that `logrepl_pg_replica2` has successfully synchronized and now contains the same data as the master and the other replica:  

```
$ sleep 2
$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
(2 rows) 
```

Enter fullscreen mode Exit fullscreen mode

As the output shows, `logrepl_pg_replica2` automatically updated its data to reflect the current state of the master database upon reconnection. This behavior underscores the powerful automatic recovery and synchronization capabilities of PostgreSQL's logical replication mechanism. Without any manual intervention, the replica was able to catch up with the changes it missed while offline, ensuring data consistency across our distributed database system.

### [](#adding-more-users-in-the-new-state)Adding More Users in the New State

With our replication setup now fully operational and having demonstrated its resilience to replica downtime, we proceed to test the continuous synchronization capabilities by adding another user to the master database. This step will help us verify that all databases, including the previously offline replica, are correctly synchronized in real time.

We add a new user, `newuser3`, to the `users` table on the master database and confirm the insertion was successful:  

```
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "INSERT INTO users (username, email) VALUES ('newuser3', 'newuser3@example.com');"
INSERT 0 1 
```

Enter fullscreen mode Exit fullscreen mode

Next, we ensure that this new data is accurately reflected across both replicas, in addition to the master, by querying the `users` table on each database:  

```
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
(3 rows)

$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
(3 rows)

$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
(3 rows) 
```

Enter fullscreen mode Exit fullscreen mode

As the output indicates, `newuser3` is now present in the `users` table across all instances (`logrepl_pg_master`, `logrepl_pg_replica1`, and `logrepl_pg_replica2`), demonstrating that the logical replication system efficiently synchronizes data in real-time across the entire distributed environment.

This exercise confirms the robustness and reliability of our PostgreSQL logical replication setup. It showcases not only the system's ability to handle disruptions but also its capability to maintain data consistency and availability seamlessly across multiple database instances, ensuring that each part of our system is always up-to-date with the latest data.

### [](#switching-of-master-and-making-replica1-new-master)Switching of Master and Making Replica1 New Master

In real-world scenarios, it's essential to prepare for situations where the master database might go down or need to be taken offline for maintenance. In such cases, promoting one of the replicas to be the new master ensures continuity of operations and data availability. Our next sequence of steps demonstrates how to handle this transition smoothly, using `step07.sh` to automate the process.  

```
#!/bin/bash

# Define the services
new_master="logrepl_pg_replica1"
remaining_replica="logrepl_pg_replica2"

# Stop the old master
echo "Stopping the old master: $old_master..."
docker stop "$old_master"

# Wait for a second to ensure the stop command fully processes
sleep 1

# Disable subscriptions on replica1 and replica2 without dropping them
echo "Disabling subscriptions on $new_master and $remaining_replica..."
docker exec -i "$new_master" psql -U postgres -d postgres -c "ALTER SUBSCRIPTION ${new_master}_subscription DISABLE; ALTER SUBSCRIPTION ${new_master}_subscription SET (slot_name = NONE);"
docker exec -i "$remaining_replica" psql -U postgres -d postgres -c "ALTER SUBSCRIPTION ${remaining_replica}_subscription DISABLE; ALTER SUBSCRIPTION ${remaining_replica}_subscription SET (slot_name = NONE);"

# update postgresql secuences on the new master to be
docker exec -i "$new_master" psql -U postgres -d postgres -c "SELECT setval('users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM users), 0) + 1, false);"
docker exec -i "$new_master" psql -U postgres -d postgres -c "SELECT setval('posts_post_id_seq', COALESCE((SELECT MAX(post_id) FROM posts), 0) + 1, false);"
docker exec -i "$new_master" psql -U postgres -d postgres -c "SELECT setval('comments_comment_id_seq', COALESCE((SELECT MAX(comment_id) FROM comments), 0) + 1, false);"

# Ensure replica2 starts with a clean state
echo "Resetting data on $remaining_replica to prepare for replication..."
docker exec -i "$remaining_replica" psql -U postgres -d postgres -c "TRUNCATE TABLE users, posts, comments RESTART IDENTITY CASCADE;"

# Continue with the creation of the new publication and subscription as before
echo "Creating new publication on $new_master..."
docker exec -i "$new_master" psql -U postgres -d postgres -c "CREATE PUBLICATION new_master_publication FOR ALL TABLES;"

echo "Configuring $remaining_replica to replicate from $new_master..."
docker exec -i "$remaining_replica" psql -U postgres -d postgres -c "CREATE SUBSCRIPTION replica2_new_subscription CONNECTION 'dbname=postgres host=$new_master user=postgres password=postgres' PUBLICATION new_master_publication;"

echo "Replication reconfiguration complete." 
```

Enter fullscreen mode Exit fullscreen mode

#### [](#key-steps-in-the-transition-process)Key Steps in the Transition Process

*   **Stopping the Old Master**: We begin by stopping the current master database to simulate its failure or planned downtime.
    
*   **Disabling Subscriptions**: Subscriptions on the replicas are temporarily disabled to prevent them from trying to replicate data from the now-offline master. This is a crucial step to avoid replication conflicts during the transition.
    
*   **Updating Sequences**: On the new master (logrepl\_pg\_replica1), we update the sequences for all tables to ensure that new records will have unique identifiers, avoiding conflicts with existing data.
    
*   **Resetting Data on the Remaining Replica**: To prepare logrepl\_pg\_replica2 for replication from the new master, we reset its data. This step is essential to ensure that it starts with a clean slate, eliminating the risk of id conflicts and data discrepancies.
    
*   **Reconfiguring Replication**: We create a new publication on the new master and configure the remaining replica to subscribe to this publication, effectively re-establishing the logical replication setup with logrepl\_pg\_replica1 now acting as the master.
    

After executing next sequence, we validate the replication setup by inserting a new user into the users table on the new master (`logrepl_pg_replica1`) and verifying that this change is replicated to `logrepl_pg_replica2`. The successful replication of this new record to both replicas confirms the correct reconfiguration of the logical replication setup.  

```
$$ docker stop logrepl_pg_master
logrepl_pg_master
$$ sleep 1
$$ ./step07.sh
Stopping the old master: ...
Error response from daemon: page not found
Disabling subscriptions on logrepl_pg_replica1 and logrepl_pg_replica2...
ALTER SUBSCRIPTION
ALTER SUBSCRIPTION
ALTER SUBSCRIPTION
 setval 
--------
      4
(1 row)

 setval 
--------
      1
(1 row)

 setval 
--------
      1
(1 row)

Resetting data on logrepl_pg_replica2 to prepare for replication...
TRUNCATE TABLE
Creating new publication on logrepl_pg_replica1...
CREATE PUBLICATION
Configuring logrepl_pg_replica2 to replicate from logrepl_pg_replica1...
NOTICE:  created replication slot "replica2_new_subscription" on publisher
CREATE SUBSCRIPTION
Replication reconfiguration complete.
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "INSERT INTO users (username, email) VALUES ('newuser4', 'newuser4@example.com');"
INSERT 0 1
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "SELECT * FROM users;"
Error response from daemon: container b85f8d95443abae3f898c4e28d3afc3e319730ade2a098e94cc7b0e646ee7ac8 is not running
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows)

$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows) 
```

Enter fullscreen mode Exit fullscreen mode

#### [](#considerations-and-potential-sources-of-failure)Considerations and Potential Sources of Failure

Before the master goes down, it's crucial to ensure that all replicas are fully synchronized. Any discrepancy between the data on logrepl\_pg\_replica1 and logrepl\_pg\_replica2 at the time of the switch can lead to inconsistencies, as the new master will begin replicating from its current state. Updating all sequences on the new master is vital to prevent conflicts caused by overlapping identifiers. This step ensures that new inserts on the new master will not conflict with existing data. The process of stopping the master should be controlled and synchronized with the replicas to minimize the risk of data inconsistency or loss.

By carefully following these steps and considerations, we can effectively manage the transition of the master role to a replica, maintaining data integrity and availability. This process highlights the flexibility and resilience of PostgreSQL's logical replication mechanism, allowing for robust database management strategies in distributed environments.

In failover scenarios ensuring that all replicas have same data is not so easy to manage, as some replicas could not be fully updated, so a carefull strategy should be choosen for this scenarios.

### [](#switching-the-master-back-on-challenges-and-solutions)Switching the Master Back On: Challenges and Solutions

#### [](#the-unexpected-challenge)The Unexpected Challenge

When attempting to reintegrate the original master (`logrepl_pg_master`) back into our replication setup as a subscriber, the process didn't proceed as smoothly as anticipated. Despite successfully configuring it to subscribe to `logrepl_pg_replica1` (the new master), data updates from the new master weren't replicated to the old master as expected. This issue underscored the complexities involved in reversing replication roles within a PostgreSQL logical replication setup.

This was the script I used to subscribe the old master to the new master:  

```
#!/bin/bash
old_master="logrepl_pg_master"
new_master="logrepl_pg_replica1"
old_master_subscription="my_subscription"

docker start $old_master
sleep 1

# Disable any outgoing replication from the old master
echo "Disabling any publications on $old_master..."
docker exec -i "$old_master" psql -U postgres -d postgres -c "DROP PUBLICATION IF EXISTS my_publication;"

# Create a new subscription on the old master to the new master's publication
docker exec -i "$old_master" psql -U postgres -d postgres -c "DROP SUBSCRIPTION IF EXISTS $old_master_subscription;"
docker exec -i "$old_master" psql -U postgres -d postgres -c "CREATE SUBSCRIPTION $old_master_subscription CONNECTION 'dbname=postgres host=$new_master user=postgres password=postgres' PUBLICATION new_master_publication;"

echo "Subscription setup complete. $old_master is now a subscriber of $new_master." 
```

Enter fullscreen mode Exit fullscreen mode

But, then I realised that data was not being updated in master:  

```
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
(3 rows)

$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows)

$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows) 
```

Enter fullscreen mode Exit fullscreen mode

So I checked log messages and found out the next:  

```
logrepl_pg_replica1  | 2024-02-11 10:51:19.017 UTC [230] LOG:  logical decoding found consistent point at 0/158FF30
logrepl_pg_replica1  | 2024-02-11 10:51:19.017 UTC [230] DETAIL:  There are no running transactions.
logrepl_pg_replica1  | 2024-02-11 10:51:19.017 UTC [230] STATEMENT:  CREATE_REPLICATION_SLOT "pg_16436_sync_16385_7334283988469985309" LOGICAL pgoutput (SNAPSHOT 'use')
logrepl_pg_master    | 2024-02-11 10:51:19.079 UTC [67] ERROR:  duplicate key value violates unique constraint "users_pkey"
logrepl_pg_master    | 2024-02-11 10:51:19.079 UTC [67] DETAIL:  Key (user_id)=(1) already exists.
logrepl_pg_master    | 2024-02-11 10:51:19.079 UTC [67] CONTEXT:  COPY users, line 1
logrepl_pg_master    | 2024-02-11 10:51:19.084 UTC [1] LOG:  background worker "logical replication worker" (PID 67) exited with exit code 1
logrepl_pg_master    | 2024-02-11 10:51:24.096 UTC [68] LOG:  logical replication table synchronization worker for subscription "my_subscription", table "users" has started 
```

Enter fullscreen mode Exit fullscreen mode

So this means that now that master has subscribed to replica, the system is trying to transmit full database data. I could have reseted master subscription in order to start listening from now on using next instruction but this would mean that master would miss database changes made from the time it was off till the time it is on again:

#### [](#resolution-starting-from-scratch)Resolution: Starting from Scratch

To resolve the synchronization issues, a decisive approach was taken: restarting the original master from scratch. This involved removing the existing Docker container and volume for `logrepl_pg_master`, then recreating and reconfiguring it from the ground up. This process guaranteed that the old master, now a subscriber, was perfectly in sync with the current state of the new master, effectively making it an up-to-date replica.  

```
#!/bin/bash
old_master="logrepl_pg_master"
new_master="logrepl_pg_replica1"
old_master_subscription="my_subscription"
max_number_of_replicas=4
max_wal_senders=8

docker stop $old_master
sleep 1
docker rm $old_master
sleep 1
docker volume rm logrepl_pg_master-data
docker compose up -d
sleep 2
docker cp ./schema.sql "$old_master:/tmp/schema.sql"
docker exec -i $old_master psql -U postgres -d postgres -f /tmp/schema.sql
docker exec -i $old_master rm /tmp/schema.sql

docker exec -i "$old_master" bash -c "sed -i 's/^#*wal_level .*$/wal_level = logical/' /var/lib/postgresql/data/postgresql.conf"
docker exec -i "$old_master" bash -c "sed -i 's/^#*max_replication_slots .*$/max_replication_slots = $max_number_of_replicas/' /var/lib/postgresql/data/postgresql.conf"
docker exec -i "$old_master" bash -c "sed -i 's/^#*max_wal_senders .*$/max_wal_senders = $max_wal_senders/' /var/lib/postgresql/data/postgresql.conf"
docker exec -i "$old_master" bash -c "grep -qxF 'host replication all all md5' /var/lib/postgresql/data/pg_hba.conf || echo 'host replication all all md5' >> /var/lib/postgresql/data/pg_hba.conf"
docker restart $old_master

sleep 2

# Disable any outgoing replication from the old master
echo "Disabling any publications on $old_master..."
docker exec -i "$old_master" psql -U postgres -d postgres -c "DROP PUBLICATION IF EXISTS my_publication;"

# Remove previous replica subscriptions of master in replica1
docker exec -it logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT pg_drop_replication_slot('my_subscription');"

# Create a new subscription on the old master to the new master's publication
docker exec -i "$old_master" psql -U postgres -d postgres -c "DROP SUBSCRIPTION IF EXISTS $old_master_subscription;"
docker exec -i "$old_master" psql -U postgres -d postgres -c "CREATE SUBSCRIPTION $old_master_subscription CONNECTION 'dbname=postgres host=$new_master user=postgres password=postgres' PUBLICATION new_master_publication;"

echo "Subscription setup complete. $old_master is now a subscriber of $new_master." 
```

Enter fullscreen mode Exit fullscreen mode

After some time:  

```
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows)
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows)
$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
(4 rows) 
```

Enter fullscreen mode Exit fullscreen mode

And if now we add another row in replica1:  

```
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "INSERT INTO users (username, email) VALUES ('newuser5', 'newuser5@example.com');"
INSERT 0 1
$ sleep 1
$ docker exec -i logrepl_pg_master psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
       5 | newuser5 | newuser5@example.com | 2024-02-11 11:17:46.730413
(5 rows)
$ docker exec -i logrepl_pg_replica1 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
       5 | newuser5 | newuser5@example.com | 2024-02-11 11:17:46.730413
(5 rows)
$ docker exec -i logrepl_pg_replica2 psql -U postgres -d postgres -c "SELECT * FROM users;"
 user_id | username |        email         |         created_at         
---------+----------+----------------------+----------------------------
       1 | newuser  | newuser@example.com  | 2024-02-11 10:08:08.116556
       2 | newuser2 | newuser2@example.com | 2024-02-11 10:13:38.786147
       3 | newuser3 | newuser3@example.com | 2024-02-11 10:20:31.714676
       4 | newuser4 | newuser4@example.com | 2024-02-11 10:26:50.874549
       5 
```

Enter fullscreen mode Exit fullscreen mode

This approach, while drastic, ensured data integrity and consistency across the replication setup. It highlighted a key advantage of containerized environments—the ability to rapidly rebuild and redeploy components of your infrastructure with confidence.

### [](#reflections-and-future-directions)Reflections and Future Directions

The challenges encountered while switching the master back on have led to valuable insights:

*   **Preparation for Role Reversal**: The need for thorough preparation and clear strategies when reversing roles in a logical replication setup. This includes ensuring data consistency and understanding the implications of such changes.
*   **Resilience through Rebuilding**: The effectiveness of starting from scratch as a means to ensure an accurate and reliable replication setup. While not always ideal, this approach can be a reliable fallback strategy in complex scenarios.
*   **Exploring Alternative Approaches**: Inspired by these challenges, I am considering alternative procedures for switching off and replacing the master without the need to replicate the entire database from scratch. This exploration aims to refine our strategies for managing PostgreSQL logical replication, making the process more efficient and less disruptive.

In light of these experiences, I plan to conduct further tests and research into alternative strategies for managing master role transitions in logical replication setups. If successful, these findings will be the subject of a forthcoming article, aimed at providing even more robust and efficient methods for managing PostgreSQL replication environments.

[](#conclusions-and-key-takeaways)Conclusions and Key Takeaways
---------------------------------------------------------------

Our journey through the intricacies of PostgreSQL logical replication, set within a Dockerized environment, has shed light on vital aspects of database management, including data consistency, availability, and scalability. This hands-on guide underscored the significance of logical replication in bolstering system resilience and adaptability, proving its worth in scenarios demanding disaster recovery and near-zero downtime upgrades.

The granular control offered by logical replication, enabling selective synchronization of databases, tables, or rows, empowers administrators to devise customized strategies that align with specific operational needs. Docker's role in demystifying the deployment and management of complex, distributed database systems has been pivotal, rendering sophisticated features like logical replication more approachable and manageable.

The setup's resilience in the face of replica downtimes, coupled with its capacity for smooth role reversals amid failovers, accentuates the paramount importance of foresight and meticulous planning in database management. The imperative to maintain data consistency across all instances, particularly through and beyond failover events, emerged as a central theme, highlighting the challenges that necessitate a systematic approach to managing role transitions and system updates.

While this exploration has been revealing, it also paves the way for further inquiry, especially concerning the optimization of master role transitions and the reduction of associated downtime. The difficulties experienced in reintegrating the original master as a subscriber have kindled interest in devising strategies that are both more efficient and less intrusive.

Motivated by these challenges, we are now poised to delve into alternative methodologies for handling master role changes without resorting to complete database replication from scratch. This forthcoming endeavor aims to enhance our logical replication management techniques, emphasizing operational efficiency and minimal disruption.

In wrapping up, our foray into the domain of PostgreSQL logical replication within a Docker framework has not only broadened our comprehension of this potent functionality but also underscored the perennial value of continuous learning and refinement in database management practices. This journey highlights the evolving nature of technology and our relentless pursuit of increasingly sophisticated and effective solutions within the dynamic realm of database administration.