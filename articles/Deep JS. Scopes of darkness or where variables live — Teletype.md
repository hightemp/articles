# Deep JS. Scopes of darkness or where variables live — Teletype
_Level: Senior, Senior+_

In the article, [Deep JS. In memory of data and types](https://blog.frontend-almanac.com/p14TDUH-R4o), we talked about what the structure of a variable of each specific type looks like in the memory of the V8 engine. In this article, I now propose to consider exactly where these variables are stored and how they get into memory.

As usual, we will investigate the latest version of the engine ([12.2.136](https://chromium.googlesource.com/v8/v8.git/+/refs/tags/12.2.136)) at the time of writing.

Table of contents
-----------------

Before we go directly to the variables, it's worth saying a few words about where V8 gets them from in general. After all, JavaScript code, like any other program code, is just a text that is convenient for human perception. Which is parsed and converted into machine code (understandable already directly to the executable environment, and not to a person).

Traditionally, programming languages parse the text of the program code and decompose it into a structure called an [Abstract Syntax Tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree) or AST. The V8 developers did not reinvent the wheel here and followed the same proven path.

After receiving a file or string as input, the engine parses the text and lays out the instructions in the AST tree.

For example, the code for Euclidean algorithm

while (b !== 0)
  if (a \> b) a \= a \- b
  else b \= b \- a;

In pasred mode it will look like this

%\> v8\-debug \--print\-ast test.js
\[generating bytecode for function: \]
\--\- AST \--\-
FUNC at 0
. KIND 0
. LITERAL ID 0
. SUSPEND COUNT 0
. NAME ""
. INFERRED NAME ""
. BLOCK at \-1
. . EXPRESSION STATEMENT at \-1
. . . ASSIGN at \-1
. . . . VAR PROXY local\[0\] (0x7fe71480ba60) (mode \= TEMPORARY, assigned \= true) ".result"
. . . . LITERAL undefined
. . WHILE at 0
. . . COND at 9
. . . . NOT at 9
. . . . . EQ\_STRICT at 9
. . . . . . VAR PROXY unallocated (0x7fe71480bbd0) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "b"
. . . . . . LITERAL 0
. . . BODY at 18
. . . . IF at 18
. . . . . CONDITION at 24
. . . . . . GT at 24
. . . . . . . VAR PROXY unallocated (0x7fe71480bc00) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "a"
. . . . . . . VAR PROXY unallocated (0x7fe71480bbd0) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "b"
. . . . . THEN at 29
. . . . . . EXPRESSION STATEMENT at 29
. . . . . . . ASSIGN at \-1
. . . . . . . . VAR PROXY local\[0\] (0x7fe71480ba60) (mode \= TEMPORARY, assigned \= true) ".result"
. . . . . . . . ASSIGN at 31
. . . . . . . . . VAR PROXY unallocated (0x7fe71480bc00) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "a"
. . . . . . . . . SUB at 35
. . . . . . . . . . VAR PROXY unallocated (0x7fe71480bc00) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "a"
. . . . . . . . . . VAR PROXY unallocated (0x7fe71480bbd0) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "b"
. . . . . ELSE at 46
. . . . . . EXPRESSION STATEMENT at 46
. . . . . . . ASSIGN at \-1
. . . . . . . . VAR PROXY local\[0\] (0x7fe71480ba60) (mode \= TEMPORARY, assigned \= true) ".result"
. . . . . . . . ASSIGN at 48
. . . . . . . . . VAR PROXY unallocated (0x7fe71480bbd0) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "b"
. . . . . . . . . SUB at 52
. . . . . . . . . . VAR PROXY unallocated (0x7fe71480bbd0) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "b"
. . . . . . . . . . VAR PROXY unallocated (0x7fe71480bc00) (mode \= DYNAMIC\_GLOBAL, assigned \= true) "a"
. RETURN at \-1
. . VAR PROXY local\[0\] (0x7fe71480ba60) (mode \= TEMPORARY, assigned \= true) ".result"

Here we see the parent nodes (tree vertices), which represent operators, and the end nodes (tree leaves), which represent variables.

Already at this stage, you can notice that the variables have been declared, but the memory for them has not yet been allocated. For each such variable, a certain VariableProxy node is created in the ASD, which will represent a specific variable in memory. Moreover, several such Variable Proxies can refer to one variable at once. The fact is that the memory allocation process will take place later and in another place, in Scope (more on this below), and VariableProxy is a kind of placeholder link. The ASD never directly accesses variables, only via VariableProxy.

VariableMode
------------

[src/common/globals.h](http://chromium.googlesource.com/)

Now let's look at what types of variables there are in V8. Conditionally, all variables can be divided into three groups

### User variables

Variables that the user can declare explicitly (or implicitly). There are only three of them

*   kLet - declared via 'let' declarations (first lexical)
*   kConst - declared via 'const' declarations (last lexical)
*   kVar - declared via 'var', and 'function' declarations

### Compiler variables

К ним относят внутренние временные переменные и динамические - переменные, не объявленные явным образом

*   kTemporary - not user-visible, live in a stack
*   kDynamic - declaration is unknown, always require dynamic lookup
*   kDynamicGlobal - declaration is unknown, requires dynamic lookup, but we know that the variable is global unless it has been shadowed by an eval-introduced variable
*   kDynamicLocal - declaration is unknown, requires dynamic lookup, but we know that the variable is local and where it is unless it has been shadowed by an eval-introduced variable

a \= "a"; 

### Class private variables

Variables for private class methods and accessors. They require access check and live in the context of a class.

*   kPrivateMethod - does not coexist with any other variable with the same name in the same scope
*   kPrivateSetterOnly - does not coexist with any other variable with the same name in the same scope other than kPrivateGetterOnly
*   kPrivateGetterOnly - does not coexist with any other variable with the same name in the same scope other than kPrivateSetterOnly
*   kPrivateGetterAndSetter - if both kPrivateSetterOnly and kPrivateGetterOnly variables with the same name exist they are being transitioned to a single variable with this type

[src/common/globals.h#1718](https://chromium.googlesource.com/v8/v8.git/+/refs/tags/12.2.136/src/common/globals.h#1718)

enum class VariableMode : uint8\_t {
  
  kLet,  
  
  kConst,  
  
  kVar,  
  
  
  kTemporary,  
               
  
  kDynamic,  
             
  
  kDynamicGlobal,  
                   
                   
  
  kDynamicLocal,  
                  
                  
                  
                  
  
  
  
  kPrivateMethod,  
                   
                   
  kPrivateSetterOnly,  
                       
                       
                       
  
  kPrivateGetterOnly,  
                       
                       
                       
                       
  kPrivateGetterAndSetter,  
                            
                            
  kLastLexicalVariableMode \= kConst,
};

Isolate
-------

Another important aspect of V8 is **Isolate**. **Isolate** is an abstraction that represents an isolated instance of the engine. This is where the state of the engine will be stored. Anything inside a particular **Isolate** cannot be used in another **Isolate**. **Isolate** itself is not thread-safe. I.e., only one thread can access it at a time. To organize multithreading on the Embedder side, such as a browser, the V8 team suggests using the Locker/Unlocker API. As an example of **Isolate**, you can take, for example, a browser tab or a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker).

Scope
-----

In the [ECMAScript](https://tc39.es/ecma262/#sec-ecmascript-language-statements-and-declarations) specification, the concept of scope is somewhat vague, but we know that variables are always allocated in one of these areas. In V8, this area is called Scope. In total, at the moment, there are 9 proposed

*   CLASS\_SCOPE
*   EVAL\_SCOPE
*   FUNCTION\_SCOPE
*   MODULE\_SCOPE
*   SCRIPT\_SCOPE
*   CATCH\_SCOPE
*   BLOCK\_SCOPE
*   WITH\_SCOPE
*   SHADOW\_REALM\_SCOPE

[src/common/globals.h#1649](https://chromium.googlesource.com/v8/v8.git/+/refs/tags/12.2.136/src/common/globals.h#1649)

enum ScopeType : uint8\_t {
  CLASS\_SCOPE,        
  EVAL\_SCOPE,         
  FUNCTION\_SCOPE,     
  MODULE\_SCOPE,       
  SCRIPT\_SCOPE,       
  CATCH\_SCOPE,        
  BLOCK\_SCOPE,        
  WITH\_SCOPE,         
  SHADOW\_REALM\_SCOPE  
};

In addition to these nine types, there is another one - **Global Scope**, which exists at the top level of **Isolate** and stores all other declarations. It is this viewport that, for example, the global [Window](https://developer.mozilla.org/en-US/docs/Web/API/Window) object in the browser will refer to.

So where are the boundaries of a particular scope really? To understand this, let's look at each scope separately.

### CLASS\_SCOPE

It is clear from the name that we are talking about classes, its properties and methods

class A extends B  {
  prop1 \= "prop1";
  
  method1() {}
}

In the case of classes, the scope starts with the keyword `class` and ends with the symbol `}`.

class A extends B { body }

That is, the following is stored into the class scope:

*   Class name
*   Class properties (private and public)
*   Class methods

Let's see what the Scope of a simple class looks like

class A {}

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  
  TEMPORARY .result;  
  
  LET A;  
  
  class A { 
    
    
    
    CONST A;  
    
    function () { 
      
      
    }
  }
}

Here we see that the reference to the class is defined by a variable of type LET. In our case, the link is declared in the Global Scope. Inside CLASS\_SCOPE, we see the class constant `CONST A` and the base constructor.

Let's add a class method

class A {
  method1 () {}
}

%\> v8\-debug \--print\-scopes test.js
Inner function scope:
function method1 () { 
  
  
  
}
Global scope:
global { 
  
  
  
  
  
  TEMPORARY .result;  
  
  LET A;  
  
  class A { 
    
    
    
    CONST A;  
    
    function () { 
      
      
    }
    
    function method1 () { 
      
      
      
      
    }
  }
}

Here we can see a link to the `method1` function inside CLASS\_SCOPE, as well as, separately, the FUNCTION\_SCOPE of this function (about FUNCTION\_SCOPE below).

Now let's try to add a class property

class A {
  prop1 \= "prop1"
}

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  
  TEMPORARY .result;  
  
  LET A;  
  
  class A { 
    
    
    
    CONST A;  
    
    function () { 
      
      
    }
    
    function A () { 
      
      
      
    }
  }
}

Strangely enough, we do not see the `prop1` method here. Instead, the `function A ()` appeared in the class area. This is due to the fact that class methods can have different access levels, in particular, they can be private, which requires checking rights when accessing them. The V8 engine has an appropriate mechanism for determining access rights to class properties, which is implemented through a special function like kClassMembersInitializerFunction. In general, there are many types of functions in V8, as many as 27 of them, but more on that next time.

### EVAL\_SCOPE

This scope is created by calling the [eval](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval) function

eval("var a = 'a'")

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  
  TEMPORARY .result;  
  
  DYNAMIC\_GLOBAL eval;  
}
Global scope:
eval { 
  
  
  
  TEMPORARY .result;  
  
  DYNAMIC a;  
}

Actually, EVAL\_SCOPE is not much different from Global Scope, except that the variables inside eval are often dynamic (requiring constant search in memory) because the scope of their declaration is unknown in advance.

### FUNCTION\_SCOPE

We have already encountered the scope of the function when we considered CLASS\_SCOPE.

function fun(a,b) { stmts }

For a function, the scope starts with the first parenthesis and ends with the last curly

Let's look at an example

function fun(a) {
  var b \= "b";
}

%\> v8\-debug \--print\-scopes test.js
Inner function scope:
function fun () { 
  
  
  
  VAR a;  
  VAR b;  
}
Global scope:
global { 
  
  
  
  VAR fun;  
  
  function fun () { 
    
    
    
  }
}

In the Global Scope, only the reference to the function (type VAR) will be saved, and the entire functional scope will be dedicated in FUNCTION\_SCOPE, where we see two variables: `a` - the argument of the function and `b` - the internal permanent function.

The similar picture with arrow functions

var fun \= (a) \=> {
  var b \= "b";
}

%\> v8\-debug \--print\-scopes test.js
Inner function scope:
arrow (a) { 
  
  
  
  VAR a;  
  VAR b;  
}
Global scope:
global { 
  
  
  
  
  TEMPORARY .result;  
  
  VAR fun;  
  
  arrow () { 
    
    
    
  }
}

The type of the function, in this case, will be kArrowFunction, however, the scope does not differ from the usual kNormalFunction function.

It is worth noting that, despite the fact that arrow functions do not have their own context, the argument `a` and the internal variable `b` are declared in the internal scope, just like regular functions. I.e., they cannot be accessed from the scope above.

var fun \= (a) \=> {
  var b \= "b";
}

console.log(this.a); 
console.log(this.b); 

### MODULE\_SCOPE

To declare a module, it is enough to specify the `.mjs` extension of the script file.

var a \= "a"

%\> v8\-debug \--print\-scopes test.mjs
Global scope:
module { 
  
  
  
  
  
  
  TEMPORARY .generator\_object;  
  TEMPORARY .result;  
  
  VAR a;  
}

The module has a number of useful properties and features, but its Scope, in essence, does not differ from the usual Global Scope. Unless, here you can find a system (hidden) variable `.generator_object`, which stores the `JSGeneratorObject` object for generators. It can also be found in asynchronous functions and REPL scripts.

### SCRIPT\_SCOPE

The script area. There are different types of scripts, for example, a script tag or a REPL script in Node.js

Consider the classic script tag

<script\> var a \= "a";
  let b \= "a"; </script\>

Tag parsing lies outside of V8 (the browser does this before building the DOMTree), so talking about the beginning and end of the script area is not entirely correct. The browser passes the script body to the engine in the form of a string, which, in turn, will be placed in the SCRIPT\_SCOPE area.

In the example above, the variable `a` will be declared in the Global Scope (according to the rules of VAR hoisting), and `b` will remain visible only within this script.

### CATCH\_SCOPE

A separate Scope type has been allocated specifically for the `try ...catch` structure. More precisely, for the `catch(e) {}` block.

try { stms } catch (e) { stmts }

Such a scope begins with an opening parenthesis after the `catch` keyword and ends with a closing parenthesis. This scope has only one purpose - to store a reference to a variable containing an error.

try {
  var a \= "a";
} catch (e) {
  var b \= "b";
}

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  TEMPORARY .result;  
  
  VAR a;  
  VAR b;  
  
  catch { 
    
    
    VAR e;  
  }
}

In this example, we see that variables `a` and `b` are in the Global Scope, while there is nothing in CATCH\_SCOPE except `e`. Since the `try {}` and `catch{}` structures are nothing but blocks, which means that the block visibility rule applies to them.

### BLOCK\_SCOPE

It is with the block scope that other types of Scope are often confused. According to the specification, as I said, the visibility rule applies to the block scope:

*   Variables of the VAR type pop up in the higher Scope
*   Variables of type LET and CONST remain inside BLOCK\_SCOPE

{ stmts }

The scope begins with an opening curly brace and ends with a closing one.

{
  var a \= "a";
  let b \= "b";
}

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  TEMPORARY .result;  
  
  VAR a;  
  
  block { 
    
    CONST c;  
    LET b;  
  }
}

In this example, the variable `a` hoisted into the Global Scope because it was declared with the VAR type, and the variables `b` and `c` remained inside BLOCK\_SCOPE.

The expression `for (let x ...) stmt` also applies to block structures

for (let x ...) stmt

The beginning of the scope will be the first opening parenthesis, the end will be the last `stmt` token

Example:

for (let i \= 0; i < 2; i++) {
  var a \= "a";
  let b \= "b";
}

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  TEMPORARY .result;  
  
  VAR a;  
  
  block { 
    
    LET i;  
    
    block { 
      
      LET b;  
    }
  }
}

Here we see two BLOCK\_SCOPES, the first area stores the loop variable `i`, and the nested scope provides block visibility of the loop body.

One more block structure `switch (tag) { cases }`

switch (tag) { cases }

The beginning of the scope is the first opening curly brace, the end is the last closing curly brace.

Example:

var a \= "";

switch (a) {
  default:
    let b \= "b";
    break;
}

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  TEMPORARY .switch\_tag;  
  TEMPORARY .result;  
  
  VAR a;  
  
  block { 
    
    LET b;  
  }
}

