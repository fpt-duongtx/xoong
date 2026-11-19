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
</head>
<body class="xo-admin">
  <header>
    <h1>Users</h1>
  </header>
  <nav>
    <a href="/">Users</a>
  </nav>
  <main>
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
            <th><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td>{name}</td>
            <td>{email}</td>
            <td>{role}</td>
            <td>{status}</td>
            <td class="actions">
              <button xo-click="POST /users/{id}/disable" xo-notice="User disabled">Disable</button>
              <button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-notice="User deleted">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </xo-view>

    <section>
      <h2>Add user</h2>
      <xo-view>
        <form xo-submit="createUser" xo-notice="User added">
          <label>Name <input name="name" required></label>
          <label>Email <input name="email" type="email" required></label>
          <label>Role <input name="role" required></label>
          <button type="submit">Add</button>
        </form>
      </xo-view>
    </section>
  </main>
</body>
</html>
```

FILE: app.css
```css
:root {
  --gap: 12px;
  --border: #d0d7de;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1f2328;
  background: #ffffff;
}

header,
nav,
main {
  padding: var(--gap) 16px;
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
}

nav a {
  margin-right: var(--gap);
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}

th,
td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid var(--border);
}

.actions {
  white-space: nowrap;
}

.actions button {
  margin-right: 8px;
}

section form {
  display: grid;
  gap: var(--gap);
  max-width: 420px;
}

label {
  display: grid;
  gap: 4px;
}

input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

button {
  justify-self: start;
  padding: 6px 12px;
  border-radius: 6px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```
