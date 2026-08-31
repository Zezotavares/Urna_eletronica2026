// CONFIGURAÇÕES DO SUPABASE
const SUPABASE_URL = "https://jnsjlsthgldjpboltgkr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuc2psc3RoZ2xkanBib2x0Z2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzE4MjEsImV4cCI6MjEwMzY0NzgyMX0.RmfR6W81nfbHEzmw6D2kxzp6gTc7TnKqRDHUeqWrw7A";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SEQUÊNCIA OFICIAL DOS 6 CARGOS
const etapas = [
  { cargo: 'Deputado Federal', tabela: 'candidatos_deputado_federal', digitos: 4 },
  { cargo: 'Deputado Estadual', tabela: 'candidatos_deputado_estadual', digitos: 5 },
  { cargo: 'Senador (1ª Vaga)', tabela: 'candidatos_senador_1', digitos: 3 },
  { cargo: 'Senador (2ª Vaga)', tabela: 'candidatos_senador_2', digitos: 3 },
  { cargo: 'Governador', tabela: 'candidatos_governador', digitos: 2 },
  { cargo: 'Presidente', tabela: 'candidatos_presidente', digitos: 2 }
];

let etapaAtual = 0;
let numeroDigitado = '';
let votoEmBranco = false;
let eleitorID = '';
let votosParaBanco = [];
let votosParaCanhoto = [];
let candidatoAtual = null;
let buscandoCandidato = false;
let primeiroSenadorVotado = null;
let listaColinhaCache = {};
let autenticacaoJaProcessada = false;

// Chave da trava local no navegador
const CHAVE_STORAGE_TRAVA = 'urna_popular_2026_participacao';

// Contexto de áudio
let audioCtx = null;
function obterAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Higienização de caracteres corrompidos por encoding
function limparTextoCorrompido(texto) {
  if (!texto) return '';

  let t = String(texto);

  const substituicoes = [
    { busca: /MAR.AL/gi, troca: 'MARÇAL' },
    { busca: /MISSO/gi, troca: 'MISSÃO' },
    { busca: /FEDERA..O/gi, troca: 'FEDERAÇÃO' },
    { busca: /FEDERA.O/gi, troca: 'FEDERAÇÃO' },
    { busca: /UNIO/gi, troca: 'UNIÃO' },
    { busca: /TCH.-TCH./gi, troca: 'TCHÁ-TCHÁ' },
    { busca: /VETERIN.RIO/gi, troca: 'VETERINÁRIO' },
    { busca: /CLUDIO/gi, troca: 'CLÁUDIO' },
    { busca: /SRGIO/gi, troca: 'SÉRGIO' },
    { busca: /JO.O/gi, troca: 'JOÃO' },
    { busca: /FBIO/gi, troca: 'FÁBIO' },
    { busca: /MRCIA/gi, troca: 'MÁRCIA' },
    { busca: /MRCIO/gi, troca: 'MÁRCIO' },
    { busca: /VALD.R/gi, troca: 'VALDIR' },
    { busca: /GA.CHO/gi, troca: 'GAÚCHO' },
    { busca: /JOS./gi, troca: 'JOSÉ' },
    { busca: /C.TIA/gi, troca: 'CÁTIA' },
    { busca: /ALC.UDIO/gi, troca: 'ALCLÁUDIO' }
  ];

  substituicoes.forEach(item => {
    t = t.replace(item.busca, item.troca);
  });

  t = t.replace(/\uFFFD/g, '').replace(/\?/g, '');

  return t.trim();
}

