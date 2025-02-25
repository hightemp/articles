# Compiler Explorer — уникальный проект для исследования компилируемого кода / Хабр
Этот пост посвящён замечательному инструменту, полезному для каждого, кто интересуется компиляторами или архитектурой компьютеров. Это **Compiler Explorer**, который я в дальнейшем будут называть CE.

CE — потрясающий инструмент. Если вы с ним не знакомы, то прервите чтение и перейдите на [веб-сайт](https://godbolt.org/) CE, где вы увидите примерно такой экран:

_Предупреждение: вы забираетесь в «кроличью нору», на которую можете потратить несколько часов своего времени._

![](https://habrastorage.org/webt/u-/ma/on/u-maonmcpczrvkrlncdhb_t3wsi.png)

В основе CE лежит очень простая идея. Достаточно ввести исходный код в левую панель, и сайт мгновенно покажет вам на правой панели скомпилированный результат (обычно на языке ассемблера).

> CE поддерживает 69 языков, более двух тысяч компиляторов и широкий спектр архитектур, включая x86, arm, risc-v, avr, mips, vax, tensa, 68k, PowerPC, SPARC и даже древний 6502.

То есть теперь для просмотра результата работы компилятора достаточно открыть [godbolt.org](https://godbolt.org/) и скопировать туда блок кода.

Это само по себе удивительно, но у CE есть гораздо больше возможностей. Это инструмент, который должны знать все интересующиеся компиляторами и архитектурами компьютеров. В статье мы сможем лишь поверхностно рассмотреть функции CE. Вам стоит самим перейти на сайт CE и попробовать всё самостоятельно.

История Compiler Explorer
-------------------------

Однако нам стоит начать с предыстории CE.

CE хостится на сайте [godbolt.org](https://godbolt.org/), потому что его первым автором был Мэтт Годболт, начавший этот проект в 2012 году. Цитата из [поста](https://xania.org/202206/happy-birthday-ce) Мэтта, посвящённого десятой годовщине CE:

> Десять лет назад я получил разрешение на перевод в open source небольшого инструмента под названием [GCC Explorer](https://web.archive.org/web/20120525042912/https://gcc.godbolt.org/). Я разработал его примерно за неделю своего свободного времени на node.js у своего работодателя [DRW](https://www.drw.com/). Всё остальное, как говорится, стало достоянием истории.
> 
> Спустя несколько лет стало очевидно, что GCC Explorer — это уже нечто большее, чем просто GCC, и 30 апреля 2014 года он стал называться «Compiler Explorer».

Недавно Мэтт поделился историей CE в замечательном подкасте [Microarch](https://microarch.club/) Дэна Магнума.

Стоит послушать интервью Мэтта целиком (ссылки на [Spotify](https://open.spotify.com/episode/2FxzRheJfpDlYO9CY4gaKY?si=IDPYWYNhRbuWzh0_o2Lbiw), [YouTube](https://www.youtube.com/watch?v=rd8pGMIYU2Q) и [Apple Podcasts](https://podcasts.apple.com/gb/podcast/101-matt-godbolt/id1730476827?i=1000652012264)), так как в нём есть много интересных рассуждений об архитектуре, истории компьютеров и CE.

> Мэтт Годболт присоединился к обсуждению первых микропроцессоров, работы в игровой отрасли, оптимизации производительности на современных CPU x86 и вычислительной инфраструктуры отрасли финансового трейдинга. Также мы обсудили работу Мэтта по переносу YouTube на первые мобильные телефоны и историю Compiler Explorer

Сам Мэтт также провёл подкаст с Беном Рэди [Two’s Complement](https://www.twoscomplement.org/), в том числе эпизод о будущем CE (ссылки на [Spotify](https://open.spotify.com/show/52irDllU36Y3mOBbBIxyNd?si=4f2494b30202409f), [YouTube](https://youtube.com/playlist?list=PL2HVqYf7If8fd0OpSIKhFdIPjgZcV7aT2&amp;feature=shared) и [Apple Podcasts](https://podcasts.apple.com/gb/podcast/twos-complement/id1546393988)), в котором гораздо подробнее рассказывается о текущем статусе проекта.

CE — это опенсорсный проект, исходники которого выложены на [GitHub](https://github.com/compiler-explorer/compiler-explorer), то есть при наличии времени и опыта вы можете хостить CE самостоятельно.

Большинство людей пользуется онлайн-версией CE, которая бесплатна и поддерживается благодаря пожертвованиям и спонсорам.

Возможности Compiler Explorer
-----------------------------

Для чего можно использовать CE? В этом году Мэтт Годболт выступил с докладом, описывающим различные способы применения CE и его новых функций

Давайте вкратце рассмотрим самые простые способы использования CE.

### ▍ Исследование архитектур

Мы можем сравнивать ассемблерный код для различных архитектур. В чём отличие кода для x86-64 от кода для ARM64 и RISC-V? Ответ можно узнать всего за несколько секунд. Вот [x86-64](https://godbolt.org/z/37K3G5czq) (все примеры созданы с помощью GCC 14.1):

```
square(int):        push    rbp        mov     rbp, rsp        mov     DWORD PTR [rbp-4], edi        mov     eax, DWORD PTR [rbp-4]        imul    eax, eax        pop     rbp        ret
```

А вот [ARM64](https://godbolt.org/z/4bo5c3zE3):

```
square(int):        sub     sp, sp, #16        str     w0, [sp, 12]        ldr     w0, [sp, 12]        mul     w0, w0, w0        add     sp, sp, 16        ret
```

[RISC-V](https://godbolt.org/z/vTMPq1hTa) (64-битный):

```
square(int):        addi    sp,sp,-32        sd      ra,24(sp)        sd      s0,16(sp)        addi    s0,sp,32        mv      a5,a0        sw      a5,-20(s0)        lw      a5,-20(s0)        mulw    a5,a5,a5        sext.w  a5,a5        mv      a0,a5        ld      ra,24(sp)        ld      s0,16(sp)        addi    sp,sp,32        jr      ra
```

Код вполне в духе RISC. А как насчёт чего-то более CISC наподобие [VAX](https://godbolt.org/z/v1v7vcTWK)?

```
square(int):        .word 0        subl2 $4,%sp        mull3 4(%ap),4(%ap),%r0        ret
```

Или простого 8-битного CPU наподобие [6502](https://godbolt.org/z/3esaYzYss):

```
square(int):                             ; @square(int)        pha        clc        lda     __rc0        adc     #254        sta     __rc0        lda     __rc1        adc     #255        sta     __rc1        pla        clc        ldy     __rc0        sty     __rc6        ldy     __rc1        sty     __rc7        sta     (__rc6)        ldy     #1        txa        sta     (__rc6),y        lda     (__rc6)        sta     __rc4        lda     (__rc6),y        tax        lda     (__rc6)        sta     __rc2        lda     (__rc6),y        sta     __rc3        lda     __rc4        jsr     __mulhi3        pha        clc        lda     __rc0        adc     #2        sta     __rc0        lda     __rc1        adc     #0        sta     __rc1        pla        rts
```

А если вас интересует Nvidia CUDA, то CE может показать вам код [ptx](https://godbolt.org/z/8eq9bd7YG).

![](https://habrastorage.org/webt/wy/om/65/wyom655yv2hi9gl6h75xg-unmmw.jpeg)

  

### ▍ Освоение языка ассемблера

CE — отличный инструмент для изучения языка ассемблера. Достаточно навести курсор на команду, после чего откроется всплывающее окно с описанием команды.

![](https://habrastorage.org/webt/94/cb/nz/94cbnzgoehm1v2tytlqyp7efrlq.jpeg)

При нажатии правой клавишей мыши на команду открывается меню, в котором можно изучить более подробное описание.

![](https://habrastorage.org/webt/ob/lo/ug/oblougfa64t_clyjptzambd-0_0.jpeg)

Там, в свою очередь, можно найти ссылки на [веб-сайт документации по набору команд x86](https://www.felixcloutier.com/x86/) Феликса Клотье.

Код на Arm ведёт к документации для Arm. Однако меня немного расстроило отсутствие документации для языка ассемблера Vax!

### ▍ Сравнение компиляторов

Затем мы можем сравнить результат работы разных компиляторов. Вот сравнение [gcc и clang](https://godbolt.org/z/WYec43jor). Логично, что код, сгенерированный для такой простой функции, почти одинаков.

![](https://habrastorage.org/webt/_b/95/pt/_b95ptlwnoyzrqn9ityx5slleo4.jpeg)

  

### ▍ Промежуточное представление LLVM

Для компиляторов на основе [LLVM](https://llvm.org/) CE может [показывать](https://godbolt.org/z/snbT181fG) LLVM Intermediate Representation (LLVM IR). Подробнее LLVM IR объясняется [здесь](https://mcyoung.xyz/2023/08/01/llvm-ir/):

> Его флагманский продукт — это Clang, высококлассный компилятор C/C++/Objective-C. Clang реализует традиционную архитектуру компилятора: фронтенд, который парсит исходный код в AST и понижает его до _промежуточного представления_ (IR), оптимизатор («мидл-енд»), преобразующий IR в более качественное IR, и бэкенд, преобразующий, IR в машинный код для конкретной платформы.

То есть LLVM — это промежуточный этап перед генерацией ассемблера компилятором. LLVM IR показано справа внизу:

![](https://habrastorage.org/webt/xf/gz/fm/xfgzfmdzob4glcub5pmpudutnmg.jpeg)

  

### ▍ Анализатор машинного кода LLVM

Также CE предоставляет доступ ко множеству инструментов, позволяющих лучше понять наш код и способ его исполнения. Например, мы можем [добавить вывод](https://godbolt.org/z/6VpQxD) [анализатора машинного кода LLVM](https://llvm.org/docs/CommandGuide/llvm-mca.html) (llvm-mca), который позволяет нам подробнее изучить то, как машинный код работает на реальном CPU.

Окно llvm-mca показано слева внизу.

![](https://habrastorage.org/webt/ll/ed/zb/lledzbyoqlhycvkhq6bxpot4tqo.jpeg)

llvm-mca симулирует исполнение кода на реальной машине и предоставляет информацию об ожидаемой производительности.

В нашем простом примере llvm-mca сообщает нам, что можно ожидать выполнения 100 итераций за 105 тактов симулируемой машины.

```
Iterations:        100Instructions:      300Total Cycles:      105Total uOps:        300Dispatch Width:    6uOps Per Cycle:    2.86IPC:               2.86Block RThroughput: 1.0
```

Если добавить опцию **\-timeline** , то мы получим диаграмму со временем исполнения команд при движении через CPU.

Цитата из документации llvm-mca:

> Режим timeline позволяет просмотреть подробный отчёт о переходах состояний каждой команды по конвейеру команд. Этот режим включается опцией командной строки `-timeline`. В процессе переходов команд по различным этапам конвейера их состояния отображаются в отчёте. Состояния представлены следующими символами:
> 
> *   D: команда отправлена
> *   e: исполнение команды
> *   E: команда исполнена
> *   R: команда удалена
> *   \=: команда уже отправлена, ожидает исполнения
> *   — : команда исполнена, ожидает удаления

Вот timeline нашего простого примера:

```
Timeline view:                    01234Index     0123456789     [0,0]     DR   .    .   .   mov	eax, edi[0,1]     DeeeER    .   .   imul	eax, edi[0,2]     DeeeeeER  .   .   ret[1,0]     D------R  .   .   mov	eax, edi[1,1]     D=eeeE-R  .   .   imul	eax, edi[1,2]     DeeeeeER  .   .   ret[2,0]     .D-----R  .   .   mov	eax, edi[2,1]     .D=eeeER  .   .   imul	eax, edi[2,2]     .DeeeeeER .   .   ret[3,0]     .D------R .   .   mov	eax, edi[3,1]     .D==eeeER .   .   imul	eax, edi[3,2]     .DeeeeeER .   .   ret[4,0]     . D-----R .   .   mov	eax, edi[4,1]     . D==eeeER.   .   imul	eax, edi[4,2]     . DeeeeeER.   .   ret[5,0]     . D------R.   .   mov	eax, edi[5,1]     . D===eeeER   .   imul	eax, edi[5,2]     . DeeeeeE-R   .   ret[6,0]     .  D------R   .   mov	eax, edi[6,1]     .  D===eeeER  .   imul	eax, edi[6,2]     .  DeeeeeE-R  .   ret[7,0]     .  D-------R  .   mov	eax, edi[7,1]     .  D====eeeER .   imul	eax, edi[7,2]     .  DeeeeeE--R .   ret[8,0]     .   D-------R .   mov	eax, edi[8,1]     .   D====eeeER.   imul	eax, edi[8,2]     .   DeeeeeE--R.   ret[9,0]     .   D--------R.   mov	eax, edi[9,1]     .   D=====eeeER   imul	eax, edi[9,2]     .   DeeeeeE---R   ret
```

  

### ▍ Интерпретируемые языки: Python, Ruby и другие

Если вас интересуют интерпретируемые языки, например, Python, то CE может отображать [байт-код](https://opensource.com/article/18/4/introduction-python-bytecode), сгенерированный интерпретатором Python или Ruby. Вот пример с Python.

![](https://habrastorage.org/webt/cm/yv/x1/cmyvx1c6l53yc5zghxtmfhejwjc.jpeg)

  

### ▍ Интегрированная среда разработки CE

Теперь CE даже предоставляет простую, но [завершённую IDE](https://godbolt.org/z/WE9T6K17W), в том числе функциональность [CMake](https://cmake.org/) и возможность запуска программ и просмотра результатов.

![](https://habrastorage.org/webt/vn/_b/sr/vn_bsrakliwwv0atwh0m22kmib8.jpeg)

  

### ▍ Компиляторная магия

Ещё одна функция CE заключается в возможности увидеть, насколько умны современные компиляторы. Мэтт Годболт даже выступил со множеством докладов по этой теме. Вот доклад за 2017 год:

А вот более свежий:

А вот статья на ACM: [Optimizations in C++ Compilers](https://dl.acm.org/doi/pdf/10.1145/3371595.3372264). Цитата из введения:

> В этой статье рассказывается о некоторых концепциях компиляторов и генерации кода, а затем проливается свет на крайне впечатляющие преобразования, которые выполняют компиляторы, с практическими демонстрациями моих любимых оптимизаций. Надеюсь, вы оцените важность подобных оптимизаций, которых можно ждать от компилятора, и захотите глубже исследовать эту тему. Важнее всего, чтобы вы научились любить исследование ассемблерного вывода и уважать высокое качество проектирования компиляторов.

  

### ▍ Дэшборды CE

CE даже можно использовать как интересный ресурс, чтобы понять, с какими языками работают пользователи. Это можно сделать при помощи [Grafana CE Dashboard](https://ce.grafana.net/public-dashboards/326d9aa2606b4efea25f4458a4c3f065?orgId=0&amp;refresh=1m).

![](https://habrastorage.org/webt/hi/pl/ua/hiplualcuwrb-qgadzlvtxl6lfw.jpeg)

C++ — это язык по умолчанию, так что, возможно, на него не стоит обращать внимание, а вот то, что Rust в четыре раза менее популярен, чем C, — это любопытно.

Есть также [страница](https://www.stathat.com/s/SO1rSvjtT07k) StatHat, на которой отображается рост использования CE на протяжении нескольких лет.

![](https://habrastorage.org/webt/_n/mg/x4/_nmgx4opyqf3y7uaocj6luet7lc.jpeg)

Сейчас пользователи выполняют примерно 18 миллионов компиляций в год.

Это приблизительно 1,5 миллиона в месяц, 50 тысяч в день, 2 тысяч в час, 30 в минуту или по одной каждые две секунды. Всё это работает на Amazon Web Services и стоит примерно $2500 ежемесячных затрат на хостинг (актуальное значение можно найти в [Patreon CE](https://www.patreon.com/mattgodbolt/about)).

### ▍ Computerphile

Если вам всего этого недостаточно, то скажу, что сейчас Мэтт снимает потрясающую серию видео с YouTube-каналом Computerphile, в которой объясняет основы работы микропроцессоров. Первым в серии идёт видео [«Что такое машинный код»](https://www.youtube.com/watch?v=8VsiYWW9r48):

Список остальных серий:

*   [Как CPU выполняют математические вычисления](https://www.youtube.com/watch?v=nhXevKMm3JI)
*   [Конвейеры CPU](https://www.youtube.com/watch?v=BVNx3wtJ9vs)
*   [Как в CPU работает прогнозирование ветвления](https://www.youtube.com/watch?v=nczJ58WvtYo)

Надеюсь, это ещё не всё!

### ▍ Movfuscator

![](https://habrastorage.org/webt/dw/5f/pv/dw5fpvfjhcoukiibr35d25tmtf8.jpeg)

В архитектуре x86 [команда MOV Тьюринг-полная](https://stackoverflow.com/questions/61048788/why-is-mov-turing-complete). В качестве последнего примера приведу наш простой код, скомпилированный при помощи [movfuscator](https://github.com/xoreaxeaxeax/movfuscator), использующего только команды MOV.

> **[Telegram-канал со скидками, розыгрышами призов и новостями IT 💻](https://t.me/ruvds_community)**

[![](https://habrastorage.org/webt/jx/md/ye/jxmdyendyev6uxwdkpnkdl77zac.png)
](http://ruvds.com/ru-rub?utm_source=habr&utm_medium=article&utm_campaign=perevod&utm_content=compiler_explorer_unikalnyj_proekt_dlya_issledovaniya_kompiliruemogo_koda)