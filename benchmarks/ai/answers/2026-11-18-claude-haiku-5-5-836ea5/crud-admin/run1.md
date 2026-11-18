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
  <script type="module">import '@xoong/ui';</script>
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
  </header>
  <main>
    <section>
      <h2>Add a user</h2>
      <xo-view>
        <xo-form op="POST /users" submit="Add user"></xo-form>
      </xo-view>
    </section>

    <section>
      <h2>All users</h2>
      <xo-view get="/users" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
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
                <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?">Delete</button>
              </td>
            </tr>
            <tr xo-if="!items">
              <td colspan="5">No users</td>
            </tr>
          </tbody>
        </table>
      </xo-view>
    </section>
  </main>
</body>
</html>
```
