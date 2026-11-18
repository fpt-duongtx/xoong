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
      <xo-form op="POST /users" submit="Add"></xo-form>
    </section>

    <section>
      <h2>All users</h2>
      <xo-view get="/users" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>
        <div class="table-wrap">
          <table class="users">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr xo-each="items">
                <td>{name}</td>
                <td>{email}</td>
                <td>{role}</td>
                <td>{status}</td>
                <td class="actions">
                  <button type="button" xo-click="POST /users/{id}/disable" xo-optimistic="status=disabled">Disable</button>
                  <button type="button" xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger" xo-notice="User deleted">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </xo-view>
    </section>
  </main>
</body>
</html>
```

FILE: app.css
```css
@layer base, page;

@layer base {
  :root {
    color-scheme: light dark;
    --gap: 1rem;
    --border: color-mix(in srgb, currentColor 20%, transparent);
  }

  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }

  header {
    padding: var(--gap);
    border-bottom: 1px solid var(--border);
  }

  header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}

@layer page {
  main {
    display: grid;
    gap: calc(var(--gap) * 2);
    padding: var(--gap);
    max-width: 64rem;
    margin-inline: auto;
  }

  .table-wrap {
    overflow-x: auto;
  }

  .users {
    width: 100%;
    border-collapse: collapse;
  }

  .users th,
  .users td {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  .actions {
    white-space: nowrap;
  }

  .actions button + button {
    margin-inline-start: 0.5rem;
  }
}
```
