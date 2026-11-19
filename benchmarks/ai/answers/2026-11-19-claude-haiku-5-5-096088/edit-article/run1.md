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
    <h1>Edit article</h1>

    <xo-view get="getArticle" p-id="?id">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>

      <form xo-submit="updateArticle">
        <label>
          Title
          <input name="title" required>
        </label>
        <label>
          Body
          <textarea name="body" required></textarea>
        </label>
        <button xo-notice="Saved">Save</button>
      </form>
    </xo-view>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```
