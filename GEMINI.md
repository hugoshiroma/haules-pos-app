# Diretrizes do Projeto: Haules PoS App

Este documento serve como um guia de contextualização e orientação para o desenvolvimento do aplicativo de Ponto de Venda (PoS) do Bar do Haules.

## 1. Visão Geral do Projeto

- **Produto:** Aplicativo de Ponto de Venda (PoS) para o "Bar do Haules".
- **Identidade:** O bar tem uma identidade "underground", "raíz", conectada com a cultura local de Jundiaí. É um espaço plural, alternativo e conceituado, famoso pela "caipirinha de rúcula", premiada nacionalmente. A UI/UX e a linguagem do app devem refletir essa identidade.
- **Plataforma:** Aplicativo híbrido (Android e iOS), desenvolvido com Expo. O teste primário é realizado em um dispositivo físico iOS.

## 2. Arquitetura e Tecnologias

- **Frontend:** Expo (React Native)
- **Backend:** MedusaJS (para o backoffice de produtos)
- **Serviços Adicionais:** Supabase Edge Functions (para validação de cupons e outras lógicas de negócio)
- **Hardware de Pagamento:** Máquina de cartão PagSeguro (modelo "moderninha" antigo, a ser confirmado). **A biblioteca `react-native-pagseguro-plugpag` já foi identificada e está sendo utilizada para a integração com a PagSeguro.**
- **Ambiente de Desenvolvimento:** Windows
- **Plataforma de Teste:** iOS (dispositivo físico do usuário). O build para iOS precisará ser feito via EAS Build, pois o ambiente de desenvolvimento é Windows.

## 3. Fluxo Principal do Aplicativo

1.  **Listagem de Produtos:** O app busca e exibe os produtos cadastrados no backoffice MedusaJS.
2.  **Registro do Pedido:** O atendente seleciona os produtos e as quantidades para o cliente.
3.  **Aplicação de Cupom:** O sistema lê um cupom (via QR code ou manual) e o valida através de uma Supabase Edge Function.
4.  **Confirmação da Compra:** O pedido é finalizado e a informação é enviada para o backend.
5.  **Cobrança:** O valor final é enviado para a máquina da PagSeguro para realizar a cobrança.

## 4. Foco de Desenvolvimento Atual: Integração com PagSeguro

**O desafio principal e foco imediato é a integração com a máquina de cartão da PagSeguro.**

-   **Localização do Código:** A lógica de pagamento deve ser implementada no arquivo `contexts/CartContext.tsx`, dentro do método `handleConfirmOrder`, no local comentado como `// Passo 2: Pagamento`.

-   **Estratégia de Implementação:**
    1.  **Análise de Reutilização:** A biblioteca `react-native-pagseguro-plugpag` já está sendo utilizada. O foco será em como configurar e usar essa biblioteca para a "moderninha" do usuário.
    2.  **Pesquisa por SDK Oficial:** Já temos a lib, agora é focar na documentação dela.
    3.  **Implementação Nativa (Plano B):** Se a lib não servir ou precisar de algo muito específico, aí sim pensamos em módulo nativo.
    4.  **Flexibilidade de Hardware:** O usuário está ciente e aberto à possibilidade de trocar o modelo da máquina de cartão caso um modelo diferente ofereça uma integração mais simples e documentada.

## 5. Diretrizes Gerais de Implementação

-   **Qualidade vs. Velocidade:** O projeto é uma PoC (Prova de Conceito) / MVP, então não exige o mais alto nível de refino. No entanto, por ser um sistema de pagamento, "gambiarras" ou soluções instáveis devem ser evitadas. O código deve ser funcional, legível e manutenível.
-   **Padrões de Código:** Seguir os padrões, estilo de formatação e arquitetura já existentes no projeto.
-   **Ecossistema Expo:** Manter a compatibilidade com o fluxo de trabalho do Expo, favorecendo soluções que não exijam `eject` para o "bare workflow", a menos que seja estritamente necessário (como no caso de um módulo nativo customizado).

## 6. Restrições Críticas

-   **Custo Zero:** Todas as ferramentas e soluções de desenvolvimento utilizadas devem ser gratuitas.
-   **Implicações para o Build em iOS:** Devido à restrição de custo zero, não será utilizada uma conta paga do Apple Developer Program ($99/ano). A Apple exige essa conta para assinar e instalar aplicativos com código nativo customizado em dispositivos físicos. Como o desenvolvimento está sendo feito em Windows, não é possível contornar essa exigência.
-   **Estratégia de Build e Teste:** Por conta do bloqueio acima, **o desenvolvimento e os testes de funcionalidades com código nativo (como a integração com a PagSeguro) deverão ser focados na plataforma Android**, que não possui custos de licenciamento para desenvolvimento e teste.