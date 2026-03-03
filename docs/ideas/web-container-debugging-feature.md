# Web Container Debugging Feature

How cool would it be if, from an application that uses WebContainer, we had a client side feature called `serverPlug` 

The `serverPlug` would `connect` to a remote server over an API endpoint, to register itself, with info about the url it is on, its container's uuid.  The server would respond with a websocket url and other necessary info.

On the server side `NodeContainer` there's server side `serverPlug` feature which can act as a host, that accepts registrations.  It spawns its own websocket server to handle communication.

From server side code, I can connect to any individual web container instance, and eval code inside its vm.

We need to think about auth, disconnection events, heartbeats, etc


