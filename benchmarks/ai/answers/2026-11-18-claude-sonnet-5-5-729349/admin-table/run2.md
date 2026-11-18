FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Staff</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module" src="/src/main.ts"></script>
  <script type="module">import '@xoong/ui';</script>
</head>
<body class="xo-admin">
  <header>
    <h1>Staff</h1>
  </header>
  <main>
    <button xo-open="#add">Add staff</button>

    <xo-view get="listStaff" live>
      <xo-table columns="name,email,role" sortable filters="name:Search" page-size="10" empty="No staff"></xo-table>
    </xo-view>

    <xo-dialog id="add" heading="Add staff">
      <xo-form op="createStaff" submit="Add staff" xo-notice="Staff added"></xo-form>
      <button slot="footer" xo-close>Cancel</button>
    </xo-dialog>

    <xo-toast></xo-toast>
  </main>
</body>
</html>
```
