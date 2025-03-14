# Кластер Kubernetes — установка и настройка на Linux Ubuntu
 ![](https://www.dmosk.ru/img/public/time.jpg)
 Обновлено: 31.12.2024 ![](https://www.dmosk.ru/img/public/time.jpg)
 Опубликовано: 07.02.2021

Используемые термины: [Kubernetes](https://www.dmosk.ru/terminus.php?object=kubernetes), [Ubuntu](https://www.dmosk.ru/terminus.php?object=ubuntu), [Docker](https://www.dmosk.ru/terminus.php?object=docker).

Есть различные готовые реализации кластера Kubernetes (K8S), например:

*   Minikube — готовый кластер, который разворачивается на один компьютер. Хороший способ познакомиться с Kubernetes.
*   Kubespray — набор [Ansible](https://www.dmosk.ru/terminus.php?object=ansible) ролей.
*   Готовые кластеры в облаке, например AWS, Google Cloud, Yandex Cloud и так далее.

Использовать одну из готовых реализаций — быстрый и надежный способ развертывания системы оркестрации контейнеров Docker. Однако, мы рассмотрим ручное создание кластера Kubernetes из 3-х нод — один мастер (управление) и две рабочие ноды (запуск контейнеров).

Для этого выполним следующие шаги:

Подготовка системы
------------------

Стоит убедиться, что серверы соответствуют минимальным системным требованиям:

*   От 2-х процессоров.
*   От 2-х Гб оперативной памяти.
*   Уникальные MAC-адрес и Product\_uuid.
*   Сетевая доступность между нодами кластера.

Также выполняем на всех узлах будущего кластера нижеописанные действия. Это необходимо, чтобы удовлетворить программные системные требования кластера Kubernetes.

### Настройка системы

1\. Задаем имена узлам. Для этого выполняем команды на соответствующих серверах:

hostnamectl set-hostname k8s-master1.dmosk.local

hostnamectl set-hostname k8s-worker1.dmosk.local

hostnamectl set-hostname k8s-worker2.dmosk.local

_\* в данном примере мы зададим имя **k8s-master1** для мастера и, соответственно, **k8s-worker1** и **k8s-worker2** — для первого и второго рабочих нод. Каждая команда выполняется на своем сервере._

Необходимо, чтобы наши серверы были доступны по заданным именам. Для этого необходимо на сервере DNS добавить соответствующие А-записи. Или на каждом сервере открываем hosts:

vi /etc/hosts

И добавляем записи на подобие: 

192.168.0.15     k8s-master1.dmosk.local k8s-master1  
192.168.0.20     k8s-worker1.dmosk.local k8s-worker1  
192.168.0.25     k8s-worker2.dmosk.local k8s-worker2

_\* где, **192.168.0.15, 192.168.0.20, 192.168.0.25** — IP-адреса наших серверов, **k8s-master1, k8s-worker1, k8s-worker2** — имена серверов, **dmosk.local** — наш внутренний домен._

2\. Устанавливаем необходимые компоненты — дополнительные пакеты и утилиты. Для начала, обновим список пакетов и саму систему:

apt update && apt upgrade

Выполняем установку пакетов:

apt install curl apt-transport-https git iptables-persistent

\* где:

*   **git —** утилита для работы с GIT. Понадобится для загрузки файлов из репозитория git.
*   **curl —** утилита для отправки GET, POST и других запросов на http-сервер. Понадобится для загрузки ключа репозитория Kubernetes.
*   **apt-transport-https —** позволяет получить доступ к APT-репозиториям по протоколу https.
*   **iptables-persistent —** утилита для сохранения правил, созданных в iptables (не обязательна, но повышает удобство).

В процессе установки iptables-persistent может запросить подтверждение сохранить правила брандмауэра — отказываемся.

3\. Отключаем файл подкачки. С ним Kubernetes работает плохо (поддержка включена только с версии 1.22 при условии корректной конфигурации).

Выполняем команду для разового отключения:

swapoff -a

Чтобы swap не появился после перезагрузки сервера, открываем на редактирование файл:

vi /etc/fstab

И комментируем строку: 

#/swap.img      none    swap    sw      0       0

4\. Загружаем дополнительные модули ядра.

vi /etc/modules-load.d/k8s.conf

br\_netfilter  
overlay

_\* модуль **br\_netfilter** расширяет возможности netfilter ([подробнее](https://ebtables.netfilter.org/documentation/bridge-nf.html)); **overlay** необходим для Docker._

Загрузим модули в ядро:

modprobe br\_netfilter

modprobe overlay

Проверяем, что данные модули работают:

lsmod | egrep "br\_netfilter|overlay"

Мы должны увидеть что-то на подобие:

overlay               114688  10  
br\_netfilter           28672  0  
bridge                176128  1 br\_netfilter

5\. Изменим параметры ядра.

Создаем конфигурационный файл:

vi /etc/sysctl.d/k8s.conf 

net.bridge.bridge-nf-call-ip6tables = 1  
net.bridge.bridge-nf-call-iptables = 1

_\* **net.bridge.bridge-nf-call-iptables** контролирует возможность обработки трафика через bridge в netfilter. В нашем примере мы разрешаем данную обработку для IPv4 и IPv6._

Применяем параметры командой:

sysctl --system

### Брандмауэр

Для мастер-ноды и рабочей создаем разные наборы правил.

По умолчанию, в Ubuntu брандмауэр настроен на разрешение любого трафика. Если мы настраиваем наш кластер в тестовой среде, настройка брандмауэра не обязательна.

1\. На мастер-ноде (Control-plane)

Выполняем команду:

iptables -I INPUT 1 -p tcp --match multiport --dports 6443,2379:2380,10250:10252 -j ACCEPT

\* в данном примере мы открываем следующие порты:

*   **6443 —** подключение для управления (Kubernetes API).
*   **2379:2380 —** порты для взаимодействия мастера с воркерами (etcd server client API).
*   **10250:10252 —** работа с kubelet (соответственно API, scheduler, controller-manager).

Для сохранения правил выполняем команду:

netfilter-persistent save

2\. На рабочей ноде (Worker):

На нодах для контейнеров открываем такие порты:

iptables -I INPUT 1 -p tcp --match multiport --dports 10250,30000:32767 -j ACCEPT

\* где:

*   **10250 —** подключение к kubelet API.
*   **30000:32767 —** рабочие порты по умолчанию для подключения к подам (NodePort Services).

Сохраняем правила командой:

netfilter-persistent save

Установка и настройка Docker
----------------------------

На все узлы кластера выполняем установку Docker следующей командой:

apt install docker docker.io

После установки разрешаем автозапуск сервиса docker:

systemctl enable docker

Создаем файл:

vi /etc/docker/daemon.json

{  
  "exec-opts": \["native.cgroupdriver=systemd"\],  
  "log-driver": "json-file",  
  "log-opts": {  
    "max-size": "100m"  
  },  
  "storage-driver": "overlay2",  
  "storage-opts": \[  
    "overlay2.override\_kernel\_check=true"  
  \]  
}

_\* для нас является важной настройкой **cgroupdriver** — она должна быть выставлена в значение **systemd**. В противном случае, при создании кластера Kubernetes выдаст предупреждение. Хоть на возможность работы последнего это не влияет, но мы постараемся выполнить развертывание без ошибок и предупреждений со стороны системы._

И перезапускаем docker:

systemctl restart docker

Установка Kubernetes
--------------------

Установку необходимых компонентов выполним из репозитория. Добавим его ключ для цифровой подписи:

curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -

Создадим файл с настройкой репозитория:

vi /etc/apt/sources.list.d/kubernetes.list

deb https://apt.kubernetes.io/ kubernetes-xenial main

Обновим список пакетов:

apt update

Устанавливаем пакеты: 

apt install kubelet kubeadm kubectl

\* где:

*   **kubelet —** сервис, который запускается и работает на каждом узле кластера. Следит за работоспособностью подов.
*   **kubeadm —** утилита для управления кластером Kubernetes.
*   **kubectl —** утилита для отправки команд кластеру Kubernetes.

Нормальная работа кластера сильно зависит от версии установленных пакетов. Поэтому бесконтрольное их обновление может привести к потере работоспособности всей системы. Чтобы этого не произошло, запрещаем обновление установленных компонентов:

apt-mark hold kubelet kubeadm kubectl

Установка завершена — можно запустить команду:

kubectl version --client --output=yaml

... и увидеть установленную версию программы: 

clientVersion:  
  buildDate: "2022-07-13T14:30:46Z"  
  compiler: gc  
  gitCommit: aef86a93758dc3cb2c658dd9657ab4ad4afc21cb  
  gitTreeState: clean  
  gitVersion: v1.24.3  
  goVersion: go1.18.3  
  major: "1"  
  minor: "24"  
  platform: linux/amd64  
kustomizeVersion: v4.5.4

Наши серверы готовы к созданию кластера.

Создание кластера
-----------------

По-отдельности, рассмотрим процесс настройки мастер ноды (control-plane) и присоединения к ней двух рабочих нод (worker).

### Настройка control-plane (мастер ноды)

Выполняем команду на мастер ноде:

kubeadm init --pod-network-cidr=10.244.0.0/16

_\* данная команда выполнит начальную настройку и подготовку основного узла кластера. Ключ **\--pod-network-cidr** задает адрес внутренней подсети для нашего кластера._

Выполнение займет несколько минут, после чего мы увидим что-то на подобие:

Your Kubernetes control-plane has initialized successfully!

...

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.168.0.15:6443 --token f7sihu.wmgzwxkvbr8500al \\  
    --discovery-token-ca-cert-hash sha256:6746f66b2197ef496192c9e240b31275747734cf74057e04409c33b1ad280321

_\* данную команду (выделена желтым) нужно вводить на worker нодах, чтобы присоединить их к нашему кластеру. Можно ее скопировать, но позже мы будем генерировать данную команду по новой._

В окружении пользователя создаем переменную KUBECONFIG, с помощью которой будет указан путь до файла конфигурации kubernetes:

export KUBECONFIG=/etc/kubernetes/admin.conf

Чтобы каждый раз при входе в систему не приходилось повторять данную команду, открываем файл: 

vi /etc/environment

И добавляем в него строку: 

export KUBECONFIG=/etc/kubernetes/admin.conf

Посмотреть список узлов кластера можно командой:

kubectl get nodes

На данном этапе мы должны увидеть только мастер ноду:

NAME                      STATUS     ROLES                  AGE   VERSION  
k8s-master.dmosk.local    NotReady   <none>                 10m   v1.20.2

Чтобы завершить настройку, необходимо установить CNI (Container Networking Interface) — в моем примере это flannel:

kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml

_\* краткий обзор и сравнение производительности CNI можно почитать в [статье на хабре](https://habr.com/ru/company/southbridge/blog/518782/)._

Узел управления кластером готов к работе.

### Настройка worker (рабочей ноды)

Мы можем использовать команду для присоединения рабочего узла, которую мы получили после инициализации мастер ноды или вводим (на первом узле):

kubeadm token create --print-join-command

Данная команда покажет нам запрос на присоединения новой ноды к кластеру, например:

kubeadm join 192.168.0.15:6443 --token f7sihu.wmgzwxkvbr8500al \\  
    --discovery-token-ca-cert-hash sha256:6746f66b2197ef496192c9e240b31275747734cf74057e04409c33b1ad280321

Копируем его и используем на двух наших узлах. После завершения работы команды, мы должны увидеть:

Run 'kubectl get nodes' on the control-plane to see this node join the cluster.

На мастер ноде вводим:

kubectl get nodes

Мы должны увидеть: 

NAME                      STATUS      ROLES                  AGE   VERSION  
k8s-master1.dmosk.local   Ready       control-plane,master   18m   v1.20.2  
k8s-worker1.dmosk.local   Ready       <none>                 79s   v1.20.2  
k8s-worker2.dmosk.local   NotReady    <none>                 77s   v1.20.2

_\* обратите внимание, что нода k8s-worker2 имеет статус **NotReady**. Это значит, что настройка еще выполняется и необходимо подождать. Как правило, в течение 2 минут статус меняется на **Ready**._

Наш кластер готов к работе. Теперь можно создавать поды, развертывания и службы. Рассмотрим эти процессы подробнее.

Pods
----

Поды — неделимая сущность объекта в Kubernetes. Каждый Pod может включать в себя несколько контейнеров (минимум, 1). Рассмотрим несколько примеров, как работать с подами. Все команды выполняем на мастере.

### Создание

Поды создаются командой kubectl, например:

kubectl run nginx --image=nginx:latest --port=80

_\* в данном примере мы создаем под с названием **nginx**, который в качестве образа Docker будет использовать **nginx** (последнюю версию); также наш под будет слушать запросы на порту **80**._

Чтобы получить сетевой доступ к созданному поду, создаем port-forward следующей командой:

kubectl port-forward nginx --address 0.0.0.0 8888:80

_\* в данном примере запросы к кластеру kubernetes на порт **8888** будут вести на порт **80** (который мы использовали для нашего пода)._

Команда **kubectl port-forward** является интерактивной. Ее мы используем только для тестирования. Чтобы пробросить нужные порты в Kubernetes используются Services — об этом будет сказано ниже.

Можно открыть браузер и ввести адрес http://<IP-адрес мастера>:8888 — должна открыться страница приветствия для NGINX.

### Просмотр

Получить список всех подов в кластере можно командой:

kubectl get pods

Например, в нашем примере мы должны увидеть что-то на подобие:

NAME    READY   STATUS    RESTARTS   AGE  
nginx   1/1     Running   0          3m26s

Посмотреть подробную информацию о конкретном поде можно командой:

kubectl describe pods nginx

Если есть проблемы запуска пода, то можно просмотреть логи:

kubectl logs nginx

### Запуск команд внутри контейнера

Мы можем запустить одну команду в контейнере, например, такой командой:

kubectl exec nginx -- date

_\* в данном примере будет запущена команда **date** внутри контейнера **nginx**._

Также мы можем подключиться к командной строке контейнера командой:

kubectl exec --tty --stdin nginx -- /bin/bash

_\* обратите внимание, что не у всех образов для контейнеров установлена оболочка **bash**, например для образов на основе alpine. Если мы полчим ошибку **error: Internal error occurred: error executing command in container**, то можно вместо **bash** попробовать ввести **sh**._

### Удаление

Для удаления пода вводим:

kubectl delete pods nginx

### Использование манифестов

В продуктивной среде управление подами выполняется с помощью специальных файлов с описанием того, как должен создаваться и настраиваться под — манифестов. Рассмотрим пример создания и применения такого манифеста.

Создадим файл формата yml:

vi manifest\_pod.yaml

apiVersion: v1  
kind: Pod  
metadata:   
  name: web-srv  
  labels:  
    app: web\_server  
    owner: dmosk  
    description: web\_server\_for\_site  
spec:  
  containers:   
    - name: nginx  
      image: nginx:latest  
      ports:  
        - containerPort: 80  
        - containerPort: 443

    - name: php-fpm  
      image: php-fpm:latest  
      ports:  
        - containerPort: 9000

    - name: mariadb  
      image: mariadb:latest  
      ports:  
        - containerPort: 3306

_\* в данном примере будет создан под с названием **web-srv**; в данном поде будет развернуто 3 контейнера — **nginx**, **php-fpm** и **mariadb** на основе одноименных образов._

Для объектов Kubernetes очень важное значение имеют метки или labels. Необходимо всегда их описывать. Далее, данные метки могут использоваться для настройки сервисов и развертываний.

Чтобы применить манифест выполняем команду:

kubectl apply -f manifest\_pod.yaml

Мы должны увидеть ответ:

pod/web-srv created

Смотрим поды командой:

kubectl get pods

Мы должны увидеть:

NAME      READY   STATUS    RESTARTS   AGE  
web-srv   3/3     Ready     0          3m11s

_\* для **Ready** мы можем увидеть 0/3 или 1/3 — это значит, что контейнеры внутри пода еще создаются и нужно подождать._

Deployments
-----------

Развертывания позволяют управлять экземплярами подов. С их помощью контролируется их восстановление, а также балансировка нагрузки. Рассмотрим пример использования Deployments в Kubernetes.

### Создание

Deployment создаем командой со следующим синтаксисом:

kubectl create deploy <название для развертывания> --image <образ, который должен использоваться>

Например:

kubectl create deploy web-set --image nginx:latest

_\* данной командой мы создадим deployment с именем **web-set**; в качестве образа будем использовать **nginx:latest**._

### Просмотр

Посмотреть список развертываний можно командой:

kubectl get deploy

Подробное описание для конкретного развертывания мы можем посмотреть так:

kubectl describe deploy web-set

_\* в данном примере мы посмотрим описание **deployment** с названием **web-set**._

### Scaling

Как было написано выше, deployment может балансировать нагрузкой. Это контролируется параметром scaling:

kubectl scale deploy web-set --replicas 3

_\* в данном примере мы указываем для нашего созданного ранее deployment использовать 3 реплики — то есть Kubernetes создаст 3 экземпляра контейнеров._

Также мы можем настроить автоматическую балансировку:

kubectl autoscale deploy web-set --min=5 --max=10 --cpu-percent=75

_В данном примере Kubernetes будет создавать от 5 до 10 экземпляров контейнеров — добавление нового экземпляра будет происходить при превышении нагрузки на процессор до 75% и более._

Посмотреть созданные параметры балансировки можно командой:

kubectl get hpa

### Редактирование

Для нашего развертывания мы можем изменить используемый образ, например:

kubectl set image deploy/web-set nginx=httpd:latest --record

_\* данной командой для deployment web-set мы заменим образ nginx на httpd; ключ **record** позволит нам записать действие в историю изменений._

Если мы использовали ключ **record**, то историю изменений можно посмотреть командой:

kubectl rollout history deploy/web-set

Перезапустить deployment можно командой:

kubectl rollout restart deploy web-set

### Манифест

Как в случае с подами, для создания развертываний мы можем использовать манифесты. Попробуем рассмотреть конкретный пример.

Создаем новый файл:

vi manifest\_deploy.yaml

apiVersion: apps/v1  
kind: Deployment  
metadata:  
  name: web-deploy  
  labels:  
    app: web\_server  
    owner: dmitriy\_mosk  
    description: web\_server\_for\_site  
spec:  
  replicas: 5  
  selector:  
    matchLabels:  
      project: myweb  
  template:  
    metadata:  
      labels:  
        project: myweb  
        owner: dmitriy\_mosk  
        description: web\_server\_pod  
    spec:  
      containers:  
        - name: myweb-httpd  
          image: httpd:latest  
          ports:  
            - containerPort: 80  
            - containerPort: 443

             ---  
apiVersion: autoscaling/v2  
kind: HorizontalPodAutoscaler  
metadata:  
  name: web-deploy-autoscaling  
spec:  
  scaleTargetRef:  
    apiVersion: apps/v1  
    kind: Deployment  
    name: myweb-autoscaling  
  minReplicas: 5  
  maxReplicas: 10  
  metrics:  
  - type: Resource  
    resource:  
      name: cpu  
      target:  
        type: Utilization  
        averageUtilization: 75  
  - type: Resource  
    resource:  
      name: memory  
      target:  
        type: Utilization  
        averageUtilization: 80

_\* в данном манифесте мы создадим deployment и autoscaling. Итого, мы получим 5 экземпляров подов для развертывания web-deploy, которые могут быть расширены до 10 экземпляров. Добавление нового будет происходить при превышении нагрузки на процессор более чем на 75% или потреблением оперативной памяти более чем на 80%.  
\*\* обратите внимание, что в названиямх и тегах не должны использоваться симводы в верхнем регистре, а также пробелы._

Чтобы создать объекты с помощью нашего манифеста вводим:

kubectl apply -f manifest\_deploy.yaml

Мы должны увидеть:

deployment.apps/web-deploy created  
horizontalpodautoscaler.autoscaling/web-deploy-autoscaling created

Объекты web-deploy и web-deploy-autoscaling созданы.

Также может быть полезно показать логи всех контейнеров деплоймента с выборкой по определенному лейблу. Например, по **app: web\_server**:

kubectl logs -l app=web\_server

### Удаление

Для удаления конкретного развертывания используем команду:

kubectl delete deploy web-set

Для удаления всех развертываний вместо названия deployment указываем ключ --all:

kubectl delete deploy --all

Удалить критерии autoscaling для конкретного развертывания можно командой:

kubectl delete hpa web-set

Удалить все критерии autoscaling можно командой:

kubectl delete hpa --all

Удалить объекты, созданные с помощью манифеста можно командой:

kubectl delete -f manifest\_deploy.yaml

Services (svc)
--------------

Службы позволяют обеспечить сетевую доступность для развертываний. Существует несколько типов сервисов:

*   **ClusterIP —** сопоставление адреса с deployments для подключений внутри кластера Kubernetes.
*   **NodePort —** для внешней публикации развертывания.
*   **LoadBalancer —** сопоставление через внешний балансировщик.
*   **ExternalName —** сопоставляет службу по имени (возвращает значение записи CNAME).

Мы рассмотрим первые два варианта.

### Привязка к Deployments

Попробуем создать сопоставления для ранее созданного развертывания:

kubectl expose deploy web-deploy --type=ClusterIP --port=80

_\* где **web-deploy** — deployment, который мы развернули с помощью манифеста. Публикация ресурса происходит на внутреннем порту **80**. Обращаться к контейнерам можно внутри кластера Kubernetes._

Для создания сопоставления, с помощью которого можно будет подключиться к контейнерам из внешней сети выполняется командой:

kubectl expose deploy web-deploy --type=NodePort --port=80

_\* данная команда отличается от команды выше только типом **NodePort** — для данному deployment будет сопоставлен порт для внешнего подключения, который будет вести на внутренний (в нашем примере, **80**)._

### Просмотр

Чтобы посмотреть созданные нами службы, вводим:

kubectl get services

Мы можем увидеть что-то на подобие:

NAME         TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)        AGE  
web-deploy   NodePort    10.111.229.132   <none>        80:30929/TCP   21s

_\* в данном примере указано, что у нас есть служба типа **NodePort**, а к сервису можно подключиться по порту **30929**._

Можно попробовать открыть браузер и ввести http://<IP-адрес мастера>:30929 — мы должны увидеть нужную нам страницу (в наших примерах, либо NGINX, либо Apache).

Посмотреть список сервисов с указанием селектором можно командой:

kubectl get services -o wide

### Удаление

Удаляем созданную службу командой:

kubectl delete services web-deploy

_\* в данном примере будет удалена служба для развертывания **web-deploy**._

Удалить все службы можно командой:

kubectl delete services --all

### Манифест

Как в случае с подами и развертываниями, мы можем использовать манифест-файлы. Рассмотрим небольшой пример.

vi manifest\_service.yaml

apiVersion: v1  
kind: Service  
metadata:  
  name: web-service  
  labels:  
    app: web\_server  
    owner: dmosk  
    description: web\_server\_for\_site  
spec:  
  selector:  
    project: myweb  
  type: NodePort  
  ports:  
    - name: app-http  
      protocol: TCP  
      port: 80  
      targetPort: 80

    - name: app-smtp  
      protocol: TCP  
      port: 25  
      targetPort: 25

_\* в данном примере мы создадим службу, которая будем связываться с развертыванием по лейболу **project: myweb**._

### Туннель для тестирования

Выше, когда рассматривали поды, мы применяли port-forward. Это позволяло нам пробросить туннель до подов и протестировать работоспособность службы. Также мы можем сделать аналогичный туннель до сервиса, например:

kubectl port-forward svc/web-service 8888:80

Данная команда создаст туннель с нашего локального компьютера, порта 8888 до сервиса и порта 80. Таким образом, мы можем попробовать подключиться к веб-серверу по ссылке http://127.0.0.1:8888.

PersistentVolume
----------------

Рассмотрим пример манифеста для монтирования тома данных. Данный том будет содержать информацию, которая не должна удаляться после пересоздания контейнеров.

Пример манифеста:

apiVersion: v1  
kind: PersistentVolumeClaim  
metadata:  
  name: nginx-data  
spec:  
  storageClassName: yc-network-hdd  
  accessModes:  
    - ReadWriteOnce  
  resources:  
    requests:  
      storage: 1Gi

_\* в данном примере будет создан том размером в 1 Гб. Также обратите внимание на опцию **storageClassName** — класс хранения, который можно не указывать, но если мы арендуем облако Kubernetes, то данный класс нужно уточнить у поставщика услуг. В данном примере используется пример облака Яндекс._

Чтобы смонтировать созданный нами том, используем опцию volumeMounts для контейнера (как в манифесте пода, так и деплоймента):

...  
spec:  
  containers:  
  - name: nginx  
    image: nginx  
    ...  
    volumeMounts:  
      - name: nginx-data  
        mountPath: /var/www  
  volumes:  
    - name: nginx-data  
      persistentVolumeClaim:  
        claimName: nginx-data

ConfigMaps
----------

ConfigMap позволяет нам хранить конфигурационные файлы в K8S и, при необходимости, монтировать их к определенным подам. Рассмотрим процесс их создания и использования.

### Создание

Мы можем в качестве источника данных использовать файлы, директории, значения командной строки или env-файл (в формате ключ-значение). Разберемся по порядку.

1\. Конфиг из файла:

kubectl create configmap nginx-base --from-file=/opt/k8s/configmap/nginx.conf

_\* в нашем примере мы создадим конфигурацию **nginx-base**, а значением будет содержимое файла **/opt/k8s/configmap/nginx.conf**._

2\. Из директории:

kubectl create configmap nginx-base --from-file=/opt/k8s/configmap/

_\* в данном примере в конфигурацию **nginx-base** попадут все файлы из каталога **/opt/k8s/configmap**._

3\. Значения можно указать в команде:

kubectl create configmap nginx-spec --from-literal=hostname=dmosk.local --from-literal=cores=8

4\. Используем env-файл:

kubectl create configmap nginx-properties --from-env-file=/opt/k8s/configmap/nginx.env

### Просмотр

Показать список всех созданных в k8s конфигов:

kubectl get configmaps

Подробная информация с содержимым:

kubectl get configmaps -o yaml nginx-base

### Привязка к контейнерам

Значения наших конфигураций могут быть смонтированы в качестве файлов или системных переменных. Также мы можем их применять как к подам, так и развертываниям. Рассмотрим вариант использования с описанием в манифест-файле.

1\. Монтирование в качестве конфигурационного файла:

    ...  
    spec:  
      containers:  
        - name: myweb-nginx  
          image: nginx:latest  
          ...  
          volumeMounts:  
            - name: config-nginx  
              mountPath: /etc/nginx  
              subPath: nginx.conf  
      volumes:  
        - name: config-nginx  
          configMap:  
            name: nginx-base

\* давайте разбираться подробнее, что мы настроили:

*   обратите внимание, что нам подходит манифест для Pod или Deployment — работаем с конфигурацией для **containers**.
*   мы создали volume **config-nginx**, который берет значение из конфигурации **nginx-base**.
*   к нашему контейнеру мы подключили созданный **config-nginx** с помощью опции **volumeMounts**. А при помощи **mountPath** мы указываем путь, куда будет примонтирована конфигурация.
*   в качестве файла назничения мы задали **nginx.conf**. Это делается при помощи опции **subPath**.

2, Использование для создания системных переменных:

    ...  
    spec:  
      containers:  
        - name: myweb-nginx  
          image: nginx:latest  
          ...  
          envFrom:  
            - configMapRef:  
                name: nginx-spec

_\* в данном примере все немного проще — мы указываем с помощью директивы **envFrom**, что мы должны создать системные переменные из конфига **nginx-spec**._

Для применения изменений вводим:

kubectl apply -f manifest\_file.yaml

_\* где **manifest\_file.yaml —** файл, в котором мы сделали правки._

### Удаление

Удалить конфиг можно следующей командой:

kubectl delete configmap nginx-spec

Проверки работоспособности контейнеров
--------------------------------------

Существует три вида проверки состояния контейнеров в поде:

1.  **livenessProbe —** проверка работы приложения. В случае отрицательного результата контейнер будет перезагружен.
2.  **readinessProbe —** определяем, может ли контейнер принимать запросы по сети. Если тест вернет ошибку, то kubernetes удалит для него endpoint, что приведет к неспособности принять сетевые запросы.
3.  **startupProbe —** указывает, полностью ли запустилось приложение. При отрицательном результате тестирования, контейнер не перейдет в рабочее состояние.

Перечисленные типы могут быть определены на уровне описания контейнера и имеют общий синтаксис:

    <тип проверки>:  
      exec:  
        command:  
        - команда  
        - проверки  
        - приложения  
      initialDelaySeconds: <сколько секунд ждем до начала проверки>  
      timeoutSeconds: <какое количество секунд будет ждать kubernetes выполнения проверки>  
      failureThreshold: <сколько раз должна закончиться проверка ошибкой, чтобы результат теста был отрицательный>  
      successThreshold: <число удачных результатов тестов, чтобы kubernetes посчитал контейнер рабочим>  
      periodSeconds: <время в секундах, через которое система будет повторять выполнять проверки>

Рассмотрим примеры.

### livenessProbe

Описывается в секции контейнера:

spec:  
  containers:  
  - name: container-name  
    ...  
    livenessProbe:  
      exec:  
        command:  
        - curl  
        - http://127.0.0.1/healthcheck  
      initialDelaySeconds: 1  
      timeoutSeconds: 5  
      failureThreshold: 5  
      successThreshold: 1  
      periodSeconds: 10 

_\* в данном примере мы будем делать запрос на адрес **http://127.0.0.1/healthcheck**. Если запрос вернет код 200, то кубернетес засчитает тест пройденным, в противном случае, после 5 неудачных попыток, контейнер будет перезапущен._

### readinessProbe

Описывается в секции контейнера:

spec:  
  containers:  
  - name: container-name  
    ...  
    readinessProbe:  
      exec:  
        command:  
        - curl  
        - http://127.0.0.1/healthcheck  
      initialDelaySeconds: 1  
      timeoutSeconds: 5  
      failureThreshold: 5  
      successThreshold: 1  
      periodSeconds: 10 

_\* в данном примере мы будем делать запрос на адрес **http://127.0.0.1/healthcheck**. Если запрос вернет код 200, то кубернетес засчитает тест пройденным, в противном случае, после 5 неудачных попыток, у контейнера не будет entrypoint и на него не будут отправляться сетевые запросы._

### startupProbe

Описывается в секции контейнера:

spec:  
  containers:  
  - name: container-name  
    ...  
    startupProbe:  
      exec:  
        command:  
        - curl  
        - http://127.0.0.1/healthcheck  
      initialDelaySeconds: 1  
      timeoutSeconds: 5  
      failureThreshold: 5  
      successThreshold: 1  
      periodSeconds: 10 

_\* в данном примере мы будем делать запрос на адрес **http://127.0.0.1/healthcheck**. Если запрос вернет код 200, то кубернетес засчитает тест пройденным, в противном случае, после 5 неудачных попыток, контейнер не стартанет._

Предварительные действия перед стартом контейнера
-------------------------------------------------

Предположим, наше приложение требует предварительной подготовки окружения. Мы можем запустить другой контейнер, который выполнит подготовку среды, после чего уже запустится основные контейнеры пода.

Данная операция описывается с помощью опции initContainers. Рассмотрим пример:

spec:  
  initContainers:  
    - name: init-container-1  
      image: nginx:latest  
      command: \["sh", "-c", "./download.sh"\]  
  containers:  
    - name: container-name  
      ...

_\* в данном примере перед тем, как запустить основной контейнер, сначала запустится **init-container-1** на базе образа **nginx**. В нем выполнится скрипт **download.sh**, после чего продолжится запуск других контейнеров пода._

Ingress Controller
------------------

В данной инструкции не будет рассказано о работе с Ingress Controller. Оставляем данный пункт для самостоятельного изучения.

Данное приложение позволяет создать балансировщик, распределяющий сетевые запросы между нашими сервисами. Порядок обработки сетевого трафика определяем с помощью Ingress Rules.

Существует не маленькое количество реализаций Ingress Controller — их сравнение можно найти в документе по ссылке в [Google Docs](https://docs.google.com/spreadsheets/d/191WWNpjJ2za6-nbG4ZoUMXMpUK8KlCIosvQB0f-oq3k/edit#gid=907731238).

Для установки Ingress Controller Contour (среди множества контроллеров, он легко устанавливается и на момент обновления данной инструкции полностью поддерживает последнюю версию кластера Kubernetes) вводим:

kubectl apply -f https://projectcontour.io/quickstart/contour.yaml

Установка веб-интерфейса
------------------------

Веб-интерфейс позволяет получить информацию о работе кластера в удобном для просмотра виде.

В большинстве инструкций рассказано, как получить доступ к веб-интерфейсу с того же компьютера, на котором находится кластер (по адресу 127.0.0.1 или localhost). Но мы рассмотрим настройку для удаленного подключения, так как это более актуально для серверной инфраструктуры.

Переходим на страницу веб-интерфейса в [GitHub](https://github.com/kubernetes/dashboard/releases/latest) и копируем ссылку на последнюю версию файла yaml:

![](https://www.dmosk.ru/img/instruktions/kubernetes-ubuntu/01.jpg)

_\* на момент обновления инструкции, последняя версия интерфейса была **2.1.0**._

Скачиваем yaml-файл командой:

wget https://raw.githubusercontent.com/kubernetes/dashboard/v2.1.0/aio/deploy/recommended.yaml

_\* где **https://raw.githubusercontent.com/kubernetes/dashboard/v2.1.0/aio/deploy/recommended.yaml** — ссылка, которую мы скопировали на портале GitHub._

Открываем на редактирование скачанный файл:

vi recommended.yaml

Комментируем строки для **kind: Namespace** и **kind: Secret** (в файле несколько блоков с kind: Secret — нам нужен тот, что с **name: kubernetes-dashboard-certs**):

...  
#apiVersion: v1  
#kind: Namespace  
#metadata:  
\#  name: kubernetes-dashboard  
...  
#apiVersion: v1  
#kind: Secret  
#metadata:  
\#  labels:  
\#    k8s-app: kubernetes-dashboard  
\#  name: kubernetes-dashboard-certs  
\#  namespace: kubernetes-dashboard  
#type: Opaque

_\* нам необходимо закомментировать эти блоки, так как данные настройки в Kubernetes мы должны будем сделать вручную._

Теперь в том же файле находим **kind: Service** (который с **name: kubernetes-dashboard**) и добавляем строки **type: NodePort** и **nodePort: 30001** (выделены красным):

kind: Service  
apiVersion: v1  
metadata:  
  labels:  
    k8s-app: kubernetes-dashboard  
  name: kubernetes-dashboard  
  namespace: kubernetes-dashboard  
spec:  
  type: NodePort  
  ports:  
    - port: 443  
      targetPort: 8443  
      nodePort: 30001  
  selector:  
    k8s-app: kubernetes-dashboard

_\* таким образом, мы публикуем наш сервис на внешнем адресе и порту **30001**._

Для подключения к веб-интерфейсу не через локальный адрес, начиная с версии 1.17, обязательно необходимо использовать зашифрованное подключение (https). Для этого нужен сертификат. В данной инструкции мы сгенерируем самоподписанный сертификат — данный подход удобен для тестовой среды, но в продуктивной среде необходимо купить сертификат или получить его бесплатно в [Let's Encrypt](https://www.dmosk.ru/miniinstruktions.php?mini=get-letsencrypt).

И так, создаем каталог, куда разместим наши сертификаты:

mkdir -p /etc/ssl/kubernetes

Сгенерируем сертификаты командой:

openssl req -new -x509 -days 1461 -nodes -out /etc/ssl/kubernetes/cert.pem -keyout /etc/ssl/kubernetes/cert.key -subj "/C=RU/ST=SPb/L=SPb/O=Global Security/OU=IT Department/CN=kubernetes.dmosk.local/CN=kubernetes"

_\* можно не менять параметры команды, а так их и оставить. Браузер все-равно будет выдавать предупреждение о неправильном сертификате, так как он самоподписанный._

Создаем namespace:

kubectl create namespace kubernetes-dashboard

_\* это та первая настройка, которую мы комментировали в скачанном файле **recommended.yaml**._

Теперь создаем настройку для secret с использованием наших сертификатов:

kubectl create secret generic kubernetes-dashboard-certs --from-file=/etc/ssl/kubernetes/cert.key --from-file=/etc/ssl/kubernetes/cert.pem -n kubernetes-dashboard

_\* собственно, мы не использовали настройку в скачанном файле, так как создаем ее с включением в параметры пути до созданных нами сертификатов._

Теперь создаем остальные настройки с помощью скачанного файла:

kubectl create -f recommended.yaml

Мы увидим что-то на подобие:

serviceaccount/kubernetes-dashboard created  
service/kubernetes-dashboard created  
secret/kubernetes-dashboard-csrf created  
secret/kubernetes-dashboard-key-holder created  
configmap/kubernetes-dashboard-settings created  
role.rbac.authorization.k8s.io/kubernetes-dashboard created  
clusterrole.rbac.authorization.k8s.io/kubernetes-dashboard created  
rolebinding.rbac.authorization.k8s.io/kubernetes-dashboard created  
clusterrolebinding.rbac.authorization.k8s.io/kubernetes-dashboard created  
deployment.apps/kubernetes-dashboard created  
service/dashboard-metrics-scraper created  
deployment.apps/dashboard-metrics-scraper created

Создадим настройку для админского подключения:

vi dashboard-admin.yaml

apiVersion: v1  
kind: ServiceAccount  
metadata:  
  labels:  
    k8s-app: kubernetes-dashboard  
  name: dashboard-admin  
  namespace: kubernetes-dashboard

\---  
apiVersion: rbac.authorization.k8s.io/v1  
kind: ClusterRoleBinding  
metadata:  
  name: dashboard-admin-bind-cluster-role  
  labels:  
    k8s-app: kubernetes-dashboard  
roleRef:  
  apiGroup: rbac.authorization.k8s.io  
  kind: ClusterRole  
  name: cluster-admin  
subjects:  
\- kind: ServiceAccount  
  name: dashboard-admin  
  namespace: kubernetes-dashboard

Создаем настройку с применением созданного файла:

kubectl create -f dashboard-admin.yaml

Теперь открываем браузер и переходим по ссылке https://<IP-адрес мастера>:30001 — браузер покажет ошибку сертификата (если мы настраиваем по инструкции и сгенерировали самоподписанный сертификат). Игнорируем ошибку и продолжаем загрузку.

Kubernetes Dashboard потребует пройти проверку подлинности. Для этого можно использовать токен или конфигурационный файл:

![](https://www.dmosk.ru/img/instruktions/kubernetes-ubuntu/02.jpg)

На сервере вводим команду для создания сервисной учетной записи:

kubectl create serviceaccount dashboard-admin -n kube-system

Создадим привязку нашего сервисного аккаунта с Kubernetes Dashboard:

kubectl create clusterrolebinding dashboard-admin --clusterrole=cluster-admin --serviceaccount=kube-system:dashboard-admin

Теперь камандой:

kubectl describe secrets -n kube-system $(kubectl -n kube-system get secret | awk '/dashboard-admin/{print $1}')

... получаем токен для подключения (выделен красным): 

Data  
\====  
ca.crt:     1066 bytes  
namespace:  11 bytes  
token:      eyJhbGciOiJSUzI1NiIsImtpZCI6IkpCT0J5TWF2VWxWQUotdHZYclFUaWwza2NfTW1IZVNuSlZSN3hWUzFrNTAifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJkYXNoYm9hcmQtYWRtaW4tdG9rZW4tbnRqNmYiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC5uYW1lIjoiZGFzaGJvYXJkLWFkbWluIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQudWlkIjoiMzIwNjVhYmQtNzAwYy00Yzk5LThmZjktZjc0YjM5MTU0Y2VhIiwic3ViIjoic3lzdGVtOnNlcnZpY2VhY2NvdW50Omt1YmUtc3lzdGVtOmRhc2hib2FyZC1hZG1pbiJ9.wvDGeNiTCRBakDplO6PbdqvPH\_W2EsBgJjZnTDflneP3cdXQv6VgBkI8NalplXDRF-lF36KbbC2hpRjbkblrLW7BemIVWYOznmc8kmrgCSxO2FVi93NK3biE9TkDlj1BbdiyfOO86L56vteXGP20X0Xs1h3cjAshs-70bsnJl6z3MY5GbRVejOyVzq\_PWMVYsqvQhssExsJM2tKJWG0DnXCW687XHistbYUolhxSRoRpMZk-JrguuwgLH5FYIIU-ZdTZA6mz-\_hqrx8PoDvqEfWrsniM6Q0k8U3TMaDLlduzA7rwLRJBQt3C0aD6XfR9wHUqUWd5y953u67wpFPrSA

Используя полученный токен, вводим его в панели авторизации:

![](https://www.dmosk.ru/img/instruktions/kubernetes-ubuntu/03.jpg)

Мы должны увидеть стартовое окно системы управления:

![](https://www.dmosk.ru/img/instruktions/kubernetes-ubuntu/04.jpg)

Удаление нод
------------

При необходимости удалить ноду из нашего кластера, вводим 2 команды:

kubectl drain k8s-worker2.dmosk.local --ignore-daemonsets

kubectl delete node k8s-worker2.dmosk.local

_\* в данном примере мы удаляем ноду **k8s-worker2.dmosk.local**._