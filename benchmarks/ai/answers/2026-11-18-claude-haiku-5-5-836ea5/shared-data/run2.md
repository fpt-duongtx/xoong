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
      <!-- Both lists read the same Customer entity (xoong.hints.json "entity"), so a name change
           shows in the orders list and the customers list alike; `live` applies stream updates. -->
      <xo-view get="listOrders" live>
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr><th scope="col">Order</th><th scope="col">Total</th><th scope="col">Customer</th></tr>
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
        <p xo-if="$loading">Loading…</p>
        <p xo-if="$error">{$error.code}: {$error.detail}</p>
        <table>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Email</th></tr>
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
