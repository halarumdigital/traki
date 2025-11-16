# 📱 Mockup Visual - Aviso de Retorno no Modal

## 🎯 Objetivo
Alertar o motorista de forma clara e visível quando uma entrega requer retorno ao ponto de origem.

---

## 📐 Layout Completo do Modal

### ANTES (Sem Retorno)
```
╔═══════════════════════════════════════╗
║                                       ║
║        🚚 Nova Entrega!               ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  Jennifer e Felipe Pizzaria ME  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  📍 Retirada                          ║
║  Xv de Novembro, 500, Centro,         ║
║  Joaçaba - SC, Brasil                 ║
║                                       ║
║  🚩 Entrega                           ║
║  Rua Getúlio Vargas, 200 - centro     ║
║                                       ║
║  ┌──────────┐  ┌──────────┐          ║
║  │ 📏 1 km  │  │ ⏱ 9 min │          ║
║  └──────────┘  └──────────┘          ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │         💰 R$ 5,60              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌──────────┐    ┌──────────────┐    ║
║  │ Rejeitar │    │   Aceitar    │    ║
║  └──────────┘    └──────────────┘    ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

### DEPOIS (Com Retorno) ⚠️
```
╔═══════════════════════════════════════╗
║                                       ║
║        🚚 Nova Entrega!               ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  Jennifer e Felipe Pizzaria ME  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  📍 Retirada                          ║
║  Xv de Novembro, 500, Centro,         ║
║  Joaçaba - SC, Brasil                 ║
║                                       ║
║  🚩 Entrega                           ║
║  Rua Getúlio Vargas, 200 - centro     ║
║                                       ║
║  ┌──────────┐  ┌──────────┐          ║
║  │ 📏 1 km  │  │ ⏱ 9 min │          ║
║  └──────────┘  └──────────┘          ║
║                                       ║
║  ╔═══════════════════════════════════╗║
║  ║ ⚠️  ESTA ENTREGA POSSUI VOLTA    ║║
║  ║                                   ║║
║  ║ Você precisará retornar ao ponto ║║
║  ║ de retirada após entregar        ║║
║  ╚═══════════════════════════════════╝║
║         ↑ NOVO BANNER DE AVISO        ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │         💰 R$ 5,60              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌──────────┐    ┌──────────────┐    ║
║  │ Rejeitar │    │   Aceitar    │    ║
║  └──────────┘    └──────────────┘    ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

## 🎨 Especificações Detalhadas do Banner

### Dimensões e Espaçamento
```
┌─────────────────────────────────────┐
│  Margin Top: 16px                   │
├─────────────────────────────────────┤
│  ╔═══════════════════════════════╗  │ ← Border 2px #FFB020
│  ║ Padding: 12px all sides      ║  │
│  ║ Border Radius: 8px           ║  │
│  ║ Background: #FFF4E6          ║  │
│  ║                              ║  │
│  ║ ┌────┐                       ║  │
│  ║ │ ⚠️ │ ESTA ENTREGA POSSUI   ║  │
│  ║ └────┘ VOLTA                 ║  │
│  ║   ↑                          ║  │
│  ║   20px font                  ║  │
│  ║                              ║  │
│  ║ Margin Bottom: 8px           ║  │
│  ║                              ║  │
│  ║ Você precisará retornar ao   ║  │
│  ║ ponto de retirada após       ║  │
│  ║ entregar                     ║  │
│  ║   ↑                          ║  │
│  ║   13px font, line-height 18px║  │
│  ╚═══════════════════════════════╝  │
├─────────────────────────────────────┤
│  Margin Bottom: 16px                │
└─────────────────────────────────────┘
```

### Paleta de Cores
```
╔══════════════════════════════════════╗
║  Background Banner                   ║
║  #FFF4E6 (Amarelo muito claro)      ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  Borda                               ║
║  #FFB020 (Laranja/Amarelo)          ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  Título (ESTA ENTREGA POSSUI VOLTA)  ║
║  #C77700 (Laranja escuro)           ║
║  Font Weight: Bold                   ║
║  Font Size: 14px                     ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  Descrição                           ║
║  #8B5A00 (Marrom/Laranja)           ║
║  Font Weight: Normal                 ║
║  Font Size: 13px                     ║
║  Line Height: 18px                   ║
╚══════════════════════════════════════╝
```

---

## 💻 Implementação por Componente

### React Native (StyleSheet)

```javascript
const styles = StyleSheet.create({
  // Container do banner
  returnWarningContainer: {
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderColor: '#FFB020',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },

  // Header com ícone e título
  returnWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  // Ícone ⚠️
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },

  // Título "ESTA ENTREGA POSSUI VOLTA"
  returnWarningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C77700',
    flex: 1,
  },

  // Texto descritivo
  returnWarningText: {
    fontSize: 13,
    color: '#8B5A00',
    lineHeight: 18,
  },
});
```

