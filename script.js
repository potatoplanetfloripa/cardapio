let pedidoAcompanhamentoAberto = null;
let timeoutStatusCliente = null;
const URL_CONTROLE =
  'https://script.google.com/macros/s/AKfycbxtEiOTWzHDTC2CO3XKG5rb-KEE2lPr6tz6RBHojLpUfQZHwoi5CS_Y0NOaQDFP71uTVA/exec';

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

async function aplicarCupom() {
  const input = document.getElementById("cupom-input");
  const mensagem = document.getElementById("cupom-mensagem");

  const codigo = input.value.trim().toUpperCase();

  mensagem.textContent = "";
  mensagem.style.color = "#9b1d1d";

  if (!codigo) {
    mensagem.textContent = "Digite um cupom.";
    return;
  }

  try {
    await carregarCuponsCardapio();
  } catch (erro) {
    mensagem.textContent = "Não foi possível validar o cupom agora. Tente novamente.";
    return;
  }

  const cupom = cuponsDisponiveis.find((item) => {
    return String(item.Cupom || "").trim().toUpperCase() === codigo;
  });

  if (!cupom) {
    mensagem.textContent = "Cupom não encontrado.";
    return;
  }

  if (String(cupom.Status || "").trim() !== "Ativo") {
    mensagem.textContent = "Este cupom não está ativo.";
    return;
  }

  const pedidos = JSON.parse(localStorage.getItem("pedidos")) || [];
  const endereco = JSON.parse(localStorage.getItem("endereco"));

  let subtotal = 0;

  pedidos.forEach((pedido) => {
    subtotal +=
      parseFloat(pedido.totalPrice) *
      (parseInt(pedido.quantidade) || 1);
  });

  if (pedidos.length === 0 || subtotal <= 0) {
    mensagem.textContent = "Adicione itens ao pedido antes de usar um cupom.";
    return;
  }

  const aplicaEm = String(cupom["Aplica Em"] || cupom["Aplica em"] || "")
    .trim()
    .toLowerCase();

  const pedidoMinimo = Number(cupom["Pedido Mínimo"] || 0);

  if (subtotal < pedidoMinimo) {
    mensagem.textContent =
      `Este cupom é válido apenas para pedidos acima de R$${formatarPreco(pedidoMinimo)}.`;
    return;
  }

  if (tipoEntregaSelecionado === "retirada" && aplicaEm === "frete") {
    mensagem.textContent = "Cupom válido apenas para entrega.";
    return;
  }

  if (aplicaEm === "frete") {
    if (!endereco || !endereco.frete || Number(endereco.frete) <= 0) {
      mensagem.textContent =
        "Adicione um endereço com frete calculado antes de usar este cupom.";
      return;
    }
  }

  cupomAplicado = cupom;
  localStorage.setItem("cupomAplicado", codigo);

  mensagem.textContent = `Cupom ${codigo} aplicado.`;
  mensagem.style.color = "#1f7a38";

  atualizarResumoPedido();
}

function removerCupom() {
  cupomAplicado = null;
  localStorage.removeItem("cupomAplicado");

  const input = document.getElementById("cupom-input");
  const mensagem = document.getElementById("cupom-mensagem");

  if (input) input.value = "";
  if (mensagem) mensagem.textContent = "";

  atualizarResumoPedido();
}

function calcularFretePorBairro(bairro) {
  const bairroNormalizado = normalizarTexto(bairro);
  return tabelaFrete[bairroNormalizado] || null;
}

function atualizarFreteEnderecoSalvo() {
  const endereco = JSON.parse(localStorage.getItem('endereco'));

  if (!endereco || !endereco.bairro) return;

  const novoFrete = calcularFretePorBairro(endereco.bairro);

  endereco.frete = novoFrete;

  localStorage.setItem('endereco', JSON.stringify(endereco));

  mostrarFreteEndereco(novoFrete);
  atualizarResumoPedido();
}

