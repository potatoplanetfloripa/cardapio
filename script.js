let pedidoAcompanhamentoAberto = null;
let timeoutStatusCliente = null;
const URL_CONTROLE =
  'https://script.google.com/macros/s/AKfycbxtEiOTWzHDTC2CO3XKG5rb-KEE2lPr6tz6RBHojLpUfQZHwoi5CS_Y0NOaQDFP71uTVA/exec';

const URL_LICENCIAMENTO =
  "https://script.google.com/macros/s/AKfycbwwm9HvLqcAuaw09ssIqZtvNastFXPdAHtPUBjtFZiME8bScF53TiAef6pqFxEENYHT/exec";

const CARDAPIO_ID = "card_54834e968305";

async function verificarLicencaPublica() {
  const parametros = new URLSearchParams({
    acao: "consultarLicenca",
    cardapioId: CARDAPIO_ID,
    t: Date.now().toString(),
  });

  const resposta = await fetch(
    `${URL_LICENCIAMENTO}?${parametros.toString()}`,
    {
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    throw new Error("Não foi possível verificar a licença.");
  }

  const dados = await resposta.json();

  if (!dados || typeof dados.permitido !== "boolean") {
    throw new Error("Resposta inválida ao verificar a licença.");
  }

  return dados;
}

function mostrarTelaManutencao() {
  document.body.className = "pagina-manutencao";

  document.body.innerHTML = `
    <div class="tela-manutencao">
      <div class="manutencao-conteudo">
        <div class="manutencao-emoji">
          🚧
        </div>

        <div class="manutencao-texto">
          <h1>Cardápio temporariamente indisponível</h1>

          <p>
            Estamos realizando uma manutenção temporária em nosso cardápio.
          </p>
        </div>
      </div>
    </div>
  `;
}


let API_URL = "";
const TEMPO_PEDIDO_AGUARDANDO = 1 * 60 * 60 * 1000;
const TEMPO_PEDIDO_PAGO = 2 * 60 * 60 * 1000;

let controleProdutos = [];
let gruposComplementos = [];
let produtosComplementos = [];
let estoqueInsumos = [];
let vinculosEstoque = [];
let categoriasCardapio = [];
let cuponsDisponiveis = [];
let cupomAplicado = null;
let perfilLoja = {
  NomeLoja: "",
  FotoPerfil: "",
  DescricaoLoja: "",
  WhatsAppSuporte: "",
  MensagemAjudaPedido:
    "Olá, tive um problema com meu pedido {pedido}. Pode me ajudar?",
  Instagram: "",
  TempoPreparo: "",
  PedidoMinimo: "",
  MensagemTopo: "",
  TemaCor: "MARROM",
  BannerAtivo: "NÃO",
  BannerURL: "",
  BannerLink: "",
  ApiPagamentoURL: "",
  PlanilhaURL: "",
  SenhaConfiguracoesAvancadas: "",
  RetiradaAtiva: "NÃO",
  RetiradaCEP: "",
  RetiradaLogradouro: "",
  RetiradaNumero: "",
  RetiradaComplemento: "",
  RetiradaBairro: "",
  RetiradaCidade: "",
  RetiradaUF: "",
  RetiradaReferencia: "",
};

let tabelaFrete = {};
let pedidoFinalizando = false;
let tipoEntregaSelecionado = "entrega";
let freteAtivoCardapio = '';
let enderecoAtendido = false;
let consultaCepEmAndamento = false;
let etapaCarrinhoAtual = 1;
let timeoutConsultaCepCarrinho = null;
let ultimoCepConsultado = "";
let animacaoEtapaCarrinhoEmAndamento = false;
let verificacaoContinuarEmAndamento = false;
let timeoutMensagemAdicionado = null;
const TEMPO_ATUALIZACAO_FRETE = 30 * 1000;
const TEMPO_ATUALIZACAO_PRODUTOS = 30 * 1000;

let horariosLoja = [];
let lojaAbertaAgora = false;

const TEMPO_ATUALIZACAO_HORARIO = 30 * 1000;

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarPreco(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

function converterValorCardapio(valor) {
  if (valor === "" || valor === null || valor === undefined) return 0;

  const texto = String(valor)
    .replace("R$", "")
    .replace(/\s/g, "")
    .trim();

  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }

  return Number(texto) || 0;
}

let ultimoAlertaCardapio = {
  mensagem: "",
  horario: 0,
};

function mostrarAlerta(
  mensagem,
  tipo = "aviso",
  duracao = 4500,
) {
  const texto = String(mensagem || "").trim();

  if (!texto) return;

  const tiposPermitidos = [
    "sucesso",
    "erro",
    "aviso",
  ];

  const tipoFinal = tiposPermitidos.includes(tipo)
    ? tipo
    : "aviso";

  const agora = Date.now();

  if (
    ultimoAlertaCardapio.mensagem === texto &&
    agora - ultimoAlertaCardapio.horario < 1200
  ) {
    return;
  }

  ultimoAlertaCardapio = {
    mensagem: texto,
    horario: agora,
  };

  let container =
    document.getElementById("alertas-cardapio");

  if (!container) {
    container = document.createElement("div");
    container.id = "alertas-cardapio";
    container.setAttribute("aria-live", "polite");

    document.body.appendChild(container);
  }

  const icones = {
    sucesso: "🟢",
    erro: "🔴",
    aviso: "🟡",
  };

  const alerta = document.createElement("div");

  alerta.className =
    `alerta-cardapio alerta-${tipoFinal}`;

  const icone = document.createElement("span");
  icone.className = "alerta-cardapio-icone";
  icone.textContent = icones[tipoFinal];

  const textoAlerta = document.createElement("p");
  textoAlerta.className = "alerta-cardapio-texto";
  textoAlerta.textContent = texto;

  const botaoFechar =
    document.createElement("button");

  botaoFechar.type = "button";
  botaoFechar.className =
    "alerta-cardapio-fechar";

  botaoFechar.textContent = "×";
  botaoFechar.setAttribute(
    "aria-label",
    "Fechar aviso",
  );

  alerta.append(
    icone,
    textoAlerta,
    botaoFechar,
  );

  container.appendChild(alerta);

  function removerAlerta() {
    if (alerta.classList.contains("saindo")) {
      return;
    }

    alerta.classList.add("saindo");

    setTimeout(() => {
      alerta.remove();

      if (container.children.length === 0) {
        container.remove();
      }
    }, 220);
  }

  botaoFechar.addEventListener(
    "click",
    removerAlerta,
  );

  requestAnimationFrame(() => {
    alerta.classList.add("visivel");
  });

  setTimeout(removerAlerta, duracao);
}

function mostrarConfirmacao({
  titulo = "Confirmar ação",
  mensagem = "",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  tipo = "aviso",
  aoConfirmar,
}) {
  const confirmacaoAnterior =
    document.getElementById(
      "confirmacao-cardapio",
    );

  if (confirmacaoAnterior) {
    confirmacaoAnterior.remove();
  }

  const icones = {
    sucesso: "🟢",
    erro: "🔴",
    aviso: "🟡",
  };

  const tipoFinal =
    icones[tipo] ? tipo : "aviso";

  const overlay =
    document.createElement("div");

  overlay.id = "confirmacao-cardapio";
  overlay.className =
    "confirmacao-cardapio-overlay";

  overlay.innerHTML = `
    <div
      class="confirmacao-cardapio"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmacao-cardapio-titulo"
    >
      <div class="confirmacao-cardapio-topo">
        <span class="confirmacao-cardapio-icone">
          ${icones[tipoFinal]}
        </span>

        <h3 id="confirmacao-cardapio-titulo">
          ${titulo}
        </h3>
      </div>

      <p class="confirmacao-cardapio-mensagem">
        ${mensagem}
      </p>

      <div class="confirmacao-cardapio-acoes">
        <button
          type="button"
          class="confirmacao-cardapio-cancelar"
        >
          ${textoCancelar}
        </button>

        <button
          type="button"
          class="confirmacao-cardapio-confirmar"
        >
          ${textoConfirmar}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const modal =
    overlay.querySelector(
      ".confirmacao-cardapio",
    );

  const botaoCancelar =
    overlay.querySelector(
      ".confirmacao-cardapio-cancelar",
    );

  const botaoConfirmar =
    overlay.querySelector(
      ".confirmacao-cardapio-confirmar",
    );

  function fecharConfirmacao() {
    overlay.classList.remove("visivel");

    setTimeout(() => {
      overlay.remove();
    }, 220);
  }

  botaoCancelar.addEventListener(
    "click",
    fecharConfirmacao,
  );

  botaoConfirmar.addEventListener(
    "click",
    () => {
      fecharConfirmacao();

      if (typeof aoConfirmar === "function") {
        aoConfirmar();
      }
    },
  );

  overlay.addEventListener(
    "click",
    (evento) => {
      if (evento.target === overlay) {
        fecharConfirmacao();
      }
    },
  );

  function fecharComEsc(evento) {
    if (evento.key !== "Escape") return;

    fecharConfirmacao();

    document.removeEventListener(
      "keydown",
      fecharComEsc,
    );
  }

  document.addEventListener(
    "keydown",
    fecharComEsc,
  );

  requestAnimationFrame(() => {
    overlay.classList.add("visivel");
    modal.classList.add("visivel");
    botaoCancelar.focus();
  });
}

function carregarTabelaFrete() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberFretesCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) {
          reject('Erro ao carregar fretes.');
          return;
        }

        tabelaFrete = {};
        freteAtivoCardapio = resultado.freteAtivo;

        resultado.bairros.forEach(item => {
          const status = String(item.status || '').trim();

          if (status !== 'Ativo') return;

          const bairro = normalizarTexto(item.bairro || '');
          const valor = Number(item.valores[resultado.freteAtivo]);

          if (bairro && valor > 0) {
            tabelaFrete[bairro] = valor;
          }
        });

        localStorage.setItem(
          'fretesAtualizadosEm',
          String(Date.now())
        );

        resolve();
      } catch (erro) {
        reject(erro);
      } finally {
        delete window[callbackName];
        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterFretes&callback=${callbackName}&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];
      reject('Erro ao buscar fretes.');
    };

    document.body.appendChild(script);
  });
}
function carregarCuponsCardapio() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberCuponsCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) {
          reject("Erro ao carregar cupons.");
          return;
        }

        cuponsDisponiveis = resultado.cupons || [];

        const codigoCupomSalvo = localStorage.getItem("cupomAplicado");

        if (codigoCupomSalvo) {
          const cupomValido = cuponsDisponiveis.find((item) => {
            return (
              String(item.Cupom || "").trim().toUpperCase() ===
              codigoCupomSalvo.toUpperCase() &&
              String(item.Status || "").trim() === "Ativo"
            );
          });

          cupomAplicado = cupomValido || null;

          if (!cupomValido) {
            localStorage.removeItem("cupomAplicado");
          }
        }

        resolve();
      } catch (erro) {
        reject(erro);
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterCupons&callback=${callbackName}&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];
      reject("Erro ao buscar cupons.");
    };

    document.body.appendChild(script);
  });
}

function carregarHorariosLoja() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberHorariosCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) {
          reject("Erro ao carregar horários.");
          return;
        }

        horariosLoja = resultado.horarios || [];

        atualizarStatusHorarioLoja();

        resolve();
      } catch (erro) {
        reject(erro);
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterHorarios&callback=${callbackName}&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];
      reject("Erro ao buscar horários.");
    };

    document.body.appendChild(script);
  });
}


function calcularDescontoCupom(subtotal, frete) {
  if (!cupomAplicado) return 0;

  const aplicaEm =
    String(cupomAplicado["Aplica Em"] || cupomAplicado["Aplica em"] || "")
      .trim()
      .toLowerCase();

  const tipo = String(cupomAplicado.Tipo || "").trim();
  const valor = Number(cupomAplicado.Valor || 0);
  const pedidoMinimo = Number(cupomAplicado["Pedido Mínimo"] || 0);
  const descontoMaximo = Number(cupomAplicado["Desconto Máximo"] || 0);

  if (subtotal < pedidoMinimo) return 0;

  const baseDesconto = aplicaEm === "frete" ? frete : subtotal;

  let desconto = tipo === "%" ? baseDesconto * (valor / 100) : valor;

  if (descontoMaximo > 0 && desconto > descontoMaximo) {
    desconto = descontoMaximo;
  }

  if (desconto > baseDesconto) {
    desconto = baseDesconto;
  }

  return desconto;
}

function atualizarMensagemCupom(
  texto = "",
  tipo = "",
) {
  const mensagem =
    document.getElementById(
      "cupom-mensagem",
    );

  if (!mensagem) return;

  mensagem.classList.remove(
    "cupom-mensagem-sucesso",
    "cupom-mensagem-erro",
    "cupom-mensagem-aviso",
    "cupom-mensagem-animada",
  );

  mensagem.textContent = texto;

  if (!texto) {
    mensagem.style.display = "none";
    return;
  }

  mensagem.style.display = "block";

  if (tipo) {
    mensagem.classList.add(
      `cupom-mensagem-${tipo}`,
    );
  }

  void mensagem.offsetWidth;

  mensagem.classList.add(
    "cupom-mensagem-animada",
  );
}

async function aplicarCupom() {
  const input =
    document.getElementById(
      "cupom-input",
    );

  const botao =
    document.getElementById(
      "aplicar-cupom",
    );

  if (!input || !botao) return;

  if (cupomAplicado) {
    mostrarAlerta(
      "Remova o cupom atual antes de aplicar outro.",
      "aviso",
    );

    return;
  }

  if (botao.disabled) {
    return;
  }

  const codigo =
    input.value.trim().toUpperCase();

  atualizarMensagemCupom();

  if (!codigo) {
    atualizarMensagemCupom(
      "Digite um cupom.",
      "aviso",
    );

    input.focus();
    return;
  }

  const textoOriginalBotao =
    botao.textContent;

  botao.disabled = true;
  botao.textContent = "Validando...";

  botao.classList.add(
    "botao-carregando",
  );

  function liberarBotaoCupom() {
    botao.disabled = false;

    botao.textContent =
      textoOriginalBotao || "Aplicar";

    botao.classList.remove(
      "botao-carregando",
    );
  }

  try {
    await carregarCuponsCardapio();
  } catch (erro) {
    console.error(
      "Erro ao carregar cupons:",
      erro,
    );

    atualizarMensagemCupom(
      "Não foi possível validar o cupom agora. Tente novamente.",
      "erro",
    );

    liberarBotaoCupom();
    return;
  }

  const cupom =
    cuponsDisponiveis.find((item) => {
      return (
        String(item.Cupom || "")
          .trim()
          .toUpperCase() === codigo
      );
    });

  if (!cupom) {
    atualizarMensagemCupom(
      "Cupom não encontrado.",
      "erro",
    );

    liberarBotaoCupom();
    return;
  }

  if (
    String(cupom.Status || "").trim() !==
    "Ativo"
  ) {
    atualizarMensagemCupom(
      "Este cupom não está ativo.",
      "erro",
    );

    liberarBotaoCupom();
    return;
  }

  const pedidos =
    JSON.parse(
      localStorage.getItem("pedidos"),
    ) || [];

  const endereco =
    JSON.parse(
      localStorage.getItem("endereco"),
    );

  let subtotal = 0;

  pedidos.forEach((pedido) => {
    subtotal +=
      Number(pedido.totalPrice || 0) *
      (parseInt(pedido.quantidade) || 1);
  });

  if (
    pedidos.length === 0 ||
    subtotal <= 0
  ) {
    atualizarMensagemCupom(
      "Adicione itens ao pedido antes de usar um cupom.",
      "aviso",
    );

    liberarBotaoCupom();
    return;
  }

  const aplicaEm =
    String(
      cupom["Aplica Em"] ||
      cupom["Aplica em"] ||
      "",
    )
      .trim()
      .toLowerCase();

  const pedidoMinimo =
    Number(
      cupom["Pedido Mínimo"] || 0,
    );

  if (subtotal < pedidoMinimo) {
    atualizarMensagemCupom(
      `Este cupom é válido apenas para pedidos acima de R$${formatarPreco(pedidoMinimo)}.`,
      "aviso",
    );

    liberarBotaoCupom();
    return;
  }

  if (
    tipoEntregaSelecionado ===
    "retirada" &&
    aplicaEm === "frete"
  ) {
    atualizarMensagemCupom(
      "Este cupom é válido apenas para entrega.",
      "aviso",
    );

    liberarBotaoCupom();
    return;
  }

  if (
    aplicaEm === "frete" &&
    tipoEntregaSelecionado ===
    "entrega" &&
    (
      !endereco ||
      !endereco.frete ||
      Number(endereco.frete) <= 0
    )
  ) {
    atualizarMensagemCupom(
      "Informe um CEP atendido para aplicar este cupom no frete.",
      "aviso",
    );

    liberarBotaoCupom();
    return;
  }

  cupomAplicado = cupom;

  localStorage.setItem(
    "cupomAplicado",
    codigo,
  );

  /*
   * Primeiro atualiza o resumo.
   * Se houver um erro apenas na interface,
   * ele não será tratado como falha
   * na validação do cupom.
   */
  try {
    atualizarResumoPedido();
  } catch (erro) {
    console.error(
      "Erro ao atualizar interface do cupom:",
      erro,
    );
  }

  /*
   * A etiqueta já informa qual cupom
   * está aplicado, então limpamos
   * a mensagem local.
   */
  atualizarMensagemCupom();

  mostrarAlerta(
    `Cupom ${codigo} aplicado com sucesso.`,
    "sucesso",
  );

  liberarBotaoCupom();
}

function removerCupom() {
  if (!cupomAplicado) {
    return;
  }

  const codigoRemovido =
    String(
      cupomAplicado.Cupom || "",
    ).trim();

  cupomAplicado = null;

  localStorage.removeItem(
    "cupomAplicado",
  );

  const input =
    document.getElementById(
      "cupom-input",
    );

  if (input) {
    input.value = "";
  }

  atualizarMensagemCupom();

  atualizarResumoPedido();

  mostrarAlerta(
    codigoRemovido
      ? `Cupom ${codigoRemovido} removido.`
      : "Cupom removido.",
    "aviso",
  );
}

function calcularFretePorBairro(bairro) {
  const bairroNormalizado = normalizarTexto(bairro);
  return tabelaFrete[bairroNormalizado] || null;
}

function bloquearCamposRetornadosPeloCep() {
  const rua = document.getElementById("rua-cliente");
  const bairro = document.getElementById("bairro-cliente");
  const cidade = document.getElementById("cidade-cliente");

  if (rua) rua.readOnly = true;
  if (bairro) bairro.readOnly = true;
  if (cidade) cidade.readOnly = true;
}

function exibirEtapaCarrinho(numeroEtapa, animar = true) {
  if (animacaoEtapaCarrinhoEmAndamento) return;

  const etapaAnterior = etapaCarrinhoAtual;

  const etapa1 =
    document.getElementById("etapa-carrinho-1");

  const etapa2 =
    document.getElementById("etapa-carrinho-2");

  const indicador1 =
    document.getElementById("indicador-etapa-1");

  const indicador2 =
    document.getElementById("indicador-etapa-2");

  const titulo =
    document.getElementById("titulo-etapa-carrinho");

  const resumo =
    document.getElementById("resumo-pedido");

  const etapaSaindo =
    etapaAnterior === 1 ? etapa1 : etapa2;

  const etapaEntrando =
    numeroEtapa === 1 ? etapa1 : etapa2;

  const avancando = numeroEtapa > etapaAnterior;

  if (!etapaEntrando) return;

  function atualizarIndicadores() {
    etapaCarrinhoAtual = numeroEtapa;

    if (indicador1) {
      indicador1.classList.toggle(
        "ativa",
        numeroEtapa === 1,
      );

      indicador1.classList.toggle(
        "concluida",
        numeroEtapa === 2,
      );
    }

    if (indicador2) {
      indicador2.classList.toggle(
        "ativa",
        numeroEtapa === 2,
      );
    }

    if (titulo) {
      titulo.textContent =
        numeroEtapa === 1
          ? "Seu Pedido"
          : "Dados do Pedido";
    }
  }

  function rolarCarrinhoParaTopo() {
    if (!resumo) return;

    resumo.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (
    !animar ||
    etapaAnterior === numeroEtapa ||
    !etapaSaindo
  ) {
    if (etapa1) {
      etapa1.classList.toggle(
        "ativa",
        numeroEtapa === 1,
      );
    }

    if (etapa2) {
      etapa2.classList.toggle(
        "ativa",
        numeroEtapa === 2,
      );
    }

    atualizarIndicadores();
    rolarCarrinhoParaTopo();
    focarPrimeiroCampoEtapa(numeroEtapa);

    return;
  }

  animacaoEtapaCarrinhoEmAndamento = true;

  etapaSaindo.classList.remove(
    "saindo-esquerda",
    "saindo-direita",
  );

  etapaEntrando.classList.remove(
    "entrando-direita",
    "entrando-esquerda",
  );

  etapaSaindo.classList.add(
    avancando
      ? "saindo-esquerda"
      : "saindo-direita",
  );

  setTimeout(() => {
    etapaSaindo.classList.remove(
      "ativa",
      "saindo-esquerda",
      "saindo-direita",
    );

    etapaEntrando.classList.add(
      "ativa",
      avancando
        ? "entrando-direita"
        : "entrando-esquerda",
    );

    atualizarIndicadores();
    rolarCarrinhoParaTopo();

    requestAnimationFrame(() => {
      etapaEntrando.classList.add(
        "entrada-etapa-visivel",
      );
    });

    setTimeout(() => {
      etapaEntrando.classList.remove(
        "entrando-direita",
        "entrando-esquerda",
        "entrada-etapa-visivel",
      );

      animacaoEtapaCarrinhoEmAndamento = false;

      focarPrimeiroCampoEtapa(numeroEtapa);
      atualizarEstadoBotoesCheckout();
    }, 280);
  }, 180);
}

function focarPrimeiroCampoEtapa(numeroEtapa) {
  if (numeroEtapa !== 2) return;

  const nomeCliente =
    document.getElementById("nome-cliente");

  const whatsappCliente =
    document.getElementById("whatsapp-cliente");

  const numeroCliente =
    document.getElementById("numero-cliente");

  if (
    nomeCliente &&
    !nomeCliente.value.trim()
  ) {
    nomeCliente.focus();
    return;
  }

  if (
    whatsappCliente &&
    !whatsappCliente.value.trim()
  ) {
    whatsappCliente.focus();
    return;
  }

  if (
    tipoEntregaSelecionado === "entrega" &&
    numeroCliente &&
    !numeroCliente.value.trim()
  ) {
    numeroCliente.focus();
  }
}

function voltarParaEtapaCarrinho() {
  exibirEtapaCarrinho(1);
}

function calcularSubtotalCarrinho() {
  const pedidos =
    JSON.parse(localStorage.getItem("pedidos")) || [];

  return pedidos.reduce((total, pedido) => {
    const quantidade = parseInt(pedido.quantidade) || 1;
    const valor = Number(pedido.totalPrice) || 0;

    return total + valor * quantidade;
  }, 0);
}

function atualizarEstadoBotoesCheckout() {
  const botaoContinuar =
    document.getElementById("continuar-pedido");

  const botaoFinalizar =
    document.getElementById("confirmar-pedido");

  const pedidos =
    JSON.parse(localStorage.getItem("pedidos")) || [];

  const subtotal = calcularSubtotalCarrinho();

  const pedidoMinimo =
    converterValorCardapio(perfilLoja.PedidoMinimo);

  const cepCarrinho =
    document.getElementById("cep-carrinho");

  const nomeCliente =
    document.getElementById("nome-cliente");

  const whatsappCliente =
    document.getElementById("whatsapp-cliente");

  const numeroCliente =
    document.getElementById("numero-cliente");

  /*
   * ETAPA 1 — BOTÃO CONTINUAR
   */
  if (botaoContinuar) {
    let continuarLiberado = true;
    let textoContinuar = "Continuar →";
    let estadoContinuar = "pronto";

    if (pedidos.length === 0) {
      continuarLiberado = false;
      textoContinuar = "Adicione um produto";
      estadoContinuar = "bloqueado";
    } else if (
      pedidoMinimo > 0 &&
      subtotal < pedidoMinimo
    ) {
      continuarLiberado = false;
      textoContinuar =
        `Pedido mínimo R$${formatarPreco(pedidoMinimo)}`;
      estadoContinuar = "bloqueado";
    } else if (
      tipoEntregaSelecionado === "entrega"
    ) {
      const cepNumeros = String(
        cepCarrinho?.value || "",
      ).replace(/\D/g, "");

      if (cepNumeros.length !== 8) {
        continuarLiberado = false;
        textoContinuar = "Informe seu CEP";
        estadoContinuar = "bloqueado";
      } else if (consultaCepEmAndamento) {
        continuarLiberado = false;
        textoContinuar = "Calculando entrega...";
        estadoContinuar = "carregando";
      } else if (!enderecoAtendido) {
        continuarLiberado = false;
        textoContinuar = "CEP indisponível";
        estadoContinuar = "erro";
      }
    }

    botaoContinuar.disabled = !continuarLiberado;
    botaoContinuar.textContent = textoContinuar;
    botaoContinuar.dataset.estado = estadoContinuar;
  }

  /*
   * ETAPA 2 — BOTÃO FINALIZAR
   */
  if (botaoFinalizar && !pedidoFinalizando) {
    const nomeValido =
      String(nomeCliente?.value || "").trim().length > 0;

    const whatsappNumeros =
      String(whatsappCliente?.value || "")
        .replace(/\D/g, "");

    const whatsappValido =
      whatsappNumeros.length >= 10;

    let dadosFinaisValidos =
      nomeValido && whatsappValido;

    if (tipoEntregaSelecionado === "entrega") {
      const numeroValido =
        String(numeroCliente?.value || "").trim().length > 0;

      dadosFinaisValidos =
        dadosFinaisValidos &&
        numeroValido &&
        enderecoAtendido &&
        !consultaCepEmAndamento;
    }

    botaoFinalizar.disabled = false;

    botaoFinalizar.textContent =
      dadosFinaisValidos
        ? "Finalizar Pedido"
        : "Revisar dados";

    botaoFinalizar.dataset.estado =
      dadosFinaisValidos
        ? "pronto"
        : "incompleto";
  }
}

function iniciarVerificacaoContinuar() {
  if (verificacaoContinuarEmAndamento) {
    return false;
  }

  verificacaoContinuarEmAndamento = true;

  const botao =
    document.getElementById("continuar-pedido");

  if (botao) {
    botao.disabled = true;
    botao.dataset.estado = "carregando";
    botao.textContent = "Verificando...";
  }

  return true;
}

function finalizarVerificacaoContinuar(
  sucesso = false,
) {
  const botao =
    document.getElementById("continuar-pedido");

  if (sucesso && botao) {
    botao.dataset.estado = "sucesso";
    botao.textContent = "✓ Continuar";

    setTimeout(() => {
      verificacaoContinuarEmAndamento = false;
      atualizarEstadoBotoesCheckout();
    }, 180);

    return;
  }

  verificacaoContinuarEmAndamento = false;
  atualizarEstadoBotoesCheckout();
}

async function consultarEstoqueCarrinho() {
  const pedidos =
    JSON.parse(localStorage.getItem("pedidos")) || [];

  if (!pedidos.length) {
    return {
      sucesso: false,
      erro: "Adicione pelo menos um produto ao carrinho.",
    };
  }

  const parametros = new URLSearchParams({
    acao: "validarEstoquePedido",
    itens: JSON.stringify(pedidos),
    t: String(Date.now()),
  });

  const resposta = await fetch(
    `${URL_CONTROLE}?${parametros.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    throw new Error(
      `Erro HTTP ao consultar estoque: ${resposta.status}`,
    );
  }

  let dados;

  try {
    dados = await resposta.json();
  } catch (erro) {
    throw new Error(
      "A consulta de estoque não retornou uma resposta válida.",
    );
  }

  if (!dados || typeof dados.sucesso !== "boolean") {
    throw new Error(
      "A consulta de estoque retornou dados incompletos.",
    );
  }

  return dados;
}

async function irParaEtapaDados() {
  if (!iniciarVerificacaoContinuar()) {
    return;
  }

  const pedidos =
    JSON.parse(localStorage.getItem("pedidos")) || [];

  if (pedidos.length === 0) {
    mostrarAlerta(
      "Adicione pelo menos um produto ao carrinho.",
      "aviso",
    );
    finalizarVerificacaoContinuar();
    return;
  }

  try {
    await carregarHorariosLoja();
  } catch (erro) {
    console.error("Erro ao verificar horário:", erro);

    mostrarAlerta(
      "Não foi possível verificar o horário da loja. Tente novamente.",
      "erro",
    );

    finalizarVerificacaoContinuar();
    return;
  }

  if (!lojaAbertaAgora) {
    mostrarAlerta(
      "Estamos fora do horário de funcionamento. Confira os horários disponíveis antes de continuar.",
      "aviso",
    );

    finalizarVerificacaoContinuar();
    return;
  }

  const subtotal = calcularSubtotalCarrinho();

  const pedidoMinimo =
    converterValorCardapio(perfilLoja.PedidoMinimo);

  if (pedidoMinimo > 0 && subtotal < pedidoMinimo) {
    mostrarAlerta(
      `O pedido mínimo é de R$${formatarPreco(pedidoMinimo)} em produtos.`,
      "aviso",
    );

    finalizarVerificacaoContinuar();
    return;
  }

  if (tipoEntregaSelecionado === "entrega") {
    const cepCarrinho =
      document.getElementById("cep-carrinho");

    const cepNumeros = String(
      cepCarrinho?.value || "",
    ).replace(/\D/g, "");

    if (cepNumeros.length !== 8) {
      mostrarAlerta(
        "Informe um CEP válido para calcular a entrega.",
        "aviso",
      );

      cepCarrinho?.focus();
      finalizarVerificacaoContinuar();
      return;
    }

    if (consultaCepEmAndamento) {
      mostrarAlerta(
        "Aguarde o cálculo do frete.",
        "aviso",
      );
      finalizarVerificacaoContinuar();
      return;
    }

    if (!enderecoAtendido) {
      mostrarAlerta(
        "No momento não conseguimos atender este endereço. Consulte disponibilidade pelo iFood.",
        "aviso",
      );

      finalizarVerificacaoContinuar();
      return;
    }

    copiarCepEtapa1ParaEtapa2();
  }

  try {
    const botaoContinuar =
      document.getElementById("continuar-pedido");

    if (botaoContinuar) {
      botaoContinuar.disabled = true;
      botaoContinuar.dataset.estado = "carregando";
      botaoContinuar.textContent = "carregando...";
    }

    const dadosEstoque =
      await consultarEstoqueCarrinho();

    if (!dadosEstoque.sucesso) {
      mostrarAlerta(
        montarMensagemEstoque(dadosEstoque),
        "erro",
      );

      finalizarVerificacaoContinuar();
      return;
    }
  } catch (erro) {
    console.error(
      "Erro ao consultar estoque:",
      erro,
    );

    mostrarAlerta(
      "Não foi possível verificar o estoque. Tente novamente.",
      "erro",
    );

    finalizarVerificacaoContinuar();
    return;
  }

  finalizarVerificacaoContinuar(true);

  setTimeout(() => {
    atualizarExibicaoTipoEntregaEtapa2();
    atualizarResumoPedido();
    exibirEtapaCarrinho(2);
    atualizarEstadoBotoesCheckout();
  }, 180);
}

function copiarCepEtapa1ParaEtapa2() {
  const cepCarrinho =
    document.getElementById("cep-carrinho");

  const cepCliente =
    document.getElementById("cep-cliente");

  if (!cepCarrinho || !cepCliente) return;

  cepCliente.value = cepCarrinho.value;
}

function atualizarExibicaoTipoEntregaEtapa2() {
  const dadosEntrega =
    document.getElementById("dados-entrega-etapa-2");

  const dadosRetirada =
    document.getElementById("dados-retirada-etapa-2");

  if (dadosEntrega) {
    dadosEntrega.style.display =
      tipoEntregaSelecionado === "entrega"
        ? "block"
        : "none";
  }

  if (dadosRetirada) {
    dadosRetirada.style.display =
      tipoEntregaSelecionado === "retirada"
        ? "block"
        : "none";
  }
}

function atualizarFreteEnderecoSalvo() {
  const endereco =
    JSON.parse(localStorage.getItem("endereco"));

  if (!endereco || !endereco.bairro) {
    enderecoAtendido = false;
    atualizarResumoPedido();
    return;
  }

  const novoFrete =
    calcularFretePorBairro(endereco.bairro);

  if (novoFrete === null) {
    enderecoAtendido = false;

    endereco.frete = null;

    localStorage.setItem(
      "endereco",
      JSON.stringify(endereco),
    );

    mostrarFreteEndereco(null);
    atualizarResumoPedido();

    return;
  }

  enderecoAtendido = true;
  endereco.frete = novoFrete;

  localStorage.setItem(
    "endereco",
    JSON.stringify(endereco),
  );

  mostrarFreteEndereco(novoFrete);
  atualizarResumoPedido();
}

function atualizarStatusCepCheckout(
  tipo,
  mensagem,
) {
  const statusEtapa1 =
    document.getElementById("status-cep-carrinho");

  const statusEtapa2 =
    document.getElementById("status-cep-etapa-2");

  [statusEtapa1, statusEtapa2].forEach((status) => {
    if (!status) return;

    status.classList.remove(
      "status-cep-carregando",
      "status-cep-sucesso",
      "status-cep-erro",
    );

    if (!tipo || !mensagem) {
      status.textContent = "";
      status.style.display = "none";
      return;
    }

    status.textContent = mensagem;
    status.style.display = "block";
    status.classList.add(`status-cep-${tipo}`);
  });
}

function mostrarFreteEndereco(valor) {
  if (tipoEntregaSelecionado === "retirada") {
    atualizarStatusCepCheckout("", "");
    atualizarResumoPedido();
    return;
  }

  if (valor !== null && Number(valor) > 0) {
    atualizarStatusCepCheckout(
      "sucesso",
      `Entrega disponível — Frete R$${formatarPreco(valor)}`,
    );
  } else {
    atualizarStatusCepCheckout(
      "erro",
      "No momento não conseguimos atender este endereço.",
    );
  }

  atualizarResumoPedido();
}

function produtoAtivo(produto) {
  return (
    String(produto.Status || "").trim() === "ATIVO" &&
    produtoDisponivelPorEstoque(produto)
  );
}

function itemAtivo(nome) {
  const item = controleProdutos.find(
    produto =>
      produto.Nome?.trim() === nome &&
      produto.Status?.trim() === 'ATIVO'
  );

  return !!item;
}

function carregarPerfilLojaCardapio() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberPerfilLojaCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) {
          reject("Erro ao carregar perfil da loja.");
          return;
        }

        perfilLoja = {
          ...perfilLoja,
          ...(resultado.perfil || {}),
        };

        aplicarPerfilLojaCardapio();

        resolve();
      } catch (erro) {
        reject(erro);
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterPerfilLoja&callback=${callbackName}&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];
      reject("Erro ao buscar perfil.");
    };

    document.body.appendChild(script);
  });
}

