# GPerfTools | Profiling with GPerfTools | RidgeRun
Introduction
------------

Gperftools is a set of tools for performance profiling and memory checking. One of the main advantages of the CPU profiler is a very nice graphical output, low overhead, and very simple use (the profiled application doesn't require any recompilation, and the profiling is enabled by simply preloading the profiler's library also an optional library linking is possible when compiling).

Installation
------------

Install the library packages from the GitHub repository

```
git clone https://github.com/gperftools/gperftools
cd gperftools
./autogen.sh
./configure
make
sudo make install
```

On debian-based systems the complementary tools are packaged under the google-perftools package. For graphical output you also need graphviz installed:

```
sudo apt-get install google-perftools graphviz
```

Note that all the tools have the “google-” prefix under debian - the prefix may be missing on other systems (and is also missing in the official documentation).

Profiling with gperftools
-------------------------

### CPU

#### A) Profile the whole process runtime

**1.** To start profiling run:

**LD\_PRELOAD:** Path to the libprofiler.so usually located at /usr/local/lib/ or /usr/lib/x86\_64-linux-gnu for 64 bit systems.

**CPUPROFILE:** Name of the output log file

```
LD\_PRELOAD=/usr/local/lib/libprofiler.so CPUPROFILE=test.prof ./path/to/bin
```

*   **Note:** Application example for gst-launch-1.0:

```
LD\_PRELOAD=/usr/local/lib/libprofiler.so CPUPROFILE=test.prof gst-launch-1.0 videotestsrc ! fakesink
```

**2.** Keep the application open or running until it finishes, in this mode if the execution is canceled for example with Ctrl+C the output file will not be generated.

**3.1** Once the application ended the _test.prof_ file contains the CPU profile information. To get a graphical output run:

```
google-pprof --gv ./path/to/bin test.prof
```

**3.2** Also as an alternative viewer you can display it to a web browser by running:

```
google-pprof --web ./path/to/bin test.prof
```

**4.** To generate a PDF report with the previous graphic output run:

```
google-pprof --pdf ./path/to/bin test.prof > output.pdf
```

*   **Note:** Application example using gst-launch-1.0 as path/to/bin

To get a graphical output run:

```
google-pprof -gv /usr/bin/gst-launch-1.0 test.prof
```

To display it in a web browser run:

```
google-pprof --web /usr/bin/gst-launch-1.0 test.prof
```

To generate a PDF report with the previous graphic output run:

```
google-pprof --pdf /usr/bin/gst-launch-1.0 test.prof > output.pdf
```

  
Example graphical output:  