function mostrarFreteEndereco(valor) {
  if (tipoEntregaSelecionado === "retirada") {
    const avisoAtual = document.getElementById("aviso-frete-calculado");

    if (avisoAtual) {
      avisoAtual.style.display = "none";
    }

    return;
  }

  let aviso = document.getElementById('aviso-frete-calculado');

  if (!aviso) {
    aviso = document.createElement('p');
    aviso.id = 'aviso-frete-calculado';
    aviso.style.fontWeight = 'bold';
    aviso.style.marginTop = '8px';
    aviso.style.marginLeft = '12px';
    aviso.style.marginBottom = '12px';

    const adicionarEnderecoBtn = document.getElementById('adicionar-endereco');
    adicionarEnderecoBtn.insertAdjacentElement('beforebegin', aviso);
  }

  if (valor) {
    aviso.textContent = `Frete: R$${formatarPreco(valor)}`;
    aviso.style.color = '#1f7a38';
  } else {
    aviso.textContent =
      'No momento não conseguimos atender este endereço. Consulte disponibilidade pelo iFood.';
    aviso.style.color = '#9b1d1d';
  }
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

  localStorage.setItem("tipoEntregaSelecionado", tipoEntregaSelecionado);

  const btnEntrega = document.getElementById("btn-tipo-entrega");
  const btnRetirada = document.getElementById("btn-tipo-retirada");
  const boxInfoRetirada = document.getElementById("box-info-retirada");
  const textoEnderecoRetirada = document.getElementById("texto-endereco-retirada");
  const boxDadosEntrega = document.getElementById("box-dados-entrega");
  const botaoAdicionarEndereco = document.getElementById("adicionar-endereco");

  if (btnEntrega) {
    btnEntrega.classList.toggle("ativo", tipo === "entrega");
  }

  if (btnRetirada) {
    btnRetirada.classList.toggle("ativo", tipo === "retirada");
  }

  if (boxInfoRetirada) {
    boxInfoRetirada.style.display = tipo === "retirada" ? "block" : "none";
  }

  if (textoEnderecoRetirada) {
    textoEnderecoRetirada.innerHTML = `
    <a
      href="${gerarLinkMapsRetirada()}"
      target="_blank"
      class="link-endereco-retirada"
    >
      ${montarEnderecoRetiradaCardapio().replace(/\n/g, "<br>")}
    </a>
  `;
  }

  if (boxDadosEntrega) {
    boxDadosEntrega.style.display =
      tipo === "retirada" ? "none" : "block";
  }

  if (botaoAdicionarEndereco) {
    botaoAdicionarEndereco.style.display =
      tipo === "retirada" ? "none" : "block";
  }

  const avisoFrete = document.getElementById("aviso-frete-calculado");

  if (avisoFrete) {
    avisoFrete.style.display = tipo === "retirada" ? "none" : "block";
  }

  atualizarResumoPedido();
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

  const info = document.getElementById("info-loja-cardapio");
  if (info) {
    const partes = [];

    if (perfilLoja.TempoPreparo) {
      partes.push(`⏱ ${perfilLoja.TempoPreparo}`);
    }

    if (perfilLoja.PedidoMinimo) {
      partes.push(`Pedido mínimo R$${formatarPreco(perfilLoja.PedidoMinimo)}`);
    }

    info.textContent = partes.join(" • ");
    info.style.display = partes.length ? "block" : "none";
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
  const boxInfoRetirada = document.getElementById("box-info-retirada");
  const boxDadosEntrega = document.getElementById("box-dados-entrega");
  const botaoAdicionarEndereco = document.getElementById("adicionar-endereco");

  if (boxTipoEntrega) {
    boxTipoEntrega.style.display = "block";
  }

  if (opcoesTipoEntrega) {
    opcoesTipoEntrega.style.display = retiradaAtivaCardapio() ? "grid" : "none";
  }

  if (!retiradaAtivaCardapio()) {
    tipoEntregaSelecionado = "entrega";
    localStorage.setItem("tipoEntregaSelecionado", "entrega");

    if (boxInfoRetirada) boxInfoRetirada.style.display = "none";
    if (boxDadosEntrega) boxDadosEntrega.style.display = "block";
    if (botaoAdicionarEndereco) botaoAdicionarEndereco.style.display = "block";
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

    const exibirVazia = String(categoria.exibirVazia || "NÃO").trim() === "SIM";

    if (produtosCategoria.length === 0 && !exibirVazia) {
      return;
    }

    const secao = document.createElement("section");
    secao.className = "menu-section";

    const formatoCategoria = String(categoria.formato || "LISTA").trim();

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

    if (produtosCategoria.length === 0) {
      lista.innerHTML = `<p class="categoria-vazia">Em breve.</p>`;
    }

    produtosCategoria.forEach((produto) => {
      lista.innerHTML += montarHtmlProdutoCategoria(
        produto,
        categoria.categoria,
        formatoCategoria
      );
    });

    container.appendChild(secao);
  });

  ativarEventosProdutos();
}

