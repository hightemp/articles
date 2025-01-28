# Practicing cgroup v2. This is my last article about cgroup to… | by Charles Vissol | Medium
[

![](https://miro.medium.com/v2/resize:fill:44:44/1*hFiit9qS6KdMhns4A9WWjw.jpeg)






](https://medium.com/@charles.vissol?source=post_page---byline--cad6743bba0c--------------------------------)

![](https://miro.medium.com/v2/resize:fit:700/1*66xSNmNSdedGkVcBbUvsgw.png)

(Credit: Charles Vissol)

This is my last article about `cgroup` to close this subject.

The purpose of this document is to describe a set of practical commands to manage `cgroup` features.

To know simply what is your `cgroup` version, run:

```
$ mount | grep cgroup
```

Output is:

```
cgroup2 on /sys/fs/cgroup type cgroup2 (rw,nosuid,nodev,noexec,relatime,nsdelegate,memory\_recursiveprot)
```

Here it means that `cgroup` v2 is running because the `cgroup` v2 filesystem is mounted. You can't have both v1 and v2 running on your system.

When we use the `mount` command and pipe it through `grep`, we see that each of these resource controllers is mounted on its own virtual partition.

This command reminds you also that `cgroup` is a filesystem hierarchy that benefits of the `mount` options (note `nsdelegate` and `memory_recursiveprot` supported by cgroup v2).

The `/sys/fs/cgroup` is called **root control group**. This is a directory containing interface files (starting with `cgroup`) and controller-specific files such as `cpuset.cpus.effective`.

Some directories are specific to `systemd`: `init.scope`, `system.slice`, `user.slice` and in some cases `machine.slice`.

```
ls -l /sys/fs/cgroup  
total 0  
\-r--r--r--  1 root root 0 Sep  9 08:00 cgroup.controllers  
\-rw-r--r--  1 root root 0 Sep  9 08:00 cgroup.max.depth  
\-rw-r--r--  1 root root 0 Sep  9 08:00 cgroup.max.descendants  
\-rw-r--r--  1 root root 0 Sep  9 08:00 cgroup.procs  
\-r--r--r--  1 root root 0 Sep  9 08:00 cgroup.stat  
\-rw-r--r--  1 root root 0 Sep  9 07:43 cgroup.subtree\_control  
\-rw-r--r--  1 root root 0 Sep  9 08:00 cgroup.threads  
\-rw-r--r--  1 root root 0 Sep  9 08:00 cpu.pressure  
\-r--r--r--  1 root root 0 Sep  9 08:00 cpuset.cpus.effective  
\-r--r--r--  1 root root 0 Sep  9 08:00 cpuset.mems.effective  
\-r--r--r--  1 root root 0 Sep  9 08:00 cpu.stat  
drwxr-xr-x  2 root root 0 Sep  9 07:43 dev-hugepages.mount  
drwxr-xr-x  2 root root 0 Sep  9 07:43 dev-mqueue.mount  
drwxr-xr-x  2 root root 0 Sep  9 08:00 init.scope  
\-rw-r--r--  1 root root 0 Sep  9 08:00 io.cost.model  
\-rw-r--r--  1 root root 0 Sep  9 08:00 io.cost.qos  
\-rw-r--r--  1 root root 0 Sep  9 08:00 io.pressure  
\-r--r--r--  1 root root 0 Sep  9 08:00 io.stat  
\-r--r--r--  1 root root 0 Sep  9 08:00 memory.numa\_stat  
\-rw-r--r--  1 root root 0 Sep  9 08:00 memory.pressure  
\-r--r--r--  1 root root 0 Sep  9 08:00 memory.stat  
drwxr-xr-x  2 root root 0 Sep  9 07:43 proc-sys-fs-binfmt\_misc.mount  
drwxr-xr-x  2 root root 0 Sep  9 07:43 sys-fs-fuse-connections.mount  
drwxr-xr-x  2 root root 0 Sep  9 07:43 sys-kernel-config.mount  
drwxr-xr-x  2 root root 0 Sep  9 07:43 sys-kernel-debug.mount  
drwxr-xr-x  2 root root 0 Sep  9 07:43 sys-kernel-tracing.mount  
drwxr-xr-x 47 root root 0 Sep  9 08:00 system.slice  
drwxr-xr-x  3 root root 0 Sep  9 07:44 user.slice
```

Note that if you see an output like this, your system supports `cgroup` v1 controllers:

```
\> cgroup on /sys/fs/cgroup/systemd type cgroup (rw,nosuid,nodev,noexec,relatime,xattr,name=systemd)  
\> cgroup on /sys/fs/cgroup/perf\_event type cgroup (rw,nosuid,nodev,noexec,relatime,perf\_event)  
\> cgroup on /sys/fs/cgroup/net\_cls,net\_prio type cgroup (rw,nosuid,nodev,noexec,relatime,net\_cls,net\_prio)  
\> cgroup on /sys/fs/cgroup/blkio type cgroup (rw,nosuid,nodev,noexec,relatime,blkio)  
\> cgroup on /sys/fs/cgroup/freezer type cgroup (rw,nosuid,nodev,noexec,relatime,freezer)  
\> cgroup on /sys/fs/cgroup/cpu,cpuacct type cgroup (rw,nosuid,nodev,noexec,relatime,cpu,cpuacct)  
\> cgroup on /sys/fs/cgroup/devices type cgroup (rw,nosuid,nodev,noexec,relatime,devices)  
\> cgroup on /sys/fs/cgroup/rdma type cgroup (rw,nosuid,nodev,noexec,relatime,rdma)  
\> cgroup on /sys/fs/cgroup/pids type cgroup (rw,nosuid,nodev,noexec,relatime,pids)  
\> cgroup on /sys/fs/cgroup/cpuset type cgroup (rw,nosuid,nodev,noexec,relatime,cpuset)  
\> cgroup on /sys/fs/cgroup/memory type cgroup (rw,nosuid,nodev,noexec,relatime,memory)
```

With cgroups version 1, each of the resource controllers is mounted on its own virtual partition:

```
\> \[vissol@debian ~\]$ mount | grep 'cgroup'  
\> tmpfs on /sys/fs/cgroup type tmpfs (ro,nosuid,nodev,noexec,seclabel,mode=755)  
\> cgroup on /sys/fs/cgroup/systemd type cgroup (rw,nosuid,nodev,noexec,relatime,seclabel,xattr,release\_agent=/usr/lib/systemd/systemd-cgroups-agent,name=systemd)  
\> . . .  
\> . . .  
\> cgroup on /sys/fs/cgroup/freezer type cgroup (rw,nosuid,nodev,noexec,relatime,seclabel,freezer)
```

Any process has a PID and any process assigned to `cgroup` has an assigned `cgroup` filesystem in `/sys/fs/cgroup`.

To know the information about `cgroup` management for a specific PID, run the following commands (Example):

```
  
$ top | grep firefox-esr

3509 vissol    20   0 4290852 636412 201840 S   6.7   3.9  26:51.34 firefox-esr                                                              
  
$ ps -o cgroup 3509  
CGROUP  
0::/user.slice/user-1000.slice/user@1000.service/app.slice/app-firefox\\x2desr-07dd78c014ab4fe48f7395474e0b5c5e.scope

  
$ cd /sys/fs/cgroup/user.slice/user-1000.slice/user\\@1000.service/app.slice/app-firefox\\\\x2desr-07dd78c014ab4fe48f7395474e0b5c5e.scope

  
  
$ ls -l  
total 0  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.controllers  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.events  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.freeze  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.max.depth  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.max.descendants  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.procs  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.stat  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.subtree\_control  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.threads  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cgroup.type  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 cpu.pressure  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 cpu.stat  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 io.pressure  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.current  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.events  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.events.local  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.high  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.low  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.max  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.min  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.numa\_stat  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.oom.group  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.pressure  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.stat  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.swap.current  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.swap.events  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.swap.high  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 memory.swap.max  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 pids.current  
\-r--r--r-- 1 vissol vissol 0 Jul 26 08:44 pids.events  
\-rw-r--r-- 1 vissol vissol 0 Jul 26 08:44 pids.max


```

As you can see, the firefox-esr process has 4 cgroup v2 controllers assigned to it: `cpu`, `io`, `memory`, `pids`.

By default, controllers such as `cpu`are stored in `/sys/fs/cgroup/cgroup.controllers`

Example in Debian:

```
cat /sys/fs/cgroup/cgroup.controllers  
cpuset cpu io memory hugetlb pids rdma
```

`cgroup.controllers`: read-only file containing the list of controllers available in this `cgroup` and its child `cgroup` nodes. Its content matches with `cgroup.subtree_control` file.

This list is the full list of controllers available in the platform for all the `cgroup` processes (child processes of root control group).

But if you create a child `cgroup` where you want specific controllers to be enable, you need to:

1.  Enable the controllers you want to apply to child group. Here for example `cpu` and `cpuset` to control CPU consumption

```
$ cat /sys/fs/cgroup/cgroup.controllers  
cpuset cpu io memory hugetlb pids rdma  
$ sudo echo "+cpu" >> /sys/fs/cgroup/cgroup.subtree\_control  
$ sudo echo "+cpuset" >> /sys/fs/cgroup/cgroup.subtree\_control  
$ sudo echo "-io" >> /sys/fs/cgroup/cgroup.subtree\_control
```

> **Important**
> 
> Resources are distributed top-down and a `cgroup` can further distribute a resource only if the resource has been distributed to it from the parent. This means that all non-root `cgrou.subtree_control` files can only contain controllers which are enabled in the parent’s `cgroup.subtree_control` file. A controller can be enabled only if the parent has the controller enabled and a controller can’t be disabled if one or more children have it enabled.

2\. Create process sub-directory (here foo `_cgroup_` process)

```
mkdir /sys/fs/cgroup/foo/
```

Automatically, Debian populates the folder with full control files:

```
$ ll /sys/fs/cgroup/foo/  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 cgroup.controllers  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 cgroup.events  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cgroup.freeze  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cgroup.max.depth  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cgroup.max.descendants  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cgroup.procs  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 cgroup.stat  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cgroup.subtree\_control  
…​  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cpuset.cpus  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 cpuset.cpus.effective  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cpuset.cpus.partition  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cpuset.mems  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 cpuset.mems.effective  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 cpu.stat  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cpu.weight  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 cpu.weight.nice  
…​  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 memory.events.local  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 memory.high  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 memory.low  
…​  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 pids.current  
\-r—​r—​r--. 1 root root 0 Jun  1 10:33 pids.events  
\-rw-r—​r--. 1 root root 0 Jun  1 10:33 pids.max
```

The output shows files such as `cpuset.cpus` and `cpu.max`. These files are specific to the `cpuset` and `cpu` controllers. The `cpuset` and `cpu` controllers are manually enabled for the root’s (`/sys/fs/cgroup/`) _direct child control groups_ using the `/sys/fs/cgroup/cgroup.subtree_control` file.

The directory also includes general `cgroup.*` control interface files such as `cgroup.procs` or `cgroup.controllers`, which are common to all control groups regardless to enabled controllers.

The files such as `memory.high` and `pids.max` relate to the `memory` and `pids` controllers, which are in the root control group (`/sys/fs/cgroup/`), and are always enabled by default.

By default, the newly created child group inherits access to all of the system’s CPU and memory resources, without any limits.

3\. Enable the CPU-related controllers in `/sys/fs/cgroup/foo/` to obtain controllers that are relevant only to CPU

```
echo "+cpu" >> /sys/fs/cgroup/foo/cgroup.subtree\_control  
echo "+cpuset" >> /sys/fs/cgroup/foo/cgroup.subtree\_control
```

These commands ensure that the immediate child control group will _only_ have controllers relevant to regulate the CPU time distribution — not to `memory` or `pids` controllers.

4\. Create the `/sys/fs/cgroup/foo/tasks/` directory:

```
mkdir /sys/fs/cgroup/foo/tasks/
```

The `/sys/fs/cgroup/foo/tasks/` directory defines a child group with files that relate only to `cpu` and `cpuset` controllers.

5\. Inspect the newly created folder

```
$ ll /sys/fs/cgroup/foo/tasks  
\-r—​r—​r--. 1 root root 0 Jun  1 11:45 cgroup.controllers  
\-r—​r—​r--. 1 root root 0 Jun  1 11:45 cgroup.events  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.freeze  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.max.depth  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.max.descendants  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.procs  
\-r—​r—​r--. 1 root root 0 Jun  1 11:45 cgroup.stat  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.subtree\_control  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.threads  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cgroup.type  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpu.max  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpu.pressure  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpuset.cpus  
\-r—​r—​r--. 1 root root 0 Jun  1 11:45 cpuset.cpus.effective  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpuset.cpus.partition  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpuset.mems  
\-r—​r—​r--. 1 root root 0 Jun  1 11:45 cpuset.mems.effective  
\-r—​r—​r--. 1 root root 0 Jun  1 11:45 cpu.stat  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpu.weight  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 cpu.weight.nice  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 io.pressure  
\-rw-r—​r--. 1 root root 0 Jun  1 11:45 memory.pressure
```

6\. Ensure the processes that you want to control for CPU time compete on the same CPU:

```
echo "1" > /sys/fs/cgroup/foo/tasks/cpuset.cpus
```

The previous command ensures that the processes you will place in the `foo/tasks` child control group, compete on the same CPU. This setting is important for the `cpu` controller to activate.

> **Important**
> 
> The `cpu` controller is only activated if the relevant child control group has at least 2 processes which compete for time on a single CPU.

To create `cgroup` process, you need to create first a directory in the `/sys/fs/cgroup` structure.

> Info
> 
> It is recommended to create at least two levels of child control groups inside the `/sys/fs/cgroup/` root control group to maintain better organizational clarity of `cgroup` files.

But for simplification here I create only one sub-folder

```
  
$ sudo mkdir -p /sys/fs/cgroup/foo
```

Once the directory created, the directory is automatically populated by default `cgroup` v2 controllers such as `freezer` (`cgroup.freeze`), `cpu` (`cpu.pressure`, cpu.stat), `io` (`io.pressure`), `memory` (`memory.events`, `memory.low`...), `pids` (`pids.events`, `pids.max`...)...

You can modify or add any controller you want. See later in this article for more explanations around controllers and their usage in `cgroup`.

The full explanation is available in the Kernel admin guide: **Documentation/admin-guide/cgroup-v2.rst** (download the kernel source code and documentation from [kernel.org](https://kernel.org/)).

Once configured properly, you can generate a process of your own, for example you create a script with infinite loop `foo.sh`:

```
#!/bin/bash  
while :  
do  
    echo "Press \[CTRL+C\] to stop.."  
    sleep 1000  
done
```

Run the script and get its PID. Here it is `46983`.

Now insert the PID into `cgroup.procs` file into `foo` directory to assign your process to the `cgroup` you just created:

```
  
sudo ./foo.sh
```

```
\# Insert PID to assign it to the foo cgroup  
sudo echo 46983 > /sys/fs/cgroup/foo/cgroup.procs
```

After that, you can validate that you process is assigned to **foo** `cgroup`:

```
$ sudo ps -o cgroup 46983  
CGROUP  
0::/foo
```

You can see available controllers in your system by displaying:

```
$ cat /sys/fs/cgroup/cgroup.controllers
```

The output is:

```
cpuset cpu io memory hugetlb pids rdma
```

At this step we know if the controllers are available in the system. But to be sure they are available, you must display:

```
cat /sys/fs/cgroup/cgroup.subtree\_control
```

The output is (default value):

```
memory pids
```

`memory` and `pids` are enabled by default for Debian.

To display the whole cgroup hierarchy of your system, run:

```
systemd-cgls
```

The output in Debian 11.4 should be like:

```
Control group /:  
\-.slice  
├─user.slice   
│ └─user-1000.slice   
│   ├─user@1000.service   
│   │ ├─background.slice   
│   │ │ └─plasma-kglobalaccel.service   
│   │ │   └─1977 /usr/bin/kglobalaccel5  
│   │ ├─app.slice   
│   │ │ ├─app-org.kde.kate-b498c13a5e274a0c882c324e5d1f72f7.scope   
│   │ │ │ └─38353 /usr/bin/kate -b /home/vissol/Downloads/linux-5.19-rc8/Documentation/vm/numa.rst  
│   │ │ ├─app-org.kde.kate-bd04ec663c48458388b9fa5763b21475.scope   
│   │ │ │ └─36045 /usr/bin/kate -b /home/vissol/Downloads/linux-5.19-rc8/Documentation/admin-guide/tainted-kernels.rst  
│   │ │ ├─app-org.kde.kate-701de1e0f47c4040b04c2b14b0736814.scope   
│   │ │ │ └─36107 /usr/bin/kate -b /home/vissol/Downloads/linux-5.19-rc8/Documentation/admin-guide/perf-security.rst  
│   │ │ ├─xdg-permission-store.service   
│   │ │ │ └─1877 /usr/libexec/xdg-permission-store  
│   │ │ ├─app-\\x2fusr\\x2fbin\\x2fkorgac-fba6fc922f304fd892acdbd09d5c57e6.scope   
│   │ │ │ └─2059 /usr/bin/korgac -session 10dfd7e29f000165373856000000016460011\_1659082942\_32052  
│   │ │ ├─xdg-document-portal.service   
│   │ │ │ ├─1873 /usr/libexec/xdg-document-portal  
│   │ │ │ └─1883 fusermount -o rw,nosuid,nodev,fsname=portal,auto\_unmount,subtype=portal -- /run/user/1000/doc  
│   │ │ ├─app-org.kde.kate-3c8915e087fd4680ba5fed65f42a4f88.scope   
│   │ │ │ └─36427 /usr/bin/kate -b /home/vissol/Downloads/linux-5.19-rc8/Documentation/admin-guide/sysctl/vm.rst  
│   │ │ ├─app-org.kde.kate-1a49d3c474e34ad283440d3d1298394a.scope   
│   │ │ │ └─36893 /usr/bin/kate -b /home/vissol/Downloads/linux-5.19-rc8/Documentation/admin-guide/laptops/laptop-mode.rst  
│   │ │ ├─xdg-desktop-portal.service   
│   │ │ │ └─1864 /usr/libexec/xdg-desktop-portal  
│   │ │ ├─app-org.kde.kate-2b0ef5011a5344989296587e17dde86e.scope   
\[lines 1-29\]
```

A slice is a group of hierarchically organized units. A slice manages processes that are running in either **scopes** or **services**. The four default slices are as follows:

*   `-.slice`: root slice, which is the root of the whole slice hierarchy. Normally, it won't directly contain any other units. However, you can use it to create default settings for the entire slice tree.
*   `system.slice`: system services that have been started by systemd.
*   `user.slice`: user-mode services. An implicit slice is assigned to each logged-in user.
*   `machine-slice`: services dedicated to running containers or virtual machines.

If you want to see user slices, you’ll need to run the `systemd-cgls` command from _outside_ of the `cgroup` filesystem. If you `cd` into the `/sys/fs/cgroup/` directory, you won't see the user slices. The further down you go into the `cgroup` file system, the less you'll see with `systemd-cgls`.

`user-1000.slice` designation corresponds to the User ID number, here `1000`.

When `systemd-cgls` is issued without parameters, it returns the entire `cgroup` hierarchy. The highest level of the `cgroup` tree is formed by slices and can look as follows:

```
├─system  
│ ├─1 /usr/lib/systemd/systemd --switched-root --system --deserialize 20    
│ ...  
│        
├─user  
│ ├─user-1000  
│ │ └─ ...  
│ ├─user-2000  
│ │ └─ ...  
│ ...  
│       
└─machine    
  ├─machine-1000  
  │ └─ ...  
  ...
```

> **Information**
> 
> Note that machine slice is present only if you are running a virtual machine or a container.

To reduce the output of `systemd-cgls`, and to view a specified part of the hierarchy, execute:

```
$ systemd-cgls $NAME
```

`$NAME` is the resource controller you want to inspect

Example: `memory` controller

```
$ systemd-cgls memory  
memory:  
├─    1 /usr/lib/systemd/systemd --switched-root --system --deserialize 23  
├─  475 /usr/lib/systemd/systemd-journald  
\[...\]
```

> **Information**
> 
> systemd also provides the `machinectl` command dedicated to monitoring Linux containers.

Viewing resource controllers of processes

To know which resource controller are used by which processes, you need to display a dedicated process file:

```
$ cat /proc/$PID/cgroup
```

Where PID stands for the ID of the process you wish to examine. By default, the list is the same for all units started by systemd, since it automatically mounts all default controllers.

Example:

```
$ cat proc/27/cgroup  
10:hugetlb:/  
9:perf\_event:/  
8:blkio:/  
7:net\_cls:/  
6:freezer:/  
5:devices:/  
4:memory:/  
3:cpuacct,cpu:/  
2:cpuset:/  
1:name=systemd:/
```

`systemd-cgtop` provides a dynamic account of currently running cgroups ordered by their resource usage (CPU, memory, IO) use:

```
$ systemd-cgtop  
  
Control Group                                   Tasks   %CPU   Memory  Input/s Output/s  
/                                                1060  401.1    15.3G     1.0M       0B  
user.slice                                        863  376.1    12.4G        -        -  
user.slice/user-1000.slice                        863  376.0    12.4G        -        -  
user.slice/user-1000.slice/user@1000.service      669  375.1    11.2G        -        -  
system.slice                                       84   14.1     2.5G        -        -  
system.slice/anacron.service                        5    9.8     1.2G        -        -  
system.slice/NetworkManager.service                 7    1.6    13.1M        -        -  
system.slice/sddm.service                          12    1.5   136.6M        -        -  
system.slice/dbus.service                           1    1.1     5.0M        -        -  
user.slice/user-1000.slice/session-3.scope        194    1.0     1.1G        -        -  
system.slice/wpa\_supplicant.service                 1    0.0     4.0M        -        -  
system.slice/pcscd.service                          7    0.0     1.0M        -        -  
system.slice/rtkit-daemon.service                   3    0.0   608.0K        -        -  
dev-hugepages.mount                                 -      -     8.0K        -        -  
init.scope                                          1      -     7.1M        -        -  
proc-sys-fs-binfmt\_misc.mount                       -      -     4.0K        -        -  
sys-fs-fuse-connections.mount                       -      -     4.0K        -        -  
sys-kernel-config.mount                             -      -     4.0K        -        -  
system.slice/ModemManager.service                   3      -     3.6M        -        -  
system.slice/accounts-daemon.service                3      -     4.2M        -        -  
system.slice/auditd.service                         2      -     3.1M        -        -  
system.slice/avahi-daemon.service                   2      -     1.4M        -        -  
system.slice/bluetooth.service                      1      -     2.8M        -        -  
system.slice/boot-efi.mount                         -      -    20.0K        -        -  
system.slice/boot.mount                             -      -    52.0K        -        -
```

Before `cgroup` and `systemd`, controlling resources was possible using `ulimit` command and `pam_limits` module. These capabilities are always available in Linux systems.

`ulimit` is a command to allocate dynamically, inside a shell session, resources usage.

To see `ulimit` default setting, run `ulimit -a`:

```
vissol@debian:~$ ulimit -a  
real-time non-blocking time  (microseconds, -R) unlimited  
core file size              (blocks, -c) 0  
data seg size               (kbytes, -d) unlimited  
scheduling priority                 (-e) 0  
file size                   (blocks, -f) unlimited  
pending signals                     (-i) 63283  
max locked memory           (kbytes, -l) 2035929  
max memory size             (kbytes, -m) unlimited  
open files                          (-n) 1024  
pipe size                (512 bytes, -p) 8  
POSIX message queues         (bytes, -q) 819200  
real-time priority                  (-r) 0  
stack size                  (kbytes, -s) 8192  
cpu time                   (seconds, -t) unlimited  
max user processes                  (-u) 63283  
virtual memory              (kbytes, -v) unlimited  
file locks                          (-x) unlimited
```

> **Information**
> 
> The `ulimit` modifications remains only during the shell session  
> To lower resources you don't need privileges, but to higher resources, you need sudoer profile.

```
vissol@debian:~$ ulimit -f 20000  
\-bash: ulimit: file size: cannot modify limit: Operation not permitted
```

`ulimit -a` shows the current limits but also the options to limit resources.

Let’s practice now!

Imagine you want to limit the size of any new files to only 10MB, you can use `-f` option and the number of blocks in byte:

```
ulimit -f 10240
```

After that if you run `ulimit -a`, the system shows you:

```
vissol@debian:~$ ulimit -a  
. . .  
. . .  
file size               (blocks, -f) 10240  
. . .  
. . 
```

In this case, if you want to create a 11MB file an error appears:

```
vissol@debian:~$ dd if\=/dev/zero of=afile bs=1M count=11  
File size limit exceeded (core dumped)
```