### Flutter (Widget)

```dart
Container(
  margin: EdgeInsets.symmetric(vertical: 16),
  padding: EdgeInsets.all(12),
  decoration: BoxDecoration(
    color: Color(0xFFFFF4E6),
    border: Border.all(
      color: Color(0xFFFFB020),
      width: 2,
    ),
    borderRadius: BorderRadius.circular(8),
  ),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Text(
            '⚠️',
            style: TextStyle(fontSize: 20),
          ),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'ESTA ENTREGA POSSUI VOLTA',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Color(0xFFC77700),
              ),
            ),
          ),
        ],
      ),
      SizedBox(height: 8),
      Text(
        'Você precisará retornar ao ponto de retirada após entregar',
        style: TextStyle(
          fontSize: 13,
          color: Color(0xFF8B5A00),
          height: 1.4,
        ),
      ),
    ],
  ),
)
```

---

## ✅ Checklist de Implementação

### Visual
- [ ] Banner aparece apenas quando `needsReturn = true`
- [ ] Cores corretas (#FFF4E6, #FFB020, #C77700, #8B5A00)
- [ ] Ícone ⚠️ visível e alinhado
- [ ] Texto em negrito no título
- [ ] Espaçamento correto (padding 12px, margin 16px)
- [ ] Borda de 2px
- [ ] Border radius de 8px

### Posicionamento
- [ ] Banner está entre distância/tempo e valor
- [ ] Não sobrepõe outros elementos
- [ ] Responsivo em diferentes tamanhos de tela

### Comportamento
- [ ] Condicional: só aparece quando `needsReturn = true`
- [ ] Não interfere com botões Rejeitar/Aceitar
- [ ] Texto legível e claro

---

## 📸 Referências Visuais

### Hierarquia de Informação (de cima para baixo)
```
1. Título "Nova Entrega!"
2. Nome da empresa/cliente
3. Endereço de retirada
4. Endereço de entrega
5. Distância e tempo
6. ⚠️ BANNER DE AVISO (SE TIVER RETORNO)  ← NOVO
7. Valor da entrega
8. Botões Rejeitar/Aceitar
```

### Importância Visual
```
┌────────────────────────┐
│ Crítico (vermelho)     │ ← Botões de ação
├────────────────────────┤
│ Muito Alto (laranja)   │ ← Banner de retorno ⚠️
├────────────────────────┤
│ Alto (verde)           │ ← Valor da entrega
├────────────────────────┤
│ Médio (azul)           │ ← Endereços, distância
├────────────────────────┤
│ Normal (cinza)         │ ← Informações gerais
└────────────────────────┘
```

---

## 🎯 Objetivos do Aviso

### Principal
✅ **Informar claramente** que o motorista precisará retornar

### Secundários
✅ Evitar surpresas após aceitar a entrega
✅ Permitir decisão informada antes de aceitar
✅ Reduzir cancelamentos por falta de informação
✅ Melhorar experiência do motorista

---

## 📝 Textos Aprovados

### Título
```
ESTA ENTREGA POSSUI VOLTA
```
- Maiúsculas
- Negrito
- Cor: #C77700

### Descrição
```
Você precisará retornar ao ponto de retirada após entregar
```
- Sentença normal (primeira letra maiúscula)
- Peso normal
- Cor: #8B5A00

### Alternativa (mais curta)
```
Retorno ao ponto de origem necessário
```

---

## 🚨 Estados de Erro (Não implementar)

❌ **NÃO** usar vermelho para o banner (reservado para erros críticos)
❌ **NÃO** usar animações excessivas (pode distrair)
❌ **NÃO** usar pop-up separado (deve estar integrado ao modal)
❌ **NÃO** permitir fechar o aviso (deve ser sempre visível quando needsReturn = true)

---

## 📱 Testes Visuais

### Cenários para Testar
1. ✅ Entrega COM retorno (banner aparece)
2. ✅ Entrega SEM retorno (banner não aparece)
3. ✅ Texto longo no endereço (banner não quebra layout)
4. ✅ Tela pequena (iPhone SE) - banner responsivo
5. ✅ Tela grande (iPad) - banner proporcional
6. ✅ Dark mode (se aplicável) - cores ajustadas
7. ✅ Acessibilidade (leitor de tela) - texto lido corretamente

---

**Data:** 11 de Novembro de 2025
**Versão:** 1.0.0
**Status:** Aguardando Implementação
