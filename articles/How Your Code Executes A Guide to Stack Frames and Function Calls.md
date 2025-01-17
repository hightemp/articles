# How Your Code Executes: A Guide to Stack Frames and Function Calls
When a program executes, it uses a **stack** to manage function calls and local variables. The stack is a Last-In-First-Out (LIFO) data structure that grows downwards in memory. Each function call creates a **stack frame** (also known as an activation record) that contains information about the function's execution, such as local variables, return addresses, and arguments.

[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F35358ebb-0af2-482e-a359-36932f60b1a5_399x299.png)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F35358ebb-0af2-482e-a359-36932f60b1a5_399x299.png)

The image describes the layout of two stack frames: one for the **caller** (the function that makes the call) and one for the **callee** (the function being called). Here's a detailed breakdown of the components:

1.  **Save Args**: The caller saves the arguments it will pass to the callee.
    
2.  **argn**: The nth argument passed to the callee.
    
3.  **Call Function**: The instruction to call the callee function.
    
4.  **Return Address**: The address to which the callee should return after execution.
    
5.  **Old Frame Pointer (Fp)**: The caller's frame pointer is saved to restore it after the callee returns.
    
6.  **Update Stack Pointer (Sp)**: The stack pointer is updated to point to the new top of the stack.
    

1.  **Compute Frame Size**: The callee calculates the size needed for its local variables.
    
2.  **Local Variables**: Space allocated for the callee's local variables.
    
3.  **Save Old Frame Pointer (Fp)**: The callee saves the caller's frame pointer.
    
4.  **Update Frame Pointer (Fp)**: The callee updates the frame pointer to point to its stack frame.
    
5.  **Update Stack Pointer (Sp)**: The stack pointer is updated to reflect the new top of the stack.
    
6.  **Return Address**: The address to return to after the callee finishes execution.
    

Let's consider a simple C code example to illustrate this:

```
#include <stdio.h>

void callee(int b) {
    int y = b + 1;
    printf("Value of y: %d\n", y);
}

void caller() {
    int a = 5;
    callee(a);
}

int main() {
    caller();
    return 0;
}
```

1.  **Main Function**:
    
    *   `main` calls `caller`.
        
2.  **Caller Function**:
    
    *   `caller` sets up its stack frame.
        
    *   It saves the argument `a = 5` to pass to `callee`.
        
    *   It saves the return address to return to `main` after `callee` finishes.
        
    *   It updates the stack pointer and frame pointer.
        
    *   It calls `callee`.
        
3.  **Callee Function**:
    
    *   `callee` sets up its stack frame.
        
    *   It saves the old frame pointer from `caller`.
        
    *   It updates the frame pointer to point to its own frame.
        
    *   It allocates space for its local variable `y`.
        
    *   It computes `y = b + 1` (where `b` is the argument passed by `caller`).
        
    *   It prints the value of `y`.
        
    *   It restores the old frame pointer and returns to `caller`.
        
4.  **Return to Caller**:
    
    *   `caller` restores its stack frame.
        
    *   It updates the stack pointer and frame pointer.
        
    *   It returns to `main`.
        
5.  **Return to Main**:
    
    *   `main` continues execution and eventually terminates.
        

*   **Stack Pointer (Sp)**: Points to the top of the stack. It is adjusted as functions allocate and deallocate space.
    
*   **Frame Pointer (Fp)**: Points to the base of the current stack frame. It helps in accessing local variables and arguments.
    
*   **Return Address**: The address in the caller's code to which the callee should return.
    
*   **Arguments**: Values passed from the caller to the callee.
    
*   **Local Variables**: Variables that are local to the function and stored in its stack frame.
    

When a function is called, the current state (including the return address and frame pointer) is saved, and a new stack frame is created for the callee. When the callee returns, it restores the saved state, and execution continues in the caller.

This mechanism ensures that function calls are managed efficiently, with each function having its own isolated space for variables and control flow.

### Subscribe to Low-Level Lore

Exploring the depths of system internals, low-level programming, and the hidden mechanics of computers, from C and assembly to databases and beyond