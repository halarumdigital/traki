import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import 'dotenv/config';

async function testFaceMatch() {
  try {
    console.log('🧪 Testando API FaceMatch...\n');

    // URLs das imagens de teste (substitua com URLs reais se necessário)
    const selfieUrl = 'https://pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev/documentos_entregadores/2c8eaacd-6789-4818-b34c-9b2e66ad2945.jpg';
    const cnhUrl = 'https://pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev/documentos_entregadores/52d76ced-7fbb-4fc4-8f3f-5cf5766dfab2.jpg';

    console.log(`📥 Baixando imagens...`);
    const [selfieResponse, cnhResponse] = await Promise.all([
      fetch(selfieUrl),
      fetch(cnhUrl),
    ]);

    if (!selfieResponse.ok || !cnhResponse.ok) {
      throw new Error('Erro ao baixar imagens');
    }

    const [selfieBuffer, cnhBuffer] = await Promise.all([
      selfieResponse.arrayBuffer(),
      cnhResponse.arrayBuffer(),
    ]);

    console.log(`✅ Imagens baixadas`);
    console.log(`   Selfie: ${selfieBuffer.byteLength} bytes`);
    console.log(`   CNH: ${cnhBuffer.byteLength} bytes\n`);

    // Criar FormData
    const formData = new FormData();
    formData.append('face_a', Buffer.from(selfieBuffer), {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
    });
    formData.append('face_b', Buffer.from(cnhBuffer), {
      filename: 'cnh.jpg',
      contentType: 'image/jpeg',
    });

    const apiToken = process.env.CELLEREIT_API_TOKEN;
    if (!apiToken) {
      throw new Error('CELLEREIT_API_TOKEN não configurado');
    }

    console.log(`🔑 API Token: ${apiToken.substring(0, 10)}...`);
    console.log(`📡 Enviando para API FaceMatch...\n`);

    // Teste 1: Sem Bearer
    console.log('📋 Teste 1: Authorization sem Bearer');
    const response1 = await fetch('https://api.gw.cellereit.com.br/facematch/', {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    console.log(`   Status: ${response1.status} ${response1.statusText}`);
    const body1 = await response1.text();
    console.log(`   Resposta: ${body1}\n`);

    // Recriar FormData para teste 2
    const formData2 = new FormData();
    formData2.append('face_a', Buffer.from(selfieBuffer), {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
    });
    formData2.append('face_b', Buffer.from(cnhBuffer), {
      filename: 'cnh.jpg',
      contentType: 'image/jpeg',
    });

    // Teste 2: Com Bearer
    console.log('📋 Teste 2: Authorization com Bearer');
    const response2 = await fetch('https://api.gw.cellereit.com.br/facematch/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        ...formData2.getHeaders(),
      },
      body: formData2,
    });

    console.log(`   Status: ${response2.status} ${response2.statusText}`);
    const body2 = await response2.text();
    console.log(`   Resposta: ${body2}\n`);

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testFaceMatch();
