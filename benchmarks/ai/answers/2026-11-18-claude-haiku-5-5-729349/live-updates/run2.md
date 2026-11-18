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
</head>
<body class="xo-admin">
  <main>
    <h1>Users</h1>

    <xo-view get="/users" live>
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col"><span>Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td>{name}</td>
            <td>{email}</td>
            <td>{role}</td>
            <td>{status}</td>
            <td>
              <button xo-click="POST /users/{id}/disable" xo-optimistic="status=disabled">Disable</button>
            </td>
          </tr>
        </tbody>
      </table>
    </xo-view>
  </main>
</body>
</html>
```
