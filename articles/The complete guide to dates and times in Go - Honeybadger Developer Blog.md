# The complete guide to dates and times in Go - Honeybadger Developer Blog
Dates and times are one of the most essential features of a programming language, and Go is no exception. Whether you are building a social media or a command-line application, handling dates and times correctly in your application as a developer is necessary to maintain data integrity and consistency for your users.

In this article, you will learn how to use the `time` standard library to format and perform date and time operations in Go.

Prerequisites
-------------

The only prerequisite to follow along with this article is knowing the basics of the Go language. You can read my [Go Beginners Series](https://dev.to/olodocoder/series/22330) for a quick brush-up.

Go `time` package
-----------------

One of the main reasons developers love to work with Go is its robust standard library, which contains several packages and tools you need to build any feature into your applications without employing any third-party libraries or tools. One of these packages is the `time` package, which allows you to handle dates and times in your application effectively without installing a third-party package.

In the following sections, we will explore how to use this package to perform various date and time tasks in Go, such as parsing and formatting dates, calculating durations, working with time zones, and handling date arithmetic. But first, let's look at the two main functions you'll use most of the time when handling dates and times in Go.

[![](https://www-files.honeybadger.io/pages/blog/2025-move-fast-fix-things-1920x1080.png?width=1000)
](https://www.honeybadger.io/)

_"We love Honeybadger. Not only is it a fab tool and very affordable, they feel like a partner - whenever we needed help we got FIRST CLASS service."_

Fix errors, eliminate performance bottlenecks, and dig into the details faster than ever before. With support for Ruby, Elixir, and 8 other languages, **Honeybadger is the best way to gain real-time insights into your application’s health and performance.**

### The `Parse` function

The `Parse` function converts a date string into a `time` object so you can perform other tasks with it. For example, you can get a birthday date input from your application's frontend as a string and need to extract the month and day to determine the zodiac sign. The `Parse` function takes a date string for conversion and a layout string to determine the output.

### The `Format` function

The `Format` function is used to convert a date object into a string so you can display it in a way your users understand. For example, you can do a date calculation in your code and send it back to your application's frontend in a specific date format based on your user's time zone. The `Format` function takes in the layout string, which determines the output.

Working with dates: Parsing, formatting, and manipulating
---------------------------------------------------------

There are several use cases where you need to parse, format, and manipulate dates in your Go application, from formatting them to make sense to your audience to calculating the time that a bidding offer has been on and when it'll expire. We will explore some common date-related tasks you'll encounter in your day-to-day job and how to solve them.

### Parsing dates

As mentioned above, parsing dates involves formatting a date string typically from a user to a format your Go code will understand.

### Parsing dates as `time` objects

A widespread use case of parsing dates involves when you get a birthday date from your frontend application, which will usually be in a string format, and want to convert it into a date object to perform more programmatic operations on the date. You can do so as follows:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "2002-03-01"
    layout := "2006-01-02"
    parsedDate, err := time.Parse(layout, dateStr)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(parsedDate)
} 
```

The code above defines the file as part of the package `main`, imports the `fmt` and `time` packages from the Go standard library, and defines the `dateStr` and `layout` variables—which represent the date string from the user and how the date should be formatted, respectively. Finally, the `dateStr` string is converted to a `time` object with the `Parse` function. The code should return the following result:

```
2002-03-01 00:00:00 +0000 UTC 
```

Another use case of parsing dates is when you need to extract the month, day, or year from the date string. You can do this like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "03-01-2002"
    layout := "01-02-2006"
    parsedDate, err := time.Parse(layout, dateStr)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    year, month, day := parsedDate.Date()
    fmt.Printf("Year: %d, Month: %s, Day: %d\n", year, month, day)
} 
```

The code above does the same thing as the previous one, but it uses a different layout and also prints out the year, month, and day like so:

```
Year: 2002, Month: March, Day: 1 
```

### Formatting dates

As mentioned above, formatting dates involves formatting a Go `time` object typically gotten from a finished function to a format that your users will understand. However, to grasp how to format dates properly, you need to understand how layouts work in Go.

Let's explore that in the next section.

### Understanding layouts in Go

In Go, time layouts are used to define the format of time values when parsing or formatting strings. Time layouts consist of predefined layout strings representing different time components. The following code displays how to format Go `time` objects with some commonly used time layouts:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    date := time.Now()
    fmt.Println("The ANSIC layout:", date.Format(time.ANSIC))
    fmt.Println("The UnixDate layout:", date.Format(time.UnixDate))
    fmt.Println("The RubyDate layout:", date.Format(time.RubyDate))
    fmt.Println("The RFC822 layout:", date.Format(time.RFC822))
    fmt.Println("The RFC822Z layout:", date.Format(time.RFC822Z))
    fmt.Println("The RFC850 layout:", date.Format(time.RFC850))
    fmt.Println("The RFC1123 layout:", date.Format(time.RFC1123))
    fmt.Println("The RFC1123Z layout:", date.Format(time.RFC1123Z))
    fmt.Println("The RFC3339 layout:", date.Format(time.RFC3339))
    fmt.Println("The RFC3339Nano layout:", date.Format(time.RFC3339Nano))
} 
```

The code above defines a `date` variable that contains the current date and prints it out in various ways using different layouts. The code should return the current date as follows:

```
The ANSIC layout: Mon Jun 19 10:13:58 2023
The UnixDate layout: Mon Jun 19 10:13:58 WAT 2023
The RubyDate layout: Mon Jun 19 10:13:58 +0100 2023
The RFC822 layout: 19 Jun 23 10:13 WAT
The RFC822Z layout: 19 Jun 23 10:13 +0100
The RFC850 layout: Monday, 19-Jun-23 10:13:58 WAT
The RFC1123 layout: Mon, 19 Jun 2023 10:13:58 WAT
The RFC1123Z layout: Mon, 19 Jun 2023 10:13:58 +0100
The RFC3339 layout: 2023-06-19T10:13:58+01:00 
```

So you can now use any of the formats that fit your above to parse and extract data from the `time` object instead of writing the layout as a string like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "2002-04-01T12:40:45.15Z"

    parsedDate, err := time.Parse(time.RFC3339, dateStr)
    if err != nil {
        fmt.Println("Error while parsing date :", err)
    }
    year, month, day := parsedDate.Date()
    fmt.Println("Day :", day, "Month :", month, "Year :", year)
    fmt.Println(parsedDate)
} 
```

The code above uses one of the predefined layouts in Go to parse the date and extract the year, month, and day values from the `time` object. The code should return the following result:

```
Day : 1 Month : April Year : 2002
2002-04-01 12:40:45.15 +0000 UTC 
```

Let's explore how to manipulate dates in the next section.

### Manipulating dates

You can manipulate dates in different ways, depending on your application needs. The most common use cases for date manipulation are adding to and subtracting from dates.

### Adding to dates

Go enables you to add to dates using the `AddDate` function like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    subscribedOn := time.Now()
    renewOn := subscribedOn.AddDate(1, 2, 7)
    fmt.Println("This account will be due for renewal on:", renewOn.Format(time.RFC822))
} 
```

The code above creates a `subscribedOn` variable that contains the current date and a `renewOn` variable that uses the `AddDate` function to update the date by 1 year, 2 months, and 7 days. Finally, the code prints a message with the updated date formatted with the `RFC822` layout.

The `AddDate` function takes in the number of years, months, and days. You should have `0` for the values you don't want to add to.

The result should look like the following but with the current date at runtime:

```
This account will be due for renewal on: 26 Aug 24 12:13 WAT 
```

### Subtracting from dates

To subtract from dates, you can use the `AddDate` function but with negative values like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    now := time.Now()
    previousDate := now.AddDate(0, 0, -14)
    fmt.Println("2 weeks ago was", previousDate.Format(time.RFC822))
} 
```

