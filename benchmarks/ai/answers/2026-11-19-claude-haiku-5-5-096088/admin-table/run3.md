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
</head>
<body class="xo-admin">
  <header>
    <h1>Staff</h1>
  </header>
  <main>
    <xo-view get="/staff" live>
      <xo-table columns="name:Name,email:Email,role:Role" sortable filters="name:Search" page-size="10" empty="No staff"></xo-table>
    </xo-view>

    <button xo-open="#add">Add staff</button>

    <xo-dialog id="add" heading="Add staff" dismiss>
      <xo-view>
        <xo-form op="createStaff" submit="Add"></xo-form>
      </xo-view>
      <button slot="footer" xo-close>Cancel</button>
    </xo-dialog>
  </main>
</body>
</html>
```
