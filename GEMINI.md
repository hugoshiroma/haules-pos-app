# Diretrizes do Projeto: Haules PoS App

Este documento serve como um guia de contextualização e orientação para o desenvolvimento do aplicativo de Ponto de Venda (PoS) do Bar do Haules.

## 1. Visão Geral do Projeto

- **Produto:** Aplicativo de Ponto de Venda (PoS) para o "Bar do Haules".
- **Identidade:** O bar tem uma identidade "underground", "raíz", conectada com a cultura local de Jundiaí. É um espaço plural, alternativo e conceituado, famoso pela **"caipirinha de rúcula", premiada nacionalmente**. A UI/UX e a linguagem do app devem refletir essa identidade.
- **Plataforma:** Aplicativo híbrido (Android e iOS), desenvolvido com Expo. O teste primário é realizado em um dispositivo físico Android (devido a restrições de build do iOS no Windows).

## 2. Arquitetura e Tecnologias

- **Frontend:** React Native com Expo (SDK 54).
- **Backend:** MedusaJS (para o backoffice de produtos).
- **Serviços Adicionais:** Supabase Edge Functions (para validação de cupons e outras lógicas de negócio).
- **Hardware de Pagamento:** Máquina de cartão PagSeguro (modelo "moderninha" antigo). A biblioteca `react-native-pagseguro-plugpag` está sendo utilizada para a integração.
- **Segurança:** Autenticação biométrica (FaceID/TouchID) e armazenamento seguro via `expo-secure-store`.
- **Ambiente de Desenvolvimento:** Windows.

## 3. Avanços e Progressos Recentes (Janeiro 2026)

### 🛠️ Build e Infraestrutura
- **Mover SDK Android:** Resolvido o erro do compilador Ninja movendo a SDK para `C:\AndroidSdk` (evitando espaços no caminho do usuário Windows).
- **Configuração de NDK:** Arquivo `local.properties` calibrado para apontar corretamente para as ferramentas C++.

### 🔐 Autenticação e Acesso
- **Auth Gate:** Implementada trava no `_layout.tsx`. Se não houver token, o usuário é forçado para a tela de Login.
- **Login Biométrico:** Implementado login por digital/rosto com persistência de 7 dias. Ativa após o primeiro login manual bem-sucedido.
- **Logout Moderno:** Modal de confirmação customizado com opção de limpar credenciais biométricas ("Esquecer Dispositivo").

### 🛒 Experiência de Compra (UX)
- **BottomSheet por Gestos:** Carrinho redesenhado usando `PanResponder`. Puxar para cima abre, puxar para baixo fecha (trava no rodapé se houver itens).
- **Persistent State:** O carrinho não é desmontado da memória, evitando glitches visuais.
- **Cálculo de Desconto:** Valor final calculado dinamicamente (`Total - Desconto`).
- **Scanner Higienizado:** Leitura de QR Code no formato `userCouponId|userId|email`. Implementada troca automática de `" "` por `"+"` no e-mail devido a limitações de leitura do hardware.

### 💳 Integração de Pagamento
- **Fluxo em Background:** O app libera o atendente logo após o sucesso na maquininha. A completude do pedido no Medusa ocorre em segundo plano.
- **Telemetria de Logs:** Sistema de logs interno para auditar transações e falhas de background.

## 4. Diretrizes de Código e Manutenção

- **Localização do Código:** A lógica de pagamento principal reside em `contexts/CartContext.tsx`, no método `handleConfirmOrder`.
- **Hacks Temporários:** Manter a substituição de espaços por `+` no e-mail até correção do gerador de QR Code.
- **Referência PagSeguro:** Manter o bloco `doPayment` comentado na função `performPayment` para referência rápida de implementação real.
- **Qualidade vs. Velocidade:** MVP focado em estabilidade de pagamento e agilidade no atendimento (fluxo sem interrupções inúteis).

## 5. Restrições Críticas

- **Custo Zero:** Todas as ferramentas e soluções devem ser gratuitas.
- **Bloqueio iOS:** Devido à falta de conta paga Apple Developer, o desenvolvimento de recursos nativos (PagSeguro/Biometria) é focado em **Android**.
- **Safe Area:** Layouts devem sempre respeitar o `useSafeAreaInsets` para não bater nos botões nativos de Androids de borda infinita.