FILE: index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tasks</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
  <main>
    <h1>Tasks</h1>

    <xo-view get="listTasks" p-limit="10" p-offset="0">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>

      <div>
        <button xo-click="POST /tasks/delete" xo-selected="ids" xo-notice="Deleted">Delete selected</button>
      </div>

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

      <nav>
        <button xo-if="$hasPrev" xo-param="offset-=10">Previous</button>
        <button xo-if="$hasNext" xo-param="offset+=10">Next</button>
      </nav>
    </xo-view>
  </main>
</body>
</html>
```
