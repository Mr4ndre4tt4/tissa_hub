const questions = [
  {
    q: "Qual demonstração mostra ativos, passivos e patrimônio líquido?",
    ctx: "Uma empresa quer ver sua posição patrimonial no fim do mês.",
    options: ["Balanço Patrimonial", "DRE", "Fluxo de Caixa", "Livro Diário"],
    answer: 0,
    tip: "O Balanço Patrimonial mostra a posição financeira em uma data específica."
  },
  {
    q: "Se uma empresa compra mercadoria à vista, o que acontece?",
    ctx: "A compra foi de R$ 1.000 com dinheiro em caixa.",
    options: ["Aumenta ativo e diminui ativo", "Aumenta passivo", "Diminui patrimônio líquido", "Nada muda"],
    answer: 0,
    tip: "Sai caixa (ativo) e entra estoque (ativo): troca entre contas do ativo."
  },
  {
    q: "Receita de vendas afeta diretamente qual demonstração?",
    ctx: "A loja registrou R$ 5.000 em vendas no mês.",
    options: ["DRE", "Balanço", "Notas explicativas", "Inventário físico"],
    answer: 0,
    tip: "A DRE mostra receitas, custos e despesas para apurar o lucro/prejuízo."
  },
  {
    q: "O que representa o passivo?",
    ctx: "Pense nas obrigações da empresa com terceiros.",
    options: ["Bens e direitos", "Dívidas e obrigações", "Lucro acumulado", "Entradas de caixa"],
    answer: 1,
    tip: "Passivo = obrigações que a empresa precisa pagar."
  },
  {
    q: "Depreciação de máquinas é classificada como:",
    ctx: "Perda de valor pelo uso e tempo.",
    options: ["Receita", "Despesa", "Ativo circulante", "Empréstimo"],
    answer: 1,
    tip: "Depreciação é despesa, reduzindo o resultado do período."
  },
  {
    q: "Qual equação contábil básica está correta?",
    ctx: "Base da contabilidade patrimonial.",
    options: ["Ativo = Passivo + Patrimônio Líquido", "Passivo = Ativo + Receita", "Patrimônio = Receita - Ativo", "Ativo = Lucro + Despesa"],
    answer: 0,
    tip: "Essa é a equação fundamental: recursos = fontes de recursos."
  },
  {
    q: "Pagamento de fornecedor em dinheiro gera:",
    ctx: "Quitar dívida de R$ 800 com caixa.",
    options: ["Diminui passivo e diminui ativo", "Aumenta passivo", "Aumenta receita", "Diminui despesa"],
    answer: 0,
    tip: "Ao pagar fornecedor, cai caixa (ativo) e cai obrigação (passivo)."
  },
  {
    q: "Qual item é exemplo de ativo circulante?",
    ctx: "Conta com conversão de curto prazo.",
    options: ["Máquinas", "Imóvel", "Caixa", "Marca registrada"],
    answer: 2,
    tip: "Caixa é ativo circulante por estar disponível de imediato."
  },
  {
    q: "Lucro líquido é, de forma simples:",
    ctx: "Após considerar receitas e despesas.",
    options: ["Receitas - despesas", "Ativos - passivos", "Caixa - estoque", "Vendas - caixa"],
    answer: 0,
    tip: "Lucro líquido é o resultado final depois dos gastos do período."
  },
  {
    q: "Qual livro registra os fatos contábeis em ordem cronológica?",
    ctx: "Obrigatório para escrituração.",
    options: ["Livro Diário", "Livro Razão apenas", "Fluxo de caixa", "Plano de contas"],
    answer: 0,
    tip: "Livro Diário registra eventos em sequência temporal."
  }
];

let round = 0, score = 0, lives = 3;
let answered = false;

const el = id => document.getElementById(id);

function updateHUD() {
  el("score").textContent = score;
  el("round").textContent = Math.min(round + 1, questions.length);
  el("lives").textContent = lives;
}

function renderQuestion() {
  const item = questions[round];
  el("question").textContent = item.q;
  el("context").textContent = item.ctx;
  el("feedback").textContent = "";
  el("tip").textContent = "Responda para ver a explicação didática.";
  answered = false;
  el("nextBtn").disabled = true;

  const optionsBox = el("options");
  optionsBox.innerHTML = "";
  item.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.onclick = () => checkAnswer(idx, btn);
    optionsBox.appendChild(btn);
  });
  updateHUD();
}

function checkAnswer(idx, btn) {
  if (answered) return;
  answered = true;
  const item = questions[round];
  const buttons = [...document.querySelectorAll(".option-btn")];

  if (idx === item.answer) {
    score += 10;
    btn.classList.add("correct");
    el("feedback").textContent = "✅ Correto! +10 pontos.";
  } else {
    lives -= 1;
    btn.classList.add("wrong");
    buttons[item.answer].classList.add("correct");
    el("feedback").textContent = "❌ Resposta incorreta.";
  }

  buttons.forEach(b => b.disabled = true);
  el("tip").textContent = item.tip;
  updateHUD();

  if (lives <= 0 || round === questions.length - 1) {
    endGame();
  } else {
    el("nextBtn").disabled = false;
  }
}

function nextRound() {
  if (round < questions.length - 1) {
    round += 1;
    renderQuestion();
  }
}

function endGame() {
  el("nextBtn").disabled = true;
  el("restartBtn").disabled = false;
  const result = lives <= 0 ? "Você perdeu suas vidas." : "Você concluiu o desafio.";
  el("question").textContent = `${result} Pontuação final: ${score}`;
  el("context").textContent = "Clique em Reiniciar para jogar novamente e reforçar o aprendizado.";
}

function startGame() {
  round = 0; score = 0; lives = 3;
  el("restartBtn").disabled = true;
  renderQuestion();
}

el("startBtn").onclick = startGame;
el("nextBtn").onclick = nextRound;
el("restartBtn").onclick = startGame;
