FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tasks</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module">
    import { configure } from '@xoong/data';
    import '@xoong/data/view';
    import '@xoong/ui';
    import operations from '/.xoong/operations.json' with { type: 'json' };
    configure({ api: operations, baseUrl: '/api' });
  </script>
</head>
<body class="xo-admin">
  <header><h1>Tasks</h1></header>
  <main>
    <xo-view get="listTasks">
      <xo-table columns="title:Title,done:Done" selectable page-size="10" empty="No tasks">
        <button slot="bulk" xo-click="deleteTasks" xo-selected="ids">Delete selected</button>
      </xo-table>
    </xo-view>
    <xo-toast></xo-toast>
  </main>
</body>
</html>
```