The code above uses the `AddDate` function with negative values to get the date of 14 days ago and prints a message with the value as follows:

```
2 weeks ago was 05 Jun 23 12:19 WAT 
```

Now that you know how to parse, format, and manipulate dates in Go, let's explore how to work with times in Go in the next section.

Time operations: Arithmetic, duration, and intervals
----------------------------------------------------

As a software engineer, there are several use cases involving working with times in your application. Whether adding and subtracting dates, delaying code execution, or measuring the time it took a function to run, knowing how to perform these tasks effectively is essential to building performant applications.

This section will explore how to perform common time-related tasks in Go.

### Time arithmetic operations

The most common time-related tasks in programming involve some arithmetic operations. In the following sections, let's explore how to perform arithmetic operations on times in Go.

### Time addition

You can add to times in Go with the `Add` function. For example, if you want a user's posts to be deleted automatically after 24 hours, you can do that like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    postCreated := time.Now()
    deletePost := postCreated.Add(24 * time.Hour)
    fmt.Println("Post will be deleted automatically on", deletePost.Format("02 January 2006 15:04:05"))
} 
```

The code above defines a `postCreated` variable that contains the current time and a `deletPost` variable that has a time value that is 24 hours higher than the `postCreated` date. The code prints a message with a formatted `deletePost` value as follows:

```
Post will be deleted automatically on 20 June 2023 13:23:44 
```

### Time subtraction

Go allows you to subtract from times using the `Add` function with negative values. For example, if you want to deduct an hour from a given time, you can do that like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    givenDate := time.Now()
    minusOneHour := givenDate.Add(-24 * time.Hour)
    fmt.Println("One hour ago was: ", minusOneHour.Format(time.RFC822))
} 
```

