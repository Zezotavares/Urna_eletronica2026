// CONFIGURAÇÕES DO SUPABASE
const SUPABASE_URL = "https://jnsjlsthgldjpboltgkr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuc2psc3RoZ2xkanBib2x0Z2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzE4MjEsImV4cCI6MjEwMzY0NzgyMX0.RmfR6W81nfbHEzmw6D2kxzp6gTc7TnKqRDHUeqWrw7A";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tabelasCargos = {
  'Presidente': 'candidatos_presidente',
  'Governador': 'candidatos_governador',
  'Senador (1ª Vaga)': 'candidatos_senador_1',
  'Senador (2ª Vaga)': 'candidatos_senador_2',
  'Deputado Federal': 'candidatos_deputado_federal',
  'Deputado Estadual': 'candidatos_deputado_estadual'
};

let cargoSelecionado = 'Presidente';
let votosTotaisCache = [];
let candidatosCache = {};
let listaConsolidadaAtual = [];

// Função para corrigir caracteres corrompidos por encoding
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

// Inicialização da Apuração
async function iniciarApuracao() {
  await carregarApuracao();
  setInterval(carregarApuracao, 15000);
}

// Carrega os dados do Supabase
async function carregarApuracao() {
  try {
    const { count: totalVotantes, error: erroVotantes } = await _supabase
      .from('eleitores_votantes')
      .select('*', { count: 'exact', head: true });

    if (!erroVotantes && totalVotantes !== null) {
      document.getElementById('total-votantes').innerText = totalVotantes;
    }

    const { data: votos, error: erroVotos } = await _supabase
      .from('votos')
      .select('cargo, numero_candidato');

    if (!erroVotos && votos) {
      votosTotaisCache = votos;
    }

    const agora = new Date();
    document.getElementById('hora-atualizacao').innerText = agora.toLocaleTimeString('pt-BR');

    await renderizarCargoAtual();
  } catch (e) {
    console.error("Erro ao carregar apuração:", e);
  }
}

// Alterna o cargo pelo dropdown
function mudarCargoViaSelect() {
  cargoSelecionado = document.getElementById('select-cargo').value;
  renderizarCargoAtual();
}

// Processa e exibe os candidatos do cargo atual
async function renderizarCargoAtual() {
  const container = document.getElementById('lista-candidatos-apuracao');
  const tabelaNome = tabelasCargos[cargoSelecionado];

  if (!candidatosCache[cargoSelecionado]) {
    const { data: candidatos } = await _supabase
      .from(tabelaNome)
      .select('numero, nome, partido');
    
    candidatosCache[cargoSelecionado] = (candidatos || []).map(c => ({
      numero: String(c.numero).trim(),
      nome: limparTextoCorrompido(c.nome),
      partido: limparTextoCorrompido(c.partido)
    }));
  }

  const candidatosDoCargo = candidatosCache[cargoSelecionado];

  const votosDoCargo = votosTotaisCache.filter(v => v.cargo === cargoSelecionado);
  const totalVotos = votosDoCargo.length;

  document.getElementById('total-votos-cargo').innerText = totalVotos;

  popularSelectPartidos(candidatosDoCargo);

  const contagem = {};
  votosDoCargo.forEach(v => {
    const num = v.numero_candidato;
    contagem[num] = (contagem[num] || 0) + 1;
  });

  const resultado = [];

  candidatosDoCargo.forEach(c => {
    const qtd = contagem[c.numero] || 0;
    const pct = totalVotos > 0 ? ((qtd / totalVotos) * 100).toFixed(2) : "0.00";
    resultado.push({
      numero: c.numero,
      nome: c.nome,
      partido: c.partido || 'Sem Coligação',
      votos: qtd,
      porcentagem: pct,
      tipo: 'candidato'
    });
  });

  if (contagem['BRANCO'] || totalVotos > 0) {
    const qtd = contagem['BRANCO'] || 0;
    const pct = totalVotos > 0 ? ((qtd / totalVotos) * 100).toFixed(2) : "0.00";
    resultado.push({
      numero: '--',
      nome: 'VOTO EM BRANCO',
      partido: 'Opção do Eleitor',
      votos: qtd,
      porcentagem: pct,
      tipo: 'especial'
    });
  }

  if (contagem['NULO'] || totalVotos > 0) {
    const qtd = contagem['NULO'] || 0;
    const pct = totalVotos > 0 ? ((qtd / totalVotos) * 100).toFixed(2) : "0.00";
    resultado.push({
      numero: '--',
      nome: 'VOTO NULO',
      partido: 'Opção do Eleitor',
      votos: qtd,
      porcentagem: pct,
      tipo: 'especial'
    });
  }

  resultado.sort((a, b) => b.votos - a.votos);

  listaConsolidadaAtual = resultado;
  filtrarResultados();
}