function retiradaAtivaCardapio() {
  return String(perfilLoja.RetiradaAtiva || "NÃO").trim() === "SIM";
}

function obterDadosRetiradaCliente() {
  const nomeCliente = document.getElementById("nome-cliente");
  const whatsappCliente = document.getElementById("whatsapp-cliente");

  return {
    nome: nomeCliente ? nomeCliente.value.trim() : "",
    whatsapp: whatsappCliente ? whatsappCliente.value.trim() : "",
    tipoEntrega: "retirada",
    frete: 0,
    enderecoRetirada: montarEnderecoRetiradaCardapio()
  };
}

function montarEnderecoRetiradaCardapio() {
  const partes = [];

  const linha1 =
    `${perfilLoja.RetiradaLogradouro || ""}, ${perfilLoja.RetiradaNumero || ""}`.trim();

  if (linha1.replace(",", "").trim()) {
    partes.push(linha1);
  }

  if (perfilLoja.RetiradaComplemento) {
    partes.push(perfilLoja.RetiradaComplemento);
  }

  const linhaBairroCidade =
    `${perfilLoja.RetiradaBairro || ""} - ${perfilLoja.RetiradaCidade || ""}/${perfilLoja.RetiradaUF || ""}`.trim();

  if (linhaBairroCidade.replace("-", "").replace("/", "").trim()) {
    partes.push(linhaBairroCidade);
  }

  if (perfilLoja.RetiradaCEP) {
    partes.push(`CEP: ${perfilLoja.RetiradaCEP}`);
  }

  if (perfilLoja.RetiradaReferencia) {
    partes.push(`Referência: ${perfilLoja.RetiradaReferencia}`);
  }

  return partes.join("\n");
}

