# Post explaining why objects often use less memory than arrays (in PHP)
Why objects (usually) use less memory than arrays in PHP
--------------------------------------------------------

[](#why-objects-usually-use-less-memory-than-arrays-in-php)

This is just a small post in response to [this tweet](https://twitter.com/julienPauli/status/304979359037526017) by Julien Pauli (who by the way is the release manager for PHP 5.5). In the tweet he claims that objects use more memory than arrays in PHP. Even though it _can_ be like that, it's not true in most cases. (Note: This only applies to PHP 5.4 or newer.)

The reason why it's easy to assume that objects are larger than arrays is because objects can be seen as an array of properties and a bit of additional information (like the class it belongs to). And as `array + additional info > array` it obviously follows that objects are larger. The thing is that in most cases PHP can optimize the `array` part of it away. So how does that work?

The key here is that objects usually have a predefined set of keys, whereas arrays don't:

```html
<?php
class Test {
    public $foo, $bar, $baz; // <-- Predefined keys
    
    public function __construct($foo, $bar, $baz) {
        $this->foo = $foo;
        $this->bar = $bar;
        $this->baz = $baz;
    }
}

$obj = new Test(1, 2, 3);
$arr = ['foo' => 1, 'bar' => 2, 'baz' => 3]; // <-- No predefined keys
```

Because the properties for the object are predefined PHP no longer has to store the data in a hashtable, but instead can say that `$foo` is proprety 0, `$bar` is proprety 1, `$baz` is property 2 and then just store the properties in a three-element C array.

This means that PHP only needs _one_ hashtable in the class that does the property-name to offset mapping and uses a memory-efficient C-array in the individual objects. Arrays on the other hand need the hashtable for every array.

To give you some numbers, let's quickly compare the different structures used by arrays and objects.

For arrays there are the `HashTable` structure (one per array) and the `Bucket` structure (one per element):

```c
typedef struct _hashtable {
    uint nTableSize;
    uint nTableMask;
    uint nNumOfElements;
    ulong nNextFreeElement;
    Bucket *pInternalPointer;
    Bucket *pListHead;
    Bucket *pListTail;
    Bucket **arBuckets;
    dtor_func_t pDestructor;
    zend_bool persistent;
    unsigned char nApplyCount;
    zend_bool bApplyProtection;
} HashTable;

typedef struct bucket {
    ulong h;
    uint nKeyLength;
    void *pData;
    void *pDataPtr;
    struct bucket *pListNext;
    struct bucket *pListLast;
    struct bucket *pNext;
    struct bucket *pLast;
    const char *arKey;
} Bucket;
```

Assuming a 64-bit build both the `HashTable` and the `Bucket` use `8*9 + 16 = 88` bytes each (the `16` bytes are allocation overhead). Furthermore buckets need an additional `8` bytes for a pointer from the `arBuckets` array (actually it's a bit more due to power-of-two rounding). And due to the allocation overhead for `arBuckets` the hashtable get's another `16` bytes extra. All in all, for an array with `n` elements you need approximately `104 + 96*n` bytes (which is a freaking lot if you think about it).

For (userland) objects there are also two structures. The first is the object store bucket and the second is the actual `zend_object`:

```c
typedef struct _zend_object_store_bucket {
    zend_bool destructor_called;
    zend_bool valid;
    zend_uchar apply_count;
    union _store_bucket {
        struct _store_object {
            void *object;
            zend_objects_store_dtor_t dtor;
            zend_objects_free_object_storage_t free_storage;
            zend_objects_store_clone_t clone;
            const zend_object_handlers *handlers;
            zend_uint refcount;
            gc_root_buffer *buffered;
        } obj;
        struct {
            int next;
        } free_list;
    } bucket;
} zend_object_store_bucket;

typedef struct _zend_object {
    zend_class_entry *ce;
    HashTable *properties;   // <-- not usually used
    zval **properties_table;
    HashTable *guards;       // <-- not usually used
} zend_object;
```

The object store bucket needs `8*8 = 64` bytes (note that here there are no `16` bytes allocation overhead, because the object store is mass allocated). The `zend_object` needs another `4*8 + 16 = 48`. Furthermore we need `16` bytes as allocation overhead for the `properties_table` and then `8` bytes per element in it. (The `properties_table` here obviously is the C-array I referred to above. This is what stores the property data). So what you get in the end is `128 + 8*n`.

Now compare those two values: `104 + 96*n` for arrays and `128 + 8*n` for objects. As you can see the "base size" for objects is larger, but the per-property cost is twelve times smaller. A few examples (with different amount of properties):

```
N  | Array | Object
------------------
1  |  200  | 136
3  |  392  | 152
10 | 1064  | 208

```

It should be clear that arrays use quite a bit more memory and the difference gets larger the more properties you have.

Note though that in the above I have been considering objects with _declared_ properties. PHP also allows "dynamic" properties (e.g. what `stdClass` lives off). In this case there is no way around using a hashtable (stored in `zend_object.properties`). Another case where hashtables are used is if the class uses `__get`\-style magic. These magic property methods use recursion guards which are stored in the `zend_object.guards` hashtable.

Okay, so what do we conclude from this? Some points:

*   **Upgrade to PHP 5.4** if you haven't yet! PHP 5.3 doesn't yet have this cool optimization.
*   Declaring properties isn't just a best practice for class design, it will actually also save you a good bit of memory.
*   Not using objects because they are "too heavy on the memory" is dumb. At least if arrays are the alternative.

And two more interesting (or maybe not) facts that are tangentially related:

*   The very same optimization is also used for symbol tables. Most of the time PHP will not actually create hashtables that contain your variables, instead it will just use a C-array with the variables. Only if you use things like variable-variables PHP will create a real symbol hashtable.
*   When looking up a property PHP often doesn't even have to access the hashtable containing the property-name to offset mappings. The `property_info` structure that contains the relevant information is polymorphically cached in the op array.

~[nikic](https://twitter.com/nikita_ppv)