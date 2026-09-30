<?php
$stages = [
  1 => ['title' => 'Stage 1 - 基本 UNION', 'param' => 'id', 'hint' => '3カラムのエコーあり。UNION でテーブル st1_secret の flag を抜く。'],
  2 => ['title' => 'Stage 2 - スペース除去', 'param' => 'id', 'hint' => "str_replace(' ','',\$id) でスペースが消える。st2_secret の flag を。"],
  3 => ['title' => 'Stage 3 - ワイドバイト (addslashes + GBK)', 'param' => 'id', 'hint' => 'addslashes されているが接続文字セットは GBK。st3_members の admin の pw が flag。'],
  4 => ['title' => 'Stage 4 - ブール盲注', 'param' => 'user / pw', 'hint' => 'ログイン成否だけが応答。st4_members の admin の pw を1文字ずつ。'],
  5 => ['title' => 'Stage 5 - 時間盲注', 'param' => 'user', 'hint' => '常に done と返る。SLEEP 系で st5_members の admin の pw を。'],
];

function db(): mysqli {
  static $c = null;
  if ($c === null) {
    $c = @new mysqli('db', 'root', 'forgepass', 'sqforgelab');
    if ($c->connect_errno) { http_response_code(500); exit('DB error'); }
  }
  return $c;
}

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function render_row(array $row): string {
  $out = '';
  foreach ($row as $v) { $out .= '<div class="cell">' . h((string)$v) . '</div>'; }
  return '<div class="row">' . $out . '</div>';
}

$stage = (int)($_GET['stage'] ?? 0);
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>SQLi Forge Lab</title>
<style>
body{font-family:system-ui,sans-serif;background:#f4f7fb;color:#17233b;margin:0;padding:24px;font-size:14px}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:20px}h2{font-size:16px;margin:16px 0 8px}
ul{margin:8px 0;padding-left:20px}
li{margin:4px 0}
.box{background:#fff;border:1px solid #d7e0ec;border-radius:10px;padding:14px 18px;margin:12px 0}
.row{display:flex;gap:8px;margin:6px 0}
.cell{font-family:monospace;background:#eef3f9;border:1px solid #d3dcea;border-radius:6px;padding:6px 10px}
.hint{color:#8a4b06;font-size:13px;margin:8px 0}
.out{font-family:monospace;background:#eef3f9;border-left:3px solid #16a34a;padding:10px 12px;border-radius:6px;margin:10px 0;white-space:pre-wrap;word-break:break-all}
form{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
input{border:1px solid #bccbde;border-radius:6px;padding:5px 8px;font-family:monospace}
button{background:#15803d;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer}
code{background:rgba(14,116,144,.08);border-radius:4px;padding:1px 5px}
</style>
</head>
<body>
<div class="wrap">
<h1>SQLi Forge Lab <span style="color:#15803d;font-size:13px">localhost演習場</span></h1>
<div class="box">
<b>ステージ</b>
<ul>
<?php foreach ($stages as $n => $s): ?>
  <li><a href="?stage=<?= $n ?>"><?= h($s['title']) ?></a> — パラメータ: <code><?= h($s['param']) ?></code></li>
<?php endforeach; ?>
</ul>
</div>
<?php if (!isset($stages[$stage])): ?>
<div class="box">上のステージを選んでください。生成ツール (<code>dist/sqli_forge.html</code>) のペイロードがそのまま試せます。</div>
<?php
else:
  $S = $stages[$stage];
?>
<div class="box">
<h2><?= h($S['title']) ?></h2>
<p class="hint">ヒント: <?= h($S['hint']) ?></p>
<?php if ($stage <= 3): ?>
<form method="GET">
  <input type="hidden" name="stage" value="<?= $stage ?>">
  <input name="id" size="46" placeholder="id=" value="<?= h((string)($_GET['id'] ?? '')) ?>">
  <button type="submit">送信</button>
</form>
<?php
  $db = db();
  $id = (string)($_GET['id'] ?? '');
  $table = 'st' . $stage . '_members';
  if ($stage === 3) { mysqli_set_charset($db, 'gbk'); $id = addslashes($id); }
  if ($stage === 2) { $id = str_replace(' ', '', $id); }
  $q = "SELECT id, user, pw FROM {$table} WHERE id='{$id}'";
  echo '<div class="out">QUERY: ' . h($q) . '</div>';
  $r = mysqli_query($db, $q);
  if ($r === false) { echo '<div class="out" style="border-left-color:#dc2626">ERROR: ' . h(mysqli_error($db)) . '</div>'; }
  else {
    $n = mysqli_num_rows($r);
    if ($n === 0) { echo '<div class="out">no result</div>'; }
    while ($row = mysqli_fetch_row($r)) { echo render_row($row); }
  }
elseif ($stage === 4): ?>
<form method="GET">
  <input type="hidden" name="stage" value="4">
  <input name="user" size="24" placeholder="user" value="<?= h((string)($_GET['user'] ?? '')) ?>">
  <input name="pw" size="24" placeholder="pw" value="<?= h((string)($_GET['pw'] ?? '')) ?>">
  <button type="submit">login</button>
</form>
<?php
  $db = db();
  $user = (string)($_GET['user'] ?? '');
  $pw = (string)($_GET['pw'] ?? '');
  $q = "SELECT id, user, pw FROM st4_members WHERE user='{$user}' AND pw='{$pw}'";
  $r = @mysqli_query($db, $q);
  if ($r === false) { echo '<div class="out" style="border-left-color:#dc2626">ERROR</div>'; }
  elseif (mysqli_num_rows($r) > 0) { echo '<div class="out">login ok :)</div>'; }
  else { echo '<div class="out">login fail</div>'; }
else: ?>
<form method="GET">
  <input type="hidden" name="stage" value="5">
  <input name="user" size="46" placeholder="user" value="<?= h((string)($_GET['user'] ?? '')) ?>">
  <button type="submit">check</button>
</form>
<?php
  $db = db();
  $user = (string)($_GET['user'] ?? '');
  $q = "SELECT id, user, pw FROM st5_members WHERE user='{$user}'";
  $r = @mysqli_query($db, $q);
  echo '<div class="out">done</div>';
endif;
?>
</div>
<?php endif; ?>
</div>
</body>
</html>