function gerarLinkMapsRetirada() {
  const endereco = [
    perfilLoja.RetiradaLogradouro,
    perfilLoja.RetiradaNumero,
    perfilLoja.RetiradaBairro,
    perfilLoja.RetiradaCidade,
    perfilLoja.RetiradaUF,
    perfilLoja.RetiradaCEP,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}


function atualizarTipoEntregaCardapio(tipo) {
  tipoEntregaSelecionado = tipo;

  localStorage.setItem(
    "tipoEntregaSelecionado",
    tipoEntregaSelecionado,
  );

  const btnEntrega =
    document.getElementById("btn-tipo-entrega");

  const btnRetirada =
    document.getElementById("btn-tipo-retirada");

  const boxCepEtapa1 =
    document.getElementById("box-cep-etapa-1");

  const boxRetiradaEtapa1 =
    document.getElementById(
      "box-info-retirada-etapa-1",
    );

  const textoRetiradaEtapa1 =
    document.getElementById(
      "texto-endereco-retirada-etapa-1",
    );

  const textoRetiradaEtapa2 =
    document.getElementById(
      "texto-endereco-retirada",
    );

  if (btnEntrega) {
    btnEntrega.classList.toggle(
      "ativo",
      tipo === "entrega",
    );
  }

  if (btnRetirada) {
    btnRetirada.classList.toggle(
      "ativo",
      tipo === "retirada",
    );
  }

  if (boxCepEtapa1) {
    boxCepEtapa1.style.display =
      tipo === "entrega" ? "block" : "none";
  }

  if (boxRetiradaEtapa1) {
    boxRetiradaEtapa1.style.display =
      tipo === "retirada" ? "block" : "none";
  }

  const enderecoRetiradaHtml = `
    <a
      href="${gerarLinkMapsRetirada()}"
      target="_blank"
      class="link-endereco-retirada"
    >
      ${montarEnderecoRetiradaCardapio().replace(/\n/g, "<br>")}
    </a>
  `;

  if (textoRetiradaEtapa1) {
    textoRetiradaEtapa1.innerHTML =
      enderecoRetiradaHtml;
  }

  if (textoRetiradaEtapa2) {
    textoRetiradaEtapa2.innerHTML =
      enderecoRetiradaHtml;
  }

  atualizarExibicaoTipoEntregaEtapa2();
  atualizarResumoPedido();
  atualizarEstadoBotoesCheckout();
}

function aplicarPerfilLojaCardapio() {
  const nomeLoja = perfilLoja.NomeLoja || "Nome da loja";
  document.body.classList.remove("carregando-perfil");
  document.title = nomeLoja;

  document.body.className = document.body.className
    .split(" ")
    .filter((classe) => !classe.startsWith("tema-"))
    .join(" ");

  const tema = String(perfilLoja.TemaCor || "MARROM").toLowerCase();

  document.body.classList.add(`tema-${tema}`);

  if (perfilLoja.ApiPagamentoURL) {
    API_URL = String(perfilLoja.ApiPagamentoURL)
      .trim()
      .replace(/\/$/, "");

    // Disponibiliza a URL para o push.js
    window.API_CARDAPIO_URL = API_URL;

    // Avisa que a URL foi carregada da planilha
    window.dispatchEvent(
      new CustomEvent("apiCardapioCarregada", {
        detail: {
          apiUrl: API_URL,
        },
      }),
    );
  }

  const favicon = document.getElementById("favicon");
  const shortcutIcon = document.getElementById("shortcut-icon");
  const appleTouchIcon = document.getElementById("apple-touch-icon");

  if (perfilLoja.FotoPerfil) {
    favicon.href = perfilLoja.FotoPerfil;
    shortcutIcon.href = perfilLoja.FotoPerfil;
    appleTouchIcon.href = perfilLoja.FotoPerfil;
  }

  const nome = document.getElementById("nome-loja-cardapio");
  if (nome) nome.textContent = nomeLoja;

  const logo = document.getElementById("logo-loja");
  if (logo) {
    if (perfilLoja.FotoPerfil) {
      logo.src = perfilLoja.FotoPerfil;
      logo.style.display = "block";
    } else {
      logo.style.display = "none";
    }
  }

  const descricao = document.getElementById("descricao-loja-cardapio");
  if (descricao) {
    descricao.textContent = perfilLoja.DescricaoLoja || "";
    descricao.style.display = perfilLoja.DescricaoLoja ? "block" : "none";
  }

  const info = document.getElementById(
    "info-loja-cardapio",
  );

  const tempoPreparo = document.getElementById(
    "tempo-preparo-cardapio",
  );

  const pedidoMinimo = document.getElementById(
    "pedido-minimo-cardapio",
  );

  const separadorInfo = document.getElementById(
    "separador-info-loja",
  );

  const possuiTempoPreparo = Boolean(
    String(perfilLoja.TempoPreparo || "").trim(),
  );

  const possuiPedidoMinimo =
    converterValorCardapio(perfilLoja.PedidoMinimo) > 0;

  if (tempoPreparo) {
    tempoPreparo.textContent = possuiTempoPreparo
      ? perfilLoja.TempoPreparo
      : "";

    tempoPreparo.style.display = possuiTempoPreparo
      ? ""
      : "none";
  }

  if (pedidoMinimo) {
    pedidoMinimo.textContent = possuiPedidoMinimo
      ? `Pedido mín. R$${formatarPreco(
        converterValorCardapio(perfilLoja.PedidoMinimo),
      )}`
      : "";

    pedidoMinimo.style.display = possuiPedidoMinimo
      ? ""
      : "none";
  }

  if (separadorInfo) {
    separadorInfo.style.display =
      possuiTempoPreparo && possuiPedidoMinimo
        ? ""
        : "none";
  }

  if (info) {
    info.style.display =
      possuiTempoPreparo || possuiPedidoMinimo
        ? "flex"
        : "none";
  }

  const mensagemTopo = document.getElementById("mensagem-topo-loja");
  if (mensagemTopo) {
    mensagemTopo.textContent = perfilLoja.MensagemTopo || "";
    mensagemTopo.style.display = perfilLoja.MensagemTopo ? "block" : "none";
  }

  const header = document.querySelector("header");
  const bannerLink = document.getElementById("banner-link-loja");
  const banner = document.getElementById("banner-loja");

  const bannerAtivo =
    String(perfilLoja.BannerAtivo || "NÃO").trim() === "SIM" &&
    perfilLoja.BannerURL;

  if (header) {
    header.classList.toggle("com-banner", !!bannerAtivo);
    header.classList.toggle("sem-banner", !bannerAtivo);
  }

  if (banner && bannerLink && bannerAtivo) {
    banner.src = perfilLoja.BannerURL;

    if (perfilLoja.BannerLink) {
      bannerLink.href = perfilLoja.BannerLink;
    } else {
      bannerLink.removeAttribute("href");
    }

    bannerLink.style.display = "block";
  } else if (bannerLink) {
    bannerLink.style.display = "none";
  }
  const rodape = document.getElementById("rodape-loja");
  const insta = document.getElementById("rodape-instagram");
  const whats = document.getElementById("rodape-whatsapp");

  let mostrarRodape = false;

  if (insta) {
    const instagram = String(perfilLoja.Instagram || "").trim().replace("@", "");

    if (instagram) {
      insta.href = `https://instagram.com/${instagram}`;
      insta.style.display = "inline-flex";
      mostrarRodape = true;
    } else {
      insta.style.display = "none";
    }
  }

  if (whats) {
    const whatsapp = String(perfilLoja.WhatsAppSuporte || "").replace(/\D/g, "");

    if (whatsapp) {
      whats.href = `https://wa.me/55${whatsapp}`;
      whats.style.display = "inline-flex";
      mostrarRodape = true;
    } else {
      whats.style.display = "none";
    }
  }

  if (rodape) {
    rodape.style.display = mostrarRodape ? "flex" : "none";
  }

  const boxTipoEntrega = document.getElementById("box-tipo-entrega");
  const opcoesTipoEntrega = document.querySelector(".opcoes-tipo-entrega");


  if (boxTipoEntrega) {
    boxTipoEntrega.style.display = "block";
  }

  if (opcoesTipoEntrega) {
    opcoesTipoEntrega.style.display = retiradaAtivaCardapio() ? "grid" : "none";
  }

  if (!retiradaAtivaCardapio()) {
    tipoEntregaSelecionado = "entrega";
    localStorage.setItem("tipoEntregaSelecionado", "entrega");
  } else {
    tipoEntregaSelecionado =
      localStorage.getItem("tipoEntregaSelecionado") || "entrega";
  }

  atualizarTipoEntregaCardapio(tipoEntregaSelecionado);
}

function carregarControleProdutos() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberProdutosCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) {
          reject("Erro ao carregar produtos.");
          return;
        }

        controleProdutos = resultado.produtos || [];

        console.log(
          "Produtos atualizados:",
          new Date().toLocaleTimeString()
        );

        resolve();
      } catch (erro) {
        reject(erro);
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterProdutosCardapio` +
      `&callback=${callbackName}` +
      `&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];
      reject("Erro ao buscar produtos.");
    };

    document.body.appendChild(script);
  });
}

function carregarComplementosCardapio() {
  return new Promise((resolve, reject) => {

    const callbackName = `receberComplementosCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) return;

        gruposComplementos = resultado.grupos || [];
        produtosComplementos = resultado.produtosComplementos || [];
        resolve();
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterComplementosCardapio` +
      `&callback=${callbackName}` +
      `&t=${Date.now()}`;
    script.onerror = reject;

    document.body.appendChild(script);
  });
}

function carregarCategoriasCardapio() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberCategoriasCardapio_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso) {
          reject("Erro ao carregar categorias.");
          return;
        }

        categoriasCardapio = resultado.categorias || [];
        resolve();
      } catch (erro) {
        reject(erro);
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterCategoriasCardapio` +
      `&callback=${callbackName}` +
      `&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];

      const script = document.getElementById(callbackName);
      if (script) script.remove();

      reject("Erro ao buscar categorias.");
    };

    document.body.appendChild(script);
  });
}

