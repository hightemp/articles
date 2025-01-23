# Understanding ELF File Layout in Memory - by Mohit
In Unix-like operating systems, the ELF (Executable and Linkable Format) is the standard file format for executables, object code, and shared libraries. Understanding how ELF files are laid out in memory is crucial for developers, system programmers, and anyone interested in low-level programming.

This blog post will provide a brief guide to the ELF file layout in memory, including how segments are arranged, how sections are mapped to segments, and how to use tools like `readelf` to inspect these details.

Before diving into memory layout, it's essential to understand the basic structure of an ELF file. An ELF file consists of several parts:

1.  **ELF Header**: Contains information about the file type, architecture, and other global properties.
    
2.  **Program Headers**: Describe the segments to be loaded into memory.
    
3.  **Section Headers**: Provide details about the sections used by the linker and debugger.
    
4.  **Segments and Sections**: The actual data that makes up the executable or library.
    

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0a0eeaa1-a7ad-4b1f-8f9e-5d6d61fbfebd_400x599.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0a0eeaa1-a7ad-4b1f-8f9e-5d6d61fbfebd_400x599.png)

*   **Sections**: Logical components of the file used by the linker and debugger (e.g., `.text`, `.data`, `.bss`, `.rodata`).
    
*   **Segments**: The loader loads Physical components into memory (e.g., loadable segments, dynamic linking information).
    

ELF files can be of two main types:

1.  **ET\_EXEC**: Statically linked executables that are loaded at fixed addresses in memory.
    
2.  **ET\_DYN**: Position-Independent Executables (PIE) and shared libraries that can be loaded at any address.
    

For `ET_EXEC` the segments are loaded into memory at the addresses specified in the program headers. These addresses are fixed and determined at link time. If a `ET_EXEC` file is loaded at a different address, it will not function correctly.

To view the program headers and linked addresses of a `ET_EXEC` file, you can use the `readelf` command:

```
readelf -l a.out
```

This command displays the program headers, showing the virtual addresses (`p_vaddr`) where each segment is loaded.

For `ET_DYN` files, the segments are loaded into memory at a base address, and the same offset relocates all segment virtual addresses. This allows `ET_DYN` files to be loaded at any address in memory, which is essential for Position-Independent Code (PIC) and ASLR (Address Space Layout Randomization).

To determine the base address and calculate the loaded addresses of segments, you can use the following approach:

1.  Identify the linked address of the first loadable segment.
    
2.  Determine the loaded address of the first segment at runtime.
    
3.  Calculate the offset between the linked and loaded addresses.
    
4.  Apply this offset to `p_vaddr` all other segments to find their loaded addresses.
    

Sections are not directly loaded into memory; instead, they are grouped into segments. To understand how sections like `.rodata` and `.bss` are mapped to segments, you can use the `readelf` command to view the section-to-segment mappings:

```
readelf -l a.out
```

This command will show you which sections are included in each segment.

Consider the following simple C program:

```
#include <stdio.h>

int main() {
    printf("Hello, ELF!\n");
    return 0;
}
```

Compile the program with debugging symbols:

```
gcc -g -o example example.c
```

View the program headers:

```
readelf -l example
```

Output:

```
Elf file type is DYN (Position-Independent Executable file)
Entry point 0x1060
There are 13 program headers, starting at offset 64

Program Headers:
  Type           Offset             VirtAddr           PhysAddr
                 FileSiz            MemSiz              Flags  Align
  PHDR           0x0000000000000040 0x0000000000000040 0x0000000000000040
                 0x00000000000002d8 0x00000000000002d8  R      0x8
  INTERP         0x0000000000000318 0x0000000000000318 0x0000000000000318
                 0x000000000000001c 0x000000000000001c  R      0x1
      [Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]
  LOAD           0x0000000000000000 0x0000000000000000 0x0000000000000000
                 0x0000000000000628 0x0000000000000628  R      0x1000
  LOAD           0x0000000000001000 0x0000000000001000 0x0000000000001000
                 0x0000000000000175 0x0000000000000175  R E    0x1000
  LOAD           0x0000000000002000 0x0000000000002000 0x0000000000002000
                 0x00000000000000f4 0x00000000000000f4  R      0x1000
  LOAD           0x0000000000002db8 0x0000000000003db8 0x0000000000003db8
                 0x0000000000000258 0x0000000000000260  RW     0x1000
  DYNAMIC        0x0000000000002dc8 0x0000000000003dc8 0x0000000000003dc8
                 0x00000000000001f0 0x00000000000001f0  RW     0x8
  NOTE           0x0000000000000338 0x0000000000000338 0x0000000000000338
                 0x0000000000000030 0x0000000000000030  R      0x8
  NOTE           0x0000000000000368 0x0000000000000368 0x0000000000000368
                 0x0000000000000044 0x0000000000000044  R      0x4
  GNU_PROPERTY   0x0000000000000338 0x0000000000000338 0x0000000000000338
                 0x0000000000000030 0x0000000000000030  R      0x8
  GNU_EH_FRAME   0x0000000000002010 0x0000000000002010 0x0000000000002010
                 0x0000000000000034 0x0000000000000034  R      0x4
  GNU_STACK      0x0000000000000000 0x0000000000000000 0x0000000000000000
                 0x0000000000000000 0x0000000000000000  RW     0x10
  GNU_RELRO      0x0000000000002db8 0x0000000000003db8 0x0000000000003db8
                 0x0000000000000248 0x0000000000000248  R      0x1

 Section to Segment mapping:
  Segment Sections...
   00     
   01     .interp 
   02     .interp .note.gnu.property .note.gnu.build-id .note.ABI-tag .gnu.hash .dynsym .dynstr .gnu.version .gnu.version_r .rela.dyn .rela.plt 
   03     .init .plt .plt.got .plt.sec .text .fini 
   04     .rodata .eh_frame_hdr .eh_frame 
   05     .init_array .fini_array .dynamic .got .data .bss 
   06     .dynamic 
   07     .note.gnu.property 
   08     .note.gnu.build-id .note.ABI-tag 
   09     .note.gnu.property 
   10     .eh_frame_hdr 
   11     
   12     .init_array .fini_array .dynamic .got 
```

From this output, you can see:

*   **Segment 03**: Contains `.text`, `.rodata`, and `.eh_frame` sections.
    
*   **Segment 05**: Contains `.data` and `.bss` sections.
    

This means that the read-only data (`rodata`) is placed in a different segment than the code (`text`), and the read-write data (`data` and `bss`) is in a separate segment.

To determine the arrangement of segments in memory, you can use the following steps:

1.  **Identify the ELF Type**: Use `readelf -h a.out` to check if the file is `ET_EXEC` or `ET_DYN`.
    
2.  **View Program Headers**: Use `readelf -l a.out` to see the program headers and segment details.
    
3.  **Check Section to Segment Mapping**: Understand which sections are included in each segment.
    
4.  **Analyze Memory Layout**: For `ET_EXEC`, the segments are loaded at the linked addresses. For `ET_DYN`, calculate the offset based on the base address.
    

Consider the previous `example` executable:

```
➜  ~ gcc -no-pie -o example example.c
➜  ~ readelf -h example | grep Type
  Type:                              EXEC (Executable file)
```

Take a shared library like `libc.so.6`:

```
readelf -h /lib/x86_64-linux-gnu/libc.so.6 | grep Type
```

Output:

```
Type:                             DYN (Shared object file)
```

View the program headers:

```
readelf -l /lib/x86_64-linux-gnu/libc.so.6
```

You'll notice that the `p_vaddr` values are relative to the linked address, and the actual loaded addresses will be determined at runtime based on the base address.

Understanding the ELF file layout in memory has several practical implications:

*   **Debugging**: Knowing which sections are loaded where can aid in debugging.
    
*   **Optimization**: You can optimize memory usage by controlling section placement.
    
*   **Security**: Understanding memory layout is crucial for security considerations like ASLR.
    

*   [ELF Format Documentation](https://refspecs.linuxbase.org/elf/elf.pdf)
    
*   [readelf Manual Page](https://man7.org/linux/man-pages/man1/readelf.1.html)
    

1.  **Exercise 1**: Create a simple C program, compile it, and analyze its ELF headers using `readelf`. Identify the sections and their corresponding segments.
    
2.  **Exercise 2**: Write a program that uses the `.bss`, `.data`, and `.rodata` sections. Use `readelf` to see how these sections are mapped into segments.
    
3.  **Exercise 3**: Explore the program headers of a shared library and compare them to those of an executable. Note the differences in segment mappings.
    

### Subscribe to Low-Level Lore

Exploring the depths of system internals, low-level programming, and the hidden mechanics of computers, from C and assembly to databases and beyond