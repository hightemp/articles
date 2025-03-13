# Golang deploy · GitHub
1) Создаем юзера под которым будет работать приложение, задаем пароль и переключаемся на него:
----------------------------------------------------------------------------------------------

[](#1-создаем-юзера-под-которым-будет-работать-приложение-задаем-пароль-и-переключаемся-на-него)

```shell
useradd -s /bin/bash <имя_пользователя>
passwd <имя_пользователя>
su <имя_пользователя>
```

2) Генерируем новый ключ для деплоя
-----------------------------------

[](#2-генерируем-новый-ключ-для-деплоя)

```shell
ssh-keygen -t rsa -C "<имя_пользователя>@<домен_сервиса>"
cat ~/.ssh/id_rsa.pub
```

Например, в gitlab добавляем этот ключ Project>Settings>Deploy Key

3) Клонируем приложение и собираем приложение
---------------------------------------------

[](#3-клонируем-приложение-и-собираем-приложение)

```shell
cd ~
git clone ssh://______.git app 
# здесь не буду расписывать, можно устанавливать через go get и т.д. способы отличаются
# для go get нужно прописать $GOPATH в .bash_profile
```

4) Создаем systemd service
--------------------------

[](#4-создаем-systemd-service)

```shell
exit #выходим из-под юзера
nano /usr/lib/systemd/system/<имя_сервиса>.service
```

Вписываем:

```shell
[Unit]
Description=<Описание>

[Service]
Restart=always
RestartSec=10
EnvironmentFile=-/home/<имя_пользователя>/env
WorkingDirectory=/home/<имя_пользователя>/app
ExecStart=/home/<имя_пользователя>/app/appName
LimitNOFILE=524576
LimitNPROC=524576
User=<имя_пользователя>
Group=<имя_пользователя>
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=<имя_сервиса>


[Install]
WantedBy=multi-user.target
```

5) Запускаем сервис и ставим в автозагрузку:
--------------------------------------------

[](#5-запускаем-сервис-и-ставим-в-автозагрузку)

```shell
systemctl start <имя_сервиса>
systemctl enable <имя_сервиса>
```

Посмотреть статус:

```shell
systemctl status <имя_сервиса>
```

6) Разрешаем просмотр логов и перезапуск сервиса под созданным пользователем
----------------------------------------------------------------------------

[](#6-разрешаем-просмотр-логов-и-перезапуск-сервиса-под-созданным-пользователем)

Добавляем в `/etc/sudoers` строчки:

```shell
Defaults:<имя_пользователя> !authenticate
<имя_пользователя> ALL=/usr/bin/systemctl restart <имя_сервиса>, /usr/bin/systemctl stop <имя_сервиса>, /usr/bin/systemctl start <имя_сервиса>, /usr/bin/journalctl
```

Теперь эти операции не будут требовать пароля:

```shell
sudo journalctl -f  -u <имя_сервиса> 
sudo systemctl stop <имя_сервиса>
sudo systemctl start <имя_сервиса>
sudo systemctl restart <имя_сервиса>
```

7) настраиваем виртуальный хост nginx для проксирования на порт приложения, если требуется:
-------------------------------------------------------------------------------------------

[](#7-настраиваем-виртуальный-хост-nginx-для-проксирования-на-порт-приложения-если-требуется)

```shell
server {
    listen 80;
    server_name site.ru;

    client_max_body_size 256m;
    access_log  /var/log/nginx-site-acc;
    error_log /var/log/nginx-site-err;
    log_not_found off;

    location ^~ / {
        proxy_pass http://localhost:<порт_приложения>;
        proxy_set_header Host $host:$server_port;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffer_size 16k;
        proxy_buffers 32 16k;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location ^~ /files {
        alias /home/<имя_пользователя>/app/some_files;
    }
}
```