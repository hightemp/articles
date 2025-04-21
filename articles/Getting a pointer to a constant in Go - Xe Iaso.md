# Getting a pointer to a constant in Go - Xe Iaso
Published on 11/25/2024, 403 words, 2 minutes to read

From least to most hacky

![](https://server.ethicalads.io/proxy/view/8271/0196578c-3427-7930-8952-098140948ec0/)

In Go, sometimes you need to get a pointer to a constant value. This is normally easy, but only if you have a _value_, not a _constant_. Let's say you or a friend are dealing with the AWS S3 API and you need to pass a value to one of the parameters:

```
_, err = s3c.PutObject(ctx, &s3.PutObjectInput{  Bucket:      "mah-bukkit",  Key:         "something",  Body:        bytes.NewReader(fileContent), }) 
```

Doing this gets you a compile error, because you need a _pointer_ to the string.

There's several ways to work around this. I'm going to go over them in order from least to most hacky.

Make those constants into values
--------------------------------

You can make a pointer to a value, but not a constant. Lift the bucket name and key values into variables:

```
bucketName := "mah-bukkit" key := "something"   _, err = s3c.PutObject(ctx, &s3.PutObjectInput{  Bucket:      &bucketName,  Key:         &key,  Body:        bytes.NewReader(fileContent), }) 
```

This works in most cases, but you have to declare variables every time. This can look odd.

The `aws.String` / `aws.Type` functions:
----------------------------------------

The [`aws` package](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2) exposes some [helper functions](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws#hdr-Value_and_Pointer_Conversion_Utilities) that do this conversion for you. You'll see these in the example code:

```
_, err = s3c.PutObject(ctx, &s3.PutObjectInput{  Bucket:      aws.String("mah-bukkit"),  Key:         aws.String("something"),  Body:        bytes.NewReader(fileContent), }) 
```

This works because function arguments are treated as values:

```
package aws   func String(val string) *string {
 return &val } 
```

Making your own generic pointer to anything function
----------------------------------------------------

Something else you can do is use Go generics to make a "get me the pointer of this" function:

```
func p[T any](val T) (*T) {
 return &val } 
```

Then you can use it as normal:

```
_, err = s3c.PutObject(ctx, &s3.PutObjectInput{  Bucket:      p("mah-bukkit"),  Key:         p("something"),  Body:        bytes.NewReader(fileContent), }) 
```

The Kubernetes trick
--------------------

Making variables and passing things as arguments to functions aren't the only way to do this, there's also a trick I learned by reading Kubernetes source code. I'll paste an example and then explain how it works:

```
raised := &[]string{"foo"}[0] 
```

This works by creating an anonymous string slice with one member `"foo"`, grabs the first element of that slice, and gets the pointer to it. This makes the code look kinda cursed:

```
_, err = s3c.PutObject(ctx, &s3.PutObjectInput{  Bucket:      &[]string{"mah-bukkit"}[0],  Key:         &[]string{"something"}[0],  Body:        bytes.NewReader(fileContent), }) 
```

However every step in this is perfectly logical.

* * *

Facts and circumstances may have changed since publication. Please contact me before jumping to conclusions if something seems wrong or unclear.

Tags:

Copyright 2012-2025 Xe Iaso. Any and all opinions listed here are my own and not representative of any of my employers, past, future, and/or present.

Served by xesite v4 (/app/xesite) with site version [d913956e](https://github.com/Xe/site/commit/d913956e760d076ff7f72622871f3fd59d8a3a8e) , source code available [here](https://github.com/Xe/site).