function criarIdCategoria(nomeCategoria, indice) {
  const nomeNormalizado = String(nomeCategoria || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `categoria-${nomeNormalizado || indice}`;
}

function renderizarMenuCategorias() {
  const navegacao = document.getElementById(
    "menu-navegacao-categorias",
  );

  const lista = document.getElementById(
    "lista-navegacao-categorias",
  );

  const secoes = Array.from(
    document.querySelectorAll(
      "#menu-container .menu-section",
    ),
  );

  if (!navegacao || !lista) return;

  lista.innerHTML = "";

  if (secoes.length === 0) {
    navegacao.style.display = "none";
    return;
  }

  secoes.forEach((secao, indice) => {
    const titulo = secao.querySelector("h2");

    if (!titulo) return;

    const nomeCategoria =
      String(titulo.textContent || "").trim();

    if (!nomeCategoria) return;

    if (!secao.id) {
      secao.id = criarIdCategoria(
        nomeCategoria,
        indice,
      );
    }

    const botao = document.createElement("button");

    botao.type = "button";
    botao.className =
      "botao-navegacao-categoria";

    botao.textContent = nomeCategoria;

    botao.dataset.categoriaId = secao.id;

    botao.setAttribute(
      "aria-label",
      `Ir para a categoria ${nomeCategoria}`,
    );

    botao.addEventListener("click", () => {
      document
        .querySelectorAll(
          ".botao-navegacao-categoria",
        )
        .forEach((item) => {
          item.classList.remove("ativo");
        });

      botao.classList.add("ativo");

      secao.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      botao.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    lista.appendChild(botao);
  });

  const primeiroBotao = lista.querySelector(
    ".botao-navegacao-categoria",
  );

  if (primeiroBotao) {
    primeiroBotao.classList.add("ativo");
  }

  navegacao.style.display = lista.children.length
    ? "block"
    : "none";
}

function renderizarProdutos() {
  const container = document.getElementById("menu-container");
  if (!container) return;

  container.innerHTML = "";

  const produtosPorNome = {};

  controleProdutos.forEach((produto) => {
    produtosPorNome[String(produto.Nome || "").trim()] = produto;
  });

  const categoriasAtivas = [...categoriasCardapio]
    .filter((categoria) => String(categoria.status || "").trim() === "ATIVO")
    .sort((a, b) => Number(a.ordem || 9999) - Number(b.ordem || 9999));

  categoriasAtivas.forEach((categoria) => {
    const produtosCategoria = (categoria.produtos || [])
      .filter((vinculo) => String(vinculo.status || "ATIVO").trim() === "ATIVO")
      .sort((a, b) => Number(a.ordem || 9999) - Number(b.ordem || 9999))
      .map((vinculo) => produtosPorNome[String(vinculo.produto || "").trim()])
      .filter((produto) => {
        return produto && produtoAtivo(produto) && produto.Tipo === "Produto";
      });

    if (produtosCategoria.length === 0) {
      return;
    }

    const secao = document.createElement("section");

    secao.className = "menu-section";

    secao.id = criarIdCategoria(
      categoria.categoria,
      container.querySelectorAll(
        ".menu-section",
      ).length,
    );

    secao.dataset.nomeCategoria =
      String(categoria.categoria || "").trim();

    const formatoCategoria = String(
      categoria.formato || "LISTA",
    ).trim();

    secao.innerHTML = `
    <h2>${categoria.categoria}</h2>
    <div 
      class="menu-items ${formatoCategoria === "GRADE" ? "menu-grade" : ""}"
      style="
        --mobile-colunas: ${categoria.mobilePorLinha || 2};
        --desktop-colunas: ${categoria.desktopPorLinha || 3};
      "
    ></div>
  `;

    const lista = secao.querySelector(".menu-items");

    produtosCategoria.forEach((produto) => {
      lista.innerHTML += montarHtmlProdutoCategoria(
        produto,
        categoria.categoria,
        formatoCategoria
      );
    });

    container.appendChild(secao);
  });

  renderizarMenuCategorias();
  ativarEventosProdutos();
}

function montarHtmlProdutoCategoria(
  produto,
  nomeCategoria,
  formatoCategoria = "LISTA",
) {
  const nome = produto.Nome;

  const precoDe = converterValorCardapio(
    produto.Preço ||
    produto.Preco ||
    0,
  );

  const precoPor = converterValorCardapio(
    produto.PrecoPor ||
    produto["Preço Por"] ||
    0,
  );

  const preco =
    precoPor > 0 && precoPor < precoDe
      ? precoPor
      : precoDe;

  const descricaoCompleta = String(
    produto.Descrição ||
    produto.Descricao ||
    "",
  ).trim();

  const descricaoLista =
    descricaoCompleta.length > 58
      ? `${descricaoCompleta.slice(0, 58).trim()}...`
      : descricaoCompleta;

  const imagem =
    produto.ImagemURL || "";

  const categoriaNormalizada =
    normalizarTexto(nomeCategoria);

  const categoriaPedido =
    categoriaNormalizada.includes("bebida")
      ? "bebida"
      : categoriaNormalizada.includes("doce")
        ? "doce"
        : "salgado";

  const temComplementos =
    produtoTemComplementosAtivos(nome);

  const adicaoDireta =
    !temComplementos;

  const htmlPreco =
    precoPor > 0 && precoPor < precoDe
      ? `
          <div class="preco-produto">
            <span class="preco-de">
              De R$${formatarPreco(precoDe)}
            </span>

            <strong class="preco-por">
              Por R$${formatarPreco(precoPor)}
            </strong>
          </div>
        `
      : `
          <p class="preco-normal">
            R$${formatarPreco(precoDe)}
          </p>
        `;

  const htmlAcoesDiretas = `
    <div class="drink-acoes produto-acoes-diretas">
      <div class="quantidade-container">
        <button
          type="button"
          class="qtd-btn qtd-menos"
          aria-label="Diminuir quantidade"
        >
          −
        </button>

        <input
          type="number"
          class="qtd-input"
          value="1"
          min="1"
          inputmode="numeric"
          aria-label="Quantidade"
        />

        <button
          type="button"
          class="qtd-btn qtd-mais"
          aria-label="Aumentar quantidade"
        >
          +
        </button>
      </div>

      <button
        type="button"
        class="add-drink"
      >
        Adicionar
      </button>
    </div>
  `;

  if (
    String(formatoCategoria)
      .trim()
      .toUpperCase() === "GRADE"
  ) {
    const classesProduto =
      adicaoDireta
        ? "drink produto-grade-card produto-adicao-direta"
        : "dish produto-grade-card produto-com-complementos";

    return `
      <div
        class="${classesProduto}"
        data-name="${nome}"
        data-price="${preco}"
        data-price-de="${precoDe}"
        data-price-por="${precoPor}"
        data-category="${categoriaPedido}"
      >
        <img
          src="${imagem}"
          alt="${nome}"
        />

        <div class="produto-grade-info">
          <h3>${nome}</h3>

          ${htmlPreco}

          ${descricaoLista
        ? `<p>${descricaoLista}</p>`
        : ""
      }

          ${adicaoDireta
        ? htmlAcoesDiretas
        : ""
      }
        </div>
      </div>
    `;
  }

  const classesProduto =
    adicaoDireta
      ? "drink produto-adicao-direta"
      : "dish produto-com-complementos";

  const classeInformacoes =
    adicaoDireta
      ? "drink-info"
      : "dish-info";

  return `
    <div
      class="${classesProduto}"
      data-name="${nome}"
      data-price="${preco}"
      data-price-de="${precoDe}"
      data-price-por="${precoPor}"
      data-category="${categoriaPedido}"
    >
      <img
        src="${imagem}"
        alt="${nome}"
      />

      <div class="${classeInformacoes}">
        <h3>${nome}</h3>

        ${htmlPreco}

        ${descricaoLista
      ? `<p>${descricaoLista}</p>`
      : ""
    }

        ${adicaoDireta
      ? htmlAcoesDiretas
      : ""
    }
      </div>
    </div>
  `;
}

async function carregarEstoqueCardapio() {
  await Promise.all([
    new Promise((resolve, reject) => {
      const callbackName = `receberEstoque_${Date.now()}`;

      window[callbackName] = function (resultado) {
        estoqueInsumos = resultado.insumos || [];

        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();

        resolve();
      };

      const script = document.createElement("script");
      script.id = callbackName;
      script.src =
        `${URL_CONTROLE}?acao=obterEstoque` +
        `&callback=${callbackName}` +
        `&t=${Date.now()}`;

      script.onerror = reject;

      document.body.appendChild(script);
    }),

    new Promise((resolve, reject) => {
      const callbackName = `receberVinculosEstoque_${Date.now()}`;

      window[callbackName] = function (resultado) {
        vinculosEstoque = resultado.vinculos || [];

        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();

        resolve();
      };

      const script = document.createElement("script");
      script.id = callbackName;
      script.src =
        `${URL_CONTROLE}?acao=obterVinculosEstoque` +
        `&callback=${callbackName}` +
        `&t=${Date.now()}`;

      script.onerror = reject;

      document.body.appendChild(script);
    }),
  ]);
}

function produtoDisponivelPorEstoque(produto) {
  const nomeProduto = String(produto.Nome || "").trim();

  if (!nomeProduto) return true;

  const vinculosProduto = (vinculosEstoque || []).filter((vinculo) => {
    return (
      String(vinculo.tipo || "").trim() === "Produto" &&
      String(vinculo.item || "").trim() === nomeProduto &&
      String(vinculo.status || "ATIVO").trim().toUpperCase() === "ATIVO"
    );
  });

  if (vinculosProduto.length === 0) return true;

  return vinculosProduto.every((vinculo) => {
    const nomeInsumo = String(vinculo.insumo || "").trim().toLowerCase();
    const quantidadeNecessaria = Number(vinculo.quantidade || 1);

    const insumo = (estoqueInsumos || []).find((item) => {
      return String(item.insumo || "").trim().toLowerCase() === nomeInsumo;
    });

    if (!insumo) return true;

    const status = String(insumo.status || "").trim().toUpperCase();

    if (status !== "ATIVO") {
      return false;
    }

    const quantidadeBruta = insumo.quantidade;

    if (
      quantidadeBruta === "" ||
      quantidadeBruta === null ||
      quantidadeBruta === undefined
    ) {
      return true;
    }

    const quantidadeDisponivel = Number(quantidadeBruta || 0);

    return quantidadeDisponivel >= quantidadeNecessaria;
  });
}

function complementoDisponivelPorEstoque(nomeComplemento) {
  const nome = String(nomeComplemento || "").trim();

  if (!nome) return true;

  const vinculosComplemento = (vinculosEstoque || []).filter((vinculo) => {
    return (
      String(vinculo.tipo || "").trim() === "Complemento" &&
      String(vinculo.item || "").trim() === nome &&
      String(vinculo.status || "ATIVO").trim().toUpperCase() === "ATIVO"
    );
  });

  if (vinculosComplemento.length === 0) return true;

  return vinculosComplemento.every((vinculo) => {
    const nomeInsumo = String(vinculo.insumo || "").trim().toLowerCase();
    const quantidadeNecessaria = Number(vinculo.quantidade || 1);

    const insumo = (estoqueInsumos || []).find((item) => {
      return String(item.insumo || "").trim().toLowerCase() === nomeInsumo;
    });

    if (!insumo) return true;

    const status = String(insumo.status || "").trim().toUpperCase();

    if (status !== "ATIVO") {
      return false;
    }

    const quantidadeBruta = insumo.quantidade;

    if (
      quantidadeBruta === "" ||
      quantidadeBruta === null ||
      quantidadeBruta === undefined
    ) {
      return true;
    }

    const quantidadeDisponivel = Number(quantidadeBruta || 0);

    return quantidadeDisponivel >= quantidadeNecessaria;
  });
}

function baixarEstoquePedidoCardapio(pedido) {
  const params = new URLSearchParams({
    acao: "baixarEstoquePedido",
    itens: JSON.stringify(pedido.itens || [])
  });

  return fetch(`${URL_CONTROLE}?${params.toString()}&t=${Date.now()}`)
    .then((res) => res.json());
}

async function confirmarReservaEstoqueCardapio(pedidoId) {
  if (!pedidoId) return;

  await fetch(
    `${URL_CONTROLE}?acao=confirmarReservaEstoquePedido` +
    `&pedidoId=${encodeURIComponent(pedidoId)}` +
    `&t=${Date.now()}`
  );
}

/* =========================================================
   INSTALAÇÃO DO CARDÁPIO NO IOS
========================================================= */

const CHAVE_POPUP_INSTALACAO_IOS =
  "popupInstalacaoIOSUltimaExibicao";

const TEMPO_REEXIBICAO_POPUP_IOS =
  24 * 60 * 60 * 1000;

const ATRASO_POPUP_INSTALACAO_IOS =
  5 * 1000;

function dispositivoEhIOS() {
  const userAgent =
    window.navigator.userAgent || "";

  const dispositivoIOS =
    /iPad|iPhone|iPod/i.test(userAgent);

  const iPadComModoDesktop =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;

  return dispositivoIOS || iPadComModoDesktop;
}

function navegadorEhSafariIOS() {
  const userAgent =
    window.navigator.userAgent || "";

  const possuiSafari =
    /Safari/i.test(userAgent);

  const outroNavegadorIOS =
    /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(
      userAgent,
    );

  return possuiSafari && !outroNavegadorIOS;
}

function cardapioEstaInstalado() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches
  );
}

function obterUltimaExibicaoPopupIOS() {
  try {
    const valorSalvo = localStorage.getItem(
      CHAVE_POPUP_INSTALACAO_IOS,
    );

    const dataSalva = Number(valorSalvo);

    return Number.isFinite(dataSalva)
      ? dataSalva
      : 0;
  } catch (erro) {
    console.warn(
      "Não foi possível consultar o popup de instalação:",
      erro,
    );

    return 0;
  }
}

function popupIOSFoiExibidoRecentemente() {
  const ultimaExibicao =
    obterUltimaExibicaoPopupIOS();

  if (!ultimaExibicao) {
    return false;
  }

  const tempoDecorrido =
    Date.now() - ultimaExibicao;

  return (
    tempoDecorrido <
    TEMPO_REEXIBICAO_POPUP_IOS
  );
}

function deveExibirPopupInstalacaoIOS() {
  if (!dispositivoEhIOS()) {
    return false;
  }

  if (!navegadorEhSafariIOS()) {
    return false;
  }

  if (cardapioEstaInstalado()) {
    return false;
  }

  if (popupIOSFoiExibidoRecentemente()) {
    return false;
  }

  return true;
}

function abrirPopupInstalacaoIOS() {
  const popup = document.getElementById(
    "popup-instalacao-ios",
  );

  if (!popup) {
    return;
  }

  configurarEventosPopupInstalacaoIOS();

  popup.classList.add("ativo");
  popup.setAttribute("aria-hidden", "false");
}

function registrarExibicaoPopupIOS() {
  try {
    localStorage.setItem(
      CHAVE_POPUP_INSTALACAO_IOS,
      String(Date.now()),
    );
  } catch (erro) {
    console.warn(
      "Não foi possível salvar a exibição do popup.",
      erro,
    );
  }
}

function fecharPopupInstalacaoIOS() {
  const popup = document.getElementById(
    "popup-instalacao-ios",
  );

  if (!popup) return;

  registrarExibicaoPopupIOS();

  popup.classList.remove("ativo");
  popup.setAttribute("aria-hidden", "true");
}

function configurarEventosPopupInstalacaoIOS() {
  const popup = document.getElementById(
    "popup-instalacao-ios",
  );

  if (!popup) return;

  const logoPopup =
    document.getElementById("popup-ios-logo");

  const logoLoja =
    document.getElementById("logo-loja");

  if (
    logoPopup &&
    logoLoja &&
    logoLoja.src
  ) {
    logoPopup.src = logoLoja.src;
  }

  [
    "fechar-popup-instalacao-ios",
    "botao-agora-nao-popup-ios",
    "botao-entendi-popup-ios",
  ].forEach((id) => {
    const botao =
      document.getElementById(id);

    if (!botao) return;

    botao.addEventListener(
      "click",
      fecharPopupInstalacaoIOS,
    );
  });
}

function prepararPopupInstalacaoIOS() {
  if (!deveExibirPopupInstalacaoIOS()) {
    return;
  }

  window.setTimeout(() => {
    if (cardapioEstaInstalado()) {
      return;
    }

    abrirPopupInstalacaoIOS();
  }, ATRASO_POPUP_INSTALACAO_IOS);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const licenca = await verificarLicencaPublica();

    console.log("Resultado da licença:", licenca);

    if (licenca.permitido !== true) {
      mostrarTelaManutencao();
      return;
    }
  } catch (erro) {
    console.error("Erro ao verificar licença:", erro);

    mostrarTelaManutencao();
    return;
  }
  prepararPopupInstalacaoIOS();
  carregarPerfilLojaCardapio();

  Promise.all([
    carregarEstoqueCardapio(),
    carregarControleProdutos(),
    carregarComplementosCardapio(),
    carregarCategoriasCardapio()
  ])
    .then(() => {
      renderizarProdutos();
      document.body.classList.remove("carregando-cardapio");
    })
    .catch((erro) => {
      console.error("Erro ao carregar o cardápio:", erro);
      document.body.classList.remove("carregando-cardapio");
    });

  setInterval(() => {
    Promise.all([
      carregarEstoqueCardapio(),
      carregarControleProdutos(),
      carregarComplementosCardapio(),
      carregarCategoriasCardapio()
    ])
      .then(() => {
        renderizarProdutos();
        atualizarComplementosModalAberto();
        atualizarPrecosCarrinho();
        atualizarResumoPedido();
      })
      .catch((erro) => {
        console.warn("Erro ao atualizar o cardápio:", erro);
      });
  }, TEMPO_ATUALIZACAO_PRODUTOS);

  carregarCuponsCardapio()
    .then(() => {
      atualizarResumoPedido();
    })
    .catch((erro) => {
      console.warn("Erro ao carregar cupons:", erro);
    });

  carregarTabelaFrete()
    .then(() => {
      atualizarFreteEnderecoSalvo();
      atualizarResumoPedido();
    })
    .catch((erro) => {
      console.warn("Erro ao carregar fretes:", erro);
    });

  carregarHorariosLoja()
    .catch((erro) => {
      console.warn("Erro ao carregar horários:", erro);
    });

  setInterval(() => {
    carregarHorariosLoja()
      .catch((erro) => {
        console.warn("Erro ao atualizar horários:", erro);
      });
  }, TEMPO_ATUALIZACAO_HORARIO);

  document.getElementById("aplicar-cupom").addEventListener("click", aplicarCupom);

  setInterval(() => {
    carregarTabelaFrete()
      .then(() => {
        atualizarFreteEnderecoSalvo();
      })
      .catch((erro) => {
        console.warn(
          "Erro ao atualizar fretes:",
          erro
        );
      });
  }, TEMPO_ATUALIZACAO_FRETE);

  const cepCarrinho =
    document.getElementById("cep-carrinho");

  const cepCliente =
    document.getElementById("cep-cliente");

  const nomeCliente =
    document.getElementById("nome-cliente");

  const whatsappCliente =
    document.getElementById("whatsapp-cliente");

  const ruaCliente =
    document.getElementById("rua-cliente");

  const numeroCliente =
    document.getElementById("numero-cliente");

  const complementoCliente =
    document.getElementById("complemento-cliente");

  const bairroCliente =
    document.getElementById("bairro-cliente");

  const cidadeCliente =
    document.getElementById("cidade-cliente");

  const btnTipoEntrega =
    document.getElementById("btn-tipo-entrega");

  const btnTipoRetirada =
    document.getElementById("btn-tipo-retirada");

  const botaoContinuar =
    document.getElementById("continuar-pedido");

  const botaoVoltar =
    document.getElementById("voltar-etapa-carrinho");

  if (btnTipoEntrega) {
    btnTipoEntrega.addEventListener("click", () => {
      atualizarTipoEntregaCardapio("entrega");
    });
  }

  if (btnTipoRetirada) {
    btnTipoRetirada.addEventListener("click", () => {
      atualizarTipoEntregaCardapio("retirada");
    });
  }

  if (botaoContinuar) {
    botaoContinuar.addEventListener(
      "click",
      irParaEtapaDados,
    );
  }

  if (botaoVoltar) {
    botaoVoltar.addEventListener(
      "click",
      voltarParaEtapaCarrinho,
    );
  }

  bloquearCamposRetornadosPeloCep();

  function prepararConsultaCep(campo, origem) {
    if (!campo) return;

    campo.addEventListener("input", () => {
      limparErroCampoCheckout(campo);
      const valorAnterior =
        String(campo.dataset.cepAnterior || "")
          .replace(/\D/g, "");

      const cepFormatado =
        sincronizarCamposCep(campo.value);

      const cepNumeros =
        cepFormatado.replace(/\D/g, "");

      campo.dataset.cepAnterior = cepNumeros;

      clearTimeout(timeoutConsultaCepCarrinho);
      atualizarEstadoBotoesCheckout();

      if (
        valorAnterior &&
        valorAnterior !== cepNumeros
      ) {
        ultimoCepConsultado = "";
        limparEnderecoAoAlterarCep();
      }

      atualizarEnderecoTemporario({
        cep: cepFormatado,
      });

      if (cepNumeros.length !== 8) {
        enderecoAtendido = false;
        ultimoCepConsultado = "";

        limparStatusConsultaCep();
        atualizarResumoPedido();
        atualizarEstadoBotoesCheckout();

        return;
      }

      timeoutConsultaCepCarrinho = setTimeout(() => {
        if (cepNumeros === ultimoCepConsultado) {
          return;
        }

        preencherEndereco(cepNumeros, origem);
      }, 450);
    });
  }

  prepararConsultaCep(
    cepCarrinho,
    "etapa1",
  );

  prepararConsultaCep(
    cepCliente,
    "etapa2",
  );

  const enderecoSalvo =
    JSON.parse(localStorage.getItem("endereco"));

  if (enderecoSalvo) {
    if (nomeCliente) {
      nomeCliente.value =
        enderecoSalvo.nome || "";
    }

    if (whatsappCliente) {
      whatsappCliente.value =
        enderecoSalvo.whatsapp || "";
    }

    const cepSalvoFormatado =
      sincronizarCamposCep(enderecoSalvo.cep || "");

    ultimoCepConsultado =
      cepSalvoFormatado.replace(/\D/g, "");

    if (cepCarrinho) {
      cepCarrinho.dataset.cepAnterior =
        ultimoCepConsultado;
    }

    if (cepCliente) {
      cepCliente.dataset.cepAnterior =
        ultimoCepConsultado;
    }

    if (ruaCliente) {
      ruaCliente.value =
        enderecoSalvo.rua || "";
    }

    if (numeroCliente) {
      numeroCliente.value =
        enderecoSalvo.numero || "";
    }

    if (complementoCliente) {
      complementoCliente.value =
        enderecoSalvo.complemento || "";
    }

    if (bairroCliente) {
      bairroCliente.value =
        enderecoSalvo.bairro || "";
    }

    if (cidadeCliente) {
      cidadeCliente.value =
        enderecoSalvo.cidade || "";
    }

    const freteAtual =
      calcularFretePorBairro(
        enderecoSalvo.bairro || "",
      );

    enderecoAtendido =
      freteAtual !== null &&
      Number(freteAtual) > 0;

    if (enderecoAtendido) {
      enderecoSalvo.frete = freteAtual;

      localStorage.setItem(
        "endereco",
        JSON.stringify(enderecoSalvo),
      );

      mostrarFreteEndereco(freteAtual);
      salvarDadosEtapaFinal();
    }
  }
  [
    nomeCliente,
    whatsappCliente,
    numeroCliente,
    complementoCliente,
  ].forEach((campo) => {
    if (!campo) return;

    campo.addEventListener("input", () => {
      limparErroCampoCheckout(campo);
      salvarDadosEtapaFinal();
      atualizarEstadoBotoesCheckout();
    });

    campo.addEventListener("change", () => {
      limparErroCampoCheckout(campo);
      salvarDadosEtapaFinal();
      atualizarEstadoBotoesCheckout();
    });
  });

  exibirEtapaCarrinho(1);
  atualizarExibicaoTipoEntregaEtapa2();

  document
    .getElementById('confirmar-pedido')
    .addEventListener('click', confirmarPedido);

  document
    .getElementById("limpar-pedido")
    .addEventListener("click", () => {
      const pedidos =
        JSON.parse(
          localStorage.getItem("pedidos"),
        ) || [];

      if (pedidos.length === 0) {
        mostrarAlerta(
          "Seu carrinho já está vazio.",
          "aviso",
        );

        return;
      }

      mostrarConfirmacao({
        titulo: "Limpar carrinho?",
        mensagem:
          "Todos os produtos adicionados serão removidos do pedido.",
        textoConfirmar: "Sim, limpar",
        textoCancelar: "Cancelar",
        tipo: "aviso",

        aoConfirmar: () => {
          localStorage.removeItem("pedidos");

          cupomAplicado = null;

          localStorage.removeItem(
            "cupomAplicado",
          );

          atualizarResumoPedido();
          atualizarEstadoBotoesCheckout();
          fecharCarrinhoDrawer();

          mostrarAlerta(
            "Carrinho limpo com sucesso.",
            "sucesso",
          );
        },
      });
    });

  document.getElementById('carrinho-flutuante').addEventListener('click', () => {
    abrirCarrinhoDrawer();
  });

  document.getElementById('overlay-carrinho').addEventListener('click', () => {
    fecharCarrinhoDrawer();
  });

  document
    .getElementById('fechar-carrinho')
    .addEventListener('click', fecharCarrinhoDrawer);

  document
    .getElementById("pedido-andamento-btn")
    .addEventListener("click", abrirListaPedidosAndamento);

  document
    .getElementById("fechar-acompanhamento")
    .addEventListener("click", fecharAcompanhamentoPedido);

  document
    .getElementById("overlay-acompanhamento")
    .addEventListener("click", fecharAcompanhamentoPedido);

  limparPedidosAndamentoExpirados();
  renderizarBotaoPedidosAndamento();

  obterPedidosEmAndamento().forEach((pedido) => {
    iniciarAtualizacaoStatusCliente(pedido.pedidoId);
  });

  atualizarResumoPedido();
  atualizarEstadoBotoesCheckout();
});


function abrirCarrinhoDrawer() {
  const carrinhoFlutuante =
    document.getElementById("carrinho-flutuante");

  const resumo =
    document.getElementById("resumo-pedido");

  const overlay =
    document.getElementById("overlay-carrinho");

  if (carrinhoFlutuante) {
    carrinhoFlutuante.style.display = "none";
  }

  exibirEtapaCarrinho(1, false);

  if (resumo) {
    resumo.scrollTop = 0;
    resumo.classList.add("carrinho-drawer-aberto");
  }

  if (overlay) {
    overlay.classList.add("ativo");
  }
}

function fecharCarrinhoDrawer() {
  const resumo = document.getElementById('resumo-pedido');
  const overlay = document.getElementById('overlay-carrinho');
  const carrinho = document.getElementById('carrinho-flutuante');

  resumo.classList.remove('carrinho-drawer-aberto');
  overlay.classList.remove('ativo');

  const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];

  const totalItens = pedidos.reduce((soma, item) => {
    return soma + (parseInt(item.quantidade) || 1);
  }, 0);

  if (totalItens > 0 && carrinho) {
    carrinho.style.display = 'flex';
  }
}

function criarSeletorQuantidade() {
  return `
      <div class="quantidade-container">
        <button type="button" class="qtd-btn qtd-menos">−</button>
        <input type="number" class="qtd-input" value="1" min="1" />
        <button type="button" class="qtd-btn qtd-mais">+</button>
      </div>
    `;
}

function ativarSeletorQuantidade(container) {
  const input = container.querySelector('.qtd-input');
  const menos = container.querySelector('.qtd-menos');
  const mais = container.querySelector('.qtd-mais');

  if (!input || !menos || !mais) return;

  menos.addEventListener('click', e => {
    e.stopPropagation();

    let valor = parseInt(input.value) || 1;

    if (valor > 1) {
      input.value = valor - 1;
    }
  });

  mais.addEventListener('click', e => {
    e.stopPropagation();

    let valor = parseInt(input.value) || 1;
    input.value = valor + 1;
  });

  input.addEventListener('input', () => {
    if (!input.value || parseInt(input.value) < 1) {
      input.value = 1;
    }
  });
}

function obterGruposDoProduto(nomeProduto) {
  return produtosComplementos
    .filter((item) => {
      return (
        String(item.produto || "").trim() === String(nomeProduto).trim() &&
        String(item.status || "ATIVO").trim() === "ATIVO"
      );
    })
    .sort((a, b) => Number(a.ordem || 9999) - Number(b.ordem || 9999));
}

function obterGrupoComplemento(nomeGrupo) {
  return gruposComplementos.find((grupo) => {
    return String(grupo.grupo || "").trim() === String(nomeGrupo).trim();
  });
}

function produtoTemComplementosAtivos(nomeProduto) {
  return Boolean(
    montarHtmlComplementosProduto(
      nomeProduto,
    ).trim(),
  );
}

function montarHtmlComplementosProduto(nomeProduto) {
  const gruposProduto = obterGruposDoProduto(nomeProduto);

  if (gruposProduto.length === 0) return "";

  return gruposProduto
    .map((vinculo) => {
      const grupo = obterGrupoComplemento(vinculo.grupo);

      if (!grupo || String(grupo.statusGrupo || "").trim() !== "ATIVO") {
        return "";
      }

      const itensAtivos = (grupo.itens || [])
        .filter((item) => {
          return (
            String(item.statusItem || "").trim() === "ATIVO" &&
            complementoDisponivelPorEstoque(item.item)
          );
        })
        .sort((a, b) => Number(a.ordem || 9999) - Number(b.ordem || 9999));

      if (itensAtivos.length === 0) return "";

      const minimo = Number(grupo.minimo || 0);
      const maximo = Number(grupo.maximo || 0);

      return `
          <fieldset
            class="grupo-complemento-dinamico"
            data-grupo="${grupo.grupo}"
            data-minimo="${minimo}"
            data-maximo="${maximo}"
          >
            <legend>
              ${grupo.grupo}
              ${minimo > 0 ? "*" : ""}
              ${maximo > 0 ? `(até ${maximo})` : ""}
            </legend>

            <ul class="adicionais-lista">
              ${itensAtivos
          .map((item) => {
            const precoItem = converterValorCardapio(item.valor || 0);
            const idSeguro =
              normalizarTexto(`${grupo.grupo}-${item.item}`).replace(/\s+/g, "-");

            if (maximo > 1) {
              return `
    <div class="item-complemento item-complemento-quantidade">
      <input
        type="checkbox"
        class="complemento-checkbox-quantidade"
        id="${idSeguro}"
        value="${item.item}"
        data-grupo="${grupo.grupo}"
        data-price="${precoItem}"
        data-quantidade="0"
        hidden
      >

      <span class="nome-complemento">
        ${item.item}
        ${precoItem > 0 ? `(R$${formatarPreco(precoItem)})` : ""}
      </span>

      <div class="seletor-quantidade-complemento">
        <button
          type="button"
          class="diminuir-complemento"
          onclick="alterarQuantidadeComplemento(this, -1)"
          disabled
        >
          −
        </button>

        <span class="quantidade-complemento">0</span>

        <button
          type="button"
          class="aumentar-complemento"
          onclick="alterarQuantidadeComplemento(this, 1)"
        >
          +
        </button>
      </div>
    </div>
  `;
            }

            return `
  <label class="item-complemento">
    <input
      type="checkbox"
      id="${idSeguro}"
      value="${item.item}"
      data-grupo="${grupo.grupo}"
      data-price="${precoItem}"
      data-quantidade="1"
    >

    <span>
      ${item.item}
      ${precoItem > 0 ? `(R$${formatarPreco(precoItem)})` : ""}
    </span>
  </label>
`;
          })
          .join("")}
            </ul>
          </fieldset>
        `;
    })
    .join("");
}

