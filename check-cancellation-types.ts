import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev');

async function checkTable() {
  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'company_cancellation_types'
      );
    `;
    console.log('Table exists:', tableExists);

    // Check table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_cancellation_types'
      ORDER BY ordinal_position;
    `;
    console.log('\nTable structure:', columns);

    // Check existing data
    const data = await sql`SELECT * FROM company_cancellation_types`;
    console.log('\nExisting data:', data);
    console.log('Total records:', data.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTable();
