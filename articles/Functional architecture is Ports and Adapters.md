# Functional architecture is Ports and Adapters
_Functional architecture tends to fall into a pit of success that looks a lot like Ports and Adapters._

In object-oriented architecture, we often struggle towards the ideal of the Ports and Adapters architecture, although we often [call it something else: layered architecture, onion architecture, hexagonal architecture, and so on](https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same). The goal is to decouple the business logic from technical implementation details, so that we can vary each independently.

This creates value because it enables us to manoeuvre nimbly, responding to changes in business or technology.

### Ports and Adapters [#](#fdb379c02efd4cf6b193ed193e514e04 "permalink")

The idea behind the Ports and Adapters architecture is that _ports_ make up the boundaries of an application. A _port_ is something that interacts with the outside world: user interfaces, message queues, databases, files, command-line prompts, etcetera. While the ports constitute the interface to the rest of the world, _adapters_ translate between the ports and the application model.

![](https://blog.ploeh.dk/content/binary/ports-and-adapters-conceptual-diagram.png)

The word _adapter_ is aptly chosen, because the role of the [Adapter design pattern](https://en.wikipedia.org/wiki/Adapter_pattern) is exactly to translate between two different interfaces.

You ought to arrive at some sort of variation of Ports and Adapters if you apply Dependency Injection, as [I've previously attempted to explain](https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same).

The problem with this architecture, however, is that it seems to take a lot of explaining:

*   [My book about Dependency Injection](http://amzn.to/12p90MG) is 500 pages long.
*   Robert C. Martin's [book about the SOLID principles, package and component design, and so on](http://amzn.to/19W4JHk) is 700 pages long.
*   [Domain-Driven Design](http://amzn.to/WBCwx7) is 500 pages long.
*   and so on...

In my experience, implementing a Ports and Adapters architecture is a [Sisyphean task](https://en.wikipedia.org/wiki/Sisyphus). It requires much diligence, and if you look away for a moment, the boulder rolls downhill again.

![](https://blog.ploeh.dk/content/binary/sisyphos-boulder-rolling-downhill.png)

It's possible to implement a Ports and Adapters architecture with object-oriented programming, but it takes _so much effort_. Does it have to be that difficult?

### Haskell as a learning aid [#](#9025e957aeff4989ac840edaed80f11d "permalink")

Someone recently asked me: _how do I know I'm being sufficiently Functional?_

I was wondering that myself, so I decided to learn Haskell. Not that Haskell is the only Functional language out there, but it enforces [purity](https://en.wikipedia.org/wiki/Pure_function) in a way that neither F#, Clojure, nor Scala does. In Haskell, a function _must_ be pure, unless its type indicates otherwise. This forces you to be deliberate in your design, and to separate pure functions from functions with (side) effects.

If you don't know Haskell, code with side effects can only happen inside of a particular 'context' called `IO`. It's a monadic type, but that's not the most important point. The point is that you can tell by a function's type whether or not it's pure. A function with the type `ReservationRendition -> Either Error Reservation` is pure, because `IO` appears nowhere in the type. On the other hand, a function with the type `ConnectionString -> ZonedTime -> IO Int` is impure because its return type is `IO Int`. This means that the return value is an integer, but that this integer originates from a context where it could change between function calls.

There's a fundamental distinction between a function that returns `Int`, and one that returns `IO Int`. Any function that returns `Int` is, in Haskell, [referentially transparent](https://en.wikipedia.org/wiki/Referential_transparency). This means that you're guaranteed that the function will always return the same value given the same input. On the other hand, a function returning `IO Int` doesn't provide such a guarantee.

In Haskell programming, you should strive towards maximising the amount of pure functions you write, pushing the impure code to the edges of the system. A good Haskell program has a big core of pure functions, and a shell of `IO` code. Does that sound familiar?

It basically means that Haskell's type system _enforces_ the Ports and Adapters architecture. The _ports_ are all your `IO` code. The application's core is all your pure functions. The type system automatically creates a _pit of success_.

![](https://blog.ploeh.dk/content/binary/pit-of-success.png)

Haskell is a great learning aid, because it forces you to explicitly make the distinction between pure and impure functions. You can even use it as a verification step to figure out whether your F# code is 'sufficiently Functional'. F# is a _Functional first_ language, but it also allows you to write object-oriented or imperative code. If you write your F# code in a Functional manner, though, it's easy to translate to Haskell. If your F# code is difficult to translate to Haskell, it's probably because it isn't Functional.

Here's an example.

### Accepting reservations in F#, first attempt [#](#f3f51ca71ba94729abc0f39fc0c44af8 "permalink")

In my [Test-Driven Development with F#](https://blog.ploeh.dk/tdd-with-fsharp) Pluralsight course (a [free, condensed version is also available](http://www.infoq.com/presentations/mock-fsharp-tdd)), I demonstrate how to implement an HTTP API that accepts reservation requests for an on-line restaurant booking system. One of the steps when handling the reservation request is to check whether the restaurant has enough remaining capacity to accept the reservation. The function looks like this:

// int
// -> (DateTimeOffset -> int)
// -> Reservation
// -> Result<Reservation,Error>
let check capacity getReservedSeats reservation =
    let reservedSeats = getReservedSeats reservation.Date
    if capacity < reservation.Quantity + reservedSeats
    then Failure CapacityExceeded
    else Success reservation

As the comment suggests, the second argument, `getReservedSeats`, is a function of the type `DateTimeOffset -> int`. The `check` function calls this function to retrieve the number of already reserved seats on the requested date.

When unit testing, you can supply a pure function as a Stub; for example:

let getReservedSeats \_ = 0
 
let actual = Capacity.check capacity getReservedSeats reservation

When finally composing the application, instead of using a pure function with a hard-coded return value, you can compose with an impure function that queries a database for the desired information:

let imp =
    Validate.reservation
    >> bind (Capacity.check 10 (SqlGateway.getReservedSeats connectionString))
    >> map (SqlGateway.saveReservation connectionString)

Here, `SqlGateway.getReservedSeats connectionString` is a partially applied function, the type of which is `DateTimeOffset -> int`. In F#, you can't tell by its type that it's impure, but I know that this is the case because I wrote it. It queries a database, so isn't referentially transparent.

This works well in F#, where it's up to you whether a particular function is pure or impure. Since that `imp` function is composed in the application's [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot), the impure functions SqlGateway.getReservedSeats and SqlGateway.saveReservation are only pulled in at the edge of the system. The rest of the system is nicely protected against side-effects.

It feels Functional, but is it?

### Feedback from Haskell [#](#0b86e95c4d7348249967e1f1e2dcf126 "permalink")

In order to answer that question, I decided to re-implement the central parts of this application in Haskell. My first attempt to check the capacity was this direct translation:

checkCapacity :: Int
              -> (ZonedTime -> Int)
              -> Reservation
              -> Either Error Reservation
checkCapacity capacity getReservedSeats reservation =
  let reservedSeats = getReservedSeats $ date reservation
  in if capacity < quantity reservation + reservedSeats
      then Left CapacityExceeded
      else Right reservation

This compiles, and at first glance seems promising. The type of the `getReservedSeats` function is `ZonedTime -> Int`. Since `IO` appears nowhere in this type, Haskell guarantees that it's pure.

On the other hand, when you need to implement the function to retrieve the number of reserved seats from a database, this function must, by its very nature, be impure, because the return value could change between two function calls. In order to enable that in Haskell, the function must have this type:

getReservedSeatsFromDB :: ConnectionString -> ZonedTime -> IO Int

While you can partially apply the first ConnectionString argument, the return value is `IO Int`, not `Int`.

A function with the type `ZonedTime -> IO Int` isn't the same as `ZonedTime -> Int`. Even when executing inside of an IO context, you can't convert `ZonedTime -> IO Int` to `ZonedTime -> Int`.

You can, on the other hand, _call_ the impure function inside of an IO context, and extract the `Int` from the `IO Int`. That doesn't quite fit with the above checkCapacity function, so you'll need to reconsider the design. While it was 'Functional enough' for F#, it turns out that this design isn't _really_ Functional.

If you consider the above checkCapacity function, though, you may wonder why it's necessary to pass in a function in order to determine the number of reserved seats. Why not simply pass in this number instead?

checkCapacity :: Int -> Int -> Reservation -> Either Error Reservation
checkCapacity capacity reservedSeats reservation =
    if capacity < quantity reservation + reservedSeats
    then Left CapacityExceeded
    else Right reservation

That's much simpler. At the edge of the system, the application executes in an IO context, and that enables you to compose the pure and impure functions:

import Control.Monad.Trans (liftIO)
import Control.Monad.Trans.Either (EitherT(..), hoistEither)

postReservation :: ReservationRendition -> IO (HttpResult ())
postReservation candidate = fmap toHttpResult $ runEitherT $ do
  r <- hoistEither $ validateReservation candidate
  i <- liftIO $ getReservedSeatsFromDB connStr $ date r
  hoistEither $ checkCapacity 10 i r
  >>= liftIO . saveReservation connStr

(Complete source code is available [here](https://gist.github.com/ploeh/c999e2ae2248bd44d775).)

Don't worry if you don't understand all the details of this composition. The highlights are these:

The postReservation function takes a ReservationRendition (think of it as a JSON document) as input, and returns an `IO (HttpResult ())` as output. The use of `IO` informs you that this entire function is executing within the IO monad. In other words: it's impure. This shouldn't be surprising, since this is the edge of the system.

Furthermore, notice that the function `liftIO` is called twice. You don't have to understand exactly what it does, but it's necessary to use in order to 'pull out' a value from an `IO` type; for example pulling out the `Int` from an `IO Int`. This makes it clear where the pure code is, and where the impure code is: the liftIO function is applied to the functions getReservedSeatsFromDB and saveReservation. This tells you that these two functions are impure. By exclusion, the rest of the functions (validateReservation, checkCapacity, and toHttpResult) are pure.

It's interesting to observe how you can interleave pure and impure functions. If you squint, you can almost see how the data flows from the pure validateReservation function, to the impure getReservedSeatsFromDB function, and then both output values (`r` and `i`) are passed to the pure checkCapacity function, and finally to the impure saveReservation function. All of this happens within an `(EitherT Error IO) () do` block, so if any of these functions return `Left`, the function short-circuits right there and returns the resulting error. See e.g. Scott Wlaschin's excellent article on [railway-oriented programming](http://fsharpforfunandprofit.com/posts/recipe-part2) for an exceptional, lucid, clear, and visual introduction to the Either monad.

The value from this expression is composed with the built-in runEitherT function, and again with this pure function:

toHttpResult :: Either Error () -> HttpResult ()
toHttpResult (Left (ValidationError msg)) = BadRequest msg
toHttpResult (Left CapacityExceeded) = StatusCode Forbidden
toHttpResult (Right ()) = OK ()

The entire postReservation function is impure, and sits at the edge of the system, since it handles IO. The same is the case of the getReservedSeatsFromDB and saveReservation functions. I deliberately put the two database functions in the bottom of the below diagram, in order to make it look more familiar to readers used to looking at layered architecture diagrams. You can imagine that there's a cylinder-shaped figure below the circles, representing a database.

![](https://blog.ploeh.dk/content/binary/haskell-post-reservation-ports-adapters.png)

You can think of the validateReservation and toHttpResult functions as belonging to the _application model_. While pure functions, they translate between the external and internal representation of data. Finally, the checkCapacity function is part of the application's Domain Model, if you will.

Most of the design from my first F# attempt survived, apart from the Capacity.check function. Re-implementing the design in Haskell has taught me an important lesson that I can now go back and apply to my F# code.

### Accepting reservations in F#, even more Functionally [#](#6737c15f02dd4ab49362c6e491ea5bab "permalink")

Since the required change is so little, it's easy to apply the lesson learned from Haskell to the F# code base. The culprit was the Capacity.check function, which ought to instead be implemented like this:

let check capacity reservedSeats reservation =
    if capacity < reservation.Quantity + reservedSeats
    then Failure CapacityExceeded
    else Success reservation

This simplifies the implementation, but makes the composition slightly more involved:

let imp =
    Validate.reservation
    >> map (fun r \->
        SqlGateway.getReservedSeats connectionString r.Date, r)
    >> bind (fun (i, r) \-> Capacity.check 10 i r)
    >> map (SqlGateway.saveReservation connectionString)

This almost looks more complicated than the Haskell function. Haskell has the advantage that you can automatically use any type that implements the `Monad` typeclass inside of a `do` block, and since `(EitherT Error IO) ()` is a Monad instance, the `do` syntax is available for free.

You could do something similar in F#, but then you'd have to implement a custom computation expression builder for the Result type. Perhaps I'll do this in [a later blog post](https://blog.ploeh.dk/2016/03/21/composition-with-an-either-computation-expression)...

### Summary [#](#622b9d08938f49d389bab5763118f6e3 "permalink")

Good Functional design is equivalent to the Ports and Adapters architecture. If you use Haskell as a yardstick for 'ideal' Functional architecture, you'll see how its explicit distinction between pure and impure functions creates a pit of success. Unless you write your entire application to execute _within_ the `IO` monad, Haskell will automatically enforce the distinction, and push all communication with the external world to the edges of the system.

Some Functional languages, like F#, don't explicitly enforce this distinction. Still, in F#, it's easy to _informally_ make the distinction and compose applications with impure functions pushed to the edges of the system. While this isn't enforced by the type system, it still feels natural.