function montarHtmlProdutoCategoria(produto, nomeCategoria, formatoCategoria = "LISTA") {
  const nome = produto.Nome;
  const precoDe = converterValorCardapio(produto.Preço || produto.Preco || 0);
  const precoPor = converterValorCardapio(produto.PrecoPor || produto["Preço Por"] || 0);

  const preco =
    precoPor > 0 && precoPor < precoDe
      ? precoPor
      : precoDe;
  const descricao = produto.Descrição || produto.Descricao || "";
  const imagem = produto.ImagemURL || "";

  const categoriaNormalizada = normalizarTexto(nomeCategoria);

  const categoriaPedido = categoriaNormalizada.includes("bebida")
    ? "bebida"
    : categoriaNormalizada.includes("doce")
      ? "doce"
      : "salgado";

  const classe = categoriaPedido === "bebida" ? "drink" : "dish";

  const htmlPreco =
    precoPor > 0 && precoPor < precoDe
      ? `
        <div class="preco-produto">
          <span class="preco-de">De R$${formatarPreco(precoDe)}</span>
          <strong class="preco-por">Por R$${formatarPreco(precoPor)}</strong>
        </div>
      `
      : `<p class="preco-normal">R$${formatarPreco(precoDe)}</p>`;

  if (String(formatoCategoria).trim() === "GRADE") {
    return `
    <div
      class="dish produto-grade-card"
      data-name="${nome}"
      data-price="${preco}"
      data-price-de="${precoDe}"
      data-price-por="${precoPor}"
      data-category="${categoriaPedido}"
    >
      <img src="${imagem}" alt="${nome}" />

      <div class="produto-grade-info">
        <h3>${nome}</h3>
        ${htmlPreco}
        <p>${descricao}</p>
      </div>
    </div>
  `;
  }

  if (categoriaPedido === "bebida") {
    return `
      <div
        class="${classe}"
        data-name="${nome}"
        data-price="${preco}"
        data-price-de="${precoDe}"
        data-price-por="${precoPor}"
      >
        <img src="${imagem}" alt="${nome}" />

        <div class="drink-info">
          <h3>${nome}</h3>
          ${htmlPreco}

          <div class="drink-acoes">
            <div class="quantidade-container">
              <button type="button" class="qtd-btn qtd-menos">−</button>
              <input type="number" class="qtd-input" value="1" min="1" />
              <button type="button" class="qtd-btn qtd-mais">+</button>
            </div>

            <button class="add-drink">Adicionar</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div
      class="${classe}"
      data-name="${nome}"
      data-price="${preco}"
      data-price-de="${precoDe}"
      data-price-por="${precoPor}"
      data-category="${categoriaPedido}"
    >
      <img src="${imagem}" alt="${nome}" />

      <div class="dish-info">
        <h3>${nome}</h3>
        ${htmlPreco}
        <p>${descricao}</p>
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

document.addEventListener('DOMContentLoaded', () => {
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
    carregarTabelaFrete().then(() => {
      atualizarFreteEnderecoSalvo();
    });
  }, TEMPO_ATUALIZACAO_FRETE);

  const adicionarEnderecoBtn = document.getElementById('adicionar-endereco');

  const cepCliente = document.getElementById('cep-cliente');
  const nomeCliente = document.getElementById('nome-cliente');
  const whatsappCliente = document.getElementById('whatsapp-cliente');
  const ruaCliente = document.getElementById('rua-cliente');
  const numeroCliente = document.getElementById('numero-cliente');
  const complementoCliente = document.getElementById('complemento-cliente');
  const bairroCliente = document.getElementById('bairro-cliente');
  const cidadeCliente = document.getElementById('cidade-cliente');
  const btnTipoEntrega = document.getElementById("btn-tipo-entrega");
  const btnTipoRetirada = document.getElementById("btn-tipo-retirada");

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

  adicionarEnderecoBtn.addEventListener('click', e => {
    e.preventDefault();
    salvarEndereco();
  });

  cepCliente.addEventListener('blur', e => {
    const cep = e.target.value.replace(/\D/g, '');

    if (cep.length === 8) {
      preencherEndereco(cep);
    }
  });

  bairroCliente.addEventListener('blur', () => {
    const frete = calcularFretePorBairro(bairroCliente.value);
    mostrarFreteEndereco(frete);
  });

  const enderecoSalvo = JSON.parse(localStorage.getItem('endereco'));

  if (enderecoSalvo) {
    nomeCliente.value = enderecoSalvo.nome || '';
    if (whatsappCliente) {
      whatsappCliente.value = enderecoSalvo.whatsapp || "";
    }
    cepCliente.value = enderecoSalvo.cep || '';
    ruaCliente.value = enderecoSalvo.rua || '';
    numeroCliente.value = enderecoSalvo.numero || '';
    complementoCliente.value = enderecoSalvo.complemento || '';
    bairroCliente.value = enderecoSalvo.bairro || '';
    cidadeCliente.value = enderecoSalvo.cidade || '';

    if (enderecoSalvo.bairro) {
      const freteAtual = calcularFretePorBairro(enderecoSalvo.bairro);

      if (freteAtual) {
        enderecoSalvo.frete = freteAtual;
        localStorage.setItem('endereco', JSON.stringify(enderecoSalvo));
        mostrarFreteEndereco(freteAtual);
      } else if (enderecoSalvo.frete) {
        mostrarFreteEndereco(enderecoSalvo.frete);
      }
    }
  }

  document
    .getElementById('confirmar-pedido')
    .addEventListener('click', confirmarPedido);

  document.getElementById('limpar-pedido').addEventListener('click', () => {
    if (confirm('Deseja limpar todo o pedido?')) {
      localStorage.removeItem('pedidos');
      atualizarResumoPedido();
    }
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
});


function abrirCarrinhoDrawer() {
  document.getElementById('carrinho-flutuante').style.display = 'none';
  const resumo = document.getElementById('resumo-pedido');
  const overlay = document.getElementById('overlay-carrinho');

  resumo.classList.add('carrinho-drawer-aberto');
  overlay.classList.add('ativo');
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

            return `
                  <label class="item-complemento">
  <input
    type="checkbox"
    id="${idSeguro}"
    value="${item.item}"
    data-grupo="${grupo.grupo}"
    data-price="${precoItem}"
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
          alert(`Você pode selecionar no máximo ${maximo} opção neste grupo.`);
        }
      });
    });
  });
}

