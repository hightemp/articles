# What is Virtual Memory on Linux? - Scaler Topics
In the ever-evolving landscape of modern computing, the efficient management of memory resources is critical for ensuring smooth and responsive system performance. To address the challenges posed by resource-hungry applications and limited physical memory, Linux leverages the power of "**Virtual Memory**". In this article, we delve into the intricacies of Virtual Memory in Linux, exploring its significance, implementation, and the benefits it brings to the world of computing.

How Virtual Memory Works in Linux?
----------------------------------

**Virtual memory** in Linux is a sophisticated memory management system that allows the operating system to efficiently utilize both physical RAM and secondary storage (usually a portion of the hard disk called the swap space) to create an illusion of larger memory than what is physically available.

### 1\. Linux Virtual Memory Techniques

Some of the key virtual memory techniques used in Linux are:

**Demand Paging:**

Demand paging is a technique where the Linux kernel loads pages into physical memory only when they are required by a process.

**Swap Space:**

Swap space is a designated area on the hard disk that acts as an extension of physical RAM.

**Copy-on-Write (COW):**

Copy-on-write is a memory optimization technique used by Linux when creating child processes through the fork() system call.

**Memory Mapping:**

Linux allows files to be mapped directly into a process's address space through memory mapping techniques like mmap().

### 2\. Buddy and the Slab Allocator

Both allocators play distinct roles in managing different types of memory allocations within the kernel.

**Buddy Allocator:**

The Buddy Allocator is a memory management technique used for managing the allocation and deallocation of large blocks of memory. How it works:

*   When a request for memory allocation arrives, the allocator looks for the closest available block size that can satisfy the request, which is always a power of two.
*   If there's a block of the required size, it is allocated to the requesting process. If not, a larger block is split into two equal "buddy" blocks, and the process repeats recursively until the required block size is reached.

**Slab Allocator:**

The Slab Allocator is a memory management technique used for managing small memory allocations, often referred to as "objects" or "slabs".

How it works:

*   The **Slab Allocator** divides the physical memory into fixed-size caches, each dedicated to storing a specific kernel data structure or object type.
*   When a request for a small memory allocation comes in, the allocator looks for a cache that can accommodate the requested size. If there's an available object in the cache, it is allocated to the process. Otherwise, a new cache is created, and memory is allocated from it.

### 3\. Linux Kernel Tasks

Here are some key tasks and techniques related to virtual memory in the Linux kernel:

**Page Allocation and Deallocation:**

The Linux kernel is responsible for allocating and deallocating memory pages to processes. When a process requests memory, the kernel uses its memory management subsystem to allocate the required pages from the physical memory (RAM) or the swap space on the disk.

**Page Fault Handling:**

Page faults occur when a process accesses a memory page that is not currently present in physical memory. The Linux kernel handles these page faults by bringing the required page into memory from the swap space.

**Page Replacement Algorithms:**

To optimize memory utilization and page loading, the Linux kernel employs various page replacement algorithms. These algorithms determine which pages should be evicted from memory when new pages need to be loaded.

Setting Up Virtual Memory in Linux with Tunable Parameters
----------------------------------------------------------

### 1\. Vm.Swappiness

The **vm.swappiness** parameter determines how aggressively the kernel uses swap space when the physical RAM becomes full.

**Check Current Swappiness Setting:**

Before making any changes, check the current vm.swappiness value to understand how the system is using swap space. Open a terminal and run the following command:

The output will show the current value, typically set to the default value of 60.

**Temporary Swappiness Adjustment:**

To temporarily adjust the vm.swappiness value, you can use the sysctl command as follows:

```shell
$ sudo sysctl vm.swappiness=VALUE

```

Replace VALUE with the desired swappiness value you want to set. For example, to set the swappiness to 10:

```shell
$ sudo sysctl vm.swappiness=10

```

This change takes effect immediately, and the system will start using swap space less aggressively.

**Permanent Swappiness Adjustment:**

To make the swappiness adjustment permanent across reboots, edit the sysctl.conf file, which holds system tunable parameters:

```shell
$ sudo nano /etc/sysctl.conf

```

Add or modify the following line to set your desired swappiness value (e.g., 10):

Save and close the file.

**Apply the Permanent Change:**

To apply the changes without rebooting, run the following command:

The sysctl -p command reads the sysctl.conf file and applies the changes immediately.

