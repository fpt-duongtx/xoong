FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users admin</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <link rel="stylesheet" href="app.css">
  <script type="module">
    import { configure } from '@xoong/data';
    import '@xoong/data/view';
    import '@xoong/ui';
    import operations from '/.xoong/operations.json' with { type: 'json' };
    configure({ api: operations, baseUrl: '/api' });
  </script>
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
    <button xo-open="#add">Add user</button>
  </header>
  <main>
    <xo-view get="listUsers">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <xo-table columns="name,email:E-mail,role:Role,status:Status" empty="No users">
        <button xo-click="POST /users/{id}/disable" xo-notice="User disabled">Disable</button>
        <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-notice="User deleted">Delete</button>
      </xo-table>
    </xo-view>

    <xo-dialog id="add" heading="Add user" dismiss>
      <xo-form op="POST /users" submit="Add"></xo-form>
      <button slot="footer" xo-close>Cancel</button>
    </xo-dialog>
  </main>
  <xo-toast></xo-toast>
</body>
</html>
```
