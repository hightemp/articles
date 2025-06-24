# Memory Management in Linux – Operating System
Mary Anitha Rajam

**40.1****Introduction**

In this module, we learn how memory management is handled in the Linux operating system. We learn how physical memory and virtual memory are managed. Linux memory management includes allocating and freeing physical memory – pages, groups of pages, and small blocks of main memory and handling virtual memory that is memory mapped into the address space of running processes.

**40.2 Management of Physical Memory**

In this section we learn how physical memory is managed. Linux operating system can be used for a wide range of architectures. Therefore, the operating system needs an architecture independent way of describing memory. Linux splits physical memory into 4 different zones due to hardware characteristics – ZONE\_DMA, ZONE\_DMA32, ZONE\_NORMAL and ZONE\_HIGHMEM. We now see what each of these zones refer to.

If the user wants to see the physical addresses of different zones, the ‘dmesg’ can be used after booting. ZONE\_DMA is the memory in the lower physical memory ranges. This memory zone is required by certain ISA devices. In x86 – 32 bit architecture, some devices access only lower 16 MB of physical memory (ZONE\_DMA) using DMA. The memory in the ZONE\_DMA is generally used by specific devices. This memory can be used for transfers, for example with network cards, which can only address 24bits, and hence can address only (224) 16MB. Some cards/drivers can only utilize memory from the DMA zone.

DMA32 is 4GB (232) in size and is used for data exchange with cards which can address 32bits. Some devices that even though support 64-bit addresses, can access only the first 4 GB. Hence, these devices use ZONE\_DMA32.

Physical memory not mapped into the kernel address space is called ZONE\_HIGHMEM. In 32-bit Intel architecture (232 = 4 GB address space), the kernel address space is mapped to the first 896 MB of memory, remaining memory is high memory allocated from ZONE\_HIGHMEM.

Everything else is  called ZONE\_NORMAL. ZONE\_NORMAL has the  normal,  regularly mapped pages that are used for processes. Memory within ZONE\_NORMAL is directly mapped by the kernel into the upper region of the linear address space. Many kernel operations can only take place using ZONE\_NORMAL. So it is the most performance critical zone.

All architectures may not have all zones. Modern Intel x86-64 bit architecture has a small 16 MB ZONE\_DMA and the rest of its memory is ZONE\_NORMAL and there is no high memory. Figure 40.1 shows the zones present in the 80×86 32-bit architecture. ZONE\_DMA refers to the physical memory that is < 16MB. Between 16 MB and 896 MB, it is ZONE\_NORMAL. Above 896 MB, the memory is ZONE\_HIGHMEM. Thus we see that, different architectures have different sets of zones.

For each of these zones, the kernel maintains a list of free pages. When a request for physical memory arrives, the kernel satisfies the request using the appropriate zone. The allocation of pages for the arriving requests is done by the physical memory manager called the _page allocator_. Each zone has its own allocator. The allocator allocates and frees all physical pages for the zone. The allocator allocates physically contiguous pages on request. This uses a buddy system to keep track of available physical pages.

