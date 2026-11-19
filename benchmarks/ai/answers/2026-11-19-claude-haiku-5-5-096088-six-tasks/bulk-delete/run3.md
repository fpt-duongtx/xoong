FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tasks</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
</head>
<body class="xo-admin">
  <header>
    <h1>Tasks</h1>
  </header>

  <main>
    <xo-view get="listTasks" p-limit="10" p-offset="0">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>

      <table>
        <thead>
          <tr>
            <th><input type="checkbox" xo-select="all:items" aria-label="Select all tasks"></th>
            <th>Title</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td><input type="checkbox" xo-select aria-label="Select {title}"></td>
            <td>{title}</td>
            <td>
              <span xo-if="done">Done</span>
              <span xo-if="!done">Not done</span>
            </td>
          </tr>
        </tbody>
      </table>

      <button xo-click="POST /tasks/delete"
              xo-selected="ids"
              xo-confirm="Delete the selected tasks?"
              xo-notice="Deleted">Delete selected</button>

      <nav>
        <button xo-param="offset-=10" xo-if="$hasPrev">Previous</button>
        <button xo-param="offset+=10" xo-if="$hasNext">Next</button>
      </nav>
    </xo-view>
  </main>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```
