# Diretrizes do Projeto: Haules PoS App

Este documento serve como um guia de contextualização e orientação para o desenvolvimento do aplicativo de Ponto de Venda (PoS) do Bar do Haules.

## 1. Visão Geral do Projeto

- **Produto:** Aplicativo de Ponto de Venda (PoS) para o "Bar do Haules".
- **Identidade:** O bar tem uma identidade "underground", "raíz", conectada com a cultura local de Jundiaí. É um espaço plural, alternativo e conceituado, famoso pela **"caipirinha de rúcula", premiada nacionalmente**. A UI/UX e a linguagem do app devem refletir essa identidade.
- **Plataforma:** Aplicativo híbrido (Android e iOS), desenvolvido com Expo. O teste primário é realizado em um dispositivo físico Android.

## 2. Arquitetura e Tecnologias

- **Frontend:** React Native com Expo (SDK 54).
- **Backend:** MedusaJS (para o backoffice de produtos).
- **Serviços Adicionais:** Supabase Edge Functions (para validação de cupons e outras lógicas de negócio).
- **Hardware de Pagamento:** Máquina de cartão PagSeguro (Moderninha Plus 2 / D190).
- **Integração Nativa:** **Expo Module Local** em `modules/plugpag-classic`. Utiliza a SDK `br.com.uol.pagseguro:plugpag:3.0.0`.
- **Segurança:** Autenticação biométrica (FaceID/TouchID) e armazenamento seguro via `expo-secure-store`.
- **Ambiente de Desenvolvimento:** Windows + Android Sdk em `C:\AndroidSdk`.

## 3. Avanços e Progressos Recentes (Março 2026)

### 🛠️ Build e Infraestrutura
- **Migração para Expo Modules:** Código nativo de pagamento movido de `android/` para `modules/plugpag-classic`. A pasta `android` agora é efêmera e gerada via `npx expo prebuild`.
- **SDK PagSeguro v3.0.0:** Módulo Kotlin atualizado para compatibilidade com a versão 3.0.0 da SDK PlugPag (correção de tipos, nullability e mudança de retorno de métodos como `initBTConnection`).
- **Xiaomi USB Workaround:** Devido a restrições de instalação via USB em dispositivos Xiaomi sem SIM card, o APK deve ser instalado manualmente ou via servidor local (`npx serve`) após desinstalar a versão anterior.

### 🔐 Autenticação e Acesso
- **Auth Gate:** Implementada trava no `_layout.tsx`. Se não houver token, o usuário é forçado para a tela de Login.
- **Login Biométrico:** Implementado login por digital/rosto com persistência de 7 dias. Ativa após o primeiro login manual bem-sucedido.

### 🛒 Experiência de Compra (UX)
- **BottomSheet por Gestos:** Carrinho funcional com `PanResponder`.
- **Scanner Higienizado:** Leitura de QR Code no formato `userCouponId|userId|email` com troca automática de `" "` por `"+"` no e-mail.

### 💳 Integração de Pagamento
- **Fluxo de Pagamento Real:** O método `executePaymentFlow` em `contexts/PaymentContext.tsx` está **ativo** e chama a integração real com a maquininha via `doPaymentClassic`.
- **Criação de Pedido:** O fluxo integra a criação do pedido no Medusa antes da cobrança e a conclusão após o sucesso na maquininha.

## 4. Diretrizes de Código e Manutenção

- **Localização do Código:** 
  - Lógica de UI de pagamento: `contexts/PaymentContext.tsx`.
  - Ponte JS/Nativo: `lib/plugpagClassic.ts` (consome o módulo local).
  - Código Nativo Kotlin: `modules/plugpag-classic/android/.../PlugPagClassicModule.kt`.
- **Manutenção de Módulos:** **Nunca** altere arquivos dentro da pasta `android/` diretamente. Qualquer mudança nativa deve ser feita na pasta `modules/` e regenerada com `npx expo prebuild`.
- **Assinatura de APK:** Ao regenerar a pasta `android`, a chave de debug muda. Sempre desinstale o app antigo do celular antes de instalar o novo.

## 5. Restrições Críticas

- **Custo Zero:** Todas as ferramentas e soluções devem ser gratuitas.
- **Bloqueio iOS:** Desenvolvimento de recursos nativos (PagSeguro/Biometria) focado em **Android** devido à falta de conta paga Apple Developer.
- **Safe Area:** Layouts devem sempre respeitar o `useSafeAreaInsets`.
