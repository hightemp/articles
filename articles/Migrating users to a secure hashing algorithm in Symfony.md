# Migrating users to a secure hashing algorithm in Symfony
Your app may use an old and unsecure hashing algorithm for storing passwords, like MD5 (without salt).

This article explains how to convert your insecurely encrypted passwords to a secure method (using Bcrypt for instance).

To solve the problem, we will make an on-the-fly conversion when a user successfully logs in, and make use of Symfony's `EncoderAwareInterface` interface, login listener and use some not very well known parameters in `security.yml`.

Authentication before the migration
-----------------------------------

If you app is using simple MD5 encrypted passwords, the `security.yml` file will look like this to make the user authentication work in Symfony:

In this article, we will suppose that the `User` entity looks like this:

Prepare the database
--------------------

We are going to separate the password columns for each encoding method:

*   Rename the `password` column to `old_password`.
*   Add a new column named `password`, that will contain the newly encoded password.
*   Make both of these columns nullable.

The new `User` entity will now look like this:

Make authentication work with both hashing algorithms
-----------------------------------------------------

We are going to configure two encoders:

*   The new encoder, which will be the default one for the `User` entity (hence the `AppBundle\Entity\User` key).
*   The one used for users that haven't migrated yet (using MD5), called `legacy_encoder`.

Define these encoders in Symfony's `security.yml` file:

In order to tell Symfony which encoder to use depending on the user that is logging in, we are going to use the `EncoderAwareInterface` on the `User` entity, with the `getEncoderName()` method:

When a user entity implements this interface, Symfony will call the `getEncoderName()` method to determine which encoder to use when the password is being checked. If the method returns `null`, the default encoder is used.

All users can now log in, whether they are using the new algorithm or not.

Add a login listener that makes the migration
---------------------------------------------

We are going to attach a listener to the Symfony `security.interactive_login` event that is raised when the user successfully logs in.

Declare first the listener in the `services.yml` file:

Create the listener:

This listener updates the user's password only in case the user is still using the legacy password system.

In order to re-encode the password, we need the plain password the user has entered, which is not available by default in the authentication token provided by `InteractiveLoginEvent` object. To make it available, make the following change to the `security.yml` file:

As your users log in, they will progressively update the database, making it more secure with time. Once most users have logged in, you can remove the `old_password` column and implement a "Forgot password?" feature for those who wouldn't have migrated.