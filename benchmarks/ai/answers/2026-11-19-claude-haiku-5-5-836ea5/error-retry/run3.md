FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notes</title>
</head>
<body>
  <main>
    <h1>Notes</h1>
    <xo-view get="listNotes">
      <p xo-if="$loading">Loading…</p>
      <div xo-if="$error" role="alert">
        <p>{$error.detail}</p>
        <button xo-refresh>Retry</button>
      </div>
      <ul>
        <li xo-each=".">{text}</li>
      </ul>
    </xo-view>
  </main>
</body>
</html>
```