function alterarQuantidadeComplemento(botao, alteracao) {
  const itemComplemento = botao.closest(".item-complemento-quantidade");
  const grupoComplemento = botao.closest(".grupo-complemento-dinamico");

  if (!itemComplemento || !grupoComplemento) return;

  const input = itemComplemento.querySelector(
    ".complemento-checkbox-quantidade"
  );

  const quantidadeVisual = itemComplemento.querySelector(
    ".quantidade-complemento"
  );

  if (!input || !quantidadeVisual) return;

  const maximoGrupo = Number(grupoComplemento.dataset.maximo || 0);
  const quantidadeAtual = Number(input.dataset.quantidade || 0);

  const quantidadeTotalGrupo = Array.from(
    grupoComplemento.querySelectorAll(".complemento-checkbox-quantidade")
  ).reduce((total, complemento) => {
    return total + Number(complemento.dataset.quantidade || 0);
  }, 0);

  let novaQuantidade = quantidadeAtual + alteracao;

  if (novaQuantidade < 0) {
    novaQuantidade = 0;
  }

  if (
    alteracao > 0 &&
    maximoGrupo > 0 &&
    quantidadeTotalGrupo >= maximoGrupo
  ) {
    return;
  }

  input.dataset.quantidade = String(novaQuantidade);
  input.checked = novaQuantidade > 0;
  quantidadeVisual.textContent = String(novaQuantidade);

  atualizarControlesQuantidadeComplemento(grupoComplemento);
  const modalBody =
    grupoComplemento.closest("#modal-body");

  atualizarTotalModalProduto(modalBody);
}

function atualizarControlesQuantidadeComplemento(grupoComplemento) {
  if (!grupoComplemento) return;

  const maximoGrupo = Number(grupoComplemento.dataset.maximo || 0);

  const complementos = Array.from(
    grupoComplemento.querySelectorAll(".complemento-checkbox-quantidade")
  );

  const quantidadeTotalGrupo = complementos.reduce((total, complemento) => {
    return total + Number(complemento.dataset.quantidade || 0);
  }, 0);

  complementos.forEach((input) => {
    const itemComplemento = input.closest(".item-complemento-quantidade");

    if (!itemComplemento) return;

    const botaoDiminuir = itemComplemento.querySelector(
      ".diminuir-complemento"
    );

    const botaoAumentar = itemComplemento.querySelector(
      ".aumentar-complemento"
    );

    const quantidade = Number(input.dataset.quantidade || 0);

    if (botaoDiminuir) {
      botaoDiminuir.disabled = quantidade <= 0;
    }

    if (botaoAumentar) {
      botaoAumentar.disabled =
        maximoGrupo > 0 && quantidadeTotalGrupo >= maximoGrupo;
    }
  });
}

function atualizarTotalModalProduto(modalBody) {
  if (!modalBody) return;

  const botaoAdicionar =
    modalBody.querySelector("#add-produto");

  if (!botaoAdicionar) return;

  const precoBase =
    Number(modalBody.dataset.precoBase || 0);

  const campoQuantidade =
    modalBody.querySelector(".qtd-input");

  const quantidadeProduto =
    Math.max(
      1,
      parseInt(campoQuantidade?.value) || 1
    );

  let totalComplementos = 0;

  modalBody
    .querySelectorAll(
      ".grupo-complemento-dinamico input"
    )
    .forEach((item) => {
      const preco =
        Number(item.dataset.price || 0);

      const quantidade =
        Number(item.dataset.quantidade || 0);

      if (quantidade > 0) {
        totalComplementos +=
          preco * quantidade;
      } else if (item.checked) {
        totalComplementos += preco;
      }
    });

  const totalUnitario =
    precoBase + totalComplementos;

  const totalFinal =
    totalUnitario * quantidadeProduto;

  botaoAdicionar.dataset.totalAtual =
    String(totalFinal);

  botaoAdicionar.textContent =
    `Adicionar • R$ ${formatarPreco(totalFinal)}`;
}

function atualizarComplementosModalAberto() {
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  const boxComplementos = document.getElementById("complementos-produto-modal");

  if (!modal || !modalBody || !boxComplementos) return;
  if (modal.style.display !== "block") return;

  const nomeProduto = modal.dataset.produtoAberto;

  if (!nomeProduto) return;

  const selecionadosAntes = Array.from(
    boxComplementos.querySelectorAll('input[type="checkbox"]:checked')
  ).map((checkbox) => {
    return `${checkbox.dataset.grupo}|||${checkbox.value}`;
  });

  boxComplementos.innerHTML = montarHtmlComplementosProduto(nomeProduto);

  boxComplementos
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      const chave = `${checkbox.dataset.grupo}|||${checkbox.value}`;

      if (selecionadosAntes.includes(chave)) {
        checkbox.checked = true;
      }
    });

  ativarRegrasComplementosModal(modalBody);
}

function ativarRegrasComplementosModal(container) {
  const gruposDinamicos = container.querySelectorAll(
    ".grupo-complemento-dinamico"
  );

  gruposDinamicos.forEach((grupo) => {
    const maximo = Number(grupo.dataset.maximo || 0);

    const checkboxes = grupo.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const selecionados = Array.from(checkboxes).filter(
          (item) => item.checked
        );

        if (maximo > 0 && selecionados.length > maximo) {
          checkbox.checked = false;

          mostrarAlerta(
            `Você pode selecionar no máximo ${maximo} ${maximo === 1 ? "opção" : "opções"
            } neste grupo.`,
            "aviso",
          );
        }
      });
    });
  });
}

function abrirModalProduto(modal) {
  if (!modal) return;

  modal.classList.remove(
    "modal-aberto",
    "modal-fechando",
  );

  modal.style.display = "block";
  modal.scrollTop = 0;

  /*
   * Força o navegador a registrar
   * o estado inicial antes da animação.
   */
  void modal.offsetWidth;

  setTimeout(() => {
    modal.classList.add(
      "modal-aberto",
    );
  }, 30);
}

function fecharModalProduto(modal) {
  if (!modal) return;

  if (
    modal.classList.contains(
      "modal-fechando",
    )
  ) {
    return;
  }

  modal.classList.remove(
    "modal-aberto",
  );

  modal.classList.add(
    "modal-fechando",
  );

  setTimeout(() => {
    modal.style.display = "none";

    modal.classList.remove(
      "modal-fechando",
    );

    modal.scrollTop = 0;
  }, 420);
}

function ativarEventosProdutos() {
  const dishes =
    document.querySelectorAll(".dish");

  const drinks =
    document.querySelectorAll(".drink");

  const modal =
    document.getElementById("modal");

  const modalBody =
    document.getElementById("modal-body");

  const closeModal =
    document.querySelector(".close");

  if (!modal || !modalBody) {
    return;
  }

  dishes.forEach((dish) => {
    dish.addEventListener("click", () => {
      const name =
        dish.dataset.name;

      const price =
        parseFloat(dish.dataset.price);

      const priceDe =
        parseFloat(
          dish.dataset.priceDe,
        ) || price;

      const pricePor =
        parseFloat(
          dish.dataset.pricePor,
        ) || 0;

      const category =
        dish.dataset.category;

      const produtoCompleto =
        controleProdutos.find((produto) => {
          return (
            String(
              produto.Nome || "",
            ).trim() ===
            String(name || "").trim()
          );
        });

      const imagemProduto =
        produtoCompleto?.ImagemURL || "";

      const descricaoProduto =
        produtoCompleto?.Descrição ||
        produtoCompleto?.Descricao ||
        "";

      let modalContent = `
  <div class="modal-conteudo-rolavel">
    <div class="modal-produto-topo">
      ${imagemProduto
          ? `
            <img
              src="${imagemProduto}"
              alt="${name}"
            />
          `
          : ""
        }

      <h3>${name}</h3>

      <p class="modal-produto-preco">
        R$${formatarPreco(price)}
      </p>

      ${descricaoProduto
          ? `
            <p class="modal-produto-descricao">
              ${descricaoProduto}
            </p>
          `
          : ""
        }
    </div>

    <div id="complementos-produto-modal">
      ${montarHtmlComplementosProduto(name)}
    </div>
  </div>

  <div class="modal-acoes">
    ${criarSeletorQuantidade()}

    <button
      id="add-produto"
      class="add-pedido"
      type="button"
    >
      Adicionar
    </button>
  </div>
`;

      modalBody.innerHTML =
        modalContent;

      modalBody.dataset.precoBase =
        String(price);

      modal.dataset.produtoAberto =
        name;

      abrirModalProduto(modal);

      const carrinhoFlutuante =
        document.getElementById(
          "carrinho-flutuante",
        );

      if (carrinhoFlutuante) {
        carrinhoFlutuante.style.display =
          "none";
      }

      ativarSeletorQuantidade(
        modalBody,
      );

      ativarRegrasComplementosModal(
        modalBody,
      );

      atualizarTotalModalProduto(
        modalBody
      );

      const campoQuantidadeModal =
        modalBody.querySelector(
          ".qtd-input"
        );

      if (campoQuantidadeModal) {
        campoQuantidadeModal.addEventListener(
          "input",
          () => {
            atualizarTotalModalProduto(
              modalBody
            );
          }
        );

        campoQuantidadeModal.addEventListener(
          "change",
          () => {
            atualizarTotalModalProduto(
              modalBody
            );
          }
        );
      }

      modalBody
        .querySelectorAll(
          '.grupo-complemento-dinamico input[type="checkbox"]'
        )
        .forEach((item) => {
          item.addEventListener(
            "change",
            () => {
              atualizarTotalModalProduto(
                modalBody
              );
            }
          );
        });

      const botaoAdicionarProduto =
        document.getElementById(
          "add-produto",
        );

      if (!botaoAdicionarProduto) {
        return;
      }

      botaoAdicionarProduto.addEventListener(
        "click",
        () => {
          if (
            botaoAdicionarProduto.disabled
          ) {
            return;
          }

          const campoQuantidade =
            modalBody.querySelector(
              ".qtd-input",
            );

          const quantidade =
            parseInt(
              campoQuantidade?.value,
            ) || 1;

          const gruposDinamicos =
            modalBody.querySelectorAll(
              ".grupo-complemento-dinamico",
            );

          for (
            const grupo of gruposDinamicos
          ) {
            const nomeGrupo =
              grupo.dataset.grupo;

            const minimo =
              Number(
                grupo.dataset.minimo || 0,
              );

            let quantidadeSelecionadaGrupo = 0;

            grupo
              .querySelectorAll('input[type="checkbox"]')
              .forEach((item) => {

                const quantidade =
                  Number(item.dataset.quantidade || 0);

                if (quantidade > 0) {
                  quantidadeSelecionadaGrupo += quantidade;
                } else if (item.checked) {
                  quantidadeSelecionadaGrupo++;
                }

              });

            if (
              minimo > 0 &&
              quantidadeSelecionadaGrupo < minimo
            ) {
              mostrarAlerta(
                `Selecione pelo menos ${minimo} ${minimo === 1
                  ? "opção"
                  : "opções"
                } em ${nomeGrupo}.`,
                "aviso",
              );

              grupo.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });

              return;
            }
          }

          botaoAdicionarProduto.disabled =
            true;

          botaoAdicionarProduto.textContent =
            "Adicionando...";

          botaoAdicionarProduto.classList.add(
            "botao-carregando",
          );

          const adicionais = [];

          modal
            .querySelectorAll(".grupo-complemento-dinamico input")
            .forEach((item) => {

              const quantidade = Number(item.dataset.quantidade || 0);

              if (quantidade <= 0 && !item.checked) return;

              adicionais.push({
                grupo: item.dataset.grupo,
                nome: item.value,
                quantidade: quantidade > 0 ? quantidade : 1,
                preco: (parseFloat(item.dataset.price) || 0)
              });

            });

          const adicionaisPrecos = [];

          adicionais.forEach((item) => {

            for (let i = 0; i < item.quantidade; i++) {
              adicionaisPrecos.push(item.preco);
            }

          });

          const totalPrice =
            adicionaisPrecos.reduce(
              (total, preco) => {
                return total + preco;
              },
              price,
            );

          try {
            addPedido({
              name,
              category,
              price,
              priceDe,
              pricePor,
              queijo: "",
              adicionais,
              totalPrice,
              quantidade,
            });

            botaoAdicionarProduto.textContent =
              "Adicionado ✓";

            botaoAdicionarProduto.classList.remove(
              "botao-carregando",
            );

            setTimeout(() => {
              fecharModalProduto(modal);

              botaoAdicionarProduto.disabled =
                false;

              botaoAdicionarProduto.textContent =
                "Adicionar";
            }, 250);
          } catch (erro) {
            console.error(
              "Erro ao adicionar produto:",
              erro,
            );

            botaoAdicionarProduto.disabled =
              false;

            botaoAdicionarProduto.textContent =
              "Adicionar";

            botaoAdicionarProduto.classList.remove(
              "botao-carregando",
            );

            mostrarAlerta(
              "Não foi possível adicionar o produto. Tente novamente.",
              "erro",
            );
          }
        },
      );
    });
  });

  drinks.forEach((drink) => {
    const addButton =
      drink.querySelector(
        ".add-drink",
      );

    ativarSeletorQuantidade(drink);

    if (!addButton) {
      return;
    }

    addButton.addEventListener(
      "click",
      (evento) => {
        evento.stopPropagation();

        if (addButton.disabled) {
          return;
        }

        addButton.disabled = true;

        const textoOriginal =
          addButton.textContent;

        addButton.textContent =
          "Adicionando...";

        addButton.classList.add(
          "botao-carregando",
        );

        const campoQuantidade =
          drink.querySelector(
            ".qtd-input",
          );

        const quantidade =
          parseInt(
            campoQuantidade?.value,
          ) || 1;

        const name =
          drink.dataset.name;

        const price =
          parseFloat(
            drink.dataset.price,
          );

        const priceDe =
          parseFloat(
            drink.dataset.priceDe,
          ) || price;

        const pricePor =
          parseFloat(
            drink.dataset.pricePor,
          ) || 0;

        try {
          const category =
            drink.dataset.category ||
            "salgado";

          addPedido({
            name,
            category,
            price,
            priceDe,
            pricePor,
            queijo: "",
            adicionais: [],
            totalPrice: price,
            quantidade,
          });

          addButton.textContent =
            "Adicionado ✓";

          addButton.classList.remove(
            "botao-carregando",
          );

          if (campoQuantidade) {
            campoQuantidade.value = 1;
          }
        } catch (erro) {
          console.error(
            "Erro ao adicionar produto:",
            erro,
          );

          mostrarAlerta(
            "Não foi possível adicionar o produto. Tente novamente.",
            "erro",
          );
        }

        setTimeout(() => {
          addButton.disabled = false;

          addButton.textContent =
            textoOriginal || "Adicionar";

          addButton.classList.remove(
            "botao-carregando",
          );
        }, 650);
      },
    );
  });

  if (closeModal) {
    closeModal.onclick = () => {
      fecharModalProduto(modal);
      atualizarResumoPedido();
    };
  }

  window.onclick = (evento) => {
    if (evento.target === modal) {
      fecharModalProduto(modal);
      atualizarResumoPedido();
    }
  };
}

function salvarDadosEtapaFinal() {
  const nomeCliente =
    document.getElementById("nome-cliente");

  const whatsappCliente =
    document.getElementById("whatsapp-cliente");

  const cepCliente =
    document.getElementById("cep-cliente");

  const ruaCliente =
    document.getElementById("rua-cliente");

  const numeroCliente =
    document.getElementById("numero-cliente");

  const complementoCliente =
    document.getElementById("complemento-cliente");

  const bairroCliente =
    document.getElementById("bairro-cliente");

  const cidadeCliente =
    document.getElementById("cidade-cliente");

  const enderecoAtual =
    JSON.parse(localStorage.getItem("endereco")) || {};

  const enderecoAtualizado = {
    ...enderecoAtual,

    nome: String(nomeCliente?.value || "").trim(),

    whatsapp: String(
      whatsappCliente?.value || "",
    ).trim(),

    cep: String(cepCliente?.value || "").trim(),

    rua: String(ruaCliente?.value || "").trim(),

    numero: String(
      numeroCliente?.value || "",
    ).trim(),

    complemento: String(
      complementoCliente?.value || "",
    ).trim(),

    bairro: String(
      bairroCliente?.value || "",
    ).trim(),

    cidade: String(
      cidadeCliente?.value || "",
    ).trim(),

    frete:
      tipoEntregaSelecionado === "retirada"
        ? 0
        : Number(enderecoAtual.frete || 0),
  };

  localStorage.setItem(
    "endereco",
    JSON.stringify(enderecoAtualizado),
  );

  return enderecoAtualizado;
}

function mostrarErroCampoCheckout(campo, mensagem) {
  if (!campo) return;

  campo.classList.add("campo-checkout-invalido");

  let erro = campo.parentElement.querySelector(
    ".mensagem-erro-checkout"
  );

  if (!erro) {
    erro = document.createElement("span");
    erro.className = "mensagem-erro-checkout";
    campo.insertAdjacentElement("afterend", erro);
  }

  erro.textContent = mensagem;
}

function limparErroCampoCheckout(campo) {
  if (!campo) return;

  campo.classList.remove("campo-checkout-invalido");

  const erro = campo.parentElement.querySelector(
    ".mensagem-erro-checkout"
  );

  if (erro) {
    erro.remove();
  }
}

function limparErrosCheckout() {
  document
    .querySelectorAll(".campo-checkout-invalido")
    .forEach((campo) => {
      campo.classList.remove("campo-checkout-invalido");
    });

  document
    .querySelectorAll(".mensagem-erro-checkout")
    .forEach((mensagem) => {
      mensagem.remove();
    });
}

function validarDadosEtapaFinal() {
  limparErrosCheckout();

  const nomeCliente =
    document.getElementById("nome-cliente");

  const whatsappCliente =
    document.getElementById("whatsapp-cliente");

  const cepCliente =
    document.getElementById("cep-cliente");

  const ruaCliente =
    document.getElementById("rua-cliente");

  const numeroCliente =
    document.getElementById("numero-cliente");

  const bairroCliente =
    document.getElementById("bairro-cliente");

  const cidadeCliente =
    document.getElementById("cidade-cliente");

  const nome = String(
    nomeCliente?.value || ""
  ).trim();

  const whatsapp = String(
    whatsappCliente?.value || ""
  ).replace(/\D/g, "");

  let primeiroCampoInvalido = null;

  if (!nome) {
    mostrarErroCampoCheckout(
      nomeCliente,
      "Informe seu nome."
    );

    primeiroCampoInvalido ||= nomeCliente;
  }

  if (!whatsapp) {
    mostrarErroCampoCheckout(
      whatsappCliente,
      "Informe seu WhatsApp."
    );

    primeiroCampoInvalido ||= whatsappCliente;
  } else if (whatsapp.length < 10) {
    mostrarErroCampoCheckout(
      whatsappCliente,
      "Informe um WhatsApp válido com DDD."
    );

    primeiroCampoInvalido ||= whatsappCliente;
  }

  if (tipoEntregaSelecionado === "entrega") {
    const cep = String(
      cepCliente?.value || ""
    ).replace(/\D/g, "");

    if (cep.length !== 8) {
      mostrarErroCampoCheckout(
        cepCliente,
        "Informe um CEP válido."
      );

      primeiroCampoInvalido ||= cepCliente;
    } else if (consultaCepEmAndamento) {
      mostrarErroCampoCheckout(
        cepCliente,
        "Aguarde o cálculo da entrega."
      );

      primeiroCampoInvalido ||= cepCliente;
    } else if (!enderecoAtendido) {
      mostrarErroCampoCheckout(
        cepCliente,
        "No momento não atendemos este endereço."
      );

      primeiroCampoInvalido ||= cepCliente;
    }

    if (!ruaCliente?.value.trim()) {
      mostrarErroCampoCheckout(
        ruaCliente,
        "Endereço não identificado."
      );

      primeiroCampoInvalido ||= cepCliente;
    }

    if (!bairroCliente?.value.trim()) {
      mostrarErroCampoCheckout(
        bairroCliente,
        "Bairro não identificado."
      );

      primeiroCampoInvalido ||= cepCliente;
    }

    if (!cidadeCliente?.value.trim()) {
      mostrarErroCampoCheckout(
        cidadeCliente,
        "Cidade não identificada."
      );

      primeiroCampoInvalido ||= cepCliente;
    }

    if (!numeroCliente?.value.trim()) {
      mostrarErroCampoCheckout(
        numeroCliente,
        "Informe o número do endereço."
      );

      primeiroCampoInvalido ||= numeroCliente;
    }
  }

  if (primeiroCampoInvalido) {
    primeiroCampoInvalido.focus();

    primeiroCampoInvalido.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    return false;
  }

  return true;
}

