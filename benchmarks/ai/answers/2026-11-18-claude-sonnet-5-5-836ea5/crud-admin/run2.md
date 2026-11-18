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
  <header>
    <h1>Users</h1>
    <button xo-open="#add">Add user</button>
  </header>

  <main>
    <xo-view get="listUsers" live>
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>

      <xo-table columns="name,email,role,status" sortable empty="No users">
        <span slot="status" class="badge">{status}</span>
        <button xo-click="POST /users/{id}/disable" xo-notice="User disabled">Disable</button>
        <button xo-click="DELETE /users/{id}"
                xo-confirm="Delete {name}?"
                xo-confirm-kind="danger"
                xo-notice="User deleted">Delete</button>
      </xo-table>
    </xo-view>

    <xo-dialog id="add" heading="Add user">
      <xo-view>
        <xo-form op="createUser" submit="Add" xo-notice="User added"></xo-form>
      </xo-view>
      <button slot="footer" xo-close>Cancel</button>
    </xo-dialog>
  </main>

  <xo-toast></xo-toast>
</body>
</html>
```
