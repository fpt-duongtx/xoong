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
  <script type="module">
    import '@xoong/ui';
  </script>
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
  </header>

  <main>
    <section aria-labelledby="list-heading">
      <h2 id="list-heading">All users</h2>
      <xo-view get="/users" live>
        <xo-table columns="name:Name,email:E-mail,role:Role,status:Status" sortable empty="No users">
          <span slot="status" class="badge">{status}</span>
          <button xo-click="POST /users/{id}/disable">Disable</button>
          <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?">Delete</button>
        </xo-table>
      </xo-view>
    </section>

    <section aria-labelledby="add-heading">
      <h2 id="add-heading">Add a user</h2>
      <xo-view>
        <form xo-submit="POST /users">
          <label>Name <input name="name" required></label>
          <label>E-mail <input name="email" type="email" required></label>
          <label>Role <input name="role" required></label>
          <button type="submit">Add user</button>
        </form>
      </xo-view>
    </section>
  </main>
</body>
</html>
```
