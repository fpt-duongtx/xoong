FILE: index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users</title>
</head>
<body>
  <h1>Users</h1>

  <xo-view get="/users" live>
    <p xo-if="$loading">Loading…</p>
    <p xo-if="$error">{$error.code}: {$error.detail}</p>

    <table>
      <thead>
        <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
      </thead>
      <tbody>
        <tr xo-each="items">
          <td>{name}</td>
          <td>{email}</td>
          <td>{role}</td>
          <td><button xo-click="POST /users/{id}/disable" aria-label="Disable {name}">Disable</button></td>
        </tr>
      </tbody>
    </table>
  </xo-view>
</body>
</html>
```
