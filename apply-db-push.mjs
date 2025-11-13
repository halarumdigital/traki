import { spawn } from 'child_process';

const child = spawn('npm', ['run', 'db:push'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true
});

// Aguarda um momento para a pergunta aparecer
setTimeout(() => {
  // Envia Enter para selecionar a primeira opção (create table)
  child.stdin.write('\n');
  child.stdin.end();
}, 5000);

child.on('exit', (code) => {
  console.log(`Processo finalizado com código: ${code}`);
  process.exit(code);
});