function formatarCepCampo(valor) {
  const numeros = String(valor || "")
    .replace(/\D/g, "")
    .slice(0, 8);

  if (numeros.length > 5) {
    return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
  }

  return numeros;
}

function sincronizarCamposCep(valor) {
  const cepFormatado = formatarCepCampo(valor);

  const cepCarrinho =
    document.getElementById("cep-carrinho");

  const cepCliente =
    document.getElementById("cep-cliente");

  if (cepCarrinho && cepCarrinho.value !== cepFormatado) {
    cepCarrinho.value = cepFormatado;
  }

  if (cepCliente && cepCliente.value !== cepFormatado) {
    cepCliente.value = cepFormatado;
  }

  return cepFormatado;
}

function limparEnderecoAoAlterarCep() {
  const ruaCliente =
    document.getElementById("rua-cliente");

  const numeroCliente =
    document.getElementById("numero-cliente");

  const complementoCliente =
    document.getElementById("complemento-cliente");

  const bairroCliente =
    document.getElementById("bairro-cliente");

  const cidadeCliente =
    document.getElementById("cidade-cliente");

  if (ruaCliente) ruaCliente.value = "";
  if (numeroCliente) numeroCliente.value = "";
  if (complementoCliente) complementoCliente.value = "";
  if (bairroCliente) bairroCliente.value = "";
  if (cidadeCliente) cidadeCliente.value = "";

  enderecoAtendido = false;

  atualizarEnderecoTemporario({
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    frete: null,
  });

  bloquearCamposRetornadosPeloCep();
  limparStatusConsultaCep();
  atualizarResumoPedido();
}

function limparStatusConsultaCep() {
  atualizarStatusCepCheckout("", "");
}

function atualizarEnderecoTemporario(dadosNovos = {}) {
  const atual =
    JSON.parse(localStorage.getItem("endereco")) || {};

  const atualizado = {
    ...atual,
    ...dadosNovos,
  };

  localStorage.setItem(
    "endereco",
    JSON.stringify(atualizado),
  );
}

