# SwissTable: A High-Performance Hash Table Implementation - DEV Community
[](#introduction)Введение
-------------------------

В 2022 году компания ByteDance предложила [исправить проблему](https://github.com/golang/go/issues/54766), рекомендовав `Golang` использовать SwissTable для реализации карты. В 2023 году компания Dolt опубликовала пост в блоге под названием [«SwissMap: более компактная и быстрая хеш-таблица Golang»](https://www.dolthub.com/blog/2023-03-28-swiss-map/), в котором подробно описала дизайн `swisstable` и привлекла к нему широкое внимание. Основная команда разработчиков Go пересматривает дизайн `swisstable` и добавила соответствующий код в [`runtime`](https://github.com/golang/go/blob/6a730e1ef0b7f312fe01815086a2eb5a25739f2d/src/runtime/map_swiss.go#L7). В свободное время на каникулах давайте углубимся в принципы работы, сравним их с `runtime map` и поймём, почему они могут стать стандартом для реализации `map`

> Эта статья была впервые опубликована в Medium MPP. Если вы являетесь пользователем Medium, пожалуйста, подпишитесь на меня на [Medium](https://medium.huizhou92.com/). Большое вам спасибо.

В этой статье не будут полностью объяснены принципы `hashtable` or `swisstable`. Требуется базовое понимание `hashtable`.

`hashtable` обеспечивает преобразование `key` в соответствующий `value` путём преобразования `key` в некоторую «позицию» с помощью `hash function`. Из этой позиции мы можем напрямую получить нужное значение.

[](#traditional-raw-hashtable-endraw-)Традиционный `Hashtable`
--------------------------------------------------------------

`hashtable` обеспечивает сопоставление `key` с соответствующим значением путём преобразования ключа в некоторую «позицию» с помощью хэш-функции. Однако, даже если хэш-функция идеальна, конфликты всё равно неизбежны при сопоставлении бесконечного числа ключей с конечным пространством памяти: два разных ключа будут сопоставлены с одной и той же позицией. Чтобы решить эту проблему, в традиционных хэш-таблицах есть несколько стратегий разрешения конфликтов, чаще всего `chaining` и `linear probing`.

### [](#chaining)Сцепление

Цепочка — это наиболее распространённый метод, при котором, если несколько ключей сопоставляются с одной и той же позицией, эти ключи и значения хранятся в связанном списке. При поиске используется хеш-функция для определения позиции, а затем просматривается связанный список в этой позиции, чтобы найти соответствующий ключ. Его структура похожа на эту:

**Рисунок 1: Реализация цепочки `hashtable`**

[![](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fr97z4p2sz1u84rhlz929.png)
](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fr97z4p2sz1u84rhlz929.png)

Цепочки легко реализовать, и для них требуется меньше граничных условий. Вставка и удаление данных выполняются быстро, с помощью вставки в начало для добавления новых записей и корректировки следующего указателя для удаления. Цепочки также могут предотвратить снижение производительности за счёт преобразования слишком длинных цепочек в деревья поиска. Однако цепочки не подходят для кэширования, и производительность может снизиться при большом количестве конфликтов. Разные `slots` могут быть широко распределены по памяти, что приводит к плохой пространственной локализации структуры данных в целом.

### [](#linear-probing)Линейное Зондирование

Линейное зондирование — ещё один стандартный метод разрешения конфликтов в хэш-таблицах. В отличие от цепочек, при возникновении конфликта в хэш-таблице он последовательно ищет от позиции конфликта до тех пор, пока не найдёт пустой слот или не вернётся к позиции конфликта. В этот момент он изменяет размер и перехеширует записи.

**Рисунок 2: Анимация линейного зондирования**

[![](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fimages.hxzhouh.com%2Fblog-images%2F2024%2F09%2Fbfb5cfbb7f611f0fed2f4d58c0eceaf4.gif)
](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fimages.hxzhouh.com%2Fblog-images%2F2024%2F09%2Fbfb5cfbb7f611f0fed2f4d58c0eceaf4.gif)

Поиск работает аналогичным образом: вычисляется хеш-позиция для ключа, а затем сравнивается каждый ключ, начиная с этой позиции, пропуская удалённые записи до тех пор, пока не будет достигнут пустой слот, указывающий на то, что ключа нет в таблице. При удалении используется маркер-надгробие.

**Рисунок 3: Анимация поиска с линейным зондированием**

[![](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fimages.hxzhouh.com%2Fblog-images%2F2024%2F09%2Ff0052b66a4e66fb5e9558c4e48601bd7.gif)
](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fimages.hxzhouh.com%2Fblog-images%2F2024%2F09%2Ff0052b66a4e66fb5e9558c4e48601bd7.gif)

Линейное сканирование имеет сопоставимую с цепочечным сканированием временную сложность. Его преимущества заключаются в том, что оно подходит для кэширования и может быть реализовано с помощью компактных структур данных, таких как массивы. Однако у него есть недостатки:

1.  Сложная реализация с тремя состояниями для `slot`: занято, пусто и удалено.
2.  Цепная реакция конфликтов, приводящая к более частому изменению размера, чем объединение в цепочку, и потенциально более значительному использованию памяти.
3.  Более высокая вероятность ухудшения процесса поиска до `O(n)` без возможности преобразования областей с большим количеством конфликтов в деревья поиска.

Многие библиотеки используют цепочечное индексирование из-за трудностей с удалением элементов и конфликтных цепочечных реакций при линейном индексировании. Несмотря на недостатки, линейное индексирование, удобное для кэша и эффективное с точки зрения памяти, обеспечивает значительные преимущества в производительности на современных компьютерах, что привело к его использованию в таких языках, как `golang` и `Python`.

### [](#go-map-data-storage)Хранилище Картографических данных Go

Давайте резюмируем, как `Go Map` хранятся данные:

\*

_Рисунок 4: Карта перехода \*_

[![](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F3f63lz30u625v5n08s3z.png)
](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F3f63lz30u625v5n08s3z.png)

Quick summary:

*   Go `map` uses a hash function to map keys to multiple `buckets`, each with a fixed number of key-value `slots` for storage.
*   Each `bucket` stores up to 8 key-value pairs. The conflicting keys and values are stored within the same bucket when conflicts occur.
*   The map uses a hash function to compute the key's hash value and locate the corresponding `bucket`.
*   If a `bucket` is complete (all 8 `slots` used), an `overflow bucket` is generated to continue storing new key-value pairs.
*   For lookups, the key's hash value is calculated, the corresponding `bucket` is determined, and each `slot` within the `bucket` is checked. If there is an `overflow bucket`, its keys are also checked sequentially.

[](#swisstable-an-efficient-hashtable-implementation)SwissTable: An Efficient Hashtable Implementation
------------------------------------------------------------------------------------------------------

`SwissTable` is a `hashtable` implementation based on an improved linear probing method. Its core idea is to optimize performance and memory usage by enhancing the `hashtable` structure and metadata storsage. SwissTable uses a new metadata control mechanism to significantly reduce unnecessary `key` comparisons and leverages SIMD instructions to boost throughput.

Reviewing the two standard `hashtable` implementations shows they either waste memory, need to be cache-friendly or suffer performance drops in lookup, insertion, and deletion operations after conflicts. These issues persist even with a "perfect hash function." Using a suboptimal hash function dramatically increases the probability of key conflicts and worsens performance, possibly even falling short of linear searches in an array.

The industry sought a hash table algorithm that was friendly to cache and resistant to lookup performance degradation. Many focused on developing better hash functions close to "perfect hash function" quality while optimizing calculation performance; others worked on improving the hash table's structure to balance cache friendliness, performance, and memory usage. [`swisstable`](https://abseil.io/about/design/swisstables) belongs to the latter.

`SwissTable`'s time complexity is similar to linear probing, while its space complexity is between chaining and linear probing. The implementation I've referenced is primarily based on [dolthub/swiss](https://github.com/dolthub/swiss/tree/main).

### [](#basic-structure-of-swisstable)Basic Structure of SwissTable

Although the name has changed, `swisstable` is still a `hashtable` utilizing an improved linear probing method for hash collisions. Its underlying structure resembles an array. Now, let's delve into the structure of `swisstable`:  

```
type Map[K comparable, V any] struct {  
    ctrl     []metadata  
    groups   []group[K, V]  
    hash     maphash.Hasher[K]  
    resident uint32   
    dead     uint32   
    limit    uint32   
} 

type metadata [groupSize]int8  

type group[K comparable, V any] struct {  
    keys   [groupSize]K  
    values [groupSize]V  
} 
```

Enter fullscreen mode Exit fullscreen mode

In `swisstable`, `ctrl` is an array of `metadata`, corresponding to the `group[K, V]` array. Each `group` has 8 `slots`.

The hash is divided into `57 bits` for H1 to determine the starting `groups`, and the remaining `7 bits` called H2, stored in `metadata` as the hash signature of the current key for subsequent search and filtering.

The key advantage of `swisstable` over traditional hash tables lies in the metadata called `ctrl`. Control information includes:

*   Whether a slot is empty: `0b10000000`
*   Whether a slot has been deleted: `0b11111110`
*   The key's hash signature (H2) in a slot: `0bh2`

The unique values of these states allow the use of SIMD instructions, maximizing performance.

### [](#adding-data)Adding Data

The process of adding data in `swisstable` involves several steps:

1.  Calculate the hash value and split it into `h1` and `h2`. Using `h1`, determine the starting groups.
2.  Use `metaMatchH2` to check the current group's `metadata` for a matching `h2`. If found, further check for the matching key and update the value if they match.
3.  If no matching key is found, use `metaMatchEmpty` to check for empty `slots` in the current group. Insert the new key-value pair if an empty slot is found and update the `metadata` and `resident` count.
4.  If no empty slots are available in the current group, perform linear probing to check the next `groups`.

```
func (m *Map[K, V]) Put(key K, value V) {  
    if m.resident >= m.limit {  
        m.rehash(m.nextSize())  
    }  
    hi, lo := splitHash(m.hash.Hash(key))  
    g := probeStart(hi, len(m.groups))  
    for { // inlined find loop 
        matches := metaMatchH2(&m.ctrl[g], lo)  
        for matches != 0 {  
            s := nextMatch(&matches)  
            if key == m.groups[g].keys[s] { // update 
                m.groups[g].keys[s] = key  
                m.groups[g].values[s] = value  
                return  
            }  
        }  
        matches = metaMatchEmpty(&m.ctrl[g])  
        if matches != 0 { // insert 
            s := nextMatch(&matches)  
            m.groups[g].keys[s] = key  
            m.groups[g].values[s] = value  
            m.ctrl[g][s] = int8(lo)  
            m.resident++  
            return  
        }  
        g += 1 // linear probing 
        if g >= uint32(len(m.groups)) {  
            g = 0  
        }  
    }  
}
func metaMatchH2(m *metadata, h h2) bitset {  
    return hasZeroByte(castUint64(m) ^ (loBits * uint64(h)))  
}

func nextMatch(b *bitset) uint32 {  
    s := uint32(bits.TrailingZeros64(uint64(*b)))  
    *b &= ^(1 << s)  
    return s >> 3   
} 
```

Enter fullscreen mode Exit fullscreen mode

Although the steps are few, they involve complex bit operations. Normally, `h2` needs to be compared with all keys sequentially until the target is found. `swisstable` cleverly achieves this by:

*   Multiplying `h2` by `0x0101010101010101` to get a uint64, allowing simultaneous comparison with 8 `ctrl` values.
*   Performing `xor` with `meta`. If `h2` exists in `metadata`, the corresponding bit will be zero. The `metaMatchH2` function helps us understand this process.

```
func TestMetaMatchH2(t *testing.T) {
    metaData := make([]metadata, 2)
    metaData[0] = [8]int8{0x7f, 0, 0, 0x7f, 0, 0, 0, 0x7f}
    m := &metaData[0]
    h := 0x7f
    metaUint64 := castUint64(m)
    h2Pattern := loBits * uint64(h)
    xorResult := metaUint64 ^ h2Pattern
    fmt.Printf("metaUint64: %b\n", xorResult)
    r := hasZeroByte(xorResult)
    fmt.Printf("r: %b\n", r)
    for r != 0 {  
        fmt.Println(nextMatch(&r))  
    }
}
----
output
// metaUint64: 00000000 11111110 11111110 11111110 0000000 01111111 01111111 00000000
// r: 10000000 00000000 00000000 00000000 10000000 00000000 00000000 10000000
// 0
// 3
// 7 
```

Enter fullscreen mode Exit fullscreen mode

### [](#advantages-of-swisstable)Advantages of SwissTable

Reviewing SwissTable implementation reveals several key benefits:

*   Operations are shifted from `slots` to `ctrl`, which are smaller and easily placed in the CPU cache, speeding up operations despite the additional step of locating `slots`.
*   Records hash signatures, reducing meaningless key comparisons—the main cause of linear probing performance drops.
*   Batch operations on `ctrl` for `slots` increase throughput significantly.
*   Metadata and memory layout are optimized for SIMD instructions, maximizing performance.
*   `Slot` optimizations, such as compressing large data, increase cache hit rates.

`swisstable` solves spatial locality issues and exploits modern CPU features for batch element operations, significantly boosting performance.

Finally, running a benchmark on a local MacBook M1 (without SIMD support) shows significant performance improvements in large map scenarios.

**Figure 5: Official `swisstable` benchmark**

[![](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F4bds1tatmc4snmvat6ma.png)
](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F4bds1tatmc4snmvat6ma.png)

[](#conclusion)Conclusion
-------------------------

Currently, the official implementation of `swisstable` in Go is still under discussion, and there are a few community implementations like [concurrent-swiss-map](https://github.com/mhmtszr/concurrent-swiss-map) and [swiss](https://github.com/dolthub/swiss). However, they are not perfect; in small map scenarios, `swisstable` may even underperform compared to `runtime_map`. Nonetheless, the potential demonstrated by `swisstable` in other languages indicates that it is worth anticipation.

[](#references)References
-------------------------

*   Dolthub: [SwissMap](https://www.dolthub.com/blog/2023-03-28-swiss-map/)
*   SwissTable principles: [Abseil SwissTables](https://abseil.io/about/design/swisstables)
*   Original SwissTable proposal at cppcon: [cppcon talk](https://www.youtube.com/watch?v=ncHmEUmJZf4)
*   Improvements to SwissTable algorithm: [YouTube link](https://www.youtube.com/watch?v=JZE3_0qvrMg)
*   Bit manipulation primer: [Stanford Bit Hacks](http://graphics.stanford.edu/~seander/bithacks.html##ValueInWord)
*   Hash function comparisons: [Hash function tests](https://aras-p.info/blog/2016/08/09/More-Hash-Function-Tests/)
*   An additional bit manipulation article: [Fast Modulo Reduction](https://lemire.me/blog/2016/06/27/a-fast-alternative-to-the-modulo-reduction/)