function ativarEventosProdutos() {
  const dishes = document.querySelectorAll('.dish');
  const drinks = document.querySelectorAll('.drink');

  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const closeModal = document.querySelector('.close');

  dishes.forEach(dish => {
    dish.addEventListener('click', () => {
      const name = dish.dataset.name;
      const price = parseFloat(dish.dataset.price);
      const priceDe = parseFloat(dish.dataset.priceDe) || price;
      const pricePor = parseFloat(dish.dataset.pricePor) || 0;
      const category = dish.dataset.category;

      const produtoCompleto = controleProdutos.find((produto) => {
        return String(produto.Nome || "").trim() === String(name).trim();
      });

      const imagemProduto = produtoCompleto?.ImagemURL || "";
      const descricaoProduto =
        produtoCompleto?.Descrição || produtoCompleto?.Descricao || "";

      let modalContent = `
  <div class="modal-produto-topo">
    ${imagemProduto ? `<img src="${imagemProduto}" alt="${name}" />` : ""}

    <h3>${name}</h3>

    <p class="modal-produto-preco">
      R$${formatarPreco(price)}
    </p>

    ${descricaoProduto
          ? `<p class="modal-produto-descricao">${descricaoProduto}</p>`
          : ""
        }
  </div>

  <div id="complementos-produto-modal">
  ${montarHtmlComplementosProduto(name)}
</div>
`;

      modalContent += `
        <div class="modal-acoes">
          ${criarSeletorQuantidade()}
          <button id="add-produto" class="add-pedido">Adicionar</button>
        </div>
      `;

      modalBody.innerHTML = modalContent;


      modal.style.display = 'block';
      modal.dataset.produtoAberto = name;
      modal.scrollTop = 0;

      const carrinhoFlutuante = document.getElementById('carrinho-flutuante');

      if (carrinhoFlutuante) {
        carrinhoFlutuante.style.display = 'none';
      }

      ativarSeletorQuantidade(modalBody);

      ativarRegrasComplementosModal(modalBody);

      document.getElementById('add-produto').addEventListener('click', () => {
        const quantidade =
          parseInt(modalBody.querySelector('.qtd-input').value) || 1;
        const gruposDinamicos = modalBody.querySelectorAll(".grupo-complemento-dinamico");

        for (const grupo of gruposDinamicos) {
          const nomeGrupo = grupo.dataset.grupo;
          const minimo = Number(grupo.dataset.minimo || 0);

          const selecionadosGrupo = grupo.querySelectorAll(
            'input[type="checkbox"]:checked'
          );

          if (minimo > 0 && selecionadosGrupo.length < minimo) {
            alert(`Selecione pelo menos ${minimo} opção em ${nomeGrupo}.`);
            return;
          }
        }

        const queijo = "";

        const adicionaisSelecionados = Array.from(
          modalBody.querySelectorAll(
            '.grupo-complemento-dinamico input[type="checkbox"]:checked'
          )
        );

        const adicionais = adicionaisSelecionados.map((item) => {
          return `${item.dataset.grupo}: ${item.value}`;
        });

        const adicionaisPrecos = adicionaisSelecionados.map(a =>
          parseFloat(a.dataset.price)
        );

        const totalPrice = adicionaisPrecos.reduce(
          (total, preco) => total + preco,
          price
        );

        addPedido({
          name,
          category,
          price,
          priceDe,
          pricePor,
          queijo,
          adicionais,
          totalPrice,
          quantidade
        });

        modal.style.display = 'none';
      });
    });
  });

  drinks.forEach(drink => {
    const addButton = drink.querySelector('.add-drink');

    ativarSeletorQuantidade(drink);

    addButton.addEventListener('click', e => {
      e.stopPropagation();

      const quantidade =
        parseInt(drink.querySelector('.qtd-input')?.value) || 1;

      const name = drink.dataset.name;
      const price = parseFloat(drink.dataset.price);
      const priceDe = parseFloat(drink.dataset.priceDe) || price;
      const pricePor = parseFloat(drink.dataset.pricePor) || 0;

      addPedido({
        name,
        category: 'bebida',
        price,
        priceDe,
        pricePor,
        queijo: '',
        adicionais: [],
        totalPrice: price,
        quantidade
      });
    });
  });

  closeModal.onclick = () => {
    modal.style.display = 'none';
    atualizarResumoPedido();
  };


  window.onclick = event => {
    if (event.target === modal) {
      modal.style.display = 'none';
      atualizarResumoPedido();
    }
  };
}
function salvarEndereco() {
  const nomeCliente = document.getElementById('nome-cliente');
  const whatsappCliente = document.getElementById('whatsapp-cliente');
  const cepCliente = document.getElementById('cep-cliente');
  const ruaCliente = document.getElementById('rua-cliente');
  const numeroCliente = document.getElementById('numero-cliente');
  const complementoCliente = document.getElementById('complemento-cliente');
  const bairroCliente = document.getElementById('bairro-cliente');
  const cidadeCliente = document.getElementById('cidade-cliente');

  const frete = calcularFretePorBairro(bairroCliente.value);

  const endereco = {
    nome: nomeCliente.value.trim(),
    whatsapp: whatsappCliente.value.trim(),
    cep: cepCliente.value.trim(),
    rua: ruaCliente.value.trim(),
    numero: numeroCliente.value.trim(),
    complemento: complementoCliente.value.trim(),
    bairro: bairroCliente.value.trim(),
    cidade: cidadeCliente.value.trim(),
    frete
  };

  if (
    !endereco.nome ||
    !endereco.whatsapp ||
    !endereco.cep ||
    !endereco.rua ||
    !endereco.numero ||
    !endereco.bairro ||
    !endereco.cidade
  ) {
    alert('Por favor, preencha todos os campos obrigatórios.');
    return;
  }

  localStorage.setItem('endereco', JSON.stringify(endereco));

  atualizarResumoPedido();

  alert(`Endereço adicionado! Frete: R$${formatarPreco(frete)}`);
}