// Sons da urna eletrônica
function tocarSomTecla() {
  try {
    const ctx = obterAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

function tocarSomIntermediario() {
  try {
    const ctx = obterAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function tocarSomFim() {
  try {
    const ctx = obterAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(950, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.35);
  } catch (e) {}
}

// ----------------------------------------------------
// AUTENTICAÇÃO COM O GOOGLE
// ----------------------------------------------------
async function loginComGoogle() {
  const msgModal = document.getElementById('modal-msg');
  if (msgModal) msgModal.innerText = "Conectando com o Google...";

  try {
    const { data, error } = await _supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });

    if (error) {
      if (msgModal) msgModal.innerText = "Erro ao autenticar: " + error.message;
    }
  } catch (err) {
    if (msgModal) msgModal.innerText = "Falha na conexão com o Google.";
  }
}

// VALIDAÇÃO CENTRAL DA CONTA GOOGLE (1 VOTO POR E-MAIL)
async function validarEIniciarCabine(identificadorUnico) {
  if (autenticacaoJaProcessada && eleitorID) return;
  
  obterAudioContext();
  const msgModal = document.getElementById('modal-msg');

  if (localStorage.getItem(CHAVE_STORAGE_TRAVA)) {
    if (msgModal) msgModal.innerText = "ATENÇÃO: Este dispositivo já registrou um voto nesta pesquisa!";
    return;
  }

  if (msgModal) msgModal.innerText = "Verificando participação anterior...";

  const { data, error } = await _supabase
    .from('eleitores_votantes')
    .select('id')
    .eq('eleitor_id', identificadorUnico);

  if (error) {
    if (msgModal) msgModal.innerText = "Erro ao verificar dados: " + error.message;
    return;
  }

  if (data && data.length > 0) {
    if (msgModal) msgModal.innerText = "ATENÇÃO: Esta conta Google já registrou o seu voto!";
    return;
  }

  autenticacaoJaProcessada = true;
  eleitorID = identificadorUnico;
  
  // Fecha o modal e entra direto na cabine de votação
  const modalID = document.getElementById('modal-id');
  if (modalID) {
    modalID.style.display = 'none';
  }

  // Limpa os parâmetros de autenticação da URL sem recarregar
  if (window.location.hash) {
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }

  atualizarTela();
}

// OUVINTE EM TEMPO REAL DE AUTENTICAÇÃO DO SUPABASE
_supabase.auth.onAuthStateChange(async (event, session) => {
  if (session && session.user && session.user.email) {
    const emailIdentificador = 'google_' + session.user.email.toLowerCase().trim();
    await validarEIniciarCabine(emailIdentificador);
  }
});

// CHECAGEM DE SESSÃO ATIVA AO CARREGAR
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session && session.user && session.user.email) {
    const emailIdentificador = 'google_' + session.user.email.toLowerCase().trim();
    await validarEIniciarCabine(emailIdentificador);
  }
});

// Busca candidato no Supabase
async function buscarCandidatoNoBanco(numero) {
  const etapa = etapas[etapaAtual];
  buscandoCandidato = true;

  const { data, error } = await _supabase
    .from(etapa.tabela)
    .select('numero, nome, partido, foto_url')
    .eq('numero', String(numero).trim())
    .maybeSingle();

  buscandoCandidato = false;

  if (!error && data) {
    candidatoAtual = {
      numero: String(data.numero).trim(),
      nome: limparTextoCorrompido(data.nome),
      partido: limparTextoCorrompido(data.partido),
      foto_url: data.foto_url
    };
  } else {
    candidatoAtual = null;
  }

  atualizarTela();
}

// Atualização da tela LCD
function atualizarTela() {
  const etapa = etapas[etapaAtual];
  const containerTela = document.getElementById('tela');

  let digitosHTML = '';
  for (let i = 0; i < etapa.digitos; i++) {
    const caractere = numeroDigitado[i] || '';
    const classePisca = (i === numeroDigitado.length && !votoEmBranco) ? 'pisca' : '';
    digitosHTML += `<div class="digito ${classePisca}">${caractere}</div>`;
  }

  let informacaoHTML = '';
  let fotoHTML = '';

  if (votoEmBranco) {
    informacaoHTML = `<div style="font-size:22px; font-weight:bold; margin-top:20px;">VOTO EM BRANCO</div>`;
  } else if (numeroDigitado.length === etapa.digitos) {
    if (buscandoCandidato) {
      informacaoHTML = `<div class="info-candidato">Buscando candidato...</div>`;
    } else if (etapaAtual === 3 && numeroDigitado === primeiroSenadorVotado) {
      informacaoHTML = `<div class="info-candidato" style="color: #c00;"><b>VOTO NULO (Candidato já votado para a 1ª Vaga do Senado)</b></div>`;
    } else if (candidatoAtual) {
      informacaoHTML = `
        <div class="info-candidato">
          Nome: <b>${candidatoAtual.nome}</b><br>
          Partido: <b>${candidatoAtual.partido || 'Sem Coligação'}</b>
        </div>`;
      if (candidatoAtual.foto_url && candidatoAtual.foto_url.trim() !== '') {
        fotoHTML = `<img src="${candidatoAtual.foto_url}" class="foto-candidato" alt="Foto do Candidato">`;
      }
    } else {
      informacaoHTML = `<div class="info-candidato"><b>NÚMERO ERRADO / VOTO NULO</b></div>`;
    }
  }

  containerTela.innerHTML = `
    <div>
      <div class="topo-tela">
        <span>SEU VOTO VAI PARA</span>
      </div>
      <div class="cargo-titulo">${etapa.cargo}</div>
      <div class="numeros-box">${digitosHTML}</div>
      ${informacaoHTML}
      ${fotoHTML}
    </div>
    <div class="rodape-tela">
      Aperte a tecla:<br>
      <b>CONFIRMA</b> para CONFIRMAR este voto<br>
      <b>CORRIGE</b> para REINICIAR este voto
    </div>
  `;
}

