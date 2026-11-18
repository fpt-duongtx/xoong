FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    section { margin-block-end: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: start; padding: 0.4rem 0.6rem; border-block-end: 1px solid #ddd; }
  </style>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <h1>Dashboard</h1>

  <section>
    <h2>Orders</h2>
    <xo-view get="listOrders" live>
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <table>
        <thead>
          <tr><th>Id</th><th>Total</th><th>Customer</th></tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td>{id}</td>
            <td>{total}</td>
            <td>{customer.name}</td>
          </tr>
        </tbody>
      </table>
    </xo-view>
  </section>

  <section>
    <h2>Customers</h2>
    <xo-view get="listCustomers" live>
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th></tr>
        </thead>
        <tbody>
          <tr xo-each="items">
            <td>{name}</td>
            <td>{email}</td>
          </tr>
        </tbody>
      </table>
    </xo-view>
  </section>
</body>
</html>
```
