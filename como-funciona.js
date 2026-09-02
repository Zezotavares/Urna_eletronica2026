// CONTROLE DE DUPLO PLAYER PARA TRANSIÇÃO INSTANTÂNEA SEM TELA PRETA
let audioCtx = null;
let ativoPlayerIndex = 1;

function obterAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function tocarSomShowDoMilhao() {
  try {
    const ctx = obterAudioContext();
    const agora = ctx.currentTime;

    const oscGrave = ctx.createOscillator();
    const gainGrave = ctx.createGain();
    oscGrave.type = 'triangle';
    oscGrave.frequency.setValueAtTime(120, agora);
    oscGrave.frequency.exponentialRampToValueAtTime(80, agora + 0.35);

    gainGrave.gain.setValueAtTime(0.2, agora);
    gainGrave.gain.exponentialRampToValueAtTime(0.001, agora + 0.4);

    oscGrave.connect(gainGrave);
    gainGrave.connect(ctx.destination);
    oscGrave.start(agora);
    oscGrave.stop(agora + 0.4);

    const oscAgudo = ctx.createOscillator();
    const gainAgudo = ctx.createGain();
    oscAgudo.type = 'sine';
    oscAgudo.frequency.setValueAtTime(640, agora + 0.05);
    oscAgudo.frequency.setValueAtTime(960, agora + 0.15);

    gainAgudo.gain.setValueAtTime(0.12, agora + 0.05);
    gainAgudo.gain.exponentialRampToValueAtTime(0.001, agora + 0.35);

    oscAgudo.connect(gainAgudo);
    gainAgudo.connect(ctx.destination);
    oscAgudo.start(agora + 0.05);
    oscAgudo.stop(agora + 0.35);
  } catch (e) {}
}

// TROCA SUAVE ENTRE OS PLAYERS DE VÍDEO
function alternarVideo(arquivoSrc, comLoop = false, comSom = true, aoTerminar = null) {
  const p1 = document.getElementById('video-player-1');
  const p2 = document.getElementById('video-player-2');
  if (!p1 || !p2) return;

  const playerAtivo = ativoPlayerIndex === 1 ? p1 : p2;
  const playerInativo = ativoPlayerIndex === 1 ? p2 : p1;

  playerInativo.src = arquivoSrc;
  playerInativo.loop = comLoop;
  playerInativo.muted = !comSom;
  playerInativo.load();

  playerInativo.oncanplaythrough = function() {
    playerInativo.play().then(() => {
      playerInativo.classList.add('ativo');
      playerAtivo.classList.remove('ativo');
      playerAtivo.pause();

      ativoPlayerIndex = ativoPlayerIndex === 1 ? 2 : 1;

      if (aoTerminar) {
        playerInativo.onended = aoTerminar;
      } else {
        playerInativo.onended = null;
      }
    }).catch(() => {});
  };
}

// REPRODUZ O VÍDEO DO TÓPICO ESCOLHIDO E RETORNA AO IDLE AO TERMINAR
function reproduzirVideoTopico(chave, arquivoVideo, botao) {
  tocarSomShowDoMilhao();

  document.querySelectorAll('.btn-alternativa').forEach(b => b.classList.remove('ativa'));
  if (botao) {
    botao.classList.add('ativa');
  }

  // Toca o vídeo da resposta e ao terminar volta instantaneamente para o idle
  alternarVideo(arquivoVideo, false, true, function() {
    alternarVideo('mesario-idle.mp4', true, false, null);
  });
}

// INICIALIZAÇÃO: COMEÇA COM A APRESENTAÇÃO E DEPOIS VAI PARA O IDLE
window.addEventListener('DOMContentLoaded', () => {
  const p1 = document.getElementById('video-player-1');
  const p2 = document.getElementById('video-player-2');

  if (p1) {
    p1.src = 'mesario-apresentacao.mp4';
    p1.loop = false;
    p1.muted = false;
    p1.classList.add('ativo');
    p1.play().catch(() => {
      p1.muted = true;
      p1.play();
    });

    p1.onended = function() {
      alternarVideo('mesario-idle.mp4', true, false, null);
    };

    if (p2) {
      p2.src = 'mesario-idle.mp4';
      p2.load();
    }
  }
});