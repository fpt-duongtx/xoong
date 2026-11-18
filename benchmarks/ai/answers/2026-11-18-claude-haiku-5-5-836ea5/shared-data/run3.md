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
  <header>
    <h1>Dashboard</h1>
  </header>

  <main>
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading">Orders</h2>
      <xo-view get="listOrders" live>
        <p xo-if="$loading">Loading orders…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr><th>ID</th><th>Total</th><th>Customer</th></tr>
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

    <section aria-labelledby="customers-heading">
      <h2 id="customers-heading">Customers</h2>
      <xo-view get="listCustomers" live>
        <p xo-if="$loading">Loading customers…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th></tr>
          </thead>
          <tbody>
            <tr xo-each=".">
              <td>{name}</td>
              <td>{email}</td>
            </tr>
          </tbody>
        </table>
      </xo-view>
    </section>
  </main>
</body>
</html>
```
