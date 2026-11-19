FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog</title>
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <header><h1>Blog</h1></header>
  <main>
    <xo-view get="/posts">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <ul>
        <li xo-each=".">
          <a href="post.html?id={id}">{title}</a> <span>{author}</span>
        </li>
      </ul>
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
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <header><a href="index.html">Blog</a></header>
  <main>
    <xo-view get="/posts/{id}" p-id="?id">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <article>
        <h1>{title}</h1>
        <div>{body}</div>
      </article>
    </xo-view>
  </main>
</body>
</html>
```
