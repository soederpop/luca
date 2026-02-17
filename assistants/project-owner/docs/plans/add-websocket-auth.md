---
status: pending
---

# Add WebSocket Authentication

## Summary

Add token-based authentication to the WebSocket server so that only authorized clients can establish connections. This involves validating JWT tokens during the upgrade handshake and rejecting unauthorized requests before the socket is opened.

## Steps

- [ ] Add a `verifyToken` utility in `src/node/utils/auth.ts`
- [ ] Modify the WebSocket server's `upgrade` handler to extract and validate the token
- [ ] Return 401 on invalid or missing tokens before completing the upgrade
- [ ] Add unit tests for token validation
- [ ] Add integration test for authenticated WebSocket connections

## Test plan

- [ ] Verify connections with valid tokens are accepted
- [ ] Verify connections with expired tokens are rejected with 401
- [ ] Verify connections with no token are rejected with 401
- [ ] Verify existing unauthenticated endpoints still work

## References

- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc7519)
- [WebSocket Protocol RFC](https://datatracker.ietf.org/doc/html/rfc6455)
- See `src/node/servers/websocket.ts` for current implementation
