FILE: edit.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edit article</title>
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <script type="module" src="/src/main.ts"></script>
</head>
<body class="xo-admin">
  <main>
    <h1>Edit article</h1>
    <xo-view get="getArticle" p-id="?id">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <xo-view>
        <form xo-submit="updateArticle" xo-notice="Saved">
          <label>Title <input name="title"></label>
          <label>Body <textarea name="body"></textarea></label>
          <button type="submit">Save</button>
        </form>
      </xo-view>
    </xo-view>
  </main>
</body>
</html>
```
