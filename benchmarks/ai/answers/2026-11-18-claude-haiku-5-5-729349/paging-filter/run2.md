FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Articles</title>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <main>
    <h1>Articles</h1>
    <xo-view get="listArticles" p-limit="5" p-offset="0">
      <nav>
        <button type="button" xo-param="status=draft">Draft</button>
        <button type="button" xo-param="status=published">Published</button>
      </nav>

      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>

      <ul>
        <li xo-each="items">{title}</li>
      </ul>

      <nav>
        <button type="button" xo-param="offset-=5" xo-if="$hasPrev">Previous</button>
        <button type="button" xo-param="offset+=5" xo-if="$hasNext">Next</button>
      </nav>
    </xo-view>
  </main>
</body>
</html>
```
