import { db } from './db';
import { drivers, wooviSubaccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkDriverSubaccount() {
  try {
    const email = process.argv[2] || 'ze14@gmail.com';
    
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, email))
      .limit(1);

    if (!driver) {
      console.log('❌ Motorista não encontrado com email', email);
      process.exit(0);
    }

    console.log('✅ Motorista encontrado:');
    console.log('   ID:', driver.id);
    console.log('   Nome:', driver.name);
    console.log('   Email:', driver.email);
    console.log('   CPF:', driver.cpf);
    console.log('   Chave PIX:', driver.pixKey || 'NÃO CADASTRADA');
    console.log('   Tipo Chave PIX:', driver.pixKeyType || 'NÃO CADASTRADO');
    console.log('   Aprovado:', driver.approve);
    console.log('   Ativo:', driver.active);
    console.log('   Data Criação:', driver.createdAt);

    const [subaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.driverId, driver.id))
      .limit(1);

    if (!subaccount) {
      console.log('\n❌ Subconta Woovi NÃO encontrada para este motorista');
    } else {
      console.log('\n✅ Subconta Woovi encontrada:');
      console.log('   ID:', subaccount.id);
      console.log('   Tipo:', subaccount.accountType);
      console.log('   Chave PIX:', subaccount.pixKey);
      console.log('   Tipo Chave:', subaccount.pixKeyType);
      console.log('   Woovi SubaccountId:', subaccount.wooviSubaccountId);
      console.log('   Saldo Cache:', subaccount.balanceCache);
      console.log('   Ativa:', subaccount.active);
      console.log('   Data Criação:', subaccount.createdAt);
    }

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkDriverSubaccount();
