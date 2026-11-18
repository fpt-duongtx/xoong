FILE: index.html
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog</title>
  <script type="module">
    import { configure } from '@xoong/data';
    import '@xoong/data/view';
    import operations from '/.xoong/operations.json' with { type: 'json' };
    configure({ api: operations, baseUrl: '/api' });
  </script>
</head>
<body>
  <main>
    <h1>Blog</h1>
    <xo-view get="listPosts">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <article xo-each="items">
        <h2><a href="post.html?id={id}">{title}</a></h2>
        <p>{author}</p>
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
  <script type="module">
    import { configure } from '@xoong/data';
    import '@xoong/data/view';
    import operations from '/.xoong/operations.json' with { type: 'json' };
    configure({ api: operations, baseUrl: '/api' });
  </script>
</head>
<body>
  <main>
    <p><a href="index.html">Back to posts</a></p>
    <xo-view get="getPost" p-id="?id">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error">{$error.code}: {$error.detail}</p>
      <h1>{title}</h1>
      <div>{body}</div>
    </xo-view>
  </main>
</body>
</html>
```
