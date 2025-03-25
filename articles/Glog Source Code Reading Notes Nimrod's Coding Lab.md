# Glog Source Code Reading Notes | Nimrod's Coding Lab
This post is based on [_glog v0.5.0_](https://github.com/google/glog/tree/v0.5.0). I use GCC 7.5(most C++17 features supported) on a 64-bit ubuntu 18.04 machine. There may be some differences for different compilers or platforms. The codes presented in this post will be simplified for clarity’s sake.

How the `LOG()` Macro Works
---------------------------

The basic usage of glog is the `LOG` macro. For example,

```cpp
#include <glog/logging.h>
int main(int argc, char** argv) {
  ::google::InitGoogleLogging(argv[0]);
	LOG(INFO) << "Basic usage.";
}

```

Set the environment variable for outputting to stderr and execute the binary.

```bash
$ GLOG_logtostderr=1 ./a.out
I20220310 14:51:34.659883 19515 example.cc:4] Basic usage.

```

Here is the definition:

```cpp
#define LOG(severity) COMPACT_GOOGLE_LOG_ ## severity.stream() 
#define COMPACT_GOOGLE_LOG_INFO google::LogMessage(__FILE__, __LINE__)

```

Then the original statement is expanded to

```cpp
google::LogMessage(__FILE__, __LINE__).stream() << "Basic usage.";

```

For every call `LOG(INFO)`, a temporary `google::LogMessage` object is constructed (1) and its member function `stream()` is called(2).

```cpp
std::ostream& LogMessage::stream() {
  return data_->stream_;
}

```

It returns a reference to a [`std::ostream`](https://en.cppreference.com/w/cpp/io/basic_ostream). After a chain of operator« is called(3), the temporary object is destroyed(4). We take a deep inside look into this process.

### Constructor of `LogMessage`

```cpp
class LogMessage {
public:
  LogMessage(const char* file, int line): allocated_(NULL) {
    Init(file, line, GLOG_INFO, &LogMessage::SendToLog);
  }
private:
  LogMessageData* allocated_;
  LogMessageData* data_;
};

```

`LogMessage` has two pointers to `LogMessageData`, a nested class declared inside. It stores log data.

```cpp
struct LogMessage::LogMessageData {
  // Buffer space; contains complete message text.
  char message_text_[LogMessage::kMaxLogMessageLen+1];
  LogStream stream_;
  void (LogMessage::*send_method_)();  // Call this in destructor to send
  ...
};

```

Besides listed above, it also stores file name, line number, timestamp, etc.

See the constructor of `LogMessage`.

```cpp
LogMessage::LogMessage(const char* file, int line)
    : allocated_(NULL) {
  Init(file, line, GLOG_INFO, &LogMessage::SendToLog);
}

void LogMessage::Init(const char* file,
                      int line,
                      LogSeverity severity,
                      void (LogMessage::*send_method)()) {
  allocated_ = NULL;
  if (severity != GLOG_FATAL || !exit_on_dfatal) {
    if (thread_data_available) {
      thread_data_available = false;
      data_ = new (&thread_msg_data) LogMessageData;
    }
    data_->first_fatal_ = false;
  }

  stream().fill('0');
  data_->preserved_errno_ = errno;
  data_->severity_ = severity;
  ... // set other fields in data_
  data_->has_been_flushed_ = false;
  
  ... // start insert characters into stream_
}

```

Typically, one `LogMessage` instance exists per thread since its lifetime will end after the statement. To avoid the extra (frequent) heap allocation when every logging, glog uses a thread-local memory for storing the stream.

```cpp
static thread_local bool thread_data_available = true;
static thread_local std::aligned_storage<sizeof(LogMessage::LogMessageData),
                         alignof(LogMessage::LogMessageData)>::type thread_msg_data;

```

`data_` is **placement new** directly into the address of `thread_msg_data`, and this storage is unavailable now . In the constructor of `LogMessagaData`,

```fallback
LogMessage::LogMessageData::LogMessageData()
  : stream_(message_text_, LogMessage::kMaxLogMessageLen, 0) {
}

```

`stream_` is an instance of the class `LogStream`, declared inside `LogMessage`. It inherits publicly from the class `std::ostream`. Notice the char array`message_text_[]`, it’s the buffer space to store the stream. When `LogMessageData` is constructed, `stream_` will set its associated buffer. The class `LogStream` has no significant difference with `std::ostream`. See internal implementation.

```cpp
class LogStream : public std::ostream {
public:
  LogStream(char *buf, int len, uint64 ctr)
    : std::ostream(NULL),
      streambuf_(buf, len),
      ctr_(ctr),
      self_(this) {
    rdbuf(&streambuf_);
  }
private:
  base_logging::LogStreamBuf streambuf_;
  uint64 ctr_;  // Counter hack (for the LOG_EVERY_X() macro)
  LogStream *self_;  // Consistency check hack
};

class LogStreamBuf : public std::streambuf {}

```

`LogStream` maintains a `LogStreamBuf` instance and a counter `ctr`. `LogStreamBuf` inherits from `std::streambuf` . It ignores _overflow_ and leaves two bytes and the buffer end.

Back to the `Init` function, after all the fields in `data_` are set, the `stream_` is filled with prefix. The prefix pattern is “_log level, GMT year, month, date, time, thread\_id, file basename, line_” by default, “_I20220310 14:51:34.659883 19515 example.cc:4\]_” in our case.

```cpp
stream() << LogSeverityNames[severity][0]
         << setw(4) << 1900+data_->tm_time_.tm_year
         << ...

```

### Destructor of `LogMessage`

So when calling a chain of `operator<<`s after `LOG`， you’re inserting them into the `message_text_` in `data_`. These messages are buffered now, and they aren’t printed out (or written to other destinations) until the `LogMessage` object is destroyed.

```cpp
LogMessage::~LogMessage() {
  Flush(); // flush out the msg
  if (data_ == static_cast<void*>(&thread_msg_data)) {
    data_->~LogMessageData();
    thread_data_available = true;
  }
}

```

The `Flush` function can be split up into two parts,

*   add a trailing newline character if necessary
*   log the stored messages(to files, to stderr…), _send method_ in glog.

After that, all data is cleaned up.

#### Append the Trailing ‘\\n’

Here is the simplified code.

```cpp
void LogMessage::Flush() {
  data_->num_chars_to_log_ = data_->stream_.pcount();
  bool append_newline =
      (data_->message_text_[data_->num_chars_to_log_-1] != '\n');
  char original_final_char = '\0';
  if (append_newline) {
    original_final_char = data_->message_text_[data_->num_chars_to_log_];
    data_->message_text_[data_->num_chars_to_log_++] = '\n';
  }
  // send method
  if (append_newline) {
    data_->message_text_[data_->num_chars_to_log_-1] = original_final_char;
  }
}

```

If the last character is already `'\n'`, there is no need for appending. Otherwise, replace the character next to the last message with a `'\n'`.

Interestingly, however, if the trailing newline is inserted after the send method is called, all messages are logged, the buffer is reverted. Comments saying,

> // Fix the ostrstream back how it was before we screwed with it.
> 
> // It’s 99.44% certain that we don’t need to worry about doing this.

_I have no idea why it is doing since the storage of `data_` will be cleaned up after `Flush`. If you happen to know, please leave me a comment or e-mail me._

#### Send Method

```cpp
void LogMessage::Flush() {
  ... // append \n
  {
    MutexLock l(&log_mutex);
    (this->*(data_->send_method_))();
  }
  ... // still deal with \n
}

```

Recall the last parameter in the `LogMessage::Init`, `void (LogMessage::*send_method)()` is a pointer to a member of `LogMessage,` and it’s assigned to `data_->send_method_`. In the **most common** cases, it’s `LogMessage::SendToLog`.

```cpp
void LogMessage::SendToLog() {
  if (FLAGS_logtostderr || !IsGoogleLoggingInitialized()) {
    ColoredWriteToStderr(data_->severity_,
                         data_->message_text_, data_->num_chars_to_log_);
  }
}

```

The C API [`fwrite`](https://en.cppreference.com/w/c/io/fwrite) is called for writing the message to stderr in `ColoredWriteToStderr`.

```cpp
fwrite(message, len, 1, stderr);

```

Writing to Files
----------------

Logs dumped into files are more common in practical use. The flag `log_dir` controls this behavior. If not specified, logs will be written to a default directory, usually under `/tmp`.

```bash
$ GLOG_log_dir=./ ./a.out

```

Now, the same messages are written to files under the current directory.

Pay attention to two things here,

*   When the file is created
*   When the message is logged

Let’s continue with the `SendToLog` function. If we don’t decide to log to stderr, the static function `LogDestination::LogToAllLogfiles` will be called.

```cpp
void LogMessage::SendToLog() {
  if (FLAGS_logtostderr || !IsGoogleLoggingInitialized()) {
   ...
  } else {
    LogDestination::LogToAllLogfiles(data_->severity_, data_->timestamp_,
                                     data_->message_text_,
                                     data_->num_chars_to_log_);
  }
}

```

`LogDestination` is a _singleton-like_ class. Only `NUM_SEVERITIES` global instances can be accessed separately for each severity, other than a single one. Let’s take a look.

```cpp
class LogDestination {
public:
  friend class LogMessage;
private:
  LogDestination(LogSeverity severity, const char* base_filename) {
    : fileobject_(severity, base_filename),
    logger_(&fileobject_) {}
    
  LogFileObject fileobject_;
  base::Logger* logger_;      // Either &fileobject_, or wrapper around it
  static void LogToAllLogfiles(LogSeverity severity,
                               time_t timestamp,
                               const char* message, size_t len);
  static LogDestination* log_destination(LogSeverity severity) {
    if (!log_destinations_[severity]) {
      log_destinations_[severity] = new LogDestination(severity, NULL);
    }
    return log_destinations_[severity];
  }

  static LogDestination* log_destinations_[NUM_SEVERITIES];
};

LogDestination* LogDestination::log_destinations_[NUM_SEVERITIES];

```

`LogDestination` has its constructor as private. The only four instances stay in its static member `log_destinations_[4]`, and they are _lazy-initialized_ until they’re first accessed.

`LogToAllLogfiles` is a private static interface, and a friend class LogMessage calls it. Messages will be written to files no larger than the `severity`.

```cpp
// LogToAllLogfiles
for (int i = severity; i >= 0; --i) {
  LogDestination* destination = log_destination(severity);
  destination->logger_->Write(should_flush, timestamp, message, len);
}

```

It calls `Write()` of member `logger_`, a pointer to `fileobject_`. The member `fileobjec_` has a type that inherits from the interface `Logger`.

```cpp
class Logger {
 public:
  virtual ~Logger();
  virtual void Write(bool force_flush,
                     time_t timestamp,
                     const char* message,
                     int message_len) = 0;
  virtual void Flush() = 0;
  virtual uint32 LogSize() = 0;
};
class LogFileObject : public base::Logger {};

```

Glog introduces `Logger` as an interface for emitting entries to a log, and the derived class `LogFileObject` handles all file-system stuff. Now deep into the `Write` function.

```cpp
// LogFileObject::Write {
  MutexLock l(&lock_); 
  if (file_ == NULL) {
    ostringstream time_pid_stream;
		... // set time_pid_stream
    const string& time_pid_string = time_pid_stream.str();

    {
      // set base name
      stripped_filename = ...
      const vector<string> & log_dirs = GetLoggingDirectories();
      for (vector<string>::const_iterator dir = log_dirs.begin();
           dir != log_dirs.end(); ++dir) {
        base_filename_ = *dir + "/" + stripped_filename;
        if ( CreateLogfile(time_pid_string) ) {
          break;
        }
      }
    }
    ostringstream file_header_stream;
    file_header_stream << "Log file created at: " << ...;
    const string& file_header_string = file_header_stream.str();

    const int header_len = file_header_string.size();
    fwrite(file_header_string.data(), 1, header_len, file_);
  }

  // Write to LOG file
  if ( !stop_writing ) {
    fwrite(message, 1, message_len, file_);
  }
}

```

In this code fragment, a log file is created if it does not exist, and use `fwrite` to append into this file. So the answers to the two questions above should be

*   When the first `LogMessage` is destroyed.
*   Whenever `Log` is called.

Conditional Logging
-------------------

Glog also provides some useful macros for logging only if some conditions are met, like:

```cpp
LOG_IF(INFO, x > 0) << "x is positve";
LOG_EVERY_N(INFO, 50) << "Logged every 50 occurances.";
LOG_FIRST_N(INFO, 50) << "Only first 50 occurances are logged."

```

`LOG_IF` is relative simple. Its definition looks like

```cpp
#define LOG_IF(severity, condition) if (conditon) ? (void) 0 : LOG(severity)

```

The actual definition adds some other expression to suppress compiler warnings. If you’re interested, see [here](https://github.com/google/glog/blob/v0.5.0/src/glog/logging.h.in#L653-L655).

### LOG\_EVERY\_N

This macro is expanded to the following on my machine. (It’s a [bug](https://github.com/google/glog/pull/671) fixed in v0.6.0, if you’re using C++11 or above, add `-DHAVE_CXX11_ATOMIC` during compiling manually.)

```cpp
static std::atomic<int> occurrences_10(0), occurrences_mod_n_10(0);
++occurrences_10;
if (++occurrences_mod_n_10 > (50)) 
  occurrences_mod_n_10 -= (50);
if (occurrences_mod_n_10 == 1)
  google::LogMessage( "1.cpp", 10, google::GLOG_INFO, occurrences_10, &google::LogMessage::SendToLog).stream() << "Logged every 50 occurances.";

```

Two static `std::atmoic<int>` `occurrences_10` and `occurrences_mod_n_10`are initialized to zero. `occurrences_10` is used to count the number of this statement is called, and `occurrences_mod_n_10` is used to decide if it should log. Sadly, data race may happen since as a whole the operations aren’t atomic; I created PR on [Github](https://github.com/google/glog/pull/808).

**Only if** the corresponding requirement is met a `LogMessage` object will be created. It’s worth mentioning there is a flag `stderrthreshold` used to filter out logs under a certain level. Different from here, the `LogMessage` object is created and messages are written into the buffer. **They are skipped only when ready to call `fwrite`!** Please pay attention to it because it can still somehow slow your program. The whose statement following `<<` is still evaluated.

The constructor is slightly different from that mentioned before.

```cpp
LogMessage::LogMessage(const char* file, int line, LogSeverity severity,
                       uint64 ctr, void (LogMessage::*send_method)())
    : allocated_(NULL) {
  Init(file, line, severity, send_method);
  data_->stream_.set_ctr(ctr);  // here
}

```

It passes a `ctr` argument and sets it to `stream_.ctr`. It is only used when you append a `google::COUNTER`. For example,

```cpp
LOG_EVERY_N(INFO, 50) << "Logged every 50 occurances. This is " << google::COUNTER;

```

And the `ctr` is printed. Even though `ctr` maybe not equal to `occurance_`…

### LOG\_FIRST\_N

It’s similar to `LOG_EVERY_N`. It also has an atomic counter.

```cpp
static std::atomic<int> occurrences_10(0),
++occurrences_10;
if (occurrences_10 <= (50)) 
  ++occurrences_10;
if (occurrences_10 <= (50))
  google::LogMessage( "1.cpp", 10, google::GLOG_INFO, occurrences_10, &google::LogMessage::SendToLog).stream() << "Only first 50 occurances are logged.";

```

Thread-safe? Unfortunately not. Data race may still happen.

### Naming the Counter

There are two static local counters. Have you ever thought is there a possibility of naming collision? These two variables are named after the prefix + `__LINE__`. For different `LOG_EVERY_N`or `LOG_FIRST_N`, they are _usually_ in separate lines. These variables are declared in different scopes for calling on the same line in individual files; it’s still OK. So names will not collide. Problems will occur only if you happen to have the same name.

Thread Safety
-------------

Now, let’s talk about thread safety in glog. We start from the global variable `log_mutex`.

`Mutex` is a thin wrapper class for mutex types in different platforms. For example, it’s `pthread_rwlock_t` under POSIX. `MutexLock` is a RAII wrapper for `Mutex`. Maybe you’ve found that you have to acquire the lock whenever SendToLog, where the logging operation is executed. Only one thread can call `SendToLog` at once. So no matter writing to files or the screen, no data race will happen here. There is also a lock inside the \`LogFileObject. I think it’s designed for other public functions. If the outside mutex is already locked, there will be little effect on the runtime performance to acquire the inner lock.

Besides `log_mutex`, a `fatal_msg_lock` is defined for `LOG(FATAL)`. Logging `FATAL` messages will terminate the program. The core idea is to share the same buffer for different fatal logs.

Unlike LogMessage used in other severities, FATAL constructs a LogMessageFatal object, inheriting from `LogMessage`. It falls into another branch of the first `if` condition in `LogMessage::Init`.

```cpp
void LogMessage::Init(const char* file,
                      int line,
                      LogSeverity severity,
                      void (LogMessage::*send_method)()) {
  allocated_ = NULL;
  if (severity != GLOG_FATAL || !exit_on_dfatal) {
  } else {
    MutexLock l(&fatal_msg_lock);
    if (fatal_msg_exclusive) {
      fatal_msg_exclusive = false;
      data_ = &fatal_msg_data_exclusive;
      data_->first_fatal_ = true;
    } else {
      data_ = &fatal_msg_data_shared;
      data_->first_fatal_ = false;
    }
  }
  stream().fill('0');
  ...
}

```

```cpp
static Mutex fatal_msg_lock;
static CrashReason crash_reason;
static bool fatal_msg_exclusive = true;
static LogMessage::LogMessageData fatal_msg_data_exclusive;
static LogMessage::LogMessageData fatal_msg_data_shared;

```

There are two static `LogMessageData` instances, `fatal_msg_data_exclusive` for the first `FATAL` call and `fatal_msg_data_shared` for others. The first thread that holds the lock writes to the “exclusive” buffer, and the remaining screws up the shared one(The only usage of `fatal_msg_lock`). Never mind, only the first one counts.

There’s an extra logic at the end of the `SendToLog` function.

```cpp
void LogMessage::SendToLog() EXCLUSIVE_LOCKS_REQUIRED(log_mutex) {
  if (data_->severity_ == GLOG_FATAL && exit_on_dfatal) {
    if (data_->first_fatal_) {
      RecordCrashReason(&crash_reason);
      SetCrashReason(&crash_reason);
      const int copy = min<int>(data_->num_chars_to_log_,
                                sizeof(fatal_message)-1);
      memcpy(fatal_message, data_->message_text_, copy);
      fatal_message[copy] = '\0';
      fatal_time = data_->timestamp_;
    }
    ... // write to log files if necessary
    const char* message = "*** Check failure stack trace: ***\n";
    if (write(STDERR_FILENO, message, strlen(message)) < 0) {
      // Ignore errors.
    }
    Fail();
  }

```

The first fatal message is dumped to the global variable before it calls `Fail()`, which is `abort()`.

Ending Words
------------

By now, we have touched on some core design and implementation of glog. This post doesn’t cover _error handling_ and _customized sink_. I have to admit glog is an excellent logging library. It provides rich features, robust interfaces, and customized behaviors. It’s commonly used in industry. However, due to the historical issue (glog was created in 2008), it has drawbacks. Lots of code inside deals with backward compatibility and cross-platform; the coding style is not that modern. You can still see something like `NULL`, `thread__`. Also, because of an internal mutex, the performance is somehow affected. The `thread_local` reusable buffer is a trick for optimization. In another way, glog is well-documented. Extensive comments help me avoid struggling to understand the purpose of a specific variable or function.