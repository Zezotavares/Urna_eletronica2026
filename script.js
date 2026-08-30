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

// Higienização de caracteres corrompidos por encoding (UTF-8 / Latin1)
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

// Validação no Livro de Presença (eleitores_votantes)
async function iniciarVotacao() {
  obterAudioContext();
  const inputID = document.getElementById('eleitor-id-input');
  const msgModal = document.getElementById('modal-msg');
  const idLimpo = inputID.value.trim();

  if (!idLimpo) {
    msgModal.innerText = "Por favor, informe seu ID.";
    return;
  }

  msgModal.innerText = "Verificando habilitação do eleitor...";

  const { data, error } = await _supabase
    .from('eleitores_votantes')
    .select('id')
    .eq('eleitor_id', idLimpo);

  if (error) {
    msgModal.innerText = "Erro ao conectar com o banco: " + error.message;
    return;
  }

  if (data && data.length > 0) {
    msgModal.innerText = "ATENÇÃO: Este ID já registrou presença e votou!";
    return;
  }

  eleitorID = idLimpo;
  document.getElementById('modal-id').style.display = 'none';
  atualizarTela();
}

// Busca candidato sob demanda e aplica a limpeza nos dados retornados
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

// Atualização visual da tela LCD
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

  // Dados para o Banco (100% ANÔNIMOS, SEM vínculo com o ID do eleitor)
  votosParaBanco.push({
    cargo: etapa.cargo,
    numero_candidato: numeroVoto,
    hash_validacao: hashVoto
  });

  // Dados para o Comprovante em PDF
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

    // 1. Registra no Livro de Presença
    const { error: erroPresenca } = await _supabase
      .from('eleitores_votantes')
      .insert([{ eleitor_id: eleitorID }]);

    // 2. Registra os votos anonimizados
    const { error: erroVoto } = await _supabase
      .from('votos')
      .insert(votosParaBanco);

    if (erroPresenca || erroVoto) {
      console.error("Erro na gravação:", erroPresenca || erroVoto);
      document.getElementById('tela').innerHTML = `<div style="font-size:16px; color:red; padding:15px; text-align:center;"><b>ERRO AO REGISTRAR VOTO:</b><br>${(erroPresenca || erroVoto).message}</div>`;
    } else {
      document.getElementById('tela').innerHTML = `
        <div style="text-align: center; padding-top: 30px;">
          <div class="tela-fim" style="height: auto; margin-bottom: 20px;">FIM</div>
          <button onclick="gerarCanhotoPDF()" style="background: #16a34a; color: #ffffff; border: none; padding: 12px 20px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; box-shadow: 0 4px #14532d; transition: all 0.2s;">
            📄 BAIXAR COMPROVANTE (CANHOTO PDF)
          </button>
        </div>
      `;
    }
  }
}

// Geração do Comprovante / Canhoto em PDF
function gerarCanhotoPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 150]
  });

  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString('pt-BR');
  const horaFormatada = agora.toLocaleTimeString('pt-BR');
  const codigoAutenticacao = Math.random().toString(36).substring(2, 12).toUpperCase();

  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text('PESQUISA POPULAR INFORMAL', 40, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.text('COMPROVANTE DE VOTACAO', 40, 15, { align: 'center' });
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('----------------------------------------', 40, 20, { align: 'center' });
  doc.text(`DATA: ${dataFormatada}  HORA: ${horaFormatada}`, 5, 25);
  doc.text(`ELEITOR ID: ${eleitorID}`, 5, 30);
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

  doc.save(`Comprovante_Pesquisa_${eleitorID}.pdf`);
}