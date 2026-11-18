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
    configure({ api: operations, baseUrl: '/api', streamUrl: '/api/events' });
  </script>
</head>
<body>
  <h1>Blog</h1>
  <xo-view get="listPosts">
    <p xo-if="$loading">Loading…</p>
    <p xo-if="$error">{$error.code}: {$error.detail}</p>
    <ul>
      <li xo-each=".">
        <a href="post.html?id={id}">{title}</a> by {author}
      </li>
    </ul>
  </xo-view>
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
    configure({ api: operations, baseUrl: '/api', streamUrl: '/api/events' });
  </script>
</head>
<body>
  <p><a href="index.html">All posts</a></p>
  <xo-view get="getPost" p-id="?id">
    <p xo-if="$loading">Loading…</p>
    <p xo-if="$error">{$error.code}: {$error.detail}</p>
    <article>
      <h1>{title}</h1>
      <p>{body}</p>
    </article>
  </xo-view>
</body>
</html>
```