function popularSelectPartidos(candidatos) {
  const selectPartido = document.getElementById('select-partido');
  const valorSelecionado = selectPartido.value;

  const partidosUnicos = Array.from(new Set(candidatos.map(c => c.partido).filter(Boolean))).sort();

  let optionsHTML = `<option value="TODOS">Todos os Partidos / Federações</option>`;
  partidosUnicos.forEach(p => {
    optionsHTML += `<option value="${p}">${p}</option>`;
  });

  selectPartido.innerHTML = optionsHTML;
  if (partidosUnicos.includes(valorSelecionado)) {
    selectPartido.value = valorSelecionado;
  }
}

function filtrarResultados() {
  const container = document.getElementById('lista-candidatos-apuracao');
  const termoBusca = document.getElementById('input-busca').value.toLowerCase().trim();
  const partidoFiltro = document.getElementById('select-partido').value;

  let filtrados = listaConsolidadaAtual.filter(item => {
    const atendePartido = (partidoFiltro === 'TODOS') || (item.partido === partidoFiltro);
    const atendeTexto = (
      item.nome.toLowerCase().includes(termoBusca) ||
      item.numero.toLowerCase().includes(termoBusca) ||
      item.partido.toLowerCase().includes(termoBusca)
    );
    return atendePartido && atendeTexto;
  });

  if (filtrados.length === 0) {
    container.innerHTML = `<div class="carregando">Nenhum resultado correspondente aos filtros aplicados.</div>`;
    return;
  }

  let html = '';
  filtrados.forEach((item, index) => {
    const classeLider = (index === 0 && item.votos > 0 && item.tipo === 'candidato') ? 'lider-votos' : '';
    const tagHTML = item.tipo === 'candidato' 
      ? `<span class="tag-status-pesquisa">Candidatura Registrada</span>` 
      : `<span class="tag-especial">${item.nome}</span>`;

    html += `
      <div class="item-candidato-card ${classeLider}">
        <div class="linha-informacoes-candidato">
          <div class="dados-texto">
            <span class="nome-candidato">${item.nome}</span>
            <span class="divisor-ponto">•</span>
            <span class="partido-tag">${item.partido}</span>
            ${tagHTML}
          </div>
          <div class="bloco-estatistica-voto">
            <span class="numero-candidato-box">${item.numero}</span>
            <div class="dados-votos-porcentagem">
              <div class="porcentagem-numerica">${item.porcentagem}%</div>
              <div class="contagem-votos-subtexto">${item.votos} voto(s)</div>
            </div>
          </div>
        </div>
        <div class="barra-container-progresso">
          <div class="barra-indicador-azul" style="width: ${item.porcentagem}%;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// FUNÇÃO DE SOLICITAÇÃO DA ZERÉSIMA E RESET DA URNA
async function solicitarZeresima() {
  const senha = prompt("ATENÇÃO: Isso irá zerar TODOS os votos registrados e a lista de eleitores votantes!\n\nDigite a senha mestra administrativa para confirmar:");

  if (!senha) return;

  const { data, error } = await _supabase.rpc('emitir_zeresima_reset', { senha_admin: senha });

  if (error || !data || !data.sucesso) {
    alert("ERRO: " + (data ? data.mensagem : error.message));
    return;
  }

  // Gera o PDF da Zerésima
  await gerarRelatorioZeresimaPDF();

  // Recarrega os dados da tela
  await carregarApuracao();
  alert("Zerésima emitida e banco de dados reinicializado com sucesso!");
}

// GERAÇÃO DO PDF DA ZERÉSIMA
async function gerarRelatorioZeresimaPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });

  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString('pt-BR');
  const horaFormatada = agora.toLocaleTimeString('pt-BR');
  const hashAuditoria = Math.random().toString(36).substring(2, 12).toUpperCase() + Date.now().toString(36).toUpperCase();

  let y = 15;

  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text('PESQUISA POPULAR INFORMAL 2026', 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  doc.text('RELATORIO DE ZERESIMA DA URNA', 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('courier', 'normal');
  doc.text('ATESTADO DE INEXISTENCIA DE VOTOS GRAVADOS', 105, y, { align: 'center' });
  y += 5;
  doc.text('---------------------------------------------------------------------------------', 105, y, { align: 'center' });
  y += 6;

  doc.text(`DATA DE EMISSAO : ${dataFormatada}  -  HORA: ${horaFormatada}`, 14, y);
  y += 5;
  doc.text(`CODIGO DE AUDITORIA : ${hashAuditoria}`, 14, y);
  y += 5;
  doc.text(`STATUS DA URNA      : 0 ELEITORES VOTANTES / 0 VOTOS COMPUTADOS`, 14, y);
  y += 5;
  doc.text('---------------------------------------------------------------------------------', 105, y, { align: 'center' });
  y += 8;

  // Itera por todos os 6 cargos listando candidatos com 0 votos
  for (const [cargo, tabela] of Object.entries(tabelasCargos)) {
    if (y > 260) {
      doc.addPage();
      y = 15;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(`CARGO: ${cargo.toUpperCase()}`, 14, y);
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);

    // Carrega candidatos do cargo
    if (!candidatosCache[cargo]) {
      const { data } = await _supabase.from(tabela).select('numero, nome, partido');
      candidatosCache[cargo] = (data || []).map(c => ({
        numero: String(c.numero).trim(),
        nome: limparTextoCorrompido(c.nome),
        partido: limparTextoCorrompido(c.partido)
      }));
    }

    const lista = candidatosCache[cargo];

    lista.forEach(c => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      const linha = `${c.numero.padEnd(6, ' ')} ${c.nome.padEnd(35, ' ').substring(0, 35)} ${(c.partido || '-').padEnd(20, ' ').substring(0, 20)} 0 VOTO(S) [0.00%]`;
      doc.text(linha, 14, y);
      y += 4.2;
    });

    // Brancos e Nulos
    doc.text(`BRANCO VOTO EM BRANCO                     -                    0 VOTO(S) [0.00%]`, 14, y);
    y += 4.2;
    doc.text(`NULO   VOTO NULO                          -                    0 VOTO(S) [0.00%]`, 14, y);
    y += 6;
  }

  y += 4;
  if (y > 265) {
    doc.addPage();
    y = 20;
  }

  doc.text('---------------------------------------------------------------------------------', 105, y, { align: 'center' });
  y += 6;
  doc.setFont('courier', 'bold');
  doc.text('CERTIFICACAO DO SISTEMA:', 14, y);
  y += 5;
  doc.setFont('courier', 'normal');
  doc.text('Atestamos para os devidos fins de transparencia e auditoria que todos os candidatos', 14, y);
  y += 4.5;
  doc.text('e opcoes de voto encontram-se rigorosamente com contagem ZERO nesta data e hora.', 14, y);

  doc.save(`Zeresima_Urna_Popular_${dataFormatada.replace(/\//g, '-')}.pdf`);
}

iniciarApuracao();