async function preencherEndereco(cep, origem = "etapa1") {
  const cepNumeros =
    String(cep || "").replace(/\D/g, "");

  if (cepNumeros.length !== 8) {
    enderecoAtendido = false;
    limparStatusConsultaCep();
    return false;
  }

  ultimoCepConsultado = cepNumeros;

  sincronizarCamposCep(cepNumeros);
  const cepCarrinho =
    document.getElementById("cep-carrinho");

  const cepCliente =
    document.getElementById("cep-cliente");

  const ruaCliente =
    document.getElementById("rua-cliente");

  const bairroCliente =
    document.getElementById("bairro-cliente");

  const cidadeCliente =
    document.getElementById("cidade-cliente");

  const statusEtapa1 =
    document.getElementById("status-cep-carrinho");

  const statusEtapa2 =
    document.getElementById("status-cep-etapa-2");

  consultaCepEmAndamento = true;
  enderecoAtendido = false;
  atualizarEstadoBotoesCheckout();

  atualizarStatusCepCheckout(
    "carregando",
    origem === "etapa2"
      ? "Atualizando endereço..."
      : "Calculando entrega...",
  );

  if (ruaCliente) ruaCliente.value = "";
  if (bairroCliente) bairroCliente.value = "";
  if (cidadeCliente) cidadeCliente.value = "";

  bloquearCamposRetornadosPeloCep();

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${cepNumeros}/json/`,
    );

    if (!response.ok) {
      throw new Error("Erro na consulta do CEP.");
    }

    const data = await response.json();

    if (data.erro) {
      ultimoCepConsultado = "";
      enderecoAtendido = false;

      limparEnderecoAoAlterarCep();
      mostrarFreteEndereco(null);

      mostrarAlerta(
        "CEP não encontrado. Confira os números informados.",
        "erro",
      );

      return false;
    }

    if (cepCarrinho) {
      cepCarrinho.value = formatarCepCampo(cepNumeros);
    }

    if (cepCliente) {
      cepCliente.value = formatarCepCampo(cepNumeros);
    }

    if (ruaCliente) {
      ruaCliente.value = data.logradouro || "";
    }

    if (bairroCliente) {
      bairroCliente.value = data.bairro || "";
    }

    if (cidadeCliente) {
      cidadeCliente.value = data.localidade || "";
    }

    bloquearCamposRetornadosPeloCep();

    const frete = calcularFretePorBairro(
      data.bairro || "",
    );

    enderecoAtendido =
      frete !== null && Number(frete) > 0;

    atualizarEnderecoTemporario({
      cep: formatarCepCampo(cepNumeros),
      rua: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      frete: enderecoAtendido ? frete : null,
    });

    salvarDadosEtapaFinal();

    mostrarFreteEndereco(
      enderecoAtendido ? frete : null,
    );

    return enderecoAtendido;
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);

    ultimoCepConsultado = "";
    enderecoAtendido = false;

    limparEnderecoAoAlterarCep();
    mostrarFreteEndereco(null);

    mostrarAlerta(
      "Não foi possível consultar o CEP. Tente novamente.",
      "erro",
    );

    return false;
  } finally {
    consultaCepEmAndamento = false;
    atualizarResumoPedido();
    atualizarEstadoBotoesCheckout();
  }
}

function gerarChavePedido(pedido) {
  return [
    pedido.name,
    pedido.category,
    pedido.queijo,
    pedido.adicionais,
    Number(pedido.totalPrice).toFixed(2)
  ].join('|');
}

function addPedido(pedidoNovo) {
  const pedido = {
    name: pedidoNovo.name,
    category: pedidoNovo.category || '',
    price: pedidoNovo.price,
    priceDe: pedidoNovo.priceDe || pedidoNovo.price,
    pricePor: pedidoNovo.pricePor || "",
    queijo: pedidoNovo.queijo || '',
    adicionais: pedidoNovo.adicionais || [],
    totalPrice: Number(pedidoNovo.totalPrice).toFixed(2),
    quantidade: pedidoNovo.quantidade || 1
  };

  const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];

  const chavePedidoNovo = gerarChavePedido(pedido);

  const itemExistente = pedidos.find(item => {
    return gerarChavePedido(item) === chavePedidoNovo;
  });

  if (itemExistente) {
    itemExistente.quantidade =
      (parseInt(itemExistente.quantidade) || 1) + pedido.quantidade;
  } else {
    pedidos.push(pedido);
  }

  localStorage.setItem(
    "pedidos",
    JSON.stringify(pedidos),
  );

  atualizarResumoPedido();
  animarCarrinhoAoAdicionar();
  mostrarMensagemAdicionado();
}

function animarCarrinhoAoAdicionar() {
  const carrinho =
    document.getElementById(
      "carrinho-flutuante",
    );

  if (!carrinho) return;

  const resumo =
    document.getElementById(
      "resumo-pedido",
    );

  const carrinhoEstaAberto =
    resumo?.classList.contains(
      "carrinho-drawer-aberto",
    );

  if (carrinhoEstaAberto) {
    return;
  }

  carrinho.style.display = "flex";

  carrinho.classList.remove(
    "pulse-carrinho",
  );

  void carrinho.offsetWidth;

  carrinho.classList.add(
    "pulse-carrinho",
  );

  setTimeout(() => {
    carrinho.classList.remove(
      "pulse-carrinho",
    );
  }, 300);
}

function mostrarMensagemAdicionado() {
  const mensagem =
    document.getElementById(
      "mensagem-adicionado",
    );

  if (!mensagem) return;

  clearTimeout(
    timeoutMensagemAdicionado,
  );

  mensagem.classList.remove("show");

  void mensagem.offsetWidth;

  mensagem.classList.add("show");

  timeoutMensagemAdicionado =
    setTimeout(() => {
      mensagem.classList.remove("show");
    }, 1800);
}

function atualizarValorComAnimacao(
  elemento,
  novoTexto,
) {
  if (!elemento) return;

  const textoAnterior =
    String(elemento.textContent || "").trim();

  const textoNovo =
    String(novoTexto || "").trim();

  if (textoAnterior === textoNovo) {
    return;
  }

  elemento.textContent = textoNovo;

  /*
   * Na primeira montagem da página,
   * apenas coloca o valor, sem animar.
   */
  if (!textoAnterior) {
    return;
  }

  elemento.classList.remove(
    "valor-atualizado",
  );

  /*
   * Reinicia a animação mesmo quando
   * o valor muda várias vezes seguidas.
   */
  void elemento.offsetWidth;

  elemento.classList.add(
    "valor-atualizado",
  );

  setTimeout(() => {
    elemento.classList.remove(
      "valor-atualizado",
    );
  }, 750);
}

function atualizarResumoFinanceiroCarrinho(
  subtotal,
  frete,
  desconto,
  total
) {
  const subtotalFinal = Number(subtotal || 0);
  const freteFinal = Number(frete || 0);
  const descontoFinal = Number(desconto || 0);
  const totalFinal = Number(total || 0);

  const subtotalEtapa1 =
    document.getElementById("subtotal-etapa-1");

  const subtotalEtapa2 =
    document.getElementById("subtotal-etapa-2");

  const freteEtapa1 =
    document.getElementById("frete-etapa-1");

  const freteEtapa2 =
    document.getElementById("frete-etapa-2");

  const linhaDescontoEtapa1 =
    document.getElementById("linha-desconto-etapa-1");

  const linhaDescontoEtapa2 =
    document.getElementById("linha-desconto-etapa-2");

  const descontoEtapa1 =
    document.getElementById("desconto-etapa-1");

  const descontoEtapa2 =
    document.getElementById("desconto-etapa-2");

  const totalEtapa1 =
    document.getElementById("total-pedido");

  const totalEtapa2 =
    document.getElementById("total-etapa-2");

  const textoSubtotal =
    `R$${formatarPreco(subtotalFinal)}`;

  const textoDesconto =
    `-R$${formatarPreco(descontoFinal)}`;

  const textoTotal =
    `R$${formatarPreco(totalFinal)}`;

  let textoFrete = "A calcular";

  if (tipoEntregaSelecionado === "retirada") {
    textoFrete = "Grátis";
  } else if (freteFinal > 0) {
    textoFrete =
      `R$${formatarPreco(freteFinal)}`;
  }

  if (subtotalEtapa1) {
    subtotalEtapa1.textContent = textoSubtotal;
  }

  if (subtotalEtapa2) {
    subtotalEtapa2.textContent = textoSubtotal;
  }

  if (freteEtapa1) {
    freteEtapa1.textContent = textoFrete;
  }

  if (freteEtapa2) {
    freteEtapa2.textContent = textoFrete;
  }

  if (descontoEtapa1) {
    descontoEtapa1.textContent = textoDesconto;
  }

  if (descontoEtapa2) {
    descontoEtapa2.textContent = textoDesconto;
  }

  if (linhaDescontoEtapa1) {
    linhaDescontoEtapa1.style.display =
      descontoFinal > 0 ? "flex" : "none";
  }

  if (linhaDescontoEtapa2) {
    linhaDescontoEtapa2.style.display =
      descontoFinal > 0 ? "flex" : "none";
  }

  atualizarValorComAnimacao(
    totalEtapa1,
    textoTotal,
  );

  atualizarValorComAnimacao(
    totalEtapa2,
    textoTotal,
  );
}

function atualizarResumoPedido() {
  const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
  const endereco =
    JSON.parse(localStorage.getItem("endereco"));

  const frete =
    tipoEntregaSelecionado === "retirada"
      ? 0
      : enderecoAtendido &&
        Number(endereco?.frete || 0) > 0
        ? Number(endereco.frete)
        : 0;

  const pedidoItens = document.getElementById('pedido-itens');

  pedidoItens.innerHTML = '';

  let subtotal = 0;
  let totalItens = 0;

  const grupos = {
    salgado: [],
    doce: [],
    bebida: []
  };

  pedidos.forEach((pedido, index) => {
    const quantidade = parseInt(pedido.quantidade) || 1;

    totalItens += quantidade;
    subtotal += parseFloat(pedido.totalPrice) * quantidade;

    if (pedido.category === 'salgado') {
      grupos.salgado.push({ pedido, index });
    } else if (pedido.category === 'doce') {
      grupos.doce.push({ pedido, index });
    } else {
      grupos.bebida.push({ pedido, index });
    }
  });

  const descontoCupom = calcularDescontoCupom(subtotal, frete);
  if (cupomAplicado && descontoCupom <= 0) {
    removerCupom();
    return;
  }
  const totalFinal = Math.max(0, subtotal + frete - descontoCupom);

  atualizarResumoFinanceiroCarrinho(
    subtotal,
    frete,
    descontoCupom,
    totalFinal
  );

  const contador = document.createElement('div');
  contador.className = 'contador-carrinho';
  contador.textContent =
    totalItens === 1 ? '1 item no carrinho' : `${totalItens} itens no carrinho`;

  pedidoItens.appendChild(contador);

  function renderizarGrupo(titulo, lista, classe) {
    if (lista.length === 0) return;

    const grupoDiv = document.createElement('div');
    grupoDiv.className = 'grupo-resumo';
    grupoDiv.innerHTML = `<h3>${titulo}</h3>`;

    lista.forEach(({ pedido, index }) => {
      const quantidade = parseInt(pedido.quantidade) || 1;
      const valorTotalItem = parseFloat(pedido.totalPrice) * quantidade;

      const item = document.createElement("div");

      item.className =
        `pedido-item ${classe}`;

      item.dataset.indexPedido = index;

      item.innerHTML = `
    <div class="carrinho-item-linha">
      <div class="carrinho-item-info">
        <h4>${pedido.name}</h4>

        ${Array.isArray(pedido.adicionais)
          ? pedido.adicionais
            .map((item) => {
              if (typeof item === "string") {
                return `<p>${item}</p>`;
              }

              return `<p>${item.grupo}: ${item.quantidade}x ${item.nome}</p>`;
            })
            .join("")
          : pedido.adicionais
            ? pedido.adicionais
              .split("\n")
              .map((linha) => `<p>${linha}</p>`)
              .join("")
            : ""}
        ${pedido.pricePor && Number(pedido.pricePor) > 0 && Number(pedido.pricePor) < Number(pedido.priceDe)
          ? `
        <div class="preco-carrinho-promocional">
          <span>De R$${formatarPreco(pedido.priceDe)}</span>
          <strong>Por R$${formatarPreco(pedido.pricePor)}</strong>
        </div>
      `
          : ""
        }

        <div class="quantidade-container resumo-qtd carrinho-qtd-compacta">
          <button type="button" class="qtd-btn diminuir-qtd" data-index="${index}">−</button>
          <input
            type="number"
            min="1"
            value="${quantidade}"
            class="qtd-input resumo-input"
            data-index="${index}"
          />
          <button type="button" class="qtd-btn aumentar-qtd" data-index="${index}">+</button>
        </div>
      </div>

      <div class="carrinho-item-acoes">
        <strong>R$${formatarPreco(valorTotalItem)}</strong>

        <button class="excluir-item" data-index="${index}" type="button">
          🗑️
        </button>
      </div>
    </div>
  `;

      grupoDiv.appendChild(item);
    });

    pedidoItens.appendChild(grupoDiv);
  }

  renderizarGrupo('Croissants Salgados', grupos.salgado, 'salgado');
  renderizarGrupo('Croissants Doces', grupos.doce, 'doce');
  renderizarGrupo('Bebidas', grupos.bebida, 'bebida');

  atualizarCarrinhoFlutuante(totalItens, totalFinal);

  const inputCupom =
    document.getElementById(
      "cupom-input",
    );

  const mensagemCupom =
    document.getElementById(
      "cupom-mensagem",
    );

  const linhaCupom =
    document.querySelector(
      ".cupom-linha",
    );

  let etiquetaCupom =
    document.getElementById(
      "cupom-aplicado-etiqueta",
    );

  if (cupomAplicado) {
    if (linhaCupom) {
      linhaCupom.style.display = "none";
    }

    if (!etiquetaCupom) {
      etiquetaCupom =
        document.createElement("div");

      etiquetaCupom.id =
        "cupom-aplicado-etiqueta";

      etiquetaCupom.className =
        "cupom-aplicado-etiqueta";

      linhaCupom?.insertAdjacentElement(
        "afterend",
        etiquetaCupom,
      );
    }

    etiquetaCupom.innerHTML = `
    <span class="cupom-aplicado-codigo">
      ${cupomAplicado.Cupom}
    </span>

    <button
      type="button"
      class="cupom-aplicado-remover"
      aria-label="Remover cupom"
    >
      ×
    </button>
  `;

    etiquetaCupom.style.display =
      "inline-flex";

    const botaoRemover =
      etiquetaCupom.querySelector(
        ".cupom-aplicado-remover",
      );

    botaoRemover?.addEventListener(
      "click",
      removerCupom,
    );

    if (mensagemCupom) {
      mensagemCupom.textContent =
        `Cupom ${cupomAplicado.Cupom} aplicado.`;

      mensagemCupom.classList.remove(
        "cupom-mensagem-erro",
        "cupom-mensagem-aviso",
      );

      mensagemCupom.classList.add(
        "cupom-mensagem-sucesso",
      );
    }
  } else {
    if (linhaCupom) {
      linhaCupom.style.display = "flex";
    }

    if (etiquetaCupom) {
      etiquetaCupom.remove();
    }
  }

  document.querySelectorAll('.aumentar-qtd').forEach(botao => {
    botao.addEventListener('click', () => {
      const index = Number(botao.dataset.index);

      pedidos[index].quantidade =
        (parseInt(pedidos[index].quantidade) || 1) + 1;

      localStorage.setItem('pedidos', JSON.stringify(pedidos));
      atualizarResumoPedido();
    });
  });

  document.querySelectorAll('.diminuir-qtd').forEach(botao => {
    botao.addEventListener('click', () => {
      const index = Number(botao.dataset.index);
      const qtdAtual = parseInt(pedidos[index].quantidade) || 1;

      if (qtdAtual > 1) {
        pedidos[index].quantidade = qtdAtual - 1;

        localStorage.setItem('pedidos', JSON.stringify(pedidos));
        atualizarResumoPedido();
      }
    });
  });

  document.querySelectorAll('.resumo-input').forEach(input => {
    input.addEventListener('change', () => {
      const index = Number(input.dataset.index);

      let valor = parseInt(input.value);

      if (isNaN(valor) || valor < 1) {
        valor = 1;
      }

      pedidos[index].quantidade = valor;

      localStorage.setItem('pedidos', JSON.stringify(pedidos));
      atualizarResumoPedido();
    });
  });

  document
    .querySelectorAll(".excluir-item")
    .forEach((botao) => {
      botao.addEventListener("click", () => {
        const itemCarrinho =
          botao.closest(".pedido-item");

        excluirPedido(
          botao.dataset.index,
          itemCarrinho,
        );
      });
    });
  const botaoRemoverCupom = document.querySelector(".remover-cupom");

  if (botaoRemoverCupom) {
    botaoRemoverCupom.addEventListener("click", removerCupom);
  }
  atualizarEstadoBotoesCheckout();
}

function atualizarPrecosCarrinho() {
  const pedidos = JSON.parse(localStorage.getItem("pedidos")) || [];

  if (!pedidos.length) return;

  let houveAlteracao = false;

  pedidos.forEach((pedido) => {
    const produtoAtual = controleProdutos.find((produto) => {
      return String(produto.Nome || "").trim() === String(pedido.name || "").trim();
    });

    if (!produtoAtual) return;

    const precoDe = converterValorCardapio(produtoAtual.Preço || produtoAtual.Preco || 0);
    const precoPor = converterValorCardapio(produtoAtual.PrecoPor || produtoAtual["Preço Por"] || 0);

    const precoProduto =
      precoPor > 0 && precoPor < precoDe
        ? precoPor
        : precoDe;

    let totalItem = precoProduto;

    if (pedido.adicionais) {
      pedido.adicionais.split("\n").forEach((linha) => {
        const partes = linha.split(":");

        const nomeGrupo = String(partes[0] || "").trim();
        const nomeComplemento = String(partes.slice(1).join(":") || "").trim();

        if (!nomeGrupo || !nomeComplemento) return;

        const grupo = gruposComplementos.find((g) => {
          return String(g.grupo || "").trim() === nomeGrupo;
        });

        if (!grupo) return;

        const complemento = (grupo.itens || []).find((item) => {
          return String(item.item || "").trim() === nomeComplemento;
        });

        if (complemento) {
          totalItem += converterValorCardapio(complemento.valor || 0);
        }
      });
    }

    if (Number(pedido.totalPrice).toFixed(2) !== Number(totalItem).toFixed(2)) {
      pedido.price = precoProduto;
      pedido.priceDe = precoDe;
      pedido.pricePor = precoPor;
      pedido.totalPrice = totalItem.toFixed(2);
      houveAlteracao = true;
    }
  });

  if (houveAlteracao) {
    localStorage.setItem("pedidos", JSON.stringify(pedidos));
  }
}

function atualizarCarrinhoFlutuante(
  qtd,
  total = 0,
) {
  const carrinho =
    document.getElementById(
      "carrinho-flutuante",
    );

  const carrinhoQtd =
    document.getElementById(
      "carrinho-qtd",
    );

  const carrinhoTotal =
    document.querySelector(
      ".carrinho-total",
    );

  if (
    !carrinho ||
    !carrinhoQtd ||
    !carrinhoTotal
  ) {
    return;
  }

  const textoQuantidade =
    qtd === 1
      ? "1 item"
      : `${qtd} itens`;

  carrinhoQtd.textContent =
    textoQuantidade;

  const headerQtd =
    document.getElementById(
      "carrinho-header-qtd",
    );

  if (headerQtd) {
    headerQtd.textContent =
      textoQuantidade;
  }

  const novoTextoTotal =
    `R$${formatarPreco(total)}`;

  const textoTotalAnterior =
    String(
      carrinhoTotal.dataset.valorAtual || "",
    );

  carrinhoTotal.innerHTML =
    `<span class="carrinho-total-valor">` +
    `${novoTextoTotal}` +
    `</span>` +
    `<span class="carrinho-seta">›</span>`;

  carrinhoTotal.dataset.valorAtual =
    novoTextoTotal;

  const elementoValorFlutuante =
    carrinhoTotal.querySelector(
      ".carrinho-total-valor",
    );

  if (
    textoTotalAnterior &&
    textoTotalAnterior !== novoTextoTotal
  ) {
    elementoValorFlutuante?.classList.remove(
      "valor-atualizado",
    );

    void elementoValorFlutuante?.offsetWidth;

    elementoValorFlutuante?.classList.add(
      "valor-atualizado",
    );

    setTimeout(() => {
      elementoValorFlutuante?.classList.remove(
        "valor-atualizado",
      );
    }, 750);
  }

  carrinho.style.display =
    qtd > 0 ? "flex" : "none";

  if (qtd > 0) {
    carrinho.classList.remove(
      "pulse-carrinho",
    );

    void carrinho.offsetWidth;

    carrinho.classList.add(
      "pulse-carrinho",
    );
  }
}

function excluirPedido(
  index,
  elementoItem = null,
) {
  const pedidos =
    JSON.parse(
      localStorage.getItem("pedidos"),
    ) || [];

  const indice = Number(index);

  if (
    !Number.isInteger(indice) ||
    indice < 0 ||
    indice >= pedidos.length
  ) {
    return;
  }

  let exclusaoConcluida = false;

  function concluirExclusao() {
    if (exclusaoConcluida) return;

    exclusaoConcluida = true;

    pedidos.splice(indice, 1);

    localStorage.setItem(
      "pedidos",
      JSON.stringify(pedidos),
    );

    atualizarResumoPedido();
  }

  if (
    !elementoItem ||
    typeof elementoItem.animate !== "function"
  ) {
    concluirExclusao();
    return;
  }

  elementoItem.style.pointerEvents = "none";
  elementoItem.style.overflow = "hidden";

  const alturaInicial =
    elementoItem.offsetHeight;

  elementoItem.style.height =
    `${alturaInicial}px`;

  const animacao =
    elementoItem.animate(
      [
        {
          opacity: 1,
          transform: "translateX(0)",
          height: `${alturaInicial}px`,
          marginTop: getComputedStyle(
            elementoItem,
          ).marginTop,
          marginBottom: getComputedStyle(
            elementoItem,
          ).marginBottom,
        },
        {
          opacity: 0,
          transform: "translateX(45px)",
          height: `${alturaInicial}px`,
          offset: 0.55,
        },
        {
          opacity: 0,
          transform: "translateX(55px)",
          height: "0px",
          marginTop: "0px",
          marginBottom: "0px",
        },
      ],
      {
        duration: 420,
        easing: "ease",
        fill: "forwards",
      },
    );

  animacao.addEventListener(
    "finish",
    concluirExclusao,
    {
      once: true,
    },
  );

  animacao.addEventListener(
    "cancel",
    concluirExclusao,
    {
      once: true,
    },
  );

  setTimeout(
    concluirExclusao,
    520,
  );
}

function obterNomeDiaAtual() {
  const dias = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado"
  ];

  return dias[new Date().getDay()];
}

function horarioParaMinutos(horario) {
  const partes = String(horario).trim().split(":");

  if (partes.length !== 2) return null;

  const horas = Number(partes[0]);
  const minutos = Number(partes[1]);

  if (
    isNaN(horas) ||
    isNaN(minutos) ||
    horas < 0 ||
    horas > 23 ||
    minutos < 0 ||
    minutos > 59
  ) {
    return null;
  }

  return horas * 60 + minutos;
}

function atualizarStatusHorarioLoja() {
  const status = document.getElementById(
    "status-horario",
  );

  const textoStatus = document.getElementById(
    "texto-status-horario",
  );

  const horarioHoje = document.getElementById(
    "horario-hoje-cardapio",
  );

  if (!status || !textoStatus || !horarioHoje) {
    return;
  }

  const agora = new Date();
  const diaAtual = obterNomeDiaAtual();

  const minutosAgora =
    agora.getHours() * 60 +
    agora.getMinutes();

  const horariosHoje = horariosLoja
    .filter((item) => {
      return (
        String(item.dia || "").trim() === diaAtual &&
        String(item.status || "").trim() === "Aberto" &&
        item.abertura &&
        item.fechamento
      );
    })
    .sort((a, b) => {
      return (
        horarioParaMinutos(a.abertura) -
        horarioParaMinutos(b.abertura)
      );
    });

  const horarioAtual = horariosHoje.find((item) => {
    const inicio = horarioParaMinutos(item.abertura);
    const fim = horarioParaMinutos(item.fechamento);

    return (
      minutosAgora >= inicio &&
      minutosAgora <= fim
    );
  });

  lojaAbertaAgora = Boolean(horarioAtual);

  if (horariosHoje.length > 0) {
    horarioHoje.textContent = horariosHoje
      .map((item) => {
        return `${item.abertura} - ${item.fechamento}`;
      })
      .join(" / ");
  } else {
    horarioHoje.textContent = "Fechado hoje";
  }

  status.classList.remove(
    "status-aberto",
    "status-fechado",
  );

  if (lojaAbertaAgora) {
    textoStatus.textContent = "Aberto agora";
    status.classList.add("status-aberto");
    return;
  }

  textoStatus.textContent = "Fechado";
  status.classList.add("status-fechado");
}

function obterPedidosEmAndamento() {
  return JSON.parse(localStorage.getItem("pedidosEmAndamento")) || [];
}

function salvarPedidosEmAndamento(lista) {
  localStorage.setItem("pedidosEmAndamento", JSON.stringify(lista));
}

function limparPedidosAndamentoExpirados() {
  const agora = Date.now();
  const pedidos = obterPedidosEmAndamento();

  const pedidosValidos = [];

  pedidos.forEach((pedido) => {
    const expirou =
      Number(pedido.expiraEm || 0) > 0 &&
      Number(pedido.expiraEm) <= agora;

    if (expirou) {

      const pagamentoAprovado =
        String(pedido.statusPagamento || "").trim() ===
        "Pagamento aprovado";

      if (!pagamentoAprovado) {
        fetch(
          `${URL_CONTROLE}?acao=expirarReservaEstoquePedido` +
          `&pedidoId=${encodeURIComponent(pedido.pedidoId)}` +
          `&t=${Date.now()}`
        );
      }

      return;
    }

    pedidosValidos.push(pedido);
  });

  salvarPedidosEmAndamento(pedidosValidos);
}

function renderizarBotaoPedidosAndamento() {
  limparPedidosAndamentoExpirados();

  const botao = document.getElementById("pedido-andamento-btn");
  const pedidos = obterPedidosEmAndamento();

  if (!botao) return;

  if (pedidos.length === 0) {
    botao.style.display = "none";
    return;
  }

  botao.style.display = "block";
  botao.textContent =
    pedidos.length === 1
      ? "📦 1 pedido em andamento"
      : `📦 ${pedidos.length} pedidos em andamento`;
}

function salvarPedidoEmAndamento(pedido) {
  const pedidos = obterPedidosEmAndamento();

  const semDuplicar = pedidos.filter((item) => {
    return item.pedidoId !== pedido.pedidoId;
  });

  semDuplicar.unshift(pedido);

  salvarPedidosEmAndamento(semDuplicar);
  renderizarBotaoPedidosAndamento();
}

function abrirListaPedidosAndamento() {
  const pedidos = obterPedidosEmAndamento();

  if (pedidos.length === 0) {
    renderizarBotaoPedidosAndamento();
    return;
  }

  if (pedidos.length === 1) {
    abrirAcompanhamentoPedido(pedidos[0].pedidoId);
    return;
  }

  const conteudo = document.getElementById("conteudo-acompanhamento");

  conteudo.innerHTML = `
      <h2>Pedidos em andamento</h2>

      <div class="lista-pedidos-andamento">
        ${pedidos
      .map(
        (pedido) => `
              <button
                type="button"
                class="pedido-andamento-item"
                onclick="abrirAcompanhamentoPedido('${pedido.pedidoId}')"
              >
                <strong>Pedido #${pedido.numeroPedido || pedido.pedidoId}</strong>
                <span>${pedido.statusPedido || "Aguardando confirmação"}</span>
                <small>Total: R$${formatarPreco(pedido.total)}</small>
              </button>
            `,
      )
      .join("")}
      </div>
    `;

  document.getElementById("overlay-acompanhamento").classList.add("ativo");
  document.getElementById("modal-acompanhamento").classList.add("ativo");
}

async function abrirAcompanhamentoPedido(pedidoId) {
  const pedido = obterPedidosEmAndamento().find((item) => {
    return String(item.pedidoId) === String(pedidoId);
  });

  if (!pedido) {
    mostrarAlerta(
      "Este pedido não foi encontrado ou já expirou.",
      "erro",
    );

    renderizarBotaoPedidosAndamento();
    return;
  }

  pedidoAcompanhamentoAberto = String(pedidoId);

  if (timeoutStatusCliente) {
    clearTimeout(timeoutStatusCliente);
    timeoutStatusCliente = null;
  }

  renderizarAcompanhamentoPedido(pedido);

  document.getElementById("overlay-acompanhamento").classList.add("ativo");
  document.getElementById("modal-acompanhamento").classList.add("ativo");

  if (pedido.statusPagamento !== "Pagamento aprovado") {
    verificarPagamentoPedido(pedido.pedidoId);
  }

  iniciarAtualizacaoStatusCliente(pedido.pedidoId);
}

const intervalosStatusPedido = {};

function iniciarAtualizacaoStatusCliente(pedidoId) {
  pedidoId = String(pedidoId);

  if (timeoutStatusCliente) {
    clearTimeout(timeoutStatusCliente);
    timeoutStatusCliente = null;
  }

  async function atualizar() {
    if (pedidoAcompanhamentoAberto !== pedidoId) return;

    const pedidoPlanilha = await consultarStatusPedidoPlanilha(pedidoId);

    if (pedidoPlanilha) {
      const pedidos = obterPedidosEmAndamento();

      const atualizados = pedidos.map((pedido) => {
        if (String(pedido.pedidoId) !== String(pedidoId)) return pedido;

        return {
          ...pedido,

          numeroPedido:
            pedidoPlanilha.NumeroPedido ||
            pedido.numeroPedido ||
            "",

          whatsapp:
            pedidoPlanilha.WhatsApp ||
            pedido.whatsapp ||
            "",

          linkRastreio:
            pedidoPlanilha.LinkRastreio ||
            pedido.linkRastreio ||
            "",

          statusPagamento:
            pedidoPlanilha.Pagamento ||
            pedido.statusPagamento,

          statusPedido:
            pedidoPlanilha.Status ||
            pedido.statusPedido,
        };
      });

      salvarPedidosEmAndamento(atualizados);

      const pedidoAtual = atualizados.find((pedido) => {
        return String(pedido.pedidoId) === pedidoId;
      });

      if (
        pedidoAtual &&
        pedidoAcompanhamentoAberto === pedidoId
      ) {
        renderizarAcompanhamentoPedido(pedidoAtual);
      }
    }

    timeoutStatusCliente = setTimeout(atualizar, 15000);
  }

  atualizar();
}

function fecharAcompanhamentoPedido() {
  pedidoAcompanhamentoAberto = null;

  if (timeoutStatusCliente) {
    clearTimeout(timeoutStatusCliente);
    timeoutStatusCliente = null;
  }

  document.getElementById("overlay-acompanhamento").classList.remove("ativo");
  document.getElementById("modal-acompanhamento").classList.remove("ativo");
}

function consultarStatusPedidoPlanilha(pedidoId) {
  return new Promise((resolve) => {
    const callbackName = `receberPedidosCliente_${Date.now()}`;

    window[callbackName] = function (resultado) {
      try {
        if (!resultado || !resultado.sucesso || !resultado.pedidos) {
          resolve(null);
          return;
        }

        const pedidoEncontrado = resultado.pedidos.find((pedido) => {
          return String(pedido.PedidoId || "") === String(pedidoId);
        });

        resolve(pedidoEncontrado || null);
      } finally {
        delete window[callbackName];

        const script = document.getElementById(callbackName);
        if (script) script.remove();
      }
    };

    const script = document.createElement("script");
    script.id = callbackName;
    script.src =
      `${URL_CONTROLE}?acao=obterPedidos` +
      `&callback=${callbackName}` +
      `&t=${Date.now()}`;

    script.onerror = () => {
      delete window[callbackName];
      resolve(null);
    };

    document.body.appendChild(script);
  });
}

function gerarLinkAjudaPedido(pedido) {
  const whatsapp = String(perfilLoja.WhatsAppSuporte || "").replace(/\D/g, "");

  if (!whatsapp) return "#";

  const numeroPedido = pedido.numeroPedido || pedido.pedidoId || "";

  const mensagemBase =
    perfilLoja.MensagemAjudaPedido ||
    "Olá, tive um problema com meu pedido {pedido}. Pode me ajudar?";

  const mensagem = mensagemBase.replace("{pedido}", `#${numeroPedido}`);

  return `https://wa.me/55${whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

function renderizarAcompanhamentoPedido(pedido) {
  const conteudo = document.getElementById("conteudo-acompanhamento");

  const itensHtml = pedido.itens
    .map((item) => {
      const quantidade = parseInt(item.quantidade) || 1;
      const valorTotal = parseFloat(item.totalPrice) * quantidade;

      return `
          <div class="acompanhamento-item">
            <div>
              <strong>${quantidade}x ${item.name}</strong>
              ${item.adicionais
  ? formatarComplementosParaPedido(item.adicionais)
      .split("\n")
      .map((linha) => `<p>${linha}</p>`)
      .join("")
  : ""}
            </div>

            <span>R$${formatarPreco(valorTotal)}</span>
          </div>
        `;
    })
    .join("");

  conteudo.innerHTML = `
      <h2>Acompanhe seu pedido</h2>

      <p class="pedido-id">
    Pedido #${pedido.numeroPedido || pedido.pedidoId}
  </p>

      <div class="status-box">
        <strong>Pagamento</strong>
        <span id="status-pagamento-acompanhamento">
          ${pedido.statusPagamento || "Aguardando pagamento"}
        </span>
      </div>

      <div class="status-box">
        <strong>Status do pedido</strong>
        <span>${pedido.statusPedido || "Aguardando confirmação"}</span>
      </div>

      ${pedido.statusPedido === "Saiu para entrega" && pedido.linkRastreio
      ? `
        <a
    class="btn-acompanhar-entrega"
    target="_blank"
    href="${pedido.linkRastreio.startsWith("http") ? pedido.linkRastreio : "https://" + pedido.linkRastreio}"
  >
    🛵 Acompanhar pedido
  </a>
      `
      : ""
    }

  ${pedido.statusPedido === "Saiu para entrega"
      ? `
        <div class="codigo-confirmacao">
          Código de confirmação:
          <strong>${String(pedido.whatsapp || "").replace(/\D/g, "").slice(-4)}</strong>
        </div>
      `
      : ""
    }

      ${pedido.tipoEntrega === "retirada"
      ? `
      <div class="box-dados-acompanhamento retirada">
        <h3>Endereço de retirada</h3>
        <p>${String(pedido.enderecoRetirada || "").replace(/\n/g, "<br>")}</p>

        <a
          class="btn-rota-retirada"
          target="_blank"
          href="${gerarLinkMapsRetirada()}"
        >
          📍 Rota
        </a>

        <div class="dados-cliente-acompanhamento">
          <p><strong>Nome:</strong> ${pedido.endereco?.nome || ""}</p>
          <p><strong>WhatsApp:</strong> ${pedido.endereco?.whatsapp || ""}</p>
        </div>
      </div>
    `
      : `
      <div class="box-dados-acompanhamento entrega">
        <h3>Dados de entrega</h3>
        <p><strong>Nome:</strong> ${pedido.endereco?.nome || ""}</p>
        <p><strong>WhatsApp:</strong> ${pedido.endereco?.whatsapp || ""}</p>
        <p>${pedido.endereco?.rua || ""}, ${pedido.endereco?.numero || ""}</p>
        ${pedido.endereco?.complemento ? `<p>${pedido.endereco.complemento}</p>` : ""}
        <p>${pedido.endereco?.bairro || ""} - ${pedido.endereco?.cidade || ""}</p>
        <p>CEP: ${pedido.endereco?.cep || ""}</p>
      </div>
    `
    }

      <h3>Itens do pedido</h3>
      <div class="acompanhamento-itens">
        ${itensHtml}
      </div>

      <div class="acompanhamento-resumo">
        <p><span>Subtotal</span><strong>R$${formatarPreco(pedido.subtotal)}</strong></p>
        <p><span>Frete</span><strong>R$${formatarPreco(pedido.frete)}</strong></p>

        ${pedido.desconto > 0
      ? `<p><span>Desconto</span><strong>-R$${formatarPreco(pedido.desconto)}</strong></p>`
      : ""
    }

        <p class="total"><span>Total</span><strong>R$${formatarPreco(pedido.total)}</strong></p>
      </div>

          ${pedido.statusPagamento === "Pagamento aprovado"
      ? `
        <button
          type="button"
          class="abrir-pagamento-acompanhamento"
          disabled
        >
          Pagamento aprovado ✓
        </button>
      `
      : `
        <button
          type="button"
          class="abrir-pagamento-acompanhamento"
          onclick="abrirPagamentoPedido('${pedido.pedidoId}')"
        >
          Abrir pagamento
        </button>
      `
    }

      <a
        class="btn-suporte-whatsapp"
        target="_blank"
        href="${gerarLinkAjudaPedido(pedido)}"
      >
        💬 Preciso de ajuda
      </a>
    `;
}

function abrirPagamentoPedido(pedidoId) {
  const pedido = obterPedidosEmAndamento().find((item) => {
    return item.pedidoId === pedidoId;
  });

  if (!pedido || !pedido.linkPagamento) {
    mostrarAlerta(
      "O link de pagamento não está mais disponível.",
      "erro",
    );

    return;
  }

  window.open(pedido.linkPagamento, "_blank");
}

async function verificarPagamentoPedido(pedidoId) {
  const pedidoLocal = obterPedidosEmAndamento().find((pedido) => {
    return String(pedido.pedidoId) === String(pedidoId);
  });

  if (
    pedidoLocal &&
    pedidoLocal.statusPagamento === "Pagamento aprovado"
  ) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/verificar-pagamento/${pedidoId}`);
    const data = await response.json();

    let pedidos = obterPedidosEmAndamento();

    pedidos = pedidos.map((pedido) => {
      if (String(pedido.pedidoId) !== String(pedidoId)) return pedido;

      const pagamentoAprovado =
        data.aprovado === true ||
        pedido.statusPagamento === "Pagamento aprovado";

      const pedidoAtualizado = {
        ...pedido,
        statusPagamento: pagamentoAprovado
          ? "Pagamento aprovado"
          : "Aguardando pagamento",
      };

      if (pagamentoAprovado && !pedido.salvoNaPlanilha) {
        salvarPedidoNaPlanilha({
          ...pedidoAtualizado,
          statusPedido: pedido.statusPedido || "Aguardando confirmação",
          pagamento: "Pagamento aprovado",
        });

        confirmarReservaEstoqueCardapio(pedidoAtualizado.pedidoId);

        pedidoAtualizado.salvoNaPlanilha = true;
        pedidoAtualizado.expiraEm = Date.now() + TEMPO_PEDIDO_PAGO;
      }

      return pedidoAtualizado;
    });

    salvarPedidosEmAndamento(pedidos);

    const pedidoAtual = pedidos.find((item) => {
      return String(item.pedidoId) === String(pedidoId);
    });

    if (pedidoAtual) {
      renderizarAcompanhamentoPedido(pedidoAtual);
    }

    renderizarBotaoPedidosAndamento();

    if (
      pedidoAtual &&
      pedidoAtual.statusPagamento !== "Pagamento aprovado"
    ) {
      setTimeout(() => {
        verificarPagamentoPedido(pedidoId);
      }, 15000);
    }
  } catch (error) {
    console.error(error);

    setTimeout(() => {
      verificarPagamentoPedido(pedidoId);
    }, 30000);
  }
}