Here, the variable `b` is inside the operator brackets of the switch block, so it is declared inside this scope.

### WITH\_SCOPE

In practice, the structure `with (obj) stmt` does not occur often, but I can't skip it, since it also has its own Scope type.

with (obj) stmt

The beginning of the scope is the first `stmt` token, the end is the last `stmt` token.

var obj \= {
  prop1: "prop1"
};

with (obj)
  prop1 \= "prop2";
  
console.log(obj.prop1); 

%\> v8\-debug \--print\-scopes test.js
Global scope:
global { 
  
  
  
  
  TEMPORARY .result;  
  
  VAR obj;  
  
  DYNAMIC\_GLOBAL console;  
  
  with { 
    
    
    DYNAMIC prop1;  
  }
}

Here we see that the `prop1` variable (which, in fact, is a property of the `obj` object) was declared in WITH\_SCOPE as dynamic (dynamic, since its declaration was made without the keyword `var`, `let` or `const`).

### SHADOW\_REALM\_SCOPE

The scope of the so-called [ShadowRealm](https://tc39.es/proposal-shadowrealm/). The feature was proposed in 2022 and is still in experimental status.

The main motivation is to be able to create multiple, completely independent isolated global objects. In other words, to be able to dynamically create Realms. Previously, this feature was available only to "embedders", for example, browser manufacturers, through the API of the engine. Now it is proposed to give this opportunity to JS developers.

import { myRealmFunction } from "./realm.mjs";

var realm \= new ShadowRealm();

realm.importValue("realm.mjs", "myRealmFunction").then((myRealmFunction) \=> {});

export function myRealmFunction() {}

A flag `--harmony-shadow-realm` is required to activate the feature

%\> v8\-debug \--print\-scopes \--harmony\-shadow\-realm test.mjs
V8 is running with experimental features enabled. Stability and security will suffer.
Global scope:
module { 
  
  
  
  
  
  
  TEMPORARY .generator\_object;  
  TEMPORARY .result;  
  
  CONST myRealmFunction;  
  VAR realm;  
  
  arrow (myRealmFunction) { 
    
    
    
    VAR myRealmFunction;  
  }
}
Inner function scope:
function myRealmFunction () { 
  
  
  
}
Global scope:
module { 
  
  
  
  
  
  
  TEMPORARY .generator\_object;  
  TEMPORARY .result;  
  
  LET myRealmFunction;  
  
  function myRealmFunction () { 
    
    
    
    
  }
}

Scope for **ShadowRealm** so far looks like a regular MODULE\_SCOPE, which is logical, since the feature only works with modules. Therefore, it is premature to talk about what the scope for Realm will look like in the final version.

Allocate
--------

After declaring variables in Scope, the memory allocation stage begins. This happens at the moment when we assign a value to a variable. We know from the specification that there are two abstract stores of values **Stack** and **Heap**.

**Heap** is actually associated with a specific execution context. The following get here:

*   variables that might be accessed from the internal Scope
*   there is a possibility that the variable might be accessed from the current or internal Scope (through an `eval` or a runtime with lookup)

These include:

*   variables in CATCH\_SCOPE
*   in SCRIPT\_SCOPE and EVAL\_SCOPE all variables of types kLet and kConst
*   unallocated variables
*   variables, requiring lookup (all dynamic types)
*   variables within a module

The **Stack** gets:

*   all variables of type kTemporary (hidden)
*   everything that has not gotten into the Heap

* * *

In the article, we examined the fundamental data structure in the V8 engine. The article turned out to be voluminous, but hopefully useful.

**My telegram channels:**

EN - [https://t.me/frontend\_almanac](https://t.me/frontend_almanac)  
RU - [https://t.me/frontend\_almanac\_ru](https://t.me/frontend_almanac_ru)

_Русская версия: [https://blog.frontend-almanac.ru/UH\_MQVhvQ7t](https://blog.frontend-almanac.ru/UH_MQVhvQ7t)_