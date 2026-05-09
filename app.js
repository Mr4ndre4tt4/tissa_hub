const questions = [
  { q: "Qual demonstração apresenta Ativo, Passivo e Patrimônio Líquido?", ctx: "Fechamento mensal da empresa.", options: ["Balanço Patrimonial", "DRE", "DFC", "DMPL"], answer: 0, tip: "O Balanço mostra a posição patrimonial em uma data.", level: 1 },
  { q: "Venda a prazo aumenta qual conta no ativo?", ctx: "Venda sem receber no momento.", options: ["Caixa", "Clientes", "Estoque", "Fornecedores"], answer: 1, tip: "Clientes (contas a receber) aumenta no ativo.", level: 1 },
  { q: "Pagamento de fornecedor à vista causa:", ctx: "Quitar dívida com dinheiro em caixa.", options: ["Ativo + e Passivo +", "Ativo - e Passivo -", "Receita +", "PL +"], answer: 1, tip: "Sai caixa e reduz obrigação com fornecedor.", level: 1 },
  { q: "Depreciação é classificada na DRE como:", ctx: "Uso de máquina ao longo do tempo.", options: ["Receita", "Despesa", "Investimento", "Empréstimo"], answer: 1, tip: "Depreciação reduz o resultado como despesa.", level: 2 },
  { q: "Equação contábil correta:", ctx: "Base de toda escrituração.", options: ["Ativo = Passivo + PL", "Ativo = Receita + Despesa", "PL = Caixa - Estoque", "Passivo = Ativo - Receita"], answer: 0, tip: "Recursos (Ativo) vêm de terceiros (Passivo) e sócios (PL).", level: 2 },
  { q: "Receita de vendas afeta diretamente:", ctx: "Apuração de resultado.", options: ["DRE", "Razão", "Livro Caixa", "Inventário"], answer: 0, tip: "Receitas entram na DRE para formar lucro ou prejuízo.", level: 2 },
  { q: "Compra de estoque à prazo gera:", ctx: "Sem pagamento imediato.", options: ["Ativo + e Passivo +", "Ativo - e Passivo -", "Só PL +", "Só receita +"], answer: 0, tip: "Entra estoque e nasce obrigação com fornecedor.", level: 3 },
  { q: "Lucro líquido simplificado é:", ctx: "Ao final do período.", options: ["Receitas - Despesas", "Ativo - Passivo", "Caixa + Clientes", "PL - Ativo"], answer: 0, tip: "Resultado = receitas menos custos e despesas.", level: 3 },
  { q: "Qual é um ativo circulante?", ctx: "Item de alta liquidez.", options: ["Imóvel", "Máquina", "Caixa", "Patente"], answer: 2, tip: "Caixa é imediatamente disponível.", level: 3 },
  { q: "Empréstimo bancário recebido aumenta:", ctx: "Entrada de dinheiro via dívida.", options: ["Ativo e Passivo", "Só receita", "Só despesa", "Ativo e reduz passivo"], answer: 0, tip: "Entra caixa (ativo) e surge obrigação (passivo).", level: 4 },
  { q: "Despesas antecipadas são registradas inicialmente como:", ctx: "Ex.: seguro pago adiantado.", options: ["Passivo", "Ativo", "Receita", "Patrimônio líquido"], answer: 1, tip: "Como benefício futuro, começa no ativo.", level: 4 },
  { q: "No método das partidas dobradas, cada lançamento deve:", ctx: "Regra de equilíbrio.", options: ["Ter 1 débito só", "Ter débitos = créditos", "Aumentar apenas ativo", "Ser mensal"], answer: 1, tip: "Todo débito precisa de crédito correspondente.", level: 4 }
];

let round=0,score=0,lives=3,combo=0,timeLeft=20,timer=null,answered=false;
const el = (id)=>document.getElementById(id);
el("total").textContent = questions.length;

function updateHUD(){
  el("score").textContent=score;
  el("level").textContent=questions[Math.min(round,questions.length-1)].level;
  el("lives").textContent=lives;
  el("combo").textContent=combo;
  el("round").textContent=Math.min(round+1,questions.length);
  el("time").textContent=timeLeft;
  el("progressBar").style.width = `${(round/questions.length)*100}%`;
}

function startTimer(){
  clearInterval(timer);
  timeLeft=20;
  updateHUD();
  timer=setInterval(()=>{
    timeLeft--; updateHUD();
    if(timeLeft<=0){
      clearInterval(timer);
      if(!answered){
        lives--; combo=0; answered=true;
        el("feedback").textContent="⏱️ Tempo esgotado!";
        revealCorrect();
        el("tip").textContent=questions[round].tip;
        finalizeTurn(false);
      }
    }
  },1000);
}

function renderQuestion(){
  answered=false;
  el("nextBtn").disabled=true;
  el("feedback").textContent="";
  const item=questions[round];
  el("question").textContent=item.q;
  el("context").textContent=`Nível ${item.level}: ${item.ctx}`;
  el("tip").textContent="Responda para ver a explicação.";
  const box=el("options"); box.innerHTML="";
  item.options.forEach((opt,idx)=>{
    const btn=document.createElement("button");
    btn.className="option-btn";
    btn.textContent=opt;
    btn.onclick=()=>checkAnswer(idx,btn);
    box.appendChild(btn);
  });
  updateHUD();
  startTimer();
}

function revealCorrect(){
  const buttons=[...document.querySelectorAll('.option-btn')];
  buttons.forEach(b=>b.disabled=true);
  if(buttons[questions[round].answer]) buttons[questions[round].answer].classList.add('correct');
}

function logHistory(ok){
  const li=document.createElement('li');
  li.textContent=`${questions[round].q} — ${ok?"Acertou":"Errou"}. ${questions[round].tip}`;
  el('history').appendChild(li);
}

function finalizeTurn(ok){
  updateHUD();
  logHistory(ok);
  if(lives<=0 || round===questions.length-1){
    endGame();
  }else{
    el("nextBtn").disabled=false;
  }
}

function checkAnswer(idx,btn){
  if(answered) return;
  answered=true;
  clearInterval(timer);
  const item=questions[round];
  const buttons=[...document.querySelectorAll('.option-btn')];
  buttons.forEach(b=>b.disabled=true);

  if(idx===item.answer){
    combo++;
    const bonus = combo>=3 ? 5 : 0;
    score += 10 + bonus;
    btn.classList.add('correct');
    el("feedback").textContent = bonus ? `✅ Correto! Combo ${combo}x (+15).` : "✅ Correto! +10.";
    el("tip").textContent=item.tip;
    finalizeTurn(true);
  }else{
    combo=0; lives--;
    btn.classList.add('wrong');
    buttons[item.answer].classList.add('correct');
    el("feedback").textContent="❌ Incorreto.";
    el("tip").textContent=item.tip;
    finalizeTurn(false);
  }
}

function nextRound(){ round++; renderQuestion(); }
function endGame(){
  clearInterval(timer);
  el("nextBtn").disabled=true;
  el("restartBtn").disabled=false;
  el("progressBar").style.width = `100%`;
  const msg = lives<=0 ? "Fim de jogo: vidas zeradas." : "Parabéns! Você concluiu todos os desafios.";
  el("question").textContent=`${msg} Pontuação final: ${score}`;
  el("context").textContent="Revise o histórico para reforçar os conceitos.";
}
function startGame(){
  round=0;score=0;lives=3;combo=0;el('history').innerHTML="";
  el("restartBtn").disabled=true;
  renderQuestion();
}

el("startBtn").onclick=startGame;
el("nextBtn").onclick=nextRound;
el("restartBtn").onclick=startGame;
