# Troy Hunt: Passwords Evolved: Authentication Guidance for the Modern Era
In the beginning, things were simple: you had two strings (a username and a password) and if someone knew both of them, they could log in. Easy.

But the ecosystem in which they were used was simple too, for example in [MIT's Time-Sharing Computer](https://www.wired.com/2012/01/computer-password/?ref=troyhunt.com), considered to be the first computer system to use passwords:

![](https://www.troyhunt.com/content/images/2017/07/Massachusetts-Institute-of-Technology.jpg)

We're talking back in the 60's here so a fair bit has happened since then. Up until the last couple of decades, we had a small number of accounts and very limited connectivity which made for a pretty simple threat landscape. Your "adversaries" were those in the immediate vicinity, that is people who could gain direct physical access to the system. Over time that extended to remote users who could dial in - I mean _literally_ dial in via phone - and that threat landscape grew. You pretty much know the story from here: more connectivity, more accounts, more threat actors and particularly in recent years, more data breaches. Suddenly, the simple premise of matching strings no longer seems like such a good idea.

A couple of months ago I wrote about [Password reuse, credential stuffing and another billion records in Have I been pwned](https://www.troyhunt.com/password-reuse-credential-stuffing-and-another-1-billion-records-in-have-i-been-pwned/) (HIBP). Here we have a situation where there's a 10-figure number of credentials sitting there waiting for evildoers to start testing them against any site of their choosing and that presents a very interesting challenge: how do we defend against this? I mean you're trying to run your online system and someone has _valid credentials for some of your users_, how are you going to stop them from getting in? The simple string matching of the 60's just isn't going to cut it.

There's a lot more to how authentication has evolved than just the rise and rise of credential stuffing though, many other aspects of how we logon to systems has also changed. In some cases, this has led to once-held "truths" about how we create and manage accounts to be totally flipped on their head, yet we still see modern organisations applying the patterns of yesterday to the threats of today. This post sets out to address this gap and talk about how we _should_ be designing this critical part of our systems today. My hope is that in times where a company says "we're doing this screwy thing because security", this post becomes the resource that well-wishers direct them to.

Listen to Your Governments (and Smart Tech Companies)
-----------------------------------------------------

Let me start by referencing others because there's a lot of great material out there from recent times which I'm going to draw on. I want to lay these out early to be clear that a lot of the guidance I'll outline below is not the personal views of one individual, rather it's direct from the likes of the [National Institute of Standards and Technologies](https://en.wikipedia.org/wiki/National_Institute_of_Standards_and_Technology?ref=troyhunt.com) (NIST). In fact, their recently released [Digital Identity Guidelines](https://www.nist.gov/itl/tig/special-publication-800-63-3?ref=troyhunt.com) from only last month (this is SP 800-63 for those interested in the details) were arguably the catalyst for me finally putting this together because there's so much good stuff in there.

The [National Cyber Security Centre](https://en.wikipedia.org/wiki/National_Cyber_Security_Centre_(United_Kingdom)?ref=troyhunt.com) (NCSC) in the UK government is another excellent resource I'll be drawing on. They've consistently put out really thoughtful pieces on the topic at hand and refreshingly, it's an example of a government department really "getting it" when it comes to modern day tech.

I'll also be referring to [Microsoft's Password Guidance](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/06/Microsoft_Password_Guidance-1.pdf?ref=troyhunt.com) paper from the Identity Protection Team. The first page of the document talks about Microsoft having a "unique vantage point to understand the role of passwords in account takeover" due to them seeing 10 _million_ attacks every day so yeah, they have some experience in this area! This is a very practical document that's been put together by people who put a huge amount of thought into keeping online accounts safe.

I'm sure there are other such examples too and I welcome people to add these to the comments section below. That's just a few sources and you'll see many others referenced throughout the remainder of this post. Let's get into it!

Authentication Should be More Than a Binary State
-------------------------------------------------

I want to start with a more philosophical look at how authentication usually works: you're not logged on so you have no access to anything then you logon and you have full access to everything that your account should have rights too. There are no grey areas, it's either one or the other.

One of the really neat things we're seeing in many aspects of infosec these days is the recognition of threat or confidence levels, that is that sometimes we're more confident in a particular risk scenario (i.e. logging on) than at other times. For example, rather than just allowing multiple logon attempts to an account and then locking it out completely after say, 5 failed attempts (notice how this is always an odd number?), perhaps after 3 attempts a CAPTCHA should be presented. This recognises that confidence in the user has dropped and steps should be taken to ensure an automated attack isn't being mounted. It's tough on bots, but a minor inconvenience for users and you can still lock out after X more failed attempts if necessary.

Likewise, once someone is successfully authenticated, should they have full access to all features? For example, if it took a few goes to get the password right and they've come in from a previously unseen browser in a different country to usual, should they have unbridled access to everything? Or should they be limited to basic features and must verify they still control the registered email address before doing anything of significance?

These are simple examples but the thought process I'm trying to get going is that we can be a lot smarter than the traditional binary authentication state that still prevails in the vast majority of systems today. You'll see this theme pop up a few times during the remainder of this blog post.

Longer is (Usually) Stronger
----------------------------

Let's get into the nuts and bolts of things and we'll start with something easy: this is not a good password policy:

That first sentence in that pop-up is probably one of the most common poor password anti-patterns going, that is a short arbitrary length. It kills password managers (more on them soon), it kills pass phrases and subsequently, it kills usability. On that last point, the tweet above is from a 2016 blog post of mine on [how we keep failing at the basics](https://www.troyhunt.com/security-insanity-how-we-keep-failing-at-the-basics/) and along with Etihad's bad policy (which incidentally, [they allegedly do "because security"](https://twitter.com/EtihadAirways/status/748626413306150912?ref=troyhunt.com)), I show how PayPal effectively locked me out of my account due to a similar policy.

In addition to the problems mentioned above, short arbitrary limits like this regularly cause people to speculate that password storage is insufficient. When cryptographically hashed, all passwords are stored with the same fixed length so an arbitrary limit such as the one above may indicate the password is stored in a plain text and the column only allows 10 characters. Now that's not necessarily the case (~Microsoft limits their accounts to 16 characters and I'm confident they have very robust password storage~), but you can see how it causes the aforementioned speculation.

Edit: See [Ariel Gordon's comment below](https://www.troyhunt.com/passwords-evolved-authentication-guidance-for-the-modern-era/#comment-3437375825) regarding Microsoft no longer imposing this limit.

So how long _should_ you allow a password to be? No, not "as long as you want" because there is a size at which you have other problems. For example, at over 4MB you'd exceed [the default ASP.NET max request size](https://msdn.microsoft.com/en-us/library/system.web.configuration.httpruntimesection.maxrequestlength(v=vs.110).aspx?ref=troyhunt.com). Here's NIST's view:

> Verifiers SHOULD permit subscriber-chosen memorized secrets at least 64 characters in length

No reasonable person is going to use a website with a 64-character password limit then turn around and say "this site's security is crap because they didn't let me use more than 64 characters in my password". But just to be sure, make it 100. Or 200. Or stick with NIST's thinking and make it 256, it doesn't matter because it's going to hash down to the same number of characters anyway.

NIST also makes another important if not obvious point when it comes to password length:

> Truncation of the secret SHALL NOT be performed

This is really the simplest of concepts: don't have a short arbitrary password length and don't chop characters off the end of a password provided by a user. At the very least, an organisation defending this position should say "we know it's bad, there's legacy reasons, we'll put it on the road map to be rectified".

All Characters Are Special (But You Don't Have to Have Special Characters)
--------------------------------------------------------------------------

I want to look at two different aspects of special characters and I'll start with this one:

> This does not give me confidence in your password security, [@YourAlberta](https://twitter.com/YourAlberta?ref=troyhunt.com). (cc. [@troyhunt](https://twitter.com/troyhunt?ref=troyhunt.com)) [pic.twitter.com/6eI3p3Acej](https://t.co/6eI3p3Acej?ref=troyhunt.com)
> 
> — Nick Heer (@nickheer) [July 18, 2017](https://twitter.com/nickheer/status/887196833872658432?ref=troyhunt.com)

Typically, certain characters are disallowed as a means of defending against potential attacks. For example, angle brackets may be used in XSS attacks and an apostrophe may be used in SQL injection attacks. However, both of these arguments show serious shortcomings in the security profile of the site in question because firstly, passwords should never be re-displayed in the UI where an XSS risk could be exploited and secondly, because they should never be sent to the database without being hashed which would mean only alphanumeric characters prevail. Plus of course you have output encoding and parameterisation even if you _were_ inappropriately handling passwords by re-displaying them in the UI and saving them in plain text to the database.

NIST is pretty clear on this - don't do it:

> All printing ASCII \[RFC 20\] characters as well as the space character SHOULD be acceptable in memorized secrets. Unicode \[ISO/ISC 10646\] characters SHOULD be accepted as well.

It's also worth noting their point on Unicode characters; there are many precedents of sites restricting perfectly valid language characters simply because they don't fit into what a site's developers consider "normal". Then, of course, there are passwords like this:

The ❄️ ? ? ⚪ on the mountain ? ?. ?? a? to ? ?. A ? of ?, and it ? like☝️️ the ?. The ? is ? like this ? ❄️ ☔️ ?. ?? keep it in, ☁️ ? ☝️️ tried.

If someone _really_ wants to have a password that's an emoji representation of the first verse of "Let It Go" from Frozen, good on 'em!

The other aspect of special characters is this from NIST:

> Verifiers SHOULD NOT impose other composition rules (e.g., requiring mixtures of different character types or prohibiting consecutively repeated characters) for memorized secrets

Wait - what?! You mean people aren't required to have lowercase, uppercase, numbers and symbols?! This goes against so much of conventional password wisdom and it's not until you step back and think about it logically that it really makes sense. To demonstrate this, I recently wrote about [how password strength indicators help people make ill-informed choices](https://www.troyhunt.com/password-strength-indicators-help-people-make-dumb-choices/), the premise of which was that mathematics alone (which is what most password strength meters use), does not help us make strong passwords. Requirements such as these leave scope to use passwords such as "Passw0rd!" and rule out passwords such as lowercase passphrases.

Microsoft has precisely the same guidance as NIST in their aforementioned documentation:

> Eliminate character-composition requirements

What tends to happen when there are requirements around password complexity is that people first try something basic then they tweak characters until it comes up to the minimum requirement of the site. Microsoft explains the problem as follows:

> Most people use similar patterns (i.e. capital letter in the first position, a symbol in the last, and a number in the last 2). Cyber criminals know this, so they run their dictionary attacks using the common substitutions, such as "$" for "s", "@" for "a," "1" for "l" and so on.

This will almost certainly still be a bad password and almost certainly one they've previously used in other places too so all that's been achieved here is that the user has been put through a level of frustration in order to still arrive at a bad password!

Password Hints Are _Definitely_ Out
-----------------------------------

Anecdotally, password hints are far less frequent today than what they used to be. This was the premise of "hey, people forget passwords, let's make it easier for them to remember" and it meant that at signup, as well as providing a password you could provide a _hint_ as to what the password actually is. The problem is that this hint is shown to unauthenticated users because that's the precisely the point at which it's needed. The other problem is that because this is usually a user-provided piece of data, it's probably going to be terrible.

Adobe stored password hints in their database that was disclosed back in 2013. Just to illustrate the terribleness of these hints, I went back to take a look at the data and thought I'd highlight a few of them here:

*   my name
*   adobe
*   usual
*   password
*   email

These were all stored in plain text too so think of what that meant once the system was compromised. For obvious reasons, NIST thinks these are a bad idea:

> Memorized secret verifiers SHALL NOT permit the subscriber to store a “hint” that is accessible to an unauthenticated claimant.

Like I said, they're rare to see in an online system these days anyway but just in case you were thinking about doing this, don't!

Embrace Password Managers
-------------------------

I've been going on about the value of password managers for a long time now, since early 2011 actually when I wrote about how [the only secure password is the one you can’t remember](https://www.troyhunt.com/only-secure-password-is-one-you-cant/). The premise is simple and I'll boil down to a few bullet points:

1.  We know that passwords must be "strong", that is that they shouldn't be predictable or readily brute forced so in other words, the longer and more random, the better.

*   We know that passwords shouldn't be reused because disclosure by one service puts the user's other services at risk. This is the whole credential stuffing problem I referred to earlier.
*   People cannot create strong, unique passwords across all their services using only their brain to remember which one they used where.

Now some people will argue that a password manager means putting all your eggs in one basket and they're right; if that basket gets compromised it's going to be bad news. But this is an exceptionally rare event compared to the compromise of an individual service which consequently exposes credentials. Further to that and as I wrote more recently, [password managers don't have to be perfect, they just have to be better than not having one](https://www.troyhunt.com/password-managers-dont-have-to-be-perfect-they-just-have-to-be-better-than-not-having-one/).

But this post isn't intended to provide guidance to individuals about how to secure their accounts, rather it's aimed at people building services. This means that regardless of your personal views on password managers, you shouldn't be doing this:

This is typical short-sightedness and I could easily point to dozens of other tweets of a similar nature. It entirely neglects the 3 bullet points I outlined earlier and what it's essentially doing is saying "hey, create a password you can easily remember and yeah, it'll be weak and probably the same as your other ones, but do it because security".

The NCSC is quite explicit about this and has the following in the infographic accompanying their [Password Guidance: Simplifying Your Approach](https://www.ncsc.gov.uk/guidance/password-guidance-simplifying-your-approach?ref=troyhunt.com) resource:

![](https://www.troyhunt.com/content/images/2017/07/Allow-users-to-securely-record-and-store-their-passwords.png)

In other words, don't break password managers and don't trot out lines like in the tweet above. But the NCSC goes even further, providing the following recommendation targeted clearly at how organisations enable their staff to create and manage passwords in a secure fashion:

> You should also provide appropriate facilities to store recorded passwords, with protection appropriate to the sensitivity of the information being secured. Storage could be physical (for example secure cabinets) or technical (such as password management software), or a combination of both. The important thing is that your organisation provides a sanctioned mechanism to help users manage passwords, as this will deter users from adopting insecure ‘hidden’ methods to manage password overload.

Have a think about the environment you work in at present - do they have password strength criteria? Do they possibly have annual training or posters on the wall, each encouraging unique and complex passwords? Inevitably there's at least _some_ control and education around this, but do they actually provide you with a "sanctioned mechanism" to help you achieve those objectives? Almost certainly not and I know this because it's one of the questions I often ask when I run training in organisations. It's amazing that this gap prevails.

Let Them Paste Passwords
------------------------

Closely related to the use of password managers is the ability to paste passwords into the login screen. There are plenty of password managers that can auto-fill credentials, but there are occasions where either pasting is still necessary or where a service blocks a password that hasn't been typed in character by character (easily identified with a bit of JavaScript). It means we have situations like this:

Back in 2014, I wrote about [the “Cobra Effect” that is disabling paste on password fields](https://www.troyhunt.com/the-cobra-effect-that-is-disabling/). I explain the meaning of this term in the blog post but in short, a cobra effect occurs when an attempted solution to a problem makes the problem worse. When a website blocks the pasting of passwords in an attempt to improve security, they force some users to weaken their passwords to the point where they're dumbed down to easily typed versions.

The NCSC [is behind me on this one too](https://www.ncsc.gov.uk/blog-post/let-them-paste-passwords?ref=troyhunt.com):

![](https://www.troyhunt.com/content/images/2017/07/copy-paste-wall-code.jpg)

They even coined a term for the anti-pattern - SPP or "Stop Pasting Passwords" - and they go on to debunk common myths around the "risks" of pasting passwords. They also reference my cobra effect article mentioned earlier which is nice endorsement from the British Government!

NIST echoes the NCSC's position with this statement:

> Verifiers SHOULD permit claimants to use “paste” functionality when entering a memorized secret. This facilitates the use of password managers, which are widely used and in many cases increase the likelihood that users will choose stronger memorized secrets.

Let there be no doubt about it: there is unanimous support from both sides of the Atlantic for encouraging the use of password managers as well as not actively blocking them.

Do Not Mandate Regular Password Changes
---------------------------------------

I had an easy way of remembering how long I'd been using a password for in my previous corporate job: I'd take the number in it that I incremented every time the company forced a quarterly password rotation and divide it by 4. I got about 6 years out of that particular password, only ever changing 1 or 2 characters at a time. If you're working in an environment that mandates regular password changes, you're very likely doing the same thing because it's an easy human control to deal with a technology requirement that's seen as an impediment.

Let's think through the rationale of this approach for a moment: the premise of a regular password change is that should that password be compromised, forcing a change means it is no longer valid, ergo it cannot be used by malicious parties. The problem is, attackers have got up to 3 months in the example I gave earlier or in some cases, even longer:

> [@ClearScore](https://twitter.com/ClearScore?ref=troyhunt.com) [@troyhunt](https://twitter.com/troyhunt?ref=troyhunt.com) [@Scott\_Helme](https://twitter.com/Scott_Helme?ref=troyhunt.com) another one doesn't listen to [@ncsc](https://twitter.com/ncsc?ref=troyhunt.com) advice [https://t.co/uGegf75p5n](https://t.co/uGegf75p5n?ref=troyhunt.com) [pic.twitter.com/y4VeVjObXs](https://t.co/y4VeVjObXs?ref=troyhunt.com)
> 
> — My Online Security (@dvk01uk) [July 22, 2017](https://twitter.com/dvk01uk/status/888724550313279488?ref=troyhunt.com)

Think about it: attackers don't generally just sit around waiting, they get on with the business of exploiting accounts. This is the same flawed logic which led to [Lifeboat covering up their breach last year](https://www.troyhunt.com/breach-concealment-is-not-a-security-strategy/) based on the following screwy rationale:

> When this happened \[in\] early January we figured the best thing for our players was to quietly force a password reset without letting the hackers know they had limited time to act

Per the tweet above, the NCSC agrees that forcibly rotating passwords is a modern-day security anti-pattern saying this about the practice in [their password guidance documentation](https://www.ncsc.gov.uk/guidance/password-guidance-simplifying-your-approach?ref=troyhunt.com):

> carries no real benefits as stolen passwords are generally exploited immediately

And it makes its way into the associated infographic too:

![](https://www.troyhunt.com/content/images/2017/07/Only-ask-users-to-change-their-passwords-on-indication.png)

Microsoft is also on the same page here:

> Password expiration policies do more harm than good, because these policies drive users to very predictable passwords composed of sequential words and numbers which are closely related to each other (that is, the next password can be predicted based on the previous password). Password change offers no containment benefits cyber criminals almost always use credentials as soon as they compromise them.

Now this is not to say "don't force password cycling and do nothing else", rather it's a recognition that there should be a broader, more _evolved_ approach to password management. For example, the NCSC also recommends the following:

1.  Monitoring logins to detect unusual use

*   Notifying users with details of attempted logins, successful or unsuccessful; they should report any for which they were not responsible

Which brings us neatly to the next section:

Notify Users of Abnormal Behaviour
----------------------------------

This is an important part of the "evolved" component of authentication and you may well have seen this in action before. I recently logged in to Yammer from my new Lenovo Yoga 910, a machine I'd not previously used with the service. Shortly afterwards, I received this notification:

![](https://www.troyhunt.com/content/images/2017/07/Yammer-message.png)

I later logged into Dropbox via the browser with the same machine and immediately received this:

![](https://www.troyhunt.com/content/images/2017/07/Dropbox-message.png)

Now neither of these _stopped_ me from logging in and indeed I could have been a bad guy holding the victim's legitimate credentials. But they let me know as soon as it happened and that's enormously valuable because per the messages above, I could now go and boot an intruder out of my account if necessary. Dropbox actually showed me devices I'd auth'd as far back as 5 years ago and gave me the ability to de-auth them:

![](https://www.troyhunt.com/content/images/2017/07/Unauth-Dropbox-device.png)

Being able to identify account behaviour in this fashion is enormously useful, for example seeing which devices are presently logged in to my Facebook account:

![](https://www.troyhunt.com/content/images/2017/07/Current-devices-logged-in-to-Facebook.png)

As with Dropbox and Yammer, there's also the ability to now log any of these out which means it gives the rightful account owner back some control in the event that their account has been inappropriately accessed. Many modern services do this; GitHub is a great example and they go into a lot more detail including the IP address and the specific security event, for example a 2FA request or the creation of a public key.

Here's another scenario:

This too, makes a lot of sense and when you start considering the various scenarios you could proactively notify users about, you start to realise how much you can do with really very little effort.

Block Previously Breached Passwords
-----------------------------------

Getting back to the whole credential stuffing thing for a moment, once passwords are disclosed they must be considered "burned", that is they should never be used again. Ever. Once they're out there in the wild, an untold number of other parties now have those credentials which therefore _significantly_ heightens the risk anyone uses them now faces. Imagine having access to a _billion_ email address and password pairs taken from actual data breaches [as I highlighted in the credential stuffing post](https://www.troyhunt.com/password-reuse-credential-stuffing-and-another-1-billion-records-in-have-i-been-pwned/):

![](https://www.troyhunt.com/content/images/2017/05/Combos-in-list-1.png)

NIST talks about the problem as follows:

> When processing requests to establish and change memorized secrets, verifiers SHALL compare the prospective secrets against a list that contains values known to be commonly-used, expected, or compromised. For example, the list MAY include, but is not limited to: Passwords obtained from previous breach corpuses.

In layman's terms, this means that when someone registers or changes their password, you should be checking to ensure it's not a password that's previously appeared in a data breach. It doesn't matter that it may not have been the user who is presently registering that used the password in the breach, the mere fact that it has now been leaked publicly increases the chances of it being used in an attack. They also mention that the password shouldn't be a dictionary word or a "context-specific word"; when I wrote about [CloudPets leaving their database publicly exposed](https://www.troyhunt.com/data-from-connected-cloudpets-teddy-bears-leaked-and-ransomed-exposing-kids-voice-messages/), I pointed out how even bcrypt hashes were easily crackable by using a small password dictionary including words such as "cloudpets". Don't let people use a password which is the name of the service they're signing up to _because they will!_

Beyond the Basics
-----------------

There's a lot more I consciously decided not to delve into here. For example, the various multi-step verification mechanisms which are available and indeed which NIST speaks to in their documentation. I wanted to focus on the absolute fundamentals in this post but certainly layering additional defences such as an authenticator app on top of everything above greatly improves the security position, it's just a shame barely anyone uses them:

Another consideration is the ability to actually identify and defend against a highly automated attack in the first place. Think about it - how well-equipped are you to identify a sudden influx of login attempts such as via a credential stuffing attack? Would it be a matter of waiting until a whole bunch of people reported their accounts pwned or would you know as soon as it started happening? And if you _did_ identify an attack, could you rapidly deploy defences to mitigate that risk? For example, by toggling the security level on Cloudflare:

![](https://www.troyhunt.com/content/images/2017/07/Cloudflare-under-attack.png)

I also didn't delve into password _storage_, instead deciding to focus on the more immediately visible components of how websites deal with credentials. So I don't leave that totally untouched, check out [OWASP's Password Storage Cheat Sheet](https://www.owasp.org/index.php/Password_Storage_Cheat_Sheet?ref=troyhunt.com) for guidance there. Also have a good read of [how Dropbox securely stores your passwords](https://blogs.dropbox.com/tech/2016/09/how-dropbox-securely-stores-your-passwords/?ref=troyhunt.com) which is a very interesting piece combining both a modern-day approach to hashing and the use of encryption.

It goes much deeper than just what I've covered here, the point is that what I've outlined above should be the modern "normal", but it's not necessarily where you stop.

Summary
-------

Here's the bigger picture of what all this guidance from governments and tech companies alike is recognising: security is increasingly about a composition of controls which when combined, improve the overall security posture of a service. What you'll see across this post is a collection of recommendations which all help contribute to a more robust solution by virtue of complementing one another. That may mean that individual recommendations such as dropping complexity requirements look odd, but when you consider the way humans tended to deal with that (they'd just choose bad passwords with a combination of character types) alongside guidance such as blocking previously breached passwords, things start to make a lot more sense.

Now there's just one more thing: as good as all this guidance is, practically implementing it can be somewhat trickier. I'm going to follow this post up with another one next week that will introduce something all new; something that will make it easier for site owners to protect their subscribers. It's something I've invested quite a bit of effort in over the last few weeks and I'm going to give it away for free so check back soon and I'll also update this post with a link to the resource as soon as it goes public. Stay tuned!

**Edit:** As promised, here's that new resource: [Introducing 306 Million Freely Downloadable Pwned Passwords](https://www.troyhunt.com/introducing-306-million-freely-downloadable-pwned-passwords/)

[Security](https://www.troyhunt.com/tag/security/) [Passwords](https://www.troyhunt.com/tag/passwords/)