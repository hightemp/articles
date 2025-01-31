# Protect your Symfony application against the OWASP Top 10
In my experience with software development, security is an aspect of our work that does not always receive the attention it deserves. I have seen many organizations where risks are not properly analysed, and procedures to mitigate risks or to limit the impact of security breaches are not in place. Developers are typically expected to deliver new features, often under the pressure of tight deadlines, and new security issues get introduced without being noticed. At the same time existing or legacy code is rarely touched, possibly containing vulnerabilities that have existed for years.

I believe this mostly boils down to two reasons: organizations failing to recognize and mitigate the risk and potential impact of a security breach, and developers lacking the awareness or knowledge to identify and fix vulnerabilities in their code.

As a result, a lot of web applications contain vulnerabilities. According to a report by vulnerability scanning company Acunetix published last year, 46% of the web applications scanned by their vulnerability scanner had high-severity security vulnerabilities (meaning an attacker can fully compromise the confidentiality, integrity or availability of the system) and 87% had medium-severity security vulnerabilities. Those are staggering numbers, even more so when you consider that their data is based on organizations that are security-aware enough to pay for such a service.

Of course, not all of us are working on military-grade, financial, or healthcare systems. The impact of a security breach varies between industries, organizations and applications. Organizations should analyse the specific security risks they are facing and take the appropriate steps to mitigate them. However, that doesn't mean a smaller, non high-profile application is not at risk. Attackers are often just looking for low-hanging fruit, using automated tools to scan applications on the internet for vulnerabilities that can easily be exploited. On top of that, the [2019 "Cost of a Data Breach" study by the Ponemon Institute and IBM](https://www.ibm.com/security/data-breach) shows that small to medium-sized businesses face relatively much higher costs as the result of a data breach than larger organizations, with an average total cost of $2.74 million for organizations with less than 500 employees ($10,960 per employee) versus an average cost of $5.11 million for organizations with more than 25,000 employees ($204 per employee), making it much more difficult for small businesses to recover financially from a data breach.

