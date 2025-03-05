# Permission Denied Nginx Docker | by Serghei Pogor | Medium
If you are running an Nginx web server inside a Docker container, you may encounter the “Permission Denied” error when trying to access certain files or directories. This error occurs when the user running the Nginx process inside the container does not have sufficient permissions to access the requested resource.

There are a few different approaches you can take to resolve this issue, depending on the specific circumstances of your Docker setup and the nature of the file or directory that is causing the error.

Check File and Directory Permissions
------------------------------------

The first step in troubleshooting the “Permission Denied” error is to check the permissions of the file or directory that Nginx is trying to access. You can do this using the `ls -l` command:

```
$ ls -l /path/to/file/or/directory
```

This will display the owner, group, and permissions of the specified file or directory. If the file or directory is owned by a user other than the one running the Nginx process inside the container, you may need to adjust the ownership or permissions using the `chown` or `chmod` commands.

Adjust Container User Permissions
---------------------------------

Another option is to adjust the permissions of the user running the Nginx process inside the container. By default, the user ID of the container process is typically set to 0, which corresponds to the root user. This can cause issues with file permissions if the container process is trying to access files or directories that are owned by a different user.

To resolve this issue, you can create a new user inside the container and run the Nginx process as that user instead. You can do this by adding the following lines to your Dockerfile:

```
RUN groupadd -r nginx && useradd -r -g nginx nginx  
USER nginx
```

This will create a new group called “nginx” and a new user called “nginx” with that group as their primary group. The final `USER` command sets the user that the container process will run as to "nginx". You may also need to adjust the ownership or permissions of any files or directories that Nginx needs to access inside the container.

Mount Host Directories with Correct Permissions
-----------------------------------------------

A third option is to mount the directories that Nginx needs to access as volumes in the Docker container, and ensure that the host directories have the correct permissions. You can do this using the `docker run` command with the `-v` option:

```
$ docker run -v /path/on/host:/path/in/container nginx
```

This will mount the `/path/on/host` directory on the host machine to the `/path/in/container` directory inside the container. You can also specify the permissions of the mounted directory using the `:z` or `:Z` suffixes:

```
$ docker run -v /path/on/host:/path/in/container:z nginx
```

This will set the SELinux context of the mounted directory to “z”, which ensures that the container process can access it with the correct permissions.

In conclusion, the “Permission Denied” error in Nginx Docker containers can be caused by a variety of factors related to file and directory permissions. By checking the permissions of the affected resources, adjusting the user permissions inside the container, or mounting host directories with the correct permissions, you can resolve this issue and ensure that your Nginx server is able to access the necessary files and directories.