**Monitor Swappiness:**

After making the changes, you can monitor the system's swappiness value using the sysctl command or other monitoring tools. Ensure that the new setting aligns with your system's requirements and workload.

### 2\. VM.Dirty\_Ratio

The **vm.dirty\_ratio** parameter determines the percentage of system RAM that can be used for dirty pages, which are modified data waiting to be written back to disk.

**Check Current Dirty Ratio Setting:**

Before making any changes, check the current vm.dirty\_ratio value to understand how the system is handling dirty pages. Open a terminal and run the following command:

```shell
cat /proc/sys/vm/dirty_ratio

```

The output will show the current value, typically set to the default value, which is often around 20.

**Temporary Dirty Ratio Adjustment:**

To temporarily adjust the vm.dirty\_ratio value, you can use the sysctl command as follows:

```shell
$ sudo sysctl -w vm.dirty_ratio=VALUE

```

Replace VALUE with the desired dirty ratio percentage you want to set. For example, to set the dirty ratio to 30%:

```shell
$ sudo sysctl -w vm.dirty_ratio=30

```

This change takes effect immediately.

**Permanent Dirty Ratio Adjustment:**

To make the dirty ratio adjustment permanent across reboots, edit the sysctl.conf file:

```shell
$ sudo nano /etc/sysctl.conf

```

Add or modify the following line to set your desired dirty ratio percentage (e.g., 30%):

Save and close the file, apply the permanent changes & monitor the dirty ratio as discussed above.

### 3\. Vm.Dirty\_Background\_Ratio

The **vm.dirty\_background\_ratio** parameter determines the percentage of system RAM that can be used for dirty pages before the kernel starts background-flushing them to disk.

**Check Current Dirty Background Ratio Setting:**

Before making any changes, check the current vm.dirty\_background\_ratio value to understand how the system is handling dirty pages in the background. Open a terminal and run the following command:

```shell
$ cat /proc/sys/vm/dirty_background_ratio

```

The output will show the current value, typically set to the default value, which is often around 10.

**Temporary Dirty Background Ratio Adjustment:**

To temporarily adjust the vm.dirty\_background\_ratio value, you can use the sysctl command as follows:

```shell
$ sudo sysctl -w vm.dirty_background_ratio=VALUE

```

Replace VALUE with the desired dirty background ratio percentage you want to set. For example, to set the dirty background ratio to 15%:

```shell
$ sudo sysctl -w vm.dirty_background_ratio=15

```

This change takes effect immediately.

**Permanent Dirty Background Ratio Adjustment:**

To make the dirty background ratio adjustment permanent across reboots, edit the sysctl.conf file:

```shell
sudo nano /etc/sysctl.conf

```

Add or modify the following line to set your desired dirty background ratio percentage (e.g., 15%):

```shell
vm.dirty_background_ratio=15

```

Save and close the file, apply the permanent changes & monitor the dirty background ratio as discussed above.

What are the Best Practices for Managing Memory in Linux?
---------------------------------------------------------

By following these practices, you can optimize memory usage and ensure a smooth computing experience:

*   **Set Appropriate Swap Space:**  
    Ensure that your swap space is appropriately sized. A rule of thumb is to set it to at least the same size as your physical RAM. Having sufficient swap space allows the system to handle peak memory demands effectively.
*   **Use 64-bit Architecture:**  
    If your hardware supports it, use a 64-bit Linux distribution to take advantage of a larger virtual address space, enabling the system to handle more extensive memory requirements.
*   **Use Memory-efficient Software:**  
    Select applications and services that are memory-efficient. Avoid memory-hungry software whenever possible and opt for lightweight alternatives.
*   **Use Memory-mapped I/O (mmap) Wisely:**  
    While memory-mapped I/O can improve performance, be cautious when using it with large files. Mapping excessively large files can consume significant amounts of memory, leading to resource exhaustion.
*   **Keep the Kernel Updated:**  
    Regularly update the Linux kernel and relevant packages to benefit from memory management improvements and bug fixes introduced by the community.

Linux Swap Partitions
---------------------

### Complementing Physical RAM:

When a Linux system runs multiple applications simultaneously or handles memory-intensive tasks, the physical RAM may become insufficient to accommodate all the data required by running processes. To address this limitation, the kernel uses a portion of the hard disk as virtual memory, known as swap space.

### Paging and Swapping:

