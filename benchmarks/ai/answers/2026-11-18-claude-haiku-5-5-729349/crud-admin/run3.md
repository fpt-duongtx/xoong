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
  <script type="module">
    import '@xoong/ui';
  </script>
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
  </header>

  <main>
    <section>
      <xo-view get="listUsers" live>
        <xo-table columns="name:Name,email:E-mail,role:Role,status:Status" sortable filters="name:Search" page-size="25" empty="No users">
          <span slot="status" class="badge">{status}</span>
          <button xo-click="POST /users/{id}/disable" xo-optimistic="status=disabled">Disable</button>
          <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger">Delete</button>
        </xo-table>
      </xo-view>
    </section>

    <section>
      <h2>Add user</h2>
      <xo-form op="POST /users" submit="Add"></xo-form>
    </section>
  </main>
</body>
</html>
```