The code above subtracts 24 hours from the current time and prints a message based on the formatted result. The result should look like the following but based on the time at runtime:

```
One hour ago was:  18 Jun 23 13:39 WAT 
```

### Time duration

Durations are essential to working with times in Go because they represent the length of intervals. Let's explore how to work with durations in the following sections.

Duration construction
---------------------

Here's how to construct a duration in Go:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    duration := 3 * time.Hour
    fmt.Println("Duration:", duration)
} 
```

The code above creates a `duration` variable that contains a three-hour duration that you can now perform other time operations on. The code will return the following:

### Duration conversion

The `time` package allows you to convert durations to different units, and it offers methods such as `Hours()`, `Minutes()`, `Seconds()`, and `Nanoseconds()`, which return the respective duration in the specified unit. You can use them like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    duration := 2*time.Hour + 30*time.Minute

    fmt.Println("Duration in Hours:", duration.Hours())
    fmt.Println("Duration in Minutes:", duration.Minutes())
    fmt.Println("Duration in Seconds:", duration.Seconds())
    fmt.Println("Duration in Nanoseconds:", duration.Nanoseconds())
} 
```

The code above creates a `duration` variable that contains a value of 2 hours and 30 minutes and prints out the value in hours, minutes, seconds, and nanoseconds like so:

```
Duration in Hours: 2.5
Duration in Minutes: 150
Duration in Seconds: 9000
Duration in Nanoseconds: 9000000000000 
```

Manipulating time intervals
---------------------------

Time intervals represent a specific range of time between two points. Go provides the concept of intervals through the `time.Time` type and allows easy manipulation using the `time` package.

### Interval checking

You can compare time values to check if they fall within a specific interval. The `time` package provides the `Before`, `After`, and `Equal` methods to perform these comparisons like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    start := time.Now()
    end := time.Date(2023, time.August, 31, 23, 59, 59, 0, time.UTC)
    current := time.Now()

    if current.After(start) && current.Before(end) {
        fmt.Println("Current time is within the interval.")
    } else if current.Equal(start) || current.Equal(end) {
        fmt.Println("Current time is equal to the interval.")
    } else {
        fmt.Println("Current time is outside the interval.")
    }
} 
```

The code above defines a `start` variable containing the current date, an `end` variable equal to the 31st of August 2023, and a `current` variable equal to the current date. The code then checks if the `current` date is before, after, or similar to the `end` date and prints a result based on that like so:

```
Current time is within the interval. 
```

### Interval duration

Many developers are obsessed with how long it takes their programs to run; if you are like that, you can get the time it took your function to complete as follows:

```
package main

import (
    "fmt"
    "time"
)

func loop() {
    for i := 0; i < 10; i++ {
        fmt.Println(i)
    }
}

func main() {
    start := time.Now()
    loop()
    end := time.Now()

    duration := end.Sub(start)
    fmt.Println("It took loop function:", duration, "to finish")
} 
```

The code above defines a `loop` function that runs 10 times and a `duration` variable that uses the `Sub` to get the duration it took for the function to finish. The code prints a message based on this process as follows:

```
 0
1
2
3
4
5
6
7
8
9
It took loop function: 70.667µs to finish 
```

Converting time zones
---------------------

Go's `time` package provides the tools to convert time values between different time zones accurately. Below is an overview of the key functionalities that Go provides to tackle time zone operations.

*   Loading time zone data: Go relies on the International Organization for Standardization Time Zone Database to handle time zone information. The `time` package loads this database during runtime, allowing you to access and use it for time zone conversions. Here's the [entire database of global time zones](https://data.iana.org/time-zones/data/zone.tab).
    
*   Time zone initialization: Go provides the LoadLocation function, which takes a time zone identifier (such as "America/New\_York" or "Europe/London") and returns a \*time.Location value representing the corresponding time zone. This Location value can then be used to convert times to and from that time zone.
    
*   Converting time zones: Go's `time` struct provides the `In` function, which enables developers to convert a time value from one time zone to another once the Location value is obtained.
    

Now that you understand what Go provides for you to tackle handling time zones, let's see how to do it in code. For example, if you want to convert a specific date to Los Angeles, USA, time, you can do that like so:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "2023-06-13T23:31:00"
    layout := "2006-01-02T15:04:05"
    timeZone := "America/Los_Angeles"
    loc, _ := time.LoadLocation(timeZone)
    parsedDate, err := time.ParseInLocation(layout, dateStr, loc)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println("The current date and time in Los Angeles, USA is:", parsedDate)
} 
```

