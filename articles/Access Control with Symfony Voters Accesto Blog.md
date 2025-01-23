# Access Control with Symfony Voters | Accesto Blog
Access control refers to the policies regulating individuals and entities that can view, modify, or create resources within a computing environment. Almost all systems that we use in our daily lives have access controls. It’s a fundamental aspect of cybersecurity, designed to mitigate risks by ensuring only the permitted individuals can access digital resources.

In this article, I’ll take a look at Symfony Voters, which helps you manage some of the complex cases of access control.

> “Voters are Symfony's most powerful way of managing permissions. They allow you to centralize all permission logic, then reuse them in many places.” - [Symfony Documentation](https://symfony.com/doc/current/security/voters.html)

Understanding Symfony Security and Access Control
-------------------------------------------------

Symfony has a powerful and robust security component that provides systems for managing authentication, authorisation and access control.

*   **Authentication**: Authentication is the process of verifying the identity of the user. This is usually done through a username and password combination, API tokens, or OAuth integrations.
*   **Authorisation**: Once a user is authenticated, authorisation determines what permissions they have in the system. Examples include publishing an article, approving leave, disbursing a loan, etc. Actions are tied to the domain in which the application is used. Symfony uses access control rules defined in the `security.yaml` file to govern these permissions.
*   **Access Control**: Access control mechanisms manage actual access to resources in a system. In Symfony, this is achieved through a combination of configurations and programmatic checks. Access control rules specify which roles have access to which resources. Developers can also specify expressions and voters to create a more fine-grained access control mechanism.

There are two main types of access control mechanisms. Here’s a quick look at each of them.

*   **Role-Based Access Control (RBAC)**: RBAC assigns permissions to roles and not individual users. In such systems, all users with the same role have the same level of access to the entire system. Users inherit the permissions from their roles. This makes it easier to manage permissions in large applications. In Symfony, roles can be defined in the `security.yaml` file. An example is given below:
    
    ```
     security:
    		role_hierarchy:
    		ROLE_MEMBER: ROLE_USER
    		ROLE_MODERATOR: [ROLE_ADMIN, ROLE_USER]
    ```
    
*   **Attribute-Based Access Control (ABAC)**: Unlike RBAC, ABAC provides a more granular level of control by considering various attributes of the user performing the action, the resource on which the action is performed, temporal factors like the current time, etc. ABAC is flexible, but the code becomes complex to maintain.

Understanding Symfony Voters
----------------------------

