FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    article { padding: 1rem 0; border-bottom: 1px solid #ddd; }
    h2 { margin: 0 0 0.25rem; font-size: 1.25rem; }
    h2 a { color: inherit; }
    .author { margin: 0; color: #666; }
  </style>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <main>
    <h1>Blog</h1>
    <xo-view get="listPosts">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <article xo-each="items">
        <h2><a href="post.html?id={id}">{title}</a></h2>
        <p class="author">{author}</p>
      </article>
    </xo-view>
  </main>
</body>
</html>
```

FILE: post.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Post</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    .body { white-space: pre-line; }
  </style>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <main>
    <p><a href="index.html">All posts</a></p>
    <xo-view get="getPost" p-id="?id">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <article>
        <h1>{title}</h1>
        <div class="body">{body}</div>
      </article>
    </xo-view>
  </main>
</body>
</html>
```
