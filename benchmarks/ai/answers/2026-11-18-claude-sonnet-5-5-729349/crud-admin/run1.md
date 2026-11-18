FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <link rel="stylesheet" href="app.css">
  <script type="module" src="/src/main.ts"></script>
  <script type="module">import '@xoong/ui';</script>
</head>
<body class="xo-admin">
  <header><h1>Users</h1></header>
  <main>
    <section>
      <h2>Add a user</h2>
      <xo-form op="POST /users" submit="Add"></xo-form>
    </section>

    <section>
      <xo-view get="/users" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <xo-table columns="name,email,role,status" sortable page-size="25" empty="No users">
          <span slot="status" class="badge">{status}</span>
          <button xo-click="POST /users/{id}/disable" xo-notice="User disabled">Disable</button>
          <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-notice="User deleted">Delete</button>
        </xo-table>
      </xo-view>
    </section>
  </main>
  <xo-toast></xo-toast>
</body>
</html>
```