![](http://csp3.epgpbooks.inflibnet.ac.in/wp-content/uploads/sites/49/2018/07/40.1.png)

Fig. 40.1 Relationship of Zones and Physical Addresses on 80×86

**40.2.1****Management of Physical Memory – Buddy System**

In this section we learn what the buddy system is and how it is used for allocating pages. Adjacent units of allocatable memory are paired together. Each allocatable memory region has an adjacent partner called a buddy. Whenever two allocated partner regions (adjacent regions) are freed up, they are combined to form a larger region called a buddy heap. The larger region also has a partner with which it can combine to form a still larger free region. If there is a request for a small region and if a region of that size is not available, a larger region is split into two partners. This splitting can happen till the region goes down to the size of a page. That is, the smallest size that can be allocated is a single page.

![](http://csp3.epgpbooks.inflibnet.ac.in/wp-content/uploads/sites/49/2018/07/40.1.1.png)

Fig. 40.1 Splitting of Memory in a Buddy Heap (Source: \[1\])

Figure 40.1 shows how memory is split in a buddy heap when there is a request for a smaller memory space. Suppose there is a request for a memory space of 4KB and the region that is available is of size 16 KB. This large region is first split into two partners of 8 KB size each. One of the two 8 KB regions is split into two 4 KB regions. One of the two 4 KB regions is allocated to the requesting process. Now, there is 4 KB free region and a 8 KB free region.

**40.2.2  Management of Physical Memory–Slab Allocator**

We now see how memory is allocated for kernel data structures. There are a number of data structures that are maintained in the kernel. When these data structures grow, there arises a need of allocating space for the data structures in the main memory.

A slab is made up of one or more physically contiguous pages. A cache consists of one or more slabs. The slab allocator consists of a variable number of caches that are linked together on a doubly linked circular list called a _cache chain_. For each unique kernel data structure, there is a single cache. For example, there is a cache for inodes, a cache for file objects and so on. Each cache is populated with objects that are instantiations of the kernel data structure the cache represents. For example, the inode cache stores instances of inode data structures.

![](http://csp3.epgpbooks.inflibnet.ac.in/wp-content/uploads/sites/49/2018/07/40.2.png)

Fig. 40.2 Management of Physical Memory – Slab Allocator

The slab-allocation algorithm uses caches to store kernel objects. When a cache is created, a number of objects are allocated to the cache. The number of objects in the cache depends on the size of the associated slab. A 12 KB slab (3 contiguous 4-KB pages) can store six 2-KB objects. Figure 40.2 shows two 3 KB objects that are kept in two different caches. Caches are made of slabs and slabs are made of contiguous physical pages.

All objects in the cache are initially marked free. When a new object is needed for a kernel data structure, the allocator can assign any free object from the cache to satisfy the request. When a new task is created, a new process descriptor object (struct task\_struct) is to be assigned. The cache will fulfill the request using a free slab.

A slab may be in one of three possible states.

–  Full: All objects in the slab are marked as used

–  Empty: All objects in the slab are marked as free

–  Partial: The slab consists of both used and free objects

The slab allocator first attempts to satisfy the request with a free object present in a partial slab. If none exists, the object is assigned from an empty slab. If no empty slabs are available, a new slab is allocated from contiguous physical pages and assigned to a cache; memory for the object is allocated from this newly allocated slab.

The slab allocator has three principle aims:

(i)  The allocation of small blocks of memory to help eliminate internal fragmentation that would be otherwise caused by the buddy system

(ii) The caching of commonly used objects so that the system does not waste time allocating, initializing and destroying objects. Benchmarks on Solaris showed excellent speed improvements for allocations with the slab allocator

(iii) The better utilization of hardware cache by aligning objects to the L1 or L2 caches.

**40.3 Virtual Memory**

The VM system maintains the address space accessible to each process. It creates pages of virtual memory on demand, and manages the loading of those pages from disk or their swapping back out to disk as required.

There are several types of virtual memory regions. The regions are usually backed by a file or by nothing (_demand-zero_ memory). For example, a region may be taken from a file’s contents, if it is a text region. When a region is backed by nothing, and when that region is accessed, a page filled with zeros is given. For regions having uninitialized data, the regions may not be backed by anything and may be filled with zeros.The VM manager maintains two separate views of a process’s address space. One is the logical view describing instructions concerning the layout of the address space. The address space consists of a set of nonoverlapping regions, each region representing a continuous, page-aligned subset of the address space. That is, the logical view looks at a process as set of regions such as the text region, data region and stack region. The other view is the physical view of each address space. This is stored in the hardware page tables for the process. Page table entries have the current location of each page of virtual memory – whether it is in disk or in physical memory. This view looks at a process as set of pages. The backing store describes from where the pages for a region come from.

A virtual memory region is also defined by the region’s reaction to writes. If the region is a shared region, multiple processes can share the region at the same time. If the region is a private region, copy-on-write is set for the region. In this case, whenever one of the processes that is sharing the region tries to write to the region, a copy of the region is made for the writing process.

The kernel creates a new virtual address space in two situations. One is when a process runs a new program with the exec system call and the other is upon creation of a new process by the fork system call. When the fork system call s executed, a new process is created, but, a new program is not run.

On executing a new program using the exec system call, the process is given a new, completely empty virtual-address space. The virtual address space that was existing before the call is totally erased and is empty now. The program-loading routines populate the address space with virtual-memory regions.

Creating a new process with fork involves creating a complete copy of the existing process’s virtual address space. The kernel copies the parent process’s virtual memory address descriptors, then creates a new set of page tables for the child. The parent’s page tables are copied directly into the child’s, with the reference count of each page covered being incremented. After the fork, the parent and child share the same physical pages of memory in their address spaces. If the virtual memory region is private, the pages for the regions are marked as read-only and copy-on-write is set.

**40.3.1 Virtual Memory – Swapping and Paging**

The virtual memory paging system relocates pages of memory from physical memory out to disk when the memory is needed for something else. When there is no enough space in the main memory, some of the pages have to be moved to the swap space and may be moved into the main memory later when required. In Linux, there is no whole-process swapping. Only individual pages are moved.

In Linux, the virtual memory paging system can be divided into two sections: One is the pageout-policy algorithm that decides which pages to write out to disk, and when. In Linux, the least frequently used (LFU) principle is used. The second is the paging mechanism that actually carries out the transfer, and pages data back into physical memory as needed.

**40.4 Summary**

In this module, we learnt how physical memory is managed in Linux. The memory was divided into zones for better handling of memory for different architectures. We learnt the page allocator used for allocating memory. We also learnt the slab allocator used for allocating memory for kernel data structures. We also learnt how virtual memory is managed in Linux.

**References**

\[1\] Abraham Silberschatz, Peter B. Galvin, Greg Gagne, “Operating System Concepts”, Ninth Edition, John Wiley & Sons Inc., 2012.

\[2\] https://www.kernel.org/doc/gorman/html/understand/understand005.html

\[3\] https://www.redhat.com/en/about/blog/memory-zones-and-linux-driver-issue

\[4\] https://www.kernel.org/doc/gorman/html/understand/understand011.html