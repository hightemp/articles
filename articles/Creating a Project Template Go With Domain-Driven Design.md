# Creating a Project Template? Go With Domain-Driven Design
Every promising project starts with an elaborate template. Your team likely has one and benefits from it at the start of each new project. If you’re a solo developer, I bet you have your own best practices or even existing projects to copy from. Our team puts a lot of effort into proper software design — and besides being a lot of fun, it has already paid off multiple times.

It’s been a year since we created the first version. As you’d expect, a lot of improvements have been made over such a long period. Now, I can confidently say it’s been battle-tested on real projects and the team has already saved a lot of time by using the template. 

If you or your team don't have such a performant project starter — or you need some fresh ideas for an existing one — I believe you’ll find this article useful. Because this topic is extensive and there are a lot of things to talk about, **the blog post is divided into three parts.** Today, you will learn the basics of domain-driven design and how we adopted it at STRV’s Go template.

_(_[_You can find part two covering database storage here._](https://www.strv.com/blog/creating-a-project-template-go-with-database-storage)_)_

But why did we even change something? Wasn’t everything great and weren’t we all happy? Being honest with ourselves was the first step to going outside of our comfort zone. 

In all fairness, after a couple of real-world projects at STRV, our Go team ([which had been working together prior to joining STRV](https://www.strv.com/blog/on-the-go-the-inside-story-of-go-engineers-at-strv)) found out that **our previous style of writing APIs wasn’t ideal for STRV’s kind of startup projects.** STRV has us dealing with big database transactions, keeping small and single-purpose business functions, MVP and post-MVP project phases and many other problems. Maybe some of my colleagues would say I’m just “grinding a diamond” — but that’s what I love. 

Let's see what DDD is and how it can help us solve these issues to deliver a truly precious piece of coding art.

Frameworks?... No Way, Jose!
----------------------------

Maybe you’re interested in what framework we use. **One of the worst things you can do in Go is follow an approach from other programming languages**. 

Frameworks are designed against the Go philosophy. Go is built around the Unix Philosophy that favors building small, independent pieces of software that do one thing well rather than big chunks that do everything. We want to have loosely coupled architecture — that’s why we built our minimalistic solution without using an all-encompassing framework, which grows as we go.

Building Strong Foundations
---------------------------

We need some rules. Don’t get me wrong; I don’t want to bother colleagues with nonsense. I’m talking about something like comparing dynamically and statically typed languages. In this case, we love statically typed languages because, in comparison with dynamic ones, we’ve got a set of rules that bring us important guarantees as a reward upon following the rules. 

**Everyone should be able to rely on their tools during hard work.** That’s why we need the right architecture and design for the given job.

### Unlocking the Power of Layers

Software architecture defines the structure and constraints the software developers will need to work in. I think the most important thing is to **know that architecture focuses on developing the skeleton and high-level infrastructure of software.** 

Among known architecture patterns are, for example, client-server, event-bus or model-view-controller patterns. In our case, we’re talking about **a layered architecture pattern**, which consists of three layers:

*   The entry point of our applications lies in the transport layer. We use JSON as a schema for the transport protocol. Two architectural styles are supported in our template: REST and GraphQL. As you’d expect, that’s where request routing to a specific handler, input validation, extracting path/query parameters and so on happen.
*   The transport layer handler calls the service function, which is a business logic for the called endpoint. In reality, business logic is inside the domain object — but it’s called directly from the service function. That’s why we can simplify it and, if talking about application layers, we can say that the business logic lies in the service layer.
*   The third is the data or database layer. Communication with data storage and persisting all application data happens here. Data layer functions are called by service functions when business logic needs to fetch or store data.

All three layers communicate with one another via interfaces, so it’s not a problem to switch actual implementation whenever needed. 

It’s also worth mentioning that **our template leverages a monolithic architecture pattern**. When we start a new project, it’s hard to tell in advance what will happen in half a year (there’s always a huge chance that the project will continue beyond the original scope). That’s why I think monolith is the best project starter for MVP projects. 

**!Spoiler alert!** Domain-driven design is one of the best designs for splitting your monolithic application into multiple microservices in the future.

Designing for Impact
--------------------

You now have a basic understanding of our skeleton. But what should be _inside_ of each layer? And how do you design the code to make it maintainable and easy to read? 

In short: **To produce high-quality software, you need a high-quality design to make the code base understandable and maintainable.** One of the most well-known books about design patterns among programmers is without a doubt [Gang of Four](https://en.wikipedia.org/wiki/Design_Patterns). It outlines 23 design patterns that the author believes lead to scalable, maintainable object-oriented software. 

Going through each pattern is beyond the scope of this blog post — but I can highly recommend [Refactoring.Guru](https://refactoring.guru/) if you want to learn (or just recapitulate) existing design patterns in a pleasant way.

Three Pillars of DDD
--------------------

As software became more and more complicated, it grew apparent that **the closer your system was to the domain (problem space), the easier it was to make changes.** This led Eric Evans to define the principles of [Domain-Driven Design](https://www.oreilly.com/library/view/domain-driven-design-tackling/0321125215/) (DDD).

A great deal of domain-driven design comes straight out of object-oriented design patterns. OOD patterns are split into three sections, which are equally important when considering DDD: **creational, structural and behavioral patterns.**

We have to remember that the domain is the central entity in DDD. It’s what we model our entire language and system around. Another way of looking at it is via the world of business. Every time you read the phrase “domain-driven design,” you can read it as business problem-driven design.

**Eric Evans introduced three pillars: ubiquitous language, strategic design and tactical design.** Let’s go over them.

![](https://www.datocms-assets.com/57452/1697555833-infographic-3_pillars.png)

### Ubiquitous Language

Ubiquitous language describes the process of building a common language we can use when talking about our domain. 

**This language should be spoken by everyone on the team** (designers, developers, business people, etc.). It unites the team by ensuring there is no ambiguity in communication. It’s the overlap of the language that domain experts and technical experts use. Whenever your team talks about a customer or a lost contract, there should be no confusion about what this means. 

We use it when discussing requirements and system design, and **it should even be used in the source code itself.** Since STRV works in an agile way, it’s not a problem to agree on common terminology within the team — and even involve it during sprints if needed. 

As an example, take the term “user.” If possible, name the entity more specifically so there is no confusion when talking with other team members. For instance, on a multi-sided automobile project, one domain is dealing with car navigation and sees the “user” as the driver. Another domain is related to app payments, where the “user” can be any customer — not only drivers. Differentiating and being more specific is always better in both code and communication.

**Pro tip:** Maintain the basic glossary in your README.

### Strategic Design

Strategic design is a phase of the DDD process in which we map out the business domain and define bounded contexts. 

**Bounded contexts are all about dividing large models into smaller, easier-to-understand chunks** and being explicit about how they relate to each other. The goal of strategic design is to ensure that you architect your system in a way focused on business outcomes. 

We do this by first mapping out a domain model, which is an abstract representation of the problem space. Even at this very early stage of the DDD process, we can start to think about how our system might look. That’s why it’s important to separate bounded contexts.

**Pro tip:** Maintain a very simple diagram of your domains with all the decisions you made during designing them in your README.

### Tactical Design

Tactical design is where we begin to get into the specifics of how our system will look. In the tactical design phase, we talk about entities, aggregates and value objects. 

**Entities are defined by their** _**identity**_**.** Their attributes do not define them, and it’s expected that although their attributes may change over time, their identity will not. That means an entity is an object with an identifier, most likely with ​a universally unique identifier. A typical example might be a customer, device or vehicle. 

On the other hand, **value objects do not have identities and are often used in conjunction with entities and aggregates** to enable us to build a rich model of our domain. Such a value object can be a geolocation point of a place, a configuration of a network device or an item history. It purely depends on the context of the entity or aggregate. 

Aggregates are probably one of the hardest patterns in DDD. **The aggregate pattern refers to a group of domain objects that can be treated as one.** For example, a team consists of many employees. We’d likely have a domain object for employees, but grouping them and applying behaviors to them as a team would be helpful in situations such as organizing departments. Another simple example of an aggregate is a shopping cart with products in it.

### Adoption

Maybe you’re asking why we even adopted such a design. **The first versions of our Go template had simple layered architecture without any design for business logic.** This did give us freedom — but for the price of worse maintainability and code readability, both of which I consider the most important parameters for project success. 

To be specific, in the past, our service layer contained service models and, via an interface, we were able to start a database transaction and put whatever logic we wanted inside. The results were big transactions through several models. I wouldn’t say it’s generally a bad approach, as long as you’re capable of keeping the service functions small with a single purpose to keep some elemental maintainability.

```
func (s *Service) CreateUser(ctx context.Context, input *model.UserInput) (*model.User, *model.Session, error) {
  tx := Begin() 
  defer tx.Rollback()

  
  

  SaveUser(tx, user) 

  
  

  SaveSession(tx, session) 

  tx.Commit() 

  return user, session, nil
}
```

But the reality is often the opposite, as you can see from the example above with a pseudocode of creating a new user with the session. **Although this is an artificial example, there are several issues with this code:**

*   The service layer shouldn’t know anything about the database transactions.
*   There is nothing to prevent the developer from putting arbitrary database operations into a single transaction.
*   Imagine you’re asked to migrate to microservices and thus separate user and session. It wouldn’t be possible without a substantial refactor.

There might be times when you’re in a time crunch and need to do something very quickly. Layered architecture doesn’t give you any hard guardrails or many restrictions on what you can and cannot do. It’s also absolutely fine with small-scale projects when you know in advance the project won’t be continued in the future. 

**Since STRV’s client projects are usually MVPs in the early phase**, they’re often already big enough to make room for a lot of bad decisions and make the project difficult to maintain (been there, done that). Moreover, there’s always a substantial chance the project will continue even after the MVP phase. 

These glimpses into the future got me thinking I wanted to try something more strict but with substantial benefits of readability and maintainability. **That’s why I proposed a domain-driven approach** — and after some battle-testing on real projects, we fully adopted these changes in the template. It gives us high confidence that in the future, when we return back to our old code base to continue, it will be just how we left it.

### Domains

So how did we split our big service layer with models in a single place between several small services and domains? **The first thing you probably think of is code structure.** There isn’t much to describe; but with the domain concept, think of it as another layer we added other than the already-existing service layer. Let’s give it a real outline.

```
domain

├── error.go

├── session

│   ├── error.go

│   ├── factory.go

│   ├── postgres

│   ├── repository.go

│   └── session.go

└── user

    ├── error.go

    ├── factory.go

    ├── postgres

    ├── repository.go

    └── user.go
```

You can see the content of the domain directory with two domains: user and session. It’s good enough as an example. Let’s go over the structure of the user domain. 

In _user.go_, we can see the user entity structure with methods containing actual business logic like matching passwords, changing passwords or user updating. Also found there are custom types like _Role_ or value objects with user attributes for creating users.

There’s a tricky part regarding the internal implementation of an entity. DDD says the domain object should have all properties private and you should just call methods on the specific entity — **but** **the Go philosophy is not to hide internal implementation**. Moreover, there are cases where we do need to access entity properties in API and database layers. So, instead of calling the _GetName_ method like in Java, we directly access the property _Name_. 

Since I feel the need to keep the data integrity of the domain object as DDD recommends, **my solution is to create a** _**Valid**_ **method for each object in my domains.** In practice, although everyone can change the internal property of the domain object, there’s a method that ensures data integrity. I’ve never called a _Valid_ method because I strictly call object business methods; still, I think it’s good practice to have them because you’re probably not the only one working on the project.

### Factory

[Factories](https://refactoring.guru/design-patterns/abstract-factory) play a really important role in this game. **The factory is responsible for creating entities and aggregates.** 

In our case, factories themselves are created with dependencies like _Hasher_ (interface for objects capable of password hashing) or _TimeSource_ (interface for objects capable of generating time). These dependencies are required by a user entity so the factory knows how to construct them. **The value object keeping all needed data for creating a user is in** _**user.go**_**.**

Another use case for factories is object creation in the database layer, where we need to create an entity from values a database returned. As for the content of the _postgres_ directory and _repository.go_ file, they’ll be described when the time comes. Bear with me. 

### Services

In DDD, we use a few types of services to help organize our code: **application services, domain services and infrastructure services**, the last being the easiest to understand. 

Infrastructure services contain technical details, integration with the database or external API. In most cases, they are actual implementations of interfaces from other layers. I bet you’ve implemented an [adapter](https://refactoring.guru/design-patterns/adapter) pattern several times already. **It’s a simple wrapper that makes your code testable and more maintainable** than using directly the package in the services (mocking would be almost impossible or at least difficult to write). 

An adapter — our hot clutch to infrastructure service — might be implemented around a database driver, mailing service, payment service, cloud services and many others. All these examples are infrastructure services. Our domain or application services use infrastructure services by interfaces. 

The story about domain and application services is a bit more complicated. To continue with our previous example, here’s an example service code structure for the above-mentioned domains.

```
service

├── session

│   └── session.go

├── user

│   └── user.go

└── usermanagement

    └── usermanagement.go
```

In our case, **infrastructure services are implemented in the project root.** I also mentioned domain and application services. Domain services provide stateless operations within a domain that complete a certain action. Application services are used to compose other services; they are usually very thin, are used only for coordination and addressing security concerns and require all other logic be pushed down into the layers underneath. The hierarchy is shown in the diagram below.

![](https://www.datocms-assets.com/57452/1697555808-infographic-2.png)

It’s worth mentioning that some people like to have services in the domain directory as a subpackage within each domain. I think **it’s good to have them separated from domain implementation** because I want to have a space where I can also include application services. 

Back to our example. User management is the application service, whereas user and session are domain services. User management service is meant for user flows that require interaction with both the user and the session services.

**Let’s take the login flow as an example.** At first, you need to fetch the user and, if the operation is successful, create and store the session using domain services. If the user flow is straightforward — like deleting a session or updating a logged user — the handler from the transport layer can call domain service directly; there’s no need to go transitively through the user management service. 

But be aware! **The service layer shouldn’t contain business logic.** It’s just the glue between the domain objects (that has actual business logic) and storage (not shown in the schema, since it’s not crucial for this blog post).

### Errors

The last thing I want to mention is correct error handling. **I don’t mean typical** _**if err != nil**_ **but something deeper, more of an architectural decision.** 

In the case of using API based on HTTP (RESTful), where do you think is the right place to determine what HTTP status code should be returned? Maybe you’re thinking of the service layer, where you know exactly what went wrong and thus what status code to return. In most cases, you can’t go wrong with this decision; it’s never been a problem for us in the past. But I will give you one example of where it _could_ be. 

Imagine you’ve implemented REST API and, for whatever reason, you’re asked to add another transport layer protocol (why not, service is called by an interface) or even rewrite the whole transport layer to, say, gRPC. Or you just want to start a new project based on the existing template and use gRPC from the very beginning. In any case, you’re forced to refactor your existing error handling, get rid of the HTTP status code and introduce gRPC error handling — so the gRPC transport layer will know what to do with the error returned from the service layer.

In my opinion, **the correct approach to this problem is to create a custom domain error** that will contain all information needed for other layers to convert the error content to whatever is needed — like to HTTP status code, GraphQL error description or gRPC status codes… whatever is suitable for the current project. Let’s take a look at how such an error might look in _domain/error.go_.

```
type Error struct {
    Err error
    Message string
    Code string
    Data any
}
```

_Message_, _Code_ and _Data_ could be publicly shareable; this depends on your use case. But _Code_ has a special use case for other layers that tries to convert an error returned by the service layer using _errors.As_ to domain _Error_. 

For example, in the REST API, the transport layer can contain a mapping between _Code_ _ERR\_USER\_NOT\_FOUND_ to HTTP status code 404. In this way, all domain error codes should be mapped to the correct transport layer status, whatever it may be. 

Regarding _error.go_ in _user_ and _session_ directories, there are defined concrete errors and potentially some helpers for particular domains based on the general implementation mentioned above. The important thing to remember here is that **the service layer can (and I think it** _**should**_**) contain publicly shareable data — but definitely shouldn’t determine any status codes or the exact content of responses your application returns.** Take separation of concerns seriously!

Conclusion
----------

I hope you’ve got a solid understanding of what our Go backend template looks like in terms of architecture and design. 

I mentioned a bunch of problems that we’ve had to resolve — such as big database transactions, keeping small and single-purpose business functions, post-MVP project phases and, most importantly, readability and maintainability. **DDD solves these issues by restricting what a developer can do and what not.** One of the biggest benefits is the possibility of easily refactoring a monolithic application to microservices when needed. Another is the ubiquitous language that’s helpful in team communication by eliminating confusion about specific terms. 

If you’re completely new to DDD and want to study up on it or try it out, I highly recommend [Three Dots Labs](https://threedots.tech/), where you can download an e-book about DDD in Go meant for newbies. Another great resource that helped me understand all theoretical concepts and convert them to practice is [Domain-Driven Design with Golang](https://www.packtpub.com/product/domain-driven-design-with-golang/9781804613450). 

Finally, if you’d like to know more about our general template concept or have some questions regarding DDD, I’m more than happy to help.