function salvarPedidoNaPlanilha(pedido) {
  const params = new URLSearchParams({
    acao: "salvarPedido",
    pedidoId: pedido.pedidoId,
    cliente: pedido.endereco?.nome || "",
    whatsapp: pedido.endereco?.whatsapp || "",
    itens: pedido.itensTexto,
    endereco: pedido.enderecoTexto,
    subtotal: pedido.subtotal,
    frete: pedido.frete,
    desconto: pedido.desconto,
    total: pedido.total,
    cupom: pedido.cupom || "",
    pagamento: pedido.statusPagamento,
    status: pedido.statusPedido,
    linkPagamento: pedido.linkPagamento,
  });

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = `${URL_CONTROLE}?${params.toString()}`;

  document.body.appendChild(iframe);

  setTimeout(() => {
    iframe.remove();
  }, 3000);
}

function formatarComplementosParaPedido(adicionais) {
  if (!adicionais) return "";

  // Novo formato
  if (Array.isArray(adicionais)) {
    return adicionais
      .map((adicional) => {
        if (typeof adicional === "string") {
          return adicional.trim();
        }

        const grupo = String(adicional.grupo || "").trim();
        const nome = String(adicional.nome || adicional.item || "").trim();
        const quantidade = Math.max(
          1,
          Number(adicional.quantidade || 1)
        );

        if (!nome) return "";

        return `${grupo ? grupo + ": " : ""}${quantidade}x ${nome}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  // Compatibilidade com pedidos antigos
  return String(adicionais)
    .replace(/^Adicional:\s*/i, "")
    .split(", ")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join("\n");
}

function montarMensagemEstoque(dados) {

  const produtos =
    dados.produtosAfetados || [];

  if (!produtos.length) {
    return (
      dados.erro ||
      "Estoque insuficiente."
    );
  }

  if (produtos.length === 1) {
    return `Não temos estoque suficiente para a quantidade escolhida de ${produtos[0]}.`;
  }

  const lista =
    produtos.length === 2
      ? produtos.join(" e ")
      : produtos.slice(0, -1).join(", ") +
      " e " +
      produtos.at(-1);

  return (
    "A combinação escolhida ultrapassa o estoque disponível para " +
    lista +
    ".\n\nReduza as quantidades e tente novamente."
  );
}

async function confirmarPedido() {
  if (pedidoFinalizando) return;

  pedidoFinalizando = true;

  const botaoFinalizar = document.getElementById("confirmar-pedido");

  function converterNumero(valor) {
    return Number(
      String(valor || "0")
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    ) || 0;
  }

  function liberarFinalizacao(texto = "Finalizar Pedido") {
    pedidoFinalizando = false;

    if (botaoFinalizar) {
      botaoFinalizar.disabled = false;
      botaoFinalizar.classList.remove("botao-carregando");
      botaoFinalizar.textContent = texto;
    }
  }

  if (botaoFinalizar) {
    botaoFinalizar.disabled = true;
    botaoFinalizar.classList.add("botao-carregando");
    botaoFinalizar.textContent = "Gerando pedido";
  }

  try {
    await carregarHorariosLoja();
  } catch (erro) {
    console.error("Erro ao verificar horário da loja:", erro);

    mostrarAlerta(
      "Não foi possível verificar o horário da loja. Tente novamente.",
      "erro",
    );

    liberarFinalizacao();
    return;
  }

  if (!lojaAbertaAgora) {
    mostrarAlerta(
      "Estamos fora do horário de funcionamento. Confira os horários disponíveis antes de finalizar o pedido.",
      "aviso",
    );

    liberarFinalizacao();
    return;
  }

  const pedidos =
    JSON.parse(localStorage.getItem("pedidos")) || [];

  if (pedidos.length === 0) {
    mostrarAlerta(
      "Adicione pelo menos um produto ao pedido.",
      "aviso",
    );

    liberarFinalizacao();
    return;
  }

  const retiradaSelecionada =
    tipoEntregaSelecionado === "retirada";

  if (!validarDadosEtapaFinal()) {
    liberarFinalizacao();
    return;
  }

  const enderecoPreenchido =
    salvarDadosEtapaFinal();

  const endereco = retiradaSelecionada
    ? obterDadosRetiradaCliente()
    : enderecoPreenchido;

  const dadosRetirada =
    retiradaSelecionada
      ? endereco
      : null;

  if (botaoFinalizar) {
    botaoFinalizar.textContent = "Gerando pagamento";
  }

  let frete = 0;

  if (!retiradaSelecionada) {
    const freteAtual =
      calcularFretePorBairro(endereco?.bairro || "");

    if (
      !enderecoAtendido ||
      freteAtual === null ||
      Number(freteAtual) <= 0
    ) {
      mostrarAlerta(
        "No momento não conseguimos atender este endereço. Verifique o CEP informado.",
        "aviso",
      );

      liberarFinalizacao();
      return;
    }

    frete = Number(freteAtual);

    endereco.frete = frete;

    localStorage.setItem(
      "endereco",
      JSON.stringify(endereco)
    );
  }
  let subtotal = 0;

  pedidos.forEach((pedido) => {
    const quantidade =
      parseInt(pedido.quantidade) || 1;

    const valor =
      Number(pedido.totalPrice) || 0;

    subtotal += valor * quantidade;
  });

  const pedidoMinimo = converterNumero(perfilLoja.PedidoMinimo);

  if (pedidoMinimo > 0 && subtotal < pedidoMinimo) {
    mostrarAlerta(
      `O pedido mínimo é de R$${formatarPreco(pedidoMinimo)} em produtos.`,
      "aviso",
    );
    liberarFinalizacao();
    return;
  }

  let descontoCupom =
    calcularDescontoCupom(
      subtotal,
      frete,
    );

  let totalFinal =
    Math.max(
      0,
      subtotal +
      frete -
      descontoCupom,
    );

  const nomeLojaPedido =
    perfilLoja.NomeLoja || "Loja";

  const enderecoPedido =
    retiradaSelecionada
      ? {
        nome: dadosRetirada.nome,
        whatsapp:
          dadosRetirada.whatsapp,
        tipoEntrega: "retirada",
        frete: 0,
        enderecoRetirada:
          dadosRetirada.enderecoRetirada,
      }
      : {
        ...endereco,
        tipoEntrega: "entrega",
      };

  let mensagem = "";
  let itensTexto = "";

  const enderecoTexto = retiradaSelecionada
    ? `RETIRADA NO ESTABELECIMENTO

${dadosRetirada.enderecoRetirada}`
    : [
      `${endereco.rua}, ${endereco.numero}`,
      endereco.complemento || "",
      `${endereco.bairro} - ${endereco.cidade}`,
      `CEP: ${endereco.cep}`,
    ]
      .filter(Boolean)
      .join("\n");

  try {
    if (!API_URL) {
      mostrarAlerta(
        "Não foi possível conectar com o sistema de pagamento. Tente novamente.",
        "erro",
      );
      liberarFinalizacao();
      return;
    }

    if (botaoFinalizar) {
      botaoFinalizar.textContent = "Verificando";
    }

    const respostaEstoque = await fetch(
      `${URL_CONTROLE}?acao=validarEstoquePedido` +
      `&itens=${encodeURIComponent(JSON.stringify(pedidos))}` +
      `&t=${Date.now()}`
    );

    let dadosEstoque;

    try {
      dadosEstoque =
        await respostaEstoque.json();
    } catch {
      throw new Error(
        "Erro ao validar estoque."
      );
    }

    if (!dadosEstoque.sucesso) {
      mostrarAlerta(
        montarMensagemEstoque(dadosEstoque),
        "erro",
      );

      liberarFinalizacao();
      return;
    }

    if (botaoFinalizar) {
      botaoFinalizar.textContent = "Carregando";
    }

    if (!API_URL) {
      mostrarAlerta(
        "O pagamento está temporariamente indisponível. Entre em contato com a loja.",
        "erro",
      );

      liberarFinalizacao();
      return;
    }

    const response = await fetch(
      `${API_URL}/criar-pagamento`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo:
            `Pedido ${nomeLojaPedido}`,

          itens: pedidos,

          tipoEntrega:
            retiradaSelecionada
              ? "retirada"
              : "entrega",

          bairro:
            retiradaSelecionada
              ? ""
              : String(
                endereco?.bairro || "",
              ).trim(),

          cupom:
            cupomAplicado
              ? String(
                cupomAplicado.Cupom || "",
              )
                .trim()
                .toUpperCase()
              : "",
        }),
      },
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "A API retornou uma resposta inválida."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.erro ||
        data.mensagem ||
        "Erro ao gerar pagamento."
      );
    }

    const calculoOficial =
      data.calculo;

    if (
      !calculoOficial ||
      typeof calculoOficial !== "object"
    ) {
      throw new Error(
        "A API não retornou o cálculo oficial do pedido.",
      );
    }

    const subtotalOficial =
      Number(
        calculoOficial.subtotal,
      );

    const freteOficial =
      Number(
        calculoOficial.frete,
      );

    const descontoOficial =
      Number(
        calculoOficial.desconto,
      );

    const totalOficial =
      Number(
        calculoOficial.total,
      );

    if (
      !Number.isFinite(
        subtotalOficial,
      ) ||
      subtotalOficial < 0 ||
      !Number.isFinite(
        freteOficial,
      ) ||
      freteOficial < 0 ||
      !Number.isFinite(
        descontoOficial,
      ) ||
      descontoOficial < 0 ||
      !Number.isFinite(
        totalOficial,
      ) ||
      totalOficial <= 0
    ) {
      throw new Error(
        "A API retornou valores inválidos para o pedido.",
      );
    }

    /*
     * A partir daqui, usamos somente
     * os valores oficiais retornados
     * pelo servidor.
     */
    subtotal = subtotalOficial;
    frete = freteOficial;
    descontoCupom =
      descontoOficial;
    totalFinal = totalOficial;

    enderecoPedido.frete = frete;

    /*
     * Atualiza também o endereço salvo
     * com o frete oficial.
     */
    if (
      !retiradaSelecionada &&
      endereco
    ) {
      endereco.frete = frete;

      localStorage.setItem(
        "endereco",
        JSON.stringify(endereco),
      );
    }

    const itensOficiais =
      Array.isArray(
        calculoOficial.itens,
      )
        ? calculoOficial.itens
        : [];

    mensagem =
      `Pedido realizado - ${nomeLojaPedido}!\n\n`;

    itensTexto = "";

    pedidos.forEach(
      (pedido, index) => {
        const quantidade =
          parseInt(
            pedido.quantidade,
          ) || 1;

        const itemOficial =
          itensOficiais[index];

        /*
         * O valor exibido no pedido deve
         * vir do cálculo oficial.
         */
        const valorTotalItem =
          itemOficial &&
            Number.isFinite(
              Number(
                itemOficial.valorTotal,
              ),
            )
            ? Number(
              itemOficial.valorTotal,
            )
            : 0;

        mensagem +=
          `${quantidade}x ${pedido.name}` +
          ` - R$${formatarPreco(valorTotalItem)}\n`;

        itensTexto +=
          `${quantidade}x ${pedido.name}` +
          ` - R$${formatarPreco(valorTotalItem)}\n`;

        if (
          pedido.category ===
          "salgado" &&
          pedido.queijo
        ) {
          mensagem +=
            `Queijo: ${pedido.queijo}\n`;

          itensTexto +=
            `Queijo: ${pedido.queijo}\n`;
        }

        if (pedido.adicionais) {
          const complementosFormatados =
            formatarComplementosParaPedido(
              pedido.adicionais,
            );

          mensagem +=
            `${complementosFormatados}\n`;

          itensTexto +=
            `${complementosFormatados}\n`;
        }

        mensagem += "\n";
        itensTexto += "\n";
      },
    );

    mensagem +=
      `Subtotal: R$${formatarPreco(subtotal)}\n`;

    if (!retiradaSelecionada) {
      mensagem +=
        `Frete: R$${formatarPreco(frete)}\n`;
    } else {
      mensagem +=
        "Tipo: RETIRADA NO LOCAL\n";
    }

    const codigoCupomOficial =
      String(
        calculoOficial.cupom || "",
      ).trim();

    if (
      codigoCupomOficial &&
      descontoCupom > 0
    ) {
      mensagem +=
        `Cupom: ${codigoCupomOficial}\n`;

      mensagem +=
        `Desconto: -R$${formatarPreco(descontoCupom)}\n`;
    }

    mensagem +=
      `Total: R$${formatarPreco(totalFinal)}\n\n`;

    if (retiradaSelecionada) {
      mensagem +=
        "RETIRADA NO LOCAL\n";

      mensagem +=
        `${dadosRetirada.nome}\n`;

      mensagem +=
        `WhatsApp: ${dadosRetirada.whatsapp}\n\n`;

      mensagem +=
        `Endereço de retirada:\n${dadosRetirada.enderecoRetirada}`;
    } else {
      mensagem +=
        "Endereço de entrega:\n";

      mensagem +=
        `${endereco.nome}\n`;

      mensagem +=
        `${endereco.rua}, ${endereco.numero}` +
        `${endereco.complemento
          ? " - " +
          endereco.complemento
          : ""
        }\n`;

      mensagem +=
        `${endereco.bairro} - ${endereco.cidade}\n`;

      mensagem +=
        `CEP: ${endereco.cep}`;
    }

    if (data.link && data.pedidoId) {
      if (botaoFinalizar) {
        botaoFinalizar.textContent = "Carregando";
      }

      const respostaReserva = await fetch(
        `${URL_CONTROLE}?acao=reservarEstoquePedido` +
        `&pedidoId=${encodeURIComponent(data.pedidoId)}` +
        `&itens=${encodeURIComponent(JSON.stringify(pedidos))}` +
        `&t=${Date.now()}`
      );

      let dadosReserva;

      try {
        dadosReserva =
          await respostaReserva.json();
      } catch {
        throw new Error(
          "Erro ao reservar o estoque."
        );
      }

      if (!dadosReserva.sucesso) {
        mostrarAlerta(
          montarMensagemEstoque(dadosReserva),
          "erro",
        );

        liberarFinalizacao();
        return;
      }

      const agora = Date.now();
      const pedidoEmAndamento = {
        pedidoId: data.pedidoId,
        numeroPedido: "",
        linkPagamento: data.link,
        criadoEm: agora,
        expiraEm: agora + TEMPO_PEDIDO_AGUARDANDO,

        estoqueReservado: true,

        statusPagamento: "Aguardando pagamento",
        statusPedido: "Aguardando confirmação",

        itens: pedidos,
        endereco: enderecoPedido,
        tipoEntrega: retiradaSelecionada ? "retirada" : "entrega",
        enderecoRetirada: retiradaSelecionada ? dadosRetirada.enderecoRetirada : "",

        subtotal,
        frete,
        desconto: descontoCupom,
        total: totalFinal,
        cupom: String(
          calculoOficial.cupom || "",
        ).trim(),
        mensagem,
      };

      pedidoEmAndamento.itensTexto = itensTexto;
      pedidoEmAndamento.enderecoTexto = enderecoTexto;

      // Primeiro salva o pedido em andamento
      salvarPedidoEmAndamento(pedidoEmAndamento);

      // Depois salva os dados necessários para recuperar o pagamento
      localStorage.setItem(
        "mensagemPedidoPendente",
        mensagem
      );

      localStorage.setItem(
        "pedidoIdPendente",
        data.pedidoId
      );

      localStorage.setItem(
        "linkPagamentoPendente",
        data.link
      );

      // Só depois limpa o carrinho e o cupom
      localStorage.removeItem("pedidos");
      localStorage.removeItem("cupomAplicado");

      cupomAplicado = null;

      atualizarResumoPedido();

      // Por último tenta abrir o checkout
      const janelaPagamento = window.open(
        data.link,
        "_blank"
      );

      if (!janelaPagamento) {
        mostrarAlerta(
          "O navegador bloqueou a abertura automática do pagamento. Use o botão Abrir pagamento no acompanhamento do pedido.",
          "aviso",
          7000,
        );
      }

      if (botaoFinalizar) {
        botaoFinalizar.textContent = "Pedido enviado";
      }

      setTimeout(() => {
        liberarFinalizacao();
      }, 3000);

      fecharCarrinhoDrawer();
      abrirAcompanhamentoPedido(data.pedidoId);
    } else {
      liberarFinalizacao();

      mostrarAlerta(
        "Não foi possível gerar o pagamento. Tente novamente.",
        "erro",
      );
    }
  } catch (error) {
    console.error(
      "Erro ao finalizar pedido:",
      error
    );

    liberarFinalizacao();

    mostrarAlerta(
      error?.message ||
      "Não foi possível finalizar o pedido. Tente novamente.",
      "erro",
    );
  }
}