function digitar(numero) {
  if (votoEmBranco) return;
  const etapa = etapas[etapaAtual];

  if (numeroDigitado.length < etapa.digitos) {
    numeroDigitado += String(numero);
    tocarSomTecla();

    if (numeroDigitado.length === etapa.digitos) {
      buscarCandidatoNoBanco(numeroDigitado);
    } else {
      candidatoAtual = null;
      atualizarTela();
    }
  }
}

function votarBranco() {
  numeroDigitado = '';
  candidatoAtual = null;
  votoEmBranco = true;
  tocarSomTecla();
  atualizarTela();
}

function corrigir() {
  numeroDigitado = '';
  candidatoAtual = null;
  votoEmBranco = false;
  tocarSomTecla();
  atualizarTela();
}

async function confirmar() {
  const etapa = etapas[etapaAtual];

  if (!votoEmBranco && numeroDigitado.length < etapa.digitos) {
    return;
  }

  let numeroVoto = '';
  let nomeExibicao = '';
  let partidoExibicao = '';

  if (votoEmBranco) {
    numeroVoto = 'BRANCO';
    nomeExibicao = 'VOTO EM BRANCO';
    partidoExibicao = '-';
  } else if (etapaAtual === 3 && numeroDigitado === primeiroSenadorVotado) {
    numeroVoto = 'NULO';
    nomeExibicao = 'VOTO NULO (Repetido)';
    partidoExibicao = '-';
  } else if (candidatoAtual) {
    numeroVoto = numeroDigitado;
    nomeExibicao = candidatoAtual.nome;
    partidoExibicao = candidatoAtual.partido || '-';
  } else {
    numeroVoto = 'NULO';
    nomeExibicao = 'VOTO NULO';
    partidoExibicao = '-';
  }

  if (etapaAtual === 2) {
    primeiroSenadorVotado = numeroVoto;
  }

  const hashVoto = Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).toUpperCase();

  votosParaBanco.push({
    cargo: etapa.cargo,
    numero_candidato: numeroVoto,
    hash_validacao: hashVoto
  });

  votosParaCanhoto.push({
    cargo: etapa.cargo,
    numero: numeroVoto,
    nome: nomeExibicao,
    partido: partidoExibicao,
    hash: hashVoto
  });

  etapaAtual++;

  if (etapaAtual < etapas.length) {
    tocarSomIntermediario();
    numeroDigitado = '';
    candidatoAtual = null;
    votoEmBranco = false;
    atualizarTela();
  } else {
    tocarSomFim();
    document.getElementById('tela').innerHTML = `<div class="tela-fim">GRAVANDO...</div>`;

    const { error: erroPresenca } = await _supabase
      .from('eleitores_votantes')
      .insert([{ eleitor_id: eleitorID }]);

    const { error: erroVoto } = await _supabase
      .from('votos')
      .insert(votosParaBanco);

    if (erroPresenca || erroVoto) {
      console.error("Erro na gravação:", erroPresenca || erroVoto);
      document.getElementById('tela').innerHTML = `<div style="font-size:16px; color:red; padding:15px; text-align:center;"><b>ERRO AO REGISTRAR VOTO:</b><br>${(erroPresenca || erroVoto).message}</div>`;
    } else {
      try {
        localStorage.setItem(CHAVE_STORAGE_TRAVA, 'votou_' + Date.now());
      } catch (e) {}

      // Realiza logout do Google para fechar a sessão com segurança
      try {
        await _supabase.auth.signOut();
      } catch (e) {}

      document.getElementById('tela').innerHTML = `
        <div style="text-align: center; padding-top: 25px;">
          <div class="tela-fim" style="height: auto; margin-bottom: 20px;">FIM</div>
          <button id="btn-baixar-canhoto" onclick="gerarCanhotoPDF()" style="background: #16a34a; color: #ffffff; border: none; padding: 14px 20px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; box-shadow: 0 4px #14532d; transition: all 0.2s; width: 90%; max-width: 320px;">
            📄 BAIXAR COMPROVANTE (PDF)
          </button>
          <div id="status-download-pdf" style="font-size: 12px; color: #475569; margin-top: 10px;"></div>
        </div>
      `;
    }
  }
}

// FUNÇÕES DA COLINHA ELEITORAL (CONSULTA RÁPIDA)
async function abrirColinha() {
  const etapa = etapas[etapaAtual] || etapas[0];
  const modalColinha = document.getElementById('modal-colinha');
  const tituloCargo = document.getElementById('colinha-titulo-cargo');
  const listaContainer = document.getElementById('colinha-lista-candidatos');
  const inputBusca = document.getElementById('input-busca-colinha');

  tituloCargo.innerText = `📋 Candidatos: ${etapa.cargo}`;
  inputBusca.value = '';
  modalColinha.style.display = 'flex';
  listaContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#64748b;">Carregando lista...</div>';

  if (!listaColinhaCache[etapa.cargo]) {
    const { data } = await _supabase
      .from(etapa.tabela)
      .select('numero, nome, partido');

    listaColinhaCache[etapa.cargo] = (data || []).map(c => ({
      numero: String(c.numero).trim(),
      nome: limparTextoCorrompido(c.nome),
      partido: limparTextoCorrompido(c.partido)
    }));
  }

  renderizarItensColinha(listaColinhaCache[etapa.cargo]);
}

