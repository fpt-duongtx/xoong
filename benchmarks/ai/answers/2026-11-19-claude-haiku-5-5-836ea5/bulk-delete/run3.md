FILE: index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tasks</title>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <main>
    <h1>Tasks</h1>

    <xo-view get="listTasks" p-limit="10" p-offset="0" live>
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
              <span xo-if="done">Yes</span>
              <span xo-if="!done">No</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        <button type="button" xo-click="POST /tasks/delete" xo-selected="ids" xo-confirm="Delete the selected tasks?" xo-notice="Deleted" xo-refresh>Delete selected</button>
      </p>

      <nav aria-label="Pages">
        <button type="button" xo-param="offset-=10" xo-if="$hasPrev">Previous</button>
        <button type="button" xo-param="offset+=10" xo-if="$hasNext">Next</button>
      </nav>
    </xo-view>
  </main>
</body>
</html>
```
