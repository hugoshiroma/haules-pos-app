# 💳 Integração PagSeguro Moderninha Plus 2 (PAX D190)

Este documento centraliza os requisitos, pendências e o status da integração com a maquininha via Bluetooth.

## 📌 Status Atual
- **Módulo Nativo:** Confirmado como `PagseguroPlugpag`.
- **Formato de Chamada:** O SDK nativo espera um JSON stringificado.
- **Campos:** `amount` (centavos), `type`, `installmentType`, `installments`, `printReceipt`, `userReference`.

## 📌 Pré-requisitos
- [x] **Mapeamento de Funções:** A interface `doPaymentClassic` foi corrigida para usar o formato JSON stringificado exigido pelo wrapper nativo.
- [ ] **Código de Ativação:** Usar o código `403938` ou o gerado no painel do PagSeguro.
- [ ] **Dispositivo Pareado:** A Moderninha Plus 2 DEVE estar pareada via Bluetooth nas configurações do Android.
- [ ] **Permissões:** Garanta que o app tem permissão de Localização Precisa e Bluetooth.

## 🛠️ Pendências de Validação
1. **Ativação:** Rodar o "Ativar Terminal" na Home para validar se o SDK inicializa corretamente.
2. **Cobrança Real:** Tente uma venda de R$ 1,10 para confirmar que o JSON stringificado é aceito pelo `PagseguroPlugpag.doPayment`.

## 🚀 Como Testar
1. Abra o app Haules PoS.
2. No menu principal, clique em **"Ativar Terminal"**.
3. No carrinho, finalize uma venda. O modal de tipo de pagamento e parcelas deve abrir e, após a seleção, o comando deve ser enviado para a Moderninha Plus 2.

## 📝 Logs de Implementação
- [2026-03-02] Removido guia de integração antigo.
- [2026-03-02] Corrigido `lib/plugpagClassic.ts` para usar o nome de módulo nativo real (`PagseguroPlugpag`) e o formato JSON exigido.
- [2026-03-02] Confirmada a interface via análise do arquivo `index.tsx` da biblioteca.
