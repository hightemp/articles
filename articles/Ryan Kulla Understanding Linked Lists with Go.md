# Ryan Kulla: Understanding Linked Lists with Go
Мне нравится часто возвращаться к основам. Одна из моих любимых тем для повторного изучения — последовательности переменной длины, известные как **связанные списки**. Они также используются в качестве строительных блоков для некоторых других важных структур данных, таких как стеки и очереди. Я предпочитаю демонстрировать их на Go, потому что этот язык не мешает.

В Go уже встроены последовательности переменной длины (слайсы) и хеш-таблицы (карты), так как это две наиболее часто используемые структуры данных, которые помогут решить большинство ваших реальных задач. Действительно, слайсы в Go обычно являются лучшей альтернативой связанным спискам и при этом позволяют создавать стеки и очереди. Хотя слайсы проще и быстрее, знание о связанных списках по-прежнему является фундаментальной концепцией программирования.

Сначала вам нужно получить базовое представление о [указателях](https://tour.golang.org/moretypes/1) и [методах](https://tour.golang.org/methods/1) в Go, так что освежите свои знания, если нужно, и продолжайте, когда будете готовы.

Ключевое преимущество связанных списков в том, что, в отличие от массивов, вам не нужно заранее определять их размер. Именно поэтому срезы являются альтернативой связанным спискам, поскольку они также могут произвольно увеличиваться в размере благодаря `append()` встроенной функции. Давайте пока забудем о срезах и поговорим о связанных списках.

Самый простой связанный список — это «цепочка узлов», которые указывают только вперёд, известная как «однонаправленный» связанный список. Давайте разберёмся, что это значит:

*   Связанный список — это список узлов, которые связаны между собой, как звенья цепи.
*   Узел — это составной тип, в котором одно поле содержит интересующие вас данные, а другое поле указывает на следующий узел в списке.
*   У последнего узла в списке поле _next_ равно нулю, чтобы мы знали, что это конец цепочки.

Псевдокод
---------

На мой взгляд, лучший способ изучить связанные списки — посмотреть на самую базовую форму и псевдокод, прежде чем переходить к реальному коду.

Минимальный набор для односвязного списка — это две структуры и метод для добавления новых узлов. (В языках на основе классов, таких как Java, это были бы два класса вместо структур). Итак, начнём с двух структур: одна структура для хранения фактических данных — в нашем примере это просто строка, а другая структура для хранения первого звена в цепочке («головы»). Псевдокод:

```
struct Node
  data string
  next \*Node

struct List
  head \*Node

```

The List struct is what we'll create an instance of and attach our methods to:

```
method List Append(newNode \*Node)
  if List.head == null
    // No head yet so create it
    List.head = newNode
  else
    // Already have a head; add new node to next link in chain
    currentNode = List.head  // start from head
    while (currentNode.next != null)
      currentNode = currentNode.next // loop 'til very end
    
    // Now currentNode is set to last node in list.
    // Assign to last node's "next" field to append the node
    currentNode.next = newNode

```

Next we'll look at what this looks like in Go and build on it.

Go Version
----------

```
package main

import "fmt"

// A Node contains data and a link to the next node.
// The \`next\` field is same type as the struct, which is legal 
// because it's a pointer. Otherwise it'd give an error about
// "invalid recursive type Node".
type Node struct {
    data string
    next \*Node
}

type List struct {
    head \*Node
}

func (l \*List) Append(newNode \*Node) {
    if l.head == nil {
        l.head = newNode
        return
    }

    currentNode := l.head
    for currentNode.next != nil {
        currentNode = currentNode.next
    }
    currentNode.next = newNode
}

func main() {
    l := &List{}
    l.Append(&Node{data: "foo"})
    l.Append(&Node{data: "bar"})
    l.Append(&Node{data: "baz"})

    fmt.Printf("first=%+v\\n", l.head)
    fmt.Printf("second=%+v\\n", l.head.next)
    fmt.Printf("third=%+v\\n\\n", l.head.next.next)

    // Better yet, loop through the list
    // instead of manually chaining .next's
    for e := l.head; e != nil; e = e.next {
        fmt.Printf("e=%+v\\n", e)
    }
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