When a process requires more memory than what is available in physical RAM, the Linux kernel employs a technique called "**demand paging**". If a process accesses data that is not currently in RAM (a "**page fault**" occurs), the kernel retrieves the required data from the swap space into a free area in physical RAM. This process is referred to as "**swapping in**" or "**paging in**".

### Managing Swap Partition Size:

The size of the swap partition is a critical consideration. It should be large enough to accommodate the memory demands of running processes and avoid out-of-memory situations. On the other hand, too much swap space might not be beneficial and can even lead to performance issues.

Using Swap Files on Linux
-------------------------

Swap files in Linux provide a flexible way to add virtual memory to the system without the need for dedicated swap partitions. Here's how to use swap files in Linux:

### 1\. Create a Swap File:

To create a swap file, determine the desired size and location. The swap file can be created in any directory, but it is commonly placed in the root directory (/). For example, to create a 2GB swap file named "swapfile":

```shell
$ sudo fallocate -l 2G /swapfile

```

### 2\. Set Proper Permissions and Lock the Swap File:

Swap files should have restricted permissions to ensure security. Set the appropriate permissions and lock the file to prevent modification:

```shell
$ sudo chmod 600 /swapfile
$ sudo chown root:root /swapfile

```

### 3\. Format the Swap File:

Before using the swap file, you must format it as swap space:

### 4\. Enable the Swap File:

Once the swap file is formatted, enable it to make it available for use:

### 5\. Make the Swap File Permanent:

To ensure that the swap file is automatically enabled during system boot, add an entry to the /etc/fstab file:

Add the following line at the end of the file:

```shell
/swapfile none swap sw 0 0

```

Save and close the file.

### 6\. Verify Swap Usage:

Confirm that the swap file is active and being used by checking the swap usage using the free or swapon command.

How Much Swap Space?
--------------------

Virtual memory on Linux utilizes swap space to extend the available memory beyond physical RAM, allowing the system to handle memory-intensive tasks and efficiently manage memory resources.

Here are some general guidelines to help determine how much swap space to allocate:

*   **RAM Up to 2 GB:**  
    For systems with less than 2 GB of RAM, allocating swap space equal to the physical RAM size or slightly more (e.g., 1.5 times the RAM) should be sufficient.
    
*   **RAM 2 GB to 8 GB:**  
    For systems with 2 GB to 8 GB of RAM, a swap space size equal to the physical RAM is generally adequate. Modern systems with sufficient RAM can handle most workloads without heavy swapping.
    
*   **RAM 8 GB to 64 GB:**  
    For systems with 8 GB to 64 GB of RAM, a swap space of 2 GB to 4 GB is typically sufficient. Having some swap space helps in handling occasional spikes in memory usage.
    
*   **RAM More than 64 GB:**  
    For systems with more than 64 GB of RAM, you can allocate smaller swap space, around 1 GB to 2 GB, as long as your system does not run memory-intensive tasks or specialized workloads.
    

Virtual Memory Keeps Your Linux System Running Smoothly
-------------------------------------------------------

Virtual memory is a fundamental mechanism that plays a critical role in maintaining the stability, performance, and responsiveness of Linux-based systems.

*   **Handling Memory-Intensive Tasks:**  
    Virtual memory allows the system to handle memory-intensive tasks effectively by leveraging the swap space to temporarily store data that is not actively used by processes.
    
*   **Seamless Multitasking:**  
    Virtual memory enables seamless multitasking by allowing multiple applications to share the limited physical RAM efficiently.
    
*   **Avoiding Out-of-Memory Situations:**  
    Without virtual memory, spikes such as memory leaks in applications, and unanticipated resource demands, could result in out-of-memory (OOM) situations, where the system crashes because there is not enough memory.
    

Conclusion
----------

*   **Virtual Memory** abstracts physical memory, allowing processes to operate as if they have a contiguous address space. Virtual memory employs clever swapping techniques to optimize memory utilization and ensure a stable and responsive user experience.
*   Linux's virtual memory system caters to a wide array of computing applications, from personal desktops to high-performance servers.
*   Virtual memory seamlessly handles memory demands in contemporary computing environments. The use of virtual memory makes Linux a reliable choice for various computing tasks.
*   As technology evolves, virtual memory remains adaptable to meet the changing demands of modern computing. Virtual memory is instrumental in achieving optimal system performance on Linux-based platforms.