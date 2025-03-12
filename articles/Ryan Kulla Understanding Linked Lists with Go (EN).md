# Ryan Kulla: Understanding Linked Lists with Go (EN)
I like to revisit the basics a lot. One of my favorites to revisit are the variable-length sequences known as **linked lists**. They are also used as the building blocks of some other important data structures like stacks and queues. Go is my favorite to demonstrate them with since the language doesn't get in the way.

Go already has variable-length sequences (slices) and hash tables (maps) built in, as those are the two most commonly used data structures that will solve most of your real-world problems. Indeed, slices generally provide a better alternative to linked lists in Go and still allow you to create stacks and queues. Although slices are simpler and quicker, knowing about linked lists is still a fundamental concept in programming.

You first need a basic understanding of [pointers](https://tour.golang.org/moretypes/1) and [methods](https://tour.golang.org/methods/1) in Go, so brush up on those if you need to and continue when you're ready.

The key advantage of linked lists is that, unlike arrays, you don't have to predefine how big they are. This is why slices are an alternative to linked lists since they can also grow arbitrarily in size, thanks to the `append()` built-in. Let's forget about slices for now and learn about linked lists.

The most basic linked list is a "chain of nodes" that only point forward, known as a "singly" linked list. Let's unpack what that means:

*   A linked list is a list of nodes that are linked together like a chain.
*   A Node is a composite type where one field holds a piece of data you care about and another field points to the next node in the list.
*   The last node in the list has its _next_ field set to nil so that we know it's the end of the chain.

Pseudocode
----------

In my opinion the best way to learn linked lists is to see the most basic form and in pseudocode before looking at real code.

A singly linked list at a minimum is just two structs and a method to append new nodes. (In class-based languages like Java, it'd be two classes instead of structs). So we start with two structs; One struct to hold our actual data - which is just a string in our example and another struct to wrap our first link in the chain (the "head"). Pseudocode:

```
struct Node
 data string next \*Node struct List
 head \*Node 
```

The List struct is what we'll create an instance of and attach our methods to:

```
method List Append(newNode \*Node) if List.head == null // No head yet so create it
 List.head = newNode
 else // Already have a head; add new node to next link in chain
 currentNode = List.head // start from head
 while (currentNode.next != null) currentNode = currentNode.next // loop 'til very end
 
 // Now currentNode is set to last node in list.
 // Assign to last node's "next" field to append the node
 currentNode.next = newNode 
```

Next we'll look at what this looks like in Go and build on it.

Go Version
----------

```
package main import "fmt"

// A Node contains data and a link to the next node.
// The \`next\` field is same type as the struct, which is legal 
// because it's a pointer. Otherwise it'd give an error about
// "invalid recursive type Node".
type Node struct {
 data string
 next \*Node
}

type List struct {
 head \*Node }

func (l \*List) Append(newNode \*Node) {
 if l.head == nil {
 l.head = newNode
 return
 } currentNode := l.head
 for currentNode.next != nil {
 currentNode = currentNode.next
 }
 currentNode.next = newNode } func main() {
 l := &List{} l.Append(&Node{data: "foo"})
 l.Append(&Node{data: "bar"})
 l.Append(&Node{data: "baz"})

 fmt.Printf("first=%+v\\n", l.head)
 fmt.Printf("second=%+v\\n", l.head.next) fmt.Printf("third=%+v\\n\\n", l.head.next.next)/ Better yet, loop through the list
 // instead of manually chaining .next's
 for e := l.head; e != nil; e = e.next {
 fmt.Printf("e=%+v\\n", e) }
} 
```

Outputs:

    first=&{data:foo next:0xc42000a0a0}
    second=&{data:bar next:0xc42000a0c0}
    third=&{data:baz next:<nil>}

    e=&{data:foo next:0xc42000a0a0}
    e=&{data:bar next:0xc42000a0c0}
    e=&{data:baz next:<nil>}

Conveniently, the zero-value for pointers in Go is nil, which is exactly what we want \`next\` and \`head\` to be by default. So we can simply check if these fields were set or not yet, keeping our code more concise.

Ok, you've made a singly linked list! Pretty straight forward huh? (Pun intended).

Further Exploring
-----------------

Make sure you really understand what's happening so far. Once you do you can easily build on that knowledge by learning more about linked lists and then about stacks, queues, trees, and other data structures.

Appending and other iterations through a list is in O(n) "linear" time which is slower than O(1) "constant" time of indexing. So there's a trade-off with the read performance of arrays but lists can be faster at inserts. Array values are stored one after the other in memory and nodes in a linked list can be all over the place in memory.

Of course, you don't actually have to name things as generally as **List**, **Node**, **Append**, etc. In real-world programs you'll probably have a more abstract representation such as **Comments**, **Comment**, **AddComment**, respectively.

A "circular" linked list has the last node pointing to the first node. There is also a "doubly" linked list, in which each node points to the next and the previous node. The names are pretty self-describing.

A singly linked list is fine when you only need to traverse in a forward direction (e.g. Social Media Posts). You can still sort and delete. You'll want to explore adding other common methods such as `Prepend` and `Delete`:

```
// Add a new head linked to the old head
func (l \*List) Prepend(newNode \*Node) {
    newHead := newNode
    newHead.next = l.head
    l.head = newHead
}

// Delete a node based on its data field's value
func (l \*List) Delete(data string) {
    if l.head == nil {
        return
    }

    // If the head is matched then we need a new head
    if l.head.data == data {
        // Delete head by overwriting it with next node
        l.head = l.head.next
        return
    }

    currentNode := l.head
    for currentNode.next != nil {
        if currentNode.next.data == data {
            currentNode.next = currentNode.next.next
            return
        }

        currentNode = currentNode.next
    }
}

```

A "stack" is simply a list with `Push` and `Pop` methods. Typically in Go you'd just use a slice instead of creating a linked list since it's faster and easier. Then you'd use the slice's append function to push new data to the end of the slice and you'd attach your own Pop method to return/remove that last item from the list. Hence it's a LIFO structure (Last-in, First-out). Useful for operations such as undo/redo where your list is a history of commands. Note that you will also have to handle the case of popping on an empty list which will crash the program.

Python is a good example of stacks because it provides a built-in list type. Note that it's not implemented as a linked list but neither is a Slice in Go and both can still be used similarly. Python lists already come with .append() and .pop() methods:

```
    >>> stack = \["foo", "bar"\]
    >>> stack.append("baz")
    >>> stack
    \['foo', 'bar', 'baz'\]
    >>> stack.pop()
    'baz'

```

You can add as many different kinds of methods to your lists or stacks as you need, just make sure you have the common ones that readers of your implementation will expect.

Similarly a "queue" is listed in FIFO order (First-in, First-Out). These are generally a little harder to optimize and again, you could just use a slice. Think job schedulers, paper printing, etc., where the first in line gets popped off first. You still just append items onto the list but the method is usually named `Enqueue` instead of Push. And the Pop method is named `Dequeue`. With slices you can just wrap `append` and you can dequeue using slice expressions.

Finally, it's probably worth mentioning that the Go stdlib comes with a generic doubly linked list implementation under [container/list](https://golang.org/pkg/container/list/). I'd be wary of using it unless you really needed it since it takes and returns interface{}. It can still be nice for rapidly prototyping a non-slice implementation of a list, stack or queue:

```
import (
    "container/list"
    "fmt"
)

func main() {
    stack := list.New()
    stack.PushBack(1)
    stack.PushBack("foo")
    fmt.Println(stack.Remove(stack.Back()))  // foo
    fmt.Println(stack.Remove(stack.Back()))  // 1
    fmt.Println(stack.Len())                 // 0
}

```

That's all for now. This was meant to be a basic tutorial to get you started with learning more about these things before you dive deeper into other material on data structures. I hope it helped.