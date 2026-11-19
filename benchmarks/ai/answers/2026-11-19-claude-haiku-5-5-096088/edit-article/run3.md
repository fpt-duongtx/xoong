FILE: edit.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edit article</title>
</head>
<body>
  <main>
    <xo-view get="getArticle" p-id="?id">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>

      <h1>{title}</h1>

      <form xo-submit="updateArticle">
        <label>Title <input name="title" required></label>
        <label>Body <textarea name="body" rows="12" required></textarea></label>
        <button type="submit">Save</button>
      </form>
    </xo-view>
  </main>
</body>
</html>
```
