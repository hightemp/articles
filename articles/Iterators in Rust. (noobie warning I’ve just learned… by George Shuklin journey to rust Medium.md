# Iterators in Rust. (noobie warning: I’ve just learned… | by George Shuklin | journey to rust | Medium
[

![](https://miro.medium.com/v2/resize:fill:47:47/1*sDbMJ28pBc0x9epC6OAOKw.jpeg)






](https://medium.com/@george.shuklin?source=post_page---byline--a73560f796ee---------------------------------------)

[

![](https://miro.medium.com/v2/resize:fill:26:26/1*Ag7TuS353F9JKOGU5tgLvA.jpeg)






](https://medium.com/journey-to-rust?source=post_page---byline--a73560f796ee---------------------------------------)

_(noobie warning: I’ve just learned this, so don’t trust anything you read here)._

Preface: Iterators in Python
----------------------------

Python iterators is an example of the extremely clumsy implementation of the elegance. It looks fine when you use them, but under the hood… Only decorators are worse.

So, what is an iterator in Python? Basically, an iterator is a `.next` function for the data which either return ‘next’ element in the data or raise the exception `StopIteration`.

(normally you should stop reading as soon as you see this kind of triple toe loop in a programming languages).

But there is more. It’s hidden somewhere in-between of Python code, but it is there. When you iterate, where do you store the ‘current’ element, or information of what is ‘next’? All iterators are stateful (with an exception of infinite iterators, which are a fancy way to make infinite loops), because every next call return you something different, and that ‘difference’ is dependent on previous calls.

So, where they are storing the state for iterators? Well, if you are writing an iterator, you can do anything you want. You can add a field with counter into an objects (even if this object has unknown type to you, this is Python), or you can use a global variable for this, or you can use a side effect (f.e. current position in operating system’s FD), or, the most sane solution, you can create a closure. In Python you use `yield` keyword, which just save your state as a closure and allow you to access it on the next call. When you do this, there is a state, but it’s so automatic, so you don’t think about it, except for a few embarrassing moments when your state is no longer valid for the object you iterate upon (f.e. appending into list you iterate over, or moving file position pointer, or calling iterator with global variable twice…).

I have a strong Python background, so for me this ‘automatic state somewhere there’ was expected, and subtle bugs due to parallel modification of object is a normal part of “be careful out there”. Not so for Rust.

I start from that ‘embarrassing self-modification’. Python has no way to protect you from this. Rust can.

When Rust start to iterate over the object, it can ‘consume’ it (e.g. use and destroy), it can borrow it for mutation or it can borrow it for reading.

Question for reader: what kind of iterator allows to modify object which is been iterated over?

Answer: None.

A consuming iterator leave no object to modify, a modifying iterator mutably borrows the object so no one can read or write it, and non-mutable iterator allows others to peek into the object but does not allow modifications. Rust simply won’t compile with ‘self modifying iterator’. Magic? No more ‘be careful there’. Someone put guards and a fence around minefield? Hurray!

The next question is the one which ate my brains for a long time. As soon as I asked myself this question, everything become clear to me, because the answer is obvious. What was hard is to find a proper question (recall, in Python you have state appearing ‘somewhere there’ by itself, so thinking about iterator state was unusual).

When we create an iterator there are two options to store the state:

1.  Object (the thing we iterate over) is modified to accommodate new state (iteration started)
2.  It is stored somewhere there and the object and the iterator state is been stored together.

(there is a third with side effects, but let’s leave it for now).

The first option can not be made for read only objects. If you want to iterate over object and to keep iterator state in it, you need to modify it. So, Rust never allows to have an iterator over read only object.

But you can create a new object (a mutable object) which can keep read only object you iterate over and a mutable state for iterator.

So, Rust distinct them:

`Iterator` can be consuming or mutable.

`IntoIterator` can consume, mutably or non-mutably borrow the object, and return a mutable iterator state over that object to be used in the iterator.

Rust’s ‘`for x in…`’ expects something which has trait `IntoIterator` or `Iterator`. If we can create an iterator for an object itself, we can use `Iterator`. If we don’t want to add something to object or modify it, we can use `IntoIterator`.

So, here is my simple exercise for `IntoIterator`: given an object of the type ‘Data’ with three named fields, return each of them:

```
struct Data{  
  a: i32,  
  b: i32,  
  c: i32  
}
```

Our test code is:

```
fn main() {  
  let d = Data::new(1, 2, 3);  
  for a in d{  
    println!("{}", a);  
  }  
}
```

We can’t use `Iterator` here, as there is no place to keep the state.

I use an additional data structure to hold the original object and the position for the iterator (the state):

```
struct DataIter {  
 data: Data,  
 pos: i32  
}
```

Now we can imlement `Iterator` for `DataIter`:

```
impl Iterator for DataIter {  
    type Item=i32;  
    fn next(&mut self) -> Option<i32>{  
        match self.pos {  
            0 => { self.pos+=1; Some(self.data.a)}  
            1 => { self.pos+=1; Some(self.data.b)}  
            2 => { self.pos+=1; Some(self.data.c)}  
            \_ => None  
        }  
    }  
}
```

Oh, and I forgot to say how good is Rust for using `Option` for iterator. it’s way better than `raise StopIteration` in Python.

What this code does? Let’s start from the ‘next’ function.

It mutably borrows self and returns ‘`Option`’ with a next value or `None`.

The tricky line is that ‘Item’, it is needed here for the trait declaration. I won’t say much about it, as it leads to ‘kindnessness’ and ‘higher order types’ stuff. I read about it but I can’t repeat it (it’s the proof I barely understand it). So, I accept them as ‘parameter to a trait’. `type Item=i32` is a parameter to the trait saying what kind of data our iterator is returning.

We could use that ‘`Item`’ in our code too. This variant of the ‘`next`’ function is absolutely the same as the previous one:

```
impl Iterator for DataIter {  
    type Item=i32;  
    fn next(&mut self) -> Option<Self::Item>{  
        match self.pos {  
            0 => { self.pos+=1; Some(self.data.a)}  
            1 => { self.pos+=1; Some(self.data.b)}  
            2 => { self.pos+=1; Some(self.data.c)}  
            \_ => None  
        }  
    }  
}
```

Insofar we got ‘`DataIter`’ structure with implemented `Iterator`. To use it we need to create it explicitly:

```
fn main(){ let data=Data::new(1,2,3);  
  let mut data\_iter: DataIter{data:data, pos:0}; for x in data\_iter:  
      println!("{}", x);}
```

Here the for operator takes our `data_iter` and uses it’s ‘`next`’ method because of implemented ‘`Iterator`’ trait.

Now we have an iterator and the data structure for the iterator. Let’s create a function for our original `Data` structure to return it:

```
impl IntoIterator for Data{  
    type Item=i32;  
    type IntoIter = DataIter;  
    fn into\_iter(self) -> DataIter{  
        DataIter{data: self, pos: 0}  
    }  
}
```

and we can use it directly:

```
fn main() {  
  let d = Data::new(1, 2, 3);  
  for a in d{  
    println!("{}", a);  
  }  
}
```

What this `into_iter` does? As you can see, one thing: returns `DataIter` which consumes our data and set the position to 0.

Above this function you can see another set of ‘parameters to trait’:

`Item` says what is return value for iterator, and `IntoIter` says what type is returned from `into_iter`.

Because of those parameters, we can write the function like this:

```
impl IntoIterator for Data{  
    type Item=i32;  
    type IntoIter = DataIter;  
    fn into\_iter(self) -> Self::IntoIter {  
        DataIter{data: self, pos: 0}  
    }  
}
```

It is exactly the same code, but with more ‘impl variables’.

Note: I stuck here for awhile because I’ve tried to write: `fn into_iter(self) -> <Self::IntoIter> {`

It’s syntactically incorrect, moreover, there is no generics here, so, there is no use for `<>` here.

That was an easy part. Now, let’s try to do non-consuming iterators. It should be easy, right? Except, when you borrow something, there are those dreaded lifetimes, so, brace, brace!

We start by modifying the `DataIter` structure. It now must keep reference to data, not data itself.

```
struct DataIter {  
  data: &Data,  
  pos: i32  
}
```

Unfortunately, we can’t compile this. There is a reference and Rust have no idea how lifetime of `DataIter` and `Data` are related.

Let’s describe that relation:

```
struct DataIter<'a> {  
 data: &'a Data,  
 pos: i32  
}
```

And we get the compilation error: implicit elided lifetime not allowed in `next` function. Good thing, Rust shows a nice hint on how to fix it: add a ‘thowaway’ (`‘_`) lifetime:

```
impl Iterator for DataIter<'\_> {  
    type Item=i32;  
    fn next(&mut self) -> Option<Self::Item>{  
        match self.pos {  
            0 => { self.pos+=1; Some(self.data.a)}  
            1 => { self.pos+=1; Some(self.data.b)}  
            2 => { self.pos+=1; Some(self.data.c)}  
            \_ => None  
        }  
    }  
}
```

Because that lifetime not used anywhere in the function we just asking compiler to ignore it.

The `IntoIterator` become a next problem:

```
impl<'a> IntoIterator for Data{  
    type Item=i32;  
    type IntoIter = DataIter<'a>;  
    fn into\_iter(&'a self) -> Self::IntoIter {  
        DataIter{data:&self, pos: 0}  
    }  
}
```

It won’t compile: there is an unconstrained lifetime.

To fix this we need to change what we do: we no longer want ‘Data’, we want reference to `Data`.

```
impl<'a> IntoIterator for &'a Data{  
    type Item=i32;  
    type IntoIter = DataIter<'a>;  
    fn into\_iter(self) -> Self::IntoIter {  
        DataIter{data:&self, pos: 0}  
    }  
}
```

It’s important, that we no longer can work with `Data`, only with `&Data`.

Old ‘main’ code is no longer work when iterating over `d`:

```
41 |     for a in d{  
   |              ^ \`Data\` is not an iterator
```

Let’s fix this:

```
fn main() {  
 let d = Data::new(1, 2, 3);  
 for a in &d{  
  println!("{}", a);  
    }  
    for a in &d{  
  println!("{}", a);  
    }  
}
```

and it works as expected. Non-consuming iterator created by `into_iter` function. I done two loops here to proove it’s not non-consuming.

That last piece (where to put lifetimes was really hard to me, but I’m happy that I hadn’t gave up here and solve it, because it’s wasn’t lifetime-only issue, but the trait was, actually, needed to be build for a different type).