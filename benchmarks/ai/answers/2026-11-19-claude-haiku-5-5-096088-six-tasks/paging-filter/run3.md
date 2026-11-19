FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Articles</title>
</head>
<body>
  <h1>Articles</h1>

  <xo-view get="listArticles" p-limit="5" p-offset="0">
    <nav>
      <button xo-param="status=draft">Draft</button>
      <button xo-param="status=published">Published</button>
    </nav>

    <p xo-if="$loading">Loading…</p>
    <p xo-if="$error">{$error.code}: {$error.detail}</p>

    <ul>
      <li xo-each="items">{title}</li>
    </ul>

    <button xo-if="$hasPrev" xo-param="offset-=5">Previous</button>
    <button xo-if="$hasNext" xo-param="offset+=5">Next</button>
  </xo-view>
</body>
</html>
```
