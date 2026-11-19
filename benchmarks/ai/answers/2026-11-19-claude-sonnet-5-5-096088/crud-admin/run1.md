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
  <script type="module">import '@xoong/ui';</script>
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
        <xo-table columns="name,email,role,status" empty="No users">
          <button xo-click="POST /users/{id}/disable" xo-confirm="Disable {name}?" xo-notice="User disabled">Disable</button>
          <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger" xo-notice="User deleted">Delete</button>
        </xo-table>
      </xo-view>
    </section>
  </main>
  <xo-toast></xo-toast>
</body>
</html>
```
