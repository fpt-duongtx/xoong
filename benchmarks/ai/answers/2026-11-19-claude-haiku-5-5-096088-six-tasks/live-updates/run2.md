FILE: index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; color: #1d1d1f; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #ddd; }
    th { font-weight: 600; }
    button { font: inherit; padding: 4px 10px; cursor: pointer; }
  </style>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <h1>Users</h1>

  <xo-view get="/users" live>
    <p xo-if="$loading">Loading...</p>
    <p xo-if="$error">{$error.code}: {$error.detail}</p>

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr xo-each="items">
          <td>{name}</td>
          <td>{email}</td>
          <td>{role}</td>
          <td>
            <button xo-click="POST /users/{id}/disable">Disable</button>
          </td>
        </tr>
      </tbody>
    </table>
  </xo-view>
</body>
</html>
```