function preencherEndereco(cep) {
  fetch(`https://viacep.com.br/ws/${cep}/json/`)
    .then(response => response.json())
    .then(data => {
      if (data.erro) {
        alert('CEP não encontrado!');
        return;
      }

      document.getElementById('rua-cliente').value = data.logradouro || '';
      document.getElementById('bairro-cliente').value = data.bairro || '';
      document.getElementById('cidade-cliente').value = data.localidade || '';

      const frete = calcularFretePorBairro(data.bairro || '');
      mostrarFreteEndereco(frete);
    })
    .catch(error => {
      console.error('Erro ao buscar CEP:', error);
      alert('Erro ao buscar o CEP. Tente novamente.');
    });
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
    adicionais: pedidoNovo.adicionais?.length
      ? pedidoNovo.adicionais.join('\n')
      : '',
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

  localStorage.setItem('pedidos', JSON.stringify(pedidos));

  atualizarResumoPedido();
  mostrarMensagemAdicionado();
}

function mostrarMensagemAdicionado() {
  const mensagem = document.getElementById('mensagem-adicionado');

  if (!mensagem) return;

  mensagem.classList.add('show');

  setTimeout(() => {
    mensagem.classList.remove('show');
  }, 1800);
}

function atualizarResumoPedido() {
  const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
  const endereco = JSON.parse(localStorage.getItem('endereco'));
  const secaoEndereco = document.querySelector('.address-section');

  if (secaoEndereco) {
    secaoEndereco.style.display = endereco ? 'none' : 'block';
  }
  const pedidoItens = document.getElementById('pedido-itens');

  pedidoItens.innerHTML = '';

  let subtotal = 0;
  let totalItens = 0;
  const frete =
    tipoEntregaSelecionado === "retirada"
      ? 0
      : endereco?.frete
        ? Number(endereco.frete)
        : 0;

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

      const item = document.createElement('div');
      item.className = `pedido-item ${classe}`;

      item.innerHTML = `
  <div class="carrinho-item-linha">
    <div class="carrinho-item-info">
      <h4>${pedido.name}</h4>

      ${pedido.adicionais
          ? pedido.adicionais
            .split('\n')
            .map((linha) => `<p>${linha}</p>`)
            .join('')
          : ''}
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

  if (endereco && tipoEntregaSelecionado !== "retirada") {
    const enderecoDiv = document.createElement('div');
    enderecoDiv.className = 'endereco-item';

    enderecoDiv.innerHTML = `
    <h4>Dados de entrega</h4>
    <p>Nome: ${endereco.nome || ""}</p>
    <p>WhatsApp: ${endereco.whatsapp || ""}</p>
    <p>${endereco.rua}, ${endereco.numero}</p>
    ${endereco.complemento ? `<p>${endereco.complemento}</p>` : ""}
    <p>${endereco.bairro} - ${endereco.cidade}</p>
    <p>CEP: ${endereco.cep}</p>
    <p>Frete: R$${formatarPreco(frete)}</p>
    <button class="excluir-endereco">Alterar endereço</button>
  `;

    pedidoItens.appendChild(enderecoDiv);

    enderecoDiv
      .querySelector('.excluir-endereco')
      .addEventListener('click', () => {
        localStorage.removeItem('endereco');

        const mensagemCupom = document.getElementById("cupom-mensagem");

        if (
          cupomAplicado &&
          String(cupomAplicado["Aplica Em"] || cupomAplicado["Aplica em"] || "")
            .trim()
            .toLowerCase() === "frete" &&
          mensagemCupom
        ) {
          mensagemCupom.textContent =
            "Cupom mantido, mas o desconto será aplicado somente após adicionar um endereço com frete.";
          mensagemCupom.style.color = "#9b1d1d";
        }

        atualizarResumoPedido();
      });
  }

  if (cupomAplicado) {
    const aplicaEmCupom = String(
      cupomAplicado["Aplica Em"] || cupomAplicado["Aplica em"] || ""
    )
      .trim()
      .toLowerCase();

    const cupomDiv = document.createElement("div");
    cupomDiv.className = "cupom-aplicado-resumo";

    let mensagemCupomResumo = "";

    if (descontoCupom > 0) {
      mensagemCupomResumo = `
    <p>Cupom válido para este pedido.</p>
  `;
    } else if (aplicaEmCupom === "frete" && !endereco) {
      mensagemCupomResumo = `
      <p>O desconto será calculado assim que você adicionar um endereço com frete.</p>
    `;
    } else {
      mensagemCupomResumo = `
      <p>Este cupom está aplicado, mas ainda não gerou desconto para este pedido.</p>
    `;
    }

    cupomDiv.innerHTML = `
  <h4>Cupom aplicado</h4>

  <p>
    <strong>Cupom:</strong>
    ${cupomAplicado.Cupom}
  </p>

  ${descontoCupom > 0
        ? `
      <p>
        <strong>Desconto:</strong>
        -R$${formatarPreco(descontoCupom)}
      </p>
    `
        : ""
      }

  ${mensagemCupomResumo}

  <button class="remover-cupom" type="button">
    Remover cupom
  </button>
`;

    pedidoItens.appendChild(cupomDiv);
  }

  document.getElementById("total-pedido").textContent =
    `R$${formatarPreco(totalFinal)}`;

  atualizarCarrinhoFlutuante(totalItens, totalFinal);

  const inputCupom = document.getElementById("cupom-input");
  const mensagemCupom = document.getElementById("cupom-mensagem");

  if (cupomAplicado && inputCupom && mensagemCupom) {
    inputCupom.value = cupomAplicado.Cupom;
    mensagemCupom.textContent = `Cupom ${cupomAplicado.Cupom} aplicado.`;
    mensagemCupom.style.color = "#1f7a38";
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

  document.querySelectorAll('.excluir-item').forEach(button => {
    button.addEventListener('click', () => {
      excluirPedido(button.dataset.index);
    });
  });
  const botaoRemoverCupom = document.querySelector(".remover-cupom");

  if (botaoRemoverCupom) {
    botaoRemoverCupom.addEventListener("click", removerCupom);
  }
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

function atualizarCarrinhoFlutuante(qtd, total = 0) {
  const carrinho = document.getElementById('carrinho-flutuante');
  const carrinhoQtd = document.getElementById('carrinho-qtd');
  const carrinhoTotal = document.querySelector('.carrinho-total');

  if (!carrinho || !carrinhoQtd || !carrinhoTotal) return;

  carrinhoQtd.textContent = `${qtd} item${qtd !== 1 ? 's' : ''}`;
  const headerQtd =
    document.getElementById('carrinho-header-qtd');

  if (headerQtd) {
    headerQtd.textContent =
      `${qtd} item${qtd !== 1 ? 's' : ''}`;
  }

  carrinhoTotal.innerHTML = `R$${formatarPreco(total)} <span class="carrinho-seta">›</span>`;

  carrinho.style.display = qtd > 0 ? 'flex' : 'none';

  if (qtd > 0) {
    carrinho.classList.remove('pulse-carrinho');

    void carrinho.offsetWidth;

    carrinho.classList.add('pulse-carrinho');
  }
}

function excluirPedido(index) {
  const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];

  pedidos.splice(index, 1);

  localStorage.setItem('pedidos', JSON.stringify(pedidos));
  atualizarResumoPedido();
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
  const status = document.getElementById("status-horario");
  const botaoConfirmar = document.getElementById("confirmar-pedido");

  if (!status) return;

  const agora = new Date();
  const diaAtual = obterNomeDiaAtual();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

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
      return horarioParaMinutos(a.abertura) - horarioParaMinutos(b.abertura);
    });

  const horarioAtual = horariosHoje.find((item) => {
    const inicio = horarioParaMinutos(item.abertura);
    const fim = horarioParaMinutos(item.fechamento);

    return minutosAgora >= inicio && minutosAgora <= fim;
  });

  lojaAbertaAgora = !!horarioAtual;

  let htmlHorarios = `<strong>${diaAtual} (hoje)</strong><br>`;

  if (horariosHoje.length > 0) {
    htmlHorarios += horariosHoje
      .map((item) => `${item.abertura} - ${item.fechamento}`)
      .join("<br>");
  } else {
    htmlHorarios += "Fechado hoje";
  }

  if (lojaAbertaAgora) {
    status.innerHTML = `${htmlHorarios}<br><span>Aberto agora</span>`;
    status.className = "status-aberto";

    return;
  }

  let textoProximo = "";

  const horariosFuturosHoje = horariosHoje.filter((item) => {
    const inicio = horarioParaMinutos(item.abertura);
    return inicio > minutosAgora;
  });

  const ultimoHorarioHoje = horariosHoje[horariosHoje.length - 1];

  const fimUltimoHorarioHoje = ultimoHorarioHoje
    ? horarioParaMinutos(ultimoHorarioHoje.fechamento)
    : null;

  if (
    ultimoHorarioHoje &&
    fimUltimoHorarioHoje !== null &&
    minutosAgora > fimUltimoHorarioHoje &&
    horariosFuturosHoje.length > 0
  ) {
    textoProximo = `<br>Próxima abertura: ${horariosFuturosHoje[0].abertura}`;
  }

  status.innerHTML = `${htmlHorarios}<br><span>Fechado</span>${textoProximo}`;
  status.className = "status-fechado";

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
    alert("Pedido não encontrado.");
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
          ? String(item.adicionais)
            .split('\n')
            .map((linha) => `<p>${linha}</p>`)
            .join('')
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
    alert("Link de pagamento não encontrado.");
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

  return String(adicionais)
    .replace(/^Adicional:\s*/i, "")
    .split(", ")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join("\n");
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
    botaoFinalizar.textContent = "Gerando pedido...";
  }

  await carregarHorariosLoja();

  if (!lojaAbertaAgora) {
    alert("Estamos fora do horário de funcionamento. Confira os horários disponíveis antes de finalizar o pedido.");
    liberarFinalizacao();
    return;
  }

  const pedidos = JSON.parse(localStorage.getItem("pedidos")) || [];
  const endereco = JSON.parse(localStorage.getItem("endereco"));

  const retiradaSelecionada = tipoEntregaSelecionado === "retirada";
  const dadosRetirada = retiradaSelecionada ? obterDadosRetiradaCliente() : null;

  if (pedidos.length === 0) {
    alert("Por favor, adicione ao menos um item ao pedido.");
    liberarFinalizacao();
    return;
  }

  if (retiradaSelecionada) {
    if (!dadosRetirada.nome || !dadosRetirada.whatsapp) {
      alert("Informe nome e WhatsApp para retirada.");
      liberarFinalizacao();
      return;
    }
  } else {
    if (
      !endereco ||
      !endereco.nome ||
      !endereco.whatsapp ||
      !endereco.rua ||
      !endereco.numero ||
      !endereco.bairro ||
      !endereco.cidade ||
      !endereco.frete
    ) {
      alert("Por favor, adicione um endereço válido com frete calculado antes de confirmar o pedido.");
      liberarFinalizacao();
      return;
    }
  }

  if (botaoFinalizar) {
    botaoFinalizar.textContent = "Gerando pagamento...";
  }

  const frete = retiradaSelecionada ? 0 : Number(endereco.frete);
  let subtotal = 0;

  pedidos.forEach((pedido) => {
    subtotal += parseFloat(pedido.totalPrice) * (parseInt(pedido.quantidade) || 1);
  });

  const pedidoMinimo = converterNumero(perfilLoja.PedidoMinimo);

  if (pedidoMinimo > 0 && subtotal < pedidoMinimo) {
    alert(`Pedido mínimo de R$${formatarPreco(pedidoMinimo)} em produtos.`);
    liberarFinalizacao();
    return;
  }

  const descontoCupom = calcularDescontoCupom(subtotal, frete);
  const totalFinal = Math.max(0, subtotal + frete - descontoCupom);
  const nomeLojaPedido = perfilLoja.NomeLoja || "Loja";

  const enderecoPedido = retiradaSelecionada
    ? {
      nome: dadosRetirada.nome,
      whatsapp: dadosRetirada.whatsapp,
      tipoEntrega: "retirada",
      frete: 0,
      enderecoRetirada: dadosRetirada.enderecoRetirada,
    }
    : {
      ...endereco,
      tipoEntrega: "entrega",
    };

  let mensagem = `Pedido realizado - ${nomeLojaPedido}!\n\n`;

  pedidos.forEach((pedido) => {
    const quantidade = parseInt(pedido.quantidade) || 1;
    const valorTotalItem = parseFloat(pedido.totalPrice) * quantidade;

    mensagem += `${quantidade}x ${pedido.name} - R$${formatarPreco(valorTotalItem)}\n`;

    if (pedido.category === "salgado" && pedido.queijo) {
      mensagem += `Queijo: ${pedido.queijo}\n`;
    }

    if (pedido.adicionais) {
      mensagem += `${formatarComplementosParaPedido(pedido.adicionais)}\n`;
    }

    mensagem += "\n";
  });

  mensagem += `Subtotal: R$${formatarPreco(subtotal)}\n`;

  if (!retiradaSelecionada) {
    mensagem += `Frete: R$${formatarPreco(frete)}\n`;
  } else {
    mensagem += `Tipo: RETIRADA NO LOCAL\n`;
  }

  if (cupomAplicado && descontoCupom > 0) {
    mensagem += `Cupom: ${cupomAplicado.Cupom}\n`;
    mensagem += `Desconto: -R$${formatarPreco(descontoCupom)}\n`;
  }

  mensagem += `Total: R$${formatarPreco(totalFinal)}\n\n`;

  if (retiradaSelecionada) {
    mensagem += `RETIRADA NO LOCAL\n`;
    mensagem += `${dadosRetirada.nome}\n`;
    mensagem += `WhatsApp: ${dadosRetirada.whatsapp}\n\n`;
    mensagem += `Endereço de retirada:\n${dadosRetirada.enderecoRetirada}`;
  } else {
    mensagem += `Endereço de entrega:\n`;
    mensagem += `${endereco.nome}\n`;
    mensagem += `${endereco.rua}, ${endereco.numero}${endereco.complemento ? " - " + endereco.complemento : ""}\n`;
    mensagem += `${endereco.bairro} - ${endereco.cidade}\n`;
    mensagem += `CEP: ${endereco.cep}`;
  }

  let itensTexto = "";

  pedidos.forEach((pedido) => {
    const quantidade = parseInt(pedido.quantidade) || 1;
    const valorTotalItem = parseFloat(pedido.totalPrice) * quantidade;

    itensTexto += `${quantidade}x ${pedido.name} - R$${formatarPreco(valorTotalItem)}\n`;

    if (pedido.category === "salgado" && pedido.queijo) {
      itensTexto += `Queijo: ${pedido.queijo}\n`;
    }

    if (pedido.adicionais) {
      itensTexto += `${formatarComplementosParaPedido(pedido.adicionais)}\n`;
    }

    itensTexto += "\n";
  });

  const enderecoTexto = retiradaSelecionada
    ? `RETIRADA NO LOCAL\n${dadosRetirada.nome}\nWhatsApp: ${dadosRetirada.whatsapp}\n\nEndereço de retirada:\n${dadosRetirada.enderecoRetirada}`
    : `${endereco.nome}\n` +
    `${endereco.rua}, ${endereco.numero}${endereco.complemento ? " - " + endereco.complemento : ""}\n` +
    `${endereco.bairro} - ${endereco.cidade}\n` +
    `CEP: ${endereco.cep}`;

  try {
    if (!API_URL) {
      alert("Não foi possível conectar com a API de pagamento. Tente novamente.");
      liberarFinalizacao();
      return;
    }

    if (botaoFinalizar) {
      botaoFinalizar.textContent = "Verificando estoque...";
    }

    const respostaEstoque = await fetch(
      `${URL_CONTROLE}?acao=validarEstoquePedido` +
      `&itens=${encodeURIComponent(JSON.stringify(pedidos))}` +
      `&t=${Date.now()}`
    );

    const dadosEstoque = await respostaEstoque.json();

    if (!dadosEstoque.sucesso) {
      const faltantes = dadosEstoque.faltantes || [];

      const mensagemErro = faltantes.length
        ? faltantes
          .map((item) => {
            return `${item.insumo}: necessário ${item.necessario}, disponível ${item.disponivel}`;
          })
          .join("\n")
        : dadosEstoque.erro || "Estoque insuficiente.";

      alert(`Estoque insuficiente para finalizar o pedido:\n\n${mensagemErro}`);
      liberarFinalizacao();
      return;
    }

    if (botaoFinalizar) {
      botaoFinalizar.textContent = "Gerando pagamento...";
    }

    const response = await fetch(`${API_URL}/criar-pagamento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titulo: `Pedido ${nomeLojaPedido}`,
        quantidade: 1,
        valor: totalFinal,
      }),
    });

    const data = await response.json();

    if (data.link && data.pedidoId) {
      if (botaoFinalizar) {
        botaoFinalizar.textContent = "Reservando estoque...";
      }

      const respostaReserva = await fetch(
        `${URL_CONTROLE}?acao=reservarEstoquePedido` +
        `&pedidoId=${encodeURIComponent(data.pedidoId)}` +
        `&itens=${encodeURIComponent(JSON.stringify(pedidos))}` +
        `&t=${Date.now()}`
      );

      const dadosReserva = await respostaReserva.json();

      if (!dadosReserva.sucesso) {
        const faltantes = dadosReserva.faltantes || [];

        const mensagemErro = faltantes.length
          ? faltantes
            .map((item) => {
              return `${item.insumo}: necessário ${item.necessario}, disponível ${item.disponivel}`;
            })
            .join("\n")
          : dadosReserva.erro || "Estoque insuficiente.";

        alert(`Não foi possível reservar estoque:\n\n${mensagemErro}`);
        liberarFinalizacao();
        return;
      }
      const pedidoEmAndamento = {
        pedidoId: data.pedidoId,
        numeroPedido: "",
        linkPagamento: data.link,
        criadoEm: Date.now(),
        expiraEm: Date.now() + TEMPO_PEDIDO_AGUARDANDO,

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
        cupom: cupomAplicado ? cupomAplicado.Cupom : "",
        mensagem,
      };

      pedidoEmAndamento.itensTexto = itensTexto;
      pedidoEmAndamento.enderecoTexto = enderecoTexto;

      salvarPedidoEmAndamento(pedidoEmAndamento);

      localStorage.removeItem("pedidos");
      localStorage.removeItem("cupomAplicado");
      cupomAplicado = null;
      atualizarResumoPedido();

      localStorage.setItem("mensagemPedidoPendente", mensagem);
      localStorage.setItem("pedidoIdPendente", data.pedidoId);
      localStorage.setItem("linkPagamentoPendente", data.link);

      window.open(data.link, "_blank");

      if (botaoFinalizar) {
        botaoFinalizar.textContent = "Pedido enviado";
      }

      setTimeout(() => {
        liberarFinalizacao("Finalizar Pedido");
      }, 3000);

      fecharCarrinhoDrawer();
      abrirAcompanhamentoPedido(data.pedidoId);
    } else {
      liberarFinalizacao();
      alert("Erro ao gerar pagamento.");
    }
  } catch (error) {
    console.error(error);
    liberarFinalizacao();
    alert("Erro ao conectar com o pagamento.");
  }
}
