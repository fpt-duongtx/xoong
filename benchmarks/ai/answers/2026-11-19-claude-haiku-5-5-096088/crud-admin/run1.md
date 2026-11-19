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
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
  </header>

  <main>
    <section class="add-user">
      <xo-view>
        <form xo-submit="createUser">
          <h2>Add user</h2>
          <label>Name <input name="name" autocomplete="off"></label>
          <label>Email <input name="email" type="email" autocomplete="off"></label>
          <label>Role <input name="role" autocomplete="off"></label>
          <button type="submit">Add user</button>
        </form>
      </xo-view>
    </section>

    <xo-view get="listUsers" live>
      <p xo-if="$loading">Loading...</p>
      <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>

      <table class="users">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td>{name}</td>
            <td>{email}</td>
            <td>{role}</td>
            <td><span class="badge">{status}</span></td>
            <td class="actions">
              <button type="button" xo-click="POST /users/{id}/disable" xo-notice="User disabled">Disable</button>
              <button type="button" xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger" xo-notice="User deleted">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </xo-view>
  </main>

  <xo-toast></xo-toast>

  <script type="module">
    import '@xoong/data/view';
    import '@xoong/ui';
    import { configure } from '@xoong/data';
    import operations from '/.xoong/operations.json' with { type: 'json' };
    configure({ api: operations, baseUrl: '/api', streamUrl: '/api/events' });
  </script>
</body>
</html>
```