The code above parses a specific date to Los Angeles, USA, time. This code will return the following result, which contains the difference in hours:

```
The current date and time in Los Angeles, USA is: 2023-06-13 23:31:00 -0700 PDT 
```

Common date and time operations in Go
-------------------------------------

Now that you know how the `time` package works in Go, let's explore some of the common date and time problems and how to solve them in Go.

### Parse a date string and calculate the duration until a specific future date

Here's how to calculate the duration until a specific date from a given date string:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "2023-06-13"
    layout := "2006-01-02"
    parsedDate, err := time.Parse(layout, dateStr)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    futureDate := time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)
    duration := futureDate.Sub(parsedDate)
    fmt.Println("There's", duration.Hours(), "hours to go until 2025")
    fmt.Println("There's", duration.Minutes(), "minutes to go until 2025")
} 
```

The code above will return the minutes and hours it'll take before the given and future dates like so:

```
There's 13632 hours to go until 2025
There's 817920 minutes to go until 2025 
```

### Parse the date string and check if it is a leap year

Here's how to check if a given date's year is a leap year:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "2024-06-13"
    layout := "2006-01-02"
    parsedDate, err := time.Parse(layout, dateStr)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    year := parsedDate.Year()
    isLeapYear := (year%4 == 0 && year%100 != 0) || (year%400 == 0)
    if isLeapYear {
        fmt.Println("The year" + " " + fmt.Sprint(year) + " " + "is a Leap Year")
    } else {
        fmt.Println("The year" + " " + fmt.Sprint(year) + " " + "is a not Leap Year")
    }
} 
```

The code above will convert a given date, extract the year, check if the year is a leap year, and print a message based on the result like so:

```
The year 2024 is a Leap Year 
```

### Get the start and end of a month

Here's how to get the start and end date of a month in Go:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    currentTime := time.Now()
    firstDayOfMonth := time.Date(currentTime.Year(), currentTime.Month(), 1, 0, 0, 0, 0, time.UTC)
    lastDayOfMonth := firstDayOfMonth.AddDate(0, 1, -1)

    fmt.Println("First day of the month:", firstDayOfMonth)
    fmt.Println("Last day of the month:", lastDayOfMonth)
} 
```

The code above will return the start and end dates of the month at runtime as follows:

```
First day of the month: 2023-06-01 00:00:00 +0000 UTC
Last day of the month: 2023-06-30 00:00:00 +0000 UTC 
```

### Calculate the difference between two dates

Here's how to calculate between two dates in Go:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    firstDate := time.Date(2022, time.June, 1, 0, 0, 0, 0, time.UTC)
    secondDate := time.Date(2023, time.June, 1, 0, 0, 0, 0, time.UTC)

    duration := secondDate.Sub(firstDate)
    fmt.Println("Difference in days:", duration.Hours()/24)
} 
```

The code above will return the difference between both dates in days like this:

### Format time in a relative time format

Here's how to format time in a relative time format—for example, two hours ago—in Go:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    pastTime := time.Now().Add(-2 * time.Hour)
    duration := time.Since(pastTime)

    var formattedTime string
    if duration.Hours() < 24 {
        formattedTime = fmt.Sprintf("%.0f hours ago", duration.Hours())
    } else {
        days := int(duration.Hours()) / 24
        formattedTime = fmt.Sprintf("%d days ago", days)
    }

    fmt.Println(formattedTime)
} 
```

The code above will return the time in a relative format like this:

### Format a duration in hours, minutes, and seconds with leading zeros

Here's how to format a duration with leading zeros to make it more readable in Go:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    duration := time.Hour*2 + time.Minute*3 + time.Second*4
    formattedDuration := fmt.Sprintf("%02d:%02d:%02d", int(duration.Hours()), int(duration.Minutes())%60, int(duration.Seconds())%60)
    fmt.Println(formattedDuration)
} 
```

The code above will return the given duration as follows:

### Parse a date string and extract the day of the week

You can extract the day of the week from a date using the `WeekDay` function as described below:

```
package main

import (
    "fmt"
    "time"
)

func main() {
    dateStr := "2023-06-19"
    layout := "2006-01-02"
    parsedDate, err := time.Parse(layout, dateStr)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    dayOfWeek := parsedDate.Weekday()
    fmt.Println("Day of the week:", dayOfWeek)
} 
```

The code above will return the day of the given date like this:

Conclusion
----------

As a software engineer, it is essential to know how to work with dates and times. In this article, you learned the `time` package in Go and how it helps you parse, format, and manipulate dates. You also explored how to perform arithmetic, interval, and duration tasks with times and reviewed solutions to common time and date tasks in Go.

And that's it! I hope this article achieved its aim of teaching you everything you need to know about dates and times and how to work with them in Go. Thank you so much for reading!