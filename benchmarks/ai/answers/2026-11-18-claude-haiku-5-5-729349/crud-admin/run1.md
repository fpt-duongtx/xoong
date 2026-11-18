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
  <header>
    <h1>Users</h1>
  </header>

  <main>
    <section>
      <h2>Add a user</h2>
      <xo-view>
        <form xo-submit="createUser" class="add-user">
          <label>Name <input name="name" required></label>
          <label>Email <input name="email" type="email" required></label>
          <label>Role <input name="role" required></label>
          <button type="submit">Add user</button>
        </form>
      </xo-view>
    </section>

    <section>
      <h2>All users</h2>
      <xo-view get="listUsers" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr xo-each="items">
              <td>{name}</td>
              <td>{email}</td>
              <td>{role}</td>
              <td><span class="badge">{status}</span></td>
              <td class="actions">
                <button xo-click="POST /users/{id}/disable">Disable</button>
                <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </xo-view>
    </section>
  </main>
</body>
</html>
```

FILE: app.css
```css
@layer app {
  :root {
    --gap: 12px;
    --line: #ddd;
  }

  body.xo-admin main {
    padding: 16px;
    display: grid;
    gap: 24px;
  }

  .add-user {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    align-items: end;
  }

  .add-user label {
    display: grid;
    gap: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: 8px;
    border-bottom: 1px solid var(--line);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: #eef;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 40rem) {
    table {
      display: block;
      overflow-x: auto;
    }
  }
}
```
