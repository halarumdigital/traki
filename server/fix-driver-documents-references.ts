import { db } from './db';
import { driverDocuments, driverDocumentTypes } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function fixDriverDocumentsReferences() {
  console.log('🔧 Corrigindo referências órfãs em driver_documents...\n');

  try {
    // Buscar documentos com referências inválidas
    const orphanedDocs = await db.execute(sql`
      SELECT dd.id, dd.document_type_id
      FROM driver_documents dd
      LEFT JOIN driver_document_types ddt ON dd.document_type_id = ddt.id
      WHERE ddt.id IS NULL
    `);

    console.log(`📊 Encontrados ${orphanedDocs.rows.length} documentos com referências inválidas\n`);

    if (orphanedDocs.rows.length > 0) {
      console.log('Documentos órfãos:');
      orphanedDocs.rows.forEach((doc: any) => {
        console.log(`  - ID: ${doc.id}, document_type_id: ${doc.document_type_id}`);
      });

      // Opção 1: Deletar os documentos órfãos
      console.log('\n⚠️  Deletando documentos com referências inválidas...');

      const result = await db.execute(sql`
        DELETE FROM driver_documents
        WHERE document_type_id NOT IN (
          SELECT id FROM driver_document_types
        )
      `);

      console.log(`✅ ${orphanedDocs.rows.length} documentos órfãos deletados`);
    } else {
      console.log('✅ Nenhum documento órfão encontrado');
    }

    console.log('\n✨ Correção concluída! Agora você pode executar: npm run db:push');
  } catch (error) {
    console.error('❌ Erro ao corrigir referências:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixDriverDocumentsReferences();
