# The sorting problem - by Kanaye Varma
Today we’ll discuss an age old problem in computer science- sorting. Again, this problem is exactly what it sounds like. Given some data, we want to sort it in some order. But, what is the best way to go about doing this?

This article explores different sorting algorithms and goes through which is the best and why. But it requires us to use big O notation to describe the time complexity of each algorithm, a topic you can read more about [here](https://kanaye.substack.com/p/the-big-o).

In this article, we’re going to use an array of 7 numbers.

```
A = [3, 5, -7, 4, 13, 5, -1]
```

The final aim is to sort this array in as few steps as possible. We want it sorted in increasing order, so it should look like this

```
[-7, -1, 3, 4, 5, 5, 13]
```

Great, now we have a problem and a formal definition of what we want to achieve. We can get started!

A possible solution that immediately comes to mind, would be to loop through the entire array and find the smallest item. Then we place that item in position 0 in our sorted array. We repeat this process to find the 2nd-to-smallest element, place that in position 1 in our sorted array, and keep going till we have our completely sorted array.

Here’s how that looks like in our example. Let our sorted array be S. Then the first step is to loop through the entire array and find the smallest item. That loop give us -7.

```
S = [-7]
```

We should have an array called taken that stores which indices are taken. We would use a [bitmask](https://kanaye.substack.com/p/bitmasks) for this, but that wouldn’t work if we had many numbers in the array. So, let taken\[i\] be a boolean value to determine whether A\[i\] has been placed in S.

```
taken[2] = true;
```

We use that line because A\[2\] = -7.

Now we find the smallest element A\[j\] such that taken\[j\] = false. That is A\[6\] = -1. So

```
S = [-7, -1]
```

```
taken[6] = true 
```

This process continues until we mark all elements as taken, and we get our sorted s.

```
S = [-7, -1, 3, 4, 5, 5, 13]
taken = [true, true, true, true, true, true, true]
```

Well, we’re done right? Not quite... let’s see how much time this sorting takes, shall we?

Generalise the algorithm to work on an array of n items. The algorithm has n steps. In each step, we loop to find the least unchosen item. This has time complexity O(n). Repeated n times, the total time complexity is O(n^2). Recall that this can only be considered good for n < 10K. We can definitely do much better. Real life can scale up to a million items, which would take far too long to sort. Imagine google taking more than 15 minutes to sort a million pages to show you relevant results! We must have a faster way to do this...

The beauty of the sorting problem is that it actually teaches us a nice moral lesson, which I’ll tell you first, and will make a lot of sense once you learn the final solution to the sorting problem.

> **Moral of the story**
> 
> When faced with a difficult problem, breaking it down into smaller parts and solving each part individually could provide a useful insight.

To start us off, let’s consider smaller cases of the same problem and make an observation.

*   If the array has only 1 item, it is always sorted
    
*   If the array has only 2 items, we need no more than one step to sort the array, and that is done by comparing the 2 items in it.
    

These seem like trivial observations at first, but they’ll have much used applications going forward. The final observation, however, is the most important one…

*   If I have 2 sorted arrays, I can create a third sorted array by using the following steps:
    
    *   The smallest item must be at the beginning of one of the 2 sorted arrays
        
    *   Take that smallest item and place it at the beginning of the final sorted array
        
    *   Now the 2nd smallest item must be at the beginning of one of the 2 arrays
        
    *   Repeat the process to sort the final array
        

We’ll run through the above with an example in just a minute. There’s one last, critical observation we need to make that I’m gonna state here,

*   We can repeatedly split up any array into smaller parts and sort them individually!
    

These observations come together to form merge sort. We’ll run through the steps using our initial array A as an example.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F97e896c9-bed7-4c99-ad4c-ecc1d0fb41c3_1255x433.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F97e896c9-bed7-4c99-ad4c-ecc1d0fb41c3_1255x433.png)

Our array split into 4 parts

This makes it easier to employ a divide-and-conquer strategy to sort the array.

Each part now has either one or 2 elements in it, so we sort them. Each takes no more than one step to sort.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6914238f-7690-4159-8be5-0da6722069e1_1204x139.png)


](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6914238f-7690-4159-8be5-0da6722069e1_1204x139.png)

Now remember our critical observation from before: we only need to look at the first item of 2 arrays when sorting them to find the smallest item.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F680e3e4a-94b5-411c-8fa9-ecb6e3f52429_1158x739.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F680e3e4a-94b5-411c-8fa9-ecb6e3f52429_1158x739.png)

The first 2 steps of the algorithm

