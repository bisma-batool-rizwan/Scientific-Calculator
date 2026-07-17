(function(){
  var root = document.getElementById('grid');
  var exprEl = document.getElementById('expr');
  var resultEl = document.getElementById('result');
  var modeIndicator = document.getElementById('mode-indicator');

  var state = {
    expr: '',
    deg: true,
    second: false,
    memory: 0,
    lastResult: 0,
    justEvaluated: false
  };

  var rows = [
    [
      {label:'2nd', action:'2ND', kind:'util'},
      {label:'Deg', action:'DEG', kind:'util', id:'deg-btn'},
      {label:'MC', action:'MC', kind:'util'},
      {label:'MR', action:'MR', kind:'util'},
      {label:'M+', action:'M+', kind:'util'}
    ],
    [
      {label:'x\u00b2', action:'^2', kind:'func'},
      {label:'x\u02b8', action:'^', kind:'func'},
      {label:'x!', action:'!', kind:'func'},
      {label:'(', action:'(', kind:'func'},
      {label:')', action:')', kind:'func'}
    ],
    [
      {label:'1/x', action:'1/x', kind:'func'},
      {label:'\u221a', action:'sqrt(', kind:'func'},
      {label:'sin', action:'sin(', kind:'func', id:'sin-btn'},
      {label:'cos', action:'cos(', kind:'func', id:'cos-btn'},
      {label:'tan', action:'tan(', kind:'func', id:'tan-btn'}
    ],
    [
      {label:'log', action:'log(', kind:'func'},
      {label:'ln', action:'ln(', kind:'func'},
      {label:'\u03c0', action:'pi', kind:'func'},
      {label:'e', action:'e', kind:'func'},
      {label:'AC', action:'AC', kind:'util'}
    ],
    [
      {label:'7', action:'7', kind:'num'},
      {label:'8', action:'8', kind:'num'},
      {label:'9', action:'9', kind:'num'},
      {label:'\u00f7', action:'/', kind:'op'},
      {label:'\u232b', action:'DEL', kind:'util'}
    ],
    [
      {label:'4', action:'4', kind:'num'},
      {label:'5', action:'5', kind:'num'},
      {label:'6', action:'6', kind:'num'},
      {label:'\u00d7', action:'*', kind:'op'},
      {label:'%', action:'%', kind:'func'}
    ],
    [
      {label:'1', action:'1', kind:'num'},
      {label:'2', action:'2', kind:'num'},
      {label:'3', action:'3', kind:'num'},
      {label:'\u2212', action:'-', kind:'op'},
      {label:'Ans', action:'ANS', kind:'util'}
    ],
    [
      {label:'0', action:'0', kind:'num', span:2},
      {label:'.', action:'.', kind:'num'},
      {label:'+', action:'+', kind:'op'},
      {label:'=', action:'=', kind:'equals'}
    ]
  ];

  var classFor = {
    num: 'k-num',
    op: 'k-op',
    func: 'k-func',
    util: 'k-util',
    equals: 'k-equals'
  };

  rows.forEach(function(row){
    row.forEach(function(btn){
      var el = document.createElement('button');
      el.textContent = btn.label;
      el.className = classFor[btn.kind];
      el.setAttribute('aria-label', btn.label);
      if(btn.span) el.classList.add('span-2');
      if(btn.id) el.id = btn.id;
      el.dataset.action = btn.action;
      el.addEventListener('click', function(){ press(el.dataset.action); });
      root.appendChild(el);
    });
  });

  function fmt(n){
    if(isNaN(n) || !isFinite(n)) return 'Error';
    var r = parseFloat(n.toPrecision(12));
    if(Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-9 && r !== 0)) return r.toExponential(6);
    return r.toLocaleString('en-US', {maximumFractionDigits: 10});
  }

  function prettify(s){
    return s.replace(/\*/g,'\u00d7').replace(/\//g,'\u00f7').replace(/pi/g,'\u03c0');
  }

  function gamma(n){
    var g = 7;
    var p = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
      771.32342877765313,-176.61502916214059,12.507343278686905,
      -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if(n < 0.5) return Math.PI / (Math.sin(Math.PI*n) * gamma(1-n));
    n -= 1;
    var x = p[0];
    for(var i=1;i<g+2;i++) x += p[i]/(n+i);
    var t = n + g + 0.5;
    return Math.sqrt(2*Math.PI) * Math.pow(t, n+0.5) * Math.exp(-t) * x;
  }

  function factorial(n){
    if(n < 0) return NaN;
    if(Number.isInteger(n)){
      var r = 1;
      for(var i=2;i<=n;i++) r *= i;
      return r;
    }
    return gamma(n+1);
  }

  function tokenize(str){
    var tokens = [];
    var i = 0;
    while(i < str.length){
      var ch = str[i];
      if(/\s/.test(ch)){ i++; continue; }
      if(/[0-9.]/.test(ch)){
        var j = i;
        while(j < str.length && /[0-9.]/.test(str[j])) j++;
        tokens.push({type:'num', value: parseFloat(str.slice(i,j))});
        i = j; continue;
      }
      if(/[a-zA-Z]/.test(ch)){
        var k = i;
        while(k < str.length && /[a-zA-Z]/.test(str[k])) k++;
        tokens.push({type:'ident', value: str.slice(i,k).toLowerCase()});
        i = k; continue;
      }
      if('+-*/^!%()'.indexOf(ch) !== -1){
        tokens.push({type:'op', value: ch});
        i++; continue;
      }
      i++;
    }
    var out = [];
    for(var m=0;m<tokens.length;m++){
      out.push(tokens[m]);
      var cur = tokens[m], next = tokens[m+1];
      if(!next) continue;
      var curEnds = (cur.type==='num') || (cur.type==='ident') || (cur.type==='op' && (cur.value===')'||cur.value==='!'||cur.value==='%'));
      var nextStarts = (next.type==='num') || (next.type==='ident') || (next.type==='op' && next.value==='(');
      var curIsFunc = cur.type==='ident' && ['sin','cos','tan','asin','acos','atan','log','ln','sqrt','cbrt'].indexOf(cur.value)!==-1;
      if(curEnds && nextStarts && !curIsFunc){
        out.push({type:'op', value:'*'});
      }
    }
    return out;
  }

  function makeParser(tokens, ctx){
    var pos = 0;
    function peek(){ return tokens[pos]; }
    function advance(){ return tokens[pos++]; }

    function applyFunc(name, arg){
      var toRad = function(x){ return ctx.deg ? x*Math.PI/180 : x; };
      var toDeg = function(x){ return ctx.deg ? x*180/Math.PI : x; };
      switch(name){
        case 'sin': return Math.sin(toRad(arg));
        case 'cos': return Math.cos(toRad(arg));
        case 'tan': return Math.tan(toRad(arg));
        case 'asin': return toDeg(Math.asin(arg));
        case 'acos': return toDeg(Math.acos(arg));
        case 'atan': return toDeg(Math.atan(arg));
        case 'log': return Math.log10(arg);
        case 'ln': return Math.log(arg);
        case 'sqrt': return Math.sqrt(arg);
        case 'cbrt': return Math.cbrt(arg);
      }
    }

    function primary(){
      var t = peek();
      if(!t) throw new Error('Unexpected end');
      if(t.type === 'num'){ advance(); return t.value; }
      if(t.type === 'ident'){
        var word = t.value;
        var funcs = ['sin','cos','tan','asin','acos','atan','log','ln','sqrt','cbrt'];
        if(funcs.indexOf(word) !== -1){
          advance();
          if(!peek() || peek().value !== '(') throw new Error('Expected (');
          advance();
          var arg = expression();
          if(!peek() || peek().value !== ')') throw new Error('Expected )');
          advance();
          return applyFunc(word, arg);
        }
        if(word === 'pi'){ advance(); return Math.PI; }
        if(word === 'e'){ advance(); return Math.E; }
        if(word === 'ans'){ advance(); return ctx.ans; }
        throw new Error('Unknown: ' + word);
      }
      if(t.type === 'op' && t.value === '('){
        advance();
        var v = expression();
        if(!peek() || peek().value !== ')') throw new Error('Expected )');
        advance();
        return v;
      }
      throw new Error('Unexpected token');
    }

    function postfix(){
      var val = primary();
      while(peek() && peek().type==='op' && (peek().value==='!' || peek().value==='%')){
        var op = advance().value;
        val = op==='!' ? factorial(val) : val/100;
      }
      return val;
    }

    function unary(){
      if(peek() && peek().type==='op' && peek().value==='-'){
        advance();
        return -unary();
      }
      if(peek() && peek().type==='op' && peek().value==='+'){
        advance();
        return unary();
      }
      return postfix();
    }

    function factor(){
      var val = unary();
      if(peek() && peek().type==='op' && peek().value==='^'){
        advance();
        var rhs = factor();
        val = Math.pow(val, rhs);
      }
      return val;
    }

    function term(){
      var val = factor();
      while(peek() && peek().type==='op' && (peek().value==='*' || peek().value==='/')){
        var op = advance().value;
        var rhs = factor();
        val = op==='*' ? val*rhs : val/rhs;
      }
      return val;
    }

    function expression(){
      var val = term();
      while(peek() && peek().type==='op' && (peek().value==='+' || peek().value==='-')){
        var op = advance().value;
        var rhs = term();
        val = op==='+' ? val+rhs : val-rhs;
      }
      return val;
    }

    return { run: expression };
  }

  function evalExpr(str){
    if(!str.trim()) return null;
    var tokens = tokenize(str);
    if(tokens.length === 0) return null;
    var parser = makeParser(tokens, {deg: state.deg, ans: state.lastResult});
    return parser.run();
  }

  function updateDisplay(){
    exprEl.textContent = state.expr ? prettify(state.expr) : '\u00a0';
  }

  function livePreview(){
    try{
      var v = evalExpr(state.expr);
      if(v !== null && isFinite(v) && !isNaN(v)) resultEl.textContent = fmt(v);
    }catch(e){ /* keep last valid preview */ }
  }

  function updateSecondLabels(){
    var sinBtn = document.getElementById('sin-btn');
    var cosBtn = document.getElementById('cos-btn');
    var tanBtn = document.getElementById('tan-btn');
    if(state.second){
      sinBtn.textContent = 'sin\u207b\u00b9'; sinBtn.dataset.action = 'asin(';
      cosBtn.textContent = 'cos\u207b\u00b9'; cosBtn.dataset.action = 'acos(';
      tanBtn.textContent = 'tan\u207b\u00b9'; tanBtn.dataset.action = 'atan(';
    } else {
      sinBtn.textContent = 'sin'; sinBtn.dataset.action = 'sin(';
      cosBtn.textContent = 'cos'; cosBtn.dataset.action = 'cos(';
      tanBtn.textContent = 'tan'; tanBtn.dataset.action = 'tan(';
    }
  }

  function fmtRaw(n){ return String(parseFloat(n.toPrecision(12))); }

  function appendAction(action){
    if(state.justEvaluated){
      if(/^[0-9.]$/.test(action) || action === '(' || /^[a-z]/.test(action)){
        state.expr = '';
      } else {
        state.expr = fmtRaw(state.lastResult);
      }
      state.justEvaluated = false;
    }
    state.expr += action;
    updateDisplay();
    livePreview();
  }

  function press(action){
    if(action === 'AC'){
      state.expr = '';
      state.justEvaluated = false;
      updateDisplay();
      resultEl.textContent = '0';
      return;
    }
    if(action === 'DEL'){
      state.expr = state.expr.slice(0, -1);
      updateDisplay();
      livePreview();
      return;
    }
    if(action === '='){
      try{
        var v = evalExpr(state.expr);
        if(v === null) return;
        state.lastResult = v;
        resultEl.textContent = fmt(v);
        exprEl.textContent = prettify(state.expr) + ' =';
        state.justEvaluated = true;
        resultEl.classList.remove('pop');
        void resultEl.offsetWidth;
        resultEl.classList.add('pop');
      }catch(e){
        resultEl.textContent = 'Error';
      }
      return;
    }
    if(action === '2ND'){
      state.second = !state.second;
      updateSecondLabels();
      document.getElementById('grid').querySelector('[data-action="2ND"]').classList.toggle('active-toggle', state.second);
      return;
    }
    if(action === 'DEG'){
      state.deg = !state.deg;
      var degBtn = document.getElementById('deg-btn');
      degBtn.textContent = state.deg ? 'Deg' : 'Rad';
      modeIndicator.textContent = state.deg ? 'DEG' : 'RAD';
      livePreview();
      return;
    }
    if(action === 'MC'){ state.memory = 0; return; }
    if(action === 'MR'){ appendAction(fmtRaw(state.memory)); return; }
    if(action === 'M+'){ state.memory += state.lastResult; return; }
    if(action === 'ANS'){ appendAction('ans'); return; }
    if(action === '1/x'){
      if(state.justEvaluated){
        state.expr = '1/(' + fmtRaw(state.lastResult) + ')';
        state.justEvaluated = false;
      } else {
        state.expr = '1/(' + state.expr + ')';
      }
      updateDisplay();
      livePreview();
      return;
    }
    appendAction(action);
  }

  document.addEventListener('keydown', function(e){
    var key = e.key;
    if(/[0-9.+\-*/^()]/.test(key)){ appendAction(key); return; }
    if(key === 'Enter' || key === '='){ e.preventDefault(); press('='); return; }
    if(key === 'Backspace'){ press('DEL'); return; }
    if(key === 'Escape'){ press('AC'); return; }
    if(key === '%'){ appendAction('%'); return; }
  });

  updateDisplay();
})();