function fecharColinha() {
  document.getElementById('modal-colinha').style.display = 'none';
}

function renderizarItensColinha(candidatos) {
  const listaContainer = document.getElementById('colinha-lista-candidatos');
  if (candidatos.length === 0) {
    listaContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#64748b;">Nenhum candidato encontrado.</div>';
    return;
  }

  let html = '';
  candidatos.forEach(c => {
    html += `
      <div class="colinha-item" onclick="selecionarDaColinha('${c.numero}')">
        <div class="colinha-nome-bloco">
          <span class="colinha-nome">${c.nome}</span>
          <span class="colinha-partido">${c.partido || 'Sem Partido'}</span>
        </div>
        <span class="colinha-numero-badge">${c.numero}</span>
      </div>
    `;
  });
  listaContainer.innerHTML = html;
}

function filtrarColinha() {
  const etapa = etapas[etapaAtual] || etapas[0];
  const termo = document.getElementById('input-busca-colinha').value.toLowerCase().trim();
  const todos = listaColinhaCache[etapa.cargo] || [];

  const filtrados = todos.filter(c => 
    c.nome.toLowerCase().includes(termo) ||
    c.numero.toLowerCase().includes(termo) ||
    c.partido.toLowerCase().includes(termo)
  );

  renderizarItensColinha(filtrados);
}

function selecionarDaColinha(numero) {
  fecharColinha();
  numeroDigitado = '';
  candidatoAtual = null;
  votoEmBranco = false;

  for (let i = 0; i < numero.length; i++) {
    digitar(numero[i]);
  }
}

// GERAÇÃO DO COMPROVANTE / CANHOTO EM PDF (COMPATÍVEL COM CELULARES)
function gerarCanhotoPDF() {
  const statusEl = document.getElementById('status-download-pdf');
  if (statusEl) statusEl.innerText = "Gerando comprovante...";

  const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
  if (!jsPDFClass) {
    alert("Erro ao carregar a biblioteca de PDF. Por favor, tire um print screen desta tela.");
    if (statusEl) statusEl.innerText = "";
    return;
  }

  try {
    const doc = new jsPDFClass({
      unit: 'mm',
      format: [80, 155]
    });

    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR');
    const horaFormatada = agora.toLocaleTimeString('pt-BR');
    const codigoAutenticacao = Math.random().toString(36).substring(2, 12).toUpperCase();

    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text('PESQUISA POPULAR INFORMAL', 40, 10, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text('COMPROVANTE DE VOTACAO', 40, 15, { align: 'center' });
    
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('----------------------------------------', 40, 20, { align: 'center' });
    doc.text(`DATA: ${dataFormatada}  HORA: ${horaFormatada}`, 5, 25);
    doc.text(`ELEITOR: CONTA GOOGLE`, 5, 30);
    doc.text(`AUTENTICACAO: ${codigoAutenticacao}`, 5, 35);
    doc.text('----------------------------------------', 40, 40, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text('CANDIDATOS ESCOLHIDOS:', 5, 46);

    let posicaoY = 53;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);

    votosParaCanhoto.forEach(item => {
      doc.setFont('courier', 'bold');
      doc.text(`${item.cargo.toUpperCase()}:`, 5, posicaoY);
      doc.setFont('courier', 'normal');
      doc.text(`No: ${item.numero} - ${item.nome}`, 5, posicaoY + 4);
      if (item.partido && item.partido !== '-') {
        doc.text(`Part: ${item.partido}`, 5, posicaoY + 8);
        posicaoY += 13;
      } else {
        posicaoY += 9;
      }
    });

    doc.text('----------------------------------------', 40, posicaoY, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Este documento e pessoal e comprova', 40, posicaoY + 5, { align: 'center' });
    doc.text('a participacao nesta pesquisa.', 40, posicaoY + 9, { align: 'center' });

    const nomeArquivo = `Comprovante_Pesquisa_${codigoAutenticacao}.pdf`;

    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = nomeArquivo;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      if (statusEl) statusEl.innerText = "Comprovante gerado com sucesso!";
    }, 1500);

  } catch (erro) {
    console.error("Erro ao gerar PDF:", erro);
    alert("Não foi possível salvar o arquivo automaticamente. Recomendamos tirar um print.");
    if (statusEl) statusEl.innerText = "";
  }
}