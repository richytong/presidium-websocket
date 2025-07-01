# Contributing

## Steps to release

1. Bump the repo version

```
npm version patch|minor|major
```

2. Manually update the license versions and year in `index.js`, `WebSocket.js`, `WebSocketServer.js`, and `WebSocketSecureServer.js`.

# commit the changes
git commit -m "dist"

# publish the new version
npm publish
```
