FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Articles</title>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
<main>
  <h1>Articles</h1>
  <xo-view get="/articles" p-limit="5" p-offset="0" url-params="status,offset">
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
      <button type="button" xo-if="$hasPrev" xo-param="offset-=5">Previous</button>
      <button type="button" xo-if="$hasNext" xo-param="offset+=5">Next</button>
    </nav>
  </xo-view>
</main>
</body>
</html>
```
