FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module" src="/src/main.ts"></script>
  <script type="module">import '@xoong/ui';</script>
</head>
<body class="xo-admin">
  <header><h1>Users</h1></header>
  <main>
    <xo-view get="listUsers" live>
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td>{name}</td>
            <td>{email}</td>
            <td>{role}</td>
            <td>{status}</td>
            <td><button xo-click="disableUser" xo-optimistic="status=disabled">Disable</button></td>
          </tr>
        </tbody>
      </table>
    </xo-view>
  </main>
</body>
</html>
```
