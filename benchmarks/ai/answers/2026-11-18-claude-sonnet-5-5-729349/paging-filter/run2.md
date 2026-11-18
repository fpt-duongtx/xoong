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
  <xo-view get="listArticles" p-limit="5" p-offset="0" url-params="status,offset">
    <div>
      <button xo-param="status=draft">Draft</button>
      <button xo-param="status=published">Published</button>
    </div>
    <p xo-if="$loading">Loading…</p>
    <p xo-if="$error">{$error.code}: {$error.detail}</p>
    <ul>
      <li xo-each="items">{title}</li>
    </ul>
    <div>
      <button xo-param="offset-=5" hidden="{!$hasPrev}">Previous</button>
      <button xo-param="offset+=5" hidden="{!$hasNext}">Next</button>
    </div>
  </xo-view>
</body>
</html>
```
