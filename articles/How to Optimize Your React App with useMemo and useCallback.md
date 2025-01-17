# How to Optimize Your React App with useMemo and useCallback
[![](https://substackcdn.com/image/fetch/w_96,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Ff3dcb07f-d15b-4373-98a1-5de1a4e7371d_144x144.png)
](https://imtarundhiman.substack.com/)

### Boost Your React App's Efficiency by Memoizing Values and Functions—Learn When and How to Use useMemo and useCallback Hooks in React!

[

![](https://substackcdn.com/image/fetch/w_36,h_36,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Ff3dcb07f-d15b-4373-98a1-5de1a4e7371d_144x144.png)




](https://substack.com/@tarundhiman)

The Story of Sara’s Magic Factory
---------------------------------

Sara runs a small factory where she makes custom toys. Her factory has two workers:

*   **Memory Mike** - He remembers things that don't change often.
    
*   **Action Andy** - He performs tasks but hates repeating the same work unnecessarily.
    

Sara realized her factory was slow because sometimes Mike kept forgetting simple things, and Andy would redo the same task over and over. Sara decided to fix this:

*   **Mike got a magic notebook** to remember answers to questions he had already solved.
    
*   **Andy got a task tracker** to skip tasks he already knew how to do.
    

This improved the factory’s efficiency dramatically.

How Does This Relate to React?
------------------------------

In React, when your app becomes bigger and more complex, it can slow down. Sometimes, React recalculates things or redoes tasks that it doesn’t need to. This is where `useMemo`  and `useCallback`  come in. They are like Mike’s notebook and Andy’s tracker!

> ### In this Article you will learn How to Optimize ReactJS Performance Using `useMemo` and `useCallback`
> 
> As React apps grow in complexity, performance can become an issue. Fortunately, there are tools within React itself that help optimize performance and avoid unnecessary re-renders. In this article, we’ll dive into how you can optimize ReactJS performance using the `useMemo` and `useCallback` hooks. These powerful hooks help ensure that your app remains fast and responsive, even as it scales.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa7f3f7cb-3929-4ebb-8b1b-9f2a4fe8d76c_1024x620.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa7f3f7cb-3929-4ebb-8b1b-9f2a4fe8d76c_1024x620.png)

What is useMemo in React ?
--------------------------

`useMemo` is like Memory Mike's magic notebook. It remembers the result of a calculation so React doesn’t have to redo it if the inputs haven’t changed.

In technical terms, `useMemo` is a React hook that memoizes the result of a computation or function. Essentially, it stores the result of a function and reuses it until the dependencies change, preventing unnecessary recalculations. This can be incredibly helpful when dealing with expensive operations that don’t need to be recalculated on every render.

#### Technical Details

*   **Signature**:
    
    ```
    const memoizedValue = useMemo(() => computeFunction(), [dependencies]);
    ```
    
*   **Returns**: A memoized (cached) value.
    
*   **Dependencies Array**: A list of values that `useMemo` watches. If any of these values change, the cached value is recomputed.
    

#### When to Use `useMemo`

*   **Expensive Operations**: If your app performs calculations like sorting, filtering, or aggregating large data sets, `useMemo` can ensure these operations are only recalculated when necessary.
    
*   **Derived State**: When transforming data into a new format or computing a value dynamically based on props or state.
    
*   **Avoid Unnecessary Rendering**: `useMemo` can help prevent child components from re-rendering unnecessarily by ensuring their props don’t change unless required.
    

> #### What is Derived State in React
> 
> Derived state refers to values in your component that are computed or derived from existing state or props rather than being directly stored in the state. Instead of recalculating these values on every render, you can use `useMemo` to optimize this process and improve performance.

#### Understanding Derived State with an Example

Imagine Sara wants to calculate the total size of all toys in her factory. Instead of storing the total size as a separate state (which she'd have to update every time a new toy is added or removed), she can calculate it dynamically from the toys list.

Here’s the problem: if the calculation is complex or the toys list is large, recalculating the total size on every render can slow things down. This is where `useMemo` comes in to optimize derived state.

#### Example: Calculating Total Size of Toys

```
import React, { useState, useMemo } from 'react';

const TotalToySize = ({ toys }) => {
  // Derived state: Calculating the total size of toys
  const totalSize = useMemo(() => {
    console.log("Calculating total size of toys...");
    return toys.reduce((total, toy) => total + toy.size, 0);
  }, [toys]);

  return <div>Total Toy Size: {totalSize}</div>;
};

const App = () => {
  const [toys, setToys] = useState([
    { name: "Teddy", size: 10 },
    { name: "Robot", size: 20 },
    { name: "Car", size: 15 },
  ]);

  const addToy = () =>
    setToys([...toys, { name: "Ball", size: Math.floor(Math.random() * 30) }]);

  return (
    <div>
      <TotalToySize toys={toys} />
      <button onClick={addToy}>Add Toy</button>
    </div>
  );
};

export default App;
```

#### Explanation

**What’s Happening?**

*   The `totalSize` is derived from the toys list.
    
*   Instead of recalculating the total size every time the component renders, `useMemo` ensures the calculation only happens when the toys list changes.
    

**Why Not Store Total Size in State?**

*   If you store `totalSize` in state, you'd need to manually update it every time the toys list changes, adding unnecessary complexity and potential bugs (e.g., forgetting to update `totalSize`).
    

**How** `useMemo` **Helps**

*   React will remember the result of the `toys.reduce()` calculation.
    
*   It recalculates the total size only when the toys array changes.
    

> #### When to Consider `useMemo` in Derived State in Reactjs
> 
> The main benefit of using `useMemo` here is to optimize performance. If you had a list of 10,000 toys, recalculating the total size on every render would be a costly operation. By using `useMemo`, React ensures that recalculation only happens when there's an actual change in the `toys` array.

#### Another Example: Filtered List of Toys

Let’s say Sara wants to see only the large toys in her factory (size > 15). This filtered list is a derived state.

```
const LargeToys = ({ toys }) => {
  // Derived state: Filtering large toys
  const largeToys = useMemo(() => {
    console.log("Filtering large toys...");
    return toys.filter((toy) => toy.size > 15);
  }, [toys]);

  return (
    <ul>
      {largeToys.map((toy, index) => (
        <li key={index}>{toy.name}</li>
      ))}
    </ul>
  );
};

const App = () => {
  const [toys, setToys] = useState([
    { name: "Teddy", size: 10 },
    { name: "Robot", size: 20 },
    { name: "Car", size: 15 },
  ]);

  const addToy = () =>
    setToys([...toys, { name: "Ball", size: Math.floor(Math.random() * 30) }]);

  return (
    <div>
      <LargeToys toys={toys} />
      <button onClick={addToy}>Add Toy</button>
    </div>
  );
};

export default App;

```

What is useCallback in React ?
------------------------------

`useCallback` is like Action Andy's task tracker. It remembers a function so that React doesn’t recreate it unless it absolutely needs to.

In technical terms, `useCallback` is a React hook that memoizes a function, ensuring that the function's reference stays the same between renders unless its dependencies change. This is useful when you pass functions as props to child components. Without `useCallback`, the function would be recreated on every render, potentially triggering unnecessary re-renders of child components.

#### Technical Details

*   **Signature**:
    
    ```
    const memoizedCallback = useCallback(() => callbackFunction(), [dependencies]);
    ```
    
*   **Returns**: A memoized (cached) version of the function.
    
*   **Dependencies Array**: A list of values that `useCallback` watches. If any of these values change, the cached function is recreated.
    

#### When to Use `useCallback`

*   **Function Passed as Props**: When passing a function down to child components, `useCallback` ensures that the function is not recreated on every render, avoiding unnecessary re-renders of the child component.
    
*   **Event Handlers**: If you have event listeners or handlers that don’t need to be recreated on every render, `useCallback` can help prevent that.
    

#### **When NOT to Use** `useCallback`**:**

*   If the function is defined inside a component but isn't passed down as a prop to children, or if the component doesn't re-render frequently, there is no need to use `useCallback`. Overusing `useCallback` can also lead to unnecessary complexity, so it’s best to use it only when you actually see performance improvements.
    

#### **Example 1: Without** `useCallback`

Here’s a scenario where a parent component passes a function as a prop to a child component. Without `useCallback`, the child component might re-render unnecessarily.

```
import React, { useState } from 'react';

const Child = React.memo(({ handleClick }) => {
  console.log("Child re-rendered");
  return <button onClick={handleClick}>Click Me</button>;
});

const Parent = () => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    console.log("Button clicked");
  };

  return (
    <div>
      <h1>Count: {count}</h1>
      <Child handleClick={handleClick} />
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

export default Parent;

```

#### **Explanation:**

*   When the **Parent** component re-renders (due to the state change in `setCount`), the **handleClick** function is recreated.
    
*   Even though the function logic hasn't changed, because it's passed as a prop, the **Child** component re-renders every time the **Parent** re-renders.
    
*   In this case, React.memo doesn’t prevent the child from re-rendering because the function reference changes.
    

#### **Example 2: With** `useCallback`

Now, let's optimize the code by using the `useCallback` hook:

```
import React, { useState, useCallback } from 'react';

const Child = React.memo(({ handleClick }) => {
  console.log("Child re-rendered");
  return <button onClick={handleClick}>Click Me</button>;
});

const Parent = () => {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    console.log("Button clicked");
  }, []); // No dependencies, so the function reference remains the same

  return (
    <div>
      <h1>Count: {count}</h1>
      <Child handleClick={handleClick} />
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

export default Parent;

```

#### **Explanation:**

*   By wrapping the `handleClick` function with `useCallback`, we ensure that the **Child** component only re-renders when necessary.
    
*   `handleClick` will now retain the same reference across renders, because it has no dependencies (`[]`).
    
*   `React.memo` will now prevent unnecessary re-renders of the **Child** component, since the function reference stays the same.
    

#### **Key Points to Remember:**

1.  **Memoizing Functions**: `useCallback` is useful when passing functions down to child components to avoid unnecessary re-renders.
    
2.  **Dependencies**: The function will only be recreated if one of the dependencies changes. If you pass an empty array (`[]`), the function reference never changes.
    
3.  **Performance Optimization**: It's helpful to use `useCallback` to optimize performance in scenarios where child components are expensive to re-render or if you're passing functions to deeply nested components.
    

Using useMemo and useCallback together
--------------------------------------

Sometimes, you might need both to optimize your app. For example, when a child component relies on both computed values and functions:

```
const Parent = () => {
  const [count, setCount] = useState(0);

  // Memoized value
  const doubled = useMemo(() => count * 2, [count]);

  // Memoized function
  const increment = useCallback(() => setCount((prev) => prev + 1), []);

  return <Child count={doubled} increment={increment} />;
};

const Child = React.memo(({ count, increment }) => {
  console.log("Child rendered!");
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
});

```

**Key Differences in useMemo and useCallback Hooks in React**
-------------------------------------------------------------

#### Purpose:

*   `useMemo` is used to optimize performance by memoizing the **result** of a function or calculation. This means it stores the result of a computation and only recalculates it if the dependencies change.
    
*   `useCallback` is used to memoize the **function** itself. It ensures that the function reference stays the same between renders unless its dependencies change, preventing unnecessary function recreation.
    

#### Returns:

*   `useMemo` returns a memoized value, which is the cached result of a computation or function.
    
*   `useCallback` returns a memoized function, which is essentially a stable reference to the function that React can reuse between renders.
    

#### Usage:

*   `useMemo` is typically used when you want to optimize **expensive calculations** or derived state (like filtering or sorting large lists), ensuring that they don't run unnecessarily on every render.
    
*   `useCallback` is typically used when you need to pass a **stable callback function** to child components, especially when those components rely on `React.memo` or similar optimizations, or when you want to avoid unnecessary re-renders triggered by function references changing.
    

#### Dependency Array:

*   `useMemo` recomputes the memoized value only when the dependencies specified in the dependency array change.
    
*   `useCallback` recreates the function only when the dependencies specified in the dependency array change.
    

#### When to Use:

*   `useMemo` should be used when you want to **optimize performance** by preventing unnecessary recomputations of expensive calculations or derived state.
    
*   `useCallback` should be used when you want to avoid unnecessary **function recreation** on every render, which can help optimize child components that rely on function references.
    

#### Typical Result:

*   `useMemo` provides a **calculated value** based on some computation, like the result of a filtering or sorting operation.
    
*   `useCallback` provides a **function** that will not change unless the specified dependencies change, ensuring that the same function reference is used across renders.
    

#### Impact on Re-renders:

*   `useMemo` helps to avoid unnecessary re-renders caused by recalculating expensive values or computations each time the component renders.
    
*   `useCallback` helps avoid unnecessary re-renders of child components that depend on functions passed as props, ensuring that the function reference remains stable unless the dependencies change.
    

`useMemo`  and `useCallback` are both performance optimization hooks in React, but they serve different purposes. `useMemo` is for memoizing the **result** of calculations, while `useCallback` is for memoizing the **function** itself.

**Performance Considerations of useMemo and useCallback**
---------------------------------------------------------

While `useMemo` and `useCallback` can improve performance, they also introduce complexity. Here are detailed considerations to keep in mind:

### **1\. Cost of Memorization vs. Recalculation**

Every time a component renders, React needs to evaluate the dependencies of `useMemo` and `useCallback` to decide whether to reuse the cached value or function. If the dependencies array is large or frequently changing, the cost of checking dependencies can outweigh the benefits of memoization.

#### **Example**

```
const App = () => {
  const [count, setCount] = useState(0);
  const largeArray = Array.from({ length: 10000 }, (_, i) => i);

  const expensiveCalculation = useMemo(() => {
    console.log("Performing expensive calculation...");
    return largeArray.reduce((sum, num) => sum + num, 0);
  }, [largeArray]); // Recomputes unnecessarily if largeArray changes frequently

  return (
    <div>
      <p>Sum: {expensiveCalculation}</p>
      <button onClick={() => setCount((prev) => prev + 1)}>Increment</button>
    </div>
  );
};
```

In this example, the large dependencies array (`largeArray`) might make the performance worse despite using `useMemo`.

### **2\. Premature Optimization**

Adding `useMemo` and `useCallback` everywhere can clutter your code and make it harder to read. Only use them when you have identified a specific performance bottleneck.

### **3\. Dependency Management**

Incorrectly specifying dependencies can cause bugs. For instance, missing a dependency in `useMemo` or `useCallback` can lead to stale values or functions being used.

#### **Example**

```
import React, { useState, useMemo, useCallback } from "react";

const App = () => {
  const [count, setCount] = useState(0);
  const [multiplier, setMultiplier] = useState(2);

  // Memoized value with missing dependency
  const multipliedValue = useMemo(() => {
    console.log("Recomputing multipliedValue...");
    return count * multiplier; // `multiplier` is used but not listed in dependencies
  }, [count]); // Missing `multiplier` in dependencies

  // Callback function with missing dependency
  const increment = useCallback(() => {
    setCount((prevCount) => prevCount + multiplier); // `multiplier` is used but not listed
  }, []); // Missing `multiplier` in dependencies

  return (
    <div>
      <p>Count: {count}</p>
      <p>Multiplier: {multiplier}</p>
      <p>Multiplied Value: {multipliedValue}</p>
      <button onClick={increment}>Increment by Multiplier</button>
      <button onClick={() => setMultiplier(multiplier + 1)}>Increase Multiplier</button>
    </div>
  );
};

export default App;
```

#### **Explanation of the Problem**

1.  **Missing Dependency in** `useMemo`:
    
    *   The `multiplier` is used inside the `useMemo` calculation but is not listed in the dependencies array.
        
    *   If the `multiplier` changes, the `multipliedValue` will not update because React doesn’t know to recompute it.
        
2.  **Missing Dependency in** `useCallback`:
    
    *   The `increment` function uses the `multiplier` value but doesn’t include it in the dependencies array.
        
    *   If the `multiplier` changes, the `increment` function will still use the old value of `multiplier`, leading to stale updates.
        

#### Fixed Code

```
const App = () => {
  const [count, setCount] = useState(0);
  const [multiplier, setMultiplier] = useState(2);

  // Correct dependencies in useMemo
  const multipliedValue = useMemo(() => {
    console.log("Recomputing multipliedValue...");
    return count * multiplier;
  }, [count, multiplier]); // Include `multiplier` as a dependency

  // Correct dependencies in useCallback
  const increment = useCallback(() => {
    setCount((prevCount) => prevCount + multiplier);
  }, [multiplier]); // Include `multiplier` as a dependency

  return (
    <div>
      <p>Count: {count}</p>
      <p>Multiplier: {multiplier}</p>
      <p>Multiplied Value: {multipliedValue}</p>
      <button onClick={increment}>Increment by Multiplier</button>
      <button onClick={() => setMultiplier(multiplier + 1)}>Increase Multiplier</button>
    </div>
  );
};
```

Conclusion
----------

Both `useMemo` and `useCallback` are powerful tools that help optimize the performance of React applications by preventing unnecessary recalculations and re-renders. However, they should be used judiciously and only when you identify specific performance bottlenecks. By understanding their differences and knowing when to use them, you can make your React apps faster and more efficient, just like Sara's magic factory in our example!

Stay tuned for more tips on optimizing React apps, and happy coding!

#### Discussion about this post

![](https://substackcdn.com/image/fetch/w_32,h_32,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack.com%2Fimg%2Favatars%2Fdefault-light.png)

Only paid subscribers can comment on this post
----------------------------------------------

#### Check your email

For your security, we need to re-authenticate you.

Click the link we sent to , or [click here to sign in](https://substack.com/sign-in?redirect=%2Fp%2Freact-performance-optimization-usememo-usecallback-guide&for_pub=imtarundhiman&with_password=true).