FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notes</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
  <main>
    <h1>Notes</h1>
    <xo-view get="listNotes">
      <p xo-if="$loading">Loading…</p>
      <div xo-if="$error">
        <p role="alert">{$error.detail}</p>
        <button xo-refresh>Retry</button>
      </div>
      <ul xo-if="!$loading">
        <li xo-each=".">{text}</li>
      </ul>
    </xo-view>
  </main>
</body>
</html>
```