Each step of our algorithm only checks the first element in each sorted sub-array that hasn’t already been taken, and uses them to form the final sorted array.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F13c70aca-56c8-4514-b932-5602e9b6e068_997x646.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F13c70aca-56c8-4514-b932-5602e9b6e068_997x646.png)

The last step complete!

We repeat the steps for each sub array.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F1335e5d2-4190-4ad1-b3d6-2a79fd296f48_916x208.png)


](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F1335e5d2-4190-4ad1-b3d6-2a79fd296f48_916x208.png)

Repeat the same steps again. Can you spot the pattern?

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F092ff118-72c5-46b3-9198-b49716130dd2_1321x646.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F092ff118-72c5-46b3-9198-b49716130dd2_1321x646.png)

Repeating the same steps as above. The first 2 steps are illustrated

If we continue this process, we have our sorted array!

Here’s what the entire process looks like…

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe30f6f8f-723a-47d7-a365-3c99d3f99943_637x324.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe30f6f8f-723a-47d7-a365-3c99d3f99943_637x324.png)

Splitting up the array and sorting it again

That’s it! Merge sort is actually that simple, we’re just splitting an array into smaller parts, then sorting those parts again!

In order to find the time complexity of the above operation, we need to go through the steps of the algorithm again.

*   The first step splits up the array into halves repeatedly. The number of ways to divide an array into 2 repeatedly is bounded by log n. In computer science, we tend to use log base 2, as I’ve mentioned [before](https://kanaye.substack.com/p/the-big-o).
    
*   Every merge test has a time complexity of O(n). The reason is because each step compares exactly n elements. If you look through the illustrations, you should be able to see why.
    
*   So we’re repeating an O(n) step log n times, giving us a totat time complexity of O(n log n)
    

This means we can now sort upto even a million items in less than a hundred million operations, which takes less than a second for a computer to perform!

One might ask, why exactly do we want to sort the list? Well, consider the book problem from [this](https://kanaye.substack.com/p/data-structures-and-algorithms) article. Summarised, we want to ask,

What is the fastest way to search for an item in an array of n items?

If our array is a general array, we have no choice but to loop through the entire thing to search for our item. But there’s a significantly faster way to search for an item if our array is sorted...

*   Check the item in the middle of the sorted array
    
*   If this item is what we’re looking for, we have our answer
    
*   Otherwise if this item is too big, since the array is sorted we can eliminate all items after this index.
    
*   Else if this item is too small, since the array is sorted we can eliminate all items before this index
    
*   Therefore every step guarantees we’ll eliminate at least half of the items in the array that are either too big or too small.
    
*   This is the same as dividing the array into halves repeatedly, so as we’ve seen before, the upper bound on the number of steps in this algorithm is O(log n), which is far faster than O(n).
    

This is called binary search, and is just one of the many applications of sorting our array. A general thing competitive coders would note,

Sorting our data before processing it usually allows us to solve the problem much faster

Solve question one of Singapore’s National Olympiad in Informatics here:

[https://github.com/noisg/noi-2024-final/blob/main/statements.pdf](https://github.com/noisg/noi-2024-final/blob/main/statements.pdf).

I managed to fully solve it within contest time :)

Here’s a hint: You won’t be able to code a fast-enough algorithm without sorting the data first. Can you think about how the data should be sorted?

I will post the solution to this problem later. But for the last part of this article, there are some interesting facts about sorting you should know.

*   The fastest possible sorting algorithm time complexity is O(n log n ) on a general array.
    
*   However, some special arrays can be sorted faster
    
*   If the largest element in the array is k, then we can use the following faster algorithm:
    
    *   Loop through the array in O(n)
        
    *   Keep an array track, where track\[i\] is the number of times the number i is used in the initial array
        
    *   Finally loop through track in O(k) to construct the sorted array
        
    *   The time complexity here is O(n+k), but it’s only useful if k is small
        
*   We can also use radix sort, that compares the numbers bit by bit. You can read about it [here](https://geeksforgeeks.org/radix-sort/). It has some disadvantages though, such as being less flexible and having inefficient operations.
    
*   Other interesting sorting algorithms include pancake sort, random sort, and quicksort. None are faster than merge sort on a general array
    

That’s all for now. I’ll be posting soon a proof that we can’t sort an array faster than O(n log n). Thanks for reading, and I’ll see you in the next one!

If you enjoy reading such content, you should sort your priorities and subscribe as soon as possible to avoid missing out on more posts from Elucidate

And if you like content like this you should share it with other curious coders.

[Share Elucidate : for the curious coder](https://kanaye.substack.com/?utm_source=substack&utm_medium=email&utm_content=share&action=share)