[![](https://developer.ridgerun.com/wiki/images/thumb/c/c6/Example_output_gperftools.png/700px-Example_output_gperftools.png)
](https://developer.ridgerun.com/wiki/index.php/File:Example_output_gperftools.png)

#### B) Profile part of process runtime

In addition to defining the environment variable **CPUPROFILE** you can also define **CPUPROFILESIGNAL**. This allows profiling to be controlled via the signal number that you specify. The signal number must be unused by the program under normal operation. Internally it acts as a switch, triggered by the signal, which is off by default.

**1.** To start profiling run:

```
LD\_PRELOAD=/usr/local/lib/libprofiler.so CPUPROFILE=test.prof CPUPROFILESIGNAL=12 ./path/to/bin
```

**2.** Leave the program running until you want to start the profiling process. Then send the signal:

**2.1** You can use **htop** program to send the signal to the desired process:

[![](https://developer.ridgerun.com/wiki/images/thumb/b/bd/Bev_htop.png/600px-Bev_htop.png)
](https://developer.ridgerun.com/wiki/index.php/File:Bev_htop.png)

**2.2** Also you can use **killall** command to send the _\-12_ signal

```
killall -12 /path/to/bin
```

**3.** Leave the program until the point you want to profile it, then run again:

```
killall -12 /path/to/bin
```

You will notice the following output when the output file was correctly generated:

```
Using signal 12 as cpu profiling switch
PROFILE: interrupts/evictions/bytes = 4773/1826/231936
```

**4.** Once the application ended the _test.prof.0_ file contains the CPU profile information. To get a graphical output run:

```
google-pprof -gv ./path/to/bin test.prof
```

#### C) Profile specific section of source code

**1.** Add the header file in your code:

```
#include <gperftools/profiler.h>
```

**2.** Add the following function calls around the code you want to profile:

```
ProfilerStart("output\_inside.prof"); 



ProfilerStop(); 
```

**3.** When compiling you will need to link against the profiling library.

You can check the needed library flags by running:

```
fsolano@ridgerun-laptop:build$ pkg-config --libs libprofiler
-L/usr/local/lib -lprofiler
```

If you are compiling manually, just add the **\-lprofiler** flag.

If you are using for example **meson** compilation system you can ask for the library by using:

```
profiler\_dep = dependency('libprofiler')
```

Add it to the list of your dependencies for example:

```
lib\_common\_dep = \[opencv\_dep,boost\_dep,profiler\_dep\]
```

And use the dependencies list to build the test app

```
executable('test',
           'test.cpp',
           dependencies: \[libbevlib\_dep\],
           c\_args: c\_args)
```

**4.** Run the test application, where you will see the output similar to the following:

```
fsolano@ridgerun-laptop:build$ ./test
PROFILE: interrupts/evictions/bytes = 9/0/280
PROFILE: interrupts/evictions/bytes = 7/0/584
PROFILE: interrupts/evictions/bytes = 12/0/872
PROFILE: interrupts/evictions/bytes = 9/0/712
PROFILE: interrupts/evictions/bytes = 9/0/904
PROFILE: interrupts/evictions/bytes = 7/0/464
PROFILE: interrupts/evictions/bytes = 8/0/680
```

**5.** With this method you can wait until the application execution ends, or end it with Ctrl+C.

**6.** Once the application ended the _output\_inside.prof_ file contains the CPU profile information. To get a graphical output run:

```
google-pprof -gv ./test output\_inside.prof
```

Modifying Runtime Behavior
--------------------------

You can more finely control the behavior of the CPU profiler via environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| CPUPROFILE\_FREQUENCY=x | 100 | How many interrupts/second the cpu-profiler samples. |
| CPUPROFILE\_REALTIME=1 | Not set | If set to any value (including 0 or the empty string), use ITIMER\_REAL instead of ITIMER\_PROF to gather profiles.  
In general, ITIMER\_REAL is not as accurate as ITIMER\_PROF, and also interacts badly with use of alarm(),  
so prefer ITIMER\_PROF unless you have a reason prefer ITIMER\_REAL. |

How to analyze the output
-------------------------

### Different ways to display output data

```
% google-pprof /path/to/bin out.prof                                    
% google-pprof --text /path/to/bin out.prof                             
% google-pprof --gv /path/to/bin out.prof                               
% google-pprof --gv --focus=Mutex /path/to/bin out.prof                 
% google-pprof --gv --focus=Mutex --ignore=string /path/to/bin out.prof 
% google-pprof --list=getdir /path/to/bin out.prof                      
% google-pprof --disasm=getdir /path/to/bin out.prof                    
% google-pprof --callgrind /path/to/bin out.prof                        
```

### Analyzing Text Output

Text mode has lines of output that look like this:

```
       14   2.1%  17.2%       58   8.7% std::\_Rb\_tree::find
```

Here is how to interpret the columns:

1.  Number of profiling samples in this function
2.  Percentage of profiling samples in this function
3.  Percentage of profiling samples in the functions printed so far
4.  Number of profiling samples in this function and its callees
5.  Percentage of profiling samples in this function and its callees
6.  Function name

### Node Information

Each node represents a procedure. The directed edges indicate caller to callee relations. Each node is formatted as follows:

Class Name
Method Name
local (percentage)
of cumulative (percentage)

The last one or two lines contain the timing information. (The profiling is done via a sampling method, where by default we take 100 samples a second. Therefore one unit of time in the output corresponds to about 10 milliseconds of execution time.) The "local" time is the time spent executing the instructions directly contained in the procedure (and in any other procedures that were inlined into the procedure). The "cumulative" time is the sum of the "local" time and the time spent in any callees. If the cumulative time is the same as the local time, it is not printed.

For instance, the timing information for test\_main\_thread() indicates that 118 units (about 1.18 seconds) were spent executing the code in test\_main\_thread() and 157 units were spent while executing test\_main\_thread() and its callees such as snprintf().

The size of the node is proportional to the local count. The percentage displayed in the node corresponds to the count divided by the total run time of the program (that is, the cumulative count for main()).

[![](https://developer.ridgerun.com/wiki/images/3/38/Single_node_GPerfTools.png)
](https://developer.ridgerun.com/wiki/index.php/File:Single_node_GPerfTools.png)

### Edge Information

An edge from one node to another indicates a caller to callee relationship. Each edge is labeled with the time spent by the callee on behalf of the caller. E.g, the edge from test\_main\_thread() to \_\_sqrt() indicates that of the 200 samples in test\_main\_thread(), 37 are because of calls to \_\_sqrt().

### Meta Information

The top of the display should contain some meta information like:

      /tmp/profiler2\_unittest
      Total samples: 202
      Focusing on: 202
      Dropped nodes with <= 1 abs(samples)
      Dropped edges with <= 0 samples

This section contains the name of the program, and the total samples collected during the profiling run. If the --focus option is on, the legend also contains the number of samples being shown in the focused display. Furthermore, some unimportant nodes and edges are dropped to reduce clutter. The characteristics of the dropped nodes and edges are also displayed in the legend.

### Focus and Ignore

You can ask pprof to generate a display focused on a particular piece of the program. You specify a regular expression. Any portion of the call-graph that is on a path that contains at least one node matching the regular expression is preserved. The rest of the call-graph is dropped on the floor. For example, you can focus on the vsnprintf() libc call in profiler2\_unittest as follows:

```
pprof --gv --focus=vsnprintf /tmp/profiler2\_unittest test.prof
```

  

* * *

For direct inquiries, please refer to the contact information available on our [**Contact**](https://www.ridgerun.com/contact) page. Alternatively, you may complete and submit the form provided at the same link. We will respond to your request at our earliest opportunity.  

Links to **RidgeRun Resources** and **RidgeRun Artificial Intelligence Solutions** can be found in the footer below.