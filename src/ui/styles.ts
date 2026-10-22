export const DASHBOARD_STYLES = `
  :root{
    --paper:#e7ecee;
    --paper-2:#f3f6f7;
    --surface:#fbfcfc;
    --ink:#0b1618;
    --ink-soft:#172a2d;
    --muted:#536366;
    --line:#bfcbce;
    --line-dark:rgba(255,255,255,.16);
    --accent:#ff4d00;
    --accent-soft:#ffd9c7;
    --ok:#0c7a5c;
    --danger:#c81e1e;
    --sans:"Helvetica Neue","Avenir Next","Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
    --mono:"SFMono-Regular","Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
    --rail:380px;
    --topbar:58px;
  }
  *{box-sizing:border-box}
  html{background:var(--paper)}
  body{
    margin:0;
    min-height:100vh;
    background-color:var(--paper);
    background-image:
      linear-gradient(rgba(11,22,24,.032) 1px,transparent 1px),
      linear-gradient(90deg,rgba(11,22,24,.032) 1px,transparent 1px);
    background-size:32px 32px;
    color:var(--ink);
    font-family:var(--sans);
    font-size:16px;
    line-height:1.5;
    -webkit-font-smoothing:antialiased;
  }
  button,input{font:inherit}
  button{cursor:pointer}
  a{color:inherit}
  ::selection{background:var(--accent);color:var(--ink)}
  .skip{
    position:fixed;
    left:14px;
    top:-80px;
    z-index:100;
    padding:10px 14px;
    border:1px solid var(--ink);
    background:var(--surface);
    color:var(--ink);
    font-size:13px;
    text-decoration:none;
  }
  .skip:focus{top:14px}
  .topbar{
    position:sticky;
    top:0;
    z-index:30;
    min-height:var(--topbar);
    padding:12px clamp(16px,3vw,40px);
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:18px;
    border-bottom:1px solid var(--line);
    background:rgba(231,236,238,.9);
    backdrop-filter:blur(12px);
  }
  .brand{
    display:inline-flex;
    align-items:center;
    gap:10px;
    text-decoration:none;
    white-space:nowrap;
  }
  .brand-mark{
    display:grid;
    place-items:center;
    width:28px;
    height:28px;
    background:var(--accent);
    color:var(--ink);
    font-size:21px;
    font-weight:800;
    line-height:1;
  }
  .brand-name{
    font-size:17px;
    font-weight:800;
    letter-spacing:-.045em;
  }
  .brand-name span{color:var(--muted);font-weight:500}
  .topbar-right{display:flex;align-items:center;gap:20px}
  .status{
    display:flex;
    align-items:center;
    gap:7px;
    font-family:var(--mono);
    font-size:11px;
    color:var(--muted);
    white-space:nowrap;
  }
  .status i{
    display:block;
    width:8px;
    height:8px;
    background:var(--line);
    border:1px solid var(--muted);
  }
  .status[data-tone="ok"] i{background:var(--ok);border-color:var(--ok)}
  .status[data-tone="busy"] i{background:var(--accent);border-color:var(--ink)}
  .status[data-tone="error"] i{background:var(--danger);border-color:var(--danger)}
  .account{
    display:flex;
    align-items:center;
    gap:10px;
    min-width:0;
    font-family:var(--mono);
    font-size:11px;
  }
  #userName{
    max-width:160px;
    overflow:hidden;
    white-space:nowrap;
    text-overflow:ellipsis;
  }
  .role{
    padding:2px 6px;
    border:1px solid var(--line);
    color:var(--muted);
  }
  .role.admin{border-color:var(--accent);background:var(--accent);color:var(--ink)}
  .btn-quiet{
    padding:4px 0;
    border:0;
    border-bottom:1px solid var(--line);
    background:none;
    color:var(--ink);
    font-size:11px;
  }
  .btn-quiet:hover{border-color:var(--accent);color:var(--ink)}
  main{min-height:calc(100vh - var(--topbar))}
  .boot{
    padding:100px 24px;
    text-align:center;
    font-family:var(--mono);
    font-size:12px;
    color:var(--muted);
  }
  .login{
    display:grid;
    grid-template-columns:minmax(0,1.12fr) minmax(360px,.88fr);
    min-height:calc(100vh - var(--topbar));
    border-bottom:1px solid var(--line);
  }
  .login-poster{
    position:relative;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
    gap:38px;
    padding:clamp(30px,4vw,66px);
    background:var(--ink);
    color:var(--paper-2);
    overflow:hidden;
  }
  .login-poster:before{
    content:"";
    position:absolute;
    inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);
    background-size:48px 48px;
    pointer-events:none;
  }
  .poster-top,.contact-sheet,.poster-foot{position:relative;z-index:1}
  .poster-kicker{
    display:flex;
    align-items:center;
    gap:9px;
    margin:0;
    font-family:var(--mono);
    font-size:11px;
    color:#a6b5b7;
  }
  .poster-kicker:before{
    content:"";
    width:20px;
    height:2px;
    background:var(--accent);
  }
  .poster-top h1{
    margin:18px 0 0;
    max-width:11ch;
    font-size:clamp(46px,6.2vw,96px);
    font-weight:800;
    line-height:.94;
    letter-spacing:-.065em;
  }
  .contact-sheet{
    width:min(540px,100%);
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:8px;
    transform:rotate(-2deg);
    transform-origin:left center;
  }
  .sheet-cell{
    position:relative;
    aspect-ratio:4/3;
    border:6px solid #f5f8f8;
    background:var(--ink-soft);
    overflow:hidden;
    box-shadow:0 0 0 1px rgba(255,255,255,.18);
  }
  .sheet-cell:after{
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 46%);
  }
  .sheet-cell:before{
    content:attr(data-frame);
    position:absolute;
    left:4px;
    bottom:3px;
    z-index:1;
    font-family:var(--mono);
    font-size:8px;
    color:rgba(255,255,255,.78);
  }
  .cell-1{background:linear-gradient(118deg,#ff4d00 0 38%,#101d20 38% 68%,#d9e2e4 68%)}
  .cell-2{background:repeating-linear-gradient(90deg,#142629 0 9px,#9fb4b8 9px 12px,#142629 12px 23px)}
  .cell-3{background:radial-gradient(circle at 35% 38%,#f3f6f7 0 14%,#ff4d00 14% 31%,#142629 31% 100%)}
  .cell-4{background:linear-gradient(160deg,#7f989c 0 34%,#e8edef 34% 55%,#ff4d00 55% 72%,#142629 72%)}
  .cell-5{background:repeating-linear-gradient(45deg,#21373b 0 11px,#0b1618 11px 22px,#c7d3d5 22px 25px)}
  .cell-6{background:radial-gradient(ellipse at 66% 42%,#ff4d00 0 18%,#142629 18% 52%,#adc0c3 52% 100%)}
  .poster-foot{
    max-width:38ch;
    margin:0;
    font-size:14px;
    line-height:1.65;
    color:#a6b5b7;
  }
  .login-panel{
    display:grid;
    place-items:center;
    padding:clamp(26px,5vw,74px);
    background:var(--paper-2);
  }
  .login-card{width:min(400px,100%)}
  .login-card h2{
    margin:0 0 10px;
    font-size:clamp(34px,4vw,48px);
    font-weight:800;
    line-height:1;
    letter-spacing:-.055em;
  }
  .login-sub{
    max-width:36ch;
    margin:0 0 30px;
    color:var(--muted);
    font-size:14px;
  }
  .field{margin-bottom:16px}
  .field label{
    display:block;
    margin-bottom:6px;
    font-family:var(--mono);
    font-size:11px;
    color:var(--ink);
  }
  .field input{
    width:100%;
    padding:12px 13px;
    border:1px solid var(--ink);
    border-radius:0;
    background:var(--surface);
    color:var(--ink);
    outline:none;
    transition:border-color .15s,box-shadow .15s;
  }
  .field input:focus{border-color:var(--ink);box-shadow:0 0 0 3px var(--accent-soft)}
  .auth-error{min-height:20px;margin:0 0 10px;color:var(--danger);font-size:12px}
  .login-btn{
    width:100%;
    padding:13px 16px;
    border:1px solid var(--ink);
    border-radius:0;
    background:var(--accent);
    color:var(--ink);
    font-weight:700;
    transition:background .16s,color .16s;
  }
  .login-btn:hover{background:var(--ink);color:var(--paper-2)}
  .login-btn:disabled{opacity:.55;cursor:default}
  .login-note{
    margin:18px 0 0;
    font-family:var(--mono);
    font-size:10px;
    line-height:1.7;
    color:var(--muted);
  }
  .workspace{
    display:grid;
    grid-template-columns:var(--rail) minmax(0,1fr);
    min-height:calc(100vh - var(--topbar));
  }
  .rail{
    position:sticky;
    top:var(--topbar);
    align-self:start;
    height:calc(100vh - var(--topbar));
    overflow:auto;
    padding:clamp(24px,3vw,38px);
    background:var(--ink);
    color:var(--paper-2);
    border-right:1px solid var(--ink);
  }
  .rail-head h1{
    margin:16px 0 10px;
    font-size:clamp(32px,3.4vw,44px);
    font-weight:800;
    line-height:.98;
    letter-spacing:-.055em;
  }
  .rail-sub{
    margin:0 0 26px;
    max-width:34ch;
    color:#a6b5b7;
    font-size:13px;
  }
  .drop{
    position:relative;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
    min-height:236px;
    padding:28px 22px;
    border:1px dashed rgba(255,255,255,.38);
    background:rgba(255,255,255,.035);
    text-align:center;
    cursor:pointer;
    transition:background .18s,border-color .18s,box-shadow .18s;
  }
  .drop:hover,.drop.drag{
    border-color:var(--accent);
    background:rgba(255,77,0,.12);
    box-shadow:inset 0 0 0 1px var(--accent);
  }
  .drop:focus-within{outline:2px solid var(--accent);outline-offset:3px}
  .drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .drop-plus{
    margin-bottom:6px;
    color:var(--accent);
    font-size:64px;
    font-weight:200;
    line-height:1;
  }
  .drop-title{font-size:18px;font-weight:700}
  .drop-hint{font-size:13px;color:#a6b5b7}
  .drop-formats{
    max-width:32ch;
    margin-top:12px;
    font-family:var(--mono);
    font-size:9px;
    line-height:1.7;
    color:#7f9295;
  }
  .progress{margin-top:18px}
  .progress-head{
    display:flex;
    justify-content:space-between;
    gap:12px;
    margin-bottom:7px;
    font-family:var(--mono);
    font-size:10px;
    color:#a6b5b7;
  }
  .progress-track{
    display:block;
    height:4px;
    background:rgba(255,255,255,.14);
    overflow:hidden;
  }
  .progress-track i{
    display:block;
    width:0;
    height:100%;
    background:var(--accent);
    transition:width .2s;
  }
  .rail-meta{margin-top:28px;border-top:1px solid var(--line-dark)}
  .rail-meta div{
    display:flex;
    justify-content:space-between;
    gap:16px;
    padding:10px 0;
    border-bottom:1px solid var(--line-dark);
    font-family:var(--mono);
    font-size:10px;
  }
  .rail-meta span{color:#7f9295}
  .rail-meta strong{font-weight:400;text-align:right;color:var(--paper-2)}
  .gallery{min-width:0;padding:clamp(24px,3vw,48px)}
  .gallery-head{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:24px;
    padding-bottom:20px;
    border-bottom:1px solid var(--line);
  }
  .gallery-head h2{
    margin:0;
    font-size:clamp(30px,3.2vw,44px);
    font-weight:800;
    line-height:1;
    letter-spacing:-.055em;
  }
  .sheet-sub{
    margin:9px 0 0;
    font-family:var(--mono);
    font-size:10px;
    color:var(--muted);
  }
  .btn{
    padding:9px 14px;
    border:1px solid var(--ink);
    border-radius:0;
    background:transparent;
    color:var(--ink);
    font-size:12px;
    font-weight:600;
    transition:background .15s,color .15s;
  }
  .btn:hover{background:var(--ink);color:var(--paper-2)}
  .btn:disabled{opacity:.4;cursor:default}
  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
    gap:24px 18px;
    padding-top:26px;
    align-content:start;
  }
  .frame{margin:0;min-width:0}
  .thumb{
    position:relative;
    display:block;
    aspect-ratio:1;
    border:1px solid var(--line);
    background-color:var(--surface);
    background-image:
      linear-gradient(45deg,#e8edef 25%,transparent 25%),
      linear-gradient(-45deg,#e8edef 25%,transparent 25%),
      linear-gradient(45deg,transparent 75%,#e8edef 75%),
      linear-gradient(-45deg,transparent 75%,#e8edef 75%);
    background-size:16px 16px;
    background-position:0 0,0 8px,8px -8px,-8px 0;
    overflow:hidden;
  }
  .thumb:after{
    content:"";
    position:absolute;
    inset:8px;
    border:1px solid rgba(11,22,24,.14);
    pointer-events:none;
    transition:border-color .18s;
  }
  .thumb img{
    display:block;
    width:100%;
    height:100%;
    object-fit:cover;
    transition:transform .4s cubic-bezier(.2,.7,.2,1);
  }
  .thumb:hover img{transform:scale(1.025)}
  .thumb:hover:after{border-color:var(--accent)}
  .ext{
    position:absolute;
    left:0;
    top:0;
    z-index:1;
    padding:3px 6px;
    background:var(--ink);
    color:var(--paper-2);
    font-family:var(--mono);
    font-size:9px;
    text-transform:uppercase;
  }
  .frame figcaption{padding-top:9px}
  .name{
    display:block;
    overflow:hidden;
    font-family:var(--mono);
    font-size:10px;
    white-space:nowrap;
    text-overflow:ellipsis;
    color:var(--ink);
  }
  .subline{
    display:flex;
    justify-content:space-between;
    gap:8px;
    margin-top:3px;
    font-family:var(--mono);
    font-size:9px;
    color:var(--muted);
  }
  .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .actions button{
    padding:3px 7px;
    border:1px solid var(--line);
    border-radius:0;
    background:transparent;
    color:var(--ink);
    font-family:var(--mono);
    font-size:9px;
    transition:background .15s,border-color .15s,color .15s;
  }
  .actions button:hover{background:var(--ink);border-color:var(--ink);color:var(--paper-2)}
  .actions .danger:hover{background:var(--danger);border-color:var(--danger);color:#fff}
  .empty{
    margin-top:26px;
    padding:54px 24px;
    border:1px dashed var(--line);
    color:var(--muted);
    text-align:center;
  }
  .empty-frame{
    position:relative;
    width:94px;
    height:70px;
    margin:0 auto 18px;
    border:1px solid var(--ink);
    background:var(--surface);
  }
  .empty-frame:before,.empty-frame:after{
    content:"";
    position:absolute;
    background:var(--line);
  }
  .empty-frame:before{left:50%;top:0;bottom:0;width:1px}
  .empty-frame:after{top:50%;left:0;right:0;height:1px}
  .empty-frame span{
    position:absolute;
    left:50%;
    top:50%;
    z-index:1;
    display:grid;
    place-items:center;
    width:26px;
    height:26px;
    background:var(--accent);
    color:var(--ink);
    font-size:20px;
    line-height:1;
    transform:translate(-50%,-50%);
  }
  .empty p{margin:0;font-size:13px}
  .empty p:first-of-type{color:var(--ink);font-size:15px;font-weight:700}
  .empty p + p{margin-top:4px}
  .more-wrap{margin-top:26px;text-align:center}
  .btn-wide{
    padding:10px 24px;
    border:1px solid var(--ink);
    border-radius:0;
    background:transparent;
    color:var(--ink);
    font-size:12px;
    font-weight:600;
  }
  .btn-wide:hover{background:var(--ink);color:var(--paper-2)}
  .footer{
    display:flex;
    justify-content:space-between;
    gap:16px;
    flex-wrap:wrap;
    padding:0 clamp(16px,3vw,40px) 34px;
    font-family:var(--mono);
    font-size:10px;
    color:var(--muted);
  }
  .footer span:last-child{display:flex;gap:18px}
  .footer a{text-decoration:none;border-bottom:1px solid var(--line)}
  .footer a:hover{border-color:var(--ink);color:var(--ink)}
  .toast{
    position:fixed;
    left:24px;
    bottom:24px;
    z-index:60;
    max-width:min(420px,calc(100vw - 32px));
    padding:11px 15px;
    border:1px solid var(--ink);
    border-left:4px solid var(--accent);
    background:var(--ink);
    color:var(--paper-2);
    font-size:13px;
    opacity:0;
    pointer-events:none;
    transform:translateY(12px);
    transition:opacity .18s,transform .18s;
  }
  .toast.show{opacity:1;transform:translateY(0)}
  :focus-visible{outline:2px solid var(--ink);outline-offset:3px}
  .rail :focus-visible,.login-poster :focus-visible{outline-color:var(--accent)}
  @media (prefers-reduced-motion:no-preference){
    .sheet-cell{animation:frame-in .7s cubic-bezier(.2,.7,.2,1) both}
    .sheet-cell:nth-child(2){animation-delay:.05s}
    .sheet-cell:nth-child(3){animation-delay:.1s}
    .sheet-cell:nth-child(4){animation-delay:.15s}
    .sheet-cell:nth-child(5){animation-delay:.2s}
    .sheet-cell:nth-child(6){animation-delay:.25s}
    @keyframes frame-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  }
  @media (max-width:980px){
    .login{grid-template-columns:1fr}
    .login-poster{min-height:44vh}
    .contact-sheet{width:min(560px,100%)}
    .workspace{grid-template-columns:1fr}
    .rail{
      position:static;
      height:auto;
      border-right:0;
      border-bottom:1px solid var(--ink);
    }
    .rail .drop{min-height:200px}
  }
  @media (max-width:640px){
    .topbar{padding:11px 16px;gap:10px}
    .status{display:none}
    .brand-name{font-size:15px}
    .topbar-right{gap:12px}
    .account{gap:7px}
    #userName{max-width:80px}
    .login-poster{padding:30px 20px;min-height:0;gap:30px}
    .poster-top h1{font-size:clamp(42px,12vw,64px)}
    .contact-sheet{gap:5px;transform:none}
    .sheet-cell{border-width:4px}
    .poster-foot{font-size:13px}
    .login-panel{padding:30px 20px 50px}
    .rail{padding:26px 18px}
    .gallery{padding:26px 16px 48px}
    .gallery-head{align-items:flex-start;gap:16px}
    .grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:18px 12px}
    .toast{left:16px;bottom:16px}
    .footer{padding:0 16px 30px}
  }
  @media (prefers-reduced-motion:reduce){
    *,*:before,*:after{
      animation-duration:.01ms !important;
      animation-iteration-count:1 !important;
      transition-duration:.01ms !important;
    }
  }
  [hidden]{display:none !important}
`;
