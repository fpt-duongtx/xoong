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
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
  </header>
  <nav>
    <a href="index.html" aria-current="page">Users</a>
  </nav>
  <main>
    <section class="users">
      <h2>All users</h2>
      <xo-view get="listUsers" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>
        <xo-table columns="name:Name,email:Email,role:Role,status:Status" sortable empty="No users">
          <span slot="status" class="badge">{status}</span>
          <button xo-click="POST /users/{id}/disable">Disable</button>
          <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?">Delete</button>
        </xo-table>
      </xo-view>
    </section>
    <section class="add">
      <h2>Add a user</h2>
      <xo-view>
        <xo-form op="POST /users" submit="Add"></xo-form>
      </xo-view>
    </section>
  </main>
  <script type="module">import '@xoong/ui';</script>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

FILE: app.css
```css
@layer app {
  :root {
    --gap: 16px;
    --muted: #666;
  }

  body.xo-admin {
    margin: 0;
    font-family: system-ui, sans-serif;
  }

  body.xo-admin header,
  body.xo-admin nav,
  body.xo-admin main {
    padding-inline: var(--gap);
  }

  body.xo-admin main {
    display: grid;
    gap: calc(var(--gap) * 2);
    padding-block: var(--gap);
  }

  .users h2,
  .add h2 {
    color: var(--muted);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: #eee;
    font-size: 0.85rem;
  }
}
```
