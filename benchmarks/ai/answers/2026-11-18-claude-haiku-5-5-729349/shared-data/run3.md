FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
  <header><h1>Dashboard</h1></header>
  <main>
    <section>
      <h2>Orders</h2>
      <xo-view get="listOrders" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr><th scope="col">ID</th><th scope="col">Customer</th><th scope="col">Total</th></tr>
          </thead>
          <tbody>
            <tr xo-each="items"><td>{id}</td><td>{customer.name}</td><td>{total | number}</td></tr>
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
            <tr><th scope="col">Name</th><th scope="col">Email</th></tr>
          </thead>
          <tbody>
            <tr xo-each="items"><td>{name}</td><td>{email}</td></tr>
          </tbody>
        </table>
      </xo-view>
    </section>
  </main>
</body>
</html>
```
