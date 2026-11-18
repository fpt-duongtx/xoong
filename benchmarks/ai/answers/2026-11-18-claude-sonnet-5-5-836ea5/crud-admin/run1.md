FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <link rel="stylesheet" href="/app.css">
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
  <header><h1>Users</h1></header>
  <main>
    <section>
      <h2>Add a user</h2>
      <xo-view>
        <xo-form op="createUser" submit="Add" xo-notice="User added"></xo-form>
      </xo-view>
    </section>

    <section>
      <h2>All users</h2>
      <xo-view get="listUsers" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr xo-each="items">
              <td>{name}</td>
              <td>{email}</td>
              <td>{role}</td>
              <td>{status}</td>
              <td>
                <button xo-click="disableUser" xo-optimistic="status=disabled" xo-notice="User disabled">Disable</button>
                <button xo-click="deleteUser" xo-confirm="Delete {name}?" xo-notice="User deleted">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </xo-view>
    </section>
  </main>
  <xo-toast></xo-toast>
</body>
</html>
```
