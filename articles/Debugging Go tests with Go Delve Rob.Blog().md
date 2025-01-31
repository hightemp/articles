# Debugging Go tests with Go Delve | Rob.Blog()
Visual debugging is a huge boost to productivity. The Go Delve debugger provies a nice command line interface for this, and integrates nicely with VS Code integration.

I have recently been working on the external-dns K8s SIG project, and found the debugging experience very useful when writing tests.

[](#Getting-started "Getting started")Getting started
-----------------------------------------------------

Install Go Delve following the [instructions on GitHub](https://github.com/go-delve/delve/blob/master/Documentation/installation/linux/install.md) (this is a simple `go get` command).

[](#Debugging-tests "Debugging tests")Debugging tests
-----------------------------------------------------

My recent example was debugging the cloudflare provider in external-dns. To start debugging, it’s as simple as running this command:

```bash
dlv test sigs.k8s.io/external-dns/provider/cloudflare
```

This will cause the debugger to:

*   Build the application in a way suitable for debugging
*   Attach the debugger to the running program

If you need to debug the application itself (say from the root directory that contains the main package), you can run `dlv debug`.

[](#Setting-breakpoints "Setting breakpoints")Setting breakpoints
-----------------------------------------------------------------

At this point, we are debugging the tests. We are able to give CLI subcommands directly to the delve debugger.

To debug a specific test, we need to set a breakpoint on that test function.

First, we can discover our test functions with the following command:

```go
(dlv) funcs.Cloudflare.Test*
```

This provides a list of tests like so:

```plaintext
sigs.k8s.io/external-dns/provider/cloudflare.TestCloudFlareZonesWithIDFilter
sigs.k8s.io/external-dns/provider/cloudflare.TestCloudflareA
sigs.k8s.io/external-dns/provider/cloudflare.TestCloudflareApplyChanges
sigs.k8s.io/external-dns/provider/cloudflare.TestCloudflareApplyChangesUpsertOnly
sigs.k8s.io/external-dns/provider/cloudflare.TestCloudflareCname
sigs.k8s.io/external-dns/provider/cloudflare.TestCloudflareComplexUpdate
...
```

We can then set a breakpoint on a specific test:

```bash
(dlv) break TestCloudflareComplexUpdate
```

We can then run `continue`, and the debugger will jump to that breakpoint:

```go
  1106:
=>1107: func TestCloudflareComplexUpdate(t *testing.T) {
  1108:         client := NewMockCloudFlareClientWithRecords(map[string][]cloudflare.DNSRecord{
```

If you have a specific source code line you would like to set a breakpoint on, you can set it like so:

```bash
(dlv) break mybreakpoint cloudflare_test.go:1145
```

[](#Inspecting-locals "Inspecting locals")Inspecting locals
-----------------------------------------------------------

To print all local variables:

```bash
(dlv) locals
```

To print a specific local, you can use the `print (p)` command:

```bash
p planned
```

[](#Navigating-through-the-code "Navigating through the code")Navigating through the code
-----------------------------------------------------------------------------------------

The following commands are useful:

*   `next` - steps over to the next source code line (this won’t step into functions)
*   `step` - single step to the next line of code to be run (this will step into functions)
*   `continue` - runs to the next breakpoint (or program termination)
*   `stepout` - steps out of the current function

[](#There’s-a-lot-more "There’s a lot more")There’s a lot more
--------------------------------------------------------------

You can run the `help` subcommand to discover the full list of supported operations. The commands I’ve mentioned here are only the basics.

[](#VS-Code-integration "VS Code integration")VS Code integration
-----------------------------------------------------------------

An even more visual experience is possible using the [Go extension for VS Code](https://code.visualstudio.com/docs/languages/go), which integrates with the Delve debugger.

I had to set my `.vscode/launch.json` like this (with program pointing to the directory that contains the tests I’m intersted in):

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch test package",
            "type": "go",
            "request": "launch",
            "mode": "test",
            "program": "${workspaceFolder}/provider/cloudflare"
        }
    ]
}
```

I was then able to set a breakpoint and hit the play button in the debug extension in the side menu.

It’s a nice experience - you can see the breakpoint being hit and inspect locals by hovering over them:

[![](https://blog.rob.uk.com/2021/02/14/Debugging-Go-tests-with-Go-Delve/visual-debugging-golang-delve-vscode.png)
](https://blog.rob.uk.com/2021/02/14/Debugging-Go-tests-with-Go-Delve/visual-debugging-golang-delve-vscode.png "Screenshot of visual debugging in VS Code")Screenshot of visual debugging in VS Code

For more information, have a look at [Delve](https://github.com/go-delve/delve) on GitHub.