The good news is that there are some great resources available to help you write more secure software. One great source of security knowledge is the [Open Web Application Security Project (OWASP)](https://owasp.org/), a highly respected, non-profit foundation with the goal of improving software security. OWASP provides a large number of open source security projects including documentation, cheat sheets, auditing standards and tools. One of their flagship projects (and the subject of this blog post) is the [OWASP Top 10](https://owasp.org/www-project-top-ten/), an evidence- and consensus-based list of the ten most critical security risks to web applications. The list is based on real-world data on prevalence, combined with factors as exploitability, detectability, and impact, and is regularly updated to reflect the changing security landscape. The current version has been published in 2017 (the new release planned for 2020 [will likely be postponed to 2021](https://docs.google.com/presentation/d/18XtVgx5RVPd0JUakgUKHfgLqGIUAdtYreaQY5MCDnoM/edit#slide=id.g83f9737c98_0_30)) and includes the following vulnerabilities, ordered by their risk rating:

1.  Injection
2.  Broken authentication
3.  Sensitive data exposure
4.  XML external entities (XXE)
5.  Broken access control
6.  Security misconfiguration
7.  Cross-site scripting (XSS)
8.  Insecure deserialization
9.  Using components with known vulnerabilities
10.  Insufficient monitoring & logging

The OWASP Top 10 provides a great amount of information on each individual risk, but it is abstracted from specific programming languages and frameworks which can make it difficult to apply on your technology stack. In this blog post I will look at how each of the 10 security risks applies to PHP (and more specifically to Symfony applications) and how to prevent them. There is enough to write about this subject to dedicate a separate blog post to each of the vulnerabilities, but I'll try to keep it short and provide links to more in-depth information where possible.

A1: Injection
-------------

![](https://nicwortel.nl/dist/images/xkcd-exploits-of-a-mom.png)

"[Exploits of a Mom](https://xkcd.com/327/)" by xkcd - [CC BY-NC](https://creativecommons.org/licenses/by-nc/2.5/)

With common prevalence, easy exploitability and detectability, and severe impact [injection](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A1-Injection) has the highest risk factor of the top ten. The OWASP Top 10 overview notes the following about injection:

> Injection flaws, such as SQL, NoSQL, OS, and LDAP injection, occur when untrusted data is sent to an interpreter as part of a command or query. The attacker’s hostile data can trick the interpreter into executing unintended commands or accessing data without proper authorization.

Untrusted data can be data from the HTTP request (including the URL path, query string, POST data, user agent string, and other HTTP request headers) but also from other sources such as the database, internal and external web services, or environment variables.

It is important to note that while SQL injection is probably the most well-known (and widespread) form of injection, injection is in fact not limited to SQL or relational databases. Any kind of interpreter can be vulnerable to injection if it can't differentiate between the command or query you wrote and the untrusted data that is pasted into it. I will use SQL injection for demonstration purposes because SQL will be familiar for most developers, but keep in mind that the same principles apply to a broader concept.

Let's take a look at the following repository. It uses Doctrine's QueryBuilder, so it should be safe, right?

```
<?php
declare(strict_types=1);

use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;

class UserRepository extends ServiceEntityRepository
{
    // ...

    public function findByOrganizationIdAndName(
        int $organizationId,
        string $name
    ): array {
        $queryBuilder = $this->createQueryBuilder('u')
            ->where('u.organizationId = ' . $organizationId)
            ->andWhere("u.name = '" . $name . "'");

        return $queryBuilder->getQuery()->execute();
    }
}

```

Unfortunately it isn't, because Doctrine is used in an insecure way. Instead of using a parameterized query, the data is concatenated directly into the query sent to the database. While the `$organizationId` argument is at least sanitized (by using the `int` type hint) and probably comes from a trusted source, the `$name` argument is not secure at all.

Let's assume that the `$name` argument is based on a query string parameter, and that a legitimate request to search for users by name would look like this:

```
https://example.com/users?name=Nic

```

An attacker could change the URL into this:

```
https://example.com/users?name=Nic' OR 'a' = 'a

```

which would result in the following DQL query:

```
SELECT * FROM User u WHERE u.organizationId = 3 AND u.name = 'foo' OR 'a' = 'a'

```

Because `OR` operators are evaluated after `AND`, the addition of `OR 'a' = 'a'` causes the WHERE clause to always evaluate to true, so the query will return all users from the database. This effectively bypasses the authorization requirement that users can only see other users from the same organization.

While this may seem quite sophisticated and somewhat hypothetical, it is actually very easy to automatically detect and exploit SQL injection flaws using penetration testing tools such as sqlmap and Havij. These can exploit SQL injection flaws in order to detect what database server is used, enumerate over databases and tables, and extract data from the database.

To prevent common injection flaws (not just SQL injection), keep the following guidelines in mind:

*   As a general rule of thumb, use safe APIs that provide a parameterized interface instead of concatenating data into commands or queries yourself. Sanitize user input and check that it matches what you are expecting to receive.
*   When using Doctrine ORM, make sure you understand the security features of both [Doctrine ORM](https://www.doctrine-project.org/projects/doctrine-orm/en/current/reference/security.html) and the underlying [Doctrine DBAL](https://www.doctrine-project.org/projects/doctrine-dbal/en/current/reference/security.html) library. In general (but especially when dealing with user input) use the [Doctrine APIs that are safe from SQL injection](https://www.doctrine-project.org/projects/doctrine-orm/en/current/reference/security.html#user-input-and-doctrine-orm), such as `EntityManager#find()`, `EntityManager#persist()` and the find methods on `Doctrine\ORM\EntityRepository`. When writing your own queries or using the QueryBuilder pass variables as parameters using methods such as `setParameter()`, `setMaxResults()` or `setFirstResult()`. Never concatenate user input into DQL or SQL queries yourself.
*   Avoid the use of PHP functions that allow you to execute commands on the server, such as [`exec()`](https://www.php.net/manual/en/function.exec.php), [`shell_exec()`](https://www.php.net/manual/en/function.shell-exec.php), [`passthru()`](https://www.php.net/manual/en/function.passthru.php) and [`system()`](https://www.php.net/manual/en/function.system.php). If you really need to execute a command on the server from within your application, use the [Symfony Process component](https://symfony.com/doc/current/components/process.html) which will help [escape command arguments](https://symfony.com/doc/current/components/process.html#usage).
*   Similarly, avoid using the [`eval()`](https://www.php.net/manual/en/function.eval.php) language construct which allows the execution of arbitrary strings as PHP code. **Never** use `eval()` with user input as it will open up your application to remote code execution vulnerabilities which will allow an attacker to do everything your application is allowed to do. As Rasmus Lerdorf, the creator of PHP [is quoted to have said](https://www.php.net/manual/en/function.eval.php#44008):
    
    > If `eval()` is the answer, you're almost certainly asking the wrong question.
    
*   If you use the [Symfony LDAP component](https://symfony.com/doc/current/components/ldap.html), keep in mind that it doesn't provide a parameterized interface or automatic escaping. When you use the Security component to authenticate users using an LDAP server [it will escape input data for you](https://symfony.com/doc/current/security/ldap.html#fetching-users-using-the-ldap-user-provider), but if you use the LDAP component directly you will have to escape input data yourself using [`LdapInterface::escape()`](https://github.com/symfony/symfony/blob/5.0/src/Symfony/Component/Ldap/LdapInterface.php#L52).
*   Scan your application for vulnerabilities using a vulnerability detection tool such as [OWASP ZAP](https://www.zaproxy.org/) to see if it contains injection flaws that can be easily detected by attackers.

A2: Broken authentication
-------------------------

![](https://nicwortel.nl/dist/images/password-already-in-use.png)

Second in the top 10 is [broken authentication](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A2-Broken_Authentication):

> Application functions related to authentication and session management are often implemented incorrectly, allowing attackers to compromise passwords, keys, or session tokens, or to exploit other implementation flaws to assume other users’ identities temporarily or permanently.

Attackers have several techniques at their disposal to attack user authentication. Many of them are based on the fact that users commonly use very weak passwords, and reuse their passwords for multiple services. Common attacks include [credential stuffing](https://owasp.org/www-community/attacks/Credential_stuffing) (where leaked username-password combinations from other data breaches are used to gain access to user accounts) and brute-force attacks (where the attacker simply attempts to login to a user account using a list of commonly used passwords). Attackers can also attempt to [steal the session cookie](https://owasp.org/www-community/attacks/Session_hijacking_attack) of an authenticated user through XSS or man-in-the-middle attacks.

The good news is that Symfony by default already protects against some common authentication and session management attacks. However, as Symfony doesn't come with user registration/management features out of the box, it is up to you as a developer to implement these features securely. Symfony also doesn't provide any protection against automated attacks such as brute force or credential stuffing attacks (although this appears to be on the roadmap as part of [a larger rework of the Security component](https://github.com/symfony/symfony/issues/30914)).

*   Do not ship or deploy with default credentials. While Symfony doesn't have default users, make sure you don't accidentally deploy your application with fixtures or migrations which create dummy users with easily guessable credentials (such as test/test or admin/admin).
*   Create and implement password length, complexity and rotation policies in accordance to a modern, evidence based standard such as the U.S. [NIST's Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html#memsecret) or the UK [NCSC's guidance on password administration](https://www.ncsc.gov.uk/collection/passwords). Security expert Troy Hunt (the creator of [Have I Been Pwned](https://haveibeenpwned.com/)) has aggregated the guidelines from NIST, NCSC and other sources in his excellent article [Passwords Evolved: Authentication Guidance for the Modern Era](https://www.troyhunt.com/passwords-evolved-authentication-guidance-for-the-modern-era/), which is worth a read. Here is a summary of the guidelines and how to implement them with Symfony validation constraints:
    
    *   A user-chosen password should be at least 8 characters long. Use Symfony's [`Length` constraint](https://symfony.com/doc/current/reference/constraints/Length.html) (with the `min` option) to validate the minimum length of passwords.
    *   Don't set a low upper limit to the password length. Passwords of at least 64 characters should be allowed, so users can choose a secure password. The longer the better, but very long passwords can cause problems. For instance, passwords in Symfony [can have a maximum of 4096 characters to prevent DoS attacks](https://symfony.com/blog/cve-2013-5750-security-issue-in-fosuserbundle-login-form), so use the `max` option of the `Length` constraint to ensure that passwords don't exceed this length. Allowing 4096 characters might be a bit over the top though, so alternatively a somewhat more sensible limit such as 200 characters may be used. Don't truncate the password if it exceeds the maximum length, but let the user choose a shorter one.
    *   Don't impose any other password complexity requirements, such as required combinations of letters, numbers and special characters. These don't add much security, while making it difficult to use a strong password or passphrase. At the same time they incentivise people to use common and easily guessable substitution patterns, such as "P4ssw0rd!" instead of "Password".
    *   Don't offer a "password hint" functionality in case the user forgot their password, and don't ask users to use specific types of information (such as the name of their first pet, teacher, etc.) when choosing a password.
    *   Don't require users to change their password periodically. Only require users to change their password if there is evidence of their credentials being compromised by a data leak.
    *   Compare the password to a list of values known to be commonly-used, expected, or compromised. Examples given by NIST are "passwords obtained from data breaches, dictionary words, repetitive or sequential characters (such as 'aaaaaa' or '1234abcd') and context-specific words such as the name of the service, the username, and derivatives thereof". If the password appears in one of these lists, reject it and explain the user why the password is rejected. For Symfony, the [`NotCompromisedPassword`](https://symfony.com/doc/current/reference/constraints/NotCompromisedPassword.html) validation constraint ([introduced in version 4.3](https://symfony.com/blog/new-in-symfony-4-3-compromised-password-validator)) checks if a given password has been included in a known data breach by sending it (anonimised) to the [Have I Been Pwned](https://haveibeenpwned.com/) API. The Have I Been Pwned database contains millions of passwords (555,278,657 at the time of writing) so this automatically includes all known lists of commonly-used passwords. The [`NotEqualTo`](https://symfony.com/doc/current/reference/constraints/NotEqualTo.html) constraint can be used to ensure that the password does not equal the user's username, the name of your application, or other pieces of information that can easily be guessed.
    *   Guide the user in choosing a strong password, for instance using a password strength meter that gives the user realtime feedback about how strong the password they're typing is. As explained by Troy Hunt in his article [Password Strength Indicators Help People Make Ill-Informed Choices](https://www.troyhunt.com/password-strength-indicators-help-people-make-dumb-choices/), most password strength meters rely too much on mathematics and fail to take into account that people are very predictable when it comes to choosing passwords. An exception is [Dropbox's zxcvbn](https://github.com/dropbox/zxcvbn), an open-source JavaScript library with a smart algorithm that checks passwords against a list of common passwords, common names and surnames, popular English words, and takes into account common patterns such as repeats ('aaa'), sequences ('abcd'), keyboard patterns ('qwerty'), and l33t speak.
    *   Encourage users to use a password manager to store their passwords. This will increase the likelihood that they will choose a stronger password. Don't make it difficult to use a password manager, for instance by disabling paste functionality for password fields.
    
    The following example code snippet implements a sensible password policy using Symfony validation constraints:
    
    ```
    <?php
    declare(strict_types=1);
    
    use Symfony\Component\Validator\Constraints as Assert;
    
    class User
    {
        private string $username;
    
        /**
         * @Assert\NotBlank()
         * @Assert\Length(
         *     min = 8,
         *     max = 200,
         *     minMessage = "Your password must be at least {{ limit }} characters long.",
         *     maxMessage = "Your password cannot be longer than {{ limit }} characters."
         * )
         * @Assert\NotCompromisedPassword(
         *     message = "This password has previously appeared in a data breach. Please choose a more secure alternative."
         * )
         * @Assert\NotEqualTo(
         *     propertyPath = "username",
         *     message = "Your password should not be the same as your username."
         * )
         * @Assert\NotEqualTo(
         *     value = "Your application name",
         *     message = "Don't use the name of this application as your password."
         * )
         */
        private string $plaintextPassword;
    }
    
    ```
    
*   Use TLS to encrypt _all_ requests to your application (not just the login page). All other precautions are worthless if an attacker can perform a man-in-the-middle attack to intercept the user's login credentials or session cookie, or to inject a keylogger in the login form. See [Sensitive data exposure](#a3%3A-sensitive-data-exposure) for more information about properly deploying TLS.
*   Log failed login attempts and implement a mechanism that limits or increasingly delays failed authentication attempts, to prevent brute force or credential stuffing attacks. Listen to Symfony's [`security.authentication.failure` event](https://symfony.com/doc/current/components/security/authentication.html#authentication-success-and-failure-events) and block or delay login attempts after too many failures have occurred within a given time frame, or use an existing 3rd-party solution such as [anyx/LoginGateBundle](https://github.com/anyx/LoginGateBundle). Set up monitoring alerts that trigger when credential stuffing, brute force, or other attacks are detected. See [Insufficient logging & monitoring](#a10%3A-insufficient-logging-%26-monitoring) for more information.
*   Where possible, implement multi-factor authentication (MFA). This severely limits the effectiveness of credential stuffing and similar attacks because a valid username and password are no longer enough to gain access to an account. I have no experience with it myself, but [scheb/two-factor-bundle](https://github.com/scheb/two-factor-bundle) looks like a solid option for implementing multi-factor authentication in Symfony. It supports TOTP, authenticator apps and authentication codes via email.
*   Use the Symfony session management system as it is hardened against most session management attacks. Don't disable Symfony's [session fixation](https://owasp.org/www-community/attacks/Session_fixation) protection ([`session_fixation_strategy`](https://symfony.com/doc/current/reference/configuration/security.html#session-fixation-strategy)). Ensure that session IDs are stored on the client side using cookies, and not as a query string parameter in the URL. Make sure that the [`framework.session.cookie_secure`](https://symfony.com/doc/current/reference/configuration/framework.html#cookie-secure) and [`framework.session.cookie_httponly`](https://symfony.com/doc/current/reference/configuration/framework.html#cookie-httponly) options are both set to `true`, so session cookies are only sent over secure connections and won't be accessible by JavaScript, preventing session hijacking via XSS.
*   Invalidate sessions (server-side) after a certain period of idle time. See [Session Idle Time/Keep Alive](https://symfony.com/doc/current/session.html#session-idle-time-keep-alive) for more information on how to implement this in Symfony.

A3: Sensitive data exposure
---------------------------

The third risk of the top 10 is [sensitive data exposure](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A3-Sensitive_Data_Exposure):

> Many web applications and APIs do not properly protect sensitive data, such as financial, healthcare, and PII. Attackers may steal or modify such weakly protected data to conduct credit card fraud, identity theft, or other crimes. Sensitive data may be compromised without extra protection, such as encryption at rest or in transit, and requires special precautions when exchanged with the browser.

Data sent over the internet unencrypted can be sniffed or intercepted using a man-in-the-middle attack. For example by eavesdropping on insecure public wireless networks, by installing packet sniffers on insecure routers, by spoofing the victim's DNS so it resolves domain names to an IP address controlled by the attacker, or using a _WiFi Pineapple_ that tricks devices into connecting with it by posing as a wireless network they've connected with before. There are many more possible scenarios, but the point is that we should assume that our traffic can be intercepted and that we should encrypt it to protect our data.

Apart from trying to intercept data in transit attackers can also steal data at rest, for example by exploiting other security risks such as [injection](#a1%3A-injection) or by stealing improperly protected backups.

A special category of sensitive data is user passwords, as unfortunately many people still reuse their password for multiple services. Applications often store passwords in plaintext or in a way that can easily be reversed to the plaintext password. Attackers use passwords obtained from data breaches to perform credential stuffing attacks against other services (see [Broken authentication](#a2%3A-broken-authentication)).

*   Classify the data that is processed, stored or transmitted by your application. Identify which data is sensitive according to laws and regulations (such as the EU GDPR, PCI-DSS, HIPAA) or business needs.
*   Don't store data your application doesn't need, or discard it as soon as possible. Data that isn't retained cannot be stolen.
*   Encrypt data in transit using secure protocols. With free certificate authorities such as [Let's Encrypt](https://letsencrypt.org/) there really isn't a good reason anymore to not use HTTPS. Configure your web server to use a modern version of TLS (the successor of SSL) with modern ciphers that support perfect forward secrecy. Redirect all plaintext HTTP requests to HTTPS and enable [HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security) (HSTS). The [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/) can help you to generate secure configuration snippets for various web servers. Regularly use the [SSL Server Test](https://www.ssllabs.com/ssltest/) by Qualys SSL Labs to verify that the configuration of your server conforms to modern standards and isn't vulnerable to known attacks.
*   Encrypt sensitive data at rest using modern cryptography. Cryptography is an advanced subject. Don't try to invent your own solution, but use an existing solution such as libsodium with the [sodium PHP extension](https://www.php.net/manual/en/book.sodium.php) (bundled with PHP as of PHP 7.2). A great documentation resource is [Using Libsodium in PHP Projects](https://paragonie.com/book/pecl-libsodium). The creator of that guide, security consultancy company [Paragon I.E.](https://github.com/paragonie), also maintains the higher-level [Halite](https://github.com/paragonie/halite) library based on libsodium. Bundles such as [DoctrineEncryptBundle](https://github.com/michaeldegroot/DoctrineEncryptBundle) can be used to integrate with Doctrine and encrypt data before it is stored in the database (I have no experience with this bundle, so use it at your own discretion).
*   Store passwords using a strong, salted hashing algorithm that is suitable for hashing passwords such as Argon2, PBKDF2 or bcrypt. Never store passwords in plaintext, encrypted (which can be reversed to the plaintext password), encoded (which doesn't provide any security at all), or hashed using a fast hashing algorithm such as SHA-1 or MD5 (which an attacker can brute-force with millions of guesses per second on specialized hardware). In Symfony use `algorithm: auto` ([introduced in Symfony 4.3](https://symfony.com/blog/new-in-symfony-4-3-native-password-encoder)) which [automatically upgrades the used password hashing algorithm when stronger ones become available](https://symfony.com/doc/current/reference/configuration/security.html#using-the-auto-password-encoder) (similar to the `PASSWORD_DEFAULT` constant for PHP's `password_hash()` function).
    
    ```
    # config/packages/security.yaml
    security:
        # ...
        encoders:
            App\Entity\User:
                algorithm: 'auto'
    
    ```
    
    When you let Symfony choose the best hashing algorithm, make sure the length of the password column in your database isn't limited to a low number of characters as a new hashing algorithm may produce longer hashes. The PHP documentation for `password_hash()` [suggests a length of 255 characters](https://www.php.net/manual/en/function.password-hash.php#refsect1-function.password-hash-description).
    
*   Ensure that sensitive data isn't cached, logged, or otherwise ends up in places where it cannot be properly protected.

A4: XML external entities (XXE)
-------------------------------

With medium exploitability and prevalence but high detectability and impact, [XML external entities](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A4-XML_External_Entities_(XXE)) is the fourth risk on the top 10:

> Many older or poorly configured XML processors evaluate external entity references within XML documents. External entities can be used to disclose internal files using the file URI handler, internal file shares, internal port scanning, remote code execution, and denial of service attacks.

External entities allow you to refer to an external source via a URI in an XML document. This feature can be abused by attackers if they can upload XML or include hostile content in an XML document that is then processed by a processor that evaluates these entities.

As an example, consider the following XML document:

```
<?xml version="1.0" encoding="ISO-8859-1"?>

<!DOCTYPE foo [
    <!ELEMENT foo ANY >
    <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
<foo>&xxe;</foo>

```

A processor that evaluates external entities will resolve the entity reference `$xxe;` inside `<foo>` to the contents of `/etc/passwd`. If the result is included in the response, this can expose sensitive information about your server. Other scenarios include probing the server's private network:

```
<!ENTITY xxe SYSTEM "https://192.168.1.1/private" >]>

```

or executing a DoS attack by including a potentially endless file:

```
<!ENTITY xxe SYSTEM "file:///dev/random" >]>

```

And last but not least, if the [expect extension](https://www.php.net/manual/en/intro.expect.php) is installed, the attacker can perform remote code execution on the server using the [`expect://` wrapper](https://www.php.net/manual/en/intro.expect.php), executing arbitrary commands:

```
<!ENTITY xxe SYSTEM "expect://id" >]>

```

*   When possible, use a simpler data format such as JSON.
*   Disable XML external entity and DTD processing in all XML parsers used in your application. Preferably use the [Symfony Serializer component](https://symfony.com/doc/current/components/serializer.html) to deserialize XML, as its XmlEncoder explicitly [disables external entities](https://github.com/symfony/symfony/blob/master/src/Symfony/Component/Serializer/Encoder/XmlEncoder.php#L118) and [document types](https://github.com/symfony/symfony/blob/master/src/Symfony/Component/Serializer/Encoder/XmlEncoder.php#L136-L138).
*   If you need to parse XML using one of the libxml extensions (such as DOM, XMLWriter and XMLReader) directly, disable the loading of external entities using [`libxml_disable_entity_loader(true)`](https://www.php.net/manual/en/function.libxml-disable-entity-loader.php).

A5: Broken access control
-------------------------

![](https://nicwortel.nl/dist/images/gate.jpg)

"[I love these people](https://www.flickr.com/photos/kevinomara/3577004975/in/photostream/)" by Kevin O'Mara - [CC BY-NC-ND](https://creativecommons.org/licenses/by-nc-nd/2.0/)

Number five is [broken access control](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A5-Broken_Access_Control.html):

> Restrictions on what authenticated users are allowed to do are often not properly enforced. Attackers can exploit these flaws to access unauthorized functionality and/or data, such as access other users’ accounts, view sensitive files, modify other users’ data, change access rights, etc.

Not to be confused with broken authentication, broken access control means that the user is authenticated correctly but is not restricted from acting outside their permissions.

As explained in the Symfony documentation, there are [two ways to deny access to something](https://symfony.com/doc/current/security.html#add-code-to-deny-access): using `access_control` in `security.yaml` to secure URL patterns, or using the `AuthorizationChecker` inside your application code (such as calling `$this->denyAccessUnlessGranted()` in your controller methods). Although using the AuthorizationChecker gives more flexibility than `access_control`, it has one big drawback: if you forget to add the access check to your controller action, it will allow access by default. It's a common mistake, which I have made myself, to hide a menu item based on a user's role but to forget to explicitly deny access when a user navigates to the protected URL directly.

*   With the exception of public resources, deny access by default.
*   Create [voters](https://symfony.com/doc/current/security/voters.html) to check if a user has permission to perform a specific action on a specific object, instead of just checking if a user has a certain role. For example, use
    
    ```
    $this->denyAccessUnlessGranted('edit', $product);
    
    ```
    
    instead of
    
    ```
    $this->denyAccessUnlessGranted('ROLE_ADMIN');
    
    ```
    
    Using voters you can check permissions based on ownership and specific actions instead of just granting full access to all users with a certain role. Voters also allow you to encapsulate the knowledge about who is allowed to perform a certain action. If access control rules change in the future, you will simply have to update the voter instead of updating all locations where the permission is checked.
    
*   Enforce unique business rules using a domain model. For example, when building an e-commerce site the domain model should enforce that a user cannot order -10 items of a product and receive money from the order instead of having to pay.
*   Disable web server directory listing and ensure file metadata (e.g. .git) and backup files are not present within web roots.
*   Log access control failures and set up monitoring to detect repeated failures.
*   Write unit and integration tests to test access control.

A6: Security misconfiguration
-----------------------------

[Security misconfiguration](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A6-Security_Misconfiguration) is number 6 in the Top 10:

> Security misconfiguration is the most commonly seen issue. This is commonly a result of insecure default configurations, incomplete or ad hoc configurations, open cloud storage, misconfigured HTTP headers, and verbose error messages containing sensitive information. Not only must all operating systems, frameworks, libraries, and applications be securely configured, but they must be patched/upgraded in a timely fashion.

As an example, in the last couple of years thousands of MongoDB installations have been compromised because they were publicly-accessible without a password. Using port-scanning software, attackers searched for vulnerable MongoDB installations and stole data, deleted the database or held data ransom demanding payment in Bitcoins. This was all possible because [the default configuration of MongoDB listened to remote connections without requiring a password](https://snyk.io/blog/mongodb-hack-and-secure-defaults/). While the default configuration of MongoDB has been improved in newer versions, this example illustrates how important it is to configure your system correctly.

*   Create an automated process to easily setup a new secure environment to deploy your application to. Configure development, test, and production environments identically with different credentials used in each environment. Using Docker is a great way to create reproducible environments but if Docker is not an option consider using a tool such as [Ansible](https://www.ansible.com/) to automate the configuration and hardening of your environments.
*   Ensure that you deploy Symfony with the `APP_ENV` variable set to `prod` (to disable the web profiler toolbar), without `APP_DEBUG` disabled (so error pages don't display any sensitive information) and `APP_SECRET` set to a random value of around 32 characters.
*   Apart from securing your application, ensure that the rest of your stack is configured securely as well. Configure databases to require authentication and to only accept connections from the internal network.
*   Configure your web server (or use the [NelmioSecurityBundle](https://github.com/nelmio/NelmioSecurityBundle) if you require more flexibility) to return the following security headers with every response:
    *   HTTP [`Strict-Transport-Security`](https://infosec.mozilla.org/guidelines/web_security#http-strict-transport-security) (HSTS) tells browsers to only access your application using HTTPS instead of HTTP and to remember this for a specified amount of time, preventing downgrade attacks. Once you have correctly configured your web server to serve content over HTTPS, set up HSTS with a long expire time (at least 6 months or `max-age=15768000`).
    *   [`Content-Security-Policy`](https://infosec.mozilla.org/guidelines/web_security#content-security-policy) (CSP) tells the browser from which sources it may load resources such as scripts, stylesheets, images, etc. This helps guard against cross-site scripting (XSS, see A7) and other attacks. Configure a strict content security policy which denies everything by default (`default-src: none`) and only whitelist the specific sources your application needs to work. Don't allow insecure sources such as `unsafe-inline` (inline `<script>` and `<style>` tags), `unsafe-eval`, `http:`, `https:` or `data:`, especially for scripts, as these would nullify the effect of your CSP. Be sure to explicitly include any directives that are not affected by the `default-src` directive, such as `frame-ancestors`, `base-uri`, and `form-action`. Add a `report-uri` directive so browsers will report CSP violations to the provided endpoint, so you will receive reports if you've either misconfigured the header or someone is attempting an XSS attack on your users. You can implement this endpoint yourself, or use an existing service such as [report-uri.com](https://report-uri.com/) (built by security researcher Scott Helme) to aggregate reports for you.
    *   Use [`Content-Security-Policy-Report-Only`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only) instead of `Content-Security-Policy` if you want to test your policy without enforcing it, to avoid breaking your application. Once you are confident that your policy is configured correctly, switch back to the regular `Content-Security-Policy` header.
    *   [`X-Frame-Options`](https://infosec.mozilla.org/guidelines/web_security#x-frame-options) (XFO) tells the browser whether it should allow your website to be loaded in iframes on other sites, which can allow clickjacking. This header has been superseded by the Content Security Policy's `frame-ancestors` directive, but as that directive is not supported by some older browsers it is recommended to use `X-Frame-Options` as well. Set it to `DENY` unless you explicitly want your site to be framed within another page.
    *   [`X-Content-Type-Options`](https://infosec.mozilla.org/guidelines/web_security#x-content-type-options) instructs browsers not to MIME-sniff the content type of files and to respect the content-type declared by the server. Without this header, some browsers can incorrectly detect and load files as scripts, opening them up to XSS attacks. Set it to the only valid value, `nosniff`.
    *   [`Referrer-Policy`](https://infosec.mozilla.org/guidelines/web_security#referrer-policy) protects your user's privacy by letting you control how much referrer information gets included in the request when a user clicks on a link or when you embed an image. The different values allow you to differentiate between requests to your own origin (protocol, host and port) and external origins. Set it to either `no-referrer` (never send the `Referer` header), `same-origin` (only send referrer information on requests to the same origin), `strict-origin` (send the referrer to all origins, but only the URL without the path) or `strict-origin-when-cross-origin` (send the full referrer URL on same origin, but only the URL without path to other origins).
    *   [`X-XSS-Protection`](https://infosec.mozilla.org/guidelines/web_security#x-xss-protection) is a feature of certain browsers that stops pages from loading when they detect reflected cross-site scripting (XSS) attacks. Like `X-Frame-Options`, it has been superseded by the Content Security Policy but is still recommended to protect users of older web browsers. Set it to `1; mode=block`.
*   Validate your configuration using tools such as the [Mozilla Observatory](https://observatory.mozilla.org/) or [securityheaders.com](https://securityheaders.com/). They give slightly different (but not conflicting) feedback, so it doesn't hurt to use both. Aim for a score of A+ in both tools.

A7: Cross-site scripting (XSS)
------------------------------

Seventh on the list is [cross-site scripting](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A7-Cross-Site_Scripting_(XSS)):

> XSS flaws occur whenever an application includes untrusted data in a new web page without proper validation or escaping, or updates an existing web page with user-supplied data using a browser API that can create HTML or JavaScript. XSS allows attackers to execute scripts in the victim’s browser which can hijack user sessions, deface web sites, or redirect the user to malicious sites.

Cross-site scripting ranked much higher in earlier versions of the Top 10 as it used to be the most widespread security flaw. For example, in 2015 a security researcher demonstrated XSS flaws with 10 major Dutch banks where he was able to inject JavaScript to manipulate their public websites:

Now this is a relatively innocent use of the XSS vulnerability and of course he alerted the banks so they could fix these flaws before he published the video, but imagine what could happen if an attacker is able to manipulate the link to, or the login form for an online banking application.

While prevalence of cross-site scripting has decreased since the 2013 Top 10 (probably due to increased awareness and the growing use of frameworks that automatically escape output), according to OWASP around two-thirds of all applications were still vulnerable to XSS in 2017.

There are three types of XSS: _reflected XSS_, _stored XSS_ and _DOM XSS_. Reflected XSS occurs when an application directly returns malicious input from the request (for instance as part of the query string or POST body) into the response. An attacker can trick users to click on a link that either contains the malicious payload or redirects to it. In the case of stored XSS the attacker is able to submit their payload to be stored in a database, and then to be returned as part of the HTML response of other users in subsequent requests. DOM XSS happens when a JavaScript framework or single-page application that manipulates the DOM dynamically includes malicious data into a page.

A successful XSS attack allows an attacker to inject malicious JavaScript code into a web page. This can then be used to steal session cookies and impersonate the victim, to insert or remove parts of the page using DOM manipulation, or to include a keylogger that sends user input (passwords, payment details, or other sensitive information) back to an endpoint controlled by the attacker.

*   Use Twig as your template engine, as it automatically escapes output by design. Don't [disable automatic escaping](https://symfony.com/doc/current/reference/configuration/twig.html#autoescape) and use the correct template name extension (`*.html.twig` for HTML templates) as the escaping strategy is by default based on the template name. Only use the [`raw` filter](https://twig.symfony.com/doc/3.x/filters/raw.html) (which disables output escaping of the variable it is applied on) on trusted variables that don't contain user-supplied data.
    
    ```
    {{ var }} {# this will be auto-escaped #}
    {{ var|raw }} {# this will not be escaped, making it vulnerable to XSS #}
    
    ```
    
*   Only insert untrusted data in one of the [safe locations](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#rule-0-never-insert-untrusted-data-except-in-allowed-locations) (inside an HTML element, inside an HTML element's attribute, inside JavaScript code, inside CSS, and inside URLs) and escape it using the correct escaping strategy. Using Twig that means that if you want to insert untrusted data in an HTML attribute you should explicitly call the [`escape` filter](https://twig.symfony.com/doc/3.x/filters/escape.html) to set the strategy to `html_attr`:
    
    ```
    <div class="{{ class|escape('html_attr') }}">
    
    ```
    
    Read its documentation to learn more about Twig's `escape` filter and escaping strategies, and read OWASP's [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) to learn about XSS prevention in general.
    
*   When modifying the DOM, apply context-sensitive encoding on the client side to prevent DOM XSS. See the [DOM\-based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html) for more information on DOM XSS.
*   As an additional layer of defense, enable a strict Content Security Policy to prevent the browser from evaluating inline scripts and scripts from untrusted domains. I have discussed the `Content-Security-Policy` header in A6: Security misconfiguration.

A8: Insecure deserialization
----------------------------

Risk #8 is [insecure deserialization](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A8-Insecure_Deserialization):

> Insecure deserialization often leads to remote code execution. Even if deserialization flaws do not result in remote code execution, they can be used to perform attacks, including replay attacks, injection attacks, and privilege escalation attacks.

In PHP, similar to other programming languages, in-memory values can be transformed to a string representation using the [`serialize()`](https://www.php.net/manual/en/function.serialize.php) function. Unlike `json_serialize()`, `serialize()` includes information about the type and structure of the data. For example, the serialized representation of an object could look like this:

```
O:9:"ClassName":1:{s:12:"propertyName";s:5:"value";}

```

This string representation can be reverted to the corresponding PHP value using [`unserialize()`](https://www.php.net/manual/en/function.unserialize.php). Because it contains the class of the object and the types of its properties, PHP knows exactly which class to instantiate or which type to cast a variable to.

Initially, insecure deserialization was the most difficult of the OWASP Top 10 for me to grasp. The OWASP Top 10 shows a PHP example where a user's ID, role, password hash and other data are stored serialized in a cookie:

```
a:4:{i:0;i:132;i:1;s:7:"Mallory";i:2;s:4:"user";i:3;s:32:"b6a8b3bea87fe0e05022f8f3c88bc960";}

```

This is obviously insecure as any user can manipulate the contents of the cookie in order to impersonate another user or give themselves admin permissions. But this isn't specific to insecure deserialization; relying on this information would be equally insecure if it came with the request in any other format. While dangerous, this example doesn't demonstrate the more specific vulnerabilities that can occur when using `unserialize()` on untrusted data.

To understand why insecure deserialization deserves its own place in the OWASP Top 10 (especially for PHP projects), we should consider the following:

1.  When the serialized data contains an object with a class name, PHP will instantiate an object of that class, autoloading it if necessary.
2.  When deserializing an object of a class that contains either the [`__unserialize()`](https://www.php.net/manual/en/language.oop5.magic.php#object.unserialize) or [`__wakeup()`](https://www.php.net/manual/en/language.oop5.magic.php#object.wakeup) magic method, PHP will call that method. Similarly, when there are no more references to the object or during shutdown PHP will call its [`__destruct()`](https://www.php.net/manual/en/language.oop5.decon.php#object.destruct) method (if it exists).

How can an attacker exploit this to do evil things? Let's say your application contains a class with either a `__wakeup()`, `__unserialize()` or `__destruct()` method. This can be in your own application code, or in vendor code that is autoloaded through Composer. This method might write the contents of a property to a file, for example to store its state before it gets destroyed:

```
<?php
declare(strict_types=1);

class Vulnerable
{
    private string $filename;
    private string $content;

    public function __destruct()
    {
        file_put_contents($this->filename, $this->content);
    }
}

```

Then, somewhere else in your application, `unserialize()` is used with untrusted data, for instance a serialized value stored in a cookie. An attacker can craft a custom string of serialized data that will instantiate an object of the above class, setting `$content` to any PHP code they wish to execute and `$filename` to a filename in the web directory that they can access over PHP. They now have the ability to run their own code on your server. This technique is called PHP Object Injection and as you can see it can have serious consequences.

A more real-world example is the `TagAwareAdapter` of the Symfony Cache component, which executes callables stored in a private property when the `__destruct()` method is called. Insecure deserialization would allow an attacker to upload a serialized payload of a `TagAwareAdapter` with their own callable, which would get executed once the PHP request was finished. While this issue is fixed in more recent Symfony versions by prohibiting the deserialization of this class (see [CVE\-2019-18889](https://symfony.com/blog/cve-2019-18889-forbid-serializing-abstractadapter-and-tagawareadapter-instances)), similar magic methods may exist in your code or in vendor code. An attacker simply needs to find a piece of serialized data in the request or anywhere else that they can manipulate in order to exploit insecure deserialization. They can craft their own payload or use a tool like [phpggc](https://github.com/ambionics/phpggc) to create one for popular frameworks and libraries.

The only safe precaution against insecure deserialization is to simply not `unserialize()` data from untrusted sources. Instead, use a serialization medium that only permits primitive data types, such as JSON. The OWASP Top 10 [lists some workarounds in case you really have to deserialize untrusted data](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A8-Insecure_Deserialization), but those are workarounds that might be bypassed by a skilled attacker.

A9: Using components with known vulnerabilities
-----------------------------------------------

[Using components with known vulnerabilities](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A9-Using_Components_with_Known_Vulnerabilities) is the second-last risk in the Top 10. That doesn't make it less serious: it's very widespread and some of the largest breaches have relied on exploiting known vulnerabilities in components. This is what the Top 10 overview has to say about this risk:

> Components, such as libraries, frameworks, and other software modules, run with the same privileges as the application. If a vulnerable component is exploited, such an attack can facilitate serious data loss or server takeover. Applications and APIs using components with known vulnerabilities may undermine application defenses and enable various attacks and impacts.

![](https://nicwortel.nl/dist/images/chain.jpg)

"[Every chain has got a weak link...](https://www.flickr.com/photos/tracyrusso/4513213612)" by Tracy Russo - [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/2.0/)

Any Symfony application is built on top of a number of components. Think of PHP, Symfony itself, a web server, the server OS, probably some kind of database, maybe a key-value store or some other additional components. Within your application code you are using Composer packages and you're probably using some NPM packages for your frontend code as well. This is a good thing: it saves us a lot of time fixing problems that have already been fixed by other developers, so we can spend more time on the domain of our application. And since these components are open source, more developers have used them and taken a look at the code. Security issues may have already been found and fixed, making them probably even more secure than if we had to write them ourselves.

However, even open source code is not immune to security flaws. Vulnerabilities can and will still be found. That's why many open source projects have a documented policy for handling security issues (for example [Symfony](https://symfony.com/doc/current/contributing/code/security.html) and [Doctrine](https://www.doctrine-project.org/policies/security.html)). Typically, this involves reporting security issues privately (so a patch can be developed and released before the issue is made public), possibly assigning them a CVE identifier, and publishing a security advisory informing users about the vulnerability and how to patch it. This alerts users about the vulnerability and allows them to update their software, but also makes attackers aware of a potential vulnerability that can be exploited. That's why it is important to keep track of the components you use and update them as soon as a security advisory gets published - just like with any other software.

*   Remove unused or unnecessary dependencies, features, components, files and documentation. Use [composer-unused](https://packagist.org/packages/icanhazstring/composer-unused) to find unused Composer packages, and remove them from your list of dependencies. For NPM packages there is [depcheck](https://www.npmjs.com/package/depcheck) which serves a similar purpose. Keep your web server clean of unneeded software - especially WordPress sites, PHPMyAdmin, etc. running with the same privileges as your application can be a security risk. Using Docker can help to isolate your applications.
*   Keep your software up-to-date. Use a [supported version of PHP](https://www.php.net/supported-versions.php) and upgrade your application to a newer PHP version before it becomes end of life. The same applies to using a [supported version of Symfony](https://symfony.com/releases) and of other packages you use. Regularly use the `composer outdated` command to see which packages are outdated.
*   Monitor for components that are unmaintained, and thus will not receive patches when security issues are found. Composer for example will warn about abandoned packages when you run `composer install`. Replace these packages with maintained alternatives.
*   Follow security announcements and subscribe to email alerts for security vulnerabilities related to the components you use. For example, for Symfony you can follow the [security advisories category](https://symfony.com/blog/category/security-advisories) of the Symfony blog, and with a Symfony account you can subscribe to email notifications about security releases. Update your components as soon as possible when a security release is published.
*   Regularly check the installed versions of packages for known vulnerabilities. Use the [SensioLabs Security Checker](https://github.com/sensiolabs/security-checker) to check your installed Composer package versions against the [PHP Security Advisories Database](https://github.com/FriendsOfPHP/security-advisories). If one of your installed dependencies contains a known vulnerability, it will warn you and tell you to update it. For NPM packages use [`npm audit`](https://docs.npmjs.com/cli/audit) or [`yarn audit`](https://classic.yarnpkg.com/en/docs/cli/audit/). Run these commands to your CI pipeline to ensure that your installed packages are checked regularly and that the build will fail when one of your dependencies contains a vulnerability. For applications that are not in active development set up a process (such as a cron job) that regularly re-runs these tools in case new vulnerabilities have been found.

A10: Insufficient logging & monitoring
--------------------------------------

Last in the Top 10, and introduced in the 2017 version is [insufficient logging & monitoring](https://owasp.org/www-project-top-ten/OWASP_Top_Ten_2017/Top_10-2017_A10-Insufficient_Logging%252526Monitoring):

> Insufficient logging and monitoring, coupled with missing or ineffective integration with incident response, allows attackers to further attack systems, maintain persistence, pivot to more systems, and tamper, extract, or destroy data. Most breach studies show time to detect a breach is over 200 days, typically detected by external parties rather than internal processes or monitoring.

While insufficient logging & monitoring on its own isn't enough for an attacker to compromise your application, it can prevent you from detecting malicious activity or breaches and thus from adequately responding to incidents.

Your application should log security-related events (such as authentication failures, access control failures, server-side validation failures and important transactions) in a way that they can be audited. The Symfony Security component logs a lot of interesting information. Unfortunately, the [default Monolog configuration for the production environment](https://github.com/symfony/recipes/blob/master/symfony/monolog-bundle/3.3/config/packages/prod/monolog.yaml) is designed more towards tracing errors and doesn't store any logs unless a log message with a severity level of "error" or higher is included. Authentication failures are logged at the "info" level, so we are missing out on some important logs. The default configuration also doesn't include additional context such as the authenticated user or the client IP address. Luckily, this can be fixed with some small configuration changes.

*   Adjust your log handler to persist logs of levels "info" or higher, for instance using `passthru_level` on the `fingers_crossed` handler:
    
    ```
    # config/packages/prod/monolog.yaml
    monolog:
        handlers:
            main:
                # store all logs (including debug logs) if an error is logged
                type: fingers_crossed
                action_level: error
                # (other configuration for this handler)
                # store logs of level info or higher, but without the debug logs
                passthru_level: info
    
    ```
    
    If logging all "info" messages is too verbose for you, instead create a separate handler to specifically handle logs from the "security" channel:
    
    ```
    # config/packages/prod/monolog.yaml
    monolog:
        handlers:
            main:
                # (other configuration for this handler)
                # filter out the security channel in this handler
                channels: ['!security']
    
            security:
                # store all security logs of level info or higher
                # in a separate file
                type: stream
                path: '%kernel.logs_dir%/security.log'
                level: info
                channels: [security]
    
    ```
    
*   Enable the [WebProcessor](https://github.com/symfony/monolog-bridge/blob/master/Processor/WebProcessor.php) to include the client IP address and other request data in log records, and the [TokenProcessor](https://github.com/symfony/monolog-bridge/blob/master/Processor/TokenProcessor.php) to include the security token (with the username and roles of the authenticated user, but without their password of course):
    
    ```
    # config/services.yaml
    services:
        # your other services
    
        monolog.processor.web:
            class: Symfony\Bridge\Monolog\Processor\WebProcessor
            tags: [monolog.processor]
    
        monolog.processor.token:
            class: Symfony\Bridge\Monolog\Processor\TokenProcessor
            tags: [monolog.processor]
    
    ```
    
    If your application is deployed behind a proxy or load balancer, ensure that the [trusted proxies](https://symfony.com/doc/current/deployment/proxies.html) are configured correctly so the actual client's IP gets logged instead of the load balancer's one.
    
*   Make sure that server-side validation failures get logged. Either log them manually in your controllers or application services, or [create a decorator service](https://symfony.com/doc/current/service_container/service_decoration.html) for the validator that passes all method calls to the real validator, but logs a notice when validation fails:
    
    ```
    <?php
    declare(strict_types=1);
    
    namespace App\Security;
    
    use Psr\Log\LoggerInterface;
    use Symfony\Component\Validator\ConstraintViolationInterface;
    use Symfony\Component\Validator\ConstraintViolationListInterface;
    use Symfony\Component\Validator\Validator\ValidatorInterface;
    
    /**
     * Decorates the default validator service to log validation failures.
     */
    final class LoggingValidator implements ValidatorInterface
    {
        private ValidatorInterface $validator;
    
        private LoggerInterface $logger;
    
        public function __construct(ValidatorInterface $wrappedValidator, LoggerInterface $logger)
        {
            $this->validator = $wrappedValidator;
            $this->logger = $logger;
        }
    
        public function validate($value, $constraints = null, $groups = null): ConstraintViolationListInterface
        {
            $violationList = $this->validator->validate($value, $constraints, $groups);
    
            if (count($violationList) > 0) {
                $violations = [];
    
                /** @var ConstraintViolationInterface $violation */
                foreach ($violationList as $violation) {
                    $violations[] = [
                        // Don't include $violation->getInvalidValue() in the log
                        // as it may contain sensitive data such as passwords.
                        'property' => $violation->getPropertyPath(),
                        'message' => $violation->getMessage(),
                        'code' => $violation->getCode(),
                    ];
                }
    
                $this->logger->notice('Validation failed.', ['violations' => $violations]);
            }
    
            return $violationList;
        }
    
        // all other methods simply delegate to $this->validator
    }
    
    ```
    
    ```
    # config/services.yaml
    services:
        validator.logging:
            class: App\Security\LoggingValidator
            decorates: validator
            arguments:
                - '@validator.logging.inner'
                - '@logger'
    
    ```
    
*   Send your logs to a centralized location where you can aggregate logs coming from multiple sources and where an attacker cannot tamper with them to erase their steps. Choosing and implementing a centralized log management solution is outside the scope of this article, but something like Graylog, Logstash or a commercial offering should be sufficient. Just make sure that you can set up monitoring and alerting and that your log messages are retained for a sufficient amount of time.
*   Set up effective monitoring and alerting such that suspicious activities are detected and responded to in a timely fashion. At the very least you may want to set alerts for the events I discussed earlier: authentication failures, access control failures and server-side validation failures. As single occurrences of these events are not necessarily a symptom of malicious intent, you want to set up your monitoring to alert you when the number of them exceeds a certain threshold.

What's next?
------------

You should now be aware of the top 10 web application security risks and how to mitigate them in Symfony applications. But while the OWASP Top 10 is a good starting point, it doesn't cover all security risks your application might be facing. OWASP provides more resources to help you improve the security of your applications and software development process, and I recommend you to familiarize yourself with them and use them where possible.

*   The [Cheat Sheet Series](https://cheatsheetseries.owasp.org/) is a collection of cheat sheets about specific security topics. I've already mentioned some of them, such as the XSS prevention cheat sheet, but there are many other useful cheat sheets.
*   The [Proactive Controls](https://top10proactive.owasp.org/) is a list of security techniques that should be included in every software development project. It has some relation to the OWASP Top 10 as many of these controls prevent one or more of the Top 10 vulnerabilities.
*   The [Application Security Verification Standard (ASVS)](https://owasp.org/www-project-application-security-verification-standard/) is a list of security requirements and verification criteria to verify the security of your application in a security audit. You can use the standard as-is our use it as a basis to create a checklist specific to your application or organization. The ASVS supports three levels, where level 1 is the bare minimum that all applications should strive for and level 3 is for applications that require significant levels of security verification.
*   The [Software Assurance Maturity Model (SAMM)](https://owaspsamm.org/) is a way to analyse and improve the overall software security posture of an organization, covering the governance, design, implementation, verification and operation of software. It defines measurable maturity levels for security practices, actionable pathways to improve the maturity levels and is technology, process and organization agnostic.

Could you use some help with Symfony, security or OWASP Top 10 in your organization? Have a look at my [consulting](https://nicwortel.nl/consulting) and [training](https://nicwortel.nl/training) services to see how I can help you.