In Symfony, access control is implemented using a feature known as [voters](https://symfony.com/doc/current/security/voters.html). Voters centralize all permission logic and allow you to reuse it across an app. They are responsible for making authorisation decisions. The beauty of this system is that it is dynamic and can adapt to a variety of use cases. In fact, Symfony voters combine the best of both RBAC and ABAC while providing a simple API with which to work.

It's so-called because it "votes" on whether a user has permission to perform a specific action on a given object, thus centralizing and managing access control decisions in a single place.

Voters can be used to augment the capability of the default access control system in Symfony. Voters determine whether or not a user has the necessary permissions to perform a specific action on an object. In the coming sections, I will take a detailed look into voters and understand just how to use this system effectively using a few examples.

### Steps in Symfony’s Authorisation Process

1.  **Collect voters**: The Symfony application will collect all voters in the system. Voters are typically stored in the `src/Security/Voter` directory. A voter is a class that implements the `VoterInterface` class. For simplicity, the voters can inherit from an abstract class named `Voter`.
2.  **Casting Votes**: When an access decision needs to be made, i.e., when `access_control` in the `security.yaml` is invoked, `$this->denyAccessUnlessGranted()` is called, or when the `IsGranted` annotation or PHP 8 attribute is used, the collected voters will vote.
3.  **Decision**: Depending on the decision strategy, which I will cover in detail below, votes are consolidated and a final decision is made. It is the job of the `AccessDecisionManager` (the base class for all access decision managers that use decision voters) to decide based on the votes.

### Role in the Authorisation Process

1.  **Decision making**: During the voting process, each voter is asked if it wants to vote on the given scenario. If they decide not to vote, the voter will abstain from voting (`ACCESS_ABSTAIN`).
2.  **Granting / Denying Access**: Each voter who decides to vote can grant access (`ACCESS_GRANTED`) or deny access (`ACCESS_DENIED`).

### Decision Strategies

Normally, only one voter will make the decision, and other voters will abstain from voting. However, this can be changed to meet the requirements of each application. To cover such cases, Symfony provides a few sets of strategies. If those provided do not meet your needs, you can implement your custom strategy. For the moment, let us take a look at the strategy options provided by Symfony itself.

*   `affirmative` (default): This grants access as soon as there is just one voter giving access to the user.
*   `consensus`: This grants access if the number of voters granting access is higher than those denying it. If there are an equal number of votes, the result is governed by the `allow_if_equal_granted_denied` option, which defaults to `true`.
*   `unanimous`: This grants access only if no voter wants to deny access.
*   `priority`: This grants access based on the first voter granting or denying access and not abstaining.

The voters can be customized to suit the requirements of the application. Before we move to the next section, we need to familiarize ourselves with two important terms:

*   **Attribute**: This is different from [PHP Attributes](https://www.php.net/manual/en/language.attributes.overview.php) introduced in PHP 8. In Symfony’s voter applications, an attribute is a string value that defines the action to be performed. The voter can use the attribute to make a decision.
*   **Subject**: The subject is the resource on which the operation is performed.

Implementing Voters in Symfony
------------------------------

To fully understand the concept of voters, let’s implement a simple project in Symfony. The project consists of a few users and boards. Each user is provided the right to access or modify the board and their access depends on who they are. The following are the basic rules:

*   There is a board on which no user has access (orphaned but not deleted).
*   There is a board on which only the `Admin` has access.
*   There is a board on which only the `Admin` and `User 1` have access.
*   There is a board on which only the `Admin` and `User 1` have modification and read access. `User 2` has read-only access.

**The final voter project is available on** [**our GitHub.**](https://github.com/accesto/blogpost-voters)

### Step 1: Add Access Control

First, you’ll need to add access control in the `viewBoard` method. We do this by calling the `denyAccessUnlessGranted` method. The relevant snippet is provided below:

```
 #[Route(path: '/board/{id}', methods: Request::METHOD_GET)]
    public function viewBoard(Uuid $id): Response
    {
        if (null === $board = $this->boardRepository->findById($id)) {
            throw $this->createNotFoundException();
        }

        $this->denyAccessUnlessGranted(BoardAction::View->value, $board);

        return $this->render('secured/view_board.html.twig', [
            'board' => $board,
        ]);
 }
```

As you can see in the code snippet, the `$this->denyAccessUnlessGranted` call is made, which activates the voting system as mentioned in the previous section. It is important to note that, `$this->denyAccessUnlessGranted` can be replaced by `IsGranted` attribute or annotation as per your preference.

### Step 2: Create a `BoardVoter` class

To define our custom logic, you need to add a custom voter class. A voter class is a simple class that extends the `Voter` abstract base class. Let us look at the code below.

```
 use  Symfony\Component\Security\Core\Authorization\Voter\Voter;

 final class BoardVoter extends Voter
 {
    protected function supports(string $attribute, mixed $subject): bool
    {
        return $subject instanceof Board && in_array($attribute, BoardAction::values(), true);
    }

    
    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        

        $user = $token->getUser() ?? throw new UserNotFoundException();
        $permission = $this->getUserPermissionForBoard($subject, $user);

        if (null === $permission) {
            return false;
        }

        return match (BoardAction::from($attribute)) {
            BoardAction::View => true,
            BoardAction::Modify => $permission->canEdit(),
            BoardAction::Create => $permission->canManage(),
        };
    }

    private function getUserPermissionForBoard(Board $board, User $user): ?UserBoardPermission
    {
        foreach ($board->users as $boardUser) {
            if ($boardUser->userId->equals($user->id)) {
                return $boardUser->permission;
            }
        }

        return null;
    }
 }
```

The class definition for `BoardVoter` includes an implementation for two abstract methods namely `supports` and `voteOnAttribute`. Let’s examine each of these methods in detail.

*   `supports`: This method decides if the Voter class wants to vote on a given `$attribute` and `$subject`. This method call is triggered when `isGranted()` or `denyUnlessGranted()` is called. The first argument that you pass to this method, like `BoardAction::View` in this example, is the `$attribute` and the second parameter, if any, will be the `$subject`. If the method returns true, then the class will be asked to vote. If the method returns false, then it will be considered as abstaining from voting. It also means that there is another voter which will vote on this `$attribute, $subject` pair. In this case, the `BoardVoter` class will vote only if the attribute is one of the supported attributes in the `BoardAction` enum and the subject is an instance of the `Board`.
*   `voteOnAttribute`: This method decides if the given permission should be granted or denied. If the function returns true, then permission is granted; else, it is denied. In this case, first, it loads the user who is requesting the token and then the permissions of that user. If they don’t have the right permissions, the request is denied. But if the permissions are found, you check if the user has the right to modify and create a board (all users are allowed to view the board). The logic for this check is contained in the `UserBoardPermission` class.
    
    ```
     enum UserBoardPermission: string
    {
    			case Owner = 'owner';
    			case Member = 'member';
    			case Viewer = 'viewer';
    
    			public function canManage(): bool
    				{
        				return $this === self::Owner;
    				}
    
    			public function canEdit(): bool
    				{
        				return $this !== self::Viewer;
    				}
    }
    ```
    
    #### Demo Application in action
    
    Once you have cloned the repo and started the local server using the `symfony serve` command, you can log in as `User 1` using the username `user1@example.com` and the password `password`. Once logged in, navigate to the secured area, and you will see the following screen:
    

 [![](https://accesto.com/blog/static/efa9a496fe81a7914886221da66d1d83/508ef/symfony_voter_secured_area.png)](https://accesto.com/blog/static/efa9a496fe81a7914886221da66d1d83/508ef/symfony_voter_secured_area.png) 

Click `Admin + User 1 member`, which is the third item. You will see a screen with the `Modify board` action. Click the button, and then you will see a success message. Let us take a look at what happened. Click the debug bar at the bottom and navigate to the Security section on the left sidebar. Then, click the `Access Decision` tab. You will see a screen similar to the following.

 [![](https://accesto.com/blog/static/a0ff9cdb2b91939c71fc89d1231a33b0/01ab0/symfony_voter_profiler.jpg)](https://accesto.com/blog/static/a0ff9cdb2b91939c71fc89d1231a33b0/1d5ac/symfony_voter_profiler.jpg) 

You can see the access decision log and you will be able to see the decisions made by each voter. In this case, both the voters are granted access, and hence the user can access the resource. You can repeat the steps for each link to see why a decision was made.

Earlier in the article, I mentioned that typically only one voter is deciding on a given scenario. However, as shown in the example, there are two voters involved. You might wonder why, and the answer lies in the `security.yaml` file.

```
 access_control:
 { path: ^/secured, roles: ROLE_USER }
```

In the provided code snippet, you can see that access to the path `/secured` is controlled by an access control directive. This directive internally uses the voter system. The access to the URL was decided by one voter, while the request to modify that resource was processed by another.

#### Adding more complex business logic

One of the key things to remember is that a voter class is another PHP class managed by Symfony. You will get all the benefits provided by the Symfony framework inside the class.

For example, if you want to check the roles that the current user has, you can inject the `Symfony\Bundle\SecurityBundle\Security` class in the constructor and use it inside the class.

```
 use Symfony\Bundle\SecurityBundle\Security;

 final class BoardVoter extends Voter
 {
    protected function __construct(
        private Security $security
    ) {}

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
	
    }
 }
```

Testing and Troubleshooting
---------------------------

Like any other business logic, unit tests are critical to ensuring that the app works as intended. In the example above, you can find the test cases in the `tests/Security/Voter/BoardVoterTest.php` file. You can run the tests using the following command:

Like before, you can use the `Symfony Debug Toolbar` during development to debug the voting process. Using this approach, you will be able to visually identify which voter granted or denied access in the specific case.

Best Practices
--------------

Use voters only when necessary. It does not make sense to use a voter for something that can be achieved by simpler methods like RBAC. If you don't need to reuse the permissions, then avoiding the use of voters will result in a much simpler codebase.

If your application is large and extensively uses voters, always ensure that the voter class implements `CacheableVoterInterface`. This will ensure that the conditions are not re-evaluated unless it is necessary.

In addition to the above, you may also override the following two methods in your voter class to improve performance in a large application. The default implementation in the voter base class is provided below.

```
 public function supportsAttribute(string $attribute): bool
 {
	return true;
 }

 

 public function supportsType(string $subjectType): bool
 {
	return true;
 }
```

If you look closely, you’ll see that these are the same conditions that I have put in the `supports` method. Overriding these methods will enable you to implement more complex logic in your `supports` method if needed, while still achieving the same functionality.

In case you want to implement your [custom decision strategy](https://symfony.com/doc/current/security/voters.html#custom-access-decision-strategy) or [custom access decision manager](https://symfony.com/doc/current/security/voters.html#custom-access-decision-manager), refer to the Symfony documentation, which provides examples.

Conclusion
----------

Large applications with complex access control mechanisms need a solution that can adapt to the nature of the application. Symfony voters provide a simple, yet powerful API to implement such access control mechanisms.

Although it increases the number of custom classes that you need to create, it will help you achieve the level of dynamic access control that your application demands. In large applications with extensive access control rules, such additional complexity is often justified. Being able to unit test your voters using the same unit testing methods that Symfony uses can help you move quicker during the adoption of this feature in your codebase.

By leveraging Symfony's voter system, developers can manage complex access control scenarios with a clean and reusable approach. Sure, it adds some complexity to the codebase, but the benefits of having a flexible and powerful access control mechanism make voters a valuable tool for securing large applications.