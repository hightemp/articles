# Redis pub-sub vs Cron Job in Symfony UVdesk Helpdesk
namespace  UVDesk\\TicketBundle\\Command;

use  Doctrine\\ORM\\Query;

use  Predis\\Client as  RedisClient;

use  Symfony\\Component\\HttpFoundation\\Request;

use  Symfony\\Component\\Console\\Input\\InputInterface;

use  Symfony\\Component\\Console\\Output\\OutputInterface;

use  Symfony\\Component\\Routing\\Generator\\UrlGeneratorInterface;

use  Symfony\\Bundle\\FrameworkBundle\\Command\\ContainerAwareCommand;

class  BdayEmailNotificationCommand  extends  ContainerAwareCommand

{

private  $container;

private  $redis\_client;

private  $entityManager;

private  $emailBirthdayNotificationService;

protected  function  configure()

{

$this\->setName('email:bithday:notificaton');

$this\->setDescription('Runs a pub-sub service to

                automate email to employee on his/her birthday.');

}

protected  function  initialize(InputInterface  $input,  OutputInterface  $output)

{

$this\->container  \=  $this\->getContainer();

$this\->entityManager  \=  $this\->container\->get('doctrine.orm.entity\_manager');

$this\->emailBirthdayNotificationService  \=

$this\->container\->get('employee.birthday.notification');

// Get default redis client

$this\->redis\_client  \=

$this\->emailBirthdayNotificationService\->getRedisClient();

// Check if client is able to communicate with the server

try  {

$this\->redis\_client\->connect();

if  ((bool)  $this\->redis\_client\->isConnected()  \==  false)  {

return  false;

}

}  catch  (\\Exception  $e)  {

$output\->writeln("\\nUnable to establish

                        a connection with the redis server.\\n");

exit(1);

}

}

protected  function  execute(InputInterface  $input,  OutputInterface  $output)

{

// Subscribe to key-space event notification

$pubsub  \=  $this\->getPubSub();

$pubsub\->subscribe('\_\_keyevent@0\_\_:expired');

foreach  ($pubsub as  $message)  {

if  ('subscribe'  \==  $message\-&gt;kind)  {

$output\->write("\\nSubscribed to channel

                                  &lt;fg=yellow&gt;"  .  $message\-&gt;channel  .  "&lt;/&gt;\\n\\n");

}  else  if  ('message'  \==  $message\->kind)  {

switch  ($message\->channel)  {

case  '\_\_keyevent@0\_\_:expired':

$expired\_key  \=  $message\->payload;

if  ((bool)

preg\_match('/bday:email:notification:employee(.\*)

                        /',  $expired\_key,  $matches)  !==  false)  {

$output\->write("Key expired &lt;

                                            fg=yellow&gt;"  .  $expired\_key  .  "&lt;/&gt;\\n");

$email  \=  $matches\[1\];

$from\=  "uvdesk@example.com";

$subject  \=  "Happy Birth day";

$content  \=  "Wish you a very happy b'day.";

$mailer  \=  $this\->container\->get('mailer');

$message  \=

$mailer\->createMessage()

\->setSubject($subject)setFrom($from))

\->setTo($email)

\->setBody($content,  'text/html');

 try  {

 mailer\->send($message);

 // Reset key with auto expiry

 $expireTime  \=  31536000;  //(one year)

 $this\->redis\_client

 \->pipeline(function  ($pipe)  use

 ($email,  $expireTime)  {

 $pipe\->set("employee:$email",  $expireTime);

$pipe\->expire("employee:$email",  $expireTime);

 });

}  catch(\\Exception  $e)  {

 $logger  \=  $this\->container\->get('logger');

 $logger\->error('Email send error : '.$e\->getMessage());

 }

}

break;

default:

break;

}

}

}

exit(0);

}

private  function  getPubSub()

{

$pubsub\_client  \=  new  RedisClient(\[

'scheme'  \=\>  $this\->container\->getParameter('redis.client.scheme'),

'host' \=\>  $this\->container\->getParameter('redis.client.host'),

'port'  \=\>  $this\->container\->getParameter('redis.client.port'),

'read\_write\_timeout'  \=\>  '-1'

\],  \[

'profile'  \=\>  '2.8',

 \]);

 $pubsub\_client\->config('set',  'notify-keyspace-events',  'KExe');

 return  $pubsub\_client\->pubSubLoop();

}

}