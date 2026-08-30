const fs = require('fs');
const readline = require('readline');

const arquivoEntrada = 'CANDIDATOS-RS-2026-08-30T14_08_54.663Z.csv';
const arquivoSaida = 'candidatos_para_supabase.csv';

async function processarArquivo() {
  const leitor = readline.createInterface({
    input: fs.createReadStream(arquivoEntrada),
    crlfDelay: Infinity
  });

  const streamSaida = fs.createWriteStream(arquivoSaida, { encoding: 'utf8' });
  // Escreve o cabeçalho exato esperado pela tabela candidatos
  streamSaida.write('numero,nome,cargo,partido,foto_url\n');

  let primeiraLinha = true;

  for await (const linha of leitor) {
    if (primeiraLinha) {
      primeiraLinha = false;
      continue; // Pula o cabeçalho original
    }

    if (!linha.trim()) continue;

    // Divide considerando vírgulas
    const colunas = linha.split(',');

    if (colunas.length >= 4) {
      const nomeUrna = colunas[0].replace(/"/g, '').trim();
      const coligacao = colunas[1].replace(/"/g, '').trim();
      const numero = colunas[3].replace(/"/g, '').trim();
      const cargo = 'Deputado Estadual';
      const fotoUrl = '';

      // Monta linha formatada
      streamSaida.write(`"${numero}","${nomeUrna}","${cargo}","${coligacao}","${fotoUrl}"\n`);
    }
  }

  console.log(`Arquivo convertido com sucesso: ${arquivoSaida}`);
}

processarArquivo();