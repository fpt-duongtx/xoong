FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Staff</title>
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
  <header>
    <h1>Staff</h1>
    <button xo-open="#add">Add staff</button>
  </header>
  <main>
    <xo-view get="listStaff">
      <xo-table columns="name,email,role" sortable filters="name:Search" page-size="10" empty="No staff"></xo-table>
    </xo-view>

    <xo-dialog id="add" heading="Add staff" dismiss>
      <xo-view>
        <xo-form op="createStaff" submit="Add"></xo-form>
      </xo-view>
      <button slot="footer" xo-close>Cancel</button>
    </xo-dialog>
  </main>
  <xo-toast></xo-toast>
</body>
</html>
```
