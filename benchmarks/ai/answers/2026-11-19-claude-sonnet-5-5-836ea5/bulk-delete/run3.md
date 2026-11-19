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
    <xo-view get="listTasks">
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <xo-table columns="title:Title,done:Done" selectable page-size="10" empty="No tasks">
        <button slot="bulk" xo-click="POST /tasks/delete" xo-selected="ids" xo-confirm="Delete the selected tasks?" xo-notice="Deleted">Delete selected</button>
      </xo-table>
    </xo-view>
    <xo-toast></xo-toast>
  </main